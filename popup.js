// popup.js - Chrome Extension Popup UI Controller

class GeoLeadAIPopup {
    constructor() {
        this.isScraping = false;
        this.currentTab = null;
        this.scrapedData = [];
        this.currentProgress = 0;
        this.totalTargets = 0;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadSettings();
        this.checkCurrentTab();
    }

    initializeElements() {
        // Status elements
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        
        // Form elements
        this.searchQuery = document.getElementById('searchQuery');
        this.maxResults = document.getElementById('maxResults');
        this.scrollDepth = document.getElementById('scrollDepth');
        this.scrapingSpeed = document.getElementById('scrapingSpeed');
        this.categoryFilter = document.getElementById('categoryFilter');
        
        // Feature checkboxes
        this.enableDataValidation = document.getElementById('enableDataValidation');
        this.enableLeadScoring = document.getElementById('enableLeadScoring');
        this.enableWebsiteAnalysis = document.getElementById('enableWebsiteAnalysis');
        this.enableSocialMediaExtraction = document.getElementById('enableSocialMediaExtraction');
        this.enablePakistanRegional = document.getElementById('enablePakistanRegional');
        this.enableAntiDetection = document.getElementById('enableAntiDetection');
        
        // Export options
        this.exportFormat = document.getElementById('exportFormat');
        this.minRating = document.getElementById('minRating');
        this.minReviews = document.getElementById('minReviews');
        this.priorityFilter = document.getElementById('priorityFilter');
        
        // Buttons
        this.startButton = document.getElementById('startScraping');
        this.stopButton = document.getElementById('stopScraping');
        this.clearButton = document.getElementById('clearData');
        this.exportButton = document.getElementById('exportNow');
        this.viewDataButton = document.getElementById('viewData');
        
        // Progress and stats
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressCount = document.getElementById('progressCount');
        this.statsSection = document.getElementById('statsSection');
        this.exportSection = document.getElementById('exportSection');
        
        // Statistics
        this.totalLeadsEl = document.getElementById('totalLeads');
        this.highPriorityEl = document.getElementById('highPriority');
        this.avgRatingEl = document.getElementById('avgRating');
        this.successRateEl = document.getElementById('successRate');
        this.lastUpdateEl = document.getElementById('lastUpdate');
    }

    attachEventListeners() {
        this.startButton.addEventListener('click', () => this.startScraping());
        this.stopButton.addEventListener('click', () => this.stopScraping());
        this.clearButton.addEventListener('click', () => this.clearData());
        this.exportButton.addEventListener('click', () => this.exportData());
        this.viewDataButton.addEventListener('click', () => this.viewData());
        
        // Settings links
        document.getElementById('settingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });
        
        document.getElementById('helpLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openHelp();
        });
        
        document.getElementById('aboutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openAbout();
        });
        
        // Save settings on change
        const settingsInputs = [
            this.maxResults, this.scrollDepth, this.scrapingSpeed, this.categoryFilter,
            this.enableDataValidation, this.enableLeadScoring, this.enableWebsiteAnalysis,
            this.enableSocialMediaExtraction, this.enablePakistanRegional, this.enableAntiDetection,
            this.exportFormat, this.minRating, this.minReviews, this.priorityFilter
        ];
        
        settingsInputs.forEach(input => {
            input.addEventListener('change', () => this.saveSettings());
        });
    }

    async checkCurrentTab() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];
            
            if (this.currentTab && this.currentTab.url.includes('google.com/maps')) {
                this.updateStatus('active', 'On Google Maps');
                this.searchQuery.value = this.extractSearchQuery();
            } else {
                this.updateStatus('inactive', 'Not on Google Maps');
                this.startButton.disabled = true;
            }
        } catch (error) {
            console.error('Error checking current tab:', error);
            this.updateStatus('error', 'Error checking tab');
        }
    }

    extractSearchQuery() {
        const url = new URL(this.currentTab.url);
        const params = url.searchParams;
        return params.get('q') || params.get('query') || '';
    }

    updateStatus(status, text) {
        this.statusText.textContent = text;
        
        // Update status indicator
        this.statusIndicator.className = 'status-indicator';
        switch (status) {
            case 'active':
                this.statusIndicator.classList.add('active');
                break;
            case 'scraping':
                this.statusIndicator.classList.add('scraping');
                break;
            case 'inactive':
                this.statusIndicator.classList.add('inactive');
                break;
            case 'error':
                this.statusIndicator.classList.add('error');
                break;
        }
    }

    async startScraping() {
        if (this.isScraping) return;
        
        try {
            this.isScraping = true;
            this.updateUIForScraping(true);
            this.updateStatus('scraping', 'Scraping in progress...');
            
            // Get configuration
            const config = this.getConfiguration();
            
            // Send scraping command to content script
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'startScraping',
                config: config
            });
            
            if (response && response.success) {
                this.setupProgressTracking(response.totalTargets);
            } else {
                throw new Error('Failed to start scraping');
            }
            
        } catch (error) {
            console.error('Error starting scraping:', error);
            this.updateStatus('error', 'Error: ' + error.message);
            this.stopScraping();
        }
    }

    stopScraping() {
        if (!this.isScraping) return;
        
        this.isScraping = false;
        this.updateUIForScraping(false);
        this.updateStatus('inactive', 'Scraping stopped');
        
        // Send stop command to content script
        chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'stopScraping'
        });
    }

    clearData() {
        if (confirm('Are you sure you want to clear all scraped data?')) {
            this.scrapedData = [];
            this.updateProgress(0, 0);
            this.updateStatistics();
            this.saveSettings();
            this.updateStatus('inactive', 'Data cleared');
        }
    }

    getConfiguration() {
        return {
            searchQuery: this.searchQuery.value.trim(),
            maxResults: parseInt(this.maxResults.value),
            scrollDepth: parseInt(this.scrollDepth.value),
            scrapingSpeed: this.scrapingSpeed.value,
            categoryFilter: this.categoryFilter.value.trim(),
            
            features: {
                dataValidation: this.enableDataValidation.checked,
                leadScoring: this.enableLeadScoring.checked,
                websiteAnalysis: this.enableWebsiteAnalysis.checked,
                socialMediaExtraction: this.enableSocialMediaExtraction.checked,
                pakistanRegional: this.enablePakistanRegional.checked,
                antiDetection: this.enableAntiDetection.checked
            },
            
            export: {
                format: this.exportFormat.value,
                minRating: parseFloat(this.minRating.value),
                minReviews: parseInt(this.minReviews.value),
                priorityFilter: this.priorityFilter.value
            }
        };
    }

    setupProgressTracking(totalTargets) {
        this.totalTargets = totalTargets;
        this.currentProgress = 0;
        this.progressSection.style.display = 'block';
        this.updateProgress(0, 0);
    }

    updateProgress(current, total) {
        this.currentProgress = current;
        this.totalTargets = total;
        
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = percentage + '%';
        this.progressCount.textContent = `${current} / ${total}`;
        
        // Update scraped data
        if (current > 0) {
            this.scrapedData = this.scrapedData.slice(0, current);
            this.updateStatistics();
            
            // Show export section if we have data
            if (current >= 10) {
                this.exportSection.style.display = 'block';
            }
        }
    }

    updateStatistics() {
        const total = this.scrapedData.length;
        const highPriority = this.scrapedData.filter(lead => lead.priority === 'High').length;
        const ratings = this.scrapedData.filter(lead => lead.rating).map(lead => parseFloat(lead.rating));
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0.0';
        const successRate = total > 0 ? Math.round((this.scrapedData.filter(lead => lead.isValid).length / total) * 100) : 0;
        
        this.totalLeadsEl.textContent = total;
        this.highPriorityEl.textContent = highPriority;
        this.avgRatingEl.textContent = avgRating;
        this.successRateEl.textContent = successRate + '%';
        
        // Update last update time
        const now = new Date();
        this.lastUpdateEl.textContent = now.toLocaleString();
    }

    async exportData() {
        try {
            const config = this.getConfiguration();
            const filteredData = this.filterData(this.scrapedData, config.export);
            
            if (filteredData.length === 0) {
                alert('No data to export after filtering.');
                return;
            }
            
            switch (config.export.format) {
                case 'csv':
                    await this.exportToCSV(filteredData);
                    break;
                case 'excel':
                    await this.exportToExcel(filteredData);
                    break;
                case 'json':
                    await this.exportToJSON(filteredData);
                    break;
            }
            
            this.updateStatus('active', 'Data exported successfully');
            
        } catch (error) {
            console.error('Error exporting data:', error);
            this.updateStatus('error', 'Export failed: ' + error.message);
        }
    }

    filterData(data, exportConfig) {
        return data.filter(lead => {
            // Rating filter
            if (lead.rating && parseFloat(lead.rating) < exportConfig.minRating) {
                return false;
            }
            
            // Reviews filter
            if (lead.reviewCount && parseInt(lead.reviewCount) < exportConfig.minReviews) {
                return false;
            }
            
            // Priority filter
            if (exportConfig.priorityFilter !== 'all' && lead.priority !== exportConfig.priorityFilter) {
                return false;
            }
            
            return true;
        });
    }

    async exportToCSV(data) {
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: `geolead-ai-${new Date().toISOString().split('T')[0]}.csv`,
            saveAs: true
        });
    }

    async exportToExcel(data) {
        // This would require a proper Excel library
        // For now, we'll create a simplified Excel-like CSV with proper formatting
        const headers = Object.keys(data[0] || {});
        const csvContent = [
            headers.join('\t'),
            ...data.map(row => headers.map(header => (row[header] || '')).join('\t'))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: `geolead-ai-${new Date().toISOString().split('T')[0]}.xlsx`,
            saveAs: true
        });
    }

    async exportToJSON(data) {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: `geolead-ai-${new Date().toISOString().split('T')[0]}.json`,
            saveAs: true
        });
    }

    viewData() {
        // Open data in a new tab
        const dataStr = JSON.stringify(this.scrapedData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const dataUrl = URL.createObjectURL(dataBlob);
        
        chrome.tabs.create({ url: dataUrl });
    }

    updateUIForScraping(isScraping) {
        this.startButton.disabled = isScraping;
        this.stopButton.disabled = !isScraping;
        
        if (isScraping) {
            this.startButton.classList.add('disabled');
            this.stopButton.classList.remove('disabled');
        } else {
            this.startButton.classList.remove('disabled');
            this.stopButton.classList.add('disabled');
        }
    }

    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get({
                maxResults: 50,
                scrollDepth: 2,
                scrapingSpeed: 'normal',
                categoryFilter: '',
                enableDataValidation: true,
                enableLeadScoring: true,
                enableWebsiteAnalysis: true,
                enableSocialMediaExtraction: true,
                enablePakistanRegional: true,
                enableAntiDetection: true,
                exportFormat: 'excel',
                minRating: 0,
                minReviews: 0,
                priorityFilter: 'all'
            });
            
            // Load settings into form
            this.maxResults.value = settings.maxResults;
            this.scrollDepth.value = settings.scrollDepth;
            this.scrapingSpeed.value = settings.scrapingSpeed;
            this.categoryFilter.value = settings.categoryFilter;
            this.enableDataValidation.checked = settings.enableDataValidation;
            this.enableLeadScoring.checked = settings.enableLeadScoring;
            this.enableWebsiteAnalysis.checked = settings.enableWebsiteAnalysis;
            this.enableSocialMediaExtraction.checked = settings.enableSocialMediaExtraction;
            this.enablePakistanRegional.checked = settings.enablePakistanRegional;
            this.enableAntiDetection.checked = settings.enableAntiDetection;
            this.exportFormat.value = settings.exportFormat;
            this.minRating.value = settings.minRating;
            this.minReviews.value = settings.minReviews;
            this.priorityFilter.value = settings.priorityFilter;
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                maxResults: parseInt(this.maxResults.value),
                scrollDepth: parseInt(this.scrollDepth.value),
                scrapingSpeed: this.scrapingSpeed.value,
                categoryFilter: this.categoryFilter.value.trim(),
                enableDataValidation: this.enableDataValidation.checked,
                enableLeadScoring: this.enableLeadScoring.checked,
                enableWebsiteAnalysis: this.enableWebsiteAnalysis.checked,
                enableSocialMediaExtraction: this.enableSocialMediaExtraction.checked,
                enablePakistanRegional: this.enablePakistanRegional.checked,
                enableAntiDetection: this.enableAntiDetection.checked,
                exportFormat: this.exportFormat.value,
                minRating: parseFloat(this.minRating.value),
                minReviews: parseInt(this.minReviews.value),
                priorityFilter: this.priorityFilter.value
            };
            
            await chrome.storage.sync.set(settings);
            
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    openSettings() {
        chrome.tabs.create({ url: 'chrome://extensions/?options=' + chrome.runtime.id });
    }

    openHelp() {
        chrome.tabs.create({ url: 'https://github.com/your-username/geolead-ai/wiki' });
    }

    openAbout() {
        alert('GeoLead AI v3.0.0\\n\\nA production-grade Google Maps scraper with advanced lead generation capabilities.\\n\\nFeatures:\\n• Advanced data validation\\n• Intelligent lead scoring\\n• Website analysis\\n• Social media extraction\\n• Pakistan regional optimization\\n• Multiple export formats\\n\\n© 2024 GeoLead AI Team');
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GeoLeadAIPopup();
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapingProgress') {
        // Update progress from content script
        const popup = window.geoLeadAIPopup;
        if (popup) {
            popup.updateProgress(message.current, message.total);
        }
    } else if (message.action === 'scrapingComplete') {
        // Handle scraping completion
        const popup = window.geoLeadAIPopup;
        if (popup) {
            popup.scrapedData = message.data;
            popup.updateProgress(message.data.length, message.data.length);
            popup.updateStatistics();
            popup.updateStatus('active', 'Scraping complete');
            popup.updateUIForScraping(false);
        }
    } else if (message.action === 'scrapingError') {
        // Handle scraping errors
        const popup = window.geoLeadAIPopup;
        if (popup) {
            popup.updateStatus('error', message.error);
            popup.updateUIForScraping(false);
        }
    }
    
    return true;
});