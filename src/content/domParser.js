/**
 * GeoLead AI — DOM Parser
 * Parses Google Maps business cards and extracts structured lead data.
 * Handles multiple Google Maps DOM versions with fallback selectors.
 */

// ====== SELECTORS (Google Maps DOM changes frequently, so we keep fallbacks) ======
const CARD_SELECTORS = [
    'div.Nv2PK',                          // Standard result card (most common)
    'div[jsaction*="mouseover"].lI9IFe',   // Alternate card container
    'div[role="article"]',                 // Generic article role fallback
    'a.hfpxzc',                            // Link-based cards (need parent)
];

const NAME_SELECTORS = [
    'a.hfpxzc',                    // Primary: link with aria-label
    '.fontHeadlineSmall',          // Headline element
    '.qBF1Pd.fontHeadlineSmall',   // Specific headline class
    'div.qBF1Pd',                  // Specific headline class fallback
    '[aria-label]',                // Any element with aria-label
];

const RATING_SELECTORS = [
    'span.MW4etd',                 // Star rating text
    'span.ZkP5Je',                 // Alternate rating
    'span[role="img"]',            // Image role with aria-label
];

const REVIEW_SELECTORS = [
    'span.UY7F9',                  // Review count in parens
    'span.e4rVHe.fontBodyMedium',  // Alternate review element
];

const ADDRESS_CONTAINER_SELECTORS = [
    '.W4Efsd .W4Efsd',             // Nested info sections
    '.fontBodyMedium',             // General body text
];

// ====== MAIN PARSER ======

/**
 * Parse all currently visible business result cards on the page
 * @returns {Array} Array of lead objects
 */
export function parseAllResults() {
    const leads = [];
    const seen = new Set();
    const cards = findBusinessCards();

    for (const card of cards) {
        try {
            const lead = extractLeadFromCard(card);
            if (lead && lead.businessName) {
                // Inline dedup by name (case-insensitive)
                const key = lead.businessName.toLowerCase().trim();
                if (!seen.has(key)) {
                    seen.add(key);
                    leads.push(lead);
                }
            }
        } catch (e) {
            console.warn('[GeoLead Parser] Could not parse card:', e.message);
        }
    }

    return leads;
}

/**
 * Find all business result cards on the page using fallback selectors
 * @returns {Array<Element>} Array of card DOM elements
 */
export function findBusinessCards() {
    for (const selector of CARD_SELECTORS) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
            // If we got link elements, get their parent cards
            if (cards[0].tagName === 'A') {
                return Array.from(cards)
                    .map(a => a.closest('div.Nv2PK') || a.parentElement)
                    .filter(Boolean);
            }
            return Array.from(cards);
        }
    }
    return [];
}

/**
 * Extract structured business data from a single result card element
 * @param {Element} card - The card DOM element
 * @returns {Object|null} Lead data object or null if extraction fails
 */
export function extractLeadFromCard(card) {
    if (!card) return null;

    const businessName = extractBusinessName(card);
    if (!businessName) return null;

    const placeUrl = extractPlaceUrl(card);
    const { rating, reviewCount } = extractRatingInfo(card);
    const category = extractCategory(card);
    const address = extractAddress(card);
    const phone = extractPhone(card);
    const { website, websiteStatus } = extractWebsite(card);

    return {
        id: generateLeadId(),
        businessName,
        category,
        rating,
        reviewCount,
        address,
        phone,
        website,
        websiteStatus,
        placeUrl,
        scrapedAt: new Date().toISOString(),
        pitch: null,
        pitchStatus: 'PENDING',
    };
}

// ====== FIELD EXTRACTORS ======

/**
 * Extract business name from card
 */
function extractBusinessName(card) {
    for (const selector of NAME_SELECTORS) {
        const el = card.querySelector(selector);
        if (el) {
            // Prefer aria-label (cleaner text)
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.trim().length > 0) {
                return ariaLabel.trim();
            }
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) {
                return text;
            }
        }
    }
    return '';
}

/**
 * Extract Google Maps place URL
 */
function extractPlaceUrl(card) {
    const linkEl = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="maps"]');
    if (linkEl && linkEl.href) {
        return linkEl.href;
    }
    return '';
}

/**
 * Extract star rating and review count
 */
function extractRatingInfo(card) {
    let rating = null;
    let reviewCount = null;

    // Rating
    for (const selector of RATING_SELECTORS) {
        const el = card.querySelector(selector);
        if (el) {
            const text = el.textContent || el.getAttribute('aria-label') || '';
            const match = text.match(/([\d.]+)/);
            if (match) {
                const parsed = parseFloat(match[1]);
                if (parsed >= 1.0 && parsed <= 5.0) {
                    rating = parsed;
                    break;
                }
            }
        }
    }

    // Review count
    for (const selector of REVIEW_SELECTORS) {
        const el = card.querySelector(selector);
        if (el) {
            const text = el.textContent || '';
            const match = text.match(/\(([\d,]+)\)/);
            if (match) {
                reviewCount = parseInt(match[1].replace(/,/g, ''), 10);
                break;
            }
        }
    }

    return { rating, reviewCount };
}

/**
 * Extract business category (e.g., Restaurant, Hotel, etc.)
 */
function extractCategory(card) {
    // Categories are usually the first text span in info sections
    const infoElements = card.querySelectorAll('.fontBodyMedium span, .W4Efsd span, div.W4Pne span');

    for (const el of infoElements) {
        const text = (el.textContent || '').trim();
        // Category is usually a short label, not a number, not a separator
        if (
            text &&
            text.length > 2 &&
            text.length < 40 &&
            !text.match(/^\d/) &&          // Not starting with number
            !text.includes('·') &&          // Not a separator
            !text.includes('(') &&          // Not review count
            !text.match(/\d{3,}/) &&       // Not a phone number
            !text.includes(',') &&           // Not an address (usually has commas)
            !text.startsWith('http') &&      // Not a URL
            text !== '$' && text !== '$$' && text !== '$$$'
        ) {
            return text;
        }
    }
    return '';
}

/**
 * Extract business address
 */
function extractAddress(card) {
    // Detailed View Primary: Specific address button
    const addrBtn = card.querySelector('button[data-item-id="address"]');
    if (addrBtn) {
        const ariaLabel = addrBtn.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.startsWith('Address:')) {
            return ariaLabel.replace('Address:', '').trim();
        }
        const textNode = addrBtn.querySelector('.Io6YTe');
        if (textNode) return textNode.textContent.trim();
    }

    // List View: Address is the span AFTER a dot separator (·) in .W4Efsd rows  
    const infoRows = card.querySelectorAll('.W4Efsd > .W4Efsd');
    for (const row of infoRows) {
        // Skip rating rows
        if (row.querySelector('.ZkP5Je') || row.querySelector('.AJB7ye')) continue;
        // Skip rows with hours (green/red colored text)
        if (row.querySelector('[style*="color: rgba(25,134,57"]') || row.querySelector('[style*="color: rgba(217,48,37"]')) continue;

        // Look for spans that follow a dot separator
        const topSpans = row.querySelectorAll(':scope > span');
        for (const topSpan of topSpans) {
            const dotSep = topSpan.querySelector('span[aria-hidden="true"]');
            if (dotSep && dotSep.textContent.trim() === '·') {
                // The address span is a sibling of the dot separator
                const siblings = topSpan.querySelectorAll('span');
                for (const sib of siblings) {
                    const text = sib.textContent.trim();
                    if (text && text !== '·' && !sib.getAttribute('aria-hidden') && !sib.classList.contains('google-symbols')) {
                        return text;
                    }
                }
            }
        }
    }
    return '';
}

/**
 * Extract phone number from card text
 */
function extractPhone(card) {
    // 1. Detailed View: data-item-id="phone:tel:..."
    const phoneBtn = card.querySelector('button[data-item-id^="phone:tel:"]');
    if (phoneBtn) {
        const ariaLabel = phoneBtn.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.startsWith('Phone:')) {
            const rawPhone = ariaLabel.replace('Phone:', '').trim();
            if (rawPhone) return rawPhone;
        }
        const extracted = phoneBtn.getAttribute('data-item-id').replace('phone:tel:', '');
        if (extracted) return extracted;
        const textNode = phoneBtn.querySelector('.Io6YTe');
        if (textNode) return textNode.textContent.trim();
    }

    // 2. List View: Google Maps phone class
    const phoneEl = card.querySelector('.UsdlK');
    if (phoneEl && phoneEl.textContent) {
        return phoneEl.textContent.trim();
    }

    // 3. Fallback: Check .W4Efsd info rows
    const infoRows = card.querySelectorAll('.W4Efsd > .W4Efsd');
    const phonePatterns = [
        /(?:\+?\d{1,3}[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/, // US / Generic (e.g. 555-555-5555, (555) 555-5555)
        /(?:\+92|0)[\s.-]?\d{3}[\s.-]?\d{7}/, // Pakistan mobile
        /(?:\+92|0)[\s.-]?\d{2}[\s.-]?\d{7,8}/, // Pakistan landline
        /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,4}/, // Broad generic spaced
        /\b(?:0|\+)\d{9,14}\b/ // Plain contiguous digits starting with 0 or +
    ];

    for (const row of infoRows) {
        if (row.querySelector('.ZkP5Je') || row.querySelector('.AJB7ye') || row.querySelector('.ah5Ghc')) continue;

        const spans = row.querySelectorAll('span');
        for (const span of spans) {
            const text = (span.textContent || '').trim();
            // Removed strict length and comma checks to allow matching inside longer text

            for (const pattern of phonePatterns) {
                const match = text.match(pattern);
                if (match) {
                    const phone = match[0].trim();
                    const digitCount = phone.replace(/\D/g, '').length;
                    if (digitCount >= 8 && digitCount <= 15) return phone;
                }
            }
        }
    }

    // 4. Last resort: scan all text in the card for highly confident patterns
    const allText = card.innerText || '';
    const matches = allText.match(/(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{4}/g);
    if (matches) {
        for (const match of matches) {
            const phone = match.trim();
            const digitCount = phone.replace(/\D/g, '').length;
            if (digitCount >= 8 && digitCount <= 15) return phone;
        }
    }

    return '';
}

/**
 * Extract website URL and determine its status
 */
function extractWebsite(card) {
    let website = null;

    // Method 1: Look for non-Google links OR Google redirect links
    const links = card.querySelectorAll('a[href]');
    for (const link of links) {
        const href = link.href;
        if (href && !href.includes('search?') && !href.includes('goo.gl')) {
            if (href.includes('google.com/url?q=')) {
                try {
                    const urlObj = new URL(href);
                    website = urlObj.searchParams.get('q');
                    if (website) break;
                } catch (e) { }
            } else if (!href.includes('google.com') && !href.includes('maps') && (href.startsWith('http://') || href.startsWith('https://'))) {
                website = href;
                break;
            }
        }
    }

    // Method 2: Look for data-item-id authority (detailed view)
    if (!website) {
        const webBtn = card.querySelector('a[data-item-id="authority"]');
        if (webBtn && webBtn.href) {
            website = webBtn.href.includes('google.com/url?q=') ? new URL(webBtn.href).searchParams.get('q') : webBtn.href;
        }
    }

    // Method 2: Look for website text in spans
    if (!website) {
        const allSpans = card.querySelectorAll('span, div');
        for (const span of allSpans) {
            const text = (span.textContent || '').trim();
            if (text.match(/^(https?:\/\/|www\.)\S+/i) && !text.includes('google.com')) {
                website = text.startsWith('www.') ? `https://${text}` : text;
                break;
            }
        }
    }

    // Determine website status
    let websiteStatus = 'NO_WEBSITE';
    if (website) {
        websiteStatus = (website.startsWith('http://') && !website.startsWith('https://'))
            ? 'NEEDS_REVAMP'
            : 'HAS_WEBSITE';
    }

    return { website, websiteStatus };
}

// ====== HELPERS ======

/**
 * Generate a unique ID for a lead
 */
function generateLeadId() {
    return 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Count currently visible business cards on page
 * @returns {number}
 */
export function countVisibleCards() {
    return findBusinessCards().length;
}
