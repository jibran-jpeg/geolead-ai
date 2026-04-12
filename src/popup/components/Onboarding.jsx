import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Rocket, Map, Zap } from 'lucide-react';

export default function Onboarding() {
    const { showOnboarding, completeOnboarding } = useStore();
    const [step, setStep] = useState(1);

    if (!showOnboarding) return null;

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
        else completeOnboarding();
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-card">
                {/* Progress Dots */}
                <div className="onboarding-progress">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`progress-dot ${step === i ? 'active' : step > i ? 'completed' : ''}`}></div>
                    ))}
                </div>

                <div className="onboarding-content-container">
                    {step === 1 && (
                        <div className="onboarding-step-content slide-in-right">
                            <div className="onboarding-icon floating"><Rocket size={28} /></div>
                            <div className="onboarding-title">Welcome to GeoLead AI!</div>
                            <div className="onboarding-desc">
                                Turn Google Maps into your personal lead generation engine. Extract local business data and generate AI-powered sales pitches in seconds.
                            </div>
                            <div className="onboarding-highlight">
                                No coding or complex setup required.
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="onboarding-step-content slide-in-right">
                            <div className="onboarding-icon"><Map size={28} /></div>
                            <div className="onboarding-title">How It Works</div>
                            <div className="onboarding-steps">
                                <div className="onboarding-instruction">
                                    <span className="onboarding-step-num">1</span>
                                    <span>Search for a location on <strong>Google Maps</strong></span>
                                </div>
                                <div className="onboarding-instruction">
                                    <span className="onboarding-step-num">2</span>
                                    <span>Select business categories in the extension</span>
                                </div>
                                <div className="onboarding-instruction">
                                    <span className="onboarding-step-num">3</span>
                                    <span>Hit <strong>Start Scraping</strong> and let it run!</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="onboarding-step-content slide-in-right">
                            <div className="onboarding-icon"><Zap size={28} /></div>
                            <div className="onboarding-title">AI-Powered Pitches</div>
                            <div className="onboarding-desc">
                                We automatically identify businesses with poor digital presence (no website, bad reviews).
                            </div>
                            <div className="onboarding-api-box">
                                <div className="api-box-title">Pro Tip: Add Gemini API Key</div>
                                <div className="api-box-desc">
                                    Add your free Google Gemini API key in the settings tab to generate personalized, high-converting email pitches for every lead.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="onboarding-footer">
                    <button className="btn-link" onClick={completeOnboarding} style={{ color: 'var(--text-muted)' }}>
                        Skip
                    </button>
                    <button className="btn-primary" onClick={nextStep} style={{ width: 'auto', padding: '10px 24px' }}>
                        {step === 3 ? 'Get Started!' : 'Next →'}
                    </button>
                </div>
            </div>
        </div>
    );
}
