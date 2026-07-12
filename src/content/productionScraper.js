/**
 * Production-Grade Google Maps Scraper
 * Enhanced version with advanced data validation, scoring, quality assurance
 * 
 * This enhanced scraper includes:
 * - Advanced duplicate detection with fuzzy matching
 * - Comprehensive lead scoring system
 * - Regional handling (Pakistan-specific optimizations)
 * - Rate limiting and anti-detection measures
 * - Quality assurance and data validation
 * - Error handling and recovery mechanisms
 * - Website analysis and social media extraction
 */

class ProductionScraper {
    constructor() {
        this.isScraping = false;
        this.shouldStop = false;
        this.scrollCount = 0;
        this.maxScrolls = 50;
        this.scrollDelay = 2000;
        this.collectedLeads = [];
        this.duplicates = new Set();
        this.scrapeInterval = null;
        this.sessionId = null;
        
        // Production-grade components
        this.rateLimiter = this.initializeRateLimiter();
        this.qualityAssurance = this.initializeQualityAssurance();
        this.duplicateDetection = this.initializeDuplicateDetection();
        this.scoringEngine = this.initializeScoringEngine();
        this.regionalHandler = this.initializeRegionalHandler();
        
        this.init();
    }
    
    initializeRateLimiter() {
        return {
            requestCount: 0,
            lastRequestTime: 0,
            minDelay: 2000, // 2 seconds between requests
            maxRequestsPerMinute: 30,
            burstRequests: 5,
            
            checkRateLimit: function() {
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                
                if (timeSinceLastRequest < this.minDelay) {
                    const delay = this.minDelay - timeSinceLastRequest;
                    console.log(`[RateLimiter] Rate limiting: waiting ${delay}ms`);
                    return delay;
                }
                
                // Check for burst requests
                if (this.requestCount >= this.maxRequestsPerMinute) {
                    const nextMinute = 60000 - (now % 60000);
                    console.log(`[RateLimiter] Rate limit reached: waiting ${nextMinute}ms`);
                    this.requestCount = 0;
                    return nextMinute;
                }
                
                this.requestCount++;
                this.lastRequestTime = now;
                return 0;
            },
            
            waitForRateLimit: function() {
                const delay = this.checkRateLimit();
                if (delay > 0) {
                    return new Promise(resolve => setTimeout(resolve, delay));
                }
                return Promise.resolve();
            }
        };
    }
    
    initializeQualityAssurance() {
        return {
            validateLead: function(lead) {
                const issues = [];
                const warnings = [];
                
                // Required field validation
                if (!lead.businessName || lead.businessName.length < 2) {
                    issues.push('Missing or invalid business name');
                }
                
                if (!lead.category || lead.category.length < 2) {
                    warnings.push('Missing business category');
                }
                
                if (!lead.address || lead.address.length < 5) {
                    warnings.push('Missing or incomplete address');
                }
                
                // Contact validation
                if (lead.phone) {
                    const phoneValidation = this.validatePhoneNumber(lead.phone);
                    if (!phoneValidation.valid) {
                        issues.push('Invalid phone number format');
                    }
                }
                
                if (lead.email) {
                    const emailValidation = this.validateEmail(lead.email, lead.website);
                    if (!emailValidation.valid) {
                        issues.push('Invalid email address format');
                    }
                }
                
                // Website validation
                if (lead.website) {
                    if (lead.website.includes('google.com/maps') || lead.website.includes('maps.google.com')) {
                        issues.push('Google Maps URL detected as website');
                    }
                }
                
                // Data consistency checks
                if (lead.rating && (parseFloat(lead.rating) < 0 || parseFloat(lead.rating) > 5)) {
                    issues.push('Rating value out of valid range (0-5)');
                }
                
                if (lead.reviewCount && (parseInt(lead.reviewCount) < 0)) {
                    issues.push('Review count cannot be negative');
                }
                
                return {
                    isValid: issues.length === 0,
                    issues: issues,
                    warnings: warnings,
                    qualityScore: issues.length === 0 ? 1 : Math.max(0, 1 - (issues.length * 0.1))
                };
            },
            
            validatePhoneNumber: function(phone, region = 'PK') {
                if (!phone || typeof phone !== 'string') {
                    return { valid: false, normalized: null, region: null, type: null };
                }
                
                const cleaned = phone.replace(/[^\d+\-()\s]/g, '').trim();
                const digits = cleaned.replace(/\D/g, '');
                if (digits.length < 7 || digits.length > 15) {
                    return { valid: false, normalized: null, region: null, type: null };
                }
                
                // Pakistan-specific validation
                if (region === 'PK') {
                    const pakistanMobile = /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/;
                    const pakistanLandline = /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/;
                    
                    if (pakistanMobile.test(phone)) {
                        const normalized = cleaned.replace(/^0/, '').replace(/(\d{2})(\d{3})(\d{7})/, '$1-$2-$3');
                        return { valid: true, normalized, region: 'PK', type: 'mobile' };
                    }
                    if (pakistanLandline.test(phone)) {
                        const normalized = cleaned.replace(/^0/, '').replace(/(\d{2})(\d{3})(\d{7,8})/, '$1-$2-$3');
                        return { valid: true, normalized, region: 'PK', type: 'landline' };
                    }
                }
                
                return { valid: false, normalized: null, region: null, type: null };
            },
            
            validateEmail: function(email, businessDomain = '') {
                if (!email || typeof email !== 'string') {
                    return { valid: false, normalized: null, score: 0, issues: [] };
                }
                
                let cleaned = email.trim().toLowerCase();
                cleaned = cleaned.replace(/^["']+|["']+$/g, '');
                
                const standardPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!standardPattern.test(cleaned)) {
                    return { valid: false, normalized: null, score: 0, issues: ['invalid_format'] };
                }
                
                const disposableDomains = ['tempmail', '10minutemail', 'guerrillamail', 'mailinator', 'trashmail'];
                const domain = cleaned.split('@')[1];
                if (disposableDomains.some(disposable => domain.includes(disposable))) {
                    return { valid: false, normalized: null, score: 0, issues: ['disposable_domain'] };
                }
                
                let score = 5;
                const issues = [];
                
                if (businessDomain) {
                    const businessScore = this.scoreEmailDomainRelevance(domain, businessDomain);
                    score += businessScore;
                }
                
                if (cleaned.length > 50) {
                    issues.push('too_long');
                    score -= 1;
                }
                
                return {
                    valid: score > 0,
                    normalized: cleaned,
                    score: Math.max(0, score),
                    issues: issues
                };
            },
            
            scoreEmailDomainRelevance: function(emailDomain, businessDomain) {
                if (!emailDomain || !businessDomain) return 0;
                
                const cleanEmailDomain = emailDomain.toLowerCase();
                const cleanBusinessDomain = businessDomain.toLowerCase().replace(/^www\./, '').split('/')[0];
                
                if (cleanEmailDomain === cleanBusinessDomain) return 5;
                if (cleanEmailDomain.endsWith('.' + cleanBusinessDomain)) return 4;
                if (cleanBusinessDomain.includes(cleanEmailDomain) || cleanEmailDomain.includes(cleanBusinessDomain)) return 3;
                
                const businessPatterns = ['info', 'contact', 'sales', 'support', 'hello', 'admin', 'office', 'help'];
                if (businessPatterns.some(pattern => cleanEmailDomain.startsWith(pattern + '.'))) return 2;
                
                return 0;
            },
            
            cleanLeadData: function(lead) {
                if (!lead) return null;
                
                const cleaned = { ...lead };
                
                // Clean string fields
                Object.keys(cleaned).forEach(key => {
                    if (typeof cleaned[key] === 'string') {
                        cleaned[key] = cleaned[key].trim();
                    }
                });
                
                // Remove empty values
                Object.keys(cleaned).forEach(key => {
                    if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
                        delete cleaned[key];
                    }
                });
                
                // Normalize phone number
                if (cleaned.phone) {
                    const phoneValidation = this.validatePhoneNumber(cleaned.phone);
                    if (phoneValidation.valid) {
                        cleaned.phone = phoneValidation.normalized;
                    }
                }
                
                // Normalize email
                if (cleaned.email) {
                    const emailValidation = this.validateEmail(cleaned.email, cleaned.website);
                    if (emailValidation.valid) {
                        cleaned.email = emailValidation.normalized;
                    }
                }
                
                // Detect region
                cleaned.region = this.detectRegion(cleaned.address, cleaned.phone);
                
                // Calculate quality score
                const qualityValidation = this.validateLead(cleaned);
                cleaned.qualityScore = qualityValidation.qualityScore;
                
                return cleaned;
            },
            
            detectRegion: function(address, phone) {
                if (!address && !phone) return 'Unknown';
                
                // Check for Pakistan-specific patterns
                if (phone) {
                    const pakistanMobile = /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/;
                    const pakistanLandline = /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/;
                    
                    if (pakistanMobile.test(phone) || pakistanLandline.test(phone)) {
                        return 'Pakistan';
                    }
                }
                
                if (address) {
                    const pakistanKeywords = [
                        'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad',
                        'multan', 'hyderabad', 'peshawar', 'quetta', 'sialkot',
                        'gujranwala', 'sargodha', 'sheikhupura', 'sukkur', 'jhang'
                    ];
                    
                    const lowerAddress = address.toLowerCase();
                    if (pakistanKeywords.some(keyword => lowerAddress.includes(keyword))) {
                        return 'Pakistan';
                    }
                }
                
                return 'International';
            }
        };
    }
    
    initializeDuplicateDetection() {
        return {
            generateBusinessHash: function(lead) {
                if (!lead) return '';
                
                const name = (lead.businessName || '').toLowerCase().trim();
                const phone = (lead.phone || '').replace(/\D/g, '');
                const address = (lead.address || '').toLowerCase().trim();
                
                const components = [];
                if (name) components.push(name);
                if (phone) components.push(phone);
                if (address) components.push(address);
                
                return components.join('|');
            },
            
            isDuplicate: function(lead, existingLeads) {
                const hash = this.generateBusinessHash(lead);
                
                for (const existing of existingLeads) {
                    const existingHash = this.generateBusinessHash(existing);
                    if (existingHash === hash) {
                        return true;
                    }
                    
                    // Fuzzy matching for similar business names
                    if (lead.businessName && existing.businessName) {
                        const similarity = this.calculateStringSimilarity(lead.businessName, existing.businessName);
                        if (similarity > 0.8) {
                            return true;
                        }
                    }
                }
                
                return false;
            },
            
            calculateStringSimilarity: function(str1, str2) {
                const longer = str1.length > str2.length ? str1 : str2;
                const shorter = str1.length > str2.length ? str2 : str1;
                
                if (longer.length === 0) return 1;
                
                const editDistance = this.levenshteinDistance(longer, shorter);
                return (longer.length - editDistance) / longer.length;
            },
            
            levenshteinDistance: function(str1, str2) {
                const matrix = [];
                
                for (let i = 0; i <= str2.length; i++) {
                    matrix[i] = [i];
                }
                
                for (let j = 0; j <= str1.length; j++) {
                    matrix[0][j] = j;
                }
                
                for (let i = 1; i <= str2.length; i++) {
                    for (let j = 1; j <= str1.length; j++) {
                        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                            matrix[i][j] = matrix[i - 1][j - 1];
                        } else {
                            matrix[i][j] = Math.min(
                                matrix[i - 1][j - 1] + 1,
                                matrix[i][j - 1] + 1,
                                matrix[i - 1][j] + 1
                            );
                        }
                    }
                }
                
                return matrix[str2.length][str1.length];
            }
        };
    }
    
    initializeScoringEngine() {
        return {
            calculateLeadQualityScore: function(lead) {
                if (!lead) return { score: 0, breakdown: {}, recommendations: [], valid: false };
                
                let totalScore = 0;
                let maxPossibleScore = 0;
                const breakdown = {};
                const recommendations = [];
                
                // Phone scoring (15% weight)
                const hasPhone = !!lead.phone;
                const phoneScore = hasPhone ? 0.8 : 0.2;
                breakdown.phone = { score: phoneScore, hasPhone: hasPhone };
                totalScore += phoneScore * 0.15;
                maxPossibleScore += 0.15;
                if (!hasPhone) recommendations.push('Add phone number to improve lead quality');
                
                // Email scoring (20% weight)
                const hasEmail = !!lead.email;
                const emailScore = hasEmail ? 0.9 : 0.1;
                breakdown.email = { score: emailScore, hasEmail: hasEmail };
                totalScore += emailScore * 0.20;
                maxPossibleScore += 0.20;
                if (!hasEmail) recommendations.push('Add email address to improve lead quality');
                
                // Website scoring (10% weight)
                const hasWebsite = !!lead.website;
                const websiteScore = hasWebsite ? 0.7 : 0;
                breakdown.website = { score: websiteScore, hasWebsite: hasWebsite };
                totalScore += websiteScore * 0.10;
                maxPossibleScore += 0.10;
                if (!hasWebsite) recommendations.push('Create a business website to improve lead quality');
                
                // Rating scoring (10% weight)
                const rating = parseFloat(lead.rating) || 0;
                const ratingScore = Math.min(1, rating / 5);
                breakdown.rating = { score: ratingScore, rating: rating };
                totalScore += ratingScore * 0.10;
                maxPossibleScore += 0.10;
                if (rating < 3.0) recommendations.push('Improve customer rating to increase lead quality');
                
                // Review count scoring (10% weight)
                const reviews = parseInt(lead.reviewCount) || 0;
                const reviewScore = Math.min(1, Math.log10(reviews + 1) / 3);
                breakdown.reviews = { score: reviewScore, reviewCount: reviews };
                totalScore += reviewScore * 0.10;
                maxPossibleScore += 0.10;
                if (reviews < 20) recommendations.push('Increase customer reviews to improve lead quality');
                
                // Social media scoring (15% weight)
                const socialPlatforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest'];
                const socialCount = socialPlatforms.filter(platform => lead[platform]).length;
                const socialScore = socialCount / socialPlatforms.length;
                breakdown.socialMedia = { score: socialScore, platformCount: socialCount };
                totalScore += socialScore * 0.15;
                maxPossibleScore += 0.15;
                if (socialCount === 0) recommendations.push('Create social media profiles to increase online presence');
                
                // Business status scoring (10% weight)
                const isOpen = lead.businessStatus === 'Open' || !lead.businessStatus;
                const statusScore = isOpen ? 1 : 0;
                breakdown.businessStatus = { score: statusScore, isOpen: isOpen };
                totalScore += statusScore * 0.10;
                maxPossibleScore += 0.10;
                if (!isOpen) recommendations.push('Update business status to open to improve lead quality');
                
                // Normalize to 1-10 scale
                const normalizedScore = Math.min(10, Math.max(1, (totalScore / maxPossibleScore) * 10));
                
                // Determine priority classification
                const priority = normalizedScore >= 7 ? 'High' : normalizedScore >= 4 ? 'Medium' : 'Low';
                
                return {
                    score: Math.round(normalizedScore * 10) / 10,
                    breakdown: breakdown,
                    recommendations: recommendations,
                    priority: priority,
                    maxPossibleScore: maxPossibleScore,
                    rawScore: totalScore,
                    valid: true
                };
            },
            
            calculateWebsiteImprovementScore: function(lead) {
                if (!lead || !lead.website) return { score: 0, breakdown: {}, recommendations: [], valid: false };
                
                let totalScore = 0;
                let maxPossibleScore = 0;
                const breakdown = {};
                const recommendations = [];
                
                // Domain quality (30%)
                const domainScore = this.scoreDomainQuality(lead.website);
                breakdown.domain = domainScore;
                totalScore += domainScore.score * 0.3;
                maxPossibleScore += 0.3;
                
                // Technical quality (30%)
                const technicalScore = this.scoreTechnicalQuality(lead.website, lead.websiteAnalysis);
                breakdown.technical = technicalScore;
                totalScore += technicalScore.score * 0.3;
                maxPossibleScore += 0.3;
                
                // Content quality (20%)
                const contentScore = this.scoreContentQuality(lead);
                breakdown.content = contentScore;
                totalScore += contentScore.score * 0.2;
                maxPossibleScore += 0.2;
                
                // SEO quality (20%)
                const seoScore = this.scoreSeoQuality(lead);
                breakdown.seo = seoScore;
                totalScore += seoScore.score * 0.2;
                maxPossibleScore += 0.2;
                
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
            },
            
            scoreDomainQuality: function(website) {
                if (!website) return { score: 0, isProfessional: false, domain: null };
                
                const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                let score = 0.5;
                let isProfessional = false;
                
                const professionalTLDs = ['.com', '.org', '.net', '.biz', '.co', '.io', '.tech', '.ai'];
                if (professionalTLDs.some(tld => domain.endsWith(tld))) {
                    score += 0.3;
                    isProfessional = true;
                }
                
                if (domain.length > 8 && domain.length < 25) {
                    score += 0.2;
                }
                
                return {
                    score: Math.min(1, score),
                    isProfessional: isProfessional,
                    domain: domain
                };
            },
            
            scoreTechnicalQuality: function(website, analysis) {
                if (!website) return { score: 0, httpsEnabled: false, mobileFriendly: false, analysis: null };
                
                let score = 0.3;
                const result = {
                    httpsEnabled: false,
                    mobileFriendly: false,
                    analysis: analysis
                };
                
                if (website.startsWith('https://')) {
                    score += 0.3;
                    result.httpsEnabled = true;
                }
                
                if (analysis) {
                    if (analysis.httpsEnabled) {
                        score += 0.1;
                        result.httpsEnabled = true;
                    }
                    if (analysis.mobileFriendly) {
                        score += 0.2;
                        result.mobileFriendly = true;
                    }
                }
                
                return {
                    score: Math.min(1, score),
                    httpsEnabled: result.httpsEnabled,
                    mobileFriendly: result.mobileFriendly,
                    analysis: analysis
                };
            },
            
            scoreContentQuality: function(lead) {
                let score = 0.3;
                let hasServices = false;
                
                if (lead.services && lead.services.length > 0) {
                    score += 0.3;
                    hasServices = true;
                }
                
                if (lead.description && lead.description.length > 50) {
                    score += 0.2;
                }
                
                return {
                    score: Math.min(1, score),
                    hasServices: hasServices,
                    services: lead.services || null
                };
            },
            
            scoreSeoQuality: function(lead) {
                let score = 0.3;
                let metaTags = false;
                
                if (lead.website && lead.businessName) {
                    const domain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
                    if (domain.toLowerCase().includes(lead.businessName.toLowerCase())) {
                        score += 0.2;
                    }
                }
                
                if (lead.category && lead.category.length > 0) {
                    score += 0.2;
                }
                
                if (lead.address && lead.address.length > 0) {
                    score += 0.2;
                    metaTags = true;
                }
                
                return {
                    score: Math.min(1, score),
                    metaTags: metaTags,
                    category: lead.category || null,
                    address: lead.address || null
                };
            }
        };
    }
    
    initializeRegionalHandler() {
        return {
            pakistanSpecific: {
                phonePatterns: [
                    /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/,
                    /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/
                ],
                
                addressKeywords: [
                    'road', 'street', 'avenue', 'boulevard', 'lane', 'sector',
                    'block', 'plot', 'house', 'flat', 'apartment', 'floor',
                    'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad'
                ],
                
                normalizePakistanAddress: function(address) {
                    if (!address) return '';
                    
                    let normalized = address.toLowerCase().trim();
                    normalized = normalized.replace(/\s+/g, ' ');
                    
                    const replacements = {
                        'rd': 'road',
                        'st': 'street',
                        'ave': 'avenue',
                        'blvd': 'boulevard',
                        'b': 'block',
                        'sec': 'sector'
                    };
                    
                    Object.entries(replacements).forEach(([from, to]) => {
                        normalized = normalized.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
                    });
                    
                    normalized = normalized.replace(/\b\w/g, l => l.toUpperCase());
                    return normalized;
                }
            },
            
            detectRegion: function(address, phone) {
                if (!address && !phone) return 'Unknown';
                
                if (phone) {
                    for (const pattern of this.pakistanSpecific.phonePatterns) {
                        if (pattern.test(phone)) {
                            return 'Pakistan';
                        }
                    }
                }
                
                if (address) {
                    const lowerAddress = address.toLowerCase();
                    const pakistanKeywords = this.pakistanSpecific.addressKeywords.filter(keyword => 
                        lowerAddress.includes(keyword.toLowerCase())
                    );
                    
                    if (pakistanKeywords.length > 0) {
                        return 'Pakistan';
                    }
                }
                
                return 'International';
            }
        };
    }
    
    init() {
        this.setupMessageListeners();
        this.setupObserver();
    }
    
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'SCRAPE_START':
                this.startScraping(message);
                sendResponse({ success: true });
                break;
            
            case 'SCRAPE_STOP':
                this.stopScraping();
                sendResponse({ success: true });
                break;
            
            case 'CHECK_STATUS':
                sendResponse({ 
                    isRunning: this.isScraping,
                    found: this.collectedLeads.length 
                });
                break;
            
            default:
                sendResponse({ error: 'Unknown message type' });
        }
    }
    
    startScraping(options) {
        if (this.isScraping) return;
        
        this.isScraping = true;
        this.shouldStop = false;
        this.scrollCount = 0;
        this.maxScrolls = options.scrollDepth || 50;
        this.scrollDelay = options.speed || 2000;
        this.sessionId = options.sessionId || null;
        
        chrome.runtime.sendMessage({
            type: 'SCRAPE_PROGRESS',
            found: 0,
            total: this.maxScrolls
        });
        
        this.startScrolling();
        this.observeResults();
    }
    
    stopScraping() {
        if (!this.isScraping) return;
        
        this.isScraping = false;
        this.shouldStop = true;
        this.cleanup();
        
        chrome.runtime.sendMessage({
            type: 'SCRAPE_DONE',
            total: this.collectedLeads.length,
            duplicatesRemoved: this.duplicates.size,
            sessionId: this.sessionId
        });
    }
    
    setupObserver() {
        const observer = new MutationObserver((mutations) => {
            if (this.isScraping) {
                this.extractLeads();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
        
        this.observer = observer;
    }
    
    async startScrolling() {
        const scroll = async () => {
            if (!this.isScraping || this.scrollCount >= this.maxScrolls || this.shouldStop) {
                this.stopScraping();
                return;
            }
            
            // Apply rate limiting
            await this.rateLimiter.waitForRateLimit();
            
            window.scrollTo(0, document.body.scrollHeight);
            this.scrollCount++;
            
            chrome.runtime.sendMessage({
                type: 'SCRAPE_PROGRESS',
                found: this.collectedLeads.length,
                total: this.maxScrolls
            });
            
            if (this.isScraping) {
                this.scrapeInterval = setTimeout(scroll, this.scrollDelay);
            }
        };
        
        scroll();
    }
    
    observeResults() {
        const resultsContainer = document.querySelector('[role="feed"]');
        if (resultsContainer) {
            const observer = new MutationObserver((mutations) => {
                if (this.isScraping) {
                    this.extractLeads();
                }
            });
            
            observer.observe(resultsContainer, {
                childList: true,
                subtree: true
            });
            
            this.resultsObserver = observer;
        }
    }
    
    async extractLeads() {
        const leadElements = document.querySelectorAll('[role="article"]');
        const newLeads = [];
        
        for (const element of leadElements) {
            try {
                const lead = this.extractLeadFromCard(element);
                if (lead && lead.businessName) {
                    // Apply quality assurance
                    const cleanedLead = this.qualityAssurance.cleanLeadData(lead);
                    
                    // Check for duplicates
                    if (!this.duplicateDetection.isDuplicate(cleanedLead, this.collectedLeads)) {
                        // Calculate scores
                        const qualityScore = this.scoringEngine.calculateLeadQualityScore(cleanedLead);
                        const websiteScore = cleanedLead.website ? 
                            this.scoringEngine.calculateWebsiteImprovementScore(cleanedLead) : null;
                        
                        cleanedLead.leadQualityScore = qualityScore.score;
                        cleanedLead.priority = qualityScore.priority;
                        cleanedLead.recommendations = qualityScore.recommendations;
                        cleanedLead.websiteImprovementScore = websiteScore ? websiteScore.score : null;
                        
                        newLeads.push(cleanedLead);
                        this.duplicates.add(this.duplicateDetection.generateBusinessHash(cleanedLead));
                        
                        console.log(`[ProductionScraper] ✅ Extracted: ${cleanedLead.businessName} (Score: ${qualityScore.score}/10)`);
                    }
                }
            } catch (error) {
                console.warn('[ProductionScraper] Error extracting lead:', error.message);
            }
        }
        
        if (newLeads.length > 0) {
            this.collectedLeads.push(...newLeads);
            
            chrome.runtime.sendMessage({
                type: 'SCRAPE_RESULT',
                leads: newLeads,
                sessionId: this.sessionId
            });
        }
    }
    
    extractLeadFromCard(card) {
        if (!card) return null;
        
        const businessName = this.extractBusinessName(card);
        if (!businessName) return null;
        
        const placeUrl = this.extractPlaceUrl(card);
        const { rating, reviewCount } = this.extractRatingInfo(card);
        const category = this.extractCategory(card);
        const address = this.extractAddress(card);
        const phone = this.extractPhone(card);
        const { website, websiteStatus } = this.extractWebsite(card);
        
        const latLng = this.extractLatLngFromUrl(placeUrl);
        const addrComp = this.parseAddressComponents(address);
        
        const socialLinks = this.extractSocialLinks(card);
        const services = this.extractServices(card);
        const openingHours = this.extractOpeningHours(card);
        
        return {
            id: this.generateId(),
            businessName,
            category,
            rating,
            reviewCount,
            address,
            city: addrComp.city,
            state: addrComp.state,
            country: addrComp.country,
            postalCode: addrComp.postalCode,
            latitude: latLng.lat,
            longitude: latLng.lng,
            phone,
            website,
            websiteStatus,
            email: null,
            emails: [],
            ownerName: null,
            businessStatus: 'Open',
            openingHours: openingHours,
            services: services,
            ...socialLinks,
            websiteAnalysis: null,
            leadQualityScore: 1,
            priority: 'Low',
            placeUrl,
            scrapedAt: new Date().toISOString(),
            pitch: null,
            pitchStatus: 'PENDING',
            region: 'Unknown',
            qualityScore: 1,
            validationIssues: [],
            warnings: []
        };
    }
    
    // Helper methods (simplified versions)
    extractBusinessName(card) {
        const mainLink = card.querySelector('a.hfpxzc');
        if (mainLink) {
            const label = mainLink.getAttribute('aria-label');
            if (label && label.trim().length > 0) {
                return label.trim().replace(/\s*·\s*Visited\s*link\s*/gi, '').trim();
            }
        }
        
        const el = card.querySelector('.fontHeadlineSmall, div.qBF1Pd, h1, h2, h3');
        if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) {
                return text.replace(/\s*·\s*Visited\s*link\s*/gi, '').trim();
            }
        }
        
        return '';
    }
    
    extractPlaceUrl(card) {
        const linkEl = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="maps"]');
        return linkEl?.href || '';
    }
    
    extractRatingInfo(card) {
        let rating = null;
        let reviewCount = null;
        
        const allElements = card.querySelectorAll('[aria-label]');
        for (const el of allElements) {
            const label = el.getAttribute('aria-label');
            if (label && label.includes('stars')) {
                const rMatch = label.match(/([\d.]+)\s*stars?/i);
                if (rMatch && rating === null) rating = parseFloat(rMatch[1]);
                
                const revMatch = label.match(/([\d,]+)\s*Reviews?/i);
                if (revMatch && reviewCount === null) reviewCount = parseInt(revMatch[1].replace(/,/g, ''), 10);
            }
        }
        
        if (rating === null || reviewCount === null) {
            const text = card.textContent || '';
            const rMatch = text.match(/\b([1-4]\.\d|5\.0)\b/);
            if (rMatch && rating === null) rating = parseFloat(rMatch[1]);
            
            const revMatch = text.match(/\(([\d,]+)\)/);
            if (revMatch && reviewCount === null) reviewCount = parseInt(revMatch[1].replace(/,/g, ''), 10);
        }
        
        return { rating, reviewCount };
    }
    
    extractCategory(card) {
        const text = card.textContent || '';
        const parts = text.split('·').map(p => p.trim());
        
        for (let i = 1; i < parts.length; i++) {
            const p = parts[i];
            if (p.length > 2 && p.length < 40 &&
                !p.match(/\d/) && !p.includes(',') &&
                !p.toLowerCase().includes('open') &&
                !p.toLowerCase().includes('closed') &&
                !p.toLowerCase().includes('mi ') &&
                !p.toLowerCase().includes('km ') &&
                p !== '$' && p !== '$$' && p !== '$$$') {
                return p;
            }
        }
        
        return '';
    }
    
    extractAddress(card) {
        const addrBtn = card.querySelector('button[data-item-id="address"]');
        if (addrBtn) {
            const ariaLabel = addrBtn.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.startsWith('Address:')) {
                return ariaLabel.replace('Address:', '').replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
            }
        }
        
        const infoRows = card.querySelectorAll('.W4Efsd > .W4Efsd');
        for (const row of infoRows) {
            if (row.querySelector('.ZkP5Je') || row.querySelector('.AJB7ye')) continue;
            
            const topSpans = row.querySelectorAll(':scope > span');
            for (const topSpan of topSpans) {
                const dotSep = topSpan.querySelector('span[aria-hidden="true"]');
                if (dotSep && dotSep.textContent.trim() === '·') {
                    const siblings = topSpan.querySelectorAll('span');
                    for (const sib of siblings) {
                        let text = sib.textContent.trim();
                        text = text.replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
                        if (text && text !== '·' && !sib.getAttribute('aria-hidden')) {
                            return text;
                        }
                    }
                }
            }
        }
        
        return '';
    }
    
    extractPhone(card) {
        const phoneNumbers = new Set();
        
        const phoneBtn = card.querySelector('button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
            const ariaLabel = phoneBtn.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.startsWith('Phone:')) {
                const rawPhone = ariaLabel.replace('Phone:', '').trim();
                if (rawPhone) {
                    const cleaned = this.qualityAssurance.validatePhoneNumber(rawPhone);
                    if (cleaned.valid) phoneNumbers.add(cleaned.normalized);
                }
            }
        }
        
        const phoneEl = card.querySelector('.UsdlK');
        if (phoneEl && phoneEl.textContent) {
            const cleaned = this.qualityAssurance.validatePhoneNumber(phoneEl.textContent.trim());
            if (cleaned.valid) phoneNumbers.add(cleaned.normalized);
        }
        
        return Array.from(phoneNumbers)[0] || '';
    }
    
    extractWebsite(card) {
        let bestWebsite = null;
        let bestScore = 0;
        
        const links = card.querySelectorAll('a[href]');
        for (const link of links) {
            let href = link.href;
            const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
            const dataTooltip = (link.getAttribute('data-tooltip') || '').toLowerCase();
            const text = link.textContent.trim();
            
            // Skip invalid or Google-related links
            if (!href || !href.startsWith('http') || href.includes('google.com/maps')) {
                continue;
            }
            
            // Score this link
            let score = 0;
            if (ariaLabel.includes('website') || dataTooltip.includes('website')) {
                score += 10;
            }
            if (text.toLowerCase().includes('website')) {
                score += 5;
            }
            
            if (score > bestScore && this.isValidBusinessUrl(href)) {
                bestScore = score;
                bestWebsite = href;
            }
        }
        
        const websiteStatus = bestWebsite ? 
            (bestWebsite.startsWith('https://') ? 'HAS_WEBSITE' : 'NEEDS_REVAMP') : 'NO_WEBSITE';
        
        return { website: bestWebsite, websiteStatus };
    }
    
    isValidBusinessUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return !hostname.includes('google.com') && 
                   !hostname.includes('facebook.com') && 
                   !hostname.includes('twitter.com') &&
                   hostname.length > 5;
        } catch {
            return false;
        }
    }
    
    extractSocialLinks(card) {
        const socialLinks = {
            instagram: null,
            facebook: null,
            linkedin: null,
            twitter: null,
            youtube: null,
            tiktok: null,
            pinterest: null
        };
        
        const linkElements = card.querySelectorAll('a[href]');
        linkElements.forEach(link => {
            const href = link.href.toLowerCase();
            const text = link.textContent.toLowerCase();
            
            if (href.includes('instagram.com') || text.includes('instagram')) {
                socialLinks.instagram = href;
            } else if (href.includes('facebook.com') || text.includes('facebook')) {
                socialLinks.facebook = href;
            } else if (href.includes('linkedin.com') || text.includes('linkedin')) {
                socialLinks.linkedin = href;
            } else if (href.includes('twitter.com') || href.includes('x.com') || text.includes('twitter')) {
                socialLinks.twitter = href;
            } else if (href.includes('youtube.com') || text.includes('youtube')) {
                socialLinks.youtube = href;
            } else if (href.includes('tiktok.com') || text.includes('tiktok')) {
                socialLinks.tiktok = href;
            } else if (href.includes('pinterest.com') || text.includes('pinterest')) {
                socialLinks.pinterest = href;
            }
        });
        
        return socialLinks;
    }
    
    extractServices(card) {
        const services = [];
        
        const serviceElements = card.querySelectorAll('[aria-label*="service"], [data-tooltip*="service"], .service, .feature');
        serviceElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && text.length > 2 && !services.includes(text)) {
                services.push(text);
            }
        });
        
        const cardText = card.textContent.toLowerCase();
        const serviceKeywords = [
            'delivery', 'takeaway', 'dine-in', 'reservation', 'appointment',
            'online ordering', 'curbside pickup', 'drive-thru', '24/7',
            'emergency', 'walk-in', 'booking', 'consultation', 'estimate'
        ];
        
        serviceKeywords.forEach(keyword => {
            if (cardText.includes(keyword) && !services.includes(keyword)) {
                services.push(keyword);
            }
        });
        
        return services.join(', ');
    }
    
    extractOpeningHours(card) {
        const hoursElements = card.querySelectorAll('[aria-label*="hours"], .hours, .time, [data-tooltip*="hours"]');
        
        for (const element of hoursElements) {
            const text = element.textContent.trim();
            if (text && text.length > 5) {
                const cleaned = text
                    .replace(/\s*·\s*/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                if (cleaned.includes('am') || cleaned.includes('pm') || 
                    cleaned.includes('open') || cleaned.includes('closed')) {
                    return cleaned;
                }
            }
        }
        
        return '';
    }
    
    extractLatLngFromUrl(placeUrl) {
        const latLng = { lat: null, lng: null };
        
        try {
            const url = new URL(placeUrl);
            const params = new URLSearchParams(url.search);
            const query = params.get('query') || params.get('q') || '';
            
            // Extract coordinates from URL or query
            const coordMatch = query.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
            if (coordMatch) {
                latLng.lat = parseFloat(coordMatch[1]);
                latLng.lng = parseFloat(coordMatch[2]);
            }
        } catch (e) {
            console.warn('[ProductionScraper] Error extracting coordinates:', e.message);
        }
        
        return latLng;
    }
    
    parseAddressComponents(address) {
        const components = {
            city: null,
            state: null,
            country: null,
            postalCode: null
        };
        
        if (!address) return components;
        
        // Simple address parsing (enhanced version would use geocoding)
        const addressLower = address.toLowerCase();
        
        // Extract city (common Pakistani cities)
        const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'hyderabad', 'peshawar', 'quetta'];
        const foundCity = cities.find(city => addressLower.includes(city));
        if (foundCity) {
            components.city = foundCity.charAt(0).toUpperCase() + foundCity.slice(1);
        }
        
        // Extract postal code (look for patterns like 12345 or 12345-6789)
        const postalMatch = address.match(/\b\d{5,6}(-\d{4})?\b/);
        if (postalMatch) {
            components.postalCode = postalMatch[0];
        }
        
        // Assume Pakistan as default for now
        components.country = 'Pakistan';
        
        return components;
    }
    
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
    
    cleanup() {
        if (this.scrapeInterval) {
            clearTimeout(this.scrapeInterval);
            this.scrapeInterval = null;
        }
        
        if (this.resultsObserver) {
            this.resultsObserver.disconnect();
            this.resultsObserver = null;
        }
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// Initialize production scraper
const productionScraper = new ProductionScraper();

// Export for debugging
if (typeof window !== 'undefined') {
    window.productionScraper = productionScraper;
}