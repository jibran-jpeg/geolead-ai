import React, { useState } from 'react';
import useStore from '../store/useStore';
import LeadScore from '../components/LeadScore';
import EmptyState from '../components/EmptyState';
import { WEBSITE_STATUS, PITCH_STATUS, MSG_TYPES } from '../../utils/constants';
import { exportToCSV, draftInGmail } from '../../utils/exportUtils';
import { ClipboardList, Sparkles, Download, CheckCircle2, Star, User, Mail, Phone } from 'lucide-react';

export default function LeadsTab() {
    const { leads, openEmailPreview, showToast, updateLeadPitch, settings } = useStore();
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('score');
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    if (leads.length === 0) {
        return (
            <EmptyState
                icon={<ClipboardList size={28} />}
                title="No Leads Yet"
                description="Go to the Dashboard tab and start scraping to collect leads."
            />
        );
    }

    // Filter by search
    let filteredLeads = leads.filter(lead =>
        lead.businessName?.toLowerCase().includes(search.toLowerCase()) ||
        lead.category?.toLowerCase().includes(search.toLowerCase()) ||
        lead.address?.toLowerCase().includes(search.toLowerCase())
    );

    // Sort
    filteredLeads.sort((a, b) => {
        if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
        if (sortBy === 'name') return (a.businessName || '').localeCompare(b.businessName || '');
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        return 0;
    });

    const handleGenerateAll = async () => {
        setIsGeneratingAll(true);
        const pending = leads.filter(l => l.pitchStatus !== PITCH_STATUS.GENERATED);
        let count = 0;

        for (const lead of pending) {
            try {
                if (!settings.geminiApiKey) {
                    throw new Error('No API key attached');
                }
                const response = await chrome.runtime.sendMessage({
                    type: MSG_TYPES.GENERATE_PITCH,
                    lead,
                    apiKey: settings.geminiApiKey,
                    mode: 'email'
                });

                if (response && response.error) {
                    throw new Error(response.error);
                }

                const pitch = response?.emailPitch || response?.pitch;
                if (pitch) {
                    updateLeadPitch(lead.id, pitch, PITCH_STATUS.GENERATED);
                    count++;
                } else {
                    throw new Error('No valid pitch string returned');
                }
            } catch (err) {
                console.warn('[LeadsTab] Generate pitch error:', err);
                if (err.message.includes('No API key')) {
                    showToast('No Gemini API key found in Settings!', 'error');
                    break;
                } else if (err.message.includes('API')) {
                    showToast(`API Error: ${err.message}`, 'error');
                } else {
                    showToast(`Error: ${err.message}`, 'error');
                }
                
                if (err.message.includes('Rate limit')) {
                    break;
                }
            }
        }

        setIsGeneratingAll(false);
        showToast(`Generated ${count} pitches!`, 'success');
    };

    return (
        <div>
            {/* Search & Controls */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <input
                    type="text"
                    className="settings-input"
                    placeholder="Search leads..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', fontSize: '11px' }}
                />
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        padding: '6px 8px',
                        fontSize: '10px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                    }}
                >
                    <option value="score">By Score</option>
                    <option value="name">By Name</option>
                    <option value="rating">By Rating</option>
                </select>
            </div>

            {/* Bulk Actions */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button className="btn-secondary btn-sm" disabled={isGeneratingAll} onClick={handleGenerateAll} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={11} /> {isGeneratingAll ? 'Generating...' : 'Generate All Pitches'}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => exportToCSV(leads)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Download size={11} /> Export All CSV
                </button>
            </div>

            {/* Leads List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredLeads.map(lead => (
                    <div
                        key={lead.id}
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 12px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                        }}
                        onClick={() => lead.pitch && openEmailPreview(lead)}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <LeadScore score={lead.score} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                                {lead.businessName}
                            </span>
                            {lead.websiteStatus === WEBSITE_STATUS.NO_WEBSITE && (
                                <span className="status-tag no-website"><span className="status-indicator red"></span> No Site</span>
                            )}
                            {lead.websiteStatus === WEBSITE_STATUS.HAS_WEBSITE && (
                                <span className="status-tag has-website"><span className="status-indicator green"></span> Has Site</span>
                            )}
                            {lead.websiteStatus === WEBSITE_STATUS.NEEDS_REVAMP && (
                                <span className="status-tag needs-revamp"><span className="status-indicator yellow"></span> Revamp</span>
                            )}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span>{lead.category}</span>
                            {lead.rating && <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Star size={9} fill="currentColor" style={{ color: 'var(--warning)' }} /> {lead.rating}</span>}
                            {lead.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Phone size={9} /> {lead.phone}</span>}
                        </div>
                        {/* Enriched Data */}
                        {lead.enrichmentStatus === 'ENRICHED' && (
                            <div style={{
                                fontSize: '10px',
                                color: 'var(--text-secondary)',
                                marginTop: '4px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                            }}>
                                {lead.ownerName && (
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(99, 102, 241, 0.15)',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}><User size={9} /> {lead.ownerName}</span>
                                )}
                                {lead.emails?.length > 0 && lead.emails.map((email, i) => (
                                    <span key={i} style={{
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(16, 185, 129, 0.15)',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}><Mail size={9} /> {email}</span>
                                ))}
                                {lead.phones?.length > 0 && lead.phones.map((phone, i) => (
                                    <span key={i} style={{
                                        background: 'rgba(245, 158, 11, 0.08)',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(245, 158, 11, 0.15)',
                                        display: 'flex', alignItems: 'center', gap: '3px'
                                    }}><Phone size={9} /> {phone}</span>
                                ))}
                            </div>
                        )}
                        {lead.pitch && (
                            <div style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                marginTop: '4px',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <CheckCircle2 size={10} /> Pitch ready — click to preview
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                Showing {filteredLeads.length} of {leads.length} leads
            </p>
        </div>
    );
}
