import { WEBSITE_STATUS, LEAD_SCORE } from './constants';

/**
 * Calculate a lead priority score based on business data
 * Higher score = higher priority lead (more likely to need web services)
 *
 * Score 10 (HOT):    No website at all
 * Score 8  (WARM):   Website uses HTTP (not HTTPS)
 * Score 6  (MEDIUM): Has website but low rating
 * Score 3  (LOW):    Has HTTPS website + good rating
 */
export function calculateLeadScore(lead) {
    if (!lead.website || lead.websiteStatus === WEBSITE_STATUS.NO_WEBSITE) {
        return LEAD_SCORE.HOT;
    }

    if (lead.websiteStatus === WEBSITE_STATUS.NEEDS_REVAMP) {
        return LEAD_SCORE.WARM;
    }

    // Has website — check rating
    if (lead.rating && lead.rating < 3.5) {
        return LEAD_SCORE.MEDIUM;
    }

    return LEAD_SCORE.LOW;
}

/**
 * Get the score tier label from a numeric score
 */
export function getScoreTier(score) {
    if (score >= 10) return { label: 'HOT', class: 'hot', emoji: '🔥' };
    if (score >= 8) return { label: 'WARM', class: 'warm', emoji: '🟠' };
    if (score >= 6) return { label: 'MED', class: 'medium', emoji: '🟡' };
    return { label: 'LOW', class: 'low', emoji: '🟢' };
}

/**
 * Detect website status from URL
 */
export function detectWebsiteStatus(url) {
    if (!url) return WEBSITE_STATUS.NO_WEBSITE;
    if (url.startsWith('http://') && !url.startsWith('https://')) {
        return WEBSITE_STATUS.NEEDS_REVAMP;
    }
    return WEBSITE_STATUS.HAS_WEBSITE;
}
