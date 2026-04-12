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
    
    // KEEP-ALIVE STATE
    let keepAliveInterval = null;

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
            // Step 1: Find the scrollable results panel
            const scrollContainer = findScrollContainer();
            if (!scrollContainer) {
                sendError('Could not find Google Maps results panel. Please search for businesses first and make sure results are visible.');
                isRunning = false;
                return;
            }

            console.log('[GeoLead] 📡 Found scroll container, starting scrape...');
            console.log(`[GeoLead] ⚙️ Config: maxResults=${maxResults}, scrollDelay=${scrollDelay}ms`);

            // Step 2: Auto-scroll and collect results via MutationObserver
            await new Promise((resolve) => {
                let leads = parseResults();
                currentFound = leads.length;
                currentTarget = maxResults;
                sendProgress(currentFound, currentTarget);

                if (currentFound >= maxResults || shouldStop) {
                    return resolve();
                }

                let isScrolling = false;
                let fallbackTimer = null;
                let stallCount = 0;
                let previousCount = currentFound;

                const finish = () => {
                    if (fallbackTimer) clearTimeout(fallbackTimer);
                    observer.disconnect();
                    resolve();
                };

                const triggerScroll = () => {
                    if (shouldStop || currentFound >= maxResults) return finish();
                    if (isScrolling) return;

                    isScrolling = true;
                    
                    // Stall check
                    if (currentFound === previousCount) {
                        stallCount++;
                        if (stallCount >= 4) {
                            console.log(`[GeoLead] 🛑 No new results after scrolling, stopping.`);
                            return finish();
                        }
                    } else {
                        stallCount = 0;
                    }
                    previousCount = currentFound;

                    if (isEndOfResults(scrollContainer)) {
                        console.log('[GeoLead] 🏁 Reached end of results list.');
                        return finish();
                    }

                    // Push container down
                    scrollContainer.scrollBy({ top: 800, behavior: 'smooth' });

                    // Debounce rapid scrolling
                    setTimeout(() => { isScrolling = false; }, 400);

                    // Set a fallback timer in case MutationObserver never fires (e.g. slow network)
                    if (fallbackTimer) clearTimeout(fallbackTimer);
                    fallbackTimer = setTimeout(() => {
                        if (!shouldStop && currentFound < maxResults) {
                            triggerScroll();
                        }
                    }, scrollDelay);
                };

                const observer = new MutationObserver((mutations) => {
                    if (shouldStop) return finish();

                    const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
                    if (hasNewNodes) {
                        leads = parseResults();
                        currentFound = leads.length;
                        sendProgress(currentFound, currentTarget);
                        
                        if (currentFound >= maxResults) {
                            console.log(`[GeoLead] 🎯 Reached target: ${currentFound}/${maxResults}`);
                            return finish();
                        }

                        // Instant next scroll if we got new data
                        if (currentFound > previousCount && !isScrolling) {
                            if (fallbackTimer) clearTimeout(fallbackTimer);
                            setTimeout(() => triggerScroll(), 100); // 100ms tiny buffer
                        }
                    }
                });

                observer.observe(scrollContainer, { childList: true, subtree: true });

                // Kick off first scroll
                triggerScroll();
            });

            // Step 3: Final parse and trim to max
            const allLeads = parseResults().slice(0, maxResults);

            // Step 3.5: DEEP SCRAPE — click into each card to get phone/email/address
            // KEY FIX: verify detail panel title matches business before extracting
            console.log(`[GeoLead]  Starting deep scrape for ${allLeads.length} leads...`);

            if (scrollContainer) {
                scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
                await sleep(800);
            }

            for (let i = 0; i < allLeads.length; i++) {
                if (shouldStop) break;

                const lead = allLeads[i];
                let skipPhone = false;
                if (lead.phone) {
                    console.log(`[GeoLead]  Skip Phone for #${i}: ${lead.businessName} — already has phone`);
                    skipPhone = true;
                }

                try {
                    let card = null;
                    let scrollAttempts = 0;

                    while (!card && scrollAttempts < 15) {
                        const cards = findBusinessCards();
                        for (const c of cards) {
                            const nameEl = c.querySelector('a.hfpxzc');
                            if (nameEl) {
                                const rawLabel = (nameEl.getAttribute('aria-label') || '').trim();
                                const cleanedLabel = cleanBusinessName(rawLabel).toLowerCase();
                                const targetName = lead.businessName.trim().toLowerCase();
                                if (cleanedLabel === targetName || rawLabel.toLowerCase() === targetName || cleanedLabel.includes(targetName)) {
                                    card = c;
                                    break;
                                }
                            }
                        }

                        if (!card) {
                            const currentScroll = findScrollContainer();
                            if (currentScroll) {
                                currentScroll.scrollBy({ top: 300, behavior: 'instant' });
                            } else if (scrollContainer && scrollContainer.isConnected) {
                                scrollContainer.scrollBy({ top: 300, behavior: 'instant' });
                            }
                            await sleep(250);
                            scrollAttempts++;
                        }
                    }

                    if (!card) {
                        console.log(`[GeoLead] ❓ Card not found for #${i}: ${lead.businessName}`);
                        continue;
                    }

                    const clickTarget = card.querySelector('a.hfpxzc');
                    if (!clickTarget) continue;

                    // Scroll into view and click
                    clickTarget.scrollIntoView({ behavior: 'instant', block: 'center' });
                    await sleep(200);
                    clickTarget.click();

                    // CRITICAL: Wait until the detail panel title matches THIS business
                    const correctPanel = await waitForCorrectDetailPanel(lead.businessName, 5000);
                    if (!correctPanel) {
                        console.log(`[GeoLead]  Wrong/stale panel for: ${lead.businessName} — skipping`);
                        await goBackToList();
                        continue;
                    }

                    // Wait for info section to fully render
                    await sleep(500);

                    // Scroll DOWN inside the detail panel to reveal phone/address below fold
                    const detailScroll = document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf, .m6QErb.WNBkOb, .bJzME, div[role="main"]');
                    if (detailScroll) {
                        detailScroll.scrollBy({ top: 400, behavior: 'smooth' });
                        await sleep(400);
                    }

                    // Extract phone with EXTENDED RETRY (if we didn't get it in list view)
                    if (!skipPhone) {
                        let detailPhone = '';
                        // Increased to 5 attempts with larger scrolls to bypass massive Cafe menus
                        for (let attempt = 0; attempt < 5 && !detailPhone; attempt++) {
                            detailPhone = extractPhoneFromDetailPanel();
                            if (!detailPhone) {
                                // Scroll more and wait
                                if (detailScroll) detailScroll.scrollBy({ top: 400, behavior: 'smooth' });
                                await sleep(400 + attempt * 200);
                            }
                        }
                        if (detailPhone) {
                            lead.phone = detailPhone;
                        }
                    }

                    // Extract email
                    const detailEmail = extractEmailFromDetailPanel();
                    if (detailEmail) lead.email = detailEmail;

                    // Extract address (override list view address if we find a better one)
                    const detailAddress = extractAddressFromDetailPanel();
                    if (detailAddress) lead.address = detailAddress;

                    // Extract website from detail panel
                    const detailWeb = extractWebsiteFromDetailPanel();
                    if (detailWeb.website && !isGoogleOrMapsUrl(detailWeb.website)) {
                        lead.website = detailWeb.website;
                        lead.websiteStatus = detailWeb.websiteStatus;
                    }

                    // Extract Instagram
                    const insta = extractInstagramFromDetailPanel();
                    if (insta) lead.instagram = insta;

                    // Go back to list
                    await goBackToList();
                    await sleep(300);

                    sendProgress(i + 1, allLeads.length);
                    console.log(`[GeoLead]  Deep scraped ${i + 1}/${allLeads.length}: ${lead.businessName} — Phone: ${lead.phone || ' Not listed'}`);

                } catch (e) {
                    console.warn(`[GeoLead]  Deep scrape error for ${lead.businessName}:`, e.message);
                    try { await goBackToList(); } catch (_) { }
                    await sleep(300);
                }
            }

            console.log('[GeoLead]  Deep scrape complete.');

            // Step 4: Apply deduplication
            const dedupedLeads = deduplicateLeads(allLeads);
            const duplicatesRemoved = allLeads.length - dedupedLeads.length;

            console.log(`[GeoLead] 📊 Final: ${dedupedLeads.length} unique leads (${duplicatesRemoved} duplicates removed)`);

            // Step 5: Send results to popup
            const elapsedMs = Date.now() - scrapeStartTime;

            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_RESULT,
                leads: dedupedLeads,
            });

            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_DONE,
                total: dedupedLeads.length,
                duplicatesRemoved,
                elapsedMs,
                stoppedByUser: shouldStop,
            });

        } catch (error) {
            console.error('[GeoLead]  Scraping error:', error);
            sendError(error.message || 'Unknown scraping error occurred');
        } finally {
            stopKeepAlive();
        }

        isRunning = false;
        shouldStop = false;
        currentFound = 0;
        currentTarget = 0;
    }

    // ====== DOM PARSER (inline for content script compatibility) ======

    const CARD_SELECTORS = [
        'div.Nv2PK',
        'div[jsaction*="mouseover"].lI9IFe',
        'div[role="article"]',
        'a.hfpxzc',
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

    /**
     * Parse all visible business cards
     */
    function parseResults() {
        const leads = [];
        const seen = new Set();
        const cards = findBusinessCards();

        for (const card of cards) {
            try {
                const lead = extractLeadFromCard(card);
                if (lead && lead.businessName) {
                    const key = lead.businessName.toLowerCase().trim();
                    if (!seen.has(key)) {
                        seen.add(key);
                        leads.push(lead);
                    }
                }
            } catch (e) {
                // Skip problematic cards silently
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
     * Count visible business cards
     */
    function countVisibleCards() {
        return findBusinessCards().length;
    }

    /**
     * Extract data from a single card
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

        return {
            id: generateId(),
            businessName,
            category,
            rating,
            reviewCount,
            address,
            phone,
            website,
            websiteStatus,
            instagram: null,
            placeUrl,
            scrapedAt: new Date().toISOString(),
            pitch: null,
            pitchStatus: 'PENDING',
        };
    }

    function extractBusinessName(card) {
        // Heuristic: The most reliable source is the aria-label of the main wrapper link
        const mainLink = card.querySelector('a.hfpxzc');
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
        const linkEl = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="maps"]');
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
        // Detailed View direct button lookup (always safest if available)
        const phoneBtn = card.querySelector('button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
            const ariaLabel = phoneBtn.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.startsWith('Phone:')) {
                const rawPhone = ariaLabel.replace('Phone:', '').trim();
                if (rawPhone) return rawPhone;
            }
            const extracted = phoneBtn.getAttribute('data-item-id').replace('phone:tel:', '');
            if (extracted) return extracted;
        }

        // Heuristic: Broad regex over the ENTIRE text content of the card
        const text = card.textContent || '';
        const phoneRegexes = [
            /(?:\+92|0)[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
            /(?:\+92|0)[\s.-]?\d{3}[\s.-]?\d{7}/,
            /(?:\+92|0)[\s.-]?\d{2}[\s.-]?\d{7,8}/,
            /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,4}/,
            /\b(?:0|\+)\d{9,14}\b/,
            /\(\d{3}\)\s?\d{3}[-.]?\d{4}/
        ];

        for (const regex of phoneRegexes) {
            const match = text.match(regex);
            if (match) {
                const digits = match[0].replace(/\D/g, '');
                if (digits.length >= 7 && digits.length <= 15) return match[0].trim();
            }
        }

        return '';
    }

    function extractWebsite(card) {
        let website = null;

        // Use aria-label detection specifically to find "Website" or "Visit Website" buttons
        const links = card.querySelectorAll('a[href]');
        for (const link of links) {
            const href = link.href;
            const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
            
            // Strict label heuristic
            if (ariaLabel.includes('website') || ariaLabel.includes('visit') || link.textContent.toLowerCase().includes('website')) {
                if (href && href.startsWith('http') && !isGoogleOrMapsUrl(href)) {
                    website = href;
                    break;
                }
            }
            
            // Broad Google Redirect link heuristic
            if (href && href.includes('google.com/url?q=')) {
                try {
                    const urlObj = new URL(href);
                    const ext = urlObj.searchParams.get('q');
                    if (ext && !isGoogleOrMapsUrl(ext)) {
                        website = ext;
                        break;
                    }
                } catch (e) { }
            }
            
            // Ultimate fallback for raw URLs
            if (href && !href.includes('google.com') && !href.includes('maps') && !href.includes('search?') && (href.startsWith('http://') || href.startsWith('https://'))) {
                website = href;
                break;
            }
        }

        // Detailed view data-item-id
        if (!website) {
            const webBtn = card.querySelector('a[data-item-id="authority"]');
            if (webBtn && webBtn.href) {
                website = webBtn.href.includes('google.com/url?q=') ? new URL(webBtn.href).searchParams.get('q') : webBtn.href;
            }
        }

        let websiteStatus = 'NO_WEBSITE';
        if (website) {
            websiteStatus = (website.startsWith('http://') && !website.startsWith('https://'))
                ? 'NEEDS_REVAMP' : 'HAS_WEBSITE';
        }

        return { website, websiteStatus };
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
        const POLL_INTERVAL = 300;
        const normalizedExpected = normalizeForCompare(expectedName);

        while (Date.now() - start < timeoutMs) {
            const titleEl = document.querySelector('h1.DUwDvf, h2.DUwDvf, h1.fontHeadlineLarge, div.tAiQdd h1, div.lMbq3e h1');
            if (titleEl) {
                const panelName = normalizeForCompare(titleEl.textContent || '');

                // Multiple matching strategies
                if (panelName === normalizedExpected) { return true; }
                if (normalizedExpected.includes(panelName) && panelName.length > 3) { return true; }
                if (panelName.includes(normalizedExpected) && normalizedExpected.length > 3) { return true; }
                // First N chars match (handles truncation)
                const minLen = Math.min(panelName.length, normalizedExpected.length, 15);
                if (minLen > 5 && panelName.substring(0, minLen) === normalizedExpected.substring(0, minLen)) { return true; }
                // Word overlap: if 2+ words match
                const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 2);
                const panelWords = panelName.split(/\s+/).filter(w => w.length > 2);
                const overlap = expectedWords.filter(w => panelWords.includes(w));
                if (overlap.length >= 2) { return true; }
            }
            await sleep(POLL_INTERVAL);
        }

        console.log(`[GeoLead]  Timeout waiting for panel: "${expectedName}". Continuing anyway...`);
        return true; // We accept anyway to avoid missing numbers
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
            'button[aria-label="Back"], button[jsaction*="back"], button.hYBOP, button[aria-label="Close"]'
        );
        if (backBtn) {
            backBtn.click();
            await sleep(500);
        } else {
            history.back();
            await sleep(600);
        }
        // Wait for list to re-appear
        const listBack = await waitForListView(2500);
        if (!listBack) {
            // Another fallback
            history.back();
            await sleep(500);
        }
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
     * Extract phone from the business detail panel (after clicking a card)
     * Uses multiple methods scoped to the visibly active detail panel
     */
    function extractPhoneFromDetailPanel() {
        const container = document.querySelector('div[role="main"]') || document;

        // METHOD 1: button with aria-label starting with "Phone:"
        const phoneBtnByLabel = getVisibleElement(container, 'button[aria-label^="Phone:"], button[aria-label^="phone:"]');
        if (phoneBtnByLabel) {
            const ariaLabel = phoneBtnByLabel.getAttribute('aria-label') || '';
            const cleaned = ariaLabel.replace(/^Phone:\s*/i, '').trim();
            if (cleaned && cleaned.replace(/\D/g, '').length >= 7) return cleaned;
            const innerText = phoneBtnByLabel.querySelector('.Io6YTe');
            if (innerText) {
                const t = innerText.textContent.trim();
                if (t && t.replace(/\D/g, '').length >= 7) return t;
            }
        }

        // METHOD 2: button.CsEnBe with phone in aria-label
        const csButtons = getVisibleElements(container, 'button.CsEnBe');
        for (const btn of csButtons) {
            const label = (btn.getAttribute('aria-label') || '');
            if (/phone|call|tel/i.test(label)) {
                const cleaned = label.replace(/^(Phone|Call|Tel):\s*/i, '').trim();
                if (cleaned.replace(/\D/g, '').length >= 7) return cleaned;
            }
        }

        // METHOD 3: data-item-id="phone:tel:..."
        const phoneBtn = getVisibleElement(container, 'button[data-item-id^="phone:tel:"]');
        if (phoneBtn) {
            const ariaLabel = phoneBtn.getAttribute('aria-label');
            if (ariaLabel) {
                const cleaned = ariaLabel.replace(/^Phone:\s*/i, '').trim();
                if (cleaned.replace(/\D/g, '').length >= 7) return cleaned;
            }
            const dataId = (phoneBtn.getAttribute('data-item-id') || '').replace('phone:tel:', '').trim();
            if (dataId && dataId.replace(/\D/g, '').length >= 7) return dataId;
            const textNode = phoneBtn.querySelector('.Io6YTe');
            if (textNode) {
                const t = textNode.textContent.trim();
                if (t.replace(/\D/g, '').length >= 7) return t;
            }
        }

        // METHOD 4: Scan ALL .Io6YTe elements safely
        const phoneRegexes = [
            /(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}(?:[\s.-]*\d{2,4})?/,
            /(?:\+92|0)[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/,
            /(?:\+92|0)[\s.-]?\d{3}[\s.-]?\d{7}/,
            /(?:\+92|0)[\s.-]?\d{2}[\s.-]?\d{7,8}/,
            /\(\d{3}\)\s?\d{3}[-.]?\d{4}/,
            /\+\d{10,15}/,
            /\b\d{8,15}\b/,
        ];

        const allInfoTexts = getVisibleElements(container, '.Io6YTe');
        for (const el of allInfoTexts) {
            const text = (el.textContent || '').trim();
            if (!text || text.length < 7 || text.length > 25) continue;
            if (text.includes('www.') || text.includes('http') || text.includes('@')) continue;
            for (const regex of phoneRegexes) {
                const match = text.match(regex);
                if (match) {
                    const digits = match[0].replace(/\D/g, '');
                    if (digits.length >= 7 && digits.length <= 15) return match[0].trim();
                }
            }
        }

        // METHOD 5: Scan ALL aria-labels for phone info
        const allBtns = getVisibleElements(container, 'button[aria-label], a[aria-label]');
        for (const btn of allBtns) {
            const label = (btn.getAttribute('aria-label') || '');
            if (/phone|call|dial|tel/i.test(label)) {
                const match = label.match(/(?:\+?\d{1,3}[\s.-]*)?\(?\d{2,4}\)?[\s.-]*\d{3,4}[\s.-]*\d{3,4}(?:[\s.-]*\d{2,4})?/) || label.match(/\d{8,15}/);
                if (match) return match[0];
            }
        }

        return '';
    }

    /**
     * Extract email from the business detail panel
     */
    function extractEmailFromDetailPanel() {
        const container = document.querySelector('div[role="main"]') || document;

        // Method 1: Check all mailto links
        const mailtoLinks = getVisibleElements(container, 'a[href^="mailto:"]');
        for (const link of mailtoLinks) {
            const email = link.href.replace('mailto:', '').split('?')[0].trim();
            if (email && email.includes('@')) return email;
        }

        // Method 2: Scan text elements for email pattern
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const allTextEls = getVisibleElements(container, '.Io6YTe, .rogA2c, .CsEnBe, .AeaXub');
        for (const el of allTextEls) {
            const match = (el.textContent || '').match(emailPattern);
            if (match) return match[0];
        }

        return '';
    }


    /**
     * Extract full address from the business detail panel
     */
    function extractAddressFromDetailPanel() {
        const container = document.querySelector('div[role="main"]') || document;

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
     * Helper: Check if a URL is a Google/Maps internal URL (not a real business website)
     */
    function isGoogleOrMapsUrl(url) {
        if (!url) return true;
        return (
            url.includes('google.com/maps') ||
            url.includes('maps.google.com') ||
            url.includes('google.com/search') ||
            url.includes('google.com/url') ||
            url.includes('goo.gl') ||
            (url.includes('google.com') && !url.includes('google.com/url?q='))
        );
    }

    function extractWebsiteFromDetailPanel() {
        const container = document.querySelector('div[role="main"]') || document;
        let website = null;

        // Method 1: Check authority data-item-id (most reliable)
        const webBtn = getVisibleElement(container, 'a[data-item-id="authority"]');
        if (webBtn && webBtn.href) {
            if (webBtn.href.includes('google.com/url?q=')) {
                const extracted = new URL(webBtn.href).searchParams.get('q');
                if (extracted && !isGoogleOrMapsUrl(extracted)) website = extracted;
            } else if (!isGoogleOrMapsUrl(webBtn.href)) {
                website = webBtn.href;
            }
        }

        // Method 2: Safe fallback
        if (!website) {
            const websiteBtns = getVisibleElements(container, 'a[aria-label*="Website"], button[aria-label*="Website"] a');
            for (const link of websiteBtns) {
                const href = link.href;
                if (!href || !href.startsWith('http') || isGoogleOrMapsUrl(href) || href.includes('search?')) continue;

                if (href.includes('google.com/url?q=')) {
                    try {
                        const extracted = new URL(href).searchParams.get('q');
                        if (extracted && !isGoogleOrMapsUrl(extracted)) {
                            website = extracted;
                            break;
                        }
                    } catch (e) { }
                } else {
                    website = href;
                    break;
                }
            }
        }

        if (website && isGoogleOrMapsUrl(website)) {
            website = null;
        }

        let websiteStatus = 'NO_WEBSITE';
        if (website) {
            websiteStatus = (website.startsWith('http://') && !website.startsWith('https://'))
                ? 'NEEDS_REVAMP' : 'HAS_WEBSITE';
        }
        return { website, websiteStatus };
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
        const endTexts = ['end of', 'no more', "you've reached", 'reached the end'];
        const indicators = container.querySelectorAll('p.fontBodyMedium span, .HlvSq, span.fontBodyMedium');
        for (const el of indicators) {
            const text = (el.textContent || '').toLowerCase();
            if (endTexts.some(t => text.includes(t))) return true;
        }
        return Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 10;
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

    // ====== MESSAGE HELPERS ======

    function sendProgress(found, total) {
        try {
            chrome.runtime.sendMessage({
                type: MSG.SCRAPE_PROGRESS,
                found,
                total,
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
})();
