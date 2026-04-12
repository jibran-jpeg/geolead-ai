import React, { useState, useMemo } from 'react';
import useStore from '../store/useStore';
import LeadScore from './LeadScore';
import { WEBSITE_STATUS, PITCH_STATUS, MSG_TYPES } from '../../utils/constants';
import { Mail, Sparkles, Star, Instagram } from 'lucide-react';

export default function LeadsTable() {
    const { leads, openEmailPreview, showToast, updateLeadPitch, updateLeadPitches, settings } = useStore();
    const [filter, setFilter] = useState('all');
    const [generatingId, setGeneratingId] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);

    // Sort state
    const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // Filter & Sort
    const processedLeads = useMemo(() => {
        let result = [...leads];

        if (filter === 'no-web') result = result.filter(lead => lead.websiteStatus === WEBSITE_STATUS.NO_WEBSITE);
        else if (filter === 'has-web') result = result.filter(lead => lead.websiteStatus === WEBSITE_STATUS.HAS_WEBSITE);
        else if (filter === 'revamp') result = result.filter(lead => lead.websiteStatus === WEBSITE_STATUS.NEEDS_REVAMP);

        result.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return result;
    }, [leads, filter, sortConfig]);

    const noWebCount = leads.filter(l => l.websiteStatus === WEBSITE_STATUS.NO_WEBSITE).length;
    const hasWebCount = leads.filter(l => l.websiteStatus === WEBSITE_STATUS.HAS_WEBSITE).length;
    const revampCount = leads.filter(l => l.websiteStatus === WEBSITE_STATUS.NEEDS_REVAMP).length;

    const getStatusTag = (status) => {
        switch (status) {
            case WEBSITE_STATUS.NO_WEBSITE:
                return <span className="status-tag no-website"><span className="status-indicator red"></span> No Site</span>;
            case WEBSITE_STATUS.NEEDS_REVAMP:
                return <span className="status-tag needs-revamp"><span className="status-indicator yellow"></span> Revamp</span>;
            case WEBSITE_STATUS.HAS_WEBSITE:
                return <span className="status-tag has-website"><span className="status-indicator green"></span> Has Site</span>;
            default:
                return <span className="status-tag">—</span>;
        }
    };

    const handleGeneratePitch = async (lead, e) => {
        if (e) e.stopPropagation();

        if (!settings.geminiApiKey) {
            showToast('Add your Gemini API key in Settings first!', 'error');
            return;
        }

        setGeneratingId(lead.id);

        let mode = 'email';
        // determine mode based on available contact info
        const hasPhone = !!lead.phone;
        const hasWebsite = lead.websiteStatus === WEBSITE_STATUS.HAS_WEBSITE || lead.websiteStatus === WEBSITE_STATUS.NEEDS_REVAMP || !!lead.website;

        if (hasPhone && hasWebsite) mode = 'both';
        else if (hasPhone && !hasWebsite) mode = 'sms';

        try {
            const response = await chrome.runtime.sendMessage({
                type: MSG_TYPES.GENERATE_PITCH,
                lead,
                apiKey: settings.geminiApiKey,
                mode
            });

            if (response && response.error) {
                throw new Error(response.error);
            }

            const emailP = response?.emailPitch || response?.pitch || null;
            const smsP = response?.smsPitch || null;

            if (!emailP && !smsP) {
                throw new Error('No pitch content returned from AI');
            }

            if (mode === 'both') {
                updateLeadPitches(lead.id, emailP, smsP);
            } else if (mode === 'sms') {
                updateLeadPitches(lead.id, null, smsP);
            } else {
                updateLeadPitch(lead.id, emailP, PITCH_STATUS.GENERATED);
            }
            showToast(`AI pitch generated for "${lead.businessName}"!`, 'success');
        } catch (err) {
            console.error('[LeadsTable] Pitch generation error:', err);
            const msg = err.message || 'Pitch generation failed';
            if (msg.includes('Rate limit')) {
                showToast('Rate limit hit — wait a moment and retry', 'error');
            } else if (msg.includes('API key') || msg.includes('403')) {
                showToast('Invalid API key — check Settings', 'error');
            } else {
                showToast(`Pitch error: ${msg}`, 'error');
            }
        } finally {
            setGeneratingId(null);
        }
    };

    if (leads.length === 0) {
        return null;
    }

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
        <div style={{ marginTop: '12px' }}>
            {/* Summary Cards */}
            <div className="leads-summary">
                <div className="summary-card total">
                    <div className="summary-card-value">{leads.length}</div>
                    <div className="summary-card-label">Total Leads</div>
                </div>
                <div className="summary-card no-web">
                    <div className="summary-card-value">{noWebCount}</div>
                    <div className="summary-card-label">No Website</div>
                </div>
                <div className="summary-card has-web">
                    <div className="summary-card-value">{hasWebCount + revampCount}</div>
                    <div className="summary-card-label">Has Website</div>
                </div>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {[
                    { key: 'all', label: `All (${leads.length})` },
                    { key: 'no-web', label: `No Site (${noWebCount})` },
                    { key: 'has-web', label: `Has Site (${hasWebCount})` },
                    { key: 'revamp', label: `Revamp (${revampCount})` },
                ].map(f => (
                    <button
                        key={f.key}
                        className={`btn-secondary btn-sm ${filter === f.key ? 'active' : ''}`}
                        onClick={() => setFilter(f.key)}
                        style={filter === f.key ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' } : {}}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="leads-table-wrapper">
                <table className="leads-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('score')} style={{ cursor: 'pointer', width: '25%' }}>
                                Score <span style={{ opacity: 0.5 }}>{getSortIcon('score')}</span>
                            </th>
                            <th onClick={() => handleSort('businessName')} style={{ cursor: 'pointer', width: '35%' }}>
                                Business <span style={{ opacity: 0.5 }}>{getSortIcon('businessName')}</span>
                            </th>
                            <th onClick={() => handleSort('websiteStatus')} style={{ cursor: 'pointer', width: '25%' }}>
                                Status <span style={{ opacity: 0.5 }}>{getSortIcon('websiteStatus')}</span>
                            </th>
                            <th style={{ width: '15%' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedLeads.slice(0, 50).map((lead) => (
                            <React.Fragment key={lead.id}>
                                <tr onClick={() => toggleRow(lead.id)} style={{ cursor: 'pointer' }} className={expandedRow === lead.id ? 'expanded' : ''}>
                                    <td>
                                        <LeadScore score={lead.score} />
                                    </td>
                                    <td>
                                        <div className="lead-name" title={lead.businessName}>
                                            {lead.businessName}
                                        </div>
                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                            {lead.category.split(',')[0]}
                                        </div>
                                    </td>
                                    <td>{getStatusTag(lead.websiteStatus)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        {lead.pitchStatus === PITCH_STATUS.GENERATED ? (
                                            <button
                                                className="btn-icon"
                                                onClick={() => openEmailPreview(lead)}
                                                title="View email pitch"
                                            >
                                                <Mail size={14} />
                                            </button>
                                        ) : generatingId === lead.id ? (
                                            <div className="spinner" style={{ width: '14px', height: '14px', borderColor: 'var(--primary-glow)', borderTopColor: 'var(--primary)' }}></div>
                                        ) : (
                                            <button
                                                className="btn-icon"
                                                onClick={(e) => handleGeneratePitch(lead, e)}
                                                title="Generate AI pitch"
                                            >
                                                <Sparkles size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRow === lead.id && (
                                    <tr className="row-detail">
                                        <td colSpan="4">
                                            <div className="lead-detail-grid">
                                                {lead.phone && (
                                                    <div className="detail-item">
                                                        <span className="detail-label">Phone:</span>
                                                        <span className="detail-value">{lead.phone}</span>
                                                    </div>
                                                )}
                                                {lead.rating && (
                                                    <div className="detail-item">
                                                        <span className="detail-label">Rating:</span>
                                                        <span className="detail-value">{lead.rating} <Star size={10} fill="currentColor" style={{ color: 'var(--warning)', verticalAlign: 'middle' }} /> ({lead.reviews || 0})</span>
                                                    </div>
                                                )}
                                                {lead.address && (
                                                    <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                                        <span className="detail-label">Address:</span>
                                                        <span className="detail-value">{lead.address}</span>
                                                    </div>
                                                )}
                                                {lead.website && (
                                                    <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                                        <span className="detail-label">Website:</span>
                                                        <a href={lead.website} target="_blank" rel="noreferrer" className="detail-link text-truncate" style={{ display: 'block', maxWidth: '250px' }}>
                                                            {lead.website}
                                                        </a>
                                                    </div>
                                                )}
                                                {lead.instagram && (
                                                    <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                                        <span className="detail-label"><Instagram size={10} style={{ marginRight: '4px' }} /> Instagram:</span>
                                                        <a href={lead.instagram} target="_blank" rel="noreferrer" className="detail-link text-truncate" style={{ display: 'block', maxWidth: '250px' }}>
                                                            {lead.instagram.replace('https://www.instagram.com/', '@').replace('https://instagram.com/', '@').replace(/\/$/, '')}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {processedLeads.length > 50 && (
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                    Showing 50 of {processedLeads.length} leads. Export to see all.
                </p>
            )}
        </div>
    );
}
