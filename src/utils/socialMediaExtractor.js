/**
 * Social Media Profile Extraction
 * Extracts and analyzes social media profiles from websites and direct URLs
 */

const { validateWebsite } = require('./dataValidation');

/**
 * Social media platform configurations
 */
const SOCIAL_MEDIA_PLATFORMS = {
    facebook: {
        name: 'Facebook',
        domain: 'facebook.com',
        urlPatterns: [
            /facebook\.com\/[a-zA-Z0-9.-]+/,
            /fb\.com\/[a-zA-Z0-9.-]+/,
            /facebook\.com\/pg\/[a-zA-Z0-9.-]+/,
            /facebook\.com\/groups\/[a-zA-Z0-9.-]+/
        ],
        extractPatterns: [
            /facebook\.com\/([^?\s]+)/,
            /fb\.com\/([^?\s]+)/
        ],
        profileTypes: ['page', 'profile', 'group', 'pg'],
        validationMethods: ['url_check', 'api_check', 'content_check'],
        weight: 0.3
    },
    instagram: {
        name: 'Instagram',
        domain: 'instagram.com',
        urlPatterns: [
            /instagram\.com\/[a-zA-Z0-9.-]+/,
            /instagr\.am\/[a-zA-Z0-9.-]+/,
            /ig\.me\/[a-zA-Z0-9.-]+/
        ],
        extractPatterns: [
            /instagram\.com\/([^?\s]+)/,
            /instagr\.am\/([^?\s]+)/
        ],
        profileTypes: ['account', 'user'],
        validationMethods: ['url_check', 'content_check'],
        weight: 0.3
    },
    linkedin: {
        name: 'LinkedIn',
        domain: 'linkedin.com',
        urlPatterns: [
            /linkedin\.com\/company\/[a-zA-Z0-9.-]+/,
            /linkedin\.com\/in\/[a-zA-Z0-9.-]+/,
            /linkedin\.com\/pub\/[a-zA-Z0-9.-]+/,
            /linkedin\.com\/sales\/[a-zA-Z0-9.-]+/
        ],
        extractPatterns: [
            /linkedin\.com\/(?:company|in|pub|sales)\/([^?\s]+)/
        ],
        profileTypes: ['company', 'personal', 'pub', 'sales'],
        validationMethods: ['url_check', 'api_check', 'content_check'],
        weight: 0.4
    },
    twitter: {
        name: 'Twitter/X',
        domain: 'twitter.com',
        urlPatterns: [
            /twitter\.com\/[a-zA-Z0-9._-]+/,
            /x\.com\/[a-zA-Z0-9._-]+/,
            /mobile\.twitter\.com\/[a-zA-Z0-9._-]+/
        ],
        extractPatterns: [
            /twitter\.com\/([^?\s]+)/,
            /x\.com\/([^?\s]+)/
        ],
        profileTypes: ['account', 'user'],
        validationMethods: ['url_check', 'content_check'],
        weight: 0.2
    },
    youtube: {
        name: 'YouTube',
        domain: 'youtube.com',
        urlPatterns: [
            /youtube\.com\/(channel|user|c)\/[a-zA-Z0-9.-]+/,
            /youtube\.com\/@[a-zA-Z0-9.-]+/,
            /youtu\.be\/[a-zA-Z0-9._-]+/
        ],
        extractPatterns: [
            /youtube\.com\/(?:channel|user|c|@)\/([^?\s]+)/,
            /youtu\.be\/([^?\s]+)/
        ],
        profileTypes: ['channel', 'user', 'c', '@'],
        validationMethods: ['url_check', 'content_check'],
        weight: 0.2
    },
    tiktok: {
        name: 'TikTok',
        domain: 'tiktok.com',
        urlPatterns: [
            /tiktok\.com\/@[a-zA-Z0-9._-]+/,
            /tiktok\.com\/user\/[a-zA-Z0-9._-]+/,
            /vm\.tiktok\.com\/[a-zA-Z0-9._-]+/
        ],
        extractPatterns: [
            /tiktok\.com\/(?:@|user\/)([^?\s]+)/
        ],
        profileTypes: ['account', 'user'],
        validationMethods: ['url_check', 'content_check'],
        weight: 0.1
    },
    pinterest: {
        name: 'Pinterest',
        domain: 'pinterest.com',
        urlPatterns: [
            /pinterest\.com\/[a-zA-Z0-9._-]+/,
            /pinterest\.com\/pin\/[a-zA-Z0-9._-]+/,
            /pinterest\.com\/search\/[a-zA-Z0-9._-]+/
        ],
        extractPatterns: [
            /pinterest\.com\/([^?\s]+)/
        ],
        profileTypes: ['account', 'pin', 'search'],
        validationMethods: ['url_check', 'content_check'],
        weight: 0.1
    }
};

/**
 * Social media analysis metrics
 */
const SOCIAL_METRICS = {
    engagement: {
        likes: { weight: 0.2, maxScore: 1000 },
        comments: { weight: 0.3, maxScore: 500 },
        shares: { weight: 0.2, maxScore: 200 },
        followers: { weight: 0.3, maxScore: 10000 }
    },
    content: {
        posts: { weight: 0.3, maxScore: 100 },
        quality: { weight: 0.4, maxScore: 100 },
        consistency: { weight: 0.3, maxScore: 100 }
    },
    profile: {
        completeness: { weight: 0.5, maxScore: 100 },
        verification: { weight: 0.3, maxScore: 100 },
        activity: { weight: 0.2, maxScore: 100 }
    }
};

/**
 * Extract social media profiles from website content
 * @param {string} website - Business website URL
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>> Social media extraction result
 */
async function extractSocialMediaProfiles(website, options = {}) {
    if (!website) {
        return { success: false, error: 'No website provided', profiles: {} };
    }

    const result = {
        success: true,
        website: website,
        timestamp: new Date().toISOString(),
        profiles: {},
        analysis: {},
        recommendations: []
    };

    try {
        // Validate website
        const validation = validateWebsite(website);
        if (!validation.valid) {
            result.success = false;
            result.error = 'Invalid website URL';
            return result;
        }

        // Extract social media links from website
        const socialLinks = await extractSocialLinksFromWebsite(website, options);
        
        // Analyze each social media profile
        for (const [platform, links] of Object.entries(socialLinks)) {
            if (links.length > 0) {
                result.profiles[platform] = {
                    urls: links,
                    analysis: await analyzeSocialProfile(platform, links[0], options),
                    validation: await validateSocialProfile(platform, links[0])
                };
            }
        }

        // Generate overall analysis
        result.analysis = generateSocialMediaAnalysis(result.profiles);
        
        // Generate recommendations
        result.recommendations = generateSocialMediaRecommendations(result.analysis);

    } catch (error) {
        result.success = false;
        result.error = `Social media extraction failed: ${error.message}`;
    }

    return result;
}

/**
 * Extract social media links from website content
 * @param {string} website - Business website URL
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>> Social links result
 */
async function extractSocialLinksFromWebsite(website, options = {}) {
    const socialLinks = {};

    try {
        // Simulate website content fetching
        // In a real implementation, you would fetch and parse the website HTML
        const websiteContent = await fetchWebsiteContent(website, options);
        
        // Extract social media links for each platform
        for (const [platform, config] of Object.entries(SOCIAL_MEDIA_PLATFORMS)) {
            const links = extractLinksFromContent(websiteContent, config);
            if (links.length > 0) {
                socialLinks[platform] = links;
            }
        }

    } catch (error) {
        console.error(`Error extracting social links from ${website}:`, error.message);
    }

    return socialLinks;
}

/**
 * Fetch website content (simulated)
 * @param {string} url - Website URL
 * @param {Object} options - Fetch options
 * @returns {Promise<string>> Website content
 */
async function fetchWebsiteContent(url, options = {}) {
    // Simulate fetching website content
    // In a real implementation, you would use a proper HTTP client
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Simulate website content with social media links
    const mockContent = `
        <html>
            <head>
                <title>Business Website</title>
                <meta property="og:url" content="${url}">
            </head>
            <body>
                <div class="social-links">
                    <a href="https://facebook.com/businesspage">Facebook</a>
                    <a href="https://instagram.com/businessaccount">Instagram</a>
                    <a href="https://linkedin.com/company/business">LinkedIn</a>
                    <a href="https://twitter.com/businesshandle">Twitter</a>
                </div>
                <div class="contact">
                    <p>Follow us on social media for updates</p>
                </div>
            </body>
        </html>
    `;
    
    return mockContent;
}

/**
 * Extract social media links from content
 * @param {string} content - Website content
 * @param {Object} platformConfig - Platform configuration
 * @returns {Array} Array of social media links
 */
function extractLinksFromContent(content, platformConfig) {
    const links = [];
    
    // Extract URLs using platform patterns
    for (const pattern of platformConfig.urlPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            links.push(...matches);
        }
    }
    
    // Clean and deduplicate links
    return [...new Set(links.map(link => {
        // Clean Google redirect URLs
        if (link.includes('google.com/url?q=')) {
            try {
                const url = new URL(link);
                return url.searchParams.get('q');
            } catch (e) {
                return link;
            }
        }
        return link;
    }))].filter(link => link && link.startsWith('http'));
}

/**
 * Analyze social media profile
 * @param {string} platform - Social media platform
 * @param {string} profileUrl - Profile URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>> Profile analysis result
 */
async function analyzeSocialProfile(platform, profileUrl, options = {}) {
    const analysis = {
        platform: platform,
        url: profileUrl,
        score: 0,
        metrics: {},
        validity: false,
        lastUpdated: new Date().toISOString()
    };

    try {
        const platformConfig = SOCIAL_MEDIA_PLATFORMS[platform];
        if (!platformConfig) {
            return analysis;
        }

        // Simulate profile analysis
        // In a real implementation, you would fetch profile data from the platform API
        const profileData = await fetchSocialProfileData(platform, profileUrl, options);
        
        // Calculate engagement score
        analysis.metrics.engagement = calculateEngagementScore(profileData);
        
        // Calculate content score
        analysis.metrics.content = calculateContentScore(profileData);
        
        // Calculate profile completeness score
        analysis.metrics.profile = calculateProfileScore(profileData);
        
        // Calculate overall score
        analysis.score = calculateOverallScore(analysis.metrics);
        
        // Check validity
        analysis.validity = validateProfileData(profileData);
        
    } catch (error) {
        analysis.error = `Analysis failed: ${error.message}`;
    }

    return analysis;
}

/**
 * Fetch social media profile data (simulated)
 * @param {string} platform - Social media platform
 * @param {string} profileUrl - Profile URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>> Profile data
 */
async function fetchSocialProfileData(platform, profileUrl, options = {}) {
    // Simulate fetching profile data
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 300));
    
    // Generate mock profile data based on platform
    const mockData = {
        facebook: {
            followers: Math.floor(Math.random() * 10000) + 100,
            likes: Math.floor(Math.random() * 5000) + 50,
            posts: Math.floor(Math.random() * 100) + 10,
            verified: Math.random() > 0.7,
            lastPost: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            profileCompleteness: Math.floor(Math.random() * 40) + 60
        },
        instagram: {
            followers: Math.floor(Math.random() * 50000) + 100,
            likes: Math.floor(Math.random() * 10000) + 100,
            posts: Math.floor(Math.random() * 200) + 20,
            verified: Math.random() > 0.8,
            lastPost: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            profileCompleteness: Math.floor(Math.random() * 30) + 70
        },
        linkedin: {
            followers: Math.floor(Math.random() * 5000) + 50,
            connections: Math.floor(Math.random() * 1000) + 10,
            posts: Math.floor(Math.random() * 50) + 5,
            verified: Math.random() > 0.6,
            lastPost: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
            profileCompleteness: Math.floor(Math.random() * 50) + 50
        },
        twitter: {
            followers: Math.floor(Math.random() * 100000) + 100,
            tweets: Math.floor(Math.random() * 5000) + 100,
            verified: Math.random() > 0.5,
            lastTweet: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
            profileCompleteness: Math.floor(Math.random() * 40) + 60
        }
    };
    
    return mockData[platform] || {};
}

/**
 * Calculate engagement score
 * @param {Object} profileData - Profile data
 * @returns {Object} Engagement metrics
 */
function calculateEngagementScore(profileData) {
    const metrics = {};
    let totalScore = 0;
    let maxPossible = 0;

    // Followers score
    if (profileData.followers) {
        metrics.followers = Math.min(100, (profileData.followers / 10000) * 100);
        totalScore += metrics.followers;
        maxPossible += 100;
    }

    // Likes score
    if (profileData.likes) {
        metrics.likes = Math.min(100, (profileData.likes / 1000) * 100);
        totalScore += metrics.likes;
        maxPossible += 100;
    }

    // Posts/Comments score
    if (profileData.posts) {
        metrics.posts = Math.min(100, (profileData.posts / 100) * 100);
        totalScore += metrics.posts;
        maxPossible += 100;
    }

    // Verification bonus
    if (profileData.verified) {
        metrics.verification = 100;
        totalScore += 100;
        maxPossible += 100;
    }

    return {
        score: maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0,
        metrics: metrics
    };
}

/**
 * Calculate content score
 * @param {Object} profileData - Profile data
 * @returns {Object} Content metrics
 */
function calculateContentScore(profileData) {
    const metrics = {};
    let totalScore = 0;
    let maxPossible = 0;

    // Posts count score
    if (profileData.posts) {
        metrics.posts = Math.min(100, (profileData.posts / 100) * 100);
        totalScore += metrics.posts;
        maxPossible += 50;
    }

    // Last activity score (more recent = better)
    if (profileData.lastPost || profileData.lastTweet) {
        const lastActivity = new Date(profileData.lastPost || profileData.lastTweet);
        const daysSinceLastActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastActivity < 7) {
            metrics.activity = 100;
        } else if (daysSinceLastActivity < 30) {
            metrics.activity = 70;
        } else if (daysSinceLastActivity < 90) {
            metrics.activity = 40;
        } else {
            metrics.activity = 10;
        }
        
        totalScore += metrics.activity;
        maxPossible += 50;
    }

    return {
        score: maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0,
        metrics: metrics
    };
}

/**
 * Calculate profile completeness score
 * @param {Object} profileData - Profile data
 * @returns {Object> Profile metrics
 */
function calculateProfileScore(profileData) {
    const metrics = {};
    let totalScore = 0;
    let maxPossible = 0;

    // Completeness score
    if (profileData.profileCompleteness) {
        metrics.completeness = profileData.profileCompleteness;
        totalScore += metrics.completeness;
        maxPossible += 100;
    }

    // Verification score
    if (profileData.verified) {
        metrics.verification = 100;
        totalScore += metrics.verification;
        maxPossible += 50;
    }

    return {
        score: maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0,
        metrics: metrics
    };
}

/**
 * Calculate overall social media score
 * @param {Object} metrics - All metrics
 * @returns {number} Overall score
 */
function calculateOverallScore(metrics) {
    const weights = {
        engagement: 0.4,
        content: 0.3,
        profile: 0.3
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (metrics.engagement) {
        totalScore += metrics.engagement.score * weights.engagement;
        totalWeight += weights.engagement;
    }

    if (metrics.content) {
        totalScore += metrics.content.score * weights.content;
        totalWeight += weights.content;
    }

    if (metrics.profile) {
        totalScore += metrics.profile.score * weights.profile;
        totalWeight += weights.profile;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Validate social media profile data
 * @param {Object} profileData - Profile data
 * @returns {boolean} Validity status
 */
function validateProfileData(profileData) {
    // Check if profile has basic information
    if (!profileData || Object.keys(profileData).length === 0) {
        return false;
    }

    // Check for minimum followers threshold
    if (profileData.followers && profileData.followers < 10) {
        return false;
    }

    // Check for recent activity (last 90 days)
    if (profileData.lastPost || profileData.lastTweet) {
        const lastActivity = new Date(profileData.lastPost || profileData.lastTweet);
        const daysSinceLastActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastActivity > 365) {
            return false;
        }
    }

    return true;
}

/**
 * Validate social media profile URL
 * @param {string} platform - Social media platform
 * @param {string} profileUrl - Profile URL
 * @returns {Promise<Object>> Validation result
 */
async function validateSocialProfile(platform, profileUrl) {
    const validation = {
        platform: platform,
        url: profileUrl,
        valid: false,
        reachable: false,
        properFormat: false,
        exists: false,
        error: null
    };

    try {
        const platformConfig = SOCIAL_MEDIA_PLATFORMS[platform];
        if (!platformConfig) {
            validation.error = 'Unknown platform';
            return validation;
        }

        // Check URL format
        let isValidFormat = false;
        for (const pattern of platformConfig.urlPatterns) {
            if (pattern.test(profileUrl)) {
                isValidFormat = true;
                break;
            }
        }

        validation.properFormat = isValidFormat;

        if (!isValidFormat) {
            validation.error = 'Invalid URL format';
            return validation;
        }

        // Simulate reachability check
        validation.reachable = true;

        // Simulate existence check
        validation.exists = true;

        validation.valid = validation.reachable && validation.properFormat && validation.exists;

    } catch (error) {
        validation.error = `Validation failed: ${error.message}`;
        validation.valid = false;
    }

    return validation;
}

/**
 * Generate overall social media analysis
 * @param {Object} profiles - Social media profiles
 * @returns {Object> Analysis result
 */
function generateSocialMediaAnalysis(profiles) {
    const analysis = {
        totalPlatforms: 0,
        activePlatforms: 0,
        averageScore: 0,
        bestPlatform: null,
        platforms: {},
        recommendations: []
    };

    let totalScore = 0;
    let scoreCount = 0;

    for (const [platform, data] of Object.entries(profiles)) {
        analysis.totalPlatforms++;
        
        if (data.analysis && data.analysis.validity) {
            analysis.activePlatforms++;
            analysis.platforms[platform] = data.analysis;
            
            if (data.analysis.score) {
                totalScore += data.analysis.score;
                scoreCount++;
                
                if (!analysis.bestPlatform || data.analysis.score > analysis.platforms[analysis.bestPlatform].score) {
                    analysis.bestPlatform = platform;
                }
            }
        }
    }

    analysis.averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;

    return analysis;
}

/**
 * Generate social media recommendations
 * @param {Object} analysis - Social media analysis
 * @returns {Array} Recommendations
 */
function generateSocialMediaRecommendations(analysis) {
    const recommendations = [];

    if (analysis.totalPlatforms === 0) {
        recommendations.push('Create social media profiles to increase online presence');
        recommendations.push('Start with Facebook and LinkedIn for business visibility');
    } else if (analysis.activePlatforms < 3) {
        recommendations.push('Expand social media presence to more platforms');
        recommendations.push('Focus on platforms relevant to your target audience');
    }

    if (analysis.averageScore < 50) {
        recommendations.push('Improve social media engagement and content quality');
        recommendations.push('Post regularly and interact with followers');
    }

    if (analysis.bestPlatform) {
        recommendations.push(`Focus on ${analysis.bestPlatform} as it shows the best performance`);
    }

    return recommendations;
}

/**
 * Compare social media profiles
 * @param {Object} profiles1 - First set of profiles
 * @param {Object> profiles2 - Second set of profiles
 * @returns {Object> Comparison result
 */
function compareSocialProfiles(profiles1, profiles2) {
    const comparison = {
        platform1: profiles1,
        platform2: profiles2,
        winner: null,
        differences: {},
        recommendations: []
    };

    let score1 = 0;
    let score2 = 0;

    for (const platform of Object.keys(SOCIAL_MEDIA_PLATFORMS)) {
        const data1 = profiles1[platform];
        const data2 = profiles2[platform];

        if (data1 && data1.analysis) {
            score1 += data1.analysis.score || 0;
        }

        if (data2 && data2.analysis) {
            score2 += data2.analysis.score || 0;
        }

        comparison.differences[platform] = {
            score1: data1?.analysis?.score || 0,
            score2: data2?.analysis?.score || 0,
            difference: (data1?.analysis?.score || 0) - (data2?.analysis?.score || 0)
        };
    }

    comparison.winner = score1 > score2 ? 'platform1' : 'platform2';

    return comparison;
}

/**
 * Export social media utilities
 */
module.exports = {
    extractSocialMediaProfiles,
    extractSocialLinksFromWebsite,
    analyzeSocialProfile,
    validateSocialProfile,
    generateSocialMediaAnalysis,
    generateSocialMediaRecommendations,
    compareSocialProfiles,
    SOCIAL_MEDIA_PLATFORMS,
    SOCIAL_METRICS
};