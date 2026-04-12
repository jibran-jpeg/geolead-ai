import React from 'react';
import useStore from '../store/useStore';
import { SCRAPE_STATUS } from '../../utils/constants';
import { Search, CheckCircle2, XCircle, MapPin, AlertTriangle } from 'lucide-react';

export default function StatusBar({ isOnMapsPage }) {
    const { scrapeStatus, leads, duplicatesSkipped } = useStore();

    const openGoogleMaps = () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: 'https://www.google.com/maps' });
        } else {
            window.open('https://www.google.com/maps', '_blank');
        }
    };

    const getStatusInfo = () => {
        if (scrapeStatus === SCRAPE_STATUS.SCRAPING) {
            return {
                text: 'Scraping in progress...',
                icon: <Search size={14} />,
                className: 'scraping',
            };
        }
        if (scrapeStatus === SCRAPE_STATUS.DONE) {
            return {
                text: `Done! ${leads.length} leads collected`,
                icon: <CheckCircle2 size={14} />,
                className: 'active',
            };
        }
        if (scrapeStatus === SCRAPE_STATUS.ERROR) {
            return {
                text: 'Scraping error occurred',
                icon: <XCircle size={14} />,
                className: 'inactive',
            };
        }
        if (isOnMapsPage) {
            return {
                text: 'Active on Google Maps',
                icon: <MapPin size={14} />,
                className: 'active',
            };
        }
        return {
            text: 'Not on Google Maps',
            icon: <AlertTriangle size={14} />,
            className: 'inactive',
            action: (
                <button className="btn-link" onClick={openGoogleMaps}>
                    Open Maps ↗
                </button>
            )
        };
    };

    const status = getStatusInfo();

    return (
        <div className={`status-badge ${status.className}`}>
            <span className="status-dot"></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{status.icon}</span>
                <span>{status.text}</span>
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                {status.action ? status.action : (
                    leads.length > 0 && scrapeStatus !== SCRAPE_STATUS.SCRAPING && (
                        <div className="status-stats tooltip-trigger" data-tooltip={`${duplicatesSkipped} duplicates skipped`}>
                            <span className="stat-pill success">{leads.length} leads</span>
                            {duplicatesSkipped > 0 && <span className="stat-pill neutral">{duplicatesSkipped} dupes</span>}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
