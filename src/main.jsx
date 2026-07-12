import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Play, 
  Target,
  Square, 
  Settings, 
  LayoutDashboard, 
  ListPlus,
  Search, 
  Copy, 
  Check, 
  FileDown, 
  Sparkles, 
  RefreshCw, 
  X, 
  Globe, 
  Phone, 
  MapPin, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  MessageSquare,
  Mail,
  Trash2,
  ExternalLink,
  Edit,
  Building,
  Star,
  MessageCircle,
  Calendar,
  Clock,
  Map,
  Link,
  User,
  Briefcase,
  Navigation,
  ChevronLeft,
  FlaskConical
} from 'lucide-react';
import './index.css';

// Default list of business categories
const DEFAULT_CATEGORIES = [
  'Restaurant', 'Coffee Shop', 'Bar', 'Pizza', 'Bakery',
  'Dentist', 'Doctor', 'Pharmacy', 'Gym', 'Spa',
  'Hair Salon', 'Hotel', 'Auto Repair', 'Lawyer', 'Real Estate'
];

// Upgraded 10-Point Lead Quality Scoring Model (Optimized for Website Builders & Agencies)
const calculateLeadQualityScore = (lead) => {
  if (!lead) return 1;
  
  let score = 0.0;
  
  // 1. Website Status & Pitch Angle (Max 4.0 points)
  const hasWebsite = !!lead.website;
  if (!hasWebsite) {
    // Goldmine target: completely lacks a web presence
    score += 4.0;
  } else {
    // Check if website has security / SSL issues
    const analysis = lead.websiteAnalysis || {};
    const hasNoSsl = !analysis.httpsEnabled || lead.websiteStatus === 'NO_HTTPS';
    if (hasNoSsl) {
      score += 1.5; // Pitch SSL security and optimization
    }
  }
  
  // 2. Financial Capacity / Local Activity (Max 2.5 points)
  // Higher rating and review count means the business is active, successful, and has budget
  const rating = parseFloat(lead.rating);
  const reviews = parseInt(lead.reviewCount);
  
  if (!isNaN(rating) && rating > 0) {
    score += Math.min(1.0, (rating / 5) * 1.0);
  }
  
  if (!isNaN(reviews) && reviews > 0) {
    score += Math.min(1.5, Math.log10(reviews + 1) / 2);
  }
  
  // 3. Marketing Intent / Online Awareness (Max 2.0 points)
  // Active social media profiles indicate they care about digital presence
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
  
  if (socialCount >= 3) score += 2.0;
  else if (socialCount === 2) score += 1.0;
  else if (socialCount === 1) score += 0.5;
  
  // 4. Contact Accessibility (Max 1.5 points)
  const hasPhone = !!lead.phone;
  const hasEmail = (lead.emails && lead.emails.length > 0) || !!lead.email;
  
  if (hasPhone && hasEmail) score += 1.5;
  else if (hasEmail) score += 0.75;
  else if (hasPhone) score += 0.5;
  
  // Normalize and clamp between 1.0 and 10.0
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
};


const qualifyLead = (lead, qualityScore) => {
  const hasWebsite = !!lead.website;
  if (!hasWebsite) {
    return 'High'; // Goldmine lead for a website builder!
  }
  
  // If they have a website but it lacks SSL/HTTPS, it is a Medium opportunity
  const analysis = lead.websiteAnalysis || {};
  const hasNoSsl = !analysis.httpsEnabled || lead.websiteStatus === 'NO_HTTPS';
  if (hasNoSsl) {
    return 'Medium';
  }
  
  return 'Low';
};

const calculateLeadScore = (lead) => {
  const score = calculateLeadQualityScore(lead);
  const priority = qualifyLead(lead, score);
  let className = 'score-low';
  if (score >= 8) {
    className = 'score-high';
  } else if (score >= 5) {
    className = 'score-medium';
  }
  return { score, label: priority, class: className };
};

// Initial state template
const INITIAL_STATE = {
  activeTab: 'dashboard',
  leads: [], // Deprecated - kept for backward compatibility
  scrapeStatus: 'idle', // idle, scraping, done, error
  scrapeProgress: { found: 0, total: 30 },
  scrapeError: '',
  selectedCategories: [],
  isOnMapsPage: null,
  activeTabId: null,
  scrapingTabId: null,
  enrichProgress: { completed: 0, total: 0, currentLead: '', isEnriching: false },
  sessions: {}, // New session-based storage
  currentSessionId: null, // Currently active session
  activeScrapingSessionId: null, // Active scraping session
  settings: {
    scrollDepth: 30,
    scrapeSpeed: 'medium',
    geminiApiKey: '',
    onlyWithoutWebsite: false
  }
};

// Lead Preview Component with performance optimization
const LeadPreview = React.memo(({ lead, position, onClose }) => {
  if (!lead) return null;

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Extract address components
  const addressParts = lead.address ? lead.address.split(', ') : [];
  const city = addressParts[addressParts.length - 2] || '';
  const country = addressParts[addressParts.length - 1] || '';

  // Check if business is likely open (based on hours if available)
  const isOpen = lead.hours && !lead.hours.toLowerCase().includes('closed');

  return (
    <div className="lead-preview" style={{ animation: 'fadeInScale 0.2s ease-out' }}>
      <div 
        className="lead-preview-card"
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
        }}
      >
      <div className="lead-preview-card">
        <div className="lead-preview-header">
          <div className="lead-preview-title">{lead.businessName}</div>
          <div className="lead-preview-subtitle">{lead.category || 'Unknown Category'}</div>
          <button 
            className="lead-preview-close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="lead-preview-content">
          {/* Rating and Reviews */}
          {(lead.rating || lead.reviewCount) && (
            <div className="preview-field">
              <div className="field-icon">
                <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
              </div>
              <div className="field-content">
                <div className="field-label">Rating</div>
                <div className="field-value">
                  {lead.rating ? `${lead.rating} ⭐` : 'N/A'}
                  {lead.reviewCount && <span className="review-count"> • {lead.reviewCount} reviews</span>}
                </div>
              </div>
            </div>
          )}

          {/* Phone Number */}
          {lead.phone && (
            <div className="preview-field">
              <div className="field-icon">
                <Phone size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Phone</div>
                <div className="field-value">{lead.phone}</div>
              </div>
            </div>
          )}

          {/* Email Address */}
          {lead.emails && lead.emails.length > 0 && (
            <div className="preview-field">
              <div className="field-icon">
                <Mail size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Email</div>
                <div className="field-value">{lead.emails.join(', ')}</div>
              </div>
            </div>
          )}

          {/* Website */}
          {lead.website && (
            <div className="preview-field">
              <div className="field-icon">
                <Globe size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Website</div>
                <div className="field-value">
                  <a 
                    href={lead.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="website-link"
                  >
                    {lead.website}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {lead.address && (
            <div className="preview-field">
              <div className="field-icon">
                <MapPin size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Address</div>
                <div className="field-value">{lead.address}</div>
                {city && country && (
                  <div className="field-subtitle">{city}, {country}</div>
                )}
              </div>
            </div>
          )}

          {/* Business Status */}
          {lead.hours && (
            <div className="preview-field">
              <div className="field-icon">
                <Clock size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Status</div>
                <div className={`field-value ${isOpen ? 'status-open' : 'status-closed'}`}>
                  {isOpen ? '🟢 Open' : '🔴 Closed'}
                </div>
              </div>
            </div>
          )}

          {/* Date Scraped */}
          {lead.scrapedAt && (
            <div className="preview-field">
              <div className="field-icon">
                <Calendar size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Date Scraped</div>
                <div className="field-value">{formatDate(lead.scrapedAt)}</div>
              </div>
            </div>
          )}

          {/* Session Information */}
          {lead.sessionId && (
            <div className="preview-field">
              <div className="field-icon">
                <Briefcase size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Session</div>
                <div className="field-value">{lead.sessionId}</div>
              </div>
            </div>
          )}

          {/* Instagram */}
          {lead.instagram && (
            <div className="preview-field">
              <div className="field-icon">
                <MessageCircle size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Instagram</div>
                <div className="field-value">
                  <a 
                    href={lead.instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="instagram-link"
                  >
                    {lead.instagram}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Owner/Manager Name */}
          {lead.ownerName && (
            <div className="preview-field">
              <div className="field-icon">
                <User size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Owner/Manager</div>
                <div className="field-value">{lead.ownerName}</div>
              </div>
            </div>
          )}

          {/* Services */}
          {lead.services && (
            <div className="preview-field">
              <div className="field-icon">
                <Briefcase size={14} />
              </div>
              <div className="field-content">
                <div className="field-label">Services</div>
                <div className="field-value">{lead.services}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if lead, position, or onClose function changes
  return (
    prevProps.lead === nextProps.lead &&
    prevProps.position.x === nextProps.position.x &&
    prevProps.position.y === nextProps.position.y &&
    prevProps.onClose === nextProps.onClose
  );
});

const App = () => {
  const [rawState, setRawState] = useState(INITIAL_STATE);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWithoutWebsite, setFilterWithoutWebsite] = useState(false);
  const [toast, setToast] = useState(null);
  const [hoveredLead, setHoveredLead] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [previewLead, setPreviewLead] = useState(null);

  // Safe proxy state object with fallback defaults to prevent TypeError crash
  const state = {
    activeTab: rawState.activeTab || 'dashboard',
    leads: rawState.leads || [], // Deprecated - kept for backward compatibility
    scrapeStatus: rawState.scrapeStatus || 'idle',
    scrapeProgress: rawState.scrapeProgress || INITIAL_STATE.scrapeProgress,
    scrapeError: rawState.scrapeError || '',
    selectedCategories: rawState.selectedCategories || [],
    isOnMapsPage: rawState.isOnMapsPage || false,
    activeTabId: rawState.activeTabId || null,
    scrapingTabId: rawState.scrapingTabId || null,
    enrichProgress: rawState.enrichProgress || INITIAL_STATE.enrichProgress,
    sessions: rawState.sessions || {},
    currentSessionId: rawState.currentSessionId || null,
    settings: {
      ...INITIAL_STATE.settings,
      ...(rawState.settings || {})
    }
  };

  // Get current session data
  const currentSession = state.currentSessionId ? state.sessions[state.currentSessionId] : null;
  const currentSessionLeads = currentSession ? currentSession.leads || [] : [];
  
  // Use current session's leads if active, otherwise fall back to legacy/global leads
  const effectiveLeads = currentSession ? currentSessionLeads : state.leads;

  const setState = (updateFn) => {
    setRawState(prev => {
      const result = typeof updateFn === 'function' ? updateFn(prev) : updateFn;
      return result;
    });
  };

  // Sync state from chrome.storage.local on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['geolead_state'], (result) => {
        let loadedState = { ...INITIAL_STATE };
        if (result.geolead_state) {
          loadedState = {
            ...INITIAL_STATE,
            ...result.geolead_state,
            // Start with sessions list on popup open unless a scrape is currently active
            currentSessionId: (result.geolead_state.scrapeStatus === 'scraping' && result.geolead_state.activeScrapingSessionId)
              ? result.geolead_state.activeScrapingSessionId
              : null,
            settings: {
              ...INITIAL_STATE.settings,
              ...(result.geolead_state.settings || {})
            }
          };
        }

        // Migrate legacy leads to a default session if no sessions exist and not yet migrated
        if (!loadedState.legacy_migrated && loadedState.leads && loadedState.leads.length > 0 && (!loadedState.sessions || Object.keys(loadedState.sessions).length === 0)) {
          const legacySessionId = 'legacy_' + Date.now();
          const legacySession = {
            id: legacySessionId,
            searchQuery: 'Imported Leads',
            customName: 'Imported Leads',
            createdAt: new Date().toISOString(),
            status: 'completed',
            metadata: {
              targetLeads: loadedState.leads.length,
              leadsCollected: loadedState.leads.length,
              businessesVisited: loadedState.leads.length,
              scrapingDuration: 0,
              duplicatesRemoved: 0
            },
            leads: loadedState.leads,
            pagination: {
              currentPage: 1,
              leadsPerPage: 50,
              totalPages: 1
            }
          };
          loadedState.sessions = { [legacySessionId]: legacySession };
          loadedState.currentSessionId = legacySessionId;
          loadedState.leads = [];
          loadedState.legacy_migrated = true;
          
          // Save to storage
          chrome.storage.local.set({ geolead_state: loadedState });
        } else if (!loadedState.legacy_migrated) {
          // Mark as migrated to prevent any future migration checks
          loadedState.legacy_migrated = true;
          chrome.storage.local.set({ geolead_state: loadedState });
        }

        const runActiveTabCheck = (currentState) => {
          if (chrome.tabs) {
            // Search for Google Maps tab across ALL windows (not just currentWindow,
            // because when popup is open it becomes currentWindow and hides the real Maps tab)
            const mapsUrlPatterns = [
              '*://www.google.com/maps/*',
              '*://maps.google.com/*',
              '*://www.google.com.pk/maps/*',
              '*://maps.google.com.pk/*'
            ];
            chrome.tabs.query({ url: mapsUrlPatterns }, (mapsTabs) => {
              if (mapsTabs && mapsTabs.length > 0) {
                // Prefer the most recently active Maps tab
                const activeTab = mapsTabs.find(t => t.active) || mapsTabs[mapsTabs.length - 1];
                setRawState(prev => {
                  return {
                    ...prev,
                    isOnMapsPage: true,
                    activeTabId: activeTab.id
                  };
                });
              } else {
                // No Maps tab found — mark as not on Maps
                setRawState(prev => {
                  return { ...prev, isOnMapsPage: false, activeTabId: null };
                });
              }
            });
          }
        };

        // Verify if a background scrape job is active and still running
        if (loadedState.scrapeStatus === 'scraping' && loadedState.scrapingTabId && chrome.tabs) {
          chrome.tabs.get(loadedState.scrapingTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
              // Tab was closed, reset scraping state in popup UI only
              setRawState(prev => ({
                ...prev,
                scrapeStatus: 'idle',
                scrapingTabId: null
              }));
              runActiveTabCheck(loadedState);
            } else {
              // Tab exists, ping content script to check if it's still running
              chrome.tabs.sendMessage(loadedState.scrapingTabId, { type: 'CHECK_MAPS_PAGE' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.isRunning) {
                  // Content script is dead or scraper is stopped, update popup UI only
                  setRawState(prev => ({
                    ...prev,
                    scrapeStatus: 'idle',
                    scrapingTabId: null
                  }));
                } else {
                  // Scraper is active! Sync progress (update only React state, background will persist progress/leads)
                  setRawState(prev => ({
                    ...prev,
                    scrapeProgress: { found: response.found || 0, total: response.total || 30 }
                  }));
                }
                runActiveTabCheck(loadedState);
              });
            }
          });
        } else {
          // No scraping active
          setRawState(loadedState);
          runActiveTabCheck(loadedState);
        }
      });
    }

    // Listener for state changes in storage (from background service worker)
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.geolead_state && changes.geolead_state.newValue) {
        setRawState(prev => ({
          ...prev,
          ...changes.geolead_state.newValue
        }));
      }
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  // Update storage & state helper
  const saveStateToStorage = (newState) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ geolead_state: newState });
    }
    setRawState(newState);
  };

  const updateStateField = (field, value) => {
    setRawState(prev => {
      const updated = { ...prev, [field]: value };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ geolead_state: updated });
      }
      return updated;
    });
  };

  const updateSetting = (key, value) => {
    setRawState(prev => {
      const updatedSettings = { ...prev.settings, [key]: value };
      const updatedState = { ...prev, settings: updatedSettings };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ geolead_state: updatedState });
      }
      return updatedState;
    });
  };

  // Toast Helper
  const showToastMsg = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Navigation action
  const handleTabChange = (tabName) => {
    setRawState(prev => {
      const updated = {
        ...prev,
        activeTab: tabName,
        currentSessionId: null
      };
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ geolead_state: updated });
      }
      return updated;
    });
  };

  // Modals state
  const [selectedLeadForPitch, setSelectedLeadForPitch] = useState(null);
  const [pitchMode, setPitchMode] = useState('email'); // email, sms
  const [pitchType, setPitchType] = useState('cold'); // cold, followup, audit
  const [generatedPitch, setGeneratedPitch] = useState('');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [pitchError, setPitchError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showKeyToggle, setShowKeyToggle] = useState(false);
  // Start Scraping
  const handleStartScrape = async () => {
    if (!state.isOnMapsPage) {
      showToastMsg('Please open a Google Maps page first', 'error');
      return;
    }

    let searchQuery = 'Current Search';
    if (typeof chrome !== 'undefined' && chrome.tabs && state.activeTabId) {
      // Use the already-detected Maps tab ID (not currentWindow which can be the popup)
      try {
        const tab = await new Promise(r => chrome.tabs.get(state.activeTabId, r));
        if (tab && !chrome.runtime.lastError) {
          if (tab.title) {
            const cleanTitle = tab.title.replace(/\s*-\s*Google Maps/i, '').trim();
            if (cleanTitle && cleanTitle.toLowerCase() !== 'google maps') {
              searchQuery = cleanTitle;
            }
          } else if (tab.url) {
            try {
              const url = new URL(tab.url);
              if (url.pathname.includes('/maps/search/')) {
                const queryPart = url.pathname.split('/maps/search/')[1]?.split('/')[0];
                if (queryPart) {
                  searchQuery = decodeURIComponent(queryPart.replace(/\+/g, ' ')).trim();
                }
              }
            } catch (err) {}
          }
        }
      } catch (err) {}
    }

    // Create new session
    const newSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      searchQuery: searchQuery,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'running',
      settings: { ...state.settings },
      metadata: {
        targetLeads: state.settings.scrollDepth,
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

    // Save new session and set as current
    const updatedState = {
      ...state,
      sessions: { ...state.sessions, [newSession.id]: newSession },
      currentSessionId: newSession.id,
      activeScrapingSessionId: newSession.id,
      scrapeStatus: 'scraping',
      scrapeProgress: { found: 0, total: state.settings.scrollDepth },
      scrapeError: '',
      scrapingTabId: state.activeTabId,
      scrapeStartTime: Date.now()
    };
    saveStateToStorage(updatedState);

    // Notify background worker about new session
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'CREATE_SESSION',
        session: newSession
      });
    }

    // Speed mapping (slow: 4000ms, medium: 2000ms, fast: 1000ms, ultra: 500ms)
    const speedMap = { slow: 4000, medium: 2500, fast: 1500, ultra: 700 };
    const delay = speedMap[state.settings.scrapeSpeed] || 2500;

    // Send start message via background (more reliable than popup→tab direct messaging in MV3)
    const sendViaBackground = (tabId) => {
      chrome.runtime.sendMessage({
        type: 'START_SCRAPE_SESSION',
        tabId,
        config: {
          scrollDepth: state.settings.scrollDepth,
          speed: delay,
          categories: [],
          sessionId: newSession.id,
          onlyWithoutWebsite: !!state.settings.onlyWithoutWebsite
        }
      }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          const errMsg = (response && response.error) || chrome.runtime.lastError?.message || 'Unknown error';
          console.error('[GeoLead] START_SCRAPE_SESSION failed:', errMsg);
          // Abort session
          updateStateField('scrapeStatus', 'error');
          updateStateField('scrapeError', 'Scraper connection failed. Please reload the Maps tab.');
          showToastMsg('Failed to connect to Google Maps page. Reload tab.', 'error');
          setRawState(prev => {
            const updatedSessions = { ...prev.sessions };
            delete updatedSessions[newSession.id];
            const updated = { ...prev, sessions: updatedSessions, currentSessionId: null };
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ geolead_state: updated });
            }
            return updated;
          });
          chrome.runtime.sendMessage({ type: 'DELETE_SESSION', sessionId: newSession.id });
        } else {
          showToastMsg('Scraping session started successfully!', 'success');
        }
      });
    };

    if (state.activeTabId && typeof chrome !== 'undefined' && chrome.runtime) {
      sendViaBackground(state.activeTabId);
    } else if (typeof chrome !== 'undefined' && chrome.tabs) {
      // Fallback: re-query for Maps tab if activeTabId is missing
      const mapsUrlPatterns = [
        '*://www.google.com/maps/*',
        '*://maps.google.com/*',
        '*://www.google.com.pk/maps/*',
        '*://maps.google.com.pk/*'
      ];
      chrome.tabs.query({ url: mapsUrlPatterns }, (mapsTabs) => {
        if (mapsTabs && mapsTabs.length > 0) {
          const tab = mapsTabs.find(t => t.active) || mapsTabs[mapsTabs.length - 1];
          sendViaBackground(tab.id);
        } else {
          updateStateField('scrapeStatus', 'error');
          updateStateField('scrapeError', 'No Google Maps tab found. Open Google Maps first.');
          showToastMsg('No Google Maps tab found. Open Google Maps first.', 'error');
        }
      });
    }
  };

  // Stop Scraping
  const handleStopScrape = () => {
    const targetTabId = state.scrapingTabId || state.activeTabId;
    if (targetTabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.sendMessage(targetTabId, { type: 'STOP_SCRAPE' }, () => {
        updateStateField('scrapeStatus', 'idle');
        updateStateField('scrapingTabId', null);
        
        // Complete the current session
        if (state.currentSessionId && typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'COMPLETE_SESSION',
            sessionId: state.currentSessionId,
            durationMs: Date.now() - (state.scrapeStartTime || Date.now())
          });
        }
        
        showToastMsg('Scraping stopped by user', 'info');
      });
    }
  };

  // Lead Enrichment
  const handleEnrichLeads = () => {
    if (effectiveLeads.length === 0) {
      showToastMsg('No leads available to enrich', 'error');
      return;
    }
    if (!state.settings.geminiApiKey) {
      showToastMsg('Gemini API Key required for enrichment. Add it in Settings.', 'error');
      handleTabChange('settings');
      return;
    }

    showToastMsg('Starting AI enrichment batch job...', 'info');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'ENRICH_LEADS',
        leads: effectiveLeads,
        apiKey: state.settings.geminiApiKey
      }, (response) => {
        if (response && response.enrichedLeads) {
          showToastMsg('Enrichment completed successfully!', 'success');
        } else if (response && response.error) {
          showToastMsg(`Enrichment failed: ${response.error}`, 'error');
        }
      });
    }
  };

  // Generate Pitch
  const handleOpenPitchModal = (lead) => {
    setSelectedLeadForPitch(lead);
    setGeneratedPitch('');
    setPitchError('');
    setPitchType('cold');
    setPitchMode('email');
  };

  useEffect(() => {
    if (selectedLeadForPitch) {
      triggerPitchGeneration();
    }
  }, [selectedLeadForPitch, pitchMode, pitchType]);

  const triggerPitchGeneration = () => {
    if (!selectedLeadForPitch) return;
    if (!state.settings.geminiApiKey) {
      setPitchError('Gemini API Key required. Save it in Settings.');
      return;
    }

    setIsGeneratingPitch(true);
    setPitchError('');
    setGeneratedPitch('');

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'GENERATE_PITCH',
        lead: selectedLeadForPitch,
        apiKey: state.settings.geminiApiKey,
        pitchType: pitchType,
        mode: pitchMode
      }, (response) => {
        setIsGeneratingPitch(false);
        if (response && response.error) {
          setPitchError(response.error);
        } else if (response) {
          const pitchText = pitchMode === 'email' ? response.emailPitch : response.smsPitch;
          setGeneratedPitch(pitchText || '');
        } else {
          setPitchError('No response from AI server');
        }
      });
    }
  };

  const copyToClipboard = (text, message = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text).then(() => {
      showToastMsg(message, 'success');
    }).catch(() => {
      showToastMsg('Copy failed', 'error');
    });
  };

  const handleExportCSV = () => {
    // Export from current session if available, otherwise from legacy leads
    const leadsToExport = currentSession ? currentSession.leads || [] : state.leads;
    
    if (leadsToExport.length === 0) {
      showToastMsg('No leads to export', 'error');
      return;
    }

    // Convert leads to CSV string format
    const headers = [
      'Business Name',
      'Category',
      'Address',
      'Phone',
      'Email',
      'Website',
      'Instagram',
      'Facebook',
      'LinkedIn',
      'Google Rating',
      'Reviews',
      'Lead Quality Score',
      'Business Status',
      'Services',
      'Date Scraped'
    ];

    const rows = leadsToExport.map(lead => {
      const email = lead.email || (lead.emails && lead.emails[0]) || '';
      const qualityScore = lead.leadQualityScore || calculateLeadQualityScore(lead);
      
      return [
        `"${(lead.businessName || '').replace(/"/g, '""')}"`  ,
        `"${(lead.category || '').replace(/"/g, '""')}"`,
        `"${(lead.address || '').replace(/"/g, '""')}"`,
        `"${(lead.phone || '').replace(/"/g, '""')}"`,
        `"${email.replace(/"/g, '""')}"`,
        `"${(lead.website || '').replace(/"/g, '""')}"`,
        `"${(lead.instagram || '').replace(/"/g, '""')}"`,
        `"${(lead.facebook || '').replace(/"/g, '""')}"`,
        `"${(lead.linkedin || '').replace(/"/g, '""')}"`,
        lead.rating || 'N/A',
        lead.reviewCount || 0,
        qualityScore,
        `"${(lead.businessStatus || 'Open').replace(/"/g, '""')}"`,
        `"${(lead.services || '').replace(/"/g, '""')}"`,
        `"${(lead.scrapedAt || '').replace(/"/g, '""')}"`
      ];
    });

    // Add BOM for Microsoft Excel compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    // Use session name or date for filename
    const sessionName = currentSession ? 
      (currentSession.customName || currentSession.searchQuery || 'Session') : 
      `Leads_${new Date().toISOString().slice(0, 10)}`;
    
    link.setAttribute('download', `geolead_${sessionName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToastMsg('Leads exported to Excel!', 'success');
  };

  const handleClearAllLeads = () => {
    const cleared = {
      ...state,
      leads: [], // Deprecated
      scrapeStatus: 'idle',
      scrapeProgress: { found: 0, total: state.settings.scrollDepth },
      sessions: {}, // Clear all sessions
      currentSessionId: null
    };
    saveStateToStorage(cleared);
    setShowClearConfirm(false);
    showToastMsg('All sessions and leads cleared!', 'success');
  };

  // Session management functions
  const handleDeleteSession = (sessionId) => {
    setRawState(prev => {
      const updatedSessions = { ...prev.sessions };
      delete updatedSessions[sessionId];
      
      const updatedState = {
        ...prev,
        sessions: updatedSessions,
        currentSessionId: prev.currentSessionId === sessionId ? null : prev.currentSessionId
      };
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ geolead_state: updatedState });
      }
      
      // Also notify background
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'DELETE_SESSION',
          sessionId: sessionId
        });
      }
      
      showToastMsg('Session deleted successfully!', 'success');
      return updatedState;
    });
  };

  const handleRenameSession = (sessionId, newName) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'RENAME_SESSION',
        sessionId: sessionId,
        newName: newName
      }, (response) => {
        if (response && response.success) {
          showToastMsg('Session renamed successfully!', 'success');
          // Update local state
          setRawState(prev => {
            const updatedSessions = { ...prev.sessions };
            if (updatedSessions[sessionId]) {
              updatedSessions[sessionId].customName = newName;
            }
            return { ...prev, sessions: updatedSessions };
          });
        } else {
          showToastMsg('Failed to rename session', 'error');
        }
      });
    }
  };

  const handleExportSession = (sessionId) => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'EXPORT_SESSION',
        sessionId: sessionId
      }, (response) => {
        if (response && response.session) {
          const session = response.session;
          const leadsToExport = session.leads || [];
          
          if (leadsToExport.length === 0) {
            showToastMsg('No leads in this session to export', 'error');
            return;
          }

          // Convert leads to CSV string format
          const headers = [
            'Business Name',
            'Category',
            'Address',
            'Phone',
            'Email',
            'Website',
            'Instagram',
            'Facebook',
            'LinkedIn',
            'Google Rating',
            'Reviews',
            'Lead Quality Score',
            'Business Status',
            'Services',
            'Date Scraped'
          ];

          const rows = leadsToExport.map(lead => {
            const email = lead.email || (lead.emails && lead.emails[0]) || '';
            const qualityScore = lead.leadQualityScore || calculateLeadQualityScore(lead);
            
            return [
              `"${(lead.businessName || '').replace(/"/g, '""')}"`,
              `"${(lead.category || '').replace(/"/g, '""')}"`,
              `"${(lead.address || '').replace(/"/g, '""')}"`,
              `"${(lead.phone || '').replace(/"/g, '""')}"`,
              `"${email.replace(/"/g, '""')}"`,
              `"${(lead.website || '').replace(/"/g, '""')}"`,
              `"${(lead.instagram || '').replace(/"/g, '""')}"`,
              `"${(lead.facebook || '').replace(/"/g, '""')}"`,
              `"${(lead.linkedin || '').replace(/"/g, '""')}"`,
              lead.rating || 'N/A',
              lead.reviewCount || 0,
              qualityScore,
              `"${(lead.businessStatus || 'Open').replace(/"/g, '""')}"`,
              `"${(lead.services || '').replace(/"/g, '""')}"`,
              `"${(lead.scrapedAt || '').replace(/"/g, '""')}"`
            ];
          });

          // Add BOM for Microsoft Excel compatibility
          const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `geolead_${session.customName || session.searchQuery}_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showToastMsg('Session exported to Excel!', 'success');
        }
      });
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Lead hover handlers with performance optimization
  const handleLeadHover = (event, lead) => {
    console.log('🎯 Hover triggered for:', lead.businessName);
    console.log('📍 Mouse position:', { x: event.clientX, y: event.clientY });
    setPreviewLead(lead);
    setShowPreview(true);
    handleLeadMouseMove(event);
    console.log('✅ Preview state set to true');
  };

  // Debounced mouse move handler for performance
  const handleLeadMouseMove = (event) => {
    if (!showPreview) {
      console.log('❌ Mouse move ignored - preview not shown');
      return;
    }
    
    console.log('🖱️ Mouse moving, preview position:', { x: event.clientX, y: event.clientY });
    
    // Use requestAnimationFrame for smooth performance
    requestAnimationFrame(() => {
      const previewWidth = 380;
      const previewHeight = 400;
      const margin = 20;
      
      let x = event.clientX + margin;
      let y = event.clientY + margin;
      
      // Prevent preview from going off-screen with smart positioning
      if (x + previewWidth > window.innerWidth) {
        x = Math.max(margin, event.clientX - previewWidth - margin);
      } else {
        x = Math.max(margin, x);
      }
      
      if (y + previewHeight > window.innerHeight) {
        y = Math.max(margin, event.clientY - previewHeight - margin);
      } else {
        y = Math.max(margin, y);
      }
      
      setPreviewPosition({ x, y });
      console.log('🎯 Preview position updated to:', { x, y });
    });
  };

  // Add sample test leads for debugging hover preview
  const addSampleLeads = () => {
    const sampleLeads = [
      {
        id: 'test1',
        businessName: 'Test Coffee Shop',
        category: 'Coffee Shop',
        phone: '+1 (555) 123-4567',
        emails: ['info@testcoffee.com'],
        website: 'https://testcoffee.com',
        address: '123 Main St, Test City, TC 12345',
        rating: '4.5',
        websiteStatus: 'HAS_WEBSITE'
      },
      {
        id: 'test2',
        businessName: 'Sample Restaurant',
        category: 'Restaurant',
        phone: '+1 (555) 987-6543',
        emails: ['hello@sample.com', 'contact@sample.com'],
        website: 'https://samplrestaurant.com',
        address: '456 Oak Ave, Sample Town, ST 67890',
        rating: '4.2',
        websiteStatus: 'HAS_WEBSITE'
      }
    ];
    
    const updatedState = {
      ...state,
      leads: [...state.leads, ...sampleLeads]
    };
    setState(updatedState);
    saveStateToStorage(updatedState);
    console.log('📝 Added sample leads for testing:', sampleLeads);
  };

  // Get sessions sorted by creation date (newest first)
  const sessionsList = Object.values(state.sessions).sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  const openGoogleMaps = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'https://www.google.com/maps' });
    }
  };

  const handleLeadClick = (e, lead) => {
    e.preventDefault();
    e.stopPropagation();

    const targetUrl = lead.placeUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.businessName + ' ' + (lead.address || ''))}`;

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        let targetTab = null;

        // Priority 1: Check if the scrapingTabId is still open
        if (state.scrapingTabId) {
          targetTab = tabs.find(t => t.id === state.scrapingTabId);
        }

        // Priority 2: Check if any open tab is a Google Maps tab
        if (!targetTab) {
          targetTab = tabs.find(t => t.url && (t.url.includes('google.com/maps') || t.url.includes('maps.google.')));
        }

        if (targetTab) {
          // Reuse the existing Google Maps tab. Update its URL.
          // By NOT setting active: true, we prevent the extension popup from losing focus and closing.
          chrome.tabs.update(targetTab.id, { url: targetUrl });
        } else {
          // If no Google Maps tab exists, open a new one.
          chrome.tabs.create({ url: targetUrl, active: true });
        }
      });
    } else {
      // Fallback for development/non-extension environments
      window.open(targetUrl, '_blank');
    }
  };

  // Filter leads by search query and without website toggle (from current session or legacy)
  const filteredLeads = effectiveLeads.filter(lead => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      (lead.businessName || '').toLowerCase().includes(query) ||
      (lead.category || '').toLowerCase().includes(query) ||
      (lead.address || '').toLowerCase().includes(query)
    );
    
    if (filterWithoutWebsite) {
      return matchesSearch && (!lead.website || lead.websiteStatus === 'NO_WEBSITE');
    }
    
    return matchesSearch;
  });

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon-box">
            <Target size={13} color="var(--primary)" />
          </div>
          <div>
            <h1 className="logo-text-title">GeoLead <span style={{ color: 'var(--primary)', fontWeight: 500 }}>AI</span></h1>
            <p className="logo-text-subtitle">AUTOMATED PROSPECTING</p>
          </div>
        </div>
        
        <div className="header-status">
          <div className={`status-dot ${state.isOnMapsPage ? 'active' : 'inactive'}`}></div>
          <span className="status-text">{state.isOnMapsPage ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* NAV BAR */}
      <nav className="nav-bar">
        <div 
          className={`nav-item ${state.activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          <LayoutDashboard size={15} />
          <span>Dashboard</span>
        </div>
        <div 
          className={`nav-item ${state.activeTab === 'leads' ? 'active' : ''}`}
          onClick={() => handleTabChange('leads')}
        >
          <ListPlus size={15} />
          <span>Leads</span>
        </div>
        <div 
          className={`nav-item ${state.activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleTabChange('settings')}
        >
          <Settings size={15} />
          <span>Settings</span>
        </div>
      </nav>

      {/* APP BODY */}
      <main className="app-body">
        
        {/* DASHBOARD TAB */}
        {state.activeTab === 'dashboard' && (
          <div className="tab-content fade-in">
            {state.isOnMapsPage === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
                <div style={{ border: '2.5px solid rgba(255, 255, 255, 0.05)', borderTop: '2.5px solid var(--primary)', borderRadius: '50%', width: '22px', height: '22px', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Checking Google Maps connection...</span>
              </div>
            ) : !state.isOnMapsPage ? (
              <div className="card-premium text-center" style={{ padding: '30px 20px' }}>
                <AlertTriangle size={32} color="#f59e0b" style={{ margin: '0 auto 12px auto' }} />
                <h3 style={{ marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>Google Maps Required</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '12px' }}>
                  Please navigate to Google Maps to activate scraping controls and start collecting leads.
                </p>
                <button className="btn-primary" onClick={openGoogleMaps}>
                  Open Google Maps
                  <ExternalLink size={14} />
                </button>
              </div>
            ) : (
              <>

                {/* Configuration */}
                {state.scrapeStatus !== 'scraping' && (
                  <div className="card-premium">
                    <span className="card-title" style={{ display: 'block', marginBottom: '16px' }}>Scraper Settings</span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Max depth */}
                      <div className="slider-container">
                        <div className="slider-labels">
                          <span>Max Results Target</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{state.settings.scrollDepth} leads</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="100" 
                          step="10"
                          className="slider-premium" 
                          value={state.settings.scrollDepth}
                          onChange={(e) => updateSetting('scrollDepth', parseInt(e.target.value))}
                          disabled={state.scrapeStatus === 'scraping'}
                        />
                      </div>

                      {/* Scrape Speed */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Scrape Speed</span>
                        <select 
                          className="select-premium"
                          value={state.settings.scrapeSpeed}
                          onChange={(e) => updateSetting('scrapeSpeed', e.target.value)}
                          disabled={state.scrapeStatus === 'scraping'}
                        >
                          <option value="slow">Slow (Safe)</option>
                          <option value="medium">Medium</option>
                          <option value="fast">Fast</option>
                          <option value="ultra">Ultra (Risky)</option>
                        </select>
                      </div>

                      {/* Only Without Website Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Only Without Website</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Extract businesses that do not have websites</span>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px' }}>
                          <input 
                            type="checkbox" 
                            checked={!!state.settings.onlyWithoutWebsite}
                            onChange={(e) => updateSetting('onlyWithoutWebsite', e.target.checked)}
                            disabled={state.scrapeStatus === 'scraping'}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: state.settings.onlyWithoutWebsite ? 'var(--primary)' : '#3f3f46',
                            transition: '0.3s',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '2px'
                          }}>
                            <span style={{
                              height: '16px',
                              width: '16px',
                              backgroundColor: 'white',
                              transition: '0.3s',
                              borderRadius: '50%',
                              transform: state.settings.onlyWithoutWebsite ? 'translateX(14px)' : 'translateX(0)'
                            }} />
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scraper Status Panel */}
                <div className="card-premium">
                  {state.scrapeStatus === 'scraping' ? (() => {
                    const progress = state.scrapeProgress || { found: 0, total: state.settings?.scrollDepth || 20, statusText: 'Initializing...', currentBusinessName: '', processedCount: 0, detectedCount: 0 };
                    const found = progress.found || 0;
                    const total = progress.total || state.settings?.scrollDepth || 20;
                    const percent = Math.min(100, Math.round((found / total) * 100));
                    return (
                      <div className="progress-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Compact settings badges at the top */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '-4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            Target: {total} leads
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                            Speed: {state.settings?.scrapeSpeed || 'Medium'}
                          </span>
                          {state.settings?.onlyWithoutWebsite && (
                            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              No Website Only
                            </span>
                          )}
                        </div>
                        {/* Active header with animated state indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                            <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
                              <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '9999px', backgroundColor: 'var(--primary)', opacity: 0.75 }}></span>
                              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '9999px', height: '8px', width: '8px', backgroundColor: 'var(--primary)' }}></span>
                            </span>
                            {progress.statusText || 'Scraping Google Maps...'}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-glow)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                            {percent}%
                          </span>
                        </div>

                        {/* Skeleton loader / pulsing glow for current business */}
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building size={12} style={{ color: 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Current Business</span>
                          </div>
                          {progress.currentBusinessName ? (
                            <div style={{ 
                              fontSize: '13px', 
                              fontWeight: 700, 
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              animation: 'pulseGlow 2s infinite ease-in-out'
                            }}>
                              {progress.currentBusinessName}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', padding: '2px 0' }}>
                              <div className="skeleton-line" style={{ height: '12px', width: '70%', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', borderRadius: '3px', animation: 'skeletonShimmer 1.5s infinite linear' }}></div>
                            </div>
                          )}
                        </div>

                        {/* Smooth Progress Bar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div className="progress-track" style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div 
                              className="progress-fill" 
                              style={{ 
                                height: '100%',
                                width: `${percent}%`,
                                background: 'var(--primary)',
                                boxShadow: '0 0 8px var(--primary)',
                                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* Grid Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>Leads Collected</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--success)' }}>
                              {found} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {total}</span>
                            </span>
                          </div>
                          <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>Processed / Detected</span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {progress.processedCount || found} <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {progress.detectedCount || total}</span>
                            </span>
                          </div>
                        </div>

                        {/* Stop Extraction Button */}
                        <button className="btn-secondary" style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--danger)', width: '100%', marginTop: '2px' }} onClick={handleStopScrape}>
                          <Square size={13} fill="var(--danger)" />
                          Stop Extraction
                        </button>
                      </div>
                    );
                  })() : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {state.scrapeStatus === 'done' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 500, marginBottom: '4px' }}>
                          <Check size={16} />
                          <span>Successfully scraped leads!</span>
                        </div>
                      )}
                      {state.scrapeStatus === 'error' && (
                        <div style={{ color: 'var(--danger)', fontWeight: 500, marginBottom: '4px', fontSize: '12px' }}>
                          ⚠️ Error: {state.scrapeError}
                        </div>
                      )}
                      <button className="btn-primary" style={{ width: '100%', padding: '10px 0' }} onClick={handleStartScrape}>
                        <Play size={14} fill="#ffffff" />
                        Start Scrape Session
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* LEADS TAB */}
        {state.activeTab === 'leads' && (
          <div className="tab-content fade-in">
            {currentSession ? (
              /* Detail View: Current Session Leads View */
              <div className="current-session-view fade-in">
                {/* Breadcrumbs & Back Navigation */}
                <div className="detail-navigation">
                  <button 
                    className="btn-back-link"
                    onClick={() => {
                      setRawState(prev => ({ ...prev, currentSessionId: null }));
                      updateStateField('currentSessionId', null);
                    }}
                    title="Back to Sessions"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <div className="breadcrumbs">
                    <span className="breadcrumb-item" onClick={() => {
                      setRawState(prev => ({ ...prev, currentSessionId: null }));
                      updateStateField('currentSessionId', null);
                    }}>Leads</span>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-item" onClick={() => {
                      setRawState(prev => ({ ...prev, currentSessionId: null }));
                      updateStateField('currentSessionId', null);
                    }}>Sessions</span>
                    <span className="breadcrumb-separator">/</span>
                    <span className="breadcrumb-item active" title={currentSession.customName || currentSession.searchQuery}>
                      {currentSession.customName || currentSession.searchQuery}
                    </span>
                  </div>
                </div>

                {/* Session Hero Header Card */}
                <div className="session-detail-hero card-premium">
                  <div className="hero-main-row">
                    <div className="hero-title-section">
                      <h2 className="hero-title">
                        {currentSession.customName || currentSession.searchQuery}
                      </h2>
                      <div className="hero-query-meta">
                        <span className="meta-label">Query:</span>
                        <span className="meta-value">"{currentSession.searchQuery}"</span>
                      </div>
                    </div>
                    <div className="hero-actions-section">
                      <button className="btn-primary btn-sm" onClick={handleExportCSV}>
                        <FileDown size={12} />
                        Export Data
                      </button>
                    </div>
                  </div>

                  <div className="hero-meta-row">
                    <div className="meta-item">
                      <Calendar size={11} className="meta-icon" />
                      <span>{formatDate(currentSession.createdAt)}</span>
                    </div>
                    <div className="meta-item">
                      <Clock size={11} className="meta-icon" />
                      <span>
                        Duration: {currentSession.metadata?.scrapingDuration ? `${Math.round(currentSession.metadata.scrapingDuration / 1000)}s` : 'N/A'}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className={`badge-premium ${
                        currentSession.status === 'completed' ? 'badge-success' : 
                        currentSession.status === 'running' ? 'badge-info' : 
                        currentSession.status === 'failed' ? 'badge-danger' : 'badge-warning'
                      }`} style={{ textTransform: 'none', padding: '2px 8px', fontSize: '9px' }}>
                        {currentSession.status === 'completed' ? 'Completed' : 
                         currentSession.status === 'running' ? 'Running' : 
                         currentSession.status === 'failed' ? 'Failed' : 'Idle'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Grid inside Detail Header */}
                  <div className="session-detail-stats-grid">
                    <div className="detail-stat-card">
                      <div className="detail-stat-val">{currentSession.leads?.length || 0}</div>
                      <div className="detail-stat-lbl">Leads</div>
                    </div>
                    <div className="detail-stat-card">
                      <div className="detail-stat-val">
                        {currentSession.metadata?.businessesVisited || currentSession.leads?.length || 0}
                      </div>
                      <div className="detail-stat-lbl">Visited</div>
                    </div>

                    <div className="detail-stat-card">
                      <div className="detail-stat-val" style={{ color: '#60a5fa' }}>
                        {currentSession.leads?.filter(l => l.phone).length || 0}
                      </div>
                      <div className="detail-stat-lbl">Phones</div>
                    </div>
                    <div className="detail-stat-card">
                      <div className="detail-stat-val" style={{ color: '#c084fc' }}>
                        {currentSession.leads?.filter(l => (l.emails && l.emails.length > 0) || l.email).length || 0}
                      </div>
                      <div className="detail-stat-lbl">Emails</div>
                    </div>
                  </div>
                </div>

                {/* Session-specific search and actions */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search 
                      size={12} 
                      style={{ 
                        position: 'absolute', 
                        left: '10px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        color: 'var(--text-secondary)'
                      }} 
                    />
                    <input 
                      type="text" 
                      placeholder="Search leads by name, phone, address..." 
                      className="input-premium"
                      style={{ paddingLeft: '28px', height: '28px', fontSize: '11px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {/* Without Website Filter Toggle */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '0 10px',
                    height: '28px',
                    whiteSpace: 'nowrap'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={filterWithoutWebsite}
                      onChange={(e) => setFilterWithoutWebsite(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Without Website
                  </label>
                </div>

                {/* Session Leads Table */}
                <div className="table-container">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Lead Details</th>
                        <th>Priority</th>
                        <th style={{ textAlign: 'center' }}>Quality</th>
                        <th style={{ textAlign: 'right' }}>Outreach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => {
                        const qualityScore = lead.leadQualityScore || calculateLeadQualityScore(lead);
                        const priority = lead.priority || qualifyLead(lead, qualityScore);
                        
                        let priorityClass = 'badge-info';
                        if (priority === 'High') priorityClass = 'badge-success';
                        else if (priority === 'Medium') priorityClass = 'badge-warning';

                        let qualityClass = 'score-high';
                        if (qualityScore >= 8) qualityClass = 'score-low';
                        else if (qualityScore >= 5) qualityClass = 'score-medium';

                        return (
                          <tr 
                            key={lead.id || lead.businessName}
                            className="lead-row"
                            onMouseEnter={(e) => handleLeadHover(e, lead)}
                            onMouseLeave={() => setShowPreview(false)}
                            onMouseMove={(e) => handleLeadMouseMove(e)}
                          >
                            <td>
                              <div className="lead-name-cell">
                                <a 
                                  href={lead.placeUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.businessName + ' ' + (lead.address || ''))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="lead-name-title-link"
                                  title={`Open "${lead.businessName}" in Google Maps`}
                                  onClick={(e) => handleLeadClick(e, lead)}
                                >
                                  <div className="lead-name-title">{lead.businessName}</div>
                                </a>
                                <div className="lead-name-sub">{lead.category || 'Niche Unknown'}</div>
                              </div>
                            </td>
                            <td>
                              <span className={`badge-premium ${priorityClass}`}>
                                {priority}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className={`score-badge ${qualityClass}`} style={{ display: 'inline-block' }}>
                                {qualityScore}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button 
                                  className="btn-icon-only" 
                                  title="AI Pitch Template"
                                  onClick={() => handleOpenPitchModal(lead)}
                                >
                                  <Sparkles size={13} />
                                </button>
                                <button 
                                  className="btn-icon-only"
                                  title="Copy Phone/Details"
                                  onClick={() => copyToClipboard(
                                    `Name: ${lead.businessName}\nCategory: ${lead.category}\nPhone: ${lead.phone || 'N/A'}\nWebsite: ${lead.website || 'N/A'}\nAddress: ${lead.address || 'N/A'}\nOwner: ${lead.ownerName || 'N/A'}\nEmails: ${lead.emails ? lead.emails.join(', ') : 'N/A'}`,
                                    'Lead details copied!'
                                  )}
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Master View: Sessions List */
              <div className="sessions-view">
                {sessionsList.length > 0 ? (
                  <div className="sessions-list">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Scraping Sessions</h3>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {sessionsList.length} session{sessionsList.length !== 1 ? 's' : ''} total
                      </span>
                    </div>

                    {sessionsList.map(session => (
                      <div 
                        key={session.id} 
                        className="session-card"
                        onClick={() => {
                          setRawState(prev => ({ ...prev, currentSessionId: session.id }));
                          updateStateField('currentSessionId', session.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="session-header">
                          <div className="session-info">
                            <div className="session-title">
                              {session.customName || session.searchQuery || 'Unnamed Session'}
                            </div>
                            {session.customName && session.customName !== session.searchQuery && (
                              <div className="session-query-sub">
                                Query: "{session.searchQuery}"
                              </div>
                            )}
                            <div className="session-meta">
                              <span className={`badge-premium ${
                                session.status === 'completed' ? 'badge-success' : 
                                session.status === 'running' ? 'badge-info' : 
                                session.status === 'failed' ? 'badge-danger' : 'badge-warning'
                              }`} style={{ textTransform: 'none' }}>
                                {session.status === 'completed' ? 'Completed' : 
                                 session.status === 'running' ? 'Running' : 
                                 session.status === 'failed' ? 'Failed' : 'Idle'}
                              </span>
                              <span className="session-date">
                                {formatDate(session.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="session-actions" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="btn-icon-only"
                              title="Export Session"
                              onClick={() => handleExportSession(session.id)}
                            >
                              <FileDown size={14} />
                            </button>
                            <button 
                              className="btn-icon-only"
                              title="Rename Session"
                              onClick={() => {
                                const newName = prompt('Enter new session name:', session.customName || session.searchQuery);
                                if (newName && newName.trim()) {
                                  handleRenameSession(session.id, newName.trim());
                                }
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn-icon-only"
                              title="Delete Session"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete the session "${session.customName || session.searchQuery}"? This cannot be undone.`)) {
                                  handleDeleteSession(session.id);
                                }
                              }}
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Complete Session Summary Statistics Grid */}
                        <div className="session-stats-grid">
                          <div className="session-stat-item">
                            <div className="session-stat-val">{session.leads?.length || 0}</div>
                            <div className="session-stat-lbl">Leads</div>
                          </div>
                          <div className="session-stat-item">
                            <div className="session-stat-val">
                              {session.metadata?.businessesVisited || session.leads?.length || 0}
                            </div>
                            <div className="session-stat-lbl">Visited</div>
                          </div>

                          <div className="session-stat-item">
                            <div className="session-stat-val" style={{ color: '#60a5fa' }}>
                              {session.leads?.filter(l => l.phone).length || 0}
                            </div>
                            <div className="session-stat-lbl">Phones</div>
                          </div>
                          <div className="session-stat-item">
                            <div className="session-stat-val" style={{ color: '#c084fc' }}>
                              {session.leads?.filter(l => (l.emails && l.emails.length > 0) || l.email).length || 0}
                            </div>
                            <div className="session-stat-lbl">Emails</div>
                          </div>
                        </div>

                        {/* Footer with duration and progress if running */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                            Duration: {session.metadata?.scrapingDuration ? `${Math.round(session.metadata.scrapingDuration / 1000)}s` : 'N/A'}
                          </span>
                          {session.status === 'running' && (
                            <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 600 }}>
                              Scraping {session.metadata?.leadsCollected || 0} / {session.metadata?.targetLeads || 0}
                            </span>
                          )}
                        </div>

                        {session.status === 'running' && (
                          <div className="session-progress" style={{ marginTop: '6px' }}>
                            <div className="progress-track" style={{ height: '3px' }}>
                              <div 
                                className="progress-fill" 
                                style={{ width: `${((session.metadata?.leadsCollected || 0) / (session.metadata?.targetLeads || 1)) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Empty state - no sessions yet */
                  <div className="empty-state-container card-premium">
                    <Search className="empty-state-icon" />
                    <h3 className="empty-state-title">No Scraping Sessions Yet</h3>
                    <p className="empty-state-desc">
                      Start your first scraping session on Google Maps to begin collecting leads in organized sessions.
                    </p>
                    <button className="btn-primary" onClick={() => handleTabChange('dashboard')}>
                      Go to Dashboard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {state.activeTab === 'settings' && (
          <div className="tab-content fade-in">
            <div className="card-premium">
              <span className="card-title" style={{ display: 'block', marginBottom: '14px' }}>AI Integration Config</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Google Gemini API Key</label>
                  <div className="input-wrapper-icon">
                    <input 
                      type={showKeyToggle ? 'text' : 'password'}
                      className="input-premium" 
                      placeholder="AIzaSy..." 
                      value={state.settings.geminiApiKey}
                      onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                    />
                    <button 
                      className="btn-icon-only" 
                      style={{ position: 'absolute', right: '1px', border: 'none', background: 'transparent' }}
                      onClick={() => setShowKeyToggle(!showKeyToggle)}
                    >
                      {showKeyToggle ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Get a free API key at Google AI Studio to enable AI pitch generation and lead enrichment.
                  </span>
                </div>
              </div>
            </div>

            <div className="card-premium">
              <span className="card-title" style={{ display: 'block', marginBottom: '14px' }}>Data Operations</span>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '14px', fontSize: '12px' }}>
                Clean up local databases and cached lead archives. This action cannot be undone.
              </p>
              <button className="btn-danger" style={{ width: '100%' }} onClick={() => setShowClearConfirm(true)}>
                <Trash2 size={14} />
                Purge Extracted Leads Library
              </button>
            </div>
          </div>
        )}
      </main>

      {/* AI PITCH MODAL */}
      {selectedLeadForPitch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span className="modal-title">AI Pitch — {selectedLeadForPitch.businessName}</span>
              <button className="btn-icon-only" style={{ border: 'none', background: 'transparent' }} onClick={() => setSelectedLeadForPitch(null)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Pitch Mode Tabs */}
              <div className="pitch-tabs">
                <button 
                  className={`pitch-tab-btn ${pitchMode === 'email' ? 'active' : ''}`}
                  onClick={() => setPitchMode('email')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={12} />
                    Email Template
                  </div>
                </button>
                <button 
                  className={`pitch-tab-btn ${pitchMode === 'sms' ? 'active' : ''}`}
                  onClick={() => setPitchMode('sms')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={12} />
                    WhatsApp/SMS Text
                  </div>
                </button>
              </div>

              {/* Pitch Type Config (for Emails) */}
              {pitchMode === 'email' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button 
                    className={`btn-secondary btn-sm ${pitchType === 'cold' ? 'btn-primary' : ''}`}
                    onClick={() => setPitchType('cold')}
                  >
                    Cold Pitch
                  </button>
                  <button 
                    className={`btn-secondary btn-sm ${pitchType === 'followup' ? 'btn-primary' : ''}`}
                    onClick={() => setPitchType('followup')}
                  >
                    Follow-Up
                  </button>
                  <button 
                    className={`btn-secondary btn-sm ${pitchType === 'audit' ? 'btn-primary' : ''}`}
                    onClick={() => setPitchType('audit')}
                  >
                    Site Audit
                  </button>
                </div>
              )}

              {/* Text Area Content */}
              {isGeneratingPitch ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px' }}>
                  <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Generating personalized pitch...</span>
                </div>
              ) : pitchError ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px', color: 'var(--danger)', textAlign: 'center', padding: '0 20px' }}>
                  <AlertTriangle size={24} />
                  <span style={{ fontSize: '12px' }}>{pitchError}</span>
                </div>
              ) : (
                <textarea 
                  className="pitch-text-box"
                  value={generatedPitch}
                  readOnly
                />
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedLeadForPitch(null)}>Close</button>
              <button 
                className="btn-primary"
                onClick={() => copyToClipboard(generatedPitch, 'Pitch copied to clipboard!')}
                disabled={!generatedPitch || isGeneratingPitch}
              >
                <Copy size={14} />
                Copy Pitch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR LEADS CONFIRMATION DIALOG */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '380px', maxHeight: '220px' }}>
            <div className="modal-header">
              <span className="modal-title">Purge Leads Library?</span>
              <button className="btn-icon-only" style={{ border: 'none', background: 'transparent' }} onClick={() => setShowClearConfirm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Are you absolutely sure you want to delete all collected leads? This data cannot be recovered.
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleClearAllLeads}>
                <Trash2 size={13} />
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="toast-container">
          <div className={`toast-premium ${toast.type === 'success' ? 'toast-success' : toast.type === 'error' ? 'toast-error' : 'toast-info'}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* LEAD PREVIEW */}
      {showPreview && previewLead && (
        <div className="lead-preview" style={{ animation: 'fadeInScale 0.12s ease-out' }}>
          <div 
            className="lead-preview-card" 
            style={{
              position: 'fixed',
              top: previewPosition.y,
              left: previewPosition.x,
              zIndex: 99999,
            }}
          >
            <div className="lead-preview-header">
              <div className="lead-preview-title">{previewLead.businessName}</div>
              <div className="lead-preview-subtitle">{previewLead.category || 'Niche Unknown'}</div>
            </div>
            <div className="lead-preview-content" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {/* Score Badges */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.03)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Quality</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {previewLead.leadQualityScore || calculateLeadQualityScore(previewLead)}
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.03)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>Priority</div>
                  <span className={`badge-premium ${
                    (previewLead.priority || qualifyLead(previewLead, previewLead.leadQualityScore || 1)) === 'High' ? 'badge-success' :
                    (previewLead.priority || qualifyLead(previewLead, previewLead.leadQualityScore || 1)) === 'Medium' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {previewLead.priority || qualifyLead(previewLead, previewLead.leadQualityScore || 1)}
                  </span>
                </div>
              </div>

              {(previewLead.rating || previewLead.reviewCount) && (
                <div className="preview-field">
                  <div className="field-icon">
                    <Star size={13} fill="#fbbf24" stroke="#fbbf24" />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Rating</div>
                    <div className="field-value">
                      {previewLead.rating ? `${previewLead.rating} / 5.0` : 'N/A'}
                      {previewLead.reviewCount && (
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>
                          ({previewLead.reviewCount} reviews)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {previewLead.phone && (
                <div className="preview-field">
                  <div className="field-icon">
                    <Phone size={13} />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Phone</div>
                    <div className="field-value">{previewLead.phone}</div>
                  </div>
                </div>
              )}

              {previewLead.emails && previewLead.emails.length > 0 && (
                <div className="preview-field">
                  <div className="field-icon">
                    <Mail size={13} />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Email</div>
                    <div className="field-value" style={{ wordBreak: 'break-all' }}>{previewLead.emails.join(', ')}</div>
                  </div>
                </div>
              )}

              {previewLead.website && (
                <div className="preview-field">
                  <div className="field-icon">
                    <Globe size={13} />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Website</div>
                    <div className="field-value">
                      <a 
                        href={previewLead.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="website-link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', wordBreak: 'break-all' }}
                      >
                        {previewLead.website}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Website Analysis Details */}
              {previewLead.website && previewLead.websiteAnalysis && (
                <div style={{
                  background: 'rgba(255,255,255,0.01)',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.03)',
                  marginBottom: '8px',
                  fontSize: '10px'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontSize: '8px' }}>Website Analysis</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <div>Reachability: {previewLead.websiteAnalysis.reachable ? '✅ OK' : '❌ Down'}</div>
                    <div>HTTPS: {previewLead.websiteAnalysis.httpsEnabled ? '✅ Yes' : '⚠️ No'}</div>
                    <div>SSL Certificate: {previewLead.websiteAnalysis.sslValid ? '✅ Valid' : '❌ Invalid'}</div>
                    <div>Mobile: {previewLead.websiteAnalysis.mobileFriendly ? '✅ Yes' : '⚠️ No'}</div>
                    <div>Contact Page: {previewLead.websiteAnalysis.contactPageExists ? '✅ Yes' : '❌ No'}</div>
                    <div>Contact Form: {previewLead.websiteAnalysis.contactFormAvailable ? '✅ Yes' : '❌ No'}</div>
                  </div>
                </div>
              )}

              {previewLead.address && (() => {
                return (
                  <div className="preview-field">
                    <div className="field-icon">
                      <MapPin size={13} />
                    </div>
                    <div className="field-content">
                      <div className="field-label">Address</div>
                      <div className="field-value" title={previewLead.address}>{previewLead.address}</div>
                    </div>
                  </div>
                );
              })()}

              {previewLead.openingHours && (
                <div className="preview-field">
                  <div className="field-icon">
                    <Clock size={13} />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Opening Hours</div>
                    <div className="field-value" style={{ fontSize: '10px' }}>
                      <span style={{ fontWeight: 600, marginRight: '4px', color: previewLead.businessStatus === 'Open' ? 'var(--success)' : 'var(--danger)' }}>
                        {previewLead.businessStatus || 'Open'}
                      </span>
                      {previewLead.openingHours}
                    </div>
                  </div>
                </div>
              )}

              {previewLead.ownerName && (
                <div className="preview-field">
                  <div className="field-icon">
                    <User size={13} />
                  </div>
                  <div className="field-content">
                    <div className="field-label">Owner</div>
                    <div className="field-value">{previewLead.ownerName}</div>
                  </div>
                </div>
              )}

              {/* Social Profiles */}
              {(previewLead.instagram || previewLead.facebook || previewLead.linkedin || previewLead.twitter || previewLead.youtube || previewLead.tiktok || previewLead.pinterest) && (
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Social Profiles</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {previewLead.instagram && (
                      <a href={previewLead.instagram} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>Instagram</a>
                    )}
                    {previewLead.facebook && (
                      <a href={previewLead.facebook} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>Facebook</a>
                    )}
                    {previewLead.linkedin && (
                      <a href={previewLead.linkedin} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>LinkedIn</a>
                    )}
                    {previewLead.twitter && (
                      <a href={previewLead.twitter} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>Twitter/X</a>
                    )}
                    {previewLead.youtube && (
                      <a href={previewLead.youtube} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>YouTube</a>
                    )}
                    {previewLead.tiktok && (
                      <a href={previewLead.tiktok} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>TikTok</a>
                    )}
                    {previewLead.pinterest && (
                      <a href={previewLead.pinterest} target="_blank" rel="noopener noreferrer" className="badge-premium badge-info" style={{ textTransform: 'none', textDecoration: 'none' }}>Pinterest</a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Render
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
