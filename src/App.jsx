import React, { useEffect } from 'react';
import useStore from './popup/store/useStore';
import Header from './popup/components/Header';
import Onboarding from './popup/components/Onboarding';
import EmailPreview from './popup/components/EmailPreview';
import DashboardTab from './popup/tabs/DashboardTab';
import LeadsTab from './popup/tabs/LeadsTab';
import SettingsTab from './popup/tabs/SettingsTab';
import { Home, ClipboardList, Settings } from 'lucide-react';
import { MSG_TYPES, SCRAPE_STATUS } from './utils/constants';

export default function App() {
  const {
    activeTab, setActiveTab, leads, initialize, toast,
    addLeads, setScrapeProgress, setScrapeStatus,
    showToast, addSession, settings
  } = useStore();

  // Initialize store from Chrome storage on mount
  useEffect(() => {
    initialize();

    // Listen for messages from content script (via background)
    const handleMessage = (message, sender, sendResponse) => {
      switch (message.type) {
        case MSG_TYPES.SCRAPE_RESULT:
          addLeads(message.leads || []);
          break;

        case MSG_TYPES.SCRAPE_PROGRESS:
          setScrapeProgress(message.found, message.total);
          break;

        case MSG_TYPES.SCRAPE_DONE:
          setScrapeStatus(SCRAPE_STATUS.DONE);
          showToast(`Scraping complete! Found ${message.total || 0} leads`, 'success');

          // Save session
          addSession({
            id: 'session_' + Date.now(),
            date: new Date().toISOString(),
            totalLeads: message.total || 0,
            duplicatesRemoved: message.duplicatesRemoved || 0,
            elapsedMs: message.elapsedMs || 0,
            status: message.stoppedByUser ? 'stopped' : 'completed',
          });
          break;

        case MSG_TYPES.SCRAPE_ERROR:
          setScrapeStatus(SCRAPE_STATUS.ERROR);
          showToast(message.error || 'Scraping failed', 'error');

          // Auto-reset to idle after 3 seconds
          setTimeout(() => {
            const currentStatus = useStore.getState().scrapeStatus;
            if (currentStatus === SCRAPE_STATUS.ERROR) {
              setScrapeStatus(SCRAPE_STATUS.IDLE);
            }
          }, 3000);
          break;

        default:
          break;
      }
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
      }
    } catch (e) {
      console.warn('Chrome runtime not available (dev mode)');
    }
  }, []);

  // Handle dark mode changes
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Periodically check if we're on Google Maps (poll every 2s)
  useEffect(() => {
    const checkMapsPage = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            const isOnMaps = activeTab?.url?.includes('google.com/maps') || false;
            useStore.getState().setIsOnMapsPage(isOnMaps);

            // Ask content script for its status if we are on maps
            if (isOnMaps && activeTab?.id) {
              chrome.tabs.sendMessage(activeTab.id, { type: MSG_TYPES.CHECK_MAPS_PAGE }, (response) => {
                if (!chrome.runtime.lastError && response) {
                  if (response.isRunning) {
                    const storeInfo = useStore.getState();
                    if (storeInfo.scrapeStatus !== SCRAPE_STATUS.SCRAPING) {
                      storeInfo.setScrapeStatus(SCRAPE_STATUS.SCRAPING);
                    }
                    storeInfo.setScrapeProgress(response.found || 0, response.total || 0);
                  }
                }
              });
            }
          });
        }
      } catch { /* dev mode */ }
    };

    checkMapsPage();
    const interval = setInterval(checkMapsPage, 2000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={16} /> },
    { id: 'leads', label: 'Leads', icon: <ClipboardList size={16} />, badge: leads.length || null },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'leads': return <LeadsTab />;
      case 'settings': return <SettingsTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <>
      <Header />

      {/* Tab Navigation */}
      <div className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-btn-icon">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge && <span className="tab-btn-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTab()}
      </div>

      {/* Modals & Overlays */}
      <Onboarding />
      <EmailPreview />

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
