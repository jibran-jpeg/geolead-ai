/**
 * Regional Handling for Pakistan
 * Provides Pakistan-specific data validation, phone number handling, and regional business analysis
 */

const { validatePhoneNumber, validateEmail, validateWebsite } = require('./dataValidation');

/**
 * Pakistan-specific configurations
 */
const PAKISTAN_CONFIG = {
    phone: {
        countryCode: '+92',
        internationalPrefix: '0092',
        localPrefix: '0',
        mobileCodes: [
            '300', '301', '302', '303', '304', '305', '306', '307', '308', '309',
            '310', '311', '312', '313', '314', '315', '316', '317', '318', '319',
            '320', '321', '322', '323', '324', '325', '326', '327', '328', '329',
            '330', '331', '332', '333', '334', '335', '336', '337', '338', '339',
            '340', '341', '342', '343', '344', '345', '346', '347', '348', '349',
            '350', '351', '352', '353', '354', '355', '356', '357', '358', '359',
            '360', '361', '362', '363', '364', '365', '366', '367', '368', '369',
            '370', '371', '372', '373', '374', '375', '376', '377', '378', '379',
            '380', '381', '382', '383', '384', '385', '386', '387', '388', '389',
            '390', '391', '392', '393', '394', '395', '396', '397', '398', '399'
        ],
        landlineCodes: [
            '21', '22', '23', '24', '25', '26', '27', '28', '29', // Islamabad
            '51', '52', '53', '54', '55', '56', '57', '58', '59', // Karachi
            '31', '32', '33', '34', '35', '36', '37', '38', '39', // Lahore
            '61', '62', '63', '64', '65', '66', '67', '68', '69', // Faisalabad
            '41', '42', '43', '44', '45', '46', '47', '48', '49', // Rawalpindi
            '71', '72', '73', '74', '75', '76', '77', '78', '79', // Multan
            '81', '82', '83', '84', '85', '86', '87', '88', '89', // Hyderabad
            '91', '92', '93', '94', '95', '96', '97', '98', '99' // Other cities
        ],
        emergencyNumbers: [
            '1122', // Ambulance
            '15', // Police
            '16', // Fire Brigade
            '1100' // Citizen Portal
        ]
    },
    regions: {
        provinces: [
            { code: 'PK-IB', name: 'Islamabad Capital Territory', capital: 'Islamabad' },
            { code: 'PK-SB', name: 'Sindh', capital: 'Karachi' },
            { code: 'PK-PB', name: 'Punjab', capital: 'Lahore' },
            { code: 'PK-KP', name: 'Khyber Pakhtunkhwa', capital: 'Peshawar' },
            { code: 'PK-BL', name: 'Balochistan', capital: 'Quetta' },
            { code: 'PK-AJ', name: 'Azad Jammu & Kashmir', capital: 'Muzaffarabad' },
            { code: 'PK-GK', name: 'Gilgit-Baltistan', capital: 'Gilgit' }
        ],
        majorCities: [
            'Islamabad', 'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 
            'Multan', 'Hyderabad', 'Gujranwala', 'Peshawar', 'Quetta',
            'Sialkot', 'Bahawalpur', 'Sargodha', 'Shekhupura', 'Sahiwal',
            'Gujrat', 'Jhang', 'Sukkur', 'Rahim Yar Khan', 'Larkana',
            'Dera Ghazi Khan', 'Mardan', 'Mirpur', 'Kotli', 'Bhimber'
        ]
    },
    businessCategories: {
        highValue: [
            'real estate', 'lawyer', 'doctor', 'dentist', 'restaurant', 
            'hotel', 'automotive', 'insurance', 'finance', 'consulting',
            'education', 'healthcare', 'technology', 'engineering'
        ],
        emerging: [
            'fintech', 'e-commerce', 'digital marketing', 'software development',
            'renewable energy', 'biotechnology', 'artificial intelligence',
            'blockchain', 'cybersecurity', 'cloud services'
        ],
        traditional: [
            'retail', 'manufacturing', 'agriculture', 'textiles', 'construction',
            'transportation', 'telecommunications', 'media', 'entertainment'
        ]
    },
    culturalConsiderations: {
        businessHours: {
            typical: {
                start: '9:00 AM',
                end: '6:00 PM',
                weekend: ['Friday', 'Saturday']
            },
            ramadan: {
                start: '10:00 AM',
                end: '8:00 PM',
                weekend: ['Friday']
            }
        },
        holidays: [
            '1-January', '23-March', '1-May', '14-August', '6-September',
            '25-December', // Christmas (celebrated by Christians)
            'Eid al-Fitr', // Variable date
            'Eid al-Adha' // Variable date
        ]
    }
};

/**
 * Pakistan-specific phone number validation
 * @param {string} phone - Phone number to validate
 * @returns {Object> Pakistan phone validation result
 */
function validatePakistanPhone(phone) {
    if (!phone) {
        return { valid: false, normalized: null, type: null, region: null, error: 'No phone number provided' };
    }

    // Clean the phone number
    const cleaned = phone.replace(/[^\d+]/g, '').trim();
    
    // Check minimum length
    if (cleaned.length < 10 || cleaned.length > 15) {
        return { valid: false, normalized: null, type: null, region: null, error: 'Invalid phone number length' };
    }

    // Check if it's a Pakistan mobile number
    if (isPakistanMobile(cleaned)) {
        const normalized = normalizePakistanPhone(cleaned, 'mobile');
        return { 
            valid: true, 
            normalized: normalized, 
            type: 'mobile', 
            region: 'PK',
            international: '+92' + cleaned.slice(-10),
            local: '0' + cleaned.slice(-10),
            error: null
        };
    }

    // Check if it's a Pakistan landline number
    if (isPakistanLandline(cleaned)) {
        const normalized = normalizePakistanPhone(cleaned, 'landline');
        const region = getPakistanRegionFromCode(cleaned.slice(2, 4));
        return { 
            valid: true, 
            normalized: normalized, 
            type: 'landline', 
            region: region || 'PK',
            international: '+92' + cleaned.slice(1),
            local: '0' + cleaned.slice(1),
            error: null
        };
    }

    // Check if it's an international Pakistan number
    if (isPakistanInternational(cleaned)) {
        const normalized = normalizePakistanPhone(cleaned, 'international');
        return { 
            valid: true, 
            normalized: normalized, 
            type: 'international', 
            region: 'PK',
            international: cleaned,
            local: '0' + cleaned.slice(3),
            error: null
        };
    }

    return { valid: false, normalized: null, type: null, region: null, error: 'Not a valid Pakistan phone number' };
}

/**
 * Check if phone number is a Pakistan mobile number
 * @param {string} phone - Phone number to check
 * @returns {boolean} True if Pakistan mobile number
 */
function isPakistanMobile(phone) {
    // Remove country code and prefix
    let cleanPhone = phone;
    if (phone.startsWith('+92')) {
        cleanPhone = phone.slice(3);
    } else if (phone.startsWith('0092')) {
        cleanPhone = phone.slice(4);
    } else if (phone.startsWith('0')) {
        cleanPhone = phone.slice(1);
    }

    // Check if it matches Pakistan mobile pattern
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
        const code = cleanPhone.substring(0, 3);
        return PAKISTAN_CONFIG.phone.mobileCodes.includes(code);
    }

    return false;
}

/**
 * Check if phone number is a Pakistan landline number
 * @param {string} phone - Phone number to check
 * @returns {boolean} True if Pakistan landline number
 */
function isPakistanLandline(phone) {
    // Remove country code and prefix
    let cleanPhone = phone;
    if (phone.startsWith('+92')) {
        cleanPhone = phone.slice(3);
    } else if (phone.startsWith('0092')) {
        cleanPhone = phone.slice(4);
    } else if (phone.startsWith('0')) {
        cleanPhone = phone.slice(1);
    }

    // Check if it matches Pakistan landline pattern
    if (cleanPhone.length >= 7 && cleanPhone.length <= 9) {
        const code = cleanPhone.substring(0, 2);
        return PAKISTAN_CONFIG.phone.landlineCodes.includes(code);
    }

    return false;
}

/**
 * Check if phone number is an international Pakistan number
 * @param {string} phone - Phone number to check
 * @returns {boolean} True if international Pakistan number
 */
function isPakistanInternational(phone) {
    return phone.startsWith('+92') || phone.startsWith('0092');
}

/**
 * Normalize Pakistan phone number
 * @param {string} phone - Phone number to normalize
 * @param {string} type - Phone type ('mobile', 'landline', 'international')
 * @returns {string} Normalized phone number
 */
function normalizePakistanPhone(phone, type) {
    if (!phone) return '';

    switch (type) {
        case 'mobile':
            if (phone.startsWith('+92')) {
                return '+92' + phone.slice(-10);
            } else if (phone.startsWith('0092')) {
                return '+92' + phone.slice(-10);
            } else if (phone.startsWith('0')) {
                return '+92' + phone.slice(-10);
            } else if (phone.length === 10) {
                return '+92' + phone;
            }
            break;

        case 'landline':
            if (phone.startsWith('+92')) {
                return '+92' + phone.slice(-9);
            } else if (phone.startsWith('0092')) {
                return '+92' + phone.slice(-9);
            } else if (phone.startsWith('0')) {
                return '+92' + phone.slice(-9);
            } else if (phone.length >= 7 && phone.length <= 9) {
                return '+92' + phone;
            }
            break;

        case 'international':
            if (phone.startsWith('+92')) {
                return phone;
            } else if (phone.startsWith('0092')) {
                return '+' + phone.slice(2);
            } else if (phone.startsWith('0')) {
                return '+92' + phone.slice(1);
            }
            break;
    }

    return phone;
}

/**
 * Get Pakistan region from phone code
 * @param {string} code - Phone code
 * @returns {string|null} Region name or null if not found
 */
function getPakistanRegionFromCode(code) {
    const province = PAKISTAN_CONFIG.regions.provinces.find(p => 
        PAKISTAN_CONFIG.phone.landlineCodes.some(lc => lc.startsWith(code))
    );
    
    return province ? province.name : null;
}

/**
 * Pakistan-specific email validation
 * @param {string} email - Email to validate
 * @param {string} businessDomain - Business website domain
 * @returns {Object> Pakistan email validation result
 */
function validatePakistanEmail(email, businessDomain = '') {
    if (!email) {
        return { valid: false, normalized: null, score: 0, issues: [], isPakistan: false };
    }

    // First perform standard email validation
    const standardValidation = validateEmail(email, businessDomain);
    if (!standardValidation.valid) {
        return { ...standardValidation, isPakistan: false };
    }

    // Check for Pakistan-specific domain
    const domain = email.split('@')[1].toLowerCase();
    const pakistanDomains = [
        'pk', 'com.pk', 'org.pk', 'net.pk', 'edu.pk', 'gov.pk', 'gob.pk',
        'biz.pk', 'web.pk', 'info.pk', 'asia', 'pakistan', 'pakistani'
    ];

    const isPakistanDomain = pakistanDomains.some(tld => domain.endsWith('.' + tld) || domain === tld);
    
    // Boost score for Pakistan domains
    let score = standardValidation.score;
    if (isPakistanDomain) {
        score += 2;
    }

    // Check for common Pakistan business email patterns
    const pakistanPatterns = [
        'info@', 'contact@', 'sales@', 'support@', 'help@', 'care@',
        'service@', 'care@', 'office@', 'admin@', 'webmaster@'
    ];
    
    if (pakistanPatterns.some(pattern => email.toLowerCase().startsWith(pattern))) {
        score += 1;
    }

    return {
        ...standardValidation,
        isPakistan: isPakistanDomain,
        pakistanDomain: isPakistanDomain ? domain : null,
        score: Math.min(10, score)
    };
}

/**
 * Pakistan-specific website validation
 * @param {string} url - URL to validate
 * @returns {Object> Pakistan website validation result
 */
function validatePakistanWebsite(url) {
    if (!url) {
        return { valid: false, normalized: null, score: 0, issues: [], isPakistan: false };
    }

    // First perform standard website validation
    const standardValidation = validateWebsite(url);
    if (!standardValidation.valid) {
        return { ...standardValidation, isPakistan: false };
    }

    // Check for Pakistan-specific domain
    const hostname = new URL(standardValidation.normalized).hostname.toLowerCase();
    const pakistanDomains = [
        'pk', 'com.pk', 'org.pk', 'net.pk', 'edu.pk', 'gov.pk', 'gob.pk',
        'biz.pk', 'web.pk', 'info.pk', 'asia', 'pakistan', 'pakistani'
    ];

    const isPakistanDomain = pakistanDomains.some(tld => hostname.endsWith('.' + tld) || hostname === tld);
    
    // Boost score for Pakistan domains
    let score = standardValidation.score;
    if (isPakistanDomain) {
        score += 2;
    }

    // Check for Pakistan-specific content
    const pakistanKeywords = [
        'pakistan', 'pakistani', 'karachi', 'lahore', 'islamabad', 'peshawar',
        'quetta', 'multan', 'hyderabad', 'rawalpindi', 'faisalabad'
    ];
    
    // In a real implementation, you would fetch and analyze the website content
    // For now, we'll simulate this check
    const hasPakistanContent = Math.random() > 0.7; // 30% chance of having Pakistan content
    
    if (hasPakistanContent) {
        score += 1;
    }

    return {
        ...standardValidation,
        isPakistan: isPakistanDomain,
        pakistanDomain: isPakistanDomain ? hostname : null,
        score: Math.min(10, score)
    };
}

/**
 * Analyze Pakistan-specific business data
 * @param {Object} lead - Lead object
 * @returns {Object> Pakistan analysis result
 */
function analyzePakistanBusiness(lead) {
    if (!lead) {
        return { valid: false, error: 'No lead provided', analysis: {} };
    }

    const analysis = {
        valid: true,
        isPakistanBusiness: false,
        region: null,
        province: null,
        city: null,
        phoneValidation: null,
        emailValidation: null,
        websiteValidation: null,
        businessCategory: null,
        culturalFactors: {},
        recommendations: []
    };

    try {
        // Check if it's a Pakistan business
        let isPakistanBusiness = false;

        // Check phone number
        if (lead.phone) {
            const phoneValidation = validatePakistanPhone(lead.phone);
            analysis.phoneValidation = phoneValidation;
            if (phoneValidation.valid) {
                isPakistanBusiness = true;
                analysis.region = phoneValidation.region;
            }
        }

        // Check email
        if (lead.email) {
            const emailValidation = validatePakistanEmail(lead.email, lead.website);
            analysis.emailValidation = emailValidation;
            if (emailValidation.isPakistan) {
                isPakistanBusiness = true;
            }
        }

        // Check website
        if (lead.website) {
            const websiteValidation = validatePakistanWebsite(lead.website);
            analysis.websiteValidation = websiteValidation;
            if (websiteValidation.isPakistan) {
                isPakistanBusiness = true;
            }
        }

        // Check address for Pakistan-specific information
        if (lead.address) {
            const addressLower = lead.address.toLowerCase();
            const pakistanCities = PAKISTAN_CONFIG.regions.majorCities.map(city => city.toLowerCase());
            
            for (const city of pakistanCities) {
                if (addressLower.includes(city)) {
                    analysis.city = city;
                    isPakistanBusiness = true;
                    break;
                }
            }
        }

        analysis.isPakistanBusiness = isPakistanBusiness;

        // Determine province if we have location information
        if (analysis.city) {
            analysis.province = getPakistanProvinceFromCity(analysis.city);
        }

        // Classify business category
        analysis.businessCategory = classifyPakistanBusinessCategory(lead.category);

        // Analyze cultural factors
        analysis.culturalFactors = analyzeCulturalFactors(lead);

        // Generate Pakistan-specific recommendations
        analysis.recommendations = generatePakistanRecommendations(analysis);

    } catch (error) {
        analysis.valid = false;
        analysis.error = `Pakistan analysis failed: ${error.message}`;
    }

    return analysis;
}

/**
 * Get Pakistan province from city
 * @param {string} city - City name
 * @returns {string|null} Province name or null if not found
 */
function getPakistanProvinceFromCity(city) {
    const cityLower = city.toLowerCase();
    
    // Islamabad Capital Territory
    if (cityLower === 'islamabad') {
        return 'Islamabad Capital Territory';
    }

    // Sindh
    const sindhCities = ['karachi', 'hyderabad', 'sukkur', 'larkana', 'nawabshah'];
    if (sindhCities.some(c => cityLower.includes(c))) {
        return 'Sindh';
    }

    // Punjab
    const punjabCities = ['lahore', 'faisalabad', 'rawalpindi', 'multan', 'gujranwala', 'sialkot', 'bahawalpur', 'sahiwal', 'sargodha', 'shekhupura', 'gujrat', 'jhang', 'wah cantonment'];
    if (punjabCities.some(c => cityLower.includes(c))) {
        return 'Punjab';
    }

    // Khyber Pakhtunkhwa
    const kpCities = ['peshawar', 'mardan', 'abbottabad', 'mansehra', 'swabi', 'dir', 'chitral', 'bannu', 'dera ismail khan'];
    if (kpCities.some(c => cityLower.includes(c))) {
        return 'Khyber Pakhtunkhwa';
    }

    // Balochistan
    const balochistanCities = ['quetta', 'gwadar', 'khuzdar', 'turbat', 'sibi', 'zhob'];
    if (balochistanCities.some(c => cityLower.includes(c))) {
        return 'Balochistan';
    }

    // Azad Jammu & Kashmir
    const ajkCities = ['muzaffarabad', 'mirpur', 'bagh', 'poonch', 'bhimber'];
    if (ajkCities.some(c => cityLower.includes(c))) {
        return 'Azad Jammu & Kashmir';
    }

    // Gilgit-Baltistan
    const gbCities = ['gilgit', 'skardu', 'ghizer', ' Diamer', 'astor', ' hunza', 'nagar'];
    if (gbCities.some(c => cityLower.includes(c))) {
        return 'Gilgit-Baltistan';
    }

    return null;
}

/**
 * Classify Pakistan business category
 * @param {string} category - Business category
 * @returns {Object> Category classification
 */
function classifyPakistanBusinessCategory(category) {
    if (!category) {
        return { type: 'unknown', priority: 'medium', growth: 'stable' };
    }

    const categoryLower = category.toLowerCase();

    // High-value categories
    if (PAKISTAN_CONFIG.businessCategories.highValue.some(high => categoryLower.includes(high))) {
        return { type: 'high_value', priority: 'high', growth: 'growing' };
    }

    // Emerging categories
    if (PAKISTAN_CONFIG.businessCategories.emerging.some(emerging => categoryLower.includes(emerging))) {
        return { type: 'emerging', priority: 'high', growth: 'rapid' };
    }

    // Traditional categories
    if (PAKISTAN_CONFIG.businessCategories.traditional.some(traditional => categoryLower.includes(traditional))) {
        return { type: 'traditional', priority: 'medium', growth: 'stable' };
    }

    return { type: 'other', priority: 'medium', growth: 'stable' };
}

/**
 * Analyze cultural factors for Pakistan business
 * @param {Object} lead - Lead object
 * @returns {Object> Cultural factors analysis
 */
function analyzeCulturalFactors(lead) {
    const factors = {
        businessHours: 'standard',
        weekend: 'standard',
        holidays: 'standard',
        language: 'urdu',
        religion: 'islam',
        businessPractices: 'traditional'
    };

    // Check for Islamic business practices
    if (lead.businessName && lead.businessName.toLowerCase().includes('halal')) {
        factors.halal = true;
    }

    // Check for Urdu language in business name
    const urduKeywords = ['کمرشل', 'کاروبار', 'دکان', 'مارکیٹ', 'عمارت'];
    const hasUrdu = urduKeywords.some(keyword => lead.businessName && lead.businessName.includes(keyword));
    if (hasUrdu) {
        factors.language = 'urdu';
    }

    return factors;
}

/**
 * Generate Pakistan-specific recommendations
 * @param {Object> analysis - Pakistan analysis result
 * @returns {Array} Recommendations
 */
function generatePakistanRecommendations(analysis) {
    const recommendations = [];

    if (!analysis.isPakistanBusiness) {
        recommendations.push('Consider targeting Pakistan-specific businesses for better lead quality');
        return recommendations;
    }

    // Phone recommendations
    if (!analysis.phoneValidation || !analysis.phoneValidation.valid) {
        recommendations.push('Add valid Pakistan phone number for better credibility');
        if (analysis.province) {
            recommendations.push(`Use ${analysis.province} landline code for local presence`);
        }
    }

    // Email recommendations
    if (!analysis.emailValidation || !analysis.emailValidation.isPakistan) {
        recommendations.push('Use Pakistan-specific email domain for better local presence');
        recommendations.push('Consider using .pk domain for email addresses');
    }

    // Website recommendations
    if (!analysis.websiteValidation || !analysis.websiteValidation.isPakistan) {
        recommendations.push('Use Pakistan-specific domain (.pk) for better local SEO');
        recommendations.push('Include Pakistan-specific content and contact information');
    }

    // Business category recommendations
    if (analysis.businessCategory) {
        if (analysis.businessCategory.type === 'high_value') {
            recommendations.push('High-value category - consider premium lead generation strategies');
        } else if (analysis.businessCategory.type === 'emerging') {
            recommendations.push('Emerging category - high growth potential, invest in relationship building');
        }
    }

    // Regional recommendations
    if (analysis.province) {
        recommendations.push(`Focus on ${analysis.province} market with region-specific strategies`);
        
        // Province-specific recommendations
        switch (analysis.province) {
            case 'Punjab':
                recommendations.push('Punjab has high business activity - focus on B2B relationships');
                break;
            case 'Sindh':
                recommendations.push('Karachi market is competitive - differentiate with unique value proposition');
                break;
            case 'Islamabad Capital Territory':
                recommendations.push('Islamabad has high concentration of corporate businesses');
                break;
            case 'Khyber Pakhtunkhwa':
                recommendations.push('KP market is growing - focus on traditional business relationships');
                break;
        }
    }

    // Cultural recommendations
    if (analysis.culturalFactors) {
        recommendations.push('Consider cultural factors in business communication');
        recommendations.push('Respect Islamic holidays and business hours');
    }

    return recommendations;
}

/**
 * Get Pakistan business statistics
 * @param {Array> leads - Array of leads
 * @returns {Object> Pakistan business statistics
 */
function getPakistanBusinessStatistics(leads) {
    if (!leads || leads.length === 0) {
        return { total: 0, pakistanBusinesses: 0, statistics: {} };
    }

    const stats = {
        total: leads.length,
        pakistanBusinesses: 0,
        statistics: {
            byProvince: {},
            byCategory: {},
            byPhoneType: {},
            byWebsiteType: {},
            averageRating: 0,
            averageQualityScore: 0
        }
    };

    let totalRating = 0;
    let totalQualityScore = 0;
    let ratingCount = 0;
    let qualityScoreCount = 0;

    leads.forEach(lead => {
        // Check if it's a Pakistan business
        let isPakistanBusiness = false;

        if (lead.phone) {
            const phoneValidation = validatePakistanPhone(lead.phone);
            if (phoneValidation.valid) {
                isPakistanBusiness = true;
                
                // Track phone type
                const phoneType = phoneValidation.type;
                stats.statistics.byPhoneType[phoneType] = (stats.statistics.byPhoneType[phoneType] || 0) + 1;
            }
        }

        if (lead.email) {
            const emailValidation = validatePakistanEmail(lead.email, lead.website);
            if (emailValidation.isPakistan) {
                isPakistanBusiness = true;
            }
        }

        if (lead.website) {
            const websiteValidation = validatePakistanWebsite(lead.website);
            if (websiteValidation.isPakistan) {
                isPakistanBusiness = true;
                stats.statistics.byWebsiteType['pakistan'] = (stats.statistics.byWebsiteType['pakistan'] || 0) + 1;
            } else {
                stats.statistics.byWebsiteType['international'] = (stats.statistics.byWebsiteType['international'] || 0) + 1;
            }
        }

        if (isPakistanBusiness) {
            stats.pakistanBusinesses++;

            // Track province
            if (lead.address) {
                const province = getPakistanProvinceFromCity(lead.address);
                if (province) {
                    stats.statistics.byProvince[province] = (stats.statistics.byProvince[province] || 0) + 1;
                }
            }

            // Track category
            if (lead.category) {
                const category = classifyPakistanBusinessCategory(lead.category);
                const categoryType = category.type;
                stats.statistics.byCategory[categoryType] = (stats.statistics.byCategory[categoryType] || 0) + 1;
            }
        }

        // Calculate averages
        if (lead.rating) {
            const rating = parseFloat(lead.rating);
            if (!isNaN(rating)) {
                totalRating += rating;
                ratingCount++;
            }
        }

        if (lead.leadQualityScore) {
            const score = parseFloat(lead.leadQualityScore);
            if (!isNaN(score)) {
                totalQualityScore += score;
                qualityScoreCount++;
            }
        }
    });

    stats.statistics.averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    stats.statistics.averageQualityScore = qualityScoreCount > 0 ? totalQualityScore / qualityScoreCount : 0;

    return stats;
}

/**
 * Export Pakistan regional utilities
 */
module.exports = {
    validatePakistanPhone,
    validatePakistanEmail,
    validatePakistanWebsite,
    analyzePakistanBusiness,
    getPakistanBusinessStatistics,
    PAKISTAN_CONFIG,
    isPakistanMobile,
    isPakistanLandline,
    isPakistanInternational,
    normalizePakistanPhone,
    getPakistanRegionFromCode,
    getPakistanProvinceFromCity,
    classifyPakistanBusinessCategory,
    generatePakistanRecommendations
};