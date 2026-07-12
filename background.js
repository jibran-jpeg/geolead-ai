// Background service worker for GeoLead AI
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListeners();
    this.setupContextMenus();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  setupContextMenus() {
    chrome.contextMenus.create({
      id: 'geolead-scrape',
      title: 'Scrape this page with GeoLead',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.google.com/maps/*']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'geolead-scrape') {
        this.scrapeCurrentPage(tab.id);
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'START_SCRAPE':
          await this.startScraping(sender.tab.id, message);
          sendResponse({ success: true });
          break;

        case 'STOP_SCRAPE':
          this.stopScraping(sender.tab.id);
          sendResponse({ success: true });
          break;

        case 'GENERATE_PITCH':
          const pitch = await this.generatePitch(message);
          sendResponse({ success: true, pitch });
          break;

        case 'CHECK_MAPS_PAGE':
          const isMaps = this.isMapsPage(sender.tab.url);
          sendResponse({ isMaps, isRunning: this.isScraping(sender.tab.id) });
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Message handling error:', error);
      sendResponse({ error: error.message });
    }
  }

  async startScraping(tabId, options) {
    // Check if already scraping
    if (this.isScraping(tabId)) {
      throw new Error('Scraping already in progress');
    }

    // Validate tab
    if (!tabId) {
      throw new Error('No active tab found');
    }

    // Validate URL
    const tab = await chrome.tabs.get(tabId);
    if (!this.isMapsPage(tab.url)) {
      throw new Error('Google Maps page required');
    }

    // Inject content script
    await this.injectContentScript(tabId);

    // Send scrape command
    await chrome.tabs.sendMessage(tabId, {
      type: 'SCRAPE_START',
      categories: options.categories,
      scrollDepth: options.scrollDepth,
      speed: options.speed
    });

    // Track scraping session
    this.trackScraping(tabId);
  }

  stopScraping(tabId) {
    if (this.isScraping(tabId)) {
      chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_STOP' });
      this.untrackScraping(tabId);
    }
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (error) {
      console.error('[Background] Script injection failed:', error);
      throw new Error('Failed to load scraping engine');
    }
  }

  async generatePitch(message) {
    const { lead, apiKey, mode = 'email' } = message;
    
    if (!apiKey) {
      throw new Error('API key required');
    }

    // TODO: Implement actual Gemini API call
    // For now, return mock pitch
    return {
      emailPitch: `Hi ${lead.businessName},\n\nI noticed your business and wanted to reach out...\n\nBest regards,\nYour Name`,
      smsPitch: `Hi ${lead.businessName}, I noticed your business and wanted to connect...`
    };
  }

  isMapsPage(url) {
    return url && url.includes('google.com/maps');
  }

  isScraping(tabId) {
    // Check if tab is currently being scraped
    return this.activeScraping.has(tabId);
  }

  trackScraping(tabId) {
    this.activeScraping.add(tabId);
    
    // Auto-stop after 30 minutes
    const timeout = setTimeout(() => {
      this.stopScraping(tabId);
    }, 30 * 60 * 1000);

    this.scrapingTimeouts.set(tabId, timeout);
  }

  untrackScraping(tabId) {
    this.activeScraping.delete(tabId);
    
    const timeout = this.scrapingTimeouts.get(tabId);
    if (timeout) {
      clearTimeout(timeout);
      this.scrapingTimeouts.delete(tabId);
    }
  }

  // Storage helpers
  async saveLead(lead) {
    const result = await chrome.storage.local.get(['geoleadLeads']);
    const leads = result.geoleadLeads || [];
    leads.push(lead);
    await chrome.storage.local.set({ geoleadLeads: leads });
  }

  async getLeads() {
    const result = await chrome.storage.local.get(['geoleadLeads']);
    return result.geoleadLeads || [];
  }

  async clearLeads() {
    await chrome.storage.local.remove(['geoleadLeads']);
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Export for debugging
if (typeof window !== 'undefined') {
  window.geoleadBackground = backgroundService;
}