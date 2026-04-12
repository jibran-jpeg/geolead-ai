import { create } from 'zustand';
import { SCRAPE_STATUS, PITCH_STATUS, ENRICHMENT_STATUS, STORAGE_KEYS, DEFAULT_SETTINGS } from '../../utils/constants';
import { calculateLeadScore } from '../../utils/leadScoring';
import { isDuplicate } from '../../utils/dedup';

// Helper: load from chrome storage
const loadFromStorage = async (key, fallback) => {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.local.get(key, (result) => {
                    resolve(result[key] ?? fallback);
                });
            });
        }
    } catch (e) {
        console.warn('Chrome storage not available:', e);
    }
    // Fallback to localStorage for dev
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch {
        return fallback;
    }
};

// Helper: save to chrome storage
const saveToStorage = async (key, value) => {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ [key]: value });
            return;
        }
    } catch (e) {
        console.warn('Chrome storage not available:', e);
    }
    // Fallback to localStorage for dev
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore */ }
};

// Helper: load settings from sync storage
const loadSettings = async () => {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, (result) => {
                    resolve({ ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) });
                });
            });
        }
    } catch (e) { /* ignore */ }
    try {
        const item = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return item ? { ...DEFAULT_SETTINGS, ...JSON.parse(item) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
};

const saveSettings = async (settings) => {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
            return;
        }
    } catch (e) { /* ignore */ }
    try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch { /* ignore */ }
};

const useStore = create((set, get) => ({
    // ===== STATE =====
    activeTab: 'dashboard',
    leads: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    selectedCategories: ['restaurant', 'hotel'],
    scrapeStatus: SCRAPE_STATUS.IDLE,
    scrapeProgress: 0,
    totalToScrape: 0,
    duplicatesSkipped: 0,
    isOnMapsPage: false,
    showOnboarding: false,
    toast: null,
    selectedLead: null,
    showEmailPreview: false,

    // Enrichment state
    enrichmentStatus: ENRICHMENT_STATUS.IDLE,
    enrichmentProgress: 0,
    enrichmentTotal: 0,
    enrichingLead: '',

    // ===== ACTIONS =====

    // Tab navigation
    setActiveTab: (tab) => set({ activeTab: tab }),

    // Category selection
    toggleCategory: (categoryId) => set((state) => {
        const selected = state.selectedCategories.includes(categoryId)
            ? state.selectedCategories.filter(id => id !== categoryId)
            : [...state.selectedCategories, categoryId];
        return { selectedCategories: selected };
    }),

    selectAllCategories: (allIds) => set({ selectedCategories: [...allIds] }),
    deselectAllCategories: () => set({ selectedCategories: [] }),

    // Leads management
    addLeads: (newLeads) => set((state) => {
        let duplicatesSkipped = 0;
        const leadsWithScores = [];

        newLeads.forEach(lead => {
            if (isDuplicate(lead, state.leads)) {
                duplicatesSkipped++;
                return;
            }
            leadsWithScores.push({
                ...lead,
                score: calculateLeadScore(lead),
            });
        });

        const updatedLeads = [...state.leads, ...leadsWithScores];
        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);

        return {
            leads: updatedLeads,
            duplicatesSkipped: state.duplicatesSkipped + duplicatesSkipped,
        };
    }),

    clearLeads: () => {
        saveToStorage(STORAGE_KEYS.LEADS, []);
        set({ leads: [], duplicatesSkipped: 0 });
    },

    updateLeadPitch: (leadId, pitch, status = PITCH_STATUS.GENERATED) => set((state) => {
        const updatedLeads = state.leads.map(lead =>
            lead.id === leadId ? { ...lead, pitch, pitchStatus: status } : lead
        );
        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);
        return { leads: updatedLeads };
    }),

    updateLeadSmsPitch: (leadId, smsPitch) => set((state) => {
        const updatedLeads = state.leads.map(lead =>
            lead.id === leadId ? { ...lead, smsPitch } : lead
        );
        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);
        return { leads: updatedLeads };
    }),

    updateLeadPitches: (leadId, emailPitch, smsPitch) => set((state) => {
        const updatedLeads = state.leads.map(lead =>
            lead.id === leadId ? { ...lead, pitch: emailPitch, smsPitch, pitchStatus: PITCH_STATUS.GENERATED } : lead
        );
        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);
        return { leads: updatedLeads };
    }),

    // Scraping status
    setScrapeStatus: (status) => set({ scrapeStatus: status }),
    setScrapeProgress: (progress, total) => set({ scrapeProgress: progress, totalToScrape: total }),

    // Maps page status
    setIsOnMapsPage: (isOn) => set({ isOnMapsPage: isOn }),

    // Settings
    updateSettings: (newSettings) => set((state) => {
        const updated = { ...state.settings, ...newSettings };
        saveSettings(updated);
        return { settings: updated };
    }),

    // Sessions
    addSession: (session) => set((state) => {
        const updated = [session, ...state.sessions].slice(0, 50); // keep last 50
        saveToStorage(STORAGE_KEYS.SESSIONS, updated);
        return { sessions: updated };
    }),

    // Onboarding
    setShowOnboarding: (show) => set({ showOnboarding: show }),
    completeOnboarding: () => {
        saveToStorage(STORAGE_KEYS.ONBOARDING_DONE, true);
        set({ showOnboarding: false });
    },

    // Toast
    showToast: (message, type = 'info') => {
        set({ toast: { message, type } });
        setTimeout(() => set({ toast: null }), 3000);
    },

    // Email preview modal
    openEmailPreview: (lead) => set({ selectedLead: lead, showEmailPreview: true }),
    closeEmailPreview: () => set({ selectedLead: null, showEmailPreview: false }),

    // Enrichment actions
    setEnrichmentStatus: (status) => set({ enrichmentStatus: status }),
    setEnrichmentProgress: (progress, total, currentLead) => set({
        enrichmentProgress: progress,
        enrichmentTotal: total,
        enrichingLead: currentLead || '',
    }),
    resetEnrichment: () => set({
        enrichmentStatus: ENRICHMENT_STATUS.IDLE,
        enrichmentProgress: 0,
        enrichmentTotal: 0,
        enrichingLead: '',
    }),

    // Update a single lead with enrichment data
    updateLeadEnrichment: (leadId, enrichmentData) => set((state) => {
        const updatedLeads = state.leads.map(lead =>
            lead.id === leadId ? { ...lead, ...enrichmentData } : lead
        );
        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);
        return { leads: updatedLeads };
    }),

    // Bulk update leads (after batch enrichment)
    bulkUpdateLeads: (enrichedLeads) => set((state) => {
        // Create a map of enriched data by id
        const enrichedMap = new Map();
        enrichedLeads.forEach(l => {
            if (l.id) enrichedMap.set(l.id, l);
        });

        const updatedLeads = state.leads.map(lead => {
            const enriched = enrichedMap.get(lead.id);
            return enriched ? { ...lead, ...enriched } : lead;
        });

        saveToStorage(STORAGE_KEYS.LEADS, updatedLeads);
        return { leads: updatedLeads };
    }),

    // Initialize: load saved data
    initialize: async () => {
        const leads = await loadFromStorage(STORAGE_KEYS.LEADS, []);
        const sessions = await loadFromStorage(STORAGE_KEYS.SESSIONS, []);
        const settings = await loadSettings();
        const onboardingDone = await loadFromStorage(STORAGE_KEYS.ONBOARDING_DONE, false);

        set({
            leads,
            sessions,
            settings,
            showOnboarding: !onboardingDone,
        });

        // Check if we're on Google Maps
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const isOnMaps = tabs[0]?.url?.includes('google.com/maps') || false;
                    set({ isOnMapsPage: isOnMaps });
                });
            }
        } catch { /* dev mode */ }
    },
}));

export default useStore;
