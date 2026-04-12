import React from 'react';
import useStore from '../store/useStore';
import { Key, Palette, Sun, Moon, Gauge, Ruler, Save, Info } from 'lucide-react';

export default function SettingsTab() {
    const { settings, updateSettings, showToast } = useStore();

    const handleSaveKey = () => {
        showToast('Settings saved!', 'success');
    };

    return (
        <div>
            <div className="section-title">Settings</div>

            {/* Gemini API Key */}
            <div className="settings-group">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={13} /> Gemini Pro API Key
                </label>
                <input
                    type="password"
                    className="settings-input"
                    placeholder="Enter your Gemini API key..."
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                />
                <p className="settings-hint">
                    Get your free key at{' '}
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary-light)', textDecoration: 'underline' }}
                        onClick={(e) => {
                            e.preventDefault();
                            if (typeof chrome !== 'undefined' && chrome.tabs) {
                                chrome.tabs.create({ url: 'https://aistudio.google.com/apikey' });
                            } else {
                                window.open('https://aistudio.google.com/apikey', '_blank');
                            }
                        }}
                    >
                        Google AI Studio
                    </a>
                </p>
            </div>

            {/* Theme Selection */}
            <div className="settings-group">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Palette size={13} /> Appearance
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {['light', 'dark'].map(theme => (
                        <button
                            key={theme}
                            className="btn-secondary"
                            style={{
                                flex: 1,
                                textTransform: 'capitalize',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                ...(settings.theme === theme
                                    ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                                    : {})
                            }}
                            onClick={() => updateSettings({ theme })}
                        >
                            {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />} {theme} Mode
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrape Speed */}
            <div className="settings-group">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Gauge size={13} /> Scraping Speed
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {['slow', 'medium', 'fast'].map(speed => (
                        <button
                            key={speed}
                            className="btn-secondary"
                            style={{
                                flex: 1,
                                textTransform: 'capitalize',
                                ...(settings.scrapeSpeed === speed
                                    ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                                    : {})
                            }}
                            onClick={() => updateSettings({ scrapeSpeed: speed })}
                        >
                            {speed}
                        </button>
                    ))}
                </div>
                <p className="settings-hint">
                    Slower speeds are less likely to be detected by Google. Recommended: Medium.
                </p>
            </div>

            {/* Default Scroll Depth */}
            <div className="settings-group">
                <label className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Ruler size={13} /> Default Scroll Depth
                </label>
                <div className="slider-container" style={{ margin: 0 }}>
                    <div className="slider-header">
                        <span className="slider-label">Results to load</span>
                        <span className="slider-value">{settings.scrollDepth}</span>
                    </div>
                    <input
                        type="range"
                        className="slider-input"
                        min="10"
                        max="100"
                        step="5"
                        value={settings.scrollDepth}
                        onChange={(e) => updateSettings({ scrollDepth: parseInt(e.target.value) })}
                    />
                </div>
            </div>

            {/* Save Button */}
            <button className="btn-primary" onClick={handleSaveKey} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Save size={14} /> Save Settings
            </button>

            {/* Info Section */}
            <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
            }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={13} /> About GeoLead AI
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Version 1.0.0 • Extract business leads from Google Maps and generate
                    AI-powered email pitches. Built with React + Gemini Pro.
                </div>
            </div>
        </div>
    );
}
