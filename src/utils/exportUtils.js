/**
 * Export Functionality for Excel and CSV
 * Provides comprehensive export capabilities with filtering and sorting options
 */

const fs = require('fs');
const path = require('path');

/**
 * Export configuration
 */
const EXPORT_CONFIG = {
    maxRows: 10000, // Maximum number of rows to export
    supportedFormats: ['csv', 'excel', 'json'],
    defaultFormat: 'csv',
    fields: {
        required: ['businessName', 'category', 'phone', 'email', 'website', 'address'],
        optional: [
            'rating', 'reviewCount', 'latitude', 'longitude', 'city', 
            'state', 'country', 'postalCode', 'businessStatus', 
            'openingHours', 'services', 'instagram', 'facebook', 
            'linkedin', 'twitter', 'youtube', 'tiktok', 'pinterest',
            'leadQualityScore', 'priority', 'websiteAnalysis'
        ]
    },
    csvOptions: {
        delimiter: ',',
        quote: '"',
        escape: '"',
        encoding: 'utf8',
        headers: true
    },
    excelOptions: {
        format: 'xlsx',
        sheetName: 'Leads',
        freezeHeader: true,
        autoFilter: true,
        autoWidth: true
    }
};

/**
 * Export leads to different formats
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Export options
 * @returns {Promise<Object>} Export result
 */
async function exportLeads(leads, options = {}) {
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return { 
            success: false, 
            error: 'No leads to export',
            filename: null,
            format: null 
        };
    }

    // Validate export options
    const exportOptions = {
        format: options.format || EXPORT_CONFIG.defaultFormat,
        filename: options.filename || generateExportFilename(),
        directory: options.directory || './exports',
        filters: options.filters || {},
        sort: options.sort || {},
        fields: options.fields || null,
        limit: options.limit || EXPORT_CONFIG.maxRows,
        ...options
    };

    // Validate format
    if (!EXPORT_CONFIG.supportedFormats.includes(exportOptions.format)) {
        return { 
            success: false, 
            error: `Unsupported format: ${exportOptions.format}`,
            filename: null,
            format: null 
        };
    }

    // Apply filters
    let filteredLeads = applyFilters(leads, exportOptions.filters);
    
    // Apply sorting
    filteredLeads = applySorting(filteredLeads, exportOptions.sort);
    
    // Apply limit
    filteredLeads = filteredLeads.slice(0, exportOptions.limit);
    
    // Ensure directory exists
    ensureDirectory(exportOptions.directory);
    
    // Export based on format
    let result;
    switch (exportOptions.format) {
        case 'csv':
            result = await exportToCSV(filteredLeads, exportOptions);
            break;
        case 'excel':
            result = await exportToExcel(filteredLeads, exportOptions);
            break;
        case 'json':
            result = await exportToJSON(filteredLeads, exportOptions);
            break;
        default:
            result = { 
                success: false, 
                error: `Unsupported format: ${exportOptions.format}`,
                filename: null,
                format: null 
            };
    }

    return result;
}

/**
 * Export leads to CSV format
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Export options
 * @returns {Promise<Object>} Export result
 */
async function exportToCSV(leads, options = {}) {
    try {
        const csvOptions = { ...EXPORT_CONFIG.csvOptions, ...options.csvOptions };
        const fields = options.fields || getExportFields(leads[0]);
        
        let csvContent = '';
        
        // Add headers
        csvContent += fields.map(field => csvOptions.quote + field + csvOptions.quote).join(csvOptions.delimiter) + '\n';
        
        // Add data rows
        for (const lead of leads) {
            const row = fields.map(field => {
                const value = getFieldValue(lead, field);
                return csvOptions.quote + (value ? String(value).replace(csvOptions.quote, csvOptions.escape + csvOptions.quote) : '') + csvOptions.quote;
            });
            csvContent += row.join(csvOptions.delimiter) + '\n';
        }
        
        // Write to file
        const filePath = path.join(options.directory, options.filename);
        fs.writeFileSync(filePath, csvContent, csvOptions.encoding);
        
        return {
            success: true,
            filename: options.filename,
            filePath: filePath,
            format: 'csv',
            recordCount: leads.length,
            fileSize: fs.statSync(filePath).size
        };
        
    } catch (error) {
        return {
            success: false,
            error: `CSV export failed: ${error.message}`,
            filename: null,
            format: 'csv'
        };
    }
}

/**
 * Export leads to Excel format
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Export options
 * @returns {Promise<Object>> Export result
 */
async function exportToExcel(leads, options = {}) {
    try {
        // For Excel export, we would typically use a library like 'exceljs' or 'xlsx'
        // For this example, we'll create a simplified version
        
        const excelOptions = { ...EXPORT_CONFIG.excelOptions, ...options.excelOptions };
        const fields = options.fields || getExportFields(leads[0]);
        
        // Create Excel file structure
        const excelData = {
            sheets: [{
                name: excelOptions.sheetName,
                data: [],
                styles: {}
            }]
        };
        
        // Add headers
        const headerRow = fields.map(field => ({
            value: field,
            style: {
                font: { bold: true },
                fill: { fgColor: { rgb: 'E0E0E0' } }
            }
        }));
        excelData.sheets[0].data.push(headerRow);
        
        // Add data rows
        for (const lead of leads) {
            const row = fields.map(field => ({
                value: getFieldValue(lead, field),
                style: {}
            }));
            excelData.sheets[0].data.push(row);
        }
        
        // Apply Excel-specific formatting
        if (excelOptions.freezeHeader) {
            excelData.sheets[0].freezeHeader = true;
        }
        
        if (excelOptions.autoFilter) {
            excelData.sheets[0].autoFilter = true;
        }
        
        // Write to file (simplified - in real implementation, use exceljs or xlsx)
        const filePath = path.join(options.directory, options.filename);
        fs.writeFileSync(filePath, JSON.stringify(excelData, null, 2));
        
        return {
            success: true,
            filename: options.filename,
            filePath: filePath,
            format: 'excel',
            recordCount: leads.length,
            fileSize: fs.statSync(filePath).size
        };
        
    } catch (error) {
        return {
            success: false,
            error: `Excel export failed: ${error.message}`,
            filename: null,
            format: 'excel'
        };
    }
}

/**
 * Export leads to JSON format
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Export options
 * @returns {Promise<Object>> Export result
 */
async function exportToJSON(leads, options = {}) {
    try {
        const fields = options.fields || getExportFields(leads[0]);
        
        // Prepare data for export
        const exportData = leads.map(lead => {
            const filteredLead = {};
            fields.forEach(field => {
                filteredLead[field] = getFieldValue(lead, field);
            });
            return filteredLead;
        });
        
        // Create export metadata
        const exportMetadata = {
            exportedAt: new Date().toISOString(),
            totalRecords: exportData.length,
            format: 'json',
            fields: fields,
            filters: options.filters,
            sort: options.sort
        };
        
        // Create complete export object
        const exportObject = {
            metadata: exportMetadata,
            data: exportData
        };
        
        // Write to file
        const filePath = path.join(options.directory, options.filename);
        fs.writeFileSync(filePath, JSON.stringify(exportObject, null, 2));
        
        return {
            success: true,
            filename: options.filename,
            filePath: filePath,
            format: 'json',
            recordCount: leads.length,
            fileSize: fs.statSync(filePath).size
        };
        
    } catch (error) {
        return {
            success: false,
            error: `JSON export failed: ${error.message}`,
            filename: null,
            format: 'json'
        };
    }
}

/**
 * Apply filters to leads
 * @param {Array} leads - Array of lead objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered leads
 */
function applyFilters(leads, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return leads;
    }

    return leads.filter(lead => {
        // Phone filter
        if (filters.phone) {
            const phone = lead.phone || '';
            if (!phone.toLowerCase().includes(filters.phone.toLowerCase())) {
                return false;
            }
        }

        // Email filter
        if (filters.email) {
            const email = lead.email || '';
            if (!email.toLowerCase().includes(filters.email.toLowerCase())) {
                return false;
            }
        }

        // Website filter
        if (filters.website) {
            const website = lead.website || '';
            if (!website.toLowerCase().includes(filters.website.toLowerCase())) {
                return false;
            }
        }

        // Business name filter
        if (filters.businessName) {
            const name = lead.businessName || '';
            if (!name.toLowerCase().includes(filters.businessName.toLowerCase())) {
                return false;
            }
        }

        // Category filter
        if (filters.category) {
            const category = lead.category || '';
            if (!category.toLowerCase().includes(filters.category.toLowerCase())) {
                return false;
            }
        }

        // Rating filter
        if (filters.rating) {
            const rating = parseFloat(lead.rating) || 0;
            const minRating = parseFloat(filters.rating);
            if (rating < minRating) {
                return false;
            }
        }

        // Review count filter
        if (filters.reviewCount) {
            const reviews = parseInt(lead.reviewCount) || 0;
            const minReviews = parseInt(filters.reviewCount);
            if (reviews < minReviews) {
                return false;
            }
        }

        // Priority filter
        if (filters.priority) {
            const priority = lead.priority || 'Low';
            if (priority !== filters.priority) {
                return false;
            }
        }

        // Lead quality score filter
        if (filters.minQualityScore) {
            const score = parseFloat(lead.leadQualityScore) || 0;
            const minScore = parseFloat(filters.minQualityScore);
            if (score < minScore) {
                return false;
            }
        }

        // Has website filter
        if (filters.hasWebsite !== undefined) {
            const hasWebsite = !!lead.website;
            if (hasWebsite !== filters.hasWebsite) {
                return false;
            }
        }

        // Has phone filter
        if (filters.hasPhone !== undefined) {
            const hasPhone = !!lead.phone;
            if (hasPhone !== filters.hasPhone) {
                return false;
            }
        }

        // Has email filter
        if (filters.hasEmail !== undefined) {
            const hasEmail = !!lead.email;
            if (hasEmail !== filters.hasEmail) {
                return false;
            }
        }

        // Date range filter
        if (filters.dateRange) {
            const scrapedAt = new Date(lead.scrapedAt);
            const startDate = new Date(filters.dateRange.start);
            const endDate = new Date(filters.dateRange.end);
            
            if (scrapedAt < startDate || scrapedAt > endDate) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Apply sorting to leads
 * @param {Array} leads - Array of lead objects
 * @param {Object} sort - Sort criteria
 * @returns {Array} Sorted leads
 */
function applySorting(leads, sort) {
    if (!sort || Object.keys(sort).length === 0) {
        return leads;
    }

    const { field, direction = 'asc' } = sort;
    
    return leads.sort((a, b) => {
        let aValue = a[field];
        let bValue = b[field];
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';
        
        // Handle numeric values
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            if (direction === 'asc') {
                return aValue - bValue;
            } else {
                return bValue - aValue;
            }
        }
        
        // Handle string values
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        if (direction === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });
}

/**
 * Get export fields based on lead structure
 * @param {Object} lead - Sample lead object
 * @returns {Array} Array of field names
 */
function getExportFields(lead) {
    if (!lead) return [];
    
    const fields = [];
    
    // Add required fields
    EXPORT_CONFIG.fields.required.forEach(field => {
        if (lead[field] !== undefined) {
            fields.push(field);
        }
    });
    
    // Add optional fields that exist in the lead
    EXPORT_CONFIG.fields.optional.forEach(field => {
        if (lead[field] !== undefined) {
            fields.push(field);
        }
    });
    
    // Add any additional fields
    Object.keys(lead).forEach(field => {
        if (!fields.includes(field) && !field.startsWith('_')) {
            fields.push(field);
        }
    });
    
    return fields;
}

/**
 * Get field value from lead object
 * @param {Object} lead - Lead object
 * @param {string} field - Field name
 * @returns {*} Field value
 */
function getFieldValue(lead, field) {
    if (!lead || !field) return null;
    
    // Handle nested fields (e.g., 'websiteAnalysis.httpsEnabled')
    if (field.includes('.')) {
        const parts = field.split('.');
        let value = lead;
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return null;
            }
        }
        return value;
    }
    
    return lead[field];
}

/**
 * Generate export filename
 * @param {string} format - Export format
 * @returns {string} Generated filename
 */
function generateExportFilename(format = 'csv') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 6);
    return `geolead-export-${timestamp}-${random}.${format}`;
}

/**
 * Ensure directory exists
 * @param {string} directory - Directory path
 */
function ensureDirectory(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

/**
 * Get export statistics
 * @param {Array} leads - Array of lead objects
 * @returns {Object} Export statistics
 */
function getExportStatistics(leads) {
    if (!leads || leads.length === 0) {
        return {
            totalLeads: 0,
            withPhone: 0,
            withEmail: 0,
            withWebsite: 0,
            averageRating: 0,
            averageQualityScore: 0,
            categoryDistribution: {},
            priorityDistribution: {}
        };
    }

    const stats = {
        totalLeads: leads.length,
        withPhone: 0,
        withEmail: 0,
        withWebsite: 0,
        averageRating: 0,
        averageQualityScore: 0,
        categoryDistribution: {},
        priorityDistribution: {}
    };

    let totalRating = 0;
    let totalQualityScore = 0;
    let ratingCount = 0;
    let qualityScoreCount = 0;

    leads.forEach(lead => {
        // Count phone numbers
        if (lead.phone) {
            stats.withPhone++;
        }

        // Count emails
        if (lead.email) {
            stats.withEmail++;
        }

        // Count websites
        if (lead.website) {
            stats.withWebsite++;
        }

        // Calculate average rating
        if (lead.rating) {
            const rating = parseFloat(lead.rating);
            if (!isNaN(rating)) {
                totalRating += rating;
                ratingCount++;
            }
        }

        // Calculate average quality score
        if (lead.leadQualityScore) {
            const score = parseFloat(lead.leadQualityScore);
            if (!isNaN(score)) {
                totalQualityScore += score;
                qualityScoreCount++;
            }
        }

        // Category distribution
        if (lead.category) {
            const category = lead.category.trim();
            stats.categoryDistribution[category] = (stats.categoryDistribution[category] || 0) + 1;
        }

        // Priority distribution
        if (lead.priority) {
            const priority = lead.priority.trim();
            stats.priorityDistribution[priority] = (stats.priorityDistribution[priority] || 0) + 1;
        }
    });

    // Calculate averages
    stats.averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    stats.averageQualityScore = qualityScoreCount > 0 ? totalQualityScore / qualityScoreCount : 0;

    return stats;
}

/**
 * Export summary report
 * @param {Array} leads - Array of lead objects
 * @param {Object} options - Export options
 * @returns {Object} Summary report
 */
function generateSummaryReport(leads, options = {}) {
    const stats = getExportStatistics(leads);
    const filteredLeads = applyFilters(leads, options.filters || {});
    const sortedLeads = applySorting(filteredLeads, options.sort || {});

    return {
        exportInfo: {
            timestamp: new Date().toISOString(),
            format: options.format || 'csv',
            totalRecords: leads.length,
            filteredRecords: filteredLeads.length,
            exportedRecords: sortedLeads.length,
            filename: options.filename || generateExportFilename(options.format),
            filters: options.filters,
            sort: options.sort
        },
        statistics: stats,
        qualityMetrics: {
            completeness: {
                phone: (stats.withPhone / stats.totalLeads) * 100,
                email: (stats.withEmail / stats.totalLeads) * 100,
                website: (stats.withWebsite / stats.totalLeads) * 100
            },
            averageRating: stats.averageRating.toFixed(2),
            averageQualityScore: stats.averageQualityScore.toFixed(2)
        },
        recommendations: generateRecommendations(stats)
    };
}

/**
 * Generate recommendations based on statistics
 * @param {Object} stats - Export statistics
 * @returns {Array} Recommendations
 */
function generateRecommendations(stats) {
    const recommendations = [];

    if (stats.withPhone / stats.totalLeads < 0.5) {
        recommendations.push('Consider focusing on businesses with phone numbers for better lead quality');
    }

    if (stats.withEmail / stats.totalLeads < 0.4) {
        recommendations.push('Email contacts are valuable - prioritize businesses with email addresses');
    }

    if (stats.withWebsite / stats.totalLeads < 0.6) {
        recommendations.push('Websites provide additional information and credibility');
    }

    if (stats.averageRating < 3.0) {
        recommendations.push('Consider filtering for higher-rated businesses for better quality leads');
    }

    if (stats.averageQualityScore < 5.0) {
        recommendations.push('Focus on improving lead quality scores through better contact information');
    }

    return recommendations;
}

/**
 * Export utilities
 */
module.exports = {
    exportLeads,
    exportToCSV,
    exportToExcel,
    exportToJSON,
    applyFilters,
    applySorting,
    getExportFields,
    getFieldValue,
    generateExportFilename,
    ensureDirectory,
    getExportStatistics,
    generateSummaryReport,
    EXPORT_CONFIG
};