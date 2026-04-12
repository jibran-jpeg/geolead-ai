/**
 * GeoLead AI — Agent Service
 *
 * The AI-powered bot that can:
 * 1. Extract leads from raw page text using Gemini (instead of DOM parsing)
 * 2. Enrich leads by visiting their websites and extracting owner name, emails, phone numbers
 * 3. Process enrichment in a queued, rate-limited fashion
 */

// ====== REQUEST QUEUE (shared with geminiService pattern) ======

class AgentQueue {
    constructor(delayMs = 2500) {
        this.queue = [];
        this.isProcessing = false;
        this.delayMs = delayMs;
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });

            if (!this.isProcessing) {
                this.process();
            }
        });
    }

    async process() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();
        await task();

        if (this.queue.length > 0) {
            await new Promise(res => setTimeout(res, this.delayMs));
        }

        this.process();
    }

    get pending() {
        return this.queue.length;
    }
}

const agentQueue = new AgentQueue(4000); // Increased delay to 4000ms to stay well below 15 RPM free tier limit

// ====== HTML CLEANING ======

/**
 * Strip HTML down to readable text for Gemini.
 * Removes scripts, styles, nav, footer, and other non-content elements.
 */
function cleanHtml(html) {
    // Remove <script>, <style>, <nav>, <footer>, <header>, <noscript>, <svg>, <iframe> blocks
    let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '');

    // Replace <br>, <p>, <div>, <li>, <tr> with newlines for readability
    cleaned = cleaned
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|li|tr|h[1-6])[^>]*>/gi, '\n');

    // Remove all remaining HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Collapse whitespace
    cleaned = cleaned
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // Truncate to ~8000 chars to stay within Gemini token limits
    if (cleaned.length > 8000) {
        cleaned = cleaned.substring(0, 8000) + '\n...[truncated]';
    }

    return cleaned;
}

// ====== URL FETCHER ======

/**
 * Fetch a URL and return cleaned text content.
 * Works from the background service worker using fetch().
 */
async function fetchAndCleanUrl(url) {
    try {
        // Ensure URL has protocol
        let fetchUrl = url;
        if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
            fetchUrl = 'https://' + fetchUrl;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(fetchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GeoLeadBot/1.0)',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        return cleanHtml(html);
    } catch (err) {
        console.warn(`[Agent] Failed to fetch ${url}:`, err.message);
        return null;
    }
}

// ====== GEMINI CALL (Structured JSON Output) ======

/**
 * Call Gemini with a prompt and expect JSON output.
 * Uses responseSchema for structured extraction.
 */
async function callGemini(apiKey, prompt, responseSchema = null) {
    if (!apiKey) {
        throw new Error('No Gemini API key. Add it in Settings → Gemini API Key.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.3,  // Low temperature for factual extraction
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 2048,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        ],
    };

    // If a schema is provided, tell Gemini to respond in JSON
    if (responseSchema) {
        requestBody.generationConfig.responseMimeType = 'application/json';
        requestBody.generationConfig.responseSchema = responseSchema;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `API error: ${response.status}`;

        if (response.status === 429) {
            throw new Error('Rate limit — please wait a moment and try again.');
        }
        if (response.status === 403) {
            throw new Error('Invalid API key. Check your Gemini API key in Settings.');
        }
        throw new Error(errMsg);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('Empty response from Gemini.');
    }

    return text.trim();
}

async function callGeminiWithRetry(apiKey, prompt, responseSchema = null, maxRetries = 3) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await callGemini(apiKey, prompt, responseSchema);
        } catch (err) {
            attempt++;
            const isRateLimit = err.message.includes('Rate limit') || err.message.includes('429');
            if (isRateLimit && attempt < maxRetries) {
                // Exponential backoff: 5s, 10s, 20s
                const backoffMs = Math.pow(2, attempt) * 2500;
                console.warn(`[Agent] Rate limit hit. Retrying in ${backoffMs / 1000}s... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(res => setTimeout(res, backoffMs));
            } else {
                throw err;
            }
        }
    }
}

// ====== LEAD ENRICHMENT ======

// JSON Schema for enrichment response
const ENRICHMENT_SCHEMA = {
    type: 'object',
    properties: {
        ownerName: {
            type: 'string',
            description: 'The name of the business owner or manager, if found',
        },
        emails: {
            type: 'array',
            items: { type: 'string' },
            description: 'All email addresses found on the page',
        },
        phones: {
            type: 'array',
            items: { type: 'string' },
            description: 'All phone/mobile numbers found on the page',
        },
        services: {
            type: 'string',
            description: 'Brief summary of main services offered (1-2 lines)',
        },
        hasContactPage: {
            type: 'boolean',
            description: 'Whether a dedicated contact page was detected',
        },
    },
    required: ['emails', 'phones'],
};

/**
 * Enrich a single lead by:
 * 1. Fetching their homepage
 * 2. Trying to find and fetch their /contact page
 * 3. Sending content to Gemini for structured extraction
 *
 * @param {Object} lead - Lead object with at least { businessName, website }
 * @param {string} apiKey - Gemini API key
 * @returns {Object} Enrichment data { ownerName, emails, phones, services }
 */
export async function enrichLead(lead, apiKey) {
    if (!lead.website) {
        return {
            ownerName: '',
            emails: [],
            phones: [],
            services: '',
            enrichmentStatus: 'NO_WEBSITE',
        };
    }

    // Step 1: Fetch the homepage
    let pageText = await fetchAndCleanUrl(lead.website);

    // Step 2: Try common contact page paths
    if (pageText) {
        const contactPaths = ['/contact', '/contact-us', '/about', '/about-us'];
        for (const path of contactPaths) {
            try {
                const baseUrl = new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website);
                const contactUrl = `${baseUrl.origin}${path}`;
                const contactText = await fetchAndCleanUrl(contactUrl);
                if (contactText && contactText.length > 100) {
                    pageText += '\n\n--- CONTACT PAGE ---\n' + contactText;
                    break; // Found a contact page, no need to try more
                }
            } catch {
                // URL parsing failed, skip
            }
        }
    }

    if (!pageText) {
        return {
            ownerName: '',
            emails: [],
            phones: [],
            services: '',
            enrichmentStatus: 'FETCH_FAILED',
        };
    }

    // Step 3: Ask Gemini to extract structured data
    const prompt = `You are a data extraction expert. Analyze the following website content for the business "${lead.businessName}".

Extract the following information:
1. **Owner/Manager Name**: The name of the business owner, founder, or main contact person. If not explicitly found, leave empty.
2. **Email Addresses**: ALL email addresses found anywhere in the text. Look carefully for patterns like name@domain.com, info@, contact@, etc.
3. **Phone/Mobile Numbers**: ALL phone numbers and mobile numbers. Include country codes if present.
4. **Services**: A brief 1-2 line summary of the main services this business offers.
5. **Has Contact Page**: Whether this content includes a dedicated contact/about page.

IMPORTANT: Only return data you can actually find in the text. Do NOT make up or guess emails/phones.

Website content:
${pageText}`;

    try {
        const resultText = await agentQueue.add(() =>
            callGeminiWithRetry(apiKey, prompt, ENRICHMENT_SCHEMA)
        );

        const result = JSON.parse(resultText);

        return {
            ownerName: result.ownerName || '',
            emails: result.emails || [],
            phones: result.phones || [],
            services: result.services || '',
            enrichmentStatus: 'ENRICHED',
        };
    } catch (err) {
        console.error('[Agent] Enrichment failed for', lead.businessName, err?.message || err);
        return {
            ownerName: '',
            emails: [],
            phones: [],
            services: '',
            enrichmentStatus: 'AI_ERROR',
            enrichmentError: err?.message || 'Unknown error',
        };
    }
}

// ====== AI-POWERED LEAD EXTRACTION FROM RAW TEXT ======

// JSON Schema for extraction response
const EXTRACTION_SCHEMA = {
    type: 'object',
    properties: {
        leads: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    businessName: { type: 'string' },
                    category: { type: 'string' },
                    rating: { type: 'number' },
                    reviewCount: { type: 'number' },
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    website: { type: 'string' },
                },
                required: ['businessName'],
            },
        },
    },
    required: ['leads'],
};

/**
 * Extract leads from raw page text using Gemini AI.
 * This is the "AI Scraper" — instead of DOM parsing, it reads text and extracts businesses.
 *
 * @param {string} rawText - The raw text content from the page
 * @param {string} apiKey - Gemini API key
 * @returns {Array} Array of lead objects
 */
export async function extractLeadsWithAI(rawText, apiKey) {
    if (!rawText || rawText.length < 50) {
        throw new Error('Not enough content on the page to extract leads.');
    }

    // Truncate if too long
    const text = rawText.length > 10000 ? rawText.substring(0, 10000) + '\n...[truncated]' : rawText;

    const prompt = `You are a lead extraction expert. Analyze the following text from a Google Maps search results page.

Extract ALL businesses/places listed. For each business, extract:
1. **businessName**: Full business name
2. **category**: Type of business (e.g., "Restaurant", "Dentist", "Plumber")
3. **rating**: Star rating (number, e.g., 4.5). Set to 0 if not found.
4. **reviewCount**: Number of reviews (number). Set to 0 if not found.
5. **address**: Full address or location
6. **phone**: Phone number if visible
7. **website**: Website URL if visible

Extract every business you can find. Do NOT skip any.

Page content:
${text}`;

    try {
        const resultText = await agentQueue.add(() =>
            callGeminiWithRetry(apiKey, prompt, EXTRACTION_SCHEMA)
        );

        const result = JSON.parse(resultText);
        return result.leads || [];
    } catch (err) {
        console.error('[Agent] AI extraction failed:', err?.message || err);
        throw new Error('AI extraction failed: ' + (err?.message || 'Unknown error'));
    }
}

// ====== BATCH ENRICHMENT ======

/**
 * Enrich multiple leads in sequence with progress callbacks.
 *
 * @param {Array} leads - Array of lead objects
 * @param {string} apiKey - Gemini API key
 * @param {Function} onProgress - Callback: (completedCount, totalCount, currentLead) => void
 * @returns {Array} Array of enriched lead objects
 */
export async function batchEnrichLeads(leads, apiKey, onProgress) {
    const leadsWithWebsites = leads.filter(l => l.website && l.website.trim() !== '');

    if (leadsWithWebsites.length === 0) {
        return leads; // Nothing to enrich
    }

    const enrichedMap = new Map();
    let completed = 0;

    for (const lead of leadsWithWebsites) {
        try {
            if (onProgress) {
                onProgress(completed, leadsWithWebsites.length, lead.businessName);
            }

            const enrichment = await enrichLead(lead, apiKey);
            enrichedMap.set(lead.id || lead.businessName, enrichment);
            completed++;
        } catch (err) {
            console.warn(`[Agent] Skipping enrichment for ${lead.businessName}:`, err.message);
            completed++;
        }
    }

    if (onProgress) {
        onProgress(completed, leadsWithWebsites.length, 'Done!');
    }

    // Merge enrichment data back into leads
    return leads.map(lead => {
        const key = lead.id || lead.businessName;
        const enrichment = enrichedMap.get(key);
        if (enrichment) {
            return {
                ...lead,
                ownerName: enrichment.ownerName || lead.ownerName || '',
                emails: enrichment.emails || [],
                phones: enrichment.phones || [],
                services: enrichment.services || '',
                enrichmentStatus: enrichment.enrichmentStatus,
            };
        }
        return lead;
    });
}

