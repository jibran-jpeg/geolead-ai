/**
 * Advanced Data Validation and Cleaning Utilities
 * Provides comprehensive validation for phone numbers, emails, websites, and business names
 */

// Phone number validation patterns for Pakistan and international
const PHONE_PATTERNS = {
    // Pakistan mobile (03XX-XXXXXXX or +92-3XX-XXXXXXX)
    pakistanMobile: /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/,
    // Pakistan landline (0XXX-XXXXXXX or +92-XXX-XXXXXXX)
    pakistanLandline: /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/,
    // International format
    international: /\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
    // US/Canada format
    usCanada: /\(\d{3}\)\s?\d{3}[-.]?\d{4}/,
    // UK format
    uk: /\(?\+44\s?\)?\s?\d{3,4}\s?\d{3}\s?\d{3}/,
    // EU formats
    eu: /\+\d{1,3}\s?\d{3}\s?\d{3}\s?\d{3,4}/,
    // Generic format with 7-15 digits
    generic: /\b\d{7,15}\b/
};

// Email validation patterns
const EMAIL_PATTERNS = {
    standard: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    business: /^[a-zA-Z0-9._%+-]+@(business|company|corp|enterprise)\.[a-zA-Z]{2,}$/,
    commonTLDs: /^[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|icloud)\.[a-zA-Z]{2,}$/
};

// Website URL validation patterns
const WEBSITE_PATTERNS = {
    standard: /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    business: /^https?:\/\/(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(com|org|net|biz|co|io|tech|ai|pk|in|uk|us|ca|au|de|fr|es|it|nl|be|ch|se|no|dk|fi|at|ie|pt|gr|cz|hu|ro|bg|hr|si|sk|pl|ua|ru|cn|jp|kr|sg|my|th|vn|id|ph|mx|br|ar|cl|co|pe|ve|ec|cr|gt|sv|hn|ni|pa|bo|py|uy|ar)$/,
    social: /^(https?:\/\/)?(www\.)?(facebook|twitter|instagram|linkedin|youtube|tiktok|pinterest)\.com/
};

// Disposable/temporary email domains
const DISPOSABLE_DOMAINS = [
    'tempmail', '10minutemail', 'guerrillamail', 'mailinator', 'trashmail',
    'sharklasers', 'yopmail', 'maildrop', 'anonbox', 'mohmal'
];

// Common junk email domains
const JUNK_DOMAINS = [
    'sentry.io', 'googleadservices.com', 'gravatar.com', 'git.io',
    'no-reply', 'noreply', 'donotreply', 'autoresponder'
];

/**
 * Validate and normalize phone numbers
 * @param {string} phone - Phone number to validate
 * @param {string} region - Region code (e.g., 'PK' for Pakistan)
 * @returns {Object} Validation result with normalized phone and validation status
 */
function validatePhoneNumber(phone, region = 'PK') {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, normalized: null, region: null, type: null };
    }

    const cleaned = phone.replace(/[^\d+\-()\s]/g, '').trim();
    
    // Check minimum length
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
        return { valid: false, normalized: null, region: null, type: null };
    }

    // Pakistan-specific validation
    if (region === 'PK') {
        if (PHONE_PATTERNS.pakistanMobile.test(phone)) {
            const normalized = normalizePhoneNumber(phone, 'PK');
            return { valid: true, normalized, region: 'PK', type: 'mobile' };
        }
        if (PHONE_PATTERNS.pakistanLandline.test(phone)) {
            const normalized = normalizePhoneNumber(phone, 'PK');
            return { valid: true, normalized, region: 'PK', type: 'landline' };
        }
    }

    // International validation
    if (PHONE_PATTERNS.international.test(phone)) {
        const normalized = normalizePhoneNumber(phone, 'INT');
        return { valid: true, normalized, region: 'INT', type: 'international' };
    }

    // US/Canada validation
    if (PHONE_PATTERNS.usCanada.test(phone)) {
        const normalized = normalizePhoneNumber(phone, 'US');
        return { valid: true, normalized, region: 'US', type: 'north_america' };
    }

    // Fallback to generic
    if (PHONE_PATTERNS.generic.test(phone)) {
        const normalized = normalizePhoneNumber(phone, 'GENERIC');
        return { valid: true, normalized, region: 'GENERIC', type: 'generic' };
    }

    return { valid: false, normalized: null, region: null, type: null };
}

/**
 * Normalize phone number to standard format
 * @param {string} phone - Phone number to normalize
 * @param {string} region - Region code for normalization rules
 * @returns {string} Normalized phone number
 */
function normalizePhoneNumber(phone, region = 'PK') {
    if (!phone) return '';

    // Remove all non-digit characters except + and -
    let cleaned = phone.replace(/[^\d+\-()]/g, '').trim();

    switch (region) {
        case 'PK':
            // Normalize Pakistani numbers
            if (cleaned.startsWith('+92')) {
                // International format: +92-3XX-XXXXXXX
                return cleaned.replace(/\+/g, '').replace(/(\d{2})(\d{3})(\d{7})/, '$1-$2-$3');
            } else if (cleaned.startsWith('0')) {
                // Local format: 0-3XX-XXXXXXX
                return cleaned.replace(/^0/, '').replace(/(\d{2})(\d{3})(\d{7})/, '$1-$2-$3');
            }
            break;

        case 'US':
            // Normalize US numbers: (123) 456-7890
            const usMatch = cleaned.match(/\d{10}/);
            if (usMatch) {
                const number = usMatch[0];
                return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
            }
            break;

        case 'INT':
            // Keep international format as is
            return cleaned;

        default:
            // Generic normalization
            return cleaned;
    }

    return cleaned;
}

/**
 * Validate and normalize email addresses
 * @param {string} email - Email to validate
 * @param {string} businessDomain - Business website domain for validation
 * @returns {Object} Validation result with normalized email and validation status
 */
function validateEmail(email, businessDomain = '') {
    if (!email || typeof email !== 'string') {
        return { valid: false, normalized: null, score: 0, issues: [] };
    }

    // Basic cleaning
    let cleaned = email.trim().toLowerCase();
    
    // Remove surrounding quotes
    cleaned = cleaned.replace(/^["']+|["']+$/g, '');

    // Check basic format
    if (!EMAIL_PATTERNS.standard.test(cleaned)) {
        return { valid: false, normalized: null, score: 0, issues: ['invalid_format'] };
    }

    // Check for disposable domains
    const domain = cleaned.split('@')[1];
    if (DISPOSABLE_DOMAINS.some(disposable => domain.includes(disposable))) {
        return { valid: false, normalized: null, score: 0, issues: ['disposable_domain'] };
    }

    // Check for junk domains
    if (JUNK_DOMAINS.some(junk => domain.includes(junk) || cleaned.includes(junk))) {
        return { valid: false, normalized: null, score: 0, issues: ['junk_domain'] };
    }

    // Score the email based on various factors
    let score = 5; // Base score
    const issues = [];

    // Check domain relevance to business
    if (businessDomain) {
        const businessScore = scoreEmailDomainRelevance(domain, businessDomain);
        score += businessScore;
    }

    // Check for business email patterns
    if (EMAIL_PATTERNS.business.test(cleaned)) {
        score += 2;
    }

    // Check for common TLDs
    if (EMAIL_PATTERNS.commonTLDs.test(cleaned)) {
        score -= 1; // Slightly lower score for common free services
    }

    // Check for length
    if (cleaned.length > 50) {
        issues.push('too_long');
        score -= 1;
    }

    // Check for suspicious patterns
    if (cleaned.includes('..') || cleaned.includes('@@') || cleaned.includes('..@')) {
        issues.push('suspicious_pattern');
        score -= 2;
    }

    // Check for numbers in local part (usually not professional)
    if (/\d+/.test(cleaned.split('@')[0])) {
        issues.push('numbers_in_local');
        score -= 1;
    }

    return {
        valid: score > 0,
        normalized: cleaned,
        score: Math.max(0, score),
        issues: issues
    };
}

/**
 * Score email domain relevance to business website
 * @param {string} emailDomain - Email domain
 * @param {string} businessDomain - Business website domain
 * @returns {number} Relevance score (0-5)
 */
function scoreEmailDomainRelevance(emailDomain, businessDomain) {
    if (!emailDomain || !businessDomain) return 0;

    const cleanEmailDomain = emailDomain.toLowerCase();
    const cleanBusinessDomain = businessDomain.toLowerCase().replace(/^www\./, '').split('/')[0];

    // Perfect match
    if (cleanEmailDomain === cleanBusinessDomain) return 5;

    // Subdomain match (e.g., email@subdomain.business.com)
    if (cleanEmailDomain.endsWith('.' + cleanBusinessDomain)) return 4;

    // Partial match (e.g., business.com vs email@business.com)
    if (cleanBusinessDomain.includes(cleanEmailDomain) || cleanEmailDomain.includes(cleanBusinessDomain)) return 3;

    // Common business email patterns
    const businessPatterns = ['info', 'contact', 'sales', 'support', 'hello', 'admin', 'office', 'help'];
    if (businessPatterns.some(pattern => cleanEmailDomain.startsWith(pattern + '.'))) return 2;

    return 0;
}

/**
 * Validate and normalize website URLs
 * @param {string} url - URL to validate
 * @returns {Object} Validation result with normalized URL and validation status
 */
function validateWebsite(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, normalized: null, score: 0, issues: [] };
    }

    // Clean the URL
    let cleaned = url.trim();
    
    // Add protocol if missing
    if (!cleaned.match(/^https?:\/\//)) {
        cleaned = 'https://' + cleaned;
    }

    // Check for Google/Maps URLs
    if (isGoogleOrMapsUrl(cleaned)) {
        return { valid: false, normalized: null, score: 0, issues: ['google_maps_url'] };
    }

    // Parse and validate URL
    try {
        const urlObj = new URL(cleaned);
        const hostname = urlObj.hostname.toLowerCase();

        // Check if it's a valid domain pattern
        if (!WEBSITE_PATTERNS.standard.test(cleaned)) {
            return { valid: false, normalized: null, score: 0, issues: ['invalid_domain'] };
        }

        // Check for social media domains
        if (WEBSITE_PATTERNS.social.test(cleaned)) {
            return { valid: false, normalized: null, score: 0, issues: ['social_media'] };
        }

        // Score the website
        let score = 5; // Base score
        const issues = [];

        // Check for HTTPS
        if (urlObj.protocol === 'https:') {
            score += 2;
        } else {
            issues.push('http_not_https');
        }

        // Check for www prefix
        if (hostname.startsWith('www.')) {
            score += 1;
        }

        // Check for business-relevant TLDs
        const businessTLDs = ['.com', '.org', '.net', '.biz', '.co', '.io', '.tech', '.ai'];
        if (businessTLDs.some(tld => hostname.endsWith(tld))) {
            score += 2;
        }

        // Check for length
        if (hostname.length > 50) {
            issues.push('domain_too_long');
            score -= 1;
        }

        // Check for suspicious characters
        if (hostname.includes('--') || hostname.includes('_')) {
            issues.push('suspicious_characters');
            score -= 1;
        }

        return {
            valid: score > 0,
            normalized: cleaned,
            score: Math.max(0, score),
            issues: issues
        };

    } catch (e) {
        return { valid: false, normalized: null, score: 0, issues: ['invalid_url'] };
    }
}

/**
 * Check if URL is a Google/Maps URL
 * @param {string} url - URL to check
 * @returns {boolean} True if Google/Maps URL
 */
function isGoogleOrMapsUrl(url) {
    if (!url) return true;
    
    const lowerUrl = url.toLowerCase();
    return (
        lowerUrl.includes('google.com/maps') ||
        lowerUrl.includes('maps.google.com') ||
        lowerUrl.includes('google.com/search') ||
        lowerUrl.includes('google.com/url') ||
        lowerUrl.includes('goo.gl') ||
        lowerUrl.includes('google.ad') ||
        (lowerUrl.includes('google.com') && !lowerUrl.includes('google.com/url?'))
    );
}

/**
 * Clean and standardize business names
 * @param {string} name - Business name to clean
 * @returns {Object} Cleaned name and cleaning details
 */
function cleanBusinessName(name) {
    if (!name || typeof name !== 'string') {
        return { cleaned: null, changes: [] };
    }

    let cleaned = name.trim();
    const changes = [];

    // Remove Google Maps suffixes
    const suffixes = [
        /\s*·\s*Visited\s*link\s*/gi,
        /\s*·\s*Visited\s*/gi,
        /\s*·\s*New\s*/gi,
        /\s*·\s*Verified\s*/gi,
        /\s*·\s*Featured\s*/gi,
        /\s*·\s*Sponsored\s*/gi,
        /\s*·\s*Promoted\s*/gi
    ];

    suffixes.forEach(suffix => {
        if (suffix.test(cleaned)) {
            cleaned = cleaned.replace(suffix, '').trim();
            changes.push('removed_suffix');
        }
    });

    // Remove extra whitespace
    const whitespaceBefore = cleaned.split(/\s+/).length;
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    const whitespaceAfter = cleaned.split(/\s+/).length;
    
    if (whitespaceBefore !== whitespaceAfter) {
        changes.push('normalized_whitespace');
    }

    // Remove special characters that might be artifacts
    const specialCharsBefore = cleaned.length;
    cleaned = cleaned.replace(/[^\w\s\-.,&]/g, '').trim();
    const specialCharsAfter = cleaned.length;
    
    if (specialCharsBefore !== specialCharsAfter) {
        changes.push('removed_special_chars');
    }

    // Capitalize properly
    cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());

    // Remove empty parentheses
    cleaned = cleaned.replace(/\(\s*\)/g, '').trim();

    // Remove trailing punctuation
    cleaned = cleaned.replace(/[.,;:]+$/, '').trim();

    return {
        cleaned: cleaned || null,
        changes: changes,
        originalLength: name.length,
        cleanedLength: cleaned.length
    };
}

/**
 * Validate complete lead data
 * @param {Object} lead - Lead object to validate
 * @returns {Object} Validation result with overall score and issues
 */
function validateLeadData(lead) {
    if (!lead || typeof lead !== 'object') {
        return { valid: false, score: 0, issues: ['invalid_lead_object'] };
    }

    const validation = {
        valid: true,
        score: 0,
        issues: [],
        details: {}
    };

    // Validate business name
    if (!lead.businessName || lead.businessName.length < 2) {
        validation.valid = false;
        validation.issues.push('missing_business_name');
    } else {
        const nameValidation = cleanBusinessName(lead.businessName);
        validation.details.businessName = nameValidation;
        if (nameValidation.changes.length > 0) {
            validation.issues.push('name_cleaned');
        }
    }

    // Validate phone number
    if (lead.phone) {
        const phoneValidation = validatePhoneNumber(lead.phone);
        validation.details.phone = phoneValidation;
        if (!phoneValidation.valid) {
            validation.issues.push('invalid_phone');
            validation.valid = false;
        } else {
            validation.score += 2;
        }
    }

    // Validate email
    if (lead.email) {
        const emailValidation = validateEmail(lead.email, lead.website);
        validation.details.email = emailValidation;
        if (!emailValidation.valid) {
            validation.issues.push('invalid_email');
            validation.valid = false;
        } else {
            validation.score += emailValidation.score;
        }
    }

    // Validate website
    if (lead.website) {
        const websiteValidation = validateWebsite(lead.website);
        validation.details.website = websiteValidation;
        if (!websiteValidation.valid) {
            validation.issues.push('invalid_website');
            validation.valid = false;
        } else {
            validation.score += websiteValidation.score;
        }
    }

    // Validate address
    if (lead.address) {
        if (lead.address.length < 5) {
            validation.issues.push('invalid_address');
            validation.valid = false;
        } else {
            validation.score += 1;
        }
    }

    // Validate rating
    if (lead.rating) {
        const rating = parseFloat(lead.rating);
        if (!isNaN(rating) && rating >= 0 && rating <= 5) {
            validation.score += 1;
        } else {
            validation.issues.push('invalid_rating');
            validation.valid = false;
        }
    }

    // Validate review count
    if (lead.reviewCount) {
        const reviews = parseInt(lead.reviewCount);
        if (!isNaN(reviews) && reviews >= 0) {
            validation.score += 1;
        } else {
            validation.issues.push('invalid_review_count');
            validation.valid = false;
        }
    }

    return validation;
}

/**
 * Sanitize lead data for export
 * @param {Object} lead - Lead object to sanitize
 * @returns {Object} Sanitized lead data
 */
function sanitizeLeadData(lead) {
    if (!lead) return null;

    const sanitized = { ...lead };

    // Remove sensitive or unnecessary fields
    const sensitiveFields = ['id', 'placeUrl', 'scrapedAt', 'pitch', 'pitchStatus'];
    sensitiveFields.forEach(field => {
        delete sanitized[field];
    });

    // Clean string fields
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'string') {
            sanitized[key] = sanitized[key].trim();
        }
    });

    // Ensure arrays are properly formatted
    if (Array.isArray(sanitized.emails)) {
        sanitized.emails = sanitized.emails.filter(email => email && typeof email === 'string');
    }

    // Remove null or empty values
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === null || sanitized[key] === undefined || sanitized[key] === '') {
            delete sanitized[key];
        }
    });

    return sanitized;
}

/**
 * Export validation utilities
 */
module.exports = {
    validatePhoneNumber,
    normalizePhoneNumber,
    validateEmail,
    validateWebsite,
    cleanBusinessName,
    validateLeadData,
    sanitizeLeadData,
    isGoogleOrMapsUrl,
    PHONE_PATTERNS,
    EMAIL_PATTERNS,
    WEBSITE_PATTERNS
};