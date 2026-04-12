import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { SCRAPE_STATUS, MSG_TYPES, SCRAPE_SPEED } from '../../utils/constants';
import { AlertTriangle } from 'lucide-react';

export default function ScrapeControls() {
    const {
        scrapeStatus, setScrapeStatus, setScrapeProgress,
        isOnMapsPage, selectedCategories, settings,
        showToast, scrapeProgress, totalToScrape, addSession
    } = useStore();

    const [isInjecting, setIsInjecting] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const isScraping = scrapeStatus === SCRAPE_STATUS.SCRAPING;
    const isDisabled = !isOnMapsPage || selectedCategories.length === 0;

    // Timer for scraping
    useEffect(() => {
        let interval;
        if (isScraping) {
            interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
        } else {
            setElapsedSeconds(0);
        }
        return () => clearInterval(interval);
    }, [isScraping]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /**
     * Ensure content script is injected and ready
     */
    const ensureContentScript = async (tabId) => {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: MSG_TYPES.CHECK_MAPS_PAGE }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    // Content script not loaded — inject it
                    console.log('[GeoLead] Injecting content script...');
                    setIsInjecting(true);

                    chrome.runtime.sendMessage(
                        { type: 'INJECT_CONTENT_SCRIPT', tabId },
                        (injectResponse) => {
                            setIsInjecting(false);
                            if (injectResponse?.success) {
                                // Wait a moment for script to initialize
                                setTimeout(() => resolve(true), 500);
                            } else {
                                resolve(false);
                            }
                        }
                    );
                } else {
                    resolve(true);
                }
            });
        });
    };

    const handleStartScrape = async () => {
        if (isScraping) {
            // ====== STOP SCRAPING ======
            setScrapeStatus(SCRAPE_STATUS.IDLE);
            try {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: MSG_TYPES.STOP_SCRAPE });
                }
            } catch (e) {
                console.warn('Could not send stop message:', e);
            }
            showToast('Scraping stopped ', 'info');

            // Save partial session
            addSession({
                id: 'session_' + Date.now(),
                date: new Date().toISOString(),
                totalLeads: scrapeProgress,
                categories: selectedCategories,
                status: 'stopped',
                elapsedMs: elapsedSeconds * 1000,
            });
            return;
        }

        // ====== START SCRAPING ======
        setScrapeStatus(SCRAPE_STATUS.SCRAPING);
        setScrapeProgress(0, 0);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                showToast('No active tab found', 'error');
                setScrapeStatus(SCRAPE_STATUS.ERROR);
                return;
            }

            const tab = tabs[0];

            // Verify we're on Google Maps
            if (!tab.url?.includes('google.com/maps')) {
                showToast('Please open Google Maps first! ', 'error');
                setScrapeStatus(SCRAPE_STATUS.IDLE);
                return;
            }

            // Ensure content script is injected
            const scriptReady = await ensureContentScript(tab.id);
            if (!scriptReady) {
                showToast('Could not load scraping engine. Try refreshing the Maps page.', 'error');
                setScrapeStatus(SCRAPE_STATUS.ERROR);
                return;
            }

            showToast('Scraping started... ', 'info');

            // Send scrape command to content script
            chrome.tabs.sendMessage(tab.id, {
                type: MSG_TYPES.START_SCRAPE,
                categories: selectedCategories,
                scrollDepth: settings.scrollDepth,
                speed: SCRAPE_SPEED[settings.scrapeSpeed] || 2000,
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Message send error:', chrome.runtime.lastError);
                    showToast('Failed to communicate with Maps page. Try refreshing.', 'error');
                    setScrapeStatus(SCRAPE_STATUS.ERROR);
                    return;
                }

                if (response?.status === 'already_running') {
                    showToast('Scraping is already in progress!', 'info');
                }
            });

        } catch (e) {
            console.error('Scrape error:', e);
            showToast('Failed to start scraping. Make sure you\'re on Google Maps. ', 'error');
            setScrapeStatus(SCRAPE_STATUS.ERROR);
        }
    };

    const progressPercent = totalToScrape > 0
        ? Math.round((scrapeProgress / totalToScrape) * 100)
        : 0;

    return (
        <div className="component-card">
            {/* Scroll Depth Slider */}
            <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>Max Results to Load</span>
                    <span style={{
                        fontSize: '11px', fontWeight: 600, color: 'var(--primary-light)',
                        background: 'rgba(99, 102, 241, 0.1)', padding: '2px 8px', borderRadius: '10px'
                    }}>
                        {settings.scrollDepth}
                    </span>
                </div>
                <input
                    type="range"
                    className="slider-input"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.scrollDepth}
                    onChange={(e) => useStore.getState().updateSettings({ scrollDepth: parseInt(e.target.value) })}
                    disabled={isScraping}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 500 }}>
                    <span>10</span>
                    <span>50</span>
                    <span>100</span>
                </div>
            </div>

            {/* Speed Selector */}
            <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Scraping Speed</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {['slow', 'medium', 'fast', 'ultra'].map(speed => (
                        <button
                            key={speed}
                            className={`btn-secondary btn-sm ${settings.scrapeSpeed === speed ? 'active' : ''}`}
                            onClick={() => useStore.getState().updateSettings({ scrapeSpeed: speed })}
                            disabled={isScraping}
                            style={settings.scrapeSpeed === speed ? {
                                flex: 1,
                                backgroundColor: 'var(--primary-glow)',
                                borderColor: 'var(--primary)',
                                color: 'var(--text-primary)',
                                fontWeight: '600'
                            } : { flex: 1 }}
                        >
                            {speed.charAt(0).toUpperCase() + speed.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Progress Area (when scraping) */}
            {isScraping && (
                <div className="progress-container active">
                    <div className="progress-stats">
                        <div className="stat-box">
                            <span className="stat-label">Found</span>
                            <span className="stat-value text-primary">{scrapeProgress}</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">Target</span>
                            <span className="stat-value">{totalToScrape || '???'}</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-label">Elapsed</span>
                            <span className="stat-value font-mono">{formatTime(elapsedSeconds)}</span>
                        </div>
                    </div>

                    <div className="progress-header">
                        <span className="progress-label">
                            {isInjecting ? 'Injecting script...' : (progressPercent > 0 ? 'Extracting leads...' : 'Scanning Maps...')}
                        </span>
                        <span className="progress-value">{progressPercent}%</span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{
                                width: `${Math.max(5, Math.min(progressPercent, 100))}%`,
                                transition: progressPercent === 0 ? 'none' : 'width 0.5s ease-out'
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Start/Stop Button */}
            <button
                className={`btn-primary ${isScraping ? 'scraping' : ''}`}
                onClick={handleStartScrape}
                disabled={(isDisabled && !isScraping) || isInjecting}
                style={{ height: '44px', fontSize: '14px' }}
            >
                {!isScraping && !isDisabled && <span className="pulse-ring"></span>}
                {isInjecting ? (
                    <>
                        <span className="spinner"></span>
                        Preparing...
                    </>
                ) : isScraping ? (
                    <>
                        <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}></span>
                        Stop Scraping
                    </>
                ) : (
                    <> Start Scraping</>
                )}
            </button>

            {/* Disabled reasons */}
            {!isOnMapsPage && !isScraping && (
                <div className="warning-box">
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} /> Open Google Maps and search for a location first
                </div>
            )}
            {isOnMapsPage && selectedCategories.length === 0 && (
                <div className="warning-box">
                    <AlertTriangle size={12} style={{ flexShrink: 0 }} /> Select at least one category above
                </div>
            )}
        </div>
    );
}
