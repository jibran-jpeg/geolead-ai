/**
 * GeoLead AI — Scroll Handler
 * Manages auto-scrolling of the Google Maps results panel to load more results.
 * Handles scroll detection, end-of-results detection, and smart waiting.
 */

// ====== SCROLL CONTAINER SELECTORS ======
const SCROLL_SELECTORS = [
    'div[role="feed"]',                          // Primary: feed role
    'div.m6QErb.DxyBCb.kA9KIf.dS8AEf',        // Specific Maps class combo
    'div.m6QErb[aria-label]',                    // Labeled scrollable
    'div.m6QErb',                                // Generic Maps scroll container
];

// ====== SCROLL HANDLER CLASS ======

export class ScrollHandler {
    constructor(options = {}) {
        this.scrollAmount = options.scrollAmount || 800;     // Pixels per scroll
        this.baseDelay = options.baseDelay || 2000;          // Base delay between scrolls (ms)
        this.maxRetries = options.maxRetries || 5;           // Max consecutive scrolls with no new results
        this.container = null;
        this.isScrolling = false;
        this.shouldStop = false;
        this.noNewCount = 0;
        this.lastScrollHeight = 0;
    }

    /**
     * Find and cache the scrollable results container
     * @returns {Element|null} The scroll container element
     */
    findContainer() {
        // Try each selector
        for (const selector of SCROLL_SELECTORS) {
            const el = document.querySelector(selector);
            if (el && el.scrollHeight > el.clientHeight) {
                this.container = el;
                return el;
            }
        }

        // Fallback: find any scrollable div in the results area
        const candidates = document.querySelectorAll('div[role="feed"], div.m6QErb');
        for (const el of candidates) {
            if (el.scrollHeight > el.clientHeight) {
                this.container = el;
                return el;
            }
        }

        this.container = null;
        return null;
    }

    /**
     * Perform a single scroll action
     * @returns {boolean} Whether the scroll was successful
     */
    scrollDown() {
        if (!this.container) return false;

        const beforeScroll = this.container.scrollTop;
        this.container.scrollBy({ top: this.scrollAmount, behavior: 'smooth' });

        // Check if we actually scrolled
        // (We need a brief delay to check, so we compare scrollHeight instead)
        return true;
    }

    /**
     * Scroll to the top of the results container
     */
    scrollToTop() {
        if (this.container) {
            this.container.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Check if we have reached the end of the results list
     * @returns {boolean}
     */
    isEndOfResults() {
        if (!this.container) return true;

        // Method 1: Check for Google Maps "end of list" text indicators
        const endTexts = ['end of', 'no more', "you've reached", 'reached the end'];
        const endIndicators = this.container.querySelectorAll(
            'p.fontBodyMedium span, .HlvSq, span.fontBodyMedium'
        );

        for (const el of endIndicators) {
            const text = (el.textContent || '').toLowerCase();
            if (endTexts.some(endText => text.includes(endText))) {
                return true;
            }
        }

        // Method 2: Check if scroll position is at the absolute bottom
        const isAtBottom = Math.abs(
            this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight
        ) < 10;

        // Method 3: Check if scrollHeight hasn't changed (nothing new loaded)
        const scrollHeightUnchanged = this.container.scrollHeight === this.lastScrollHeight;
        this.lastScrollHeight = this.container.scrollHeight;

        // If at bottom AND scrollHeight didn't change, likely end of results
        if (isAtBottom && scrollHeightUnchanged) {
            this.noNewCount++;
            return this.noNewCount >= this.maxRetries;
        }

        // Reset counter if scrollHeight changed (new content loaded)
        if (!scrollHeightUnchanged) {
            this.noNewCount = 0;
        }

        return false;
    }

    /**
     * Smart wait — adds randomized delay to appear more human-like
     * @param {number} baseMs - Base milliseconds to wait
     * @returns {Promise}
     */
    async smartWait(baseMs) {
        const randomExtra = Math.floor(Math.random() * 800) + 200; // 200-1000ms extra
        const totalWait = baseMs + randomExtra;
        return new Promise(resolve => setTimeout(resolve, totalWait));
    }

    /**
     * Wait for new content to load after scrolling
     * Polls the DOM for changes with a timeout
     * @param {number} currentCount - Current number of results
     * @param {number} timeout - Max time to wait (ms)
     * @returns {Promise<boolean>} Whether new content appeared
     */
    async waitForNewContent(currentCount, timeout = 5000) {
        const startTime = Date.now();
        const checkInterval = 300;

        while (Date.now() - startTime < timeout) {
            // Check if the number of cards increased
            const newCount = this.countCards();
            if (newCount > currentCount) {
                return true;
            }

            // Check if scroll height changed
            if (this.container && this.container.scrollHeight !== this.lastScrollHeight) {
                return true;
            }

            await new Promise(r => setTimeout(r, checkInterval));
        }

        return false;
    }

    /**
     * Count the number of business cards currently in the DOM
     * @returns {number}
     */
    countCards() {
        const selectors = [
            'div.Nv2PK',
            'a.hfpxzc',
            'div[jsaction*="mouseover"].lI9IFe',
        ];

        for (const selector of selectors) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) return cards.length;
        }

        return 0;
    }

    /**
     * Execute the full auto-scroll loop
     * @param {Object} options
     * @param {number} options.maxResults - Maximum number of results to collect
     * @param {number} options.scrollDelay - Delay between scrolls in ms
     * @param {Function} options.onProgress - Callback with (currentCount, maxResults)
     * @param {Function} options.shouldStop - Function that returns true to stop
     * @returns {Promise<void>}
     */
    async autoScroll({ maxResults = 30, scrollDelay = 2000, onProgress, shouldStop }) {
        if (!this.container) {
            this.findContainer();
        }

        if (!this.container) {
            throw new Error('Could not find scrollable results panel');
        }

        this.isScrolling = true;
        this.shouldStop = false;
        this.noNewCount = 0;
        this.lastScrollHeight = this.container.scrollHeight;

        let previousCount = 0;
        let stallCount = 0;
        const MAX_STALLS = 5;

        while (this.isScrolling && !(shouldStop && shouldStop())) {
            const currentCount = this.countCards();

            // Report progress
            if (onProgress) {
                onProgress(currentCount, maxResults);
            }

            // Enough results?
            if (currentCount >= maxResults) {
                break;
            }

            // End of results?
            if (this.isEndOfResults()) {
                break;
            }

            // Check for stalls (no new results after multiple scrolls)
            if (currentCount === previousCount) {
                stallCount++;
                if (stallCount >= MAX_STALLS) {
                    break;
                }
            } else {
                stallCount = 0;
            }
            previousCount = currentCount;

            // Scroll down
            this.scrollDown();

            // Wait for content to load with smart delay
            await this.smartWait(scrollDelay);

            // Additional wait if content hasn't loaded yet
            const contentLoaded = await this.waitForNewContent(currentCount, 3000);
            if (!contentLoaded) {
                // Extra scroll attempt if content didn't load
                this.scrollDown();
                await this.smartWait(scrollDelay / 2);
            }
        }

        this.isScrolling = false;
    }

    /**
     * Stop the auto-scroll loop
     */
    stop() {
        this.isScrolling = false;
        this.shouldStop = true;
    }

    /**
     * Reset the scroll handler state
     */
    reset() {
        this.isScrolling = false;
        this.shouldStop = false;
        this.noNewCount = 0;
        this.lastScrollHeight = 0;
        this.container = null;
    }
}

// Export a singleton instance for convenience
export const scrollHandler = new ScrollHandler();
