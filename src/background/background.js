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
import { batchEnrichLeads, fetchContactsFromWebsite } from './agentService.js';

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

// ====== SERIALIZED STORAGE QUEUE ======
let storageQueue = Promise.resolve();

function updateStorageState(updateFn) {
    const nextPromise = storageQueue
        .then(() => {
            return new Promise((resolve) => {
                chrome.storage.local.get(['geolead_state'], (result) => {
                    const state = result.geolead_state || {};
                    try {
                        const updatedState = updateFn(state);
                        chrome.storage.local.set({ geolead_state: updatedState }, () => {
                            resolve(updatedState);
                        });
                    } catch (err) {
                        console.error('[GeoLead BG] Error in updateStorageState updateFn:', err);
                        resolve(state); // Resolve with old state so queue doesn't stall
                    }
                });
            });
        })
        .catch((err) => {
            console.error('[GeoLead BG] Error in storageQueue chain:', err);
            return {};
        });
    storageQueue = nextPromise;
    return nextPromise;
}

// ====== SESSION MANAGEMENT ======
function createNewSession(searchQuery, settings) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
        id: sessionId,
        searchQuery: searchQuery,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'running',
        settings: { ...settings },
        metadata: {
            targetLeads: settings.scrollDepth,
            leadsCollected: 0,
            businessesVisited: 0,
            scrapingDuration: 0,
            duplicatesRemoved: 0
        },
        leads: [],
        pagination: {
            currentPage: 1,
            leadsPerPage: 50,
            totalPages: 1
        }
    };
    return session;
}

function updateSession(sessionId, updateFn) {
    return updateStorageState((state) => {
        const sessions = state.sessions || {};
        const session = sessions[sessionId];
        if (!session) return state;
        
        const updatedSession = updateFn(session);
        updatedSession.updatedAt = new Date().toISOString();
        sessions[sessionId] = updatedSession;
        
        return {
            ...state,
            sessions: sessions,
            currentSessionId: sessionId
        };
    });
}

function addLeadsToSession(sessionId, leads) {
    return updateSession(sessionId, (session) => {
        const newLeads = leads || [];
        const existingLeads = session.leads || [];
        
        // Deduplicate leads within the session
        const seenIds = new Set(existingLeads.map(l => l.id || l.businessName));
        const uniqueNewLeads = newLeads.filter(lead => {
            const leadId = lead.id || lead.businessName;
            return !seenIds.has(leadId);
        });
        
        const updatedLeads = [...existingLeads, ...uniqueNewLeads];
        const duplicatesRemoved = newLeads.length - uniqueNewLeads.length;
        
        // Update metadata
        session.metadata.leadsCollected = updatedLeads.length;
        session.metadata.duplicatesRemoved = duplicatesRemoved;
        
        // Update pagination
        session.pagination.totalPages = Math.ceil(updatedLeads.length / session.pagination.leadsPerPage);
        if (session.pagination.currentPage > session.pagination.totalPages) {
            session.pagination.currentPage = session.pagination.totalPages;
        }
        
        session.leads = updatedLeads;
        return session;
    });
}

function completeSession(sessionId, durationMs, finalLeadsCount) {
    return updateStorageState((state) => {
        const sessions = state.sessions || {};
        const session = sessions[sessionId];
        if (!session) return state;
        
        session.status = 'completed';
        session.metadata.scrapingDuration = durationMs;
        if (finalLeadsCount !== undefined) {
            session.metadata.leadsCollected = finalLeadsCount;
        } else if (session.leads) {
            session.metadata.leadsCollected = session.leads.length;
        }
        session.updatedAt = new Date().toISOString();
        sessions[sessionId] = session;
        
        const nextState = {
            ...state,
            sessions: sessions,
            currentSessionId: sessionId
        };
        
        if (nextState.activeScrapingSessionId === sessionId) {
            nextState.activeScrapingSessionId = null;
        }
        
        return nextState;
    });
}

function deleteSession(sessionId) {
    return updateStorageState((state) => {
        const sessions = state.sessions || {};
        delete sessions[sessionId];
        
        // Clear current session if it's the one being deleted
        const currentSessionId = state.currentSessionId;
        if (currentSessionId === sessionId) {
            state.currentSessionId = null;
        }
        
        const nextState = {
            ...state,
            sessions: sessions
        };
        
        if (nextState.activeScrapingSessionId === sessionId) {
            nextState.activeScrapingSessionId = null;
        }
        
        return nextState;
    });
}

// ====== MESSAGE ROUTER ======

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --- Fetch Contacts directly from business website (from content script during scrape) ---
    if (message.type === 'SCRAPE_FETCH_CONTACTS') {
        const { website, businessName } = message;
        fetchContactsFromWebsite(website, businessName)
            .then(result => sendResponse(result))
            .catch(err => {
                console.error('[GeoLead BG] Fetch contacts error:', err);
                sendResponse({ emails: [], phones: [] });
            });
        return true; // Keep channel open for async
    }

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

    // --- Start Scrape Session (inject + send from background, more reliable than popup->tab) ---
    if (message.type === 'START_SCRAPE_SESSION') {
        const { tabId, config } = message;

        const trySendStartScrape = (retriesLeft) => {
            chrome.tabs.sendMessage(tabId, { type: MSG.START_SCRAPE, ...config }, (res) => {
                if (chrome.runtime.lastError) {
                    if (retriesLeft > 0) {
                        setTimeout(() => trySendStartScrape(retriesLeft - 1), 700);
                    } else {
                        sendResponse({ success: false, error: 'Content script not reachable' });
                    }
                } else {
                    sendResponse({ success: true, response: res });
                }
            });
        };

        // Try inject first (if already injected, it will fail silently and we proceed)
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js'],
        }).catch(() => {
            // Ignore — already injected is fine
        }).finally(() => {
            // Wait briefly then send, with retries
            setTimeout(() => trySendStartScrape(4), 600);
        });

        return true; // keep message channel open for async sendResponse
    }

    // --- AI Lead Enrichment (from popup) ---
    if (message.type === MSG.ENRICH_LEADS) {
        const { leads, apiKey } = message;

        // Set isEnriching state in storage
        updateStorageState((state) => {
            state.enrichProgress = { completed: 0, total: leads.length, currentLead: 'Starting...', isEnriching: true };
            return state;
        });

        batchEnrichLeads(leads, apiKey, (completed, total, currentName) => {
            // Update progress in storage
            updateStorageState((state) => {
                state.enrichProgress = { completed, total, currentLead: currentName, isEnriching: true };
                return state;
            });
            // Send progress back to popup (if open)
            chrome.runtime.sendMessage({
                type: MSG.ENRICH_PROGRESS,
                completed,
                total,
                currentLead: currentName
            }).catch(() => { });
        })
            .then(enrichedLeads => {
                // Update leads in storage with enriched data
                updateStorageState((state) => {
                    state.leads = enrichedLeads;
                    state.enrichProgress = { completed: leads.length, total: leads.length, currentLead: 'Done!', isEnriching: false };
                    return state;
                }).then(() => {
                    try {
                        sendResponse({ enrichedLeads });
                    } catch (e) {
                        // Response channel might be closed if popup closed
                    }
                });
            })
            .catch(err => {
                console.error('[GeoLead BG] Enrichment error:', err);
                updateStorageState((state) => {
                    state.enrichProgress = { completed: 0, total: 0, currentLead: '', isEnriching: false, error: err.message };
                    return state;
                }).then(() => {
                    try {
                        sendResponse({ error: err.message });
                    } catch (e) {
                        // Response channel might be closed
                    }
                });
            });

        return true; // Keep channel open for async
    }

    // --- Manifest V3 Keep Alive ---
    if (message.type === 'PING_KEEP_ALIVE') {
        // Just acknowledging the message keeps the worker alive
        sendResponse({ status: 'alive' });
        return false;
    }

    // --- Scraping Messages (persist to storage for popup sync) ---
    if (message.type === MSG.SCRAPE_PROGRESS) {
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            const sessionId = message.sessionId || state.activeScrapingSessionId || state.currentSessionId;
            
            if (sessionId && sessions[sessionId]) {
                // Update session progress
                sessions[sessionId].metadata.leadsCollected = message.found;
                sessions[sessionId].metadata.targetLeads = message.total;
                sessions[sessionId].updatedAt = new Date().toISOString();
            }
            
            // Keep backward compatibility with old scrapeStatus
            state.scrapeStatus = 'scraping';
            state.scrapeProgress = { found: message.found, total: message.total };
            
            return { ...state, sessions };
        });
        return false;
    }

    if (message.type === MSG.SCRAPE_RESULT) {
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            const sessionId = message.sessionId || state.activeScrapingSessionId || state.currentSessionId;
            
            if (sessionId && sessions[sessionId]) {
                // Add leads to current session
                const session = sessions[sessionId];
                if (!session.leads) session.leads = [];
                if (!session.metadata) {
                    session.metadata = {
                        targetLeads: 30,
                        leadsCollected: 0,
                        businessesVisited: 0,
                        scrapingDuration: 0,
                        duplicatesRemoved: 0
                    };
                }
                if (!session.pagination) {
                    session.pagination = {
                        currentPage: 1,
                        leadsPerPage: 50,
                        totalPages: 1
                    };
                }

                const newLeads = message.leads || [];
                const existingLeads = session.leads || [];
                
                // Deduplicate leads within the session
                const seenIds = new Set(existingLeads.map(l => l.id || l.businessName));
                const uniqueNewLeads = newLeads.filter(lead => {
                    const leadId = lead.id || lead.businessName;
                    return !seenIds.has(leadId);
                });
                
                const updatedLeads = [...existingLeads, ...uniqueNewLeads];
                const duplicatesRemoved = newLeads.length - uniqueNewLeads.length;
                
                // Update session metadata
                session.metadata.leadsCollected = updatedLeads.length;
                session.metadata.duplicatesRemoved = duplicatesRemoved;
                session.metadata.businessesVisited = (session.metadata.businessesVisited || 0) + uniqueNewLeads.length;
                session.leads = updatedLeads;
                session.updatedAt = new Date().toISOString();
                
                // Update pagination
                session.pagination.totalPages = Math.ceil(updatedLeads.length / session.pagination.leadsPerPage);
                if (session.pagination.currentPage > session.pagination.totalPages) {
                    session.pagination.currentPage = session.pagination.totalPages;
                }
            }
            
            // Keep backward compatibility with old leads structure (deprecated)
            const currentLeads = state.leads || [];
            const newLeads = message.leads || [];
            
            const updatedLeads = [...currentLeads];
            newLeads.forEach(nl => {
                const id = nl.id || nl.businessName;
                if (!updatedLeads.some(l => (l.id || l.businessName) === id)) {
                    updatedLeads.push(nl);
                }
            });
            
            state.leads = updatedLeads;
            
            // Ensure activeScrapingSessionId is set if we have a valid session ID
            if (sessionId && sessions[sessionId]) {
                state.activeScrapingSessionId = sessionId;
            }
            
            return { ...state, sessions };
        }).then((updatedState) => {
            try {
                sendResponse({ success: true, state: updatedState });
            } catch (e) {
                // Ignore channel closed
            }
        });
        return true;
    }

    if (message.type === MSG.SCRAPE_DONE) {
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            const sessionId = message.sessionId || state.activeScrapingSessionId || state.currentSessionId;
            const scrapeStartTime = state.scrapeStartTime || Date.now();
            const durationMs = Date.now() - scrapeStartTime;
            
            if (sessionId && sessions[sessionId]) {
                // Complete the session
                sessions[sessionId].status = 'completed';
                sessions[sessionId].metadata.scrapingDuration = durationMs;
                if (sessions[sessionId].leads) {
                    sessions[sessionId].metadata.leadsCollected = sessions[sessionId].leads.length;
                }
                sessions[sessionId].updatedAt = new Date().toISOString();
            }
            
            // Keep backward compatibility with old scrapeStatus
            state.scrapeStatus = 'done';
            state.scrapeProgress = { found: message.total, total: message.total };
            state.scrapingTabId = null;
            state.activeScrapingSessionId = null;
            
            return { ...state, sessions };
        });
        return false;
    }

    if (message.type === MSG.SCRAPE_ERROR) {
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            const sessionId = message.sessionId || state.activeScrapingSessionId || state.currentSessionId;
            
            if (sessionId && sessions[sessionId]) {
                // Mark session as failed
                sessions[sessionId].status = 'failed';
                sessions[sessionId].updatedAt = new Date().toISOString();
            }
            
            // Keep backward compatibility with old scrapeStatus
            state.scrapeStatus = 'error';
            state.scrapeError = message.error;
            state.scrapingTabId = null;
            state.activeScrapingSessionId = null;
            
            return { ...state, sessions };
        });
        return false;
    }

    // --- New Session Management Messages ---
    if (message.type === 'CREATE_SESSION') {
        const session = message.session || createNewSession(message.searchQuery, message.settings);
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            sessions[session.id] = session;
            
            return {
                ...state,
                sessions: sessions,
                currentSessionId: session.id,
                activeScrapingSessionId: session.id,
                scrapeStatus: 'scraping',
                scrapeStartTime: Date.now()
            };
        });
        return false;
    }

    if (message.type === 'GET_SESSIONS') {
        chrome.storage.local.get(['geolead_state'], (result) => {
            const state = result.geolead_state || {};
            const sessions = state.sessions || {};
            const sessionsList = Object.values(sessions).sort((a, b) => 
                new Date(b.createdAt) - new Date(a.createdAt)
            );
            sendResponse({ sessions: sessionsList });
        });
        return true;
    }

    if (message.type === 'GET_SESSION') {
        chrome.storage.local.get(['geolead_state'], (result) => {
            const state = result.geolead_state || {};
            const sessions = state.sessions || {};
            const session = sessions[message.sessionId];
            sendResponse({ session });
        });
        return true;
    }

    if (message.type === 'DELETE_SESSION') {
        deleteSession(message.sessionId).then(() => {
            sendResponse({ success: true });
        }).catch(() => {
            sendResponse({ success: false, error: 'Failed to delete session' });
        });
        return true;
    }

    if (message.type === 'RENAME_SESSION') {
        updateStorageState((state) => {
            const sessions = state.sessions || {};
            const session = sessions[message.sessionId];
            if (session) {
                session.customName = message.newName;
                session.updatedAt = new Date().toISOString();
            }
            return { ...state, sessions };
        }).then(() => {
            sendResponse({ success: true });
        }).catch(() => {
            sendResponse({ success: false, error: 'Failed to rename session' });
        });
        return true;
    }

    if (message.type === 'EXPORT_SESSION') {
        chrome.storage.local.get(['geolead_state'], (result) => {
            const state = result.geolead_state || {};
            const sessions = state.sessions || {};
            const session = sessions[message.sessionId];
            sendResponse({ session });
        });
        return true;
    }

    if (message.type === 'COMPLETE_SESSION') {
        completeSession(message.sessionId, message.durationMs, message.finalLeadsCount).then(() => {
            sendResponse({ success: true });
        }).catch(() => {
            sendResponse({ success: false, error: 'Failed to complete session' });
        });
        return true;
    }

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
        
        // Initialize sessions storage structure
        chrome.storage.local.get(['geolead_state'], (result) => {
            const state = result.geolead_state || {};
            if (!state.sessions) {
                state.sessions = {};
                chrome.storage.local.set({ geolead_state: state });
            }
        });
    }
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
