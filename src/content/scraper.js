/**
 * GeoLead AI — Content Script (Main Orchestrator)
 * Runs on Google Maps pages. Coordinates scraping using domParser and scrollHandler.
 * Handles message passing between popup ↔ content script.
 *
 * Architecture:
 *   - domParser.js   → Extracts business data from DOM elements
 *   - scrollHandler.js → Manages auto-scrolling to load more results
 *   - scraper.js (this) → Orchestrates the scraping pipeline
 *
 * NOTE: Content scripts in Manifest V3 cannot use ES modules (import/export).
 *       So domParser.js and scrollHandler.js are bundled inline here.
 *       The Vite build process will handle bundling for production.
 *       For development, all logic is self-contained in this IIFE.
 */

(function () {
    'use strict';

    // ====== STATE ======
    let isRunning = false;
    let shouldStop = false;
    let scrapeStartTime = null;
    let currentFound = 0;
    let currentTarget = 0;
    let currentSessionId = null;
    
    // KEEP-ALIVE STATE
    let keepAliveInterval = null;

    // ====== NETWORK INTERCEPTOR ======
    const interceptedPlaces = new Map();

    // Inject interceptor.js into Main World
    function injectInterceptor() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('interceptor.js');
            script.onload = function() {
                this.remove();
            };
            (document.head || document.documentElement).appendChild(script);
            console.log('✓ GeoLead AI Network Interceptor injected');
        } catch (e) {
            console.error('Failed to inject GeoLead AI Interceptor:', e);
        }
    }

    // Listen for intercepted network responses
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data && event.data.type === 'GEOMEAD_API_RESPONSE') {
            const data = event.data.data;
            try {
                if (data && Array.isArray(data)) {
                    const details = extractDetailsFromRawArray(data);
                    if (details && details.title) {
                        const key = details.title.toLowerCase().trim();
                        interceptedPlaces.set(key, details);
                        console.log(`[GeoLead] Intercepted API details for: ${details.title}`, details);
                    }
                }
            } catch (e) {
                console.error('Error parsing intercepted API data:', e);
            }
        }
    });

    function extractDetailsFromRawArray(data) {
        let title = null;
        let phone = null;
        let website = null;
        let latitude = null;
        let longitude = null;
        let plusCode = null;

        // Try direct lookup of name first
        try {
            if (data[0] && typeof data[0][1] === 'string') {
                title = data[0][1];
            }
        } catch (e) {}

        // Recursive search for phone, website, coordinates, and plus code
        function search(val) {
            if (!val) return;
            if (typeof val === 'string') {
                const str = val.trim();
                if (str.startsWith('http') && !str.includes('google.com') && !str.includes('google.co')) {
                    website = str;
                } else if ((str.startsWith('+') || str.startsWith('0')) && str.replace(/[\s\-()]/g, '').length >= 7 && str.replace(/[\s\-()]/g, '').length <= 18) {
                    if (/^\+?[0-9\s\-()]+$/.test(str)) {
                        phone = str;
                    }
                } else if (/^[A-Z0-9]{4}\+[A-Z0-9]{2,8}\s+.+$/.test(str)) {
                    plusCode = str;
                }
            } else if (typeof val === 'number') {
                // Keep moving
            } else if (Array.isArray(val)) {
                if (val.length === 2 && typeof val[0] === 'number' && typeof val[1] === 'number') {
                    const lat = val[0];
                    const lng = val[1];
                    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && lat !== 0 && lng !== 0 && !Number.isInteger(lat) && !Number.isInteger(lng)) {
                        latitude = lat;
                        longitude = lng;
                    }
                }
                for (let i = 0; i < val.length; i++) {
                    search(val[i]);
                }
            } else if (typeof val === 'object') {
                for (const k in val) {
                    search(val[k]);
                }
            }
        }

        search(data);

        // Fallback title lookups if direct lookup returned empty
        if (!title && data && Array.isArray(data)) {
            try {
                if (typeof data[6] === 'string') title = data[6];
                else if (data[0] && typeof data[0][0] === 'string') title = data[0][0];
            } catch (e) {}
        }

        return { title, phone, website, latitude, longitude, plusCode };
    }

    function startKeepAlive(source = 'scraper_content') {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        keepAliveInterval = setInterval(() => {
            chrome.runtime.sendMessage({ type: 'PING_KEEP_ALIVE', source }).catch(() => {});
        }, 20000);
    }
    
    function stopKeepAlive() {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    }

    // Message types (duplicated since content scripts can't import ES modules)
    const MSG = {
        START_SCRAPE: 'START_SCRAPE',
        STOP_SCRAPE: 'STOP_SCRAPE',
        SCRAPE_PROGRESS: 'SCRAPE_PROGRESS',
        SCRAPE_RESULT: 'SCRAPE_RESULT',
        SCRAPE_DONE: 'SCRAPE_DONE',
        SCRAPE_ERROR: 'SCRAPE_ERROR',
        CHECK_MAPS_PAGE: 'CHECK_MAPS_PAGE',
        MAPS_PAGE_STATUS: 'MAPS_PAGE_STATUS',
    };

    // ====== MESSAGE LISTENER ======
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case MSG.CHECK_MAPS_PAGE:
                sendResponse({
                    isOnMaps: true,
                    url: window.location.href,
                    hasResults: countVisibleCards() > 0,
                    resultCount: countVisibleCards(),
                    isRunning: isRunning,
                    found: currentFound,
                    total: currentTarget
                });
                return true;

            case MSG.START_SCRAPE:
                if (isRunning) {
                    sendResponse({ status: 'already_running' });
                    return true;
                }
                currentSessionId = message.sessionId || null;
                startScraping(message);
                sendResponse({ status: 'started' });
                return true;

            case MSG.STOP_SCRAPE:
                shouldStop = true;
                isRunning = false;
                stopKeepAlive();
                sendResponse({ status: 'stopping' });
                return true;

            default:
                return false;
        }
    });

    // ====== MAIN SCRAPING ORCHESTRATOR ======

    /**
     * Main scraping pipeline
     * 1. Find scroll container
     * 2. Auto-scroll to load results
     * 3. Parse all loaded results
     * 4. Deduplicate
     * 5. Send results to popup
     */
    async function startScraping(config) {
        isRunning = true;
        shouldStop = false;
        scrapeStartTime = Date.now();
        startKeepAlive();

        const maxResults = config.scrollDepth || 30;
        const scrollDelay = config.speed || 2000;

        try {
            // Step 1: Wait for feed stabilization
            const scrollContainer = findScrollContainer();
            if (!scrollContainer) {
                sendError('Could not find Google Maps results panel. Please search for businesses first.');
                isRunning = false;
                return;
            }

            console.log('[GeoLead] 📡 Found scroll container, starting dynamic loop...');
            console.log(`[GeoLead] ⚙️ Config: maxResults=${maxResults}, scrollDelay=${scrollDelay}ms`);

            const processedPlaceUrls = new Set();
            const scrapedLeads = [];
            currentFound = 0;
            currentTarget = maxResults;

            let scrollAttempt = 0;
            let stallCount = 0;
            const MAX_SCROLL_ATTEMPTS = 100;

            // Send initial progress
            sendProgress(0, maxResults);

            // Dynamic card processing loop
            while (currentFound < maxResults && !shouldStop) {
                // Find all cards matching our selector
                const cards = findBusinessCards();
                let nextCard = null;
                let nextPlaceUrl = '';
                let nextBusinessName = '';

                // Find the first card that hasn't been processed
                for (const card of cards) {
                    const placeUrl = extractPlaceUrl(card);
                    const name = extractBusinessName(card);
                    if (placeUrl && name && !processedPlaceUrls.has(placeUrl)) {
                        nextCard = card;
                        nextPlaceUrl = placeUrl;
                        nextBusinessName = name;
                        break;
                    }
                }

                if (!nextCard) {
                    // No new unprocessed cards visible. We need to scroll down to reveal more!
                    if (isEndOfResults(scrollContainer)) {
                        console.log('[GeoLead] 🏁 Reached end of results list.');
                        break;
                    }

                    if (scrollAttempt >= MAX_SCROLL_ATTEMPTS) {
                        console.log('[GeoLead] 🛑 Maximum scroll attempts reached.');
                        break;
                    }

                    // Apply rate limiting
                    const rateLimitDelay = await rateLimiter.waitForRateLimit();
                    if (rateLimitDelay > 0) {
                        await sleep(rateLimitDelay);
                    }

                    console.log('[GeoLead] 📜 Scrolling feed down to load more listings...');
                    const prevCardCount = cards.length;
                    scrollContainer.scrollBy({ top: 800, behavior: 'smooth' });
                    scrollAttempt++;
                    await sleep(scrollDelay);

                    // Re-query cards to check if new cards appeared
                    const newCards = findBusinessCards();
                    if (newCards.length === prevCardCount) {
                        stallCount++;
                        if (stallCount >= 6) {
                            console.log('[GeoLead] 🛑 Feed stalled (no new cards loaded after 6 scrolls), stopping.');
                            break;
                        }
                    } else {
                        stallCount = 0;
                    }
                    continue;
                }

                // We have a valid unprocessed card!
                console.log(`[GeoLead DEBUG] Business card detected: "${nextBusinessName}", URL: "${nextPlaceUrl}"`);
                processedPlaceUrls.add(nextPlaceUrl);

                // Try to click and scrape the details
                let success = false;
                let retryCount = 0;
                let lead = null;

                while (!success && retryCount < 3 && !shouldStop) {
                    try {
                        // Click the card
                        const clickTarget = nextCard.querySelector('a[href*="/maps/place/"]') || nextCard.querySelector('a.hfpxzc') || nextCard;
                        console.log(`[GeoLead DEBUG] Clicking business card: "${nextBusinessName}" (Attempt ${retryCount + 1})...`);
                        clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
                        await sleep(200);
                        clickTarget.click();

                        // Wait for details panel and verify correct business
                        console.log(`[GeoLead DEBUG] Waiting for detail panel to load for: "${nextBusinessName}"...`);
                        const correctPanel = await waitForCorrectDetailPanel(nextBusinessName, 6000);
                        if (!correctPanel) {
                            throw new Error(`Detail panel title did not match expected business: ${nextBusinessName}`);
                        }
                        console.log(`[GeoLead DEBUG] Detail panel loaded & verified for: "${nextBusinessName}"`);

                        // Wait for info section to render
                        await sleep(500);

                        // Scroll DOWN inside detail panel to trigger lazy loads
                        const detailScroll = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf, .m6QErb.WNBkOb, .bJzME, div[role="main"]');
                        if (detailScroll) {
                            detailScroll.scrollBy({ top: 400, behavior: 'smooth' });
                            await sleep(300);
                        }

                        // Create raw lead object from card
                        lead = extractLeadFromCard(nextCard);
                        if (!lead) {
                            lead = {
                                id: generateId(),
                                businessName: nextBusinessName,
                                placeUrl: nextPlaceUrl,
                                scrapedAt: new Date().toISOString()
                            };
                        }

                        // ====== EXTRACT DETAILED FIELDS ======
                        // 1. Check API Interceptor map
                        const apiDetails = interceptedPlaces.get(nextBusinessName.toLowerCase().trim());
                        if (apiDetails) {
                            console.log(`[GeoLead DEBUG] API Interceptor payload matched for: "${nextBusinessName}"`);
                            if (apiDetails.phone) {
                                lead.phone = apiDetails.phone;
                                console.log(`[GeoLead DEBUG] Extracted phone from API: "${lead.phone}"`);
                            }
                            if (apiDetails.website) {
                                lead.website = apiDetails.website;
                                lead.websiteStatus = 'HAS_WEBSITE';
                                console.log(`[GeoLead DEBUG] Extracted website from API: "${lead.website}"`);
                            }
                            if (apiDetails.latitude) {
                                lead.latitude = apiDetails.latitude;
                                lead.longitude = apiDetails.longitude;
                            }
                            if (apiDetails.plusCode) lead.plusCode = apiDetails.plusCode;
                        }

                        // 2. Fallback to DOM parsing
                        if (!lead.website) {
                            const detailWeb = extractWebsiteFromDetailPanel();
                            if (detailWeb.website && !isGoogleOrMapsUrl(detailWeb.website)) {
                                lead.website = detailWeb.website;
                                lead.websiteStatus = 'HAS_WEBSITE';
                                console.log(`[GeoLead DEBUG] Extracted website from DOM: "${lead.website}"`);
                            } else {
                                lead.website = '';
                                lead.websiteStatus = 'NO_WEBSITE';
                                console.log(`[GeoLead DEBUG] No website found for: "${nextBusinessName}"`);
                            }
                        } else {
                            lead.websiteStatus = 'HAS_WEBSITE';
                        }

                        if (!lead.phone) {
                            let detailPhone = '';
                            for (let attempt = 0; attempt < 2 && !detailPhone; attempt++) {
                                detailPhone = extractPhoneFromDetailPanel(lead);
                                if (!detailPhone && detailScroll) {
                                    detailScroll.scrollBy({ top: 300, behavior: 'smooth' });
                                    await sleep(250);
                                }
                            }
                            if (detailPhone) {
                                lead.phone = detailPhone;
                                console.log(`[GeoLead DEBUG] Extracted phone from DOM: "${lead.phone}"`);
                            }
                        }

                        // Address, category, hours, and status
                        const detailAddress = extractAddressFromDetailPanel();
                        if (detailAddress) {
                            lead.address = detailAddress;
                            const addrComp = parseAddressComponents(detailAddress);
                            lead.city = addrComp.city;
                            lead.state = addrComp.state;
                            lead.country = addrComp.country;
                            lead.postalCode = addrComp.postalCode;
                            console.log(`[GeoLead DEBUG] Extracted address from DOM: "${lead.address}"`);
                        }

                        if (!lead.latitude) {
                            const latLng = extractLatLngFromUrl(lead.placeUrl);
                            if (latLng.lat) {
                                lead.latitude = latLng.lat;
                                lead.longitude = latLng.lng;
                            }
                        }

                        const servicesList = extractServicesFromDetailPanel();
                        if (servicesList.length > 0) {
                            lead.services = servicesList.join(', ');
                        }

                        const hoursAndStatus = extractHoursAndStatusFromDetailPanel();
                        lead.businessStatus = hoursAndStatus.businessStatus;
                        lead.openingHours = hoursAndStatus.openingHours;

                        const mapsSocials = extractSocialsFromDetailPanel();
                        Object.keys(mapsSocials).forEach(key => {
                            if (mapsSocials[key]) lead[key] = mapsSocials[key];
                        });

                        const detailEmail = extractEmailFromDetailPanel(lead);
                        if (detailEmail) {
                            lead.email = detailEmail;
                            lead.emails = [detailEmail];
                            console.log(`[GeoLead DEBUG] Extracted email from DOM: "${lead.email}"`);
                        }

                        // 3. Website contact crawl
                        if (lead.website && !isGoogleOrMapsUrl(lead.website)) {
                            console.log(`[GeoLead DEBUG] Triggering background website contact crawl for: "${lead.website}"...`);
                            try {
                                const result = await new Promise((resolve) => {
                                    chrome.runtime.sendMessage({
                                        type: 'SCRAPE_FETCH_CONTACTS',
                                        website: lead.website,
                                        businessName: lead.businessName
                                    }, (res) => {
                                        resolve(res || { emails: [], phones: [], socials: {}, websiteAnalysis: null });
                                    });
                                });

                                if (result.emails && result.emails.length > 0) {
                                    const currentEmails = lead.emails || (lead.email ? [lead.email] : []);
                                    const merged = Array.from(new Set([...currentEmails, ...result.emails]));
                                    lead.emails = merged;
                                    lead.email = merged[0];
                                    console.log(`[GeoLead DEBUG] Crawled emails: ${lead.emails.join(', ')}`);
                                }
                                if (result.phones && result.phones.length > 0 && !lead.phone) {
                                    const normalized = normalizePhoneNumber(result.phones[0]);
                                    if (normalized) {
                                        lead.phone = normalized;
                                        console.log(`[GeoLead DEBUG] Crawled phone: "${lead.phone}"`);
                                    }
                                }
                                if (result.socials) {
                                    Object.keys(result.socials).forEach(key => {
                                        if (result.socials[key] && !lead[key]) {
                                            lead[key] = result.socials[key];
                                        }
                                    });
                                }
                                if (result.websiteAnalysis) {
                                    lead.websiteAnalysis = result.websiteAnalysis;
                                }
                            } catch (e) {
                                console.warn('[GeoLead DEBUG] Background crawling failed:', e.message);
                            }
                        }

                        // Quality check and validate
                        const cleanedLead = qualityAssurance.cleanLeadData(lead);
                        if (cleanedLead) {
                            const scoring = scoringUtils.calculateLeadQualityScore(cleanedLead);
                            cleanedLead.leadQualityScore = scoring.score;
                            cleanedLead.priority = scoring.priority;
                            cleanedLead.recommendations = scoring.recommendations;

                            const validation = qualityAssurance.validateLead(cleanedLead);
                            cleanedLead.validationIssues = validation.issues;
                            cleanedLead.warnings = validation.warnings;

                            Object.assign(lead, cleanedLead);
                        }

                        success = true;
                    } catch (err) {
                        retryCount++;
                        console.warn(`[GeoLead DEBUG] Retry ${retryCount} failed for "${nextBusinessName}":`, err.message);
                        await sleep(500);
                    }
                }

                if (success && lead) {
                    // Prevent empty / duplicate / wrong data saving
                    if (lead.businessName && !duplicateDetection.isDuplicate(lead, scrapedLeads)) {
                        scrapedLeads.push(lead);
                        currentFound = scrapedLeads.length;
                        console.log(`[GeoLead DEBUG] Lead object successfully created:`, JSON.stringify(lead));

                        // Confirm session counters & storage write successfully before proceeding
                        try {
                            const saveResponse = await new Promise((resolve) => {
                                chrome.runtime.sendMessage({
                                    type: MSG.SCRAPE_RESULT,
                                    leads: [lead],
                                    sessionId: currentSessionId
                                }, (res) => {
                                    resolve(res || { success: false });
                                });
                            });

                            if (saveResponse && saveResponse.success) {
                                console.log(`[GeoLead DEBUG] Lead successfully written to storage: "${lead.businessName}"`);
                                if (saveResponse.state) {
                                    const session = saveResponse.state.sessions?.[currentSessionId];
                                    if (session) {
                                        console.log(`[GeoLead DEBUG] Session statistics updated: leadsCollected=${session.metadata?.leadsCollected}, businessesVisited=${session.metadata?.businessesVisited}`);
                                    }
                                }
                            } else {
                                console.error(`[GeoLead DEBUG] Storage write NOT confirmed by background for: "${lead.businessName}"`);
                            }
                        } catch (msgErr) {
                            console.error('[GeoLead DEBUG] Verification messaging error:', msgErr);
                        }
                    } else {
                        console.log(`[GeoLead DEBUG] Skipped duplicate lead: "${lead.businessName}"`);
                    }
                } else {
                    console.error(`[GeoLead DEBUG] Failed to scrape business "${nextBusinessName}" after 3 retries. Skipping.`);
                }

                // Send progress update to UI
                sendProgress(scrapedLeads.length, maxResults);
            }

            console.log('[GeoLead] Dynamic scraping loop finished.');
            const elapsedMs = Date.now() - scrapeStartTime;

            // Deduplicate final results
            const dedupedLeads = deduplicateLeads(scrapedLeads);
            const duplicatesRemoved = scrapedLeads.length - dedupedLeads.length;

            console.log(`[GeoLead] 📊 Final: ${dedupedLeads.length} unique leads saved.`);

            // Send result and done messages
            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_RESULT,
                leads: dedupedLeads,
                sessionId: currentSessionId
            });

            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_DONE,
                total: dedupedLeads.length,
                duplicatesRemoved,
                elapsedMs,
                stoppedByUser: shouldStop,
                sessionId: currentSessionId
            });

        } catch (error) {
            console.error('[GeoLead] Scraping execution error:', error);
            sendError(error.message || 'Scraping engine error occurred.');
        } finally {
            stopKeepAlive();
        }

        isRunning = false;
        shouldStop = false;
        currentFound = 0;
        currentTarget = 0;
    }

    // ====== PRODUCTION-GRADE DATA PROCESSING UTILITIES ======
    
    // Import validation and scoring utilities (inline for content script compatibility)
    const validationUtils = {
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
        }
    };
    
    // Lead scoring utilities
    const scoringUtils = {
        calculateLeadQualityScore: function(lead) {
            if (!lead) return { score: 0, breakdown: {}, recommendations: [], valid: false };
            
            let totalScore = 0;
            let maxPossibleScore = 0;
            const breakdown = {};
            const recommendations = [];
            
            // Phone scoring (15% weight)
            const phoneValidation = validationUtils.validatePhoneNumber(lead.phone);
            const phoneScore = phoneValidation.valid ? 0.8 : 0.2;
            breakdown.phone = { score: phoneScore, hasPhone: phoneValidation.valid };
            totalScore += phoneScore * 0.15;
            maxPossibleScore += 0.15;
            if (!phoneValidation.valid) recommendations.push('Add phone number to improve lead quality');
            
            // Email scoring (20% weight)
            const emailValidation = validationUtils.validateEmail(lead.email, lead.website);
            const emailScore = emailValidation.valid ? 0.9 : 0.1;
            breakdown.email = { score: emailScore, hasEmail: emailValidation.valid };
            totalScore += emailScore * 0.20;
            maxPossibleScore += 0.20;
            if (!emailValidation.valid) recommendations.push('Add email address to improve lead quality');
            
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
        }
    };
    
    // Advanced duplicate detection
    const duplicateDetection = {
        generateBusinessHash: function(lead) {
            if (!lead) return '';
            
            const name = (lead.businessName || '').toLowerCase().trim();
            const phone = (lead.phone || '').replace(/\D/g, '');
            const address = (lead.address || '').toLowerCase().trim();
            
            // Create hash based on available information
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
    
    // Rate limiting and anti-detection
    const rateLimiter = {
        requestCount: 0,
        lastRequestTime: 0,
        minDelay: 2000, // 2 seconds between requests
        maxRequestsPerMinute: 30,
        
        checkRateLimit: function() {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < this.minDelay) {
                const delay = this.minDelay - timeSinceLastRequest;
                console.log(`[RateLimiter] Rate limiting: waiting ${delay}ms`);
                return delay;
            }
            
            this.requestCount++;
            this.lastRequestTime = now;
            
            // Reset counter every minute
            if (this.requestCount >= this.maxRequestsPerMinute) {
                const nextMinute = 60000 - (now % 60000);
                console.log(`[RateLimiter] Rate limit reached: waiting ${nextMinute}ms`);
                this.requestCount = 0;
                return nextMinute;
            }
            
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
    
    // Regional handling for Pakistan
    const regionalHandler = {
        pakistanSpecific: {
            phonePatterns: [
                /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/, // Mobile
                /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/ // Landline
            ],
            
            addressKeywords: [
                'road', 'street', 'avenue', 'boulevard', 'lane', 'sector',
                'block', 'plot', 'house', 'flat', 'apartment', 'floor',
                'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad',
                'multan', 'hyderabad', 'peshawar', 'quetta', 'sialkot',
                'gujranwala', 'sargodha', 'sheikhupura', 'sukkur', 'jhang'
            ],
            
            normalizePakistanAddress: function(address) {
                if (!address) return '';
                
                let normalized = address.toLowerCase().trim();
                
                // Remove extra whitespace
                normalized = normalized.replace(/\s+/g, ' ');
                
                // Standardize common address terms
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
                
                // Capitalize properly
                normalized = normalized.replace(/\b\w/g, l => l.toUpperCase());
                
                return normalized;
            }
        },
        
        detectRegion: function(address, phone) {
            let region = 'Unknown';
            
            // Check for Pakistan-specific patterns
            if (phone) {
                for (const pattern of this.pakistanSpecific.phonePatterns) {
                    if (pattern.test(phone)) {
                        region = 'Pakistan';
                        break;
                    }
                }
            }
            
            if (address) {
                const lowerAddress = address.toLowerCase();
                const pakistanKeywords = this.pakistanSpecific.addressKeywords.filter(keyword => 
                    lowerAddress.includes(keyword.toLowerCase())
                );
                
                if (pakistanKeywords.length > 0) {
                    region = 'Pakistan';
                }
            }
            
            return region;
        }
    };
    
    // Quality assurance
    const qualityAssurance = {
        validateLead: function(lead) {
            const issues = [];
            const warnings = [];
            
            // Check required fields
            if (!lead.businessName || lead.businessName.length < 2) {
                issues.push('Missing or invalid business name');
            }
            
            if (!lead.category || lead.category.length < 2) {
                warnings.push('Missing business category');
            }
            
            if (!lead.address || lead.address.length < 5) {
                warnings.push('Missing or incomplete address');
            }
            
            // Validate contact information
            if (lead.phone) {
                const phoneValidation = validationUtils.validatePhoneNumber(lead.phone);
                if (!phoneValidation.valid) {
                    issues.push('Invalid phone number format');
                }
            }
            
            if (lead.email) {
                const emailValidation = validationUtils.validateEmail(lead.email, lead.website);
                if (!emailValidation.valid) {
                    issues.push('Invalid email address format');
                }
            }
            
            // Validate website
            if (lead.website) {
                if (lead.website.includes('google.com/maps') || lead.website.includes('maps.google.com')) {
                    issues.push('Google Maps URL detected as website');
                }
            }
            
            // Check data consistency
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
                const phoneValidation = validationUtils.validatePhoneNumber(cleaned.phone);
                if (phoneValidation.valid) {
                    cleaned.phone = phoneValidation.normalized;
                }
            }
            
            // Normalize email
            if (cleaned.email) {
                const emailValidation = validationUtils.validateEmail(cleaned.email, cleaned.website);
                if (emailValidation.valid) {
                    cleaned.email = emailValidation.normalized;
                }
            }
            
            // Detect region
            cleaned.region = regionalHandler.detectRegion(cleaned.address, cleaned.phone);
            
            // Calculate quality score
            const qualityValidation = this.validateLead(cleaned);
            cleaned.qualityScore = qualityValidation.qualityScore;
            
            return cleaned;
        }
    };
    
    // ====== DOM PARSER (inline for content script compatibility) ======

    const CARD_SELECTORS = [
        'a[href*="/maps/place/"]',
        'a.hfpxzc',
        'div.Nv2PK',
        'div[jsaction*="mouseover"].lI9IFe',
        'div[role="article"]',
    ];

    const NAME_SELECTORS = [
        'a.hfpxzc',
        '.fontHeadlineSmall',
        '.qBF1Pd.fontHeadlineSmall',
        'div.qBF1Pd',
        '[aria-label]',
    ];

    const RATING_SELECTORS = [
        'span.MW4etd',
        'span.ZkP5Je',
        'span[role="img"]',
    ];

    const REVIEW_SELECTORS = [
        'span.UY7F9',
        'span.e4rVHe.fontBodyMedium',
    ];

    function getCardContainerFromLink(a) {
        if (!a) return null;
        const feed = document.querySelector('div[role="feed"]');
        if (!feed) {
            return a.closest('div[role="article"]') || a.closest('div.Nv2PK') || a.parentElement?.parentElement?.parentElement || a.parentElement;
        }
        
        let parent = a;
        while (parent && parent !== document.body) {
            if (parent.parentElement === feed) {
                return parent;
            }
            parent = parent.parentElement;
        }
        
        return a.closest('div[role="article"]') || a.closest('div.Nv2PK') || a.parentElement;
    }

    /**
     * Parse all visible business cards with production-grade processing
     */
    async function parseResults() {
        const leads = [];
        const seen = new Set();
        const cards = findBusinessCards();

        for (const card of cards) {
            try {
                const lead = extractLeadFromCard(card);
                if (lead && lead.businessName) {
                    // Apply quality assurance
                    const cleanedLead = qualityAssurance.cleanLeadData(lead);
                    
                    // Check for duplicates using advanced detection
                    if (!duplicateDetection.isDuplicate(cleanedLead, leads)) {
                        // Calculate lead quality score
                        const scoring = scoringUtils.calculateLeadQualityScore(cleanedLead);
                        cleanedLead.leadQualityScore = scoring.score;
                        cleanedLead.priority = scoring.priority;
                        cleanedLead.recommendations = scoring.recommendations;
                        
                        leads.push(cleanedLead);
                        seen.add(duplicateDetection.generateBusinessHash(cleanedLead));
                    }
                }
            } catch (e) {
                console.warn('[GeoLead] Error parsing card:', e.message);
            }
        }

        return leads;
    }

    /**
     * Find business result cards
     */
    function findBusinessCards() {
        for (const selector of CARD_SELECTORS) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                if (cards[0].tagName === 'A' || selector.startsWith('a')) {
                    return Array.from(cards)
                        .map(a => getCardContainerFromLink(a))
                        .filter(Boolean);
                }
                return Array.from(cards);
            }
        }
        return [];
    }

    /**
     * Count visible business cards
     */
    function countVisibleCards() {
        return findBusinessCards().length;
    }

    /**
     * Extract data from a single card with enhanced processing
     */
    function extractLeadFromCard(card) {
        if (!card) return null;

        const businessName = extractBusinessName(card);
        if (!businessName) return null;

        const placeUrl = extractPlaceUrl(card);
        const { rating, reviewCount } = extractRatingInfo(card);
        const category = extractCategory(card);
        const address = extractAddress(card);
        const phone = extractPhone(card);
        const { website, websiteStatus } = extractWebsite(card);

        const latLng = extractLatLngFromUrl(placeUrl);
        const addrComp = parseAddressComponents(address);

        // Extract additional information with enhanced parsing
        const socialLinks = extractSocialLinks(card);
        const services = extractServices(card);
        const openingHours = extractOpeningHours(card);

        return {
            id: generateId(),
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
            instagram: socialLinks.instagram,
            facebook: socialLinks.facebook,
            linkedin: socialLinks.linkedin,
            twitter: socialLinks.twitter,
            youtube: socialLinks.youtube,
            tiktok: socialLinks.tiktok,
            pinterest: socialLinks.pinterest,
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

    /**
     * Extract social media links from card
     */
    function extractSocialLinks(card) {
        const socialLinks = {
            instagram: null,
            facebook: null,
            linkedin: null,
            twitter: null,
            youtube: null,
            tiktok: null,
            pinterest: null
        };

        // Look for social media links in the card
        const linkElements = card.querySelectorAll('a[href]');
        linkElements.forEach(link => {
            const href = link.href.toLowerCase();
            const text = link.textContent.toLowerCase();

            // Instagram
            if (href.includes('instagram.com') || text.includes('instagram')) {
                socialLinks.instagram = href;
            }
            // Facebook
            else if (href.includes('facebook.com') || text.includes('facebook')) {
                socialLinks.facebook = href;
            }
            // LinkedIn
            else if (href.includes('linkedin.com') || text.includes('linkedin')) {
                socialLinks.linkedin = href;
            }
            // Twitter/X
            else if (href.includes('twitter.com') || href.includes('x.com') || text.includes('twitter') || text.includes('x')) {
                socialLinks.twitter = href;
            }
            // YouTube
            else if (href.includes('youtube.com') || text.includes('youtube')) {
                socialLinks.youtube = href;
            }
            // TikTok
            else if (href.includes('tiktok.com') || text.includes('tiktok')) {
                socialLinks.tiktok = href;
            }
            // Pinterest
            else if (href.includes('pinterest.com') || text.includes('pinterest')) {
                socialLinks.pinterest = href;
            }
        });

        return socialLinks;
    }

    /**
     * Extract services offered by the business
     */
    function extractServices(card) {
        const services = [];
        
        // Look for service indicators in the card
        const serviceElements = card.querySelectorAll('[aria-label*="service"], [data-tooltip*="service"], .service, .feature');
        serviceElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && text.length > 2 && !services.includes(text)) {
                services.push(text);
            }
        });

        // Look for specific service keywords in the card text
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

    /**
     * Extract opening hours
     */
    function extractOpeningHours(card) {
        const hoursElements = card.querySelectorAll('[aria-label*="hours"], .hours, .time, [data-tooltip*="hours"]');
        
        for (const element of hoursElements) {
            const text = element.textContent.trim();
            if (text && text.length > 5) {
                // Clean up the hours text
                const cleaned = text
                    .replace(/\s*·\s*/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Check for common hour indicators
                if (cleaned.includes('am') || cleaned.includes('pm') || 
                    cleaned.includes('open') || cleaned.includes('closed')) {
                    return cleaned;
                }
            }
        }

        return '';
    }

    function extractBusinessName(card) {
        // Heuristic: The most reliable source is the aria-label of the main wrapper link
        const mainLink = card.querySelector('a[href*="/maps/place/"]') || card.querySelector('a.hfpxzc') || card.querySelector('a');
        if (mainLink) {
            const label = mainLink.getAttribute('aria-label');
            if (label && label.trim().length > 0) return cleanBusinessName(label.trim());
        }
        
        // Fallback: the first large headline text
        const el = card.querySelector('.fontHeadlineSmall, div.qBF1Pd, h1, h2, h3');
        if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) return cleanBusinessName(text);
        }
        
        return '';
    }

    /**
     * Clean business name by removing Google Maps suffixes like '· Visited link'
     */
    function cleanBusinessName(name) {
        return name
            .replace(/\s*·\s*Visited\s*link\s*/gi, '')
            .replace(/\s*·\s*Visited\s*/gi, '')
            .replace(/\s*·\s*New\s*/gi, '')
            .trim();
    }

    function extractPlaceUrl(card) {
        const linkEl = card.querySelector('a[href*="/maps/place/"]') || card.querySelector('a.hfpxzc') || card.querySelector('a[href*="maps"]');
        return linkEl?.href || '';
    }

    function extractRatingInfo(card) {
        let rating = null;
        let reviewCount = null;

        // Heuristic 1: Look for aria-labels explicitly mentioning stars and reviews
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

        // Heuristic 2: Fallback to raw text parsing from the entire card
        if (rating === null || reviewCount === null) {
            const text = card.textContent || '';
            const rMatch = text.match(/\b([1-4]\.\d|5\.0)\b/);
            if (rMatch && rating === null) rating = parseFloat(rMatch[1]);
            
            const revMatch = text.match(/\(([\d,]+)\)/);
            if (revMatch && reviewCount === null) reviewCount = parseInt(revMatch[1].replace(/,/g, ''), 10);
        }

        return { rating, reviewCount };
    }

    function extractCategory(card) {
        const text = card.textContent || '';
        
        // Category usually appears right after the rating and review count, separated by a dot.
        // E.g. "4.5 (100) · Dentist · 123 Main St"
        const parts = text.split('·').map(p => p.trim());
        
        for (let i = 1; i < parts.length; i++) {
            const p = parts[i];
            
            // A category is typically a short string of letters (no numbers, very few punctuation marks)
            // It shouldn't be "Open 24 hours" or distances like "5.2 mi"
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

        // Fallback: look at common small spans
        const spans = card.querySelectorAll('.fontBodyMedium span, .W4Efsd span, div.W4Pne span');
        for (const el of spans) {
             const t = (el.textContent || '').trim();
             if (t && t.length > 2 && t.length < 40 && !t.match(/\d/) && !t.includes('·') && !t.includes('(')) {
                 return t;
             }
        }
        return '';
    }

    function extractAddress(card) {
        // Detailed View Primary: Specific address button
        const addrBtn = card.querySelector('button[data-item-id="address"]');
        if (addrBtn) {
            const ariaLabel = addrBtn.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.startsWith('Address:')) {
                return ariaLabel.replace('Address:', '').replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
            }
            const textNode = addrBtn.querySelector('.Io6YTe');
            if (textNode) return textNode.textContent.replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
        }

        // List View: Address is the span AFTER a dot separator (·) in .W4Efsd rows  
        // Structure: <div.W4Efsd><div.W4Efsd>
        //   <span><span>Category</span></span>
        //   <span> <span>·</span> <span>Address Text</span></span>
        // </div></div>
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
                        let text = sib.textContent.trim();
                        text = text.replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
                        if (text && text !== '·' && !sib.getAttribute('aria-hidden') && !sib.classList.contains('google-symbols')) {
                            return text;
                        }
                    }
                }
            }
        }
        return '';
    }

    function extractPhone(card) {
        const phoneNumbers = new Set();
        
        // Method 1: Detailed View direct button lookup (always safest if available)
        const phoneBtn = card.querySelector('button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
            const ariaLabel = phoneBtn.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.startsWith('Phone:')) {
                const rawPhone = ariaLabel.replace('Phone:', '').trim();
                if (rawPhone) {
                    const cleaned = normalizePhoneNumber(rawPhone);
                    if (cleaned) phoneNumbers.add(cleaned);
                }
            }
            const extracted = phoneBtn.getAttribute('data-item-id').replace('phone:tel:', '');
            if (extracted) {
                const cleaned = normalizePhoneNumber(extracted);
                if (cleaned) phoneNumbers.add(cleaned);
            }
            const textNode = phoneBtn.querySelector('.Io6YTe');
            if (textNode) {
                const cleaned = normalizePhoneNumber(textNode.textContent.trim());
                if (cleaned) phoneNumbers.add(cleaned);
            }
        }

        // Method 2: List View phone class
        const phoneEl = card.querySelector('.UsdlK');
        if (phoneEl && phoneEl.textContent) {
            const cleaned = normalizePhoneNumber(phoneEl.textContent.trim());
            if (cleaned) phoneNumbers.add(cleaned);
        }

        // Method 3: Check .W4Efsd info rows with improved patterns
        const infoRows = card.querySelectorAll('.W4Efsd > .W4Efsd');
        const phonePatterns = [
            // Pakistan mobile (03XX-XXXXXXX or +92-3XX-XXXXXXX)
            /(?:\+92\s?|0)?3[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/,
            // Pakistan landline (0XXX-XXXXXXX or +92-XXX-XXXXXXX)
            /(?:\+92\s?|0)[2-9][0-9]{2}[\s.-]?[0-9]{7,8}/,
            // International format
            /\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
            // US/Canada format
            /\(\d{3}\)\s?\d{3}[-.]?\d{4}/,
            // Generic format with spaces/dots
            /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/,
            // Generic format with parentheses
            /\(\d{3}\)\s*\d{3}[-.]?\d{4}/
        ];

        for (const row of infoRows) {
            if (row.querySelector('.ZkP5Je') || row.querySelector('.AJB7ye') || row.querySelector('.ah5Ghc')) continue;

            const spans = row.querySelectorAll('span');
            for (const span of spans) {
                const text = (span.textContent || '').trim();
                
                for (const pattern of phonePatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        const phone = match[0].trim();
                        const cleaned = normalizePhoneNumber(phone);
                        if (cleaned) phoneNumbers.add(cleaned);
                    }
                }
            }
        }

        // Return the first unique phone number found
        const uniquePhones = Array.from(phoneNumbers);
        return uniquePhones.length > 0 ? uniquePhones[0] : '';
    }

    /**
     * Normalize phone number to standard format and remove duplicates
     */
    function normalizePhoneNumber(phone) {
        if (!phone) return '';
        
        // Remove any character that is not a digit, plus, minus, space, or parenthesis
        let cleaned = phone.replace(/[^\d+\-()\s]/g, '').trim();
        
        // Count digits to validate the number is a valid phone length
        const digits = cleaned.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) return '';
        
        return cleaned;
    }

    function extractWebsite(card) {
        let bestWebsite = null;
        let bestScore = 0;
        let debugInfo = [];

        // Use aria-label or data-tooltip detection to find website links
        const links = card.querySelectorAll('a[href]');
        for (const link of links) {
            let href = link.href;
            const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
            const dataTooltip = (link.getAttribute('data-tooltip') || '').toLowerCase();
            const text = link.textContent.trim();
            
            const extracted = getExtractedWebsiteFromGoogleRedirect(href);
            if (extracted) {
                href = extracted;
            }

            // Debug logging
            debugInfo.push({
                href,
                text,
                ariaLabel,
                dataTooltip,
                isGoogle: isGoogleOrMapsUrl(href)
            });

            // Skip invalid or Google-related links
            if (!href || !href.startsWith('http') || isGoogleOrMapsUrl(href)) {
                continue;
            }

            // Score this link
            const score = scoreWebsiteLink(href, text, ariaLabel, dataTooltip);
            
            // Debug logging
            debugInfo[debugInfo.length - 1].score = score;

            if (score > bestScore && isValidBusinessUrl(href)) {
                bestScore = score;
                bestWebsite = href;
            }
        }

        // Strategy 2: Look for authority data-item-id (most reliable)
        if (!bestWebsite || bestScore < 5) {
            const webBtn = card.querySelector('a[data-item-id="authority"]');
            if (webBtn && webBtn.href) {
                let href = webBtn.href;
                const extracted = getExtractedWebsiteFromGoogleRedirect(href);
                if (extracted) {
                    href = extracted;
                }
                
                if (isValidBusinessUrl(href)) {
                    bestWebsite = href;
                    bestScore = 20; // High confidence for authority buttons
                }
            }
        }

        // Strategy 3: Look for specific website button classes as fallback
        if (!bestWebsite || bestScore < 3) {
            const websiteBtns = card.querySelectorAll('a.W4Efsd, a.ynlRMe, a.CblTFb, a.whsOnd');
            for (const btn of websiteBtns) {
                if (btn.href) {
                    let href = btn.href;
                    const extracted = getExtractedWebsiteFromGoogleRedirect(href);
                    if (extracted) {
                        href = extracted;
                    }
                    if (isValidBusinessUrl(href)) {
                        bestWebsite = href;
                        bestScore = 8; // Medium confidence for button classes
                        break;
                    }
                }
            }
        }

        // Debug logging
        if (debugInfo.length > 0) {
            console.log('[GeoLead] Website extraction debug:', {
                bestWebsite,
                bestScore,
                debugInfo: debugInfo.slice(0, 3) // Log first 3 for brevity
            });
        }

        let websiteStatus = 'NO_WEBSITE';
        if (bestWebsite) {
            websiteStatus = (bestWebsite.startsWith('http://') && !bestWebsite.startsWith('https://'))
                ? 'NEEDS_REVAMP' : 'HAS_WEBSITE';
        }
        return { website: bestWebsite, websiteStatus };
    }

    // ====== DETAIL PANEL HELPERS ======

    /**
     * CRITICAL: Wait until the detail panel's H1 title matches the expected business name.
     * This prevents reading stale data from the previously opened business panel.
     * @param {string} expectedName - The business name we expect to see
     * @param {number} timeoutMs - Max ms to wait
     * @returns {Promise<boolean>} true if correct panel loaded
     */
    async function waitForCorrectDetailPanel(expectedName, timeoutMs = 6000) {
        const start = Date.now();
        const POLL_INTERVAL = 200; // Faster polling for better responsiveness
        const normalizedExpected = normalizeForCompare(expectedName);
        let lastPanelName = '';
        let stabilityCount = 0;

        while (Date.now() - start < timeoutMs) {
            const titleEl = document.querySelector('h1.DUwDvf, h2.DUwDvf, h1.fontHeadlineLarge, div.tAiQdd h1, div.lMbq3e h1');
            if (titleEl) {
                const panelName = normalizeForCompare(titleEl.textContent || '');
                
                // Check if panel name has stabilized (not changing rapidly)
                if (panelName === lastPanelName) {
                    stabilityCount++;
                    if (stabilityCount >= 2) {
                        // Panel has stabilized, now check if it matches expected name
                        console.log(`[GeoLead] Panel stabilized as: "${panelName}"`);
                        
                        // Enhanced matching strategies
                        if (panelName === normalizedExpected) { 
                            console.log(`[GeoLead] ✅ Perfect match found`);
                            return true; 
                        }
                        if (normalizedExpected.includes(panelName) && panelName.length > 3) { 
                            console.log(`[GeoLead] ✅ Expected includes panel name`);
                            return true; 
                        }
                        if (panelName.includes(normalizedExpected) && normalizedExpected.length > 3) { 
                            console.log(`[GeoLead] ✅ Panel name includes expected`);
                            return true; 
                        }
                        // First N chars match (handles truncation)
                        const minLen = Math.min(panelName.length, normalizedExpected.length, 15);
                        if (minLen > 5 && panelName.substring(0, minLen) === normalizedExpected.substring(0, minLen)) { 
                            console.log(`[GeoLead] ✅ First ${minLen} characters match`);
                            return true; 
                        }
                        // Word overlap: if 2+ words match
                        const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 2);
                        const panelWords = panelName.split(/\s+/).filter(w => w.length > 2);
                        const overlap = expectedWords.filter(w => panelWords.includes(w));
                        if (overlap.length >= 2) { 
                            console.log(`[GeoLead] ✅ ${overlap.length} words overlap: ${overlap.join(', ')}`);
                            return true; 
                        }
                        
                        // If we get here, the panel is stable but doesn't match
                        console.log(`[GeoLead] ❌ Panel stabilized but doesn't match. Expected: "${normalizedExpected}", Got: "${panelName}"`);
                        return false;
                    }
                } else {
                    // Panel name changed, reset stability counter
                    lastPanelName = panelName;
                    stabilityCount = 0;
                    console.log(`[GeoLead] Panel changed to: "${panelName}"`);
                }
            }
            await sleep(POLL_INTERVAL);
        }

        console.log(`[GeoLead] ⏰ Timeout waiting for panel: "${expectedName}". Last check: "${lastPanelName}"`);
        return false; // Return false to indicate timeout, let caller decide
    }

    /**
     * Normalize text for comparison — strips accents, lowercases, removes special chars
     */
    function normalizeForCompare(str) {
        return str
            .trim()
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents (é → e)
            .replace(/[^a-z0-9\s]/g, '')  // remove special chars
            .replace(/\s+/g, ' ')          // collapse spaces
            .trim();
    }

    /**
     * Navigate back to the list view from detail panel
     */
    async function goBackToList() {
        // Try multiple back button selectors
        const backBtn = document.querySelector(
            'button[aria-label="Back"], button[aria-label="back"], button[jsaction*="back"], button.hYBOP, button[aria-label="Close"], button[aria-label="close"]'
        );
        
        if (backBtn) {
            console.log('[GeoLead] 🔄 Using back button to return to list');
            backBtn.click();
            await sleep(800); // Increased wait time for navigation
        } else {
            console.log('[GeoLead] 🔄 Using history.back() to return to list');
            history.back();
            await sleep(1000); // Increased wait time for navigation
        }
        
        // Wait for list to re-appear with more robust checking
        const listBack = await waitForListView(3000);
        if (!listBack) {
            console.log('[GeoLead] ⚠️ List view not detected, trying alternative back navigation');
            // Another fallback
            history.back();
            await sleep(800);
            
            // Final check
            const finalListCheck = await waitForListView(2000);
            if (!finalListCheck) {
                console.log('[GeoLead] ⚠️ Warning: May not have properly returned to list view');
            }
        }
        
        // Small delay to ensure list view is fully loaded
        await sleep(300);
    }

    /**
     * Wait for the list view to re-appear after going back
     */
    async function waitForListView(timeoutMs = 2500) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (findBusinessCards().length > 0) return true;
            await sleep(200);
        }
        return false;
    }

    // ====== DOM VISIBILITY HELPERS ======

    function getVisibleElement(container, selector, excludeList = true) {
        const elements = container.querySelectorAll(selector);
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (excludeList && el.closest('.Nv2PK, div[role="feed"], div[aria-label^="Results for"]')) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') return el;
            }
        }
        return null;
    }

    function getVisibleElements(container, selector, excludeList = true) {
        const elements = container.querySelectorAll(selector);
        const result = [];
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (excludeList && el.closest('.Nv2PK, div[role="feed"], div[aria-label^="Results for"]')) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') result.push(el);
            }
        }
        return result;
    }

    // ====== DETAIL PANEL EXTRACTORS ======

    /**
     * Enhanced international phone number patterns for global coverage
     */
    const INTERNATIONAL_PHONE_PATTERNS = [
        // Generic pattern with parentheses in country code or area code
        /\(?\+?\d{1,4}\)?[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/,
        // Pakistan mobile (03XX-XXXXXXX or +92-3XX-XXXXXXX or (03XX) XXXXXXX)
        /(?:\+92\s?|0)?\(?3[0-9]{2}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/,
        // Pakistan landline (0XXX-XXXXXXX or +92-XXX-XXXXXXX or (0XXX) XXXXXXX)
        /(?:\+92\s?|0)?\(?[2-9][0-9]{2}\)?[\s.-]?[0-9]{7,8}/,
        // US/Canada format
        /\(\d{3}\)\s?\d{3}[-.]?\d{4}/,
        // US/Canada format without parentheses
        /\d{3}[-.]?\d{3}[-.]?\d{4}/,
        // UK format
        /\(?\+44\s?\)?\s?\d{3,4}\s?\d{3}\s?\d{3}/,
        // UK format without country code
        /\(?\d{3,4}\s?\d{3}\s?\d{3}/,
        // EU formats
        /\+\d{1,3}\s?\d{3}\s?\d{3}\s?\d{3,4}/,
        // International format with spaces
        /\+\d{1,3}\s\d{3}\s\d{3}\s\d{4}/,
        // International format with dots
        /\+\d{1,3}\.\d{3}\.\d{3}\.\d{4}/,
        // Generic international format
        /\+\d{1,3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
        // Generic format with 7-15 digits
        /\b\d{7,15}\b/,
        // Extension format
        /\d{3,4}\s*ext\s*\d{3,4}/i,
        // With extension
        /\d{3}[-\s]?\d{3}[-\s]?\d{4}\s*(?:ext|x|extension)\s*\d{3,4}/i
    ];

    /**
     * Validate phone number context to ensure it belongs to the current business
     */
    function validatePhoneNumberContext(phone, businessName, container) {
        if (!phone) return false;
        // Since we are scraping the detail panel of the active business,
        // we can trust that any phone number found within it belongs to the business.
        return true;
    }

    /**
     * Validate that extracted data belongs to the current business
     */
    function validateDataBelongsToBusiness(extractedData, businessName, dataType) {
        if (!extractedData || !businessName) return false;
        
        const businessNameLower = businessName.toLowerCase();
        const dataLower = extractedData.toLowerCase();
        
        // For phone numbers - just validate format and context
        if (dataType === 'phone') {
            // Phone number validation is handled in validatePhoneNumberContext
            return true;
        }
        
        // For emails - check domain relevance
        if (dataType === 'email') {
            if (!dataLower.includes('@')) return false;
            
            // Check if email domain matches business website domain
            if (lead.website) {
                const websiteDomain = lead.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
                const emailDomain = extractedData.split('@')[1].toLowerCase();
                
                if (emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain)) {
                    return true;
                }
            }
            
            // Check if email contains business name parts
            const businessParts = businessNameLower.split(/\s+/).filter(w => w.length > 2);
            const businessInEmail = businessParts.some(part => dataLower.includes(part));
            
            return businessInEmail;
        }
        
        // For websites - check if it's not a Google/Maps URL
        if (dataType === 'website') {
            return !isGoogleOrMapsUrl(extractedData);
        }
        
        return true;
    }

    /**
      * Extract phone from the business detail panel (after clicking a card)
      * Uses multiple methods scoped to the visibly active detail panel
      */
    function extractPhoneFromDetailPanel(lead) {
        const container = getDetailPanelContainer();
        const foundPhones = new Set();

        // METHOD 1: data-item-id="phone:tel:..." (Most reliable attribute check)
        const phoneBtn = getVisibleElement(container, 'button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
            const ariaLabel = phoneBtn.getAttribute('aria-label');
            if (ariaLabel) {
                const cleaned = ariaLabel.replace(/^Phone:\s*/i, '').trim();
                const normalized = normalizePhoneNumber(cleaned);
                if (normalized) foundPhones.add(normalized);
            }
            const dataId = (phoneBtn.getAttribute('data-item-id') || '').replace('phone:tel:', '').trim();
            const normalized = normalizePhoneNumber(dataId);
            if (normalized) foundPhones.add(normalized);
            const textNode = phoneBtn.querySelector('.Io6YTe');
            if (textNode) {
                const t = textNode.textContent.trim();
                const normalized = normalizePhoneNumber(t);
                if (normalized) foundPhones.add(normalized);
            }
        }

        // METHOD 2: button with aria-label starting with "Phone:"
        const phoneBtnByLabel = getVisibleElement(container, 'button[aria-label^="Phone:"], button[aria-label^="phone:"]');
        if (phoneBtnByLabel) {
            const ariaLabel = phoneBtnByLabel.getAttribute('aria-label') || '';
            const cleaned = ariaLabel.replace(/^Phone:\s*/i, '').trim();
            if (cleaned && cleaned.replace(/\D/g, '').length >= 7) {
                const normalized = normalizePhoneNumber(cleaned);
                if (normalized) foundPhones.add(normalized);
            }
            const innerText = phoneBtnByLabel.querySelector('.Io6YTe');
            if (innerText) {
                const t = innerText.textContent.trim();
                const normalized = normalizePhoneNumber(t);
                if (normalized) foundPhones.add(normalized);
            }
        }

        // METHOD 3: button.CsEnBe with phone in aria-label
        const csButtons = getVisibleElements(container, 'button.CsEnBe');
        for (const btn of csButtons) {
            const label = (btn.getAttribute('aria-label') || '');
            if (/phone|call|tel/i.test(label)) {
                const cleaned = label.replace(/^(Phone|Call|Tel):\s*/i, '').trim();
                const normalized = normalizePhoneNumber(cleaned);
                if (normalized) foundPhones.add(normalized);
            }
        }

        // METHOD 4: Scan ALL .Io6YTe elements safely with enhanced international patterns
        const allInfoTexts = getVisibleElements(container, '.Io6YTe');
        for (const el of allInfoTexts) {
            const text = (el.textContent || '').trim();
            if (!text || text.length < 7 || text.length > 25) continue;
            if (text.includes('www.') || text.includes('http') || text.includes('@')) continue;
            
            for (const pattern of INTERNATIONAL_PHONE_PATTERNS) {
                const match = text.match(pattern);
                if (match) {
                    const phone = match[0].trim();
                    const normalized = normalizePhoneNumber(phone);
                    if (normalized && validatePhoneNumberContext(normalized, lead.businessName, container)) {
                        foundPhones.add(normalized);
                    }
                }
            }
        }


        // METHOD 5: Scan ALL aria-labels for phone info with enhanced validation
        const allBtns = getVisibleElements(container, 'button[aria-label], a[aria-label]');
        for (const btn of allBtns) {
            const label = (btn.getAttribute('aria-label') || '');
            if (/phone|call|dial|tel/i.test(label)) {
                const match = label.match(/(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}(?:[\s.-]*\d{2,4})?/) || label.match(/\d{8,15}/);
                if (match) {
                    const normalized = normalizePhoneNumber(match[0]);
                    if (normalized && validatePhoneNumberContext(normalized, lead.businessName, container)) {
                        foundPhones.add(normalized);
                    }
                }
            }
        }

        // METHOD 6: Additional validation - prefer phone numbers that appear in contact sections
        const contactSections = getVisibleElements(container, 'button[aria-label*="phone"], button[aria-label*="call"], button[aria-label*="tel"]');
        for (const section of contactSections) {
            const sectionText = section.textContent || '';
            for (const pattern of INTERNATIONAL_PHONE_PATTERNS) {
                const match = sectionText.match(pattern);
                if (match) {
                    const phone = match[0].trim();
                    const normalized = normalizePhoneNumber(phone);
                    if (normalized && validatePhoneNumberContext(normalized, lead.businessName, container)) {
                        foundPhones.add(normalized);
                    }
                }
            }
        }

        // Return the first unique phone number found
        const uniquePhones = Array.from(foundPhones);
        console.log(`[GeoLead] Phone extraction found: ${uniquePhones.length} unique numbers`);
        return uniquePhones.length > 0 ? uniquePhones[0] : '';
    }

    /**
     * Score email based on relevance to business domain
     */
    function scoreEmailRelevance(email, businessWebsite) {
        if (!email || !businessWebsite) return 0;
        
        const emailDomain = email.split('@')[1].toLowerCase();
        const websiteDomain = businessWebsite.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        
        // Perfect match - email domain matches website domain
        if (emailDomain === websiteDomain) return 10;
        
        // Website subdomain match (e.g., email@subdomain.business.com)
        if (emailDomain.endsWith('.' + websiteDomain)) return 8;
        
        // Partial match (e.g., business.com vs email@business.com)
        if (websiteDomain.includes(emailDomain) || emailDomain.includes(websiteDomain.replace('www.', ''))) return 6;
        
        // Common business email patterns
        const businessPatterns = ['info', 'contact', 'sales', 'support', 'hello', 'admin', 'office'];
        if (businessPatterns.some(pattern => email.startsWith(pattern + '@'))) return 4;
        
        return 1; // Default low score
    }

    /**
     * Extract email from the business detail panel
     */
    function extractEmailFromDetailPanel(lead) {
        const container = getDetailPanelContainer();
        const foundEmails = new Map(); // Use Map to store emails with their scores

        console.log('[GeoLead] Starting email extraction from detail panel...');

        // Get the business website for domain validation
        const businessWebsite = lead.website || '';
        console.log(`[GeoLead] Business website for validation: ${businessWebsite}`);

        // Method 1: Check all mailto links with scoring
        const mailtoLinks = getVisibleElements(container, 'a[href^="mailto:"]');
        console.log(`[GeoLead] Found ${mailtoLinks.length} mailto links`);
        for (const link of mailtoLinks) {
            const email = link.href.replace('mailto:', '').split('?')[0].trim();
            if (email && email.includes('@')) {
                const normalized = normalizeEmail(email);
                if (normalized) {
                    const score = scoreEmailRelevance(normalized, businessWebsite);
                    foundEmails.set(normalized, score);
                    console.log(`[GeoLead] Email found via mailto: ${normalized} (score: ${score})`);
                }
            }
        }

        // Method 2: Enhanced email patterns for better detection
        const emailPatterns = [
            // Standard email format
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            // Email with common TLDs
            /[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|icloud)\.[a-zA-Z]{2,}/,
            // Business email patterns
            /info[@][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            /contact[@][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            /sales[@][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            /support[@][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            // Email with brackets or quotes
            /["\']?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}["\']?/
        ];

        // Method 3: Scan more element types for email patterns
        const allTextEls = getVisibleElements(container, '.Io6YTe, .rogA2c, .CsEnBe, .AeaXub, .whsOnd, .zHQkBf, .OSrXXb, .rllt__');
        console.log(`[GeoLead] Scanning ${allTextEls.length} text elements for emails`);
        for (const el of allTextEls) {
            const text = (el.textContent || '').trim();
            
            // Skip if text looks like a phone number or URL
            if (text.includes('@') && text.length < 100) {
                for (const pattern of emailPatterns) {
                    const matches = text.match(pattern);
                    if (matches) {
                        for (const match of matches) {
                            const normalized = normalizeEmail(match);
                            if (normalized) {
                                const score = scoreEmailRelevance(normalized, businessWebsite);
                                foundEmails.set(normalized, score);
                                console.log(`[GeoLead] Email found via text scan: ${normalized} (score: ${score})`);
                            }
                        }
                    }
                }
            }
        }

        // Method 4: Check for email in aria-labels and data attributes
        const allElementsWithLabels = getVisibleElements(container, '[aria-label], [data-tooltip], [title]');
        for (const el of allElementsWithLabels) {
            const label = (el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title') || '').toLowerCase();
            if (label.includes('email') || label.includes('contact') || label.includes('info')) {
                const emailMatch = label.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                    const normalized = normalizeEmail(emailMatch[0]);
                    if (normalized) {
                        const score = scoreEmailRelevance(normalized, businessWebsite) + 2; // Bonus for explicit labels
                        foundEmails.set(normalized, score);
                        console.log(`[GeoLead] Email found via label: ${normalized} (score: ${score})`);
                    }
                }
            }
        }

        // Method 5: Look for email in specific Google Maps elements
        const emailButtons = getVisibleElements(container, 'button[data-item-id^="email:"]');
        console.log(`[GeoLead] Found ${emailButtons.length} email buttons`);
        for (const btn of emailButtons) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const emailMatch = ariaLabel.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
                const normalized = normalizeEmail(emailMatch[0]);
                if (normalized) {
                    const score = scoreEmailRelevance(normalized, businessWebsite) + 3; // High bonus for official email buttons
                    foundEmails.set(normalized, score);
                    console.log(`[GeoLead] Email found via email button: ${normalized} (score: ${score})`);
                }
            }
        }

        // Method 6: Check for email in button text content
        const allButtons = getVisibleElements(container, 'button');
        for (const btn of allButtons) {
            const text = btn.textContent || '';
            if (text.includes('@') && text.length < 100) {
                for (const pattern of emailPatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        const normalized = normalizeEmail(match[0]);
                        if (normalized) {
                            const score = scoreEmailRelevance(normalized, businessWebsite);
                            foundEmails.set(normalized, score);
                            console.log(`[GeoLead] Email found via button text: ${normalized} (score: ${score})`);
                        }
                    }
                }
            }
        }

        // Method 7: Check for email in hidden spans and small text
        const smallTexts = getVisibleElements(container, 'span, div, small');
        for (const el of smallTexts) {
            const text = (el.textContent || '').trim();
            if (text.includes('@') && text.length < 100) {
                // Check if it's actually an email and not something else
                if (text.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
                    const normalized = normalizeEmail(text);
                    if (normalized) {
                        const score = scoreEmailRelevance(normalized, businessWebsite);
                        foundEmails.set(normalized, score);
                        console.log(`[GeoLead] Email found via small text: ${normalized} (score: ${score})`);
                    }
                }
            }
        }

        // Method 8: Check for email in website text (sometimes email appears in website text)
        const websiteTexts = getVisibleElements(container, 'a[href], .whsOnd, .zHQkBf');
        for (const el of websiteTexts) {
            const text = (el.textContent || '').trim();
            if (text.includes('@') && text.length < 100) {
                for (const pattern of emailPatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        const normalized = normalizeEmail(match[0]);
                        if (normalized) {
                            const score = scoreEmailRelevance(normalized, businessWebsite) + 1; // Small bonus for website context
                            foundEmails.set(normalized, score);
                            console.log(`[GeoLead] Email found via website text: ${normalized} (score: ${score})`);
                        }
                    }
                }
            }
        }

        // Method 9: Check for email in detail panel sections
        const detailSections = getVisibleElements(container, '.m6QErb, .DxyBCb, .kA9KIf, .dS8AEf');
        for (const section of detailSections) {
            const text = section.textContent || '';
            if (text.includes('@') && text.length < 200) {
                for (const pattern of emailPatterns) {
                    const matches = text.match(pattern);
                    if (matches) {
                        for (const match of matches) {
                            const normalized = normalizeEmail(match);
                            if (normalized) {
                                const score = scoreEmailRelevance(normalized, businessWebsite);
                                foundEmails.set(normalized, score);
                                console.log(`[GeoLead] Email found via detail section: ${normalized} (score: ${score})`);
                            }
                        }
                    }
                }
            }
        }

        // Select the best email based on score
        const sortedEmails = Array.from(foundEmails.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by score descending
        
        const bestEmail = sortedEmails.length > 0 ? sortedEmails[0][0] : '';
        console.log(`[GeoLead] Best email selected: ${bestEmail} (score: ${sortedEmails.length > 0 ? sortedEmails[0][1] : 0})`);
        console.log(`[GeoLead] Total unique emails found: ${foundEmails.size}`);
        return bestEmail;
    }

    /**
      * Normalize email to standard format
      */
    function normalizeEmail(email) {
        if (!email || !email.includes('@')) return '';
        
        // Remove extra whitespace
        email = email.trim();
        
        // Remove surrounding quotes
        email = email.replace(/^["']+|["']+$/g, '');
        
        // Basic email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) return '';
        
        // Check for common disposable email domains (optional)
        const disposableDomains = ['tempmail', '10minutemail', 'guerrillamail'];
        const domain = email.split('@')[1].toLowerCase();
        if (disposableDomains.some(d => domain.includes(d))) return '';
        
        return email.toLowerCase();
    }


    /**
     * Extract full address from the business detail panel
     */
    function extractAddressFromDetailPanel() {
        const container = getDetailPanelContainer();

        // Method 1: data-item-id="address"
        const addrBtn = getVisibleElement(container, 'button[data-item-id="address"]');
        if (addrBtn) {
            const ariaLabel = addrBtn.getAttribute('aria-label');
            if (ariaLabel && /Address:/i.test(ariaLabel)) {
                return ariaLabel.replace(/^Address:\s*/i, '').replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
            }
            const textNode = addrBtn.querySelector('.Io6YTe');
            if (textNode) return textNode.textContent.replace(/[^\p{L}\p{N}\s,.-]/gu, '').trim();
        }

        // Method 2: Scan for address-like aria labels
        const allBtns = getVisibleElements(container, 'button[aria-label*="Address"], button[aria-label*="address"]');
        for (const btn of allBtns) {
            const label = btn.getAttribute('aria-label') || '';
            const cleaned = label.replace(/^Address:\s*/i, '').trim();
            if (cleaned.length > 5) return cleaned;
        }

        return '';
    }

    /**
     * Helper: Clean Google redirects to get the final target website URL
     */
    function getCleanUrl(url) {
        if (!url) return '';
        try {
            if (url.includes('google.com/url?')) {
                const urlObj = new URL(url);
                const target = urlObj.searchParams.get('q') || urlObj.searchParams.get('url');
                if (target) return target;
            }
        } catch (e) {}
        return url;
    }

    /**
     * Helper: Check if a URL is a Google/Maps internal URL (not a real business website)
     */
    function isGoogleOrMapsUrl(url) {
        if (!url) return true;
        const cleanUrl = getCleanUrl(url);
        return (
            cleanUrl.includes('google.com/maps') ||
            cleanUrl.includes('maps.google.com') ||
            cleanUrl.includes('google.com/search') ||
            cleanUrl.includes('google.com/url') ||
            cleanUrl.includes('goo.gl') ||
            cleanUrl.includes('google.ad') ||
            (cleanUrl.includes('google.com') && !cleanUrl.includes('google.com/url?'))
        );
    }

    /**
     * Helper: Get visibly active details panel container
     */
    function getDetailPanelContainer() {
        const selectors = [
            'div.bJz1Cc.aJyJ4b', // Modern Google Maps detail panel container
            'div[role="main"]', // Sometimes details panel has role="main"
            '.m6QErb.dS8AEf', // Scrollable details container
            '.kA9KIf' // Another common detail panel wrapper
        ];
        
        for (const sel of selectors) {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
                // Check if the element is visible
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0) {
                    // Make sure it's the detail panel, not the sidebar feed
                    // The sidebar feed has role="feed" or contains div[role="feed"]
                    if (!el.querySelector('div[role="feed"]') && !el.classList.contains('DxyBCb')) {
                        return el;
                    }
                }
            }
        }
        
        // Fallback to the visible role="main"
        const mains = document.querySelectorAll('div[role="main"]');
        for (const main of mains) {
            const style = window.getComputedStyle(main);
            if (style.display !== 'none' && style.visibility !== 'hidden' && main.offsetWidth > 0) {
                return main;
            }
        }
        
        return document; // Fallback to document
    }

    /**
     * Extract business service options (e.g. dine-in, takeaway, delivery) from detail panel
     */
    function extractServicesFromDetailPanel() {
        const container = getDetailPanelContainer();
        if (!container) return [];
        
        const services = new Set();
        
        // List of service keywords to search for
        const serviceKeywords = [
            'dine-in', 'takeaway', 'delivery', 'no-contact delivery', 'drive-through', 
            'in-store pickup', 'in-store shopping', 'same-day delivery', 'outdoor seating', 
            'reservations', 'wheelchair-accessible', 'wifi', 'wi-fi', 'good for kids',
            'cash-only', 'credit cards', 'debit cards', 'nfc mobile payments',
            'halal food', 'vegetarian options', 'vegan options', 'kosher food'
        ];
        
        // Method 1: Scan specific Google Maps attribute classes or spans
        const attrElements = container.querySelectorAll('.LTnXM, .Yw7n9b, .E00Zgc span, [aria-label*="service" i], [aria-label*="amenit" i]');
        for (const el of attrElements) {
            const text = el.textContent.trim();
            if (!text || text.length > 50) continue;
            
            const lowerText = text.toLowerCase();
            for (const keyword of serviceKeywords) {
                if (lowerText.includes(keyword)) {
                    services.add(text);
                }
            }
        }
        
        // Method 2: Generic fallback scan of spans/divs
        if (services.size === 0) {
            const allSpans = container.querySelectorAll('span, div');
            for (const el of allSpans) {
                const text = el.textContent.trim();
                if (!text || text.length > 40) continue;
                
                const lowerText = el.textContent.toLowerCase();
                for (const keyword of serviceKeywords) {
                    if (lowerText === keyword || (lowerText.startsWith(keyword) && lowerText.length < keyword.length + 5)) {
                        services.add(text);
                    }
                }
            }
        }
        
        return Array.from(services);
    }

    /**
     * Validate if a URL is likely a valid business website
     */
    function isValidBusinessUrl(url, allowSocial = true) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check if it's not a Google/Maps URL
            if (isGoogleOrMapsUrl(url)) return false;
            
            // Check if it's a valid domain pattern
            const domainPattern = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
            if (!domainPattern.test(hostname)) return false;
            
            if (hostname.includes('google.')) return false;
            
            if (!allowSocial) {
                // Exclude known non-business domains that might appear in business profiles
                const nonBusinessDomains = [
                    'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com',
                    'tiktok.com', 'linkedin.com', 'pinterest.com', 'yelp.com',
                    'tripadvisor.com', 'foursquare.com', 'yellowpages.com'
                ];
                
                if (nonBusinessDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
                    return false;
                }
            }
            
            // Exclude common file extensions that aren't websites
            const fileExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.png', '.gif', '.zip', '.exe'];
            if (fileExtensions.some(ext => url.toLowerCase().endsWith(ext))) return false;
            
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Score website link confidence
     */
    function scoreWebsiteLink(href, text, ariaLabel, dataTooltip) {
        let score = 0;
        const lowerText = text.toLowerCase();
        const lowerAriaLabel = (ariaLabel || '').toLowerCase();
        const lowerDataTooltip = (dataTooltip || '').toLowerCase();
        
        // High confidence: explicit website indicators
        if (lowerAriaLabel.includes('website') || lowerDataTooltip.includes('website')) score += 15;
        if (lowerText.includes('website') || lowerText.includes('visit')) score += 12;
        if (lowerAriaLabel.includes('visit') || lowerDataTooltip.includes('visit')) score += 10;
        
        // Medium confidence: web-related keywords
        if (lowerAriaLabel.includes('web') || lowerDataTooltip.includes('web')) score += 8;
        if (lowerText.includes('web') || lowerText.includes('site')) score += 6;
        if (lowerAriaLabel.includes('site') || lowerDataTooltip.includes('site')) score += 6;
        if (lowerAriaLabel.includes('url') || lowerDataTooltip.includes('url')) score += 5;
        if (lowerText.includes('homepage')) score += 8;
        
        // Medium confidence: domain patterns
        if (/\.[a-z]{2,}$/i.test(text)) score += 8;
        if (/\.[a-z]{2,}$/i.test(href)) score += 6;
        
        // Low confidence: valid HTTP URLs (but not Google)
        if (href.startsWith('http') && !isGoogleOrMapsUrl(href)) score += 2;
        
        // Penalty for known non-business domains
        const nonBusinessDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'youtube.com'];
        if (nonBusinessDomains.some(domain => href.toLowerCase().includes(domain))) {
            score -= 10;
        }
        
        return score;
    }

    function extractWebsiteFromDetailPanel() {
        const container = getDetailPanelContainer();
        let bestWebsite = null;
        let bestScore = 0;
        let debugInfo = [];

        // Method 1: Check authority data-item-id (most reliable)
        const webBtn = getVisibleElement(container, 'a[data-item-id="authority"]');
        if (webBtn && webBtn.href) {
            let href = webBtn.href;
            const extracted = getExtractedWebsiteFromGoogleRedirect(href);
            if (extracted) {
                href = extracted;
            }
            
            if (isValidBusinessUrl(href)) {
                bestWebsite = href;
                bestScore = 25;
            }
        }

        // Method 2: Enhanced label/tooltip detection with scoring
        if (!bestWebsite || bestScore < 10) {
            const websiteBtns = getVisibleElements(container, 
                'a[aria-label*="website" i], a[data-tooltip*="website" i], button[aria-label*="website" i] a, button[data-tooltip*="website" i] a'
            );
            
            for (const link of websiteBtns) {
                if (!link.href) continue;
                
                let href = link.href;
                const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
                const dataTooltip = (link.getAttribute('data-tooltip') || '').toLowerCase();
                const text = link.textContent.trim();
                
                const extracted = getExtractedWebsiteFromGoogleRedirect(href);
                if (extracted) {
                    href = extracted;
                }
                
                if (!href || !href.startsWith('http') || isGoogleOrMapsUrl(href)) continue;

                const score = scoreWebsiteLink(href, text, ariaLabel, dataTooltip);
                
                if (score > bestScore && isValidBusinessUrl(href)) {
                    bestScore = score;
                    bestWebsite = href;
                }
            }
        }

        // Method 3: Scan all links with improved scoring
        if (!bestWebsite || bestScore < 5) {
            const allLinks = getVisibleElements(container, 'a[href]');
            for (const link of allLinks) {
                if (!link.href) continue;
                
                let href = link.href;
                const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
                const dataTooltip = (link.getAttribute('data-tooltip') || '').toLowerCase();
                const text = link.textContent.trim();
                
                const extracted = getExtractedWebsiteFromGoogleRedirect(href);
                if (extracted) {
                    href = extracted;
                }
                
                if (!href || !href.startsWith('http') || isGoogleOrMapsUrl(href)) continue;

                const score = scoreWebsiteLink(href, text, ariaLabel, dataTooltip);
                
                if (score > bestScore && isValidBusinessUrl(href)) {
                    bestScore = score;
                    bestWebsite = href;
                }
            }
        }

        return { website: bestWebsite, websiteStatus: bestWebsite ? 'HAS_WEBSITE' : 'NO_WEBSITE' };
    }

    /**
     * Extract Instagram URL from the business detail panel
     */
    function extractInstagramFromDetailPanel() {
        const container = document.querySelector('div[role="main"]') || document;

        const links = getVisibleElements(container, 'a[href*="instagram.com"]');
        for (const link of links) {
            if (link.href) return link.href;
        }

        const allLinks = getVisibleElements(container, 'a[href]');
        for (const link of allLinks) {
            if (link.href.includes('google.com/url?q=') && link.href.includes('instagram.com')) {
                try {
                    const extracted = new URL(link.href).searchParams.get('q');
                    if (extracted && extracted.includes('instagram.com')) return extracted;
                } catch (e) { }
            }
        }

        return null;
    }

    // ====== SCROLL HANDLER (inline) ======

    const SCROLL_SELECTORS = [
        'div[role="feed"]',
        'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',
        'div.m6QErb[aria-label]',
        'div.m6QErb',
    ];

    function findScrollContainer() {
        // Method 1: Most reliable explicit selector
        const feed = document.querySelector('div[role="feed"]');
        if (feed) return feed;

        // Method 2: Check standard selectors
        for (const selector of SCROLL_SELECTORS) {
            const el = document.querySelector(selector);
            // Relaxed check: Just return it if found and has height, maps will scroll it or its parent
            if (el && el.clientHeight > 0) return el;
        }

        // Method 3: Fallback candidates
        const candidates = document.querySelectorAll('div[role="feed"], div.m6QErb');
        for (const el of candidates) {
            if (el.clientHeight > 0) return el;
        }
        return null;
    }

    function isEndOfResults(container) {
        const endTexts = ['end of', 'no more', "you've reached", 'reached the end', 'no results found', 'no results'];
        const indicators = container.querySelectorAll('p.fontBodyMedium span, .HlvSq, span.fontBodyMedium, div[role="alert"], div[role="status"]');
        for (const el of indicators) {
            const text = (el.textContent || '').toLowerCase();
            if (endTexts.some(t => text.includes(t))) {
                console.log(`[GeoLead] 🚫 End of results detected: "${text}"`);
                return true;
            }
        }
        
        // Check if we're at the bottom of the container
        const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 10;
        if (isAtBottom) {
            console.log(`[GeoLead] 📜 Reached bottom of scroll container`);
        }
        
        return isAtBottom;
    }

    // ====== DEDUPLICATION (inline) ======

    function deduplicateLeads(leads) {
        const seen = new Set();
        return leads.filter(lead => {
            const hash = `${(lead.businessName || '').toLowerCase().trim()}|${(lead.address || '').toLowerCase().trim()}`;
            if (seen.has(hash)) return false;
            seen.add(hash);
            return true;
        });
    }

    function extractLatLngFromUrl(url) {
        if (!url) return { lat: null, lng: null };
        const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
            return {
                lat: parseFloat(match[1]),
                lng: parseFloat(match[2])
            };
        }
        return { lat: null, lng: null };
    }

    function parseAddressComponents(address) {
        const result = {
            city: '',
            state: '',
            country: '',
            postalCode: ''
        };
        if (!address) return result;

        const parts = address.split(',').map(p => p.trim());
        if (parts.length === 0) return result;

        const countryPart = parts[parts.length - 1];
        result.country = countryPart;

        if (parts.length > 1) {
            const statePostalPart = parts[parts.length - 2];
            const zipMatch = statePostalPart.match(/\b\d{5}\b/);
            if (zipMatch) {
                result.postalCode = zipMatch[0];
                result.state = statePostalPart.replace(zipMatch[0], '').trim();
            } else {
                const generalZipMatch = statePostalPart.match(/\b([A-Z]{1,2}[0-9R][0-9A-Z]? ?[0-9][A-Z]{2})\b/i);
                if (generalZipMatch) {
                    result.postalCode = generalZipMatch[0];
                    result.state = statePostalPart.replace(generalZipMatch[0], '').trim();
                } else {
                    result.state = statePostalPart;
                }
            }
        }

        if (parts.length > 2) {
            result.city = parts[parts.length - 3];
        } else if (parts.length === 2) {
            result.city = parts[0];
        }

        if (!result.city && parts.length > 0) {
            result.city = parts[0];
        }

        return result;
    }

    function extractHoursAndStatusFromDetailPanel() {
        const container = getDetailPanelContainer();
        let businessStatus = 'Open';
        let openingHours = '';
        if (!container) return { businessStatus, openingHours };
        
        const hoursBtn = container.querySelector('button[data-item-id="oh"], div[data-item-id="oh"]');
        if (hoursBtn) {
            const ariaLabel = hoursBtn.getAttribute('aria-label');
            if (ariaLabel) {
                openingHours = ariaLabel.replace(/^Hours:\s*/i, '').trim();
                const lowerHours = openingHours.toLowerCase();
                if (lowerHours.includes('temporarily closed')) {
                    businessStatus = 'Temporarily Closed';
                } else if (lowerHours.includes('permanently closed')) {
                    businessStatus = 'Permanently Closed';
                } else if (lowerHours.includes('closed')) {
                    businessStatus = 'Closed';
                } else if (lowerHours.includes('open')) {
                    businessStatus = 'Open';
                }
            }
            
            const textNode = hoursBtn.querySelector('.Io6YTe');
            if (textNode && !openingHours) {
                openingHours = textNode.textContent.trim();
            }
        } else {
            const statusEl = container.querySelector('.ZDuZ1, .Jq5o3, .t39xZr, span[style*="rgba(25,134,57"], span[style*="rgba(217,48,37"]');
            if (statusEl) {
                const text = statusEl.textContent.trim();
                const lowerText = text.toLowerCase();
                if (lowerText.includes('closed')) {
                    businessStatus = lowerText.includes('temporarily') ? 'Temporarily Closed' : 'Closed';
                } else if (lowerText.includes('open')) {
                    businessStatus = 'Open';
                }
                openingHours = text;
            }
        }
        
        return { businessStatus, openingHours };
    }

    function extractSocialsFromDetailPanel() {
        const container = getDetailPanelContainer();
        const socials = {
            instagram: null,
            facebook: null,
            linkedin: null,
            twitter: null,
            youtube: null,
            tiktok: null,
            pinterest: null
        };
        if (!container) return socials;

        const allLinks = getVisibleElements(container, 'a[href]');
        for (const link of allLinks) {
            let href = link.href;
            if (href.includes('google.com/url?q=')) {
                try {
                    href = new URL(href).searchParams.get('q') || href;
                } catch (e) {}
            }
            
            const lowerHref = href.toLowerCase();
            if (lowerHref.includes('instagram.com/')) {
                socials.instagram = href;
            } else if (lowerHref.includes('facebook.com/')) {
                socials.facebook = href;
            } else if (lowerHref.includes('linkedin.com/')) {
                socials.linkedin = href;
            } else if (lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) {
                socials.twitter = href;
            } else if (lowerHref.includes('youtube.com/')) {
                socials.youtube = href;
            } else if (lowerHref.includes('tiktok.com/')) {
                socials.tiktok = href;
            } else if (lowerHref.includes('pinterest.com/')) {
                socials.pinterest = href;
            }
        }
        return socials;
    }

    function calculateLeadQualityScore(lead) {
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



    function qualifyLead(lead, qualityScore) {
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

    function validateAndCleanLead(lead) {
        if (!lead.businessName || lead.businessName.toLowerCase().includes('google maps')) {
            return null;
        }

        if (lead.website) {
            try {
                const u = new URL(lead.website);
                const domain = u.hostname.toLowerCase();
                if (domain.includes('google.com') || domain.includes('google.co') || domain.includes('google.com.pk')) {
                    lead.website = null;
                    lead.websiteStatus = 'NO_WEBSITE';
                }
            } catch (e) {
                lead.website = null;
                lead.websiteStatus = 'NO_WEBSITE';
            }
        }

        if (lead.emails && lead.emails.length > 0) {
            lead.emails = lead.emails.filter(email => {
                if (!email || !email.includes('@')) return false;
                const fileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js', '.svg', '.pdf'];
                if (fileExtensions.some(ext => email.endsWith(ext))) return false;
                
                const junkDomains = ['sentry.io', 'googleadservices.com', 'gravatar.com', 'git.io'];
                const domain = email.split('@')[1];
                if (domain && junkDomains.some(junk => domain.includes(junk))) return false;
                
                return true;
            });
            if (lead.emails.length > 0) {
                lead.email = lead.emails[0];
            } else {
                lead.email = null;
            }
        }

        if (lead.latitude === null || isNaN(lead.latitude)) lead.latitude = null;
        if (lead.longitude === null || isNaN(lead.longitude)) lead.longitude = null;

        return lead;
    }

    // ====== MESSAGE HELPERS ======

    function sendProgress(found, total) {
        try {
            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_PROGRESS,
                found,
                total,
                sessionId: currentSessionId
            });
        } catch (e) {
            console.warn('[GeoLead] Could not send progress:', e.message);
        }
    }

    function sendError(errorMsg) {
        try {
            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_ERROR,
                error: errorMsg,
                sessionId: currentSessionId
            });
        } catch (e) {
            console.error('[GeoLead] Could not send error:', e.message);
        }
    }

    // ====== UTILITY HELPERS ======

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function smartWait(baseMs) {
        const randomExtra = Math.floor(Math.random() * 300) + 100;
        return sleep(baseMs + randomExtra);
    }

    function generateId() {
        return 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ====== INITIALIZATION ======
    console.log('🌐 GeoLead AI content script loaded on Google Maps');
    console.log(`🌐 Page URL: ${window.location.href}`);
    console.log(`🌐 Visible cards on load: ${countVisibleCards()}`);
    injectInterceptor();
})();
