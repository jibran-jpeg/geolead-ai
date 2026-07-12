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
            instagram: null,
            facebook: null,
            linkedin: null,
            twitter: null,
            youtube: null,
            tiktok: null,
            pinterest: null,
            websiteAnalysis: {
                reachable: false,
                httpsEnabled: false,
                redirectStatus: 'failed',
                sslValid: false,
                mobileFriendly: false,
                contactPageExists: false,
                contactFormAvailable: false,
                socialLinksAvailable: false
            },
            enrichmentStatus: 'NO_WEBSITE',
        };
    }

    // Step 1: Run the crawler to get contact details and technical checks
    const crawlerResult = await fetchContactsFromWebsite(lead.website, lead.businessName);

    // Step 2: Fetch the homepage text for Gemini to analyze
    let pageText = await fetchAndCleanUrl(lead.website);
    if (pageText) {
        const contactPaths = ['/contact', '/contact-us', '/about', '/about-us'];
        for (const path of contactPaths) {
            try {
                const baseUrl = new URL(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website);
                const contactUrl = `${baseUrl.origin}${path}`;
                const contactText = await fetchAndCleanUrl(contactUrl);
                if (contactText && contactText.length > 100) {
                    pageText += '\n\n--- CONTACT PAGE ---\n' + contactText;
                    break;
                }
            } catch {}
        }
    }

    if (!pageText) {
        return {
            ownerName: '',
            emails: crawlerResult.emails,
            phones: crawlerResult.phones,
            services: '',
            ...crawlerResult.socials,
            websiteAnalysis: crawlerResult.websiteAnalysis,
            enrichmentStatus: 'FETCH_FAILED',
        };
    }

    // Step 3: Ask Gemini to extract structured owner name / services
    const prompt = `You are a data extraction expert. Analyze the following website content for the business "${lead.businessName}".

Extract the following information:
1. **Owner/Manager Name**: The name of the business owner, founder, or main contact person. If not explicitly found, leave empty.
2. **Services**: A brief 1-2 line summary of the main services this business offers.

IMPORTANT: Only return data you can actually find in the text. Do NOT make up or guess.

Website content:
${pageText}`;

    const SCHEMA = {
        type: 'object',
        properties: {
            ownerName: { type: 'string', description: 'The name of the business owner or manager, if found' },
            services: { type: 'string', description: 'Brief summary of main services offered (1-2 lines)' }
        },
        required: []
    };

    try {
        const resultText = await agentQueue.add(() =>
            callGeminiWithRetry(apiKey, prompt, SCHEMA)
        );

        const result = JSON.parse(resultText);

        const mergedEmails = Array.from(new Set([...(lead.emails || []), ...(crawlerResult.emails || [])]));
        const mergedPhones = Array.from(new Set([...(lead.phones || []), ...(crawlerResult.phones || [])]));

        return {
            ownerName: result.ownerName || '',
            emails: mergedEmails,
            phones: mergedPhones,
            services: result.services || '',
            ...crawlerResult.socials,
            websiteAnalysis: crawlerResult.websiteAnalysis,
            enrichmentStatus: 'ENRICHED',
        };
    } catch (err) {
        console.error('[Agent] Enrichment failed for', lead.businessName, err?.message || err);
        return {
            ownerName: '',
            emails: crawlerResult.emails,
            phones: crawlerResult.phones,
            services: '',
            ...crawlerResult.socials,
            websiteAnalysis: crawlerResult.websiteAnalysis,
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
            const updated = {
                ...lead,
                ownerName: enrichment.ownerName || lead.ownerName || '',
                emails: enrichment.emails || [],
                phones: enrichment.phones || [],
                services: enrichment.services || '',
                instagram: enrichment.instagram || lead.instagram || null,
                facebook: enrichment.facebook || lead.facebook || null,
                linkedin: enrichment.linkedin || lead.linkedin || null,
                twitter: enrichment.twitter || lead.twitter || null,
                youtube: enrichment.youtube || lead.youtube || null,
                tiktok: enrichment.tiktok || lead.tiktok || null,
                pinterest: enrichment.pinterest || lead.pinterest || null,
                websiteAnalysis: enrichment.websiteAnalysis || lead.websiteAnalysis || null,
                enrichmentStatus: enrichment.enrichmentStatus,
            };
            
            const qualityScore = calculateLeadQualityScore(updated);
            updated.leadQualityScore = qualityScore;
            updated.priority = qualifyLead(updated, qualityScore);
            return updated;
        }
        return lead; // Bug fix: return original lead if not enriched
    });
}

/**
 * Perform a fast fetch of the business website to extract emails and phone numbers.
 * Traverses subpages like contact, about, footer.
 * Filters out junk emails.
 */
export async function fetchContactsFromWebsite(websiteUrl, businessName) {
    if (!websiteUrl) {
        return {
            emails: [],
            phones: [],
            socials: {
                instagram: null,
                facebook: null,
                linkedin: null,
                twitter: null,
                youtube: null,
                tiktok: null,
                pinterest: null
            },
            websiteAnalysis: {
                reachable: false,
                httpsEnabled: false,
                redirectStatus: 'failed',
                sslValid: false,
                mobileFriendly: false,
                contactPageExists: false,
                contactFormAvailable: false,
                socialLinksAvailable: false
            }
        };
    }
    
    let originalUrl = websiteUrl.trim();
    let domain = originalUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    
    const result = {
        emails: [],
        phones: [],
        socials: {
            instagram: null,
            facebook: null,
            linkedin: null,
            twitter: null,
            youtube: null,
            tiktok: null,
            pinterest: null
        },
        websiteAnalysis: {
            reachable: false,
            httpsEnabled: false,
            redirectStatus: 'no_redirect',
            sslValid: false,
            mobileFriendly: false,
            contactPageExists: false,
            contactFormAvailable: false,
            socialLinksAvailable: false
        }
    };

    const foundEmails = new Set();
    const foundPhones = new Set();
    const pagesToFetch = new Set();

    function isMobileFriendly(html) {
        return /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html) && /width=device-width/i.test(html);
    }

    function hasContactForm(html) {
        return /<form[^>]*>/i.test(html) || /class=["'][^"']*form[^"']*["']/i.test(html) || /id=["'][^"']*form[^"']*["']/i.test(html);
    }

    function extractSocials(html) {
        const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            const lowerHref = href.toLowerCase();
            if (lowerHref.includes('instagram.com/') && !result.socials.instagram) {
                result.socials.instagram = href;
            } else if (lowerHref.includes('facebook.com/') && !result.socials.facebook) {
                result.socials.facebook = href;
            } else if (lowerHref.includes('linkedin.com/') && !result.socials.linkedin) {
                result.socials.linkedin = href;
            } else if ((lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) && !result.socials.twitter) {
                result.socials.twitter = href;
            } else if (lowerHref.includes('youtube.com/') && !result.socials.youtube) {
                result.socials.youtube = href;
            } else if (lowerHref.includes('tiktok.com/') && !result.socials.tiktok) {
                result.socials.tiktok = href;
            } else if (lowerHref.includes('pinterest.com/') && !result.socials.pinterest) {
                result.socials.pinterest = href;
            }
        }
    }

    function extractFromHtml(html, pageUrl) {
        if (isMobileFriendly(html)) {
            result.websiteAnalysis.mobileFriendly = true;
        }

        if (hasContactForm(html)) {
            result.websiteAnalysis.contactFormAvailable = true;
        }

        extractSocials(html);

        const mailtoMatch = html.match(/href="mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10})/gi);
        if (mailtoMatch) {
            mailtoMatch.forEach(m => {
                const email = m.replace('href="mailto:', '').trim().toLowerCase();
                if (isValidEmail(email)) foundEmails.add(email);
            });
        }
        
        const telMatch = html.match(/href="tel:([^"']+)"/gi);
        if (telMatch) {
            telMatch.forEach(t => {
                const phone = t.replace('href="tel:', '').replace('"', '').trim();
                const normalized = phone.replace(/[^\d+]/g, '');
                if (normalized.length >= 7 && normalized.length <= 15) {
                    foundPhones.add(phone);
                }
            });
        }
        
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/g;
        const rawEmails = html.match(emailRegex);
        if (rawEmails) {
            rawEmails.forEach(e => {
                const email = e.trim().toLowerCase();
                if (isValidEmail(email)) foundEmails.add(email);
            });
        }
        
        const phoneRegex = /(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{4}/g;
        const rawPhones = html.match(phoneRegex);
        if (rawPhones) {
            rawPhones.forEach(p => {
                const phone = p.trim();
                const digits = phone.replace(/\D/g, '');
                if (digits.length >= 7 && digits.length <= 15 && !phone.includes('@')) {
                    foundPhones.add(phone);
                }
            });
        }
        
        try {
            const baseObj = new URL(pageUrl);
            const linkRegex = /href="([^"]+)"/gi;
            let match;
            while ((match = linkRegex.exec(html)) !== null) {
                const href = match[1].trim();
                if (/contact|about|support|help|footer/i.test(href)) {
                    let absoluteUrl = href;
                    if (href.startsWith('/')) {
                        absoluteUrl = `${baseObj.origin}${href}`;
                    } else if (!href.startsWith('http')) {
                        absoluteUrl = `${baseObj.origin}/${href}`;
                    }
                    
                    try {
                        const testObj = new URL(absoluteUrl);
                        if (testObj.hostname === baseObj.hostname) {
                            pagesToFetch.add(absoluteUrl);
                            result.websiteAnalysis.contactPageExists = true;
                        }
                    } catch {}
                }
            }
        } catch {}
    }

    function isValidEmail(email) {
        if (!email || !email.includes('@')) return false;
        
        const fileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js', '.svg', '.pdf'];
        if (fileExtensions.some(ext => email.endsWith(ext))) return false;
        
        const junkDomains = [
            'sentry.io', 'google.com', 'facebook.com', 'twitter.com', 'instagram.com', 
            'youtube.com', 'linkedin.com', 'pinterest.com', 'schema.org', 'w3.org', 
            'wordpress.org', 'bootstrap', 'jquery', 'cloudflare', 'analytics', 
            'hosting', 'domain', 'email.com', 'yourname', 'domain.com', 'example.com', 
            'placeholder', 'test.com', 'logrocket.com', 'bugsnag.com', 'wix.com', 
            'squarespace.com', 'webflow.com', 'doubleclick.net', 'adroll.com', 
            'googleadservices.com', 'gravatar.com', 'wp.com', 'git.io'
        ];
        
        const domain = email.split('@')[1];
        if (!domain) return false;
        
        if (junkDomains.some(junk => domain.includes(junk))) return false;
        
        const localPart = email.split('@')[0];
        const junkLocalParts = ['noreply', 'no-reply', 'privacy', 'security', 'billing', 'support', 'abuse', 'webmaster', 'jobs', 'careers'];
        if (junkLocalParts.some(junk => localPart === junk)) return false;
        
        return true;
    }

    let httpUrl = `http://${domain}`;
    let finalHtml = '';
    let finalUrl = '';
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(httpUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoLeadBot/1.0)' }
        });
        clearTimeout(timeout);
        
        result.websiteAnalysis.reachable = true;
        finalUrl = response.url;
        finalHtml = await response.text();
        
        if (finalUrl.startsWith('https://')) {
            result.websiteAnalysis.httpsEnabled = true;
            result.websiteAnalysis.sslValid = true;
            result.websiteAnalysis.redirectStatus = 'redirected';
        } else {
            result.websiteAnalysis.httpsEnabled = false;
            result.websiteAnalysis.redirectStatus = 'no_redirect';
        }
    } catch (err) {
        let httpsUrl = `https://${domain}`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(httpsUrl, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoLeadBot/1.0)' }
            });
            clearTimeout(timeout);
            
            result.websiteAnalysis.reachable = true;
            result.websiteAnalysis.httpsEnabled = true;
            result.websiteAnalysis.sslValid = true;
            result.websiteAnalysis.redirectStatus = 'no_redirect';
            finalUrl = response.url;
            finalHtml = await response.text();
        } catch (httpsErr) {
            console.warn(`[GeoLead BG] Direct HTTPS fetch failed for ${domain}:`, httpsErr.message);
        }
    }
    
    if (result.websiteAnalysis.reachable && finalHtml) {
        extractFromHtml(finalHtml, finalUrl);
        
        const listToFetch = Array.from(pagesToFetch).filter(p => p !== finalUrl).slice(0, 2);
        for (const subUrl of listToFetch) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(subUrl, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoLeadBot/1.0)' }
                });
                clearTimeout(timeout);
                
                if (response.ok) {
                    const html = await response.text();
                    extractFromHtml(html, subUrl);
                }
            } catch (err) {
                console.warn(`[GeoLead BG] Subpage fetch failed for ${subUrl}:`, err.message);
            }
        }
    }
    
    result.websiteAnalysis.socialLinksAvailable = Object.values(result.socials).some(link => link !== null);
    
    result.emails = Array.from(foundEmails);
    result.phones = Array.from(foundPhones);
    
    return result;
}

// ====== LEAD SCORING UTILITIES ======

export function calculateLeadQualityScore(lead) {
    let score = 0.0;
    
    const hasWebsite = !!lead.website;
    if (hasWebsite) {
        score += 1.5;
        const analysis = lead.websiteAnalysis || {};
        if (analysis.httpsEnabled || lead.websiteStatus === 'HAS_WEBSITE') {
            score += 0.5;
        }
        if (analysis.sslValid && analysis.reachable) {
            score += 1.0;
        }
    }
    
    const hasPhone = !!lead.phone;
    const hasEmail = (lead.emails && lead.emails.length > 0) || !!lead.email;
    const hasOwner = !!lead.ownerName;
    
    if (hasPhone) score += 1.0;
    if (hasEmail) score += 1.5;
    if (hasPhone && hasEmail) score += 0.5;
    if (hasOwner) score += 0.5;
    
    let socialCount = 0;
    const platforms = ['instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest'];
    platforms.forEach(p => {
        if (lead[p]) socialCount++;
    });
    if (lead.socials) {
        platforms.forEach(p => {
            if (lead.socials[p]) socialCount++;
        });
    }
    score += Math.min(1.5, socialCount * 0.5);
    
    const rating = parseFloat(lead.rating);
    const reviews = parseInt(lead.reviewCount);
    
    if (!isNaN(rating) && rating > 0) {
        score += 0.5;
        if (rating >= 4.0) score += 0.5;
    }
    if (!isNaN(reviews) && reviews > 0) {
        score += 0.5;
        if (reviews >= 50) score += 0.5;
    }
    
    const hasAddress = !!lead.address;
    const hasHours = !!lead.openingHours;
    const hasServices = lead.services && lead.services.length > 0;
    
    if (hasAddress) score += 0.5;
    if (hasHours) score += 0.5;
    if (hasServices) score += 0.5;
    
    return Math.max(1, Math.min(10, Math.round(score)));
}


export function qualifyLead(lead, qualityScore) {
    const hasPhone = !!lead.phone;
    const hasEmail = (lead.emails && lead.emails.length > 0) || !!lead.email;
    const rating = parseFloat(lead.rating);
    const reviews = parseInt(lead.reviewCount);
    
    if (qualityScore >= 8 || (hasPhone && !isNaN(rating) && rating >= 4.0 && !isNaN(reviews) && reviews >= 5)) {
        return 'High';
    } else if (qualityScore >= 5 || (hasPhone || hasEmail)) {
        return 'Medium';
    } else {
        return 'Low';
    }
}

