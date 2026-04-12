import React from 'react';
import useStore from '../store/useStore';
import EmptyState from '../components/EmptyState';

export default function HistoryTab() {
    const { sessions } = useStore();

    if (sessions.length === 0) {
        return (
            <EmptyState
                icon="📂"
                title="No Sessions Yet"
                description="Your scraping history will be saved here automatically after each session."
            />
        );
    }

    return (
        <div>
            <div className="section-title">Scraping History</div>
            {sessions.map((session, index) => (
                <div key={session.id || index} className="history-card">
                    <div className="history-card-header">
                        <span className="history-card-location">
                             {session.location || 'Google Maps'}
                        </span>
                        <span className="history-card-date">
                            {session.date ? new Date(session.date).toLocaleDateString() : ''}
                        </span>
                    </div>
                    <div className="history-card-stats">
                        <span>📊 {session.totalLeads || 0} leads</span>
                        <span>🔴 {session.noWebsite || 0} no website</span>
                        <span> {session.pitchesGenerated || 0} pitches</span>
                    </div>
                    {session.categories && (
                        <div style={{
                            fontSize: '9px',
                            color: 'var(--text-muted)',
                            marginTop: '6px',
                            display: 'flex',
                            gap: '4px',
                            flexWrap: 'wrap',
                        }}>
                            {session.categories.map(cat => (
                                <span
                                    key={cat}
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        padding: '2px 6px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                    }}
                                >
                                    {cat}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
