/**
 * GeoLead AI — Background Service Worker (Manifest V3)
 *
 * Responsibilities:
 * 1. Relay messages between popup and content scripts
 * 2. Handle Gemini Pro API calls for pitch generation
 * 3. AI-powered lead enrichment (owner name, emails, phones)
 * 4. Manage extension lifecycle events
 * 5. Content script injection when needed
 */

import { generatePitch } from './geminiService.js';
import { batchEnrichLeads } from './agentService.js';

const MSG = {
    // Scraping
    START_SCRAPE: 'START_SCRAPE',
    STOP_SCRAPE: 'STOP_SCRAPE',
    SCRAPE_PROGRESS: 'SCRAPE_PROGRESS',
    SCRAPE_RESULT: 'SCRAPE_RESULT',
    SCRAPE_DONE: 'SCRAPE_DONE',
    SCRAPE_ERROR: 'SCRAPE_ERROR',
    CHECK_MAPS_PAGE: 'CHECK_MAPS_PAGE',
    MAPS_PAGE_STATUS: 'MAPS_PAGE_STATUS',

    // Pitch generation
    GENERATE_PITCH: 'GENERATE_PITCH',
    PITCH_RESULT: 'PITCH_RESULT',

    // Content script injection
    INJECT_CONTENT_SCRIPT: 'INJECT_CONTENT_SCRIPT',

    // Agent / Enrichment
    ENRICH_LEADS: 'ENRICH_LEADS',
    ENRICH_PROGRESS: 'ENRICH_PROGRESS',
    ENRICH_RESULT: 'ENRICH_RESULT',
    ENRICH_ERROR: 'ENRICH_ERROR',
};

// ====== MESSAGE ROUTER ======

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --- Pitch generation (from popup) ---
    if (message.type === MSG.GENERATE_PITCH) {
        generatePitch(message.lead, message.apiKey, message.pitchType, message.mode || 'email')
            .then(result => sendResponse(result))
            .catch(err => {
                console.error('[GeoLead BG] Pitch generation error:', err);
                sendResponse({ error: err.message });
            });
        return true; // Keep channel open for async
    }

    // --- Content script injection request (from popup) ---
    if (message.type === MSG.INJECT_CONTENT_SCRIPT) {
        injectContentScript(message.tabId)
            .then(result => sendResponse({ success: true, result }))
            .catch(err => {
                console.error('[GeoLead BG] Injection error:', err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    // --- AI Lead Enrichment (from popup) ---
    if (message.type === MSG.ENRICH_LEADS) {
        const { leads, apiKey } = message;

        batchEnrichLeads(leads, apiKey, (completed, total, currentName) => {
            // Send progress back to popup
            chrome.runtime.sendMessage({
                type: MSG.ENRICH_PROGRESS,
                completed,
                total,
                currentLead: currentName,
            }).catch(() => { });
        })
            .then(enrichedLeads => {
                sendResponse({ enrichedLeads });
            })
            .catch(err => {
                console.error('[GeoLead BG] Enrichment error:', err);
                sendResponse({ error: err.message });
            });

        return true; // Keep channel open for async
    }

    // --- Manifest V3 Keep Alive ---
    if (message.type === 'PING_KEEP_ALIVE') {
        // Just acknowledging the message keeps the worker alive
        sendResponse({ status: 'alive' });
        return false;
    }

    // --- Relay scrape messages from content script to popup ---
    // When content script sends SCRAPE_PROGRESS, SCRAPE_RESULT, SCRAPE_DONE, SCRAPE_ERROR,
    // these are automatically received by the popup since both listen on chrome.runtime.onMessage
    // No relay needed in MV3 since content scripts use chrome.runtime.sendMessage

    return false;
});


// ====== CONTENT SCRIPT INJECTION ======

/**
 * Programmatically inject the content script into a tab
 * Useful when navigating to Maps after the extension is already loaded
 */
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js'],
        });
        console.log(`[GeoLead BG] Content script injected into tab ${tabId}`);
        return true;
    } catch (err) {
        console.error(`[GeoLead BG] Failed to inject content script:`, err);
        throw err;
    }
}


// ====== EXTENSION LIFECYCLE ======

// On install or update
chrome.runtime.onInstalled.addListener((details) => {
    console.log(`🌐 GeoLead AI extension ${details.reason}: v${chrome.runtime.getManifest().version}`);

    if (details.reason === 'install') {
        // Set default settings on first install
        chrome.storage.sync.set({
            geolead_settings: {
                geminiApiKey: '',
                scrapeSpeed: 'medium',
                scrollDepth: 30,
                theme: 'dark',
            }
        });
    }
});

// Side panel toggle
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Tab update listener — auto-detect Google Maps pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const isGoogleMaps = tab.url.includes('google.') && (tab.url.includes('/maps') || tab.url.includes('maps.google.'));

        if (isGoogleMaps) {
            // Update extension icon to indicate active state
            chrome.action.setBadgeText({ text: '●', tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#22c55e', tabId });

            // Try to inject content script if not already injected
            chrome.tabs.sendMessage(tabId, { type: MSG.CHECK_MAPS_PAGE }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // Content script not loaded yet, inject it
                    injectContentScript(tabId).catch(() => {
                        // Injection failed — page might not be ready yet
                    });
                }
            });
        } else {
            // Clear badge for non-Maps tabs
            chrome.action.setBadgeText({ text: '', tabId });
        }
    }
});

console.log('🌐 GeoLead AI background service worker running');
