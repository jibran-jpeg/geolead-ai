import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import StatusBar from '../components/StatusBar';

import ScrapeControls from '../components/ScrapeControls';
import LeadsTable from '../components/LeadsTable';
import ExportButton from '../components/ExportButton';
import EmptyState from '../components/EmptyState';

export default function DashboardTab() {
    const { isOnMapsPage, leads } = useStore();
    const [isLoading, setIsLoading] = useState(true);

    // Simulate initial loading for smoother transition
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="skeleton-container fade-in">
                <div className="skeleton-pulse" style={{ height: '36px', borderRadius: '10px', marginBottom: '16px' }}></div>
                <div className="skeleton-pulse" style={{ height: '220px', borderRadius: '10px', marginBottom: '16px' }}></div>
                <div className="skeleton-pulse" style={{ height: '140px', borderRadius: '10px' }}></div>
            </div>
        );
    }

    return (
        <div className="fade-in">
            <StatusBar isOnMapsPage={isOnMapsPage} />
            <ScrapeControls />

            {leads.length > 0 ? (
                <>
                    <LeadsTable />
                    <ExportButton />
                </>
            ) : (
                <EmptyState
                    icon="🔍"
                    title="Ready to Find Leads"
                    description="Select categories above and hit 'Start Scraping' to extract business data from Google Maps."
                    showMapsButton={!isOnMapsPage}
                />
            )}
        </div>
    );
}
