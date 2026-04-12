import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Shared data formatter for export
 */
function formatLeadsData(leads) {
    return leads.map(lead => ({
        'Business Name': lead.businessName || '',
        'Category': lead.category || '',
        'Rating': lead.rating || '',
        'Reviews': lead.reviewCount || '',
        'Address': lead.address || '',
        'Phone': lead.phone || '',
        'Email': lead.email || '',
        'Owner Name': lead.ownerName || '',
        'Emails Found': (lead.emails || []).join(', '),
        'Phones Found': (lead.phones || []).join(', '),
        'Services': lead.services || '',
        'Website': lead.website || 'N/A',
        'Website Status': formatWebsiteStatus(lead.websiteStatus),
        'Instagram': lead.instagram || '',
        'Lead Score': lead.score || '',
        'AI Email Pitch': lead.pitch || '',
        'Google Maps Link': lead.placeUrl || '',
        'Scraped Date': lead.scrapedAt ? new Date(lead.scrapedAt).toLocaleDateString() : '',
    }));
}

/**
 * Export leads data to CSV file
 */
export function exportToCSV(leads, filename = 'geolead-export') {
    const data = formatLeadsData(leads);
    const csv = Papa.unparse(data);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fullName = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerDownload(blob, fullName);
}

/**
 * Export leads data to Excel (.xlsx) file
 */
export function exportToExcel(leads, filename = 'geolead-export') {
    // Excel gets all details EXCEPT AI pitch
    const data = leads.map(lead => ({
        'Business Name': lead.businessName || '',
        'Category': lead.category || '',
        'Rating': lead.rating || '',
        'Reviews': lead.reviewCount || '',
        'Address': lead.address || '',
        'Phone': lead.phone || '',
        'Email': lead.email || '',
        'Owner Name': lead.ownerName || '',
        'Emails Found': (lead.emails || []).join(', '),
        'Phones Found': (lead.phones || []).join(', '),
        'Services': lead.services || '',
        'Website': lead.website || 'N/A',
        'Website Status': formatWebsiteStatus(lead.websiteStatus),
        'Instagram': lead.instagram || '',
        'Lead Score': lead.score || '',
        'Google Maps Link': lead.placeUrl || '',
        'Scraped Date': lead.scrapedAt ? new Date(lead.scrapedAt).toLocaleDateString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length).slice(0, 50)) + 2
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fullName = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerDownload(blob, fullName);
}

/**
 * Download a blob with proper filename — uses Chrome Downloads API in extension context
 */
function triggerDownload(blob, filename) {
    const reader = new FileReader();
    reader.onloadend = function () {
        const dataUrl = reader.result;

        // Use Chrome Downloads API if available
        if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
            chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: true,
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error("Download failed:", chrome.runtime.lastError.message);
                }
            });
        } else {
            // Fallback for non-extension environments
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    reader.readAsDataURL(blob);
}

function formatWebsiteStatus(status) {
    switch (status) {
        case 'NO_WEBSITE': return ' No Website';
        case 'HAS_WEBSITE': return ' Has Website';
        case 'NEEDS_REVAMP': return ' Needs Revamp';
        default: return 'Unknown';
    }
}

/**
 * Open Gmail compose with pre-filled email pitch
 */
export function draftInGmail(lead) {
    const subject = encodeURIComponent(
        `Website Development Opportunity for ${lead.businessName}`
    );
    const body = encodeURIComponent(lead.pitch || '');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;

    // Chrome extension: open new tab
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: gmailUrl });
    } else {
        window.open(gmailUrl, '_blank');
    }
}

/**
 * Export leads directly to Google Sheets
 * Copies data as TSV to clipboard and opens a new Google Sheet
 */
export async function exportToGoogleSheets(leads) {
    const data = formatLeadsData(leads);
    if (data.length === 0) return false;

    // Build TSV (tab-separated) — Google Sheets pastes this perfectly
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => String(row[h] || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
    const tsv = headers.join('\t') + '\n' + rows.join('\n');

    // Copy to clipboard using execCommand (works in extension side panel)
    let copied = false;
    try {
        const ta = document.createElement('textarea');
        ta.value = tsv;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
    } catch {
        copied = false;
    }

    // Fallback to Clipboard API
    if (!copied) {
        try {
            await navigator.clipboard.writeText(tsv);
            copied = true;
        } catch {
            copied = false;
        }
    }

    if (!copied) {
        throw new Error('Could not copy data to clipboard');
    }

    // Open new Google Sheet
    const sheetsUrl = 'https://docs.google.com/spreadsheets/create';
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: sheetsUrl });
    } else {
        window.open(sheetsUrl, '_blank');
    }

    return true;
}
