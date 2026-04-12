import React from 'react';
import useStore from '../store/useStore';
import { exportToCSV, exportToExcel, exportToGoogleSheets } from '../../utils/exportUtils';
import { Download, FileSpreadsheet, Sheet, Trash2 } from 'lucide-react';

export default function ExportButton() {
    const { leads, showToast } = useStore();

    if (leads.length === 0) return null;

    const handleCSV = () => {
        try {
            exportToCSV(leads, 'GeoLead_AI_Export');
            showToast(`Exported ${leads.length} leads to CSV`, 'success');
        } catch (e) {
            console.error('Export error:', e);
            showToast('Export failed. Try again.', 'error');
        }
    };

    const handleExcel = () => {
        try {
            exportToExcel(leads, 'GeoLead_AI_Export');
            showToast(`Exported ${leads.length} leads to Excel`, 'success');
        } catch (e) {
            console.error('Export error:', e);
            showToast('Export failed. Try again.', 'error');
        }
    };

    const handleGoogleSheets = async () => {
        try {
            await exportToGoogleSheets(leads);
            showToast('Data copied! Paste in Google Sheet (Ctrl+V)', 'success');
        } catch (e) {
            console.error('Export error:', e);
            showToast('Export failed. Try again.', 'error');
        }
    };

    return (
        <div className="action-row" style={{ flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleCSV} style={{ flex: 1, minWidth: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Download size={12} /> CSV
            </button>
            <button className="btn-secondary" onClick={handleExcel} style={{ flex: 1, minWidth: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <FileSpreadsheet size={12} /> Excel
            </button>
            <button className="btn-secondary" onClick={handleGoogleSheets} style={{ flex: 1, minWidth: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Sheet size={12} /> Sheets
            </button>
            <button
                className="btn-secondary"
                onClick={() => {
                    useStore.getState().clearLeads();
                    showToast('All leads cleared', 'info');
                }}
                style={{ color: 'var(--danger)', minWidth: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}
