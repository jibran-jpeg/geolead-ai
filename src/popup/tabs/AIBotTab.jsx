import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { MSG_TYPES, ENRICHMENT_STATUS, PITCH_STATUS } from '../../utils/constants';
import { startKeepAlive, stopKeepAlive } from '../../utils/keepAlive';

/**
 * AI Bot Tab — Enrichment & Pitch Generation
 *
 * This tab provides the AI Bot interface for lead enrichment.
 * It displays logs, progress, and allows users to trigger enrichment.
 * It communicates with the background service worker to perform AI-driven tasks.
 */
export default function AIBotTab() {
    const {
        leads, settings, showToast,
        enrichmentStatus, enrichmentProgress, enrichmentTotal, enrichingLead,
        setEnrichmentStatus, setEnrichmentProgress, resetEnrichment,
        bulkUpdateLeads, updateLeadPitch, updateLeadPitches,
    } = useStore();

    const [logs, setLogs] = useState([]);
    const [isGeneratingPitches, setIsGeneratingPitches] = useState(false);
    const logsEndRef = useRef(null);

    const enrichableLeads = leads.filter(l => l.website && l.website.trim() !== '');
    const isEnriching = enrichmentStatus === ENRICHMENT_STATUS.ENRICHING;
    const progressPercent = enrichmentTotal > 0 ? Math.round((enrichmentProgress / enrichmentTotal) * 100) : 0;

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Listen for enrichment progress messages from background
    useEffect(() => {
        const handleMessage = (message) => {
            if (message.type === MSG_TYPES.ENRICH_PROGRESS) {
                setEnrichmentProgress(message.completed, message.total, message.currentLead);
                if (message.currentLead && message.currentLead !== 'Done!') {
                    addLog(` (${message.completed + 1}/${message.total}) Analyzing: ${message.currentLead}...`, 'info');
                }
            }
        };
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
                chrome.runtime.onMessage.addListener(handleMessage);
                return () => chrome.runtime.onMessage.removeListener(handleMessage);
            }
        } catch { /* dev mode */ }
    }, []);

    const addLog = (text, type = 'info') => {
        setLogs(prev => [...prev, { text, type, time: new Date().toLocaleTimeString() }]);
    };

    // Start enrichment
    const handleStartEnrichment = async () => {
        if (!settings.geminiApiKey) {
            showToast('Add your Gemini API key in Settings first!', 'error');
            return;
        }

        if (enrichableLeads.length === 0) {
            showToast('No leads with websites to enrich', 'error');
            return;
        }

        setLogs([]);
        setEnrichmentStatus(ENRICHMENT_STATUS.ENRICHING);
        addLog(`🚀 Starting enrichment for ${enrichableLeads.length} leads...`, 'success');
        
        startKeepAlive('AIBotTab_enrichMent');

        try {
            const response = await chrome.runtime.sendMessage({
                type: MSG_TYPES.ENRICH_LEADS,
                leads: enrichableLeads,
                apiKey: settings.geminiApiKey,
            });

            if (response.error) {
                throw new Error(response.error);
            }

            if (response.enrichedLeads) {
                bulkUpdateLeads(response.enrichedLeads);
                const successCount = response.enrichedLeads.filter(l => l.enrichmentStatus === 'ENRICHED').length;
                addLog(` Done! ${successCount}/${enrichableLeads.length} leads enriched successfully.`, 'success');
                showToast(`Enriched ${successCount} leads! `, 'success');
            }

            setEnrichmentStatus(ENRICHMENT_STATUS.ENRICHED);
        } catch (err) {
            setEnrichmentStatus(ENRICHMENT_STATUS.FAILED);
            addLog(` Enrichment failed: ${err.message}`, 'error');
            showToast('Enrichment failed. Check your API key.', 'error');
        } finally {
            stopKeepAlive();
        }
    };

    // Generate pitches for all leads
    const handleGenerateAllPitches = async () => {
        if (!settings.geminiApiKey) {
            showToast('Add your Gemini API key in Settings first!', 'error');
            addLog('❌ Generation cancelled: No API key found in Settings.', 'error');
            return;
        }

        setIsGeneratingPitches(true);
        addLog('📧 Generating AI pitches for all leads...', 'info');
        startKeepAlive('AIBotTab_pitchGen');

        const pendingLeads = leads.filter(l => l.pitchStatus !== PITCH_STATUS.GENERATED);
        let count = 0;
        let errors = 0;

        for (const lead of pendingLeads) {
            try {
                const mode = lead.phone ? 'both' : 'email';
                const response = await chrome.runtime.sendMessage({
                    type: MSG_TYPES.GENERATE_PITCH,
                    lead,
                    apiKey: settings.geminiApiKey,
                    mode,
                });

                if (response && response.error) {
                    throw new Error(response.error);
                }

                const emailP = response?.emailPitch || response?.pitch || null;
                const smsP = response?.smsPitch || null;

                if (!emailP && !smsP) {
                    throw new Error('No pitch content returned');
                }

                if (mode === 'both' || mode === 'sms') {
                    updateLeadPitches(lead.id, emailP, smsP);
                } else {
                    updateLeadPitch(lead.id, emailP, PITCH_STATUS.GENERATED);
                }
                count++;
                addLog(`✅ Pitch for "${lead.businessName}"`, 'success');
            } catch (err) {
                errors++;
                const msg = err.message || 'Unknown error';
                addLog(`❌ "${lead.businessName}": ${msg}`, 'error');

                if (msg.includes('Rate limit') || msg.includes('429')) {
                    addLog('⏳ Rate limit hit — pausing for 10s...', 'info');
                    await new Promise(res => setTimeout(res, 10000));
                }
            }
        }

        addLog(`📧 Done! ${count} pitches generated${errors > 0 ? `, ${errors} failed` : ''}.`, count > 0 ? 'success' : 'error');
        showToast(`${count} pitches generated${errors > 0 ? ` (${errors} failed)` : ''}`, count > 0 ? 'success' : 'error');
        setIsGeneratingPitches(false);
        stopKeepAlive();
    };

    return (
        <div className="agent-tab">
            {/* Header */}
            <div className="agent-header">
                <div className="agent-header-icon"></div>
                <div>
                    <div className="agent-header-title">AI Lead Bot</div>
                    <div className="agent-header-subtitle">
                        Intelligent lead enrichment & qualification
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="agent-stats">
                <div className="agent-stat">
                    <span className="agent-stat-value">{leads.length}</span>
                    <span className="agent-stat-label">Total</span>
                </div>
                <div className="agent-stat">
                    <span className="agent-stat-value">{enrichableLeads.length}</span>
                    <span className="agent-stat-label">Enrichable</span>
                </div>
                <div className="agent-stat">
                    <span className="agent-stat-value">
                        {leads.filter(l => l.enrichmentStatus === 'ENRICHED').length}
                    </span>
                    <span className="agent-stat-label">Enriched</span>
                </div>
                <div className="agent-stat">
                    <span className="agent-stat-value">
                        {leads.filter(l => l.pitchStatus === PITCH_STATUS.GENERATED).length}
                    </span>
                    <span className="agent-stat-label">Pitched</span>
                </div>
            </div>

            {/* Progress */}
            {isEnriching && (
                <div className="agent-progress-wrap">
                    <div className="agent-progress-bar">
                        <div className="agent-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="agent-progress-text">
                        {enrichingLead ? `Analyzing: ${enrichingLead}` : 'Starting...'} ({progressPercent}%)
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="agent-actions">
                <button
                    className="btn-primary agent-btn"
                    onClick={handleStartEnrichment}
                    disabled={isEnriching || enrichableLeads.length === 0 || !settings.geminiApiKey}
                >
                    {isEnriching ? (
                        <><span className="agent-spinner"></span> Enriching...</>
                    ) : (
                        `🚀 Enrich ${enrichableLeads.length} Leads`
                    )}
                </button>
                <button
                    className="btn-secondary agent-btn"
                    onClick={handleGenerateAllPitches}
                    disabled={isGeneratingPitches || leads.length === 0}
                >
                    {isGeneratingPitches ? 'Generating...' : `📧 Generate All Pitches`}
                </button>
            </div>

            {/* Activity Log */}
            <div className="agent-log">
                {logs.length === 0 ? (
                    <div className="agent-log-item" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                         Ready to enrich your leads. Click the button above to start!
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`agent-log-item ${log.type}`}>
                            <span>{log.text}</span>
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>

            {/* API Key Warning */}
            {!settings.geminiApiKey && (
                <div className="warning-box">
                     Add your Gemini API key in Settings to enable AI features
                </div>
            )}
        </div>
    );
}
