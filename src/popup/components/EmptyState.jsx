import React, { useState, useEffect } from 'react';
import { MapPin, Lightbulb, Search } from 'lucide-react';

const TIPS = [
    "Tip: Select multiple categories to get more leads.",
    "Tip: Adjust scroll depth in settings for larger areas.",
    "Tip: Red Hot leads are local businesses with no website!",
    "Tip: Add your Gemini API key for personalized email pitches."
];

export default function EmptyState({ icon, title, description, showMapsButton = true }) {
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % TIPS.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const openGoogleMaps = () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: 'https://www.google.com/maps' });
        } else {
            window.open('https://www.google.com/maps', '_blank');
        }
    };

    const renderIcon = () => {
        if (icon) return <span className="empty-state-icon-wrapper">{icon}</span>;
        return <Search size={32} strokeWidth={1.5} />;
    };

    return (
        <div className="empty-state">
            <div className="empty-state-icon floating">{renderIcon()}</div>
            <div className="empty-state-title">{title || 'No Data Yet'}</div>
            <div className="empty-state-desc">
                {description || 'Start scraping to collect business leads from Google Maps.'}
            </div>

            {showMapsButton && (
                <button className="btn-secondary" onClick={openGoogleMaps} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> Open Google Maps
                </button>
            )}

            <div className="empty-state-tip fade-in-out" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lightbulb size={12} /> {TIPS[tipIndex]}
            </div>
        </div>
    );
}
