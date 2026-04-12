
class RequestQueue {
    constructor(delayMs = 2000) {
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

        // Wait before processing next task to respect rate limits
        if (this.queue.length > 0) {
            await new Promise(res => setTimeout(res, this.delayMs));
        }

        this.process();
    }
}

// Limit requests to 1 every 4.5 seconds to respect Gemini Free Tier (15 RPM)
const geminiQueue = new RequestQueue(4500);

/**
 * Generate pitch(es) based on mode
 * @param {Object} lead - Lead data
 * @param {string} apiKey - Gemini API key
 * @param {string} pitchType - 'cold', 'followup', 'audit'
 * @param {string} mode - 'email', 'sms', or 'both'
 * @returns {Object} { emailPitch, smsPitch } or { pitch } for backwards compat
 */
export async function generatePitch(lead, apiKey, pitchType = 'cold', mode = 'email') {
    if (mode === 'both') {
        // Generate both pitches (queued sequentially)
        const emailPitch = await geminiQueue.add(() => handlePitchGeneration(lead, apiKey, pitchType, 'email'));
        const smsPitch = await geminiQueue.add(() => handlePitchGeneration(lead, apiKey, pitchType, 'sms'));
        return { emailPitch, smsPitch };
    }

    if (mode === 'sms') {
        const smsPitch = await geminiQueue.add(() => handlePitchGeneration(lead, apiKey, pitchType, 'sms'));
        return { smsPitch };
    }

    // Default: email only
    const emailPitch = await geminiQueue.add(() => handlePitchGeneration(lead, apiKey, pitchType, 'email'));
    return { emailPitch };
}

async function handlePitchGeneration(lead, apiKey, pitchType = 'cold', channel = 'email') {
    let maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            return await doGeminiCall(lead, apiKey, pitchType, channel);
        } catch (err) {
            attempt++;
            const isRateLimit = err.message.includes('Rate limit') || err.message.includes('429');
            if (isRateLimit && attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 2500;
                console.warn(`[GeoLead BG] Rate limit on pitch generation. Retrying in ${backoff/1000}s...`);
                await new Promise(res => setTimeout(res, backoff));
            } else {
                throw err;
            }
        }
    }
}

async function doGeminiCall(lead, apiKey, pitchType, channel) {
    if (!apiKey) {
        throw new Error('No Gemini API key provided. Add it in Settings.');
    }

    const prompt = channel === 'sms' ? buildSmsPrompt(lead) : buildEmailPrompt(lead, pitchType);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.85,
                topK: 50,
                topP: 0.95,
                maxOutputTokens: channel === 'sms' ? 200 : 500,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `API error: ${response.status}`;

        if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 403) {
            throw new Error('Invalid API key. Please check your Gemini API key in Settings.');
        }

        throw new Error(errMsg);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No content in API response. The model may have blocked the request.');
    }

    return text.trim();
}

function buildSmsPrompt(lead) {
    const businessInfo = `"${lead.businessName}" (a ${lead.category || 'local business'}${lead.address ? ` in ${lead.address}` : ''})`;
    const ratingInfo = lead.rating ? ` They have a ${lead.rating}⭐ rating${lead.reviewCount ? ` with ${lead.reviewCount} reviews` : ''}.` : '';
    const enrichedInfo = lead.ownerName ? ` The owner/manager is ${lead.ownerName}.` : '';
    const servicesInfo = lead.services ? ` They offer: ${lead.services}.` : '';

    // Pick random opening style so messages never feel templated
    const openingStyles = [
        'Start with a casual observation about their business or area.',
        'Open with a quick genuine compliment about what they do.',
        'Start with a question relevant to their specific industry.',
        'Begin with a brief relatable scenario their customers face.',
        'Open with a fun or surprising fact about their business type.'
    ];
    const randomOpening = openingStyles[Math.floor(Math.random() * openingStyles.length)];

    const baseRules = `
RULES:
- Act as a solo freelance web developer named Jibbu.
- Tone MUST be hyper-casual and direct. Sound like a real human texting, NOT a template.
- Maximum 3-4 short sentences.
- NO marketing jargon (no "elevate", "synergy", "digital presence", "online presence", "unlock potential").
- You MUST reference their SPECIFIC business name "${lead.businessName}" and what they specifically do (${lead.category || 'their business'}).
- ${lead.rating >= 4 ? `Compliment their great ${lead.rating}★ rating/reviews naturally — mention a SPECIFIC detail about why customers love them` : 'Be encouraging and positive about their business'}
- ${lead.ownerName ? `Address them by name: ${lead.ownerName}` : 'Use a friendly greeting like "Hey!" or "Hi there!"'}
- Include a soft, low-pressure call to action.
- Always sign off with "- Jibbu" or "Best, Jibbu".
- Do NOT use formal language like "Dear", "Sincerely", [Your Name], or placeholders.
- Make it feel personal, not mass-sent.
- ${randomOpening}
- CRITICAL: This message must be COMPLETELY UNIQUE. Do NOT reuse any sentence structure from previous messages. Vary your tone, vocabulary, and approach every single time.`;

    if (!lead.website || lead.websiteStatus === 'NO_WEBSITE') {
        return `You write friendly, personalized WhatsApp messages for business outreach. Write a UNIQUE message to the owner of ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}

They do NOT have a website. Explain how a website would help THIS SPECIFIC type of business (${lead.category || 'their industry'}) get more customers — give a CONCRETE example relevant to what "${lead.businessName}" specifically does. Think about what THEIR customers search for online.
${baseRules}`;
    }

    if (lead.websiteStatus === 'NEEDS_REVAMP') {
        return `You write friendly, personalized WhatsApp messages for business outreach. Write a UNIQUE message to the owner of ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}

Their website ${lead.website} uses HTTP (not HTTPS) and may need a refresh. Mention a SPECIFIC benefit of upgrading that's relevant to a ${lead.category || 'business'} like "${lead.businessName}" — think about what their customers specifically need.
${baseRules}`;
    }

    return `You write friendly, personalized WhatsApp messages for business outreach. Write a UNIQUE message to the owner of ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}

Their website is ${lead.website}. Offer a SPECIFIC improvement idea relevant to "${lead.businessName}" as a ${lead.category || 'business'} — not a generic "free audit" but something concrete THEIR customers would benefit from.
${baseRules}`;
}

// ====== EMAIL PROMPT ======

function buildEmailPrompt(lead, pitchType = 'cold') {
    const businessInfo = `"${lead.businessName}" (a ${lead.category || 'local business'}${lead.address ? ` located in ${lead.address}` : ''})`;
    const ratingInfo = lead.rating ? ` They have a ${lead.rating}⭐ rating${lead.reviewCount ? ` with ${lead.reviewCount} reviews` : ''}.` : '';
    const enrichedInfo = lead.ownerName ? ` The owner/manager is ${lead.ownerName}.` : '';
    const servicesInfo = lead.services ? ` Their services include: ${lead.services}.` : '';

    // Randomize email approach so no two emails have the same structure
    const approaches = [
        'Lead with a specific observation about their business that shows you did research.',
        'Start by relating a quick story about how you helped a similar business.',
        'Open with a thought-provoking question about their customer experience.',
        'Begin by mentioning something specific about their location or neighborhood.',
        'Start with a genuine compliment about something unique they offer.'
    ];
    const randomApproach = approaches[Math.floor(Math.random() * approaches.length)];

    const systemContext = `You are a solo freelance web developer named Jibbu who writes personalized cold emails to local businesses.

KEY PRINCIPLES:
- Tone MUST be hyper-casual and direct. Every email must feel hand-written, NEVER templated.
- NO marketing jargon (no "elevate", "synergy", "digital presence", "innovative solutions", "online presence", "unlock", "leverage", "boost").
- Maximum 4-5 sentences total.
- Start with an all-lowercase "subject:" line tailored specifically to "${lead.businessName}" — NEVER a generic subject line.
- Always sign off with "- Jibbu" or "Best, Jibbu".
- You MUST reference "${lead.businessName}" by name, their category (${lead.category || 'business'}), and their location (${lead.address || 'local area'}) naturally.
- ${lead.rating >= 4 ? `Genuinely compliment their ${lead.rating}★ rating — mention what makes THEIR reviews stand out.` : 'Be warm and encouraging about their business.'}
- ${lead.ownerName ? `Address the owner by name: ${lead.ownerName}` : 'Use "Hi" or "Hey" — keep it warm.'}
- Give ONE specific, concrete example of how you can help "${lead.businessName}" specifically — think about what THEIR customers need.
- Sound like a helpful person, not a corporate salesperson.
- Do NOT use any placeholders like [Your Name] or generic phrases like "I hope this email finds you well."
- ${randomApproach}
- CRITICAL: This email must be COMPLETELY UNIQUE to "${lead.businessName}". Do NOT reuse sentence structures, subject lines, or CTAs from any other email. Every word should feel written specifically for THIS business.`;

    if (!lead.website || lead.websiteStatus === 'NO_WEBSITE') {
        if (pitchType === 'followup') {
            return `${systemContext}\n\nWrite a short, warm follow-up email to ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nThis is a follow-up to a previous email about creating a website. Don't repeat the original pitch — instead mention ONE new benefit specific to a ${lead.category || 'business'} called "${lead.businessName}" (e.g., online ordering for restaurants, appointment booking for clinics, class schedules for gyms). Make the benefit hyper-specific to what THEIR customers would want.`;
        }
        return `${systemContext}\n\nWrite a compelling cold email to the owner of ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nThey do NOT have a website. Explain how having a website would specifically help "${lead.businessName}" as a ${lead.category || 'business'} — give a CONCRETE, industry-specific example that shows you understand what THEIR customers search for and need. Mention their great reputation if they have good reviews.`;
    }

    if (lead.websiteStatus === 'NEEDS_REVAMP') {
        if (pitchType === 'audit') {
            return `${systemContext}\n\nWrite an email offering a free website audit to ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nTheir website ${lead.website} uses HTTP (not HTTPS). Focus on ONE specific risk that matters to "${lead.businessName}" as a ${lead.category || 'business'} (e.g., customers not trusting payment info for shops, patients worried about privacy for clinics). Make it relevant to THEIR specific situation.`;
        }
        return `${systemContext}\n\nWrite a cold email to ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nTheir website ${lead.website} needs a security/design upgrade. Mention ONE specific improvement that would matter most to "${lead.businessName}" as a ${lead.category || 'business'}. Be tactful — don't insult their current site. Show you understand THEIR industry.`;
    }

    if (pitchType === 'audit') {
        return `${systemContext}\n\nWrite an email offering a free performance audit to ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nTheir current website is ${lead.website}. Suggest ONE specific improvement relevant to "${lead.businessName}" as a ${lead.category || 'business'} — something THEIR customers would actually benefit from (e.g., online ordering for restaurants, portfolio gallery for studios, booking system for salons).`;
    }

    return `${systemContext}\n\nWrite a cold email to the owner of ${businessInfo}.${ratingInfo}${enrichedInfo}${servicesInfo}\n\nTheir current website is ${lead.website}. Suggest a specific improvement that would benefit "${lead.businessName}" as a ${lead.category || 'business'} — something concrete and specific to THEIR industry, not "make it faster". Reference their reputation and reviews naturally if available.`;
}

