/**
 * Comprehensive Lead Scoring System
 * Calculates lead quality scores, website improvement scores, and business priority classifications
 */

const { validatePhoneNumber, validateEmail, validateWebsite, validateLeadData } = require('./dataValidation');

/**
 * Lead Quality Scoring Weights
 */
const SCORING_WEIGHTS = {
    // Contact Information (40% total)
    phone: { weight: 0.15, multiplier: 1 },
    email: { weight: 0.20, multiplier: 1 },
    website: { weight: 0.05, multiplier: 1 },
    
    // Business Information (30% total)
    rating: { weight: 0.10, multiplier: 1 },
    reviews: { weight: 0.10, multiplier: 1 },
    category: { weight: 0.05, multiplier: 1 },
    address: { weight: 0.05, multiplier: 1 },
    
    // Digital Presence (20% total)
    socialMedia: { weight: 0.15, multiplier: 1 },
    websiteQuality: { weight: 0.05, multiplier: 1 },
    
    // Business Status (10% total)
    businessStatus: { weight: 0.05, multiplier: 1 },
    openingHours: { weight: 0.05, multiplier: 1 }
};

/**
 * Category-based scoring multipliers
 */
const CATEGORY_MULTIPLIERS = {
    // High-value categories
    'real estate': 1.2,
    'lawyer': 1.3,
    'doctor': 1.4,
    'dentist': 1.3,
    'restaurant': 1.1,
    'hotel': 1.2,
    'automotive': 1.1,
    'insurance': 1.2,
    'finance': 1.3,
    'consulting': 1.2,
    'education': 1.1,
    'healthcare': 1.3,
    'technology': 1.2,
    
    // Medium-value categories
    'retail': 1.0,
    'shopping': 1.0,
    'beauty': 1.0,
    'fitness': 1.0,
    'home services': 1.0,
    'professional services': 1.0,
    
    // Lower-value categories
    'government': 0.8,
    'non-profit': 0.7,
    'religious organization': 0.6,
    'public utility': 0.7
};

/**
 * Social media platform weights
 */
const SOCIAL_MEDIA_WEIGHTS = {
    facebook: 0.3,
    instagram: 0.3,
    linkedin: 0.4,
    twitter: 0.2,
    youtube: 0.2,
    tiktok: 0.1,
    pinterest: 0.1
};

/**
 * Calculate Lead Quality Score (1-10)
 * @param {Object} lead - Lead object
 * @returns {Object} Scoring result with score, breakdown, and recommendations
 */
function calculateLeadQualityScore(lead) {
    if (!lead) {
        return { score: 0, breakdown: {}, recommendations: [], valid: false };
    }

    const breakdown = {};
    let totalScore = 0;
    let maxPossibleScore = 0;
    const recommendations = [];

    // Contact Information Scoring (40%)
    // Phone scoring
    const phoneScore = scorePhoneNumber(lead.phone);
    breakdown.phone = phoneScore;
    totalScore += phoneScore.score * SCORING_WEIGHTS.phone.weight;
    maxPossibleScore += SCORING_WEIGHTS.phone.weight;
    
    if (!phoneScore.hasPhone) {
        recommendations.push('Add phone number to improve lead quality');
    }

    // Email scoring
    const emailScore = scoreEmail(lead.email, lead.website);
    breakdown.email = emailScore;
    totalScore += emailScore.score * SCORING_WEIGHTS.email.weight;
    maxPossibleScore += SCORING_WEIGHTS.email.weight;
    
    if (!emailScore.hasEmail) {
        recommendations.push('Add email address to improve lead quality');
    }

    // Website scoring
    const websiteScore = scoreWebsitePresence(lead.website);
    breakdown.website = websiteScore;
    totalScore += websiteScore.score * SCORING_WEIGHTS.website.weight;
    maxPossibleScore += SCORING_WEIGHTS.website.weight;
    
    if (!websiteScore.hasWebsite) {
        recommendations.push('Create a business website to improve lead quality');
    }

    // Business Information Scoring (30%)
    // Rating scoring
    const ratingScore = scoreRating(lead.rating);
    breakdown.rating = ratingScore;
    totalScore += ratingScore.score * SCORING_WEIGHTS.rating.weight;
    maxPossibleScore += SCORING_WEIGHTS.rating.weight;
    
    if (ratingScore.score < 0.5) {
        recommendations.push('Improve customer rating to increase lead quality');
    }

    // Review count scoring
    const reviewScore = scoreReviewCount(lead.reviewCount);
    breakdown.reviews = reviewScore;
    totalScore += reviewScore.score * SCORING_WEIGHTS.reviews.weight;
    maxPossibleScore += SCORING_WEIGHTS.reviews.weight;
    
    if (reviewScore.score < 0.5) {
        recommendations.push('Increase customer reviews to improve lead quality');
    }

    // Category scoring
    const categoryScore = scoreCategory(lead.category);
    breakdown.category = categoryScore;
    totalScore += categoryScore.score * SCORING_WEIGHTS.category.weight;
    maxPossibleScore += SCORING_WEIGHTS.category.weight;

    // Address scoring
    const addressScore = scoreAddress(lead.address);
    breakdown.address = addressScore;
    totalScore += addressScore.score * SCORING_WEIGHTS.address.weight;
    maxPossibleScore += SCORING_WEIGHTS.address.weight;
    
    if (!addressScore.hasAddress) {
        recommendations.push('Add complete business address to improve lead quality');
    }

    // Digital Presence Scoring (20%)
    // Social media scoring
    const socialScore = scoreSocialMedia(lead);
    breakdown.socialMedia = socialScore;
    totalScore += socialScore.score * SCORING_WEIGHTS.socialMedia.weight;
    maxPossibleScore += SCORING_WEIGHTS.socialMedia.weight;
    
    if (socialScore.platformCount === 0) {
        recommendations.push('Create social media profiles to increase online presence');
    }

    // Website quality scoring
    const websiteQualityScore = scoreWebsiteQuality(lead.website, lead.websiteAnalysis);
    breakdown.websiteQuality = websiteQualityScore;
    totalScore += websiteQualityScore.score * SCORING_WEIGHTS.websiteQuality.weight;
    maxPossibleScore += SCORING_WEIGHTS.websiteQuality.weight;

    // Business Status Scoring (10%)
    // Business status scoring
    const statusScore = scoreBusinessStatus(lead.businessStatus);
    breakdown.businessStatus = statusScore;
    totalScore += statusScore.score * SCORING_WEIGHTS.businessStatus.weight;
    maxPossibleScore += SCORING_WEIGHTS.businessStatus.weight;
    
    if (statusScore.isOpen === false) {
        recommendations.push('Update business status to open to improve lead quality');
    }

    // Opening hours scoring
    const hoursScore = scoreOpeningHours(lead.openingHours);
    breakdown.openingHours = hoursScore;
    totalScore += hoursScore.score * SCORING_WEIGHTS.openingHours.weight;
    maxPossibleScore += SCORING_WEIGHTS.openingHours.weight;

    // Apply category multiplier
    const categoryMultiplier = getCategoryMultiplier(lead.category);
    totalScore *= categoryMultiplier;

    // Normalize to 1-10 scale
    const normalizedScore = Math.min(10, Math.max(1, (totalScore / maxPossibleScore) * 10));

    // Determine priority classification
    const priority = classifyLeadPriority(normalizedScore, lead);

    return {
        score: Math.round(normalizedScore * 10) / 10,
        breakdown: breakdown,
        recommendations: recommendations,
        priority: priority,
        categoryMultiplier: categoryMultiplier,
        maxPossibleScore: maxPossibleScore,
        rawScore: totalScore,
        valid: true
    };
}

/**
 * Score phone number quality
 * @param {string} phone - Phone number
 * @returns {Object} Phone scoring result
 */
function scorePhoneNumber(phone) {
    if (!phone) {
        return { score: 0, hasPhone: false, type: null, validation: null };
    }

    const validation = validatePhoneNumber(phone);
    if (!validation.valid) {
        return { score: 0.3, hasPhone: true, type: 'invalid', validation };
    }

    let score = 0.5; // Base score for having a phone

    // Type-based scoring
    switch (validation.type) {
        case 'mobile':
            score += 0.3;
            break;
        case 'landline':
            score += 0.2;
            break;
        case 'international':
            score += 0.2;
            break;
        case 'north_america':
            score += 0.3;
            break;
        default:
            score += 0.1;
    }

    // Format-based scoring
    if (phone.includes('+')) {
        score += 0.1; // International format
    }

    return {
        score: Math.min(1, score),
        hasPhone: true,
        type: validation.type,
        validation: validation
    };
}

/**
 * Score email quality
 * @param {string} email - Email address
 * @param {string} website - Business website
 * @returns {Object} Email scoring result
 */
function scoreEmail(email, website) {
    if (!email) {
        return { score: 0, hasEmail: false, domain: null, validation: null };
    }

    const validation = validateEmail(email, website);
    if (!validation.valid) {
        return { score: 0.3, hasEmail: true, domain: 'invalid', validation };
    }

    let score = 0.5; // Base score for having an email

    // Domain-based scoring
    const domain = email.split('@')[1];
    if (domain === website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]) {
        score += 0.4; // Perfect domain match
    } else if (domain.includes(website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0])) {
        score += 0.2; // Related domain
    }

    // Business email patterns
    const businessPatterns = ['info', 'contact', 'sales', 'support', 'admin', 'office'];
    if (businessPatterns.some(pattern => email.startsWith(pattern + '@'))) {
        score += 0.2;
    }

    // Professional domain scoring
    const professionalDomains = ['company', 'business', 'corp', 'enterprise', 'org'];
    if (professionalDomains.some(prof => domain.includes(prof))) {
        score += 0.1;
    }

    return {
        score: Math.min(1, score),
        hasEmail: true,
        domain: domain,
        validation: validation
    };
}

/**
 * Score website presence
 * @param {string} website - Website URL
 * @returns {Object} Website presence scoring result
 */
function scoreWebsitePresence(website) {
    if (!website) {
        return { score: 0, hasWebsite: false, validation: null };
    }

    const validation = validateWebsite(website);
    if (!validation.valid) {
        return { score: 0.3, hasWebsite: true, validation: validation };
    }

    let score = 0.5; // Base score for having a website

    // HTTPS scoring
    if (website.startsWith('https://')) {
        score += 0.3;
    }

    // Domain length scoring
    const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (domain.length > 10 && domain.length < 30) {
        score += 0.1;
    }

    // Business TLD scoring
    const businessTLDs = ['.com', '.org', '.net', '.biz', '.co', '.io'];
    if (businessTLDs.some(tld => domain.endsWith(tld))) {
        score += 0.1;
    }

    return {
        score: Math.min(1, score),
        hasWebsite: true,
        validation: validation
    };
}

/**
 * Score business rating
 * @param {string} rating - Rating value
 * @returns {Object} Rating scoring result
 */
function scoreRating(rating) {
    if (!rating) {
        return { score: 0, rating: null, level: 'none' };
    }

    const ratingValue = parseFloat(rating);
    if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
        return { score: 0, rating: ratingValue, level: 'invalid' };
    }

    let score = 0;
    let level = '';

    if (ratingValue >= 4.5) {
        score = 1;
        level = 'excellent';
    } else if (ratingValue >= 4.0) {
        score = 0.8;
        level = 'very_good';
    } else if (ratingValue >= 3.5) {
        score = 0.6;
        level = 'good';
    } else if (ratingValue >= 3.0) {
        score = 0.4;
        level = 'average';
    } else if (ratingValue >= 2.5) {
        score = 0.2;
        level = 'below_average';
    } else {
        score = 0.1;
        level = 'poor';
    }

    return {
        score: score,
        rating: ratingValue,
        level: level
    };
}

/**
 * Score review count
 * @param {string} reviewCount - Review count
 * @returns {Object} Review count scoring result
 */
function scoreReviewCount(reviewCount) {
    if (!reviewCount) {
        return { score: 0, reviewCount: 0, level: 'none' };
    }

    const count = parseInt(reviewCount);
    if (isNaN(count) || count < 0) {
        return { score: 0, reviewCount: count, level: 'invalid' };
    }

    let score = 0;
    let level = '';

    if (count >= 500) {
        score = 1;
        level = 'excellent';
    } else if (count >= 200) {
        score = 0.8;
        level = 'very_good';
    } else if (count >= 100) {
        score = 0.6;
        level = 'good';
    } else if (count >= 50) {
        score = 0.4;
        level = 'average';
    } else if (count >= 20) {
        score = 0.2;
        level = 'below_average';
    } else {
        score = 0.1;
        level = 'minimal';
    }

    return {
        score: score,
        reviewCount: count,
        level: level
    };
}

/**
 * Score business category
 * @param {string} category - Business category
 * @returns {Object} Category scoring result
 */
function scoreCategory(category) {
    if (!category) {
        return { score: 0, category: null, multiplier: 1 };
    }

    const categoryLower = category.toLowerCase();
    const multiplier = getCategoryMultiplier(category);
    
    let score = 0.5; // Base score for having a category

    // High-value categories get bonus points
    if (multiplier > 1.1) {
        score += 0.3;
    }

    return {
        score: Math.min(1, score),
        category: category,
        multiplier: multiplier
    };
}

/**
 * Score business address
 * @param {string} address - Business address
 * @returns {Object} Address scoring result
 */
function scoreAddress(address) {
    if (!address) {
        return { score: 0, hasAddress: false, completeness: 0 };
    }

    const addressLower = address.toLowerCase();
    let completeness = 0;

    // Check for address components
    if (addressLower.includes('road') || addressLower.includes('street') || addressLower.includes('avenue')) {
        completeness += 0.3;
    }

    if (addressLower.includes('city') || /\d{5}/.test(address)) {
        completeness += 0.3;
    }

    if (addressLower.includes('country') || addressLower.includes('pk') || addressLower.includes('usa')) {
        completeness += 0.4;
    }

    const score = Math.min(1, completeness);

    return {
        score: score,
        hasAddress: score > 0,
        completeness: completeness
    };
}

/**
 * Score social media presence
 * @param {Object} lead - Lead object
 * @returns {Object} Social media scoring result
 */
function scoreSocialMedia(lead) {
    const platforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest'];
    let totalScore = 0;
    let platformCount = 0;

    platforms.forEach(platform => {
        if (lead[platform] || lead.socials?.[platform]) {
            platformCount++;
            totalScore += SOCIAL_MEDIA_WEIGHTS[platform] || 0.1;
        }
    });

    const score = Math.min(1, totalScore);

    return {
        score: score,
        platformCount: platformCount,
        totalPlatforms: platforms.length,
        platforms: platforms.filter(p => lead[p] || lead.socials?.[p])
    };
}

/**
 * Score website quality
 * @param {string} website - Website URL
 * @param {Object} analysis - Website analysis data
 * @returns {Object} Website quality scoring result
 */
function scoreWebsiteQuality(website, analysis) {
    if (!website) {
        return { score: 0, hasWebsite: false, analysis: null };
    }

    let score = 0.5; // Base score for having a website

    // HTTPS scoring
    if (website.startsWith('https://')) {
        score += 0.2;
    }

    // Analysis-based scoring
    if (analysis) {
        if (analysis.httpsEnabled) {
            score += 0.1;
        }
        if (analysis.sslValid) {
            score += 0.1;
        }
        if (analysis.reachable) {
            score += 0.1;
        }
        if (analysis.loadTime && analysis.loadTime < 3000) {
            score += 0.1;
        }
        if (analysis.mobileFriendly) {
            score += 0.1;
        }
    }

    return {
        score: Math.min(1, score),
        hasWebsite: true,
        analysis: analysis
    };
}

/**
 * Score business status
 * @param {string} status - Business status
 * @returns {Object} Business status scoring result
 */
function scoreBusinessStatus(status) {
    if (!status) {
        return { score: 0.5, isOpen: true, status: 'unknown' };
    }

    const statusLower = status.toLowerCase();
    let isOpen = true;
    let score = 0.5;

    if (statusLower.includes('open')) {
        isOpen = true;
        score = 1;
    } else if (statusLower.includes('closed') || statusLower.includes('permanently closed')) {
        isOpen = false;
        score = 0;
    } else if (statusLower.includes('temporarily closed')) {
        isOpen = false;
        score = 0.2;
    }

    return {
        score: score,
        isOpen: isOpen,
        status: status
    };
}

/**
 * Score opening hours
 * @param {string} hours - Opening hours
 * @returns {Object} Opening hours scoring result
 */
function scoreOpeningHours(hours) {
    if (!hours) {
        return { score: 0.5, hasHours: false, completeness: 0 };
    }

    const hoursLower = hours.toLowerCase();
    let completeness = 0;

    // Check for hours information
    if (hoursLower.includes('am') || hoursLower.includes('pm')) {
        completeness += 0.5;
    }

    if (hoursLower.includes('monday') || hoursLower.includes('closed') || hoursLower.includes('open')) {
        completeness += 0.3;
    }

    if (hoursLower.includes('24 hours') || hoursLower.includes('24/7')) {
        completeness += 0.2;
    }

    const score = Math.min(1, completeness);

    return {
        score: score,
        hasHours: score > 0,
        completeness: completeness
    };
}

/**
 * Get category multiplier for lead scoring
 * @param {string} category - Business category
 * @returns {number} Multiplier value
 */
function getCategoryMultiplier(category) {
    if (!category) return 1;

    const categoryLower = category.toLowerCase();
    
    // Check for exact matches first
    if (CATEGORY_MULTIPLIERS[categoryLower]) {
        return CATEGORY_MULTIPLIERS[categoryLower];
    }

    // Check for partial matches
    for (const [key, multiplier] of Object.entries(CATEGORY_MULTIPLIERS)) {
        if (categoryLower.includes(key)) {
            return multiplier;
        }
    }

    return 1;
}

/**
 * Classify lead priority based on score and business characteristics
 * @param {number} score - Lead quality score
 * @param {Object} lead - Lead object
 * @returns {string} Priority classification
 */
function classifyLeadPriority(score, lead) {
    if (score >= 8) {
        return 'High';
    } else if (score >= 5) {
        return 'Medium';
    } else {
        return 'Low';
    }
}

/**
 * Calculate Website Improvement Score (1-10)
 * @param {Object} lead - Lead object
 * @returns {Object} Website improvement scoring result
 */
function calculateWebsiteImprovementScore(lead) {
    if (!lead) {
        return { score: 0, breakdown: {}, recommendations: [], valid: false };
    }

    const breakdown = {};
    let totalScore = 0;
    let maxPossibleScore = 0;
    const recommendations = [];

    // Domain Quality (30%)
    const domainScore = scoreDomainQuality(lead.website);
    breakdown.domain = domainScore;
    totalScore += domainScore.score * 0.3;
    maxPossibleScore += 0.3;
    
    if (!domainScore.isProfessional) {
        recommendations.push('Consider getting a more professional domain name');
    }

    // Technical Quality (30%)
    const technicalScore = scoreTechnicalQuality(lead.website, lead.websiteAnalysis);
    breakdown.technical = technicalScore;
    totalScore += technicalScore.score * 0.3;
    maxPossibleScore += 0.3;
    
    if (technicalScore.httpsEnabled === false) {
        recommendations.push('Enable HTTPS for better security and SEO');
    }
    
    if (technicalScore.mobileFriendly === false) {
        recommendations.push('Make your website mobile-friendly');
    }

    // Content Quality (20%)
    const contentScore = scoreContentQuality(lead);
    breakdown.content = contentScore;
    totalScore += contentScore.score * 0.2;
    maxPossibleScore += 0.2;
    
    if (contentScore.hasServices === false) {
        recommendations.push('Add detailed service descriptions');
    }

    // SEO Quality (20%)
    const seoScore = scoreSeoQuality(lead);
    breakdown.seo = seoScore;
    totalScore += seoScore.score * 0.2;
    maxPossibleScore += 0.2;
    
    if (seoScore.metaTags === false) {
        recommendations.push('Add meta title and description for better SEO');
    }

    // Normalize to 1-10 scale
    const normalizedScore = Math.min(10, Math.max(1, (totalScore / maxPossibleScore) * 10));

    return {
        score: Math.round(normalizedScore * 10) / 10,
        breakdown: breakdown,
        recommendations: recommendations,
        maxPossibleScore: maxPossibleScore,
        rawScore: totalScore,
        valid: true
    };
}

/**
 * Score domain quality
 * @param {string} website - Website URL
 * @returns {Object} Domain quality scoring result
 */
function scoreDomainQuality(website) {
    if (!website) {
        return { score: 0, isProfessional: false, domain: null };
    }

    const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    let score = 0.5;
    let isProfessional = false;

    // Check for professional TLDs
    const professionalTLDs = ['.com', '.org', '.net', '.biz', '.co', '.io', '.tech', '.ai'];
    if (professionalTLDs.some(tld => domain.endsWith(tld))) {
        score += 0.3;
        isProfessional = true;
    }

    // Check for domain length
    if (domain.length > 8 && domain.length < 25) {
        score += 0.2;
    }

    // Check for brandable name
    const hasNumbers = /\d+/.test(domain);
    if (!hasNumbers) {
        score += 0.1;
    }

    return {
        score: Math.min(1, score),
        isProfessional: isProfessional,
        domain: domain
    };
}

/**
 * Score technical quality
 * @param {string} website - Website URL
 * @param {Object} analysis - Website analysis data
 * @returns {Object} Technical quality scoring result
 */
function scoreTechnicalQuality(website, analysis) {
    if (!website) {
        return { score: 0, httpsEnabled: false, mobileFriendly: false, analysis: null };
    }

    let score = 0.3; // Base score for having a website
    const result = {
        httpsEnabled: false,
        mobileFriendly: false,
        analysis: analysis
    };

    // HTTPS scoring
    if (website.startsWith('https://')) {
        score += 0.3;
        result.httpsEnabled = true;
    }

    // Analysis-based scoring
    if (analysis) {
        if (analysis.httpsEnabled) {
            score += 0.1;
            result.httpsEnabled = true;
        }
        if (analysis.sslValid) {
            score += 0.1;
        }
        if (analysis.mobileFriendly) {
            score += 0.2;
            result.mobileFriendly = true;
        }
        if (analysis.loadTime && analysis.loadTime < 3000) {
            score += 0.1;
        }
    }

    return {
        score: Math.min(1, score),
        httpsEnabled: result.httpsEnabled,
        mobileFriendly: result.mobileFriendly,
        analysis: analysis
    };
}

/**
 * Score content quality
 * @param {Object} lead - Lead object
 * @returns {Object} Content quality scoring result
 */
function scoreContentQuality(lead) {
    let score = 0.3; // Base score for having basic information
    let hasServices = false;

    // Services information
    if (lead.services && lead.services.length > 0) {
        score += 0.3;
        hasServices = true;
    }

    // Business description (if available)
    if (lead.description && lead.description.length > 50) {
        score += 0.2;
    }

    // High-quality photos (if available)
    if (lead.photos && lead.photos.length > 0) {
        score += 0.2;
    }

    return {
        score: Math.min(1, score),
        hasServices: hasServices,
        services: lead.services || null
    };
}

/**
 * Score SEO quality
 * @param {Object} lead - Lead object
 * @returns {Object} SEO quality scoring result
 */
function scoreSeoQuality(lead) {
    let score = 0.3; // Base score for having a website
    let metaTags = false;

    // Business name in domain (if available)
    if (lead.website && lead.businessName) {
        const domain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        if (domain.toLowerCase().includes(lead.businessName.toLowerCase())) {
            score += 0.2;
        }
    }

    // Category information
    if (lead.category && lead.category.length > 0) {
        score += 0.2;
    }

    // Location information
    if (lead.address && lead.address.length > 0) {
        score += 0.2;
        metaTags = true;
    }

    // Contact information in website
    if (lead.phone && lead.website) {
        score += 0.1;
    }

    return {
        score: Math.min(1, score),
        metaTags: metaTags,
        category: lead.category || null,
        address: lead.address || null
    };
}

/**
 * Export scoring utilities
 */
module.exports = {
    calculateLeadQualityScore,
    calculateWebsiteImprovementScore,
    classifyLeadPriority,
    SCORING_WEIGHTS,
    CATEGORY_MULTIPLIERS,
    SOCIAL_MEDIA_WEIGHTS
};