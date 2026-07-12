// Content script for Google Maps scraping
class ContentScraper {
  constructor() {
    this.isScraping = false;
    this.observer = null;
    this.scrollCount = 0;
    this.maxScrolls = 50;
    this.scrollDelay = 2000;
    this.collectedLeads = [];
    this.duplicates = new Set();
    this.scrapeInterval = null;
    
    this.init();
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
    this.scrollCount = 0;
    this.collectedLeads = [];
    this.duplicates.clear();
    this.maxScrolls = options.scrollDepth || 50;
    this.scrollDelay = options.speed || 2000;

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
    this.cleanup();
    
    chrome.runtime.sendMessage({
      type: 'SCRAPE_DONE',
      total: this.collectedLeads.length,
      duplicatesRemoved: this.duplicates.size
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

  startScrolling() {
    const scroll = () => {
      if (!this.isScraping || this.scrollCount >= this.maxScrolls) {
        this.stopScraping();
        return;
      }

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
    // Look for new results container
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

  extractLeads() {
    const leadElements = document.querySelectorAll('[role="article"]');
    const newLeads = [];

    leadElements.forEach(element => {
      const lead = this.parseLeadElement(element);
      if (lead && !this.duplicates.has(lead.id)) {
        newLeads.push(lead);
        this.duplicates.add(lead.id);
      }
    });

    if (newLeads.length > 0) {
      this.collectedLeads.push(...newLeads);
      
      chrome.runtime.sendMessage({
        type: 'SCRAPE_RESULT',
        leads: newLeads
      });
    }
  }

  parseLeadElement(element) {
    try {
      // Extract business name
      const nameElement = element.querySelector('h1, [role="heading"]');
      const businessName = nameElement?.textContent?.trim();

      if (!businessName) return null;

      // Extract category
      const categoryElement = element.querySelector('.seo-sort-type-text');
      const category = categoryElement?.textContent?.trim() || 'Unknown';

      // Extract rating and reviews
      const ratingElement = element.querySelector('.F7nice');
      const ratingText = ratingElement?.textContent?.trim() || '';
      const rating = ratingText ? parseFloat(ratingText) : null;
      const reviews = rating ? parseInt(ratingText.match(/\((\d+)\)/)?.[1] || '0') : 0;

      // Extract address
      const addressElement = element.querySelector('.W4Efsd, .Wui2rb');
      const address = addressElement?.textContent?.trim();

      // Extract phone
      const phoneElement = element.querySelector('[data-value*="tel"]');
      const phone = phoneElement?.getAttribute('data-value') || 
                   phoneElement?.textContent?.trim();

      // Extract website
      const websiteElement = element.querySelector('a[href*="http"]');
      const website = websiteElement?.href?.trim();

      // Determine website status
      const websiteStatus = this.getWebsiteStatus(website);

      // Generate unique ID
      const id = businessName + category + (phone || '');

      return {
        id: this.generateId(id),
        businessName,
        category,
        rating,
        reviews,
        address,
        phone: this.normalizePhone(phone),
        website,
        websiteStatus,
        scrapedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Content] Lead extraction error:', error);
      return null;
    }
  }

  getWebsiteStatus(website) {
    if (!website || website === '#') {
      return 'no_website';
    }
    
    try {
      const url = new URL(website);
      const domain = url.hostname.toLowerCase();
      
      if (domain.includes('google.com')) {
        return 'no_website';
      }
      
      if (domain.includes('wordpress.com') || 
          domain.includes('wix.com') || 
          domain.includes('squarespace.com')) {
        return 'needs_revamp';
      }
      
      return 'has_website';
    } catch {
      return 'no_website';
    }
  }

  normalizePhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone;
  }

  generateId(text) {
    return btoa(text).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
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

// Initialize scraper
const scraper = new ContentScraper();

// Export for debugging
if (typeof window !== 'undefined') {
  window.geoleadScraper = scraper;
}