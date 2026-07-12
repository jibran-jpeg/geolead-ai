/**
 * Website Analysis and Scoring System
 * Analyzes websites for technical quality, SEO performance, and user experience
 */

const { validateWebsite } = require('./dataValidation');

/**
 * Website analysis configuration
 */
const ANALYSIS_CONFIG = {
    timeout: 10000, // 10 seconds timeout for website analysis
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    maxRedirects: 3,
    criticalChecks: [
        'httpsEnabled',
        'sslValid',
        'reachable',
        'noCriticalErrors'
    ],
    seoChecks: [
        'metaTitle',
        'metaDescription',
        'headingStructure',
        'imageAltTexts'
    ],
    performanceChecks: [
        'loadTime',
        'responseTime',
        'resourceSize',
        'mobileFriendly'
    ]
};

/**
 * Analyze website for technical quality and SEO performance
 * @param {string} url - Website URL to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Website analysis result
 */
async function analyzeWebsite(url, options = {}) {
    if (!url) {
        return { valid: false, error: 'No URL provided' };
    }

    const analysis = {
        url: url,
        timestamp: new Date().toISOString(),
        valid: false,
        score: 0,
        details: {},
        errors: [],
        warnings: [],
        recommendations: []
    };

    try {
        // Validate URL first
        const validation = validateWebsite(url);
        if (!validation.valid) {
            analysis.errors.push('Invalid website URL');
            return analysis;
        }

        analysis.valid = true;
        analysis.url = validation.normalized;

        // Perform analysis checks
        const checks = [
            checkHttpsEnabled,
            checkSSLValidity,
            checkReachability,
            checkResponseTime,
            checkLoadTime,
            checkMobileFriendly,
            checkMetaTags,
            checkHeadingStructure,
            checkImageAltTexts,
            checkContentQuality
        ];

        for (const check of checks) {
            try {
                const result = await check(url, options);
                Object.assign(analysis.details, result.details);
                
                if (result.errors && result.errors.length > 0) {
                    analysis.errors.push(...result.errors);
                }
                
                if (result.warnings && result.warnings.length > 0) {
                    analysis.warnings.push(...result.warnings);
                }
                
                if (result.recommendations && result.recommendations.length > 0) {
                    analysis.recommendations.push(...result.recommendations);
                }
                
                analysis.score += result.score || 0;
            } catch (error) {
                analysis.errors.push(`Error in ${check.name}: ${error.message}`);
            }
        }

        // Normalize score to 0-100 scale
        analysis.score = Math.min(100, Math.max(0, analysis.score));

        // Add overall assessment
        analysis.assessment = generateOverallAssessment(analysis);

    } catch (error) {
        analysis.errors.push(`Analysis failed: ${error.message}`);
        analysis.valid = false;
    }

    return analysis;
}

/**
 * Check if website uses HTTPS
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} HTTPS check result
 */
async function checkHttpsEnabled(url, options = {}) {
    const details = {
        httpsEnabled: false,
        sslValid: false
    };

    try {
        if (url.startsWith('https://')) {
            details.httpsEnabled = true;
            details.score = 20;
        } else {
            details.score = 0;
            details.recommendations = ['Enable HTTPS for better security and SEO'];
        }
    } catch (error) {
        details.errors = [`HTTPS check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.httpsEnabled ? 20 : 0 };
}

/**
 * Check SSL certificate validity
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} SSL check result
 */
async function checkSSLValidity(url, options = {}) {
    const details = {
        sslValid: false,
        sslExpires: null,
        sslIssuer: null
    };

    try {
        if (url.startsWith('https://')) {
            // Note: In a real implementation, you would use a proper SSL checking library
            // For this example, we'll simulate SSL validation
            details.sslValid = true;
            details.score = 15;
        } else {
            details.score = 0;
        }
    } catch (error) {
        details.errors = [`SSL check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.sslValid ? 15 : 0 };
}

/**
 * Check website reachability
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Reachability check result
 */
async function checkReachability(url, options = {}) {
    const details = {
        reachable: false,
        status: null,
        errorMessage: null
    };

    try {
        // Note: In a real implementation, you would use a proper HTTP client
        // For this example, we'll simulate reachability check
        details.reachable = true;
        details.status = 200;
        details.score = 10;
    } catch (error) {
        details.reachable = false;
        details.errorMessage = error.message;
        details.errors = [`Reachability check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.reachable ? 10 : 0 };
}

/**
 * Check website response time
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Response time check result
 */
async function checkResponseTime(url, options = {}) {
    const details = {
        responseTime: null,
        responseTimeScore: 0
    };

    try {
        // Simulate response time check
        const startTime = Date.now();
        // Note: In a real implementation, you would make an actual HTTP request
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 100));
        const endTime = Date.now();
        
        details.responseTime = endTime - startTime;
        
        // Score based on response time (faster is better)
        if (details.responseTime < 200) {
            details.responseTimeScore = 15;
        } else if (details.responseTime < 500) {
            details.responseTimeScore = 10;
        } else if (details.responseTime < 1000) {
            details.responseTimeScore = 5;
        } else {
            details.responseTimeScore = 0;
        }
        
        details.score = details.responseTimeScore;
        
    } catch (error) {
        details.errors = [`Response time check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.responseTimeScore };
}

/**
 * Check website load time
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Load time check result
 */
async function checkLoadTime(url, options = {}) {
    const details = {
        loadTime: null,
        loadTimeScore: 0
    };

    try {
        // Simulate load time check
        const startTime = Date.now();
        // Note: In a real implementation, you would load the full page
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        const endTime = Date.now();
        
        details.loadTime = endTime - startTime;
        
        // Score based on load time (faster is better)
        if (details.loadTime < 1000) {
            details.loadTimeScore = 15;
        } else if (details.loadTime < 2000) {
            details.loadTimeScore = 10;
        } else if (details.loadTime < 3000) {
            details.loadTimeScore = 5;
        } else {
            details.loadTimeScore = 0;
        }
        
        details.score = details.loadTimeScore;
        
    } catch (error) {
        details.errors = [`Load time check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.loadTimeScore };
}

/**
 * Check mobile-friendliness
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Mobile-friendliness check result
 */
async function checkMobileFriendly(url, options = {}) {
    const details = {
        mobileFriendly: false,
        mobileScore: 0
    };

    try {
        // Simulate mobile-friendliness check
        // Note: In a real implementation, you would use Google's Mobile-Friendly Test API
        const isMobileFriendly = Math.random() > 0.3; // 70% chance of being mobile-friendly
        
        details.mobileFriendly = isMobileFriendly;
        
        if (isMobileFriendly) {
            details.mobileScore = 20;
            details.score = 20;
        } else {
            details.mobileScore = 0;
            details.score = 0;
            details.recommendations = ['Make your website mobile-friendly for better user experience'];
        }
        
    } catch (error) {
        details.errors = [`Mobile-friendliness check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.mobileScore };
}

/**
 * Check meta tags
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Meta tags check result
 */
async function checkMetaTags(url, options = {}) {
    const details = {
        metaTitle: false,
        metaDescription: false,
        metaKeywords: false,
        titleLength: 0,
        descriptionLength: 0
    };

    try {
        // Simulate meta tags check
        // Note: In a real implementation, you would fetch and parse the HTML
        const hasTitle = Math.random() > 0.4; // 60% chance of having title
        const hasDescription = Math.random() > 0.5; // 50% chance of having description
        
        details.metaTitle = hasTitle;
        details.metaDescription = hasDescription;
        
        if (hasTitle) {
            details.titleLength = Math.floor(Math.random() * 60) + 20; // 20-80 characters
        }
        
        if (hasDescription) {
            details.descriptionLength = Math.floor(Math.random() * 160) + 80; // 80-240 characters
        }
        
        // Score meta tags
        let score = 0;
        if (details.metaTitle) {
            score += 10;
            if (details.titleLength >= 30 && details.titleLength <= 60) {
                score += 5;
            }
        }
        
        if (details.metaDescription) {
            score += 10;
            if (details.descriptionLength >= 120 && details.descriptionLength <= 160) {
                score += 5;
            }
        }
        
        details.score = score;
        
        if (score < 20) {
            details.recommendations = [
                'Add meta title for better SEO',
                'Add meta description for better search visibility'
            ];
        }
        
    } catch (error) {
        details.errors = [`Meta tags check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.score };
}

/**
 * Check heading structure
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Heading structure check result
 */
async function checkHeadingStructure(url, options = {}) {
    const details = {
        hasH1: false,
        hasH2: false,
        hasH3: false,
        headingCount: 0,
        properStructure: false
    };

    try {
        // Simulate heading structure check
        const hasH1 = Math.random() > 0.3; // 70% chance of having H1
        const hasH2 = Math.random() > 0.4; // 60% chance of having H2
        const hasH3 = Math.random() > 0.5; // 50% chance of having H3
        
        details.hasH1 = hasH1;
        details.hasH2 = hasH2;
        details.hasH3 = hasH3;
        details.headingCount = (hasH1 ? 1 : 0) + (hasH2 ? 1 : 0) + (hasH3 ? 1 : 0);
        
        // Score heading structure
        let score = 0;
        if (details.hasH1) {
            score += 10;
        }
        if (details.hasH2) {
            score += 8;
        }
        if (details.hasH3) {
            score += 5;
        }
        
        details.properStructure = details.hasH1 && details.hasH2;
        details.score = score;
        
        if (!details.properStructure) {
            details.recommendations = [
                'Use proper heading structure (H1, H2, H3)',
                'Ensure each page has a single H1 tag'
            ];
        }
        
    } catch (error) {
        details.errors = [`Heading structure check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.score };
}

/**
 * Check image alt texts
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>> Image alt text check result
 */
async function checkImageAltTexts(url, options = {}) {
    const details = {
        totalImages: 0,
        imagesWithAlt: 0,
        imagesWithoutAlt: 0,
        altTextScore: 0
    };

    try {
        // Simulate image alt text check
        const totalImages = Math.floor(Math.random() * 20) + 5; // 5-25 images
        const imagesWithAlt = Math.floor(Math.random() * totalImages); // Random number with alt
        
        details.totalImages = totalImages;
        details.imagesWithAlt = imagesWithAlt;
        details.imagesWithoutAlt = totalImages - imagesWithAlt;
        
        // Score alt text coverage
        const coverageRatio = totalImages > 0 ? imagesWithAlt / totalImages : 0;
        details.altTextScore = Math.round(coverageRatio * 25);
        details.score = details.altTextScore;
        
        if (coverageRatio < 0.8) {
            details.recommendations = [
                'Add alt text to images for better accessibility and SEO',
                'Ensure all important images have descriptive alt text'
            ];
        }
        
    } catch (error) {
        details.errors = [`Image alt text check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.altTextScore };
}

/**
 * Check content quality
 * @param {string} url - Website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>>} Content quality check result
 */
async function checkContentQuality(url, options = {}) {
    const details = {
        wordCount: 0,
        hasContactInfo: false,
        hasServices: false,
        hasAbout: false,
        contentScore: 0
    };

    try {
        // Simulate content quality check
        const wordCount = Math.floor(Math.random() * 2000) + 200; // 200-2200 words
        const hasContactInfo = Math.random() > 0.4; // 60% chance
        const hasServices = Math.random() > 0.5; // 50% chance
        const hasAbout = Math.random() > 0.3; // 70% chance
        
        details.wordCount = wordCount;
        details.hasContactInfo = hasContactInfo;
        details.hasServices = hasServices;
        details.hasAbout = hasAbout;
        
        // Score content quality
        let score = 0;
        if (wordCount > 300) {
            score += 10;
        }
        if (wordCount > 1000) {
            score += 5;
        }
        if (hasContactInfo) {
            score += 10;
        }
        if (hasServices) {
            score += 10;
        }
        if (hasAbout) {
            score += 5;
        }
        
        details.contentScore = score;
        details.score = score;
        
        if (score < 25) {
            details.recommendations = [
                'Add more content to your website',
                'Include contact information',
                'Describe your services',
                'Add an about section'
            ];
        }
        
    } catch (error) {
        details.errors = [`Content quality check failed: ${error.message}`];
        details.score = 0;
    }

    return { details, score: details.contentScore };
}

/**
 * Generate overall assessment based on analysis results
 * @param {Object} analysis - Website analysis result
 * @returns {Object} Overall assessment
 */
function generateOverallAssessment(analysis) {
    const assessment = {
        overall: 'Poor',
        grade: 'F',
        strengths: [],
        weaknesses: []
    };

    if (analysis.score >= 90) {
        assessment.overall = 'Excellent';
        assessment.grade = 'A';
        assessment.strengths = ['Outstanding technical performance', 'Excellent SEO optimization', 'Great user experience'];
    } else if (analysis.score >= 80) {
        assessment.overall = 'Very Good';
        assessment.grade = 'B';
        assessment.strengths = ['Good technical performance', 'Solid SEO optimization', 'Good user experience'];
    } else if (analysis.score >= 70) {
        assessment.overall = 'Good';
        assessment.grade = 'C';
        assessment.strengths = ['Decent technical performance', 'Basic SEO optimization'];
        assessment.weaknesses = ['Some areas for improvement'];
    } else if (analysis.score >= 60) {
        assessment.overall = 'Fair';
        assessment.grade = 'D';
        assessment.strengths = ['Basic functionality'];
        assessment.weaknesses = ['Needs technical improvements', 'SEO optimization required'];
    } else {
        assessment.overall = 'Poor';
        assessment.grade = 'F';
        assessment.weaknesses = ['Significant technical issues', 'Poor SEO optimization', 'Bad user experience'];
    }

    // Add specific strengths and weaknesses based on analysis details
    if (analysis.details.httpsEnabled) {
        assessment.strengths.push('HTTPS enabled');
    }
    if (analysis.details.mobileFriendly) {
        assessment.strengths.push('Mobile-friendly design');
    }
    if (analysis.details.metaTitle) {
        assessment.strengths.push('Meta title present');
    }
    if (analysis.details.metaDescription) {
        assessment.strengths.push('Meta description present');
    }
    if (analysis.details.hasH1) {
        assessment.strengths.push('Proper H1 structure');
    }
    if (analysis.details.responseTime && analysis.details.responseTime < 500) {
        assessment.strengths.push('Fast response time');
    }

    if (!analysis.details.httpsEnabled) {
        assessment.weaknesses.push('HTTPS not enabled');
    }
    if (!analysis.details.mobileFriendly) {
        assessment.weaknesses.push('Not mobile-friendly');
    }
    if (!analysis.details.metaTitle) {
        assessment.weaknesses.push('Missing meta title');
    }
    if (!analysis.details.metaDescription) {
        assessment.weaknesses.push('Missing meta description');
    }
    if (!analysis.details.hasH1) {
        assessment.weaknesses.push('Missing H1 tag');
    }
    if (analysis.details.responseTime && analysis.details.responseTime > 2000) {
        assessment.weaknesses.push('Slow response time');
    }

    return assessment;
}

/**
 * Compare two websites
 * @param {string} url1 - First website URL
 * @param {string} url2 - Second website URL
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Website comparison result
 */
async function compareWebsites(url1, url2, options = {}) {
    const analysis1 = await analyzeWebsite(url1, options);
    const analysis2 = await analyzeWebsite(url2, options);

    const comparison = {
        website1: {
            url: url1,
            score: analysis1.score,
            grade: analysis1.assessment.grade,
            strengths: analysis1.assessment.strengths,
            weaknesses: analysis1.assessment.weaknesses
        },
        website2: {
            url: url2,
            score: analysis2.score,
            grade: analysis2.assessment.grade,
            strengths: analysis2.assessment.strengths,
            weaknesses: analysis2.assessment.weaknesses
        },
        winner: analysis1.score > analysis2.score ? url1 : url2,
        difference: Math.abs(analysis1.score - analysis2.score),
        recommendations: []
    };

    // Generate comparison recommendations
    if (analysis1.score > analysis2.score) {
        comparison.recommendations.push(`Website 1 (${url1}) performs better than Website 2 (${url2}) by ${comparison.difference} points`);
    } else {
        comparison.recommendations.push(`Website 2 (${url2}) performs better than Website 1 (${url1}) by ${comparison.difference} points`);
    }

    return comparison;
}

/**
 * Export website analysis utilities
 */
module.exports = {
    analyzeWebsite,
    compareWebsites,
    ANALYSIS_CONFIG,
    checkHttpsEnabled,
    checkSSLValidity,
    checkReachability,
    checkResponseTime,
    checkLoadTime,
    checkMobileFriendly,
    checkMetaTags,
    checkHeadingStructure,
    checkImageAltTexts,
    checkContentQuality
};