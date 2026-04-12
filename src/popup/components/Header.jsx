import React from 'react';
import useStore from '../store/useStore';
import { Settings } from 'lucide-react';

export default function Header() {
    const { activeTab, setActiveTab } = useStore();

    return (
        <div className="header">
            <div className="header-logo">
                <div style={{ padding: 0, display: 'flex', alignItems: 'center' }}>
                    <img src="/logo.png" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 8, display: 'block' }} alt="Logo" />
                </div>
                <div>
                    <div className="header-title">GeoLead AI</div>
                    <div className="header-subtitle">Smart Lead Extractor</div>
                </div>
            </div>
            <button
                className="header-settings"
                onClick={() => setActiveTab('settings')}
                title="Settings"
            >
                <Settings size={16} />
            </button>
        </div>
    );
}
