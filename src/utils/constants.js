// App-wide constants
export const APP_NAME = 'GeoLead AI';
export const APP_VERSION = '1.0.0';

// Chrome storage keys
export const STORAGE_KEYS = {
    LEADS: 'geolead_leads',
    SESSIONS: 'geolead_sessions',
    SETTINGS: 'geolead_settings',
    ONBOARDING_DONE: 'geolead_onboarding_done',
};

// Scraping states
export const SCRAPE_STATUS = {
    IDLE: 'idle',
    SCRAPING: 'scraping',
    PAUSED: 'paused',
    DONE: 'done',
    ERROR: 'error',
};

// Website status types
export const WEBSITE_STATUS = {
    NO_WEBSITE: 'NO_WEBSITE',
    HAS_WEBSITE: 'HAS_WEBSITE',
    NEEDS_REVAMP: 'NEEDS_REVAMP',
};

// Pitch status types
export const PITCH_STATUS = {
    PENDING: 'PENDING',
    GENERATING: 'GENERATING',
    GENERATED: 'GENERATED',
    FAILED: 'FAILED',
};

// Enrichment status types
export const ENRICHMENT_STATUS = {
    IDLE: 'IDLE',
    ENRICHING: 'ENRICHING',
    ENRICHED: 'ENRICHED',
    FAILED: 'FAILED',
    NO_WEBSITE: 'NO_WEBSITE',
};

// Lead score thresholds
export const LEAD_SCORE = {
    HOT: 10,
    WARM: 8,
    MEDIUM: 6,
    LOW: 3,
};

// Scrape speed delays in ms
export const SCRAPE_SPEED = {
    slow: 1500,
    medium: 800,
    fast: 400,
    ultra: 200,
};

// Default settings
export const DEFAULT_SETTINGS = {
    geminiApiKey: '',
    scrapeSpeed: 'medium',
    scrollDepth: 30,
    theme: 'dark',
};

// Message types for content script ↔ popup communication
export const MSG_TYPES = {
    START_SCRAPE: 'START_SCRAPE',
    STOP_SCRAPE: 'STOP_SCRAPE',
    SCRAPE_PROGRESS: 'SCRAPE_PROGRESS',
    SCRAPE_RESULT: 'SCRAPE_RESULT',
    SCRAPE_DONE: 'SCRAPE_DONE',
    SCRAPE_ERROR: 'SCRAPE_ERROR',
    GENERATE_PITCH: 'GENERATE_PITCH',
    PITCH_RESULT: 'PITCH_RESULT',
    CHECK_MAPS_PAGE: 'CHECK_MAPS_PAGE',
    MAPS_PAGE_STATUS: 'MAPS_PAGE_STATUS',
    INJECT_CONTENT_SCRIPT: 'INJECT_CONTENT_SCRIPT',

    // Agent / Enrichment
    ENRICH_LEADS: 'ENRICH_LEADS',
    ENRICH_PROGRESS: 'ENRICH_PROGRESS',
    ENRICH_RESULT: 'ENRICH_RESULT',
    ENRICH_ERROR: 'ENRICH_ERROR',
};
