# GeoLead AI - Enhanced Google Maps Scraper

A production-grade Google Maps scraping engine with advanced data validation, lead scoring, website analysis, and multi-regional support.

## 🚀 Features

### Core Scraping Engine
- **Advanced Scraping Algorithm**: Robust error handling and recovery mechanisms
- **Rate Limiting & Anti-Detection**: Mimic human behavior to avoid detection
- **Multi-Regional Support**: Optimized for Pakistan and international markets
- **Performance Monitoring**: Real-time performance tracking and statistics
- **Duplicate Detection**: Advanced fuzzy matching to eliminate duplicates

### Data Quality & Validation
- **Phone Number Validation**: Pakistan-specific and international phone validation
- **Email Validation**: Domain relevance checking and disposable email detection
- **Website Validation**: URL validation and business website verification
- **Business Name Cleaning**: Standardization and normalization
- **Lead Quality Scoring**: Comprehensive scoring system (1-10 scale)

### Lead Scoring System
- **Lead Quality Score**: Based on contact information, business info, digital presence, and status
- **Website Improvement Score**: Technical quality, SEO performance, and content analysis
- **Business Priority Classification**: High/Medium/Low priority categorization
- **Category-Based Scoring**: Different weights for different business categories
- **Recommendation Engine**: Actionable insights for improving lead quality

### Website Analysis
- **Technical Analysis**: HTTPS, SSL validity, response time, load time
- **SEO Analysis**: Meta tags, heading structure, image alt text, content quality
- **Mobile-Friendliness**: Responsive design and mobile optimization checks
- **Performance Metrics**: Load time, resource size, and performance scores
- **Competitive Analysis**: Compare websites and identify improvement areas

### Social Media Extraction
- **Multi-Platform Support**: Facebook, Instagram, LinkedIn, Twitter, YouTube, TikTok, Pinterest
- **Profile Analysis**: Engagement metrics, content quality, and completeness scoring
- **URL Validation**: Social media profile URL validation and verification
- **Performance Tracking**: Social media presence and engagement analysis
- **Recommendation Engine**: Social media growth and improvement suggestions

### Regional Handling (Pakistan-Specific)
- **Pakistan Phone Validation**: Mobile and landline number validation
- **Pakistan Email Validation**: PK domain checking and local relevance
- **Pakistan Website Analysis**: PK domain validation and regional SEO
- **Regional Business Analysis**: Province and city identification
- **Cultural Considerations**: Business hours, holidays, and cultural factors

### Export Functionality
- **Multiple Formats**: CSV, Excel, and JSON export options
- **Data Filtering**: Advanced filtering by contact info, rating, priority, etc.
- **Data Sorting**: Sort by any field with ascending/descending options
- **Field Selection**: Choose which fields to include in export
- **Summary Reports**: Export statistics and analysis reports

## 📦 Installation

```bash
cd geolead-ai
npm install
```

## 🔧 Configuration

### Basic Configuration
```javascript
const config = {
    maxResults: 30,
    scrollDelay: 2000,
    retryAttempts: 3,
    requestDelay: 2000,
    enableWebsiteAnalysis: true,
    enableSocialMediaExtraction: true,
    enablePakistanRegional: false,
    enableDataValidation: true,
    enableLeadScoring: true,
    enableExport: true,
    userRegion: 'PK',
    language: 'en',
    timeout: 30000,
    antiDetection: {
        enableMouseMovements: true,
        enableKeyboardEvents: true,
        enableScrollVariation: true,
        randomizeDelays: true
    }
};
```

### Regional Configuration
```javascript
// Pakistan-specific configuration
const pakistanConfig = {
    userRegion: 'PK',
    enablePakistanRegional: true,
    phoneValidation: {
        countryCode: '+92',
        mobileCodes: ['300', '301', '302', ...],
        landlineCodes: ['21', '22', '23', ...]
    },
    businessCategories: {
        highValue: ['real estate', 'lawyer', 'doctor', ...],
        emerging: ['fintech', 'e-commerce', 'digital marketing', ...],
        traditional: ['retail', 'manufacturing', 'agriculture', ...]
    }
};
```

## 📊 Usage

### Basic Scraping
```javascript
// Start scraping with basic configuration
chrome.runtime.sendMessage({
    type: 'START_SCRAPE',
    sessionId: 'session_123',
    scrollDepth: 30,
    speed: 2000
});
```

### Enhanced Scraping with All Features
```javascript
// Start enhanced scraping with all features enabled
chrome.runtime.sendMessage({
    type: 'START_SCRAPE',
    sessionId: 'session_123',
    scrollDepth: 50,
    speed: 3000,
    config: {
        enableWebsiteAnalysis: true,
        enableSocialMediaExtraction: true,
        enablePakistanRegional: true,
        enableDataValidation: true,
        enableLeadScoring: true,
        enableExport: true,
        antiDetection: {
            enableMouseMovements: true,
            enableKeyboardEvents: true,
            enableScrollVariation: true,
            randomizeDelays: true
        }
    }
});
```

### Export Data
```javascript
// Export leads to CSV
chrome.runtime.sendMessage({
    type: 'EXPORT_DATA',
    leads: leadsArray,
    format: 'csv',
    filename: 'business_leads.csv',
    filters: {
        priority: 'High',
        minQualityScore: 7,
        hasWebsite: true
    },
    sort: {
        field: 'leadQualityScore',
        direction: 'desc'
    }
});
```

### Get Statistics
```javascript
// Get session statistics
chrome.runtime.sendMessage({
    type: 'GET_STATISTICS'
}, (response) => {
    console.log('Session Statistics:', response);
});
```

## 🔍 Data Validation

### Phone Number Validation
```javascript
// Pakistan phone validation
const phoneValidation = validatePakistanPhone('+923001234567');
console.log(phoneValidation); 
// { valid: true, normalized: '+92-300-1234567', type: 'mobile', region: 'PK' }

// International phone validation
const phoneValidation = validatePhoneNumber('+1234567890');
console.log(phoneValidation);
// { valid: true, normalized: '+1-234-567-890', region: 'US', type: 'north_america' }
```

### Email Validation
```javascript
// Email validation with domain relevance
const emailValidation = validateEmail('contact@business.com', 'business.com');
console.log(emailValidation);
// { valid: true, normalized: 'contact@business.com', score: 8, domain: 'business.com' }

// Pakistan email validation
const emailValidation = validatePakistanEmail('info@business.pk', 'business.com');
console.log(emailValidation);
// { valid: true, normalized: 'info@business.pk', score: 7, isPakistan: true }
```

### Website Validation
```javascript
// Website validation
const websiteValidation = validateWebsite('https://business.com');
console.log(websiteValidation);
// { valid: true, normalized: 'https://business.com', score: 8, hasHTTPS: true }

// Pakistan website validation
const websiteValidation = validatePakistanWebsite('https://business.pk');
console.log(websiteValidation);
// { valid: true, normalized: 'https://business.pk', score: 9, isPakistan: true }
```

## 📈 Lead Scoring

### Lead Quality Score
```javascript
const lead = {
    businessName: 'Business Name',
    phone: '+923001234567',
    email: 'contact@business.com',
    website: 'https://business.com',
    rating: '4.5',
    reviewCount: '100',
    category: 'technology'
};

const scoring = calculateLeadQualityScore(lead);
console.log(scoring);
// {
//     score: 8.5,
//     breakdown: {
//         phone: { score: 1.0, hasPhone: true },
//         email: { score: 1.5, hasEmail: true },
//         website: { score: 1.0, hasWebsite: true },
//         rating: { score: 0.8, rating: 4.5 },
//         reviews: { score: 0.6, reviewCount: 100 },
//         category: { score: 0.6, category: 'technology' }
//     },
//     priority: 'High',
//     recommendations: ['Improve customer reviews to increase lead quality']
// }
```

### Website Improvement Score
```javascript
const websiteScoring = calculateWebsiteImprovementScore(lead);
console.log(websiteScoring);
// {
//     score: 7.2,
//     breakdown: {
//         domain: { score: 8.0, isProfessional: true },
//         technical: { score: 6.0, httpsEnabled: true },
//         content: { score: 7.5, hasServices: true },
//         seo: { score: 7.0, metaTags: true }
//     },
//     recommendations: ['Add more content to your website', 'Include contact information']
// }
```

## 🌐 Website Analysis

### Basic Website Analysis
```javascript
const websiteAnalysis = await analyzeWebsite('https://business.com');
console.log(websiteAnalysis);
// {
//     valid: true,
//     score: 85,
//     details: {
//         httpsEnabled: true,
//         sslValid: true,
//         reachable: true,
//         responseTime: 250,
//         loadTime: 1200,
//         mobileFriendly: true,
//         metaTitle: true,
//         metaDescription: true,
//         headingStructure: true,
//         imageAltTexts: 80
//     },
//     assessment: {
//         overall: 'Very Good',
//         grade: 'B',
//         strengths: ['HTTPS enabled', 'Mobile-friendly design'],
//         weaknesses: ['Missing meta description']
//     }
// }
```

### Website Comparison
```javascript
const comparison = await compareWebsites('https://site1.com', 'https://site2.com');
console.log(comparison);
// {
//     website1: { score: 85, grade: 'B' },
//     website2: { score: 78, grade: 'C' },
//     winner: 'https://site1.com',
//     difference: 7,
//     recommendations: ['Site 1 performs better than Site 2 by 7 points']
// }
```

## 📱 Social Media Extraction

### Social Media Profile Analysis
```javascript
const socialMediaAnalysis = await extractSocialMediaProfiles('https://business.com');
console.log(socialMediaAnalysis);
// {
//     success: true,
//     website: 'https://business.com',
//     profiles: {
//         facebook: {
//             urls: ['https://facebook.com/businesspage'],
//             analysis: {
//                 score: 75,
//                 metrics: {
//                     engagement: { score: 80, metrics: { followers: 5000 } },
//                     content: { score: 70, metrics: { posts: 50 } },
//                     profile: { score: 75, metrics: { completeness: 75 } }
//                 }
//             }
//         }
//     },
//     analysis: {
//         totalPlatforms: 3,
//         activePlatforms: 2,
//         averageScore: 72,
//         bestPlatform: 'facebook'
//     },
//     recommendations: ['Focus on Facebook as it shows the best performance']
// }
```

## 🇵🇰 Pakistan-Specific Features

### Pakistan Business Analysis
```javascript
const pakistanAnalysis = analyzePakistanBusiness(lead);
console.log(pakistanAnalysis);
// {
//     valid: true,
//     isPakistanBusiness: true,
//     region: 'Punjab',
//     province: 'Punjab',
//     city: 'Lahore',
//     phoneValidation: { valid: true, type: 'mobile', region: 'PK' },
//     emailValidation: { valid: true, isPakistan: true },
//     websiteValidation: { valid: true, isPakistan: true },
//     businessCategory: { type: 'high_value', priority: 'high' },
//     recommendations: ['Use Pakistan-specific domain for better local SEO']
// }
```

### Pakistan Business Statistics
```javascript
const pakistanStats = getPakistanBusinessStatistics(leads);
console.log(pakistanStats);
// {
//     total: 100,
//     pakistanBusinesses: 75,
//     statistics: {
//         byProvince: { 'Punjab': 30, 'Sindh': 25, 'Khyber Pakhtunkhwa': 20 },
//         byCategory: { 'high_value': 40, 'emerging': 20, 'traditional': 15 },
//         byPhoneType: { 'mobile': 60, 'landline': 15 },
//         averageRating: 4.2,
//         averageQualityScore: 7.8
//     }
// }
```

## 📊 Export Functionality

### CSV Export
```javascript
const csvResult = await exportToCSV(leads, {
    filename: 'business_leads.csv',
    fields: ['businessName', 'phone', 'email', 'website', 'rating'],
    filters: { priority: 'High' },
    sort: { field: 'leadQualityScore', direction: 'desc' }
});
console.log(csvResult);
// {
//     success: true,
//     filename: 'business_leads.csv',
//     filePath: './exports/business_leads.csv',
//     recordCount: 25,
//     fileSize: 2048
// }
```

### Excel Export
```javascript
const excelResult = await exportToExcel(leads, {
    filename: 'business_leads.xlsx',
    sheetName: 'Leads',
    autoFilter: true,
    autoWidth: true
});
console.log(excelResult);
// {
//     success: true,
//     filename: 'business_leads.xlsx',
//     filePath: './exports/business_leads.xlsx',
//     recordCount: 25,
//     fileSize: 5120
// }
```

### JSON Export
```javascript
const jsonResult = await exportToJSON(leads, {
    filename: 'business_leads.json',
    includeMetadata: true
});
console.log(jsonResult);
// {
//     success: true,
//     filename: 'business_leads.json',
//     filePath: './exports/business_leads.json',
//     recordCount: 25,
//     fileSize: 1536
// }
```

## 📈 Performance Monitoring

### Performance Statistics
```javascript
const performance = getPerformanceStats();
console.log(performance);
// {
//     duration: 120000, // 2 minutes
//     requests: 150,
//     errors: 5,
//     retries: 3,
//     avgRequestTime: 800,
//     successRate: 0.967,
//     lastRequestTime: 1634567890123
// }
```

### Session Statistics
```javascript
const sessionStats = getSessionStatistics();
console.log(sessionStats);
// {
//     sessionId: 'session_123',
//     startTime: 1634567890123,
//     duration: 120000,
//     leadsProcessed: 45,
//     errorCount: 2,
//     retryCount: 1,
//     successRate: 95.6,
//     performance: { /* ... */ },
//     config: { /* ... */ }
// }
```

## 🔧 Advanced Configuration

### Anti-Detection Settings
```javascript
const antiDetectionConfig = {
    enableMouseMovements: true,
    enableKeyboardEvents: true,
    enableScrollVariation: true,
    randomizeDelays: true,
    userAgentRotation: true,
    proxyRotation: false,
    requestDelayRange: { min: 1000, max: 3000 },
    maxConcurrentRequests: 5
};
```

### Rate Limiting Configuration
```javascript
const rateLimitConfig = {
    maxRequestsPerMinute: 30,
    maxRequestsPerHour: 500,
    requestDelay: 2000,
    maxRetries: 3,
    retryDelay: 5000,
    errorThreshold: 10,
    errorCooldownTime: 60000
};
```

## 🚨 Error Handling

### Retry Logic
```javascript
try {
    const result = await scrapeWithRetry(scraperFunction, {
        maxRetries: 3,
        retryDelay: 5000,
        onRetry: (error, attempt) => {
            console.log(`Retry attempt ${attempt}: ${error.message}`);
        }
    });
} catch (error) {
    console.error('Scraping failed after all retries:', error);
}
```

### Error Recovery
```javascript
const recoveryStrategies = {
    networkError: { action: 'retry', delay: 5000 },
    rateLimitError: { action: 'wait', delay: 60000 },
    elementNotFound: { action: 'scroll', delay: 2000 },
    timeoutError: { action: 'restart', delay: 10000 }
};
```

## 📋 API Reference

### Core Functions

#### `startScraping(config)`
Start the scraping process with enhanced features.

**Parameters:**
- `config` (Object): Scraping configuration

**Returns:**
- `Promise<void>`

#### `validateLeadData(lead)`
Validate and clean lead data.

**Parameters:**
- `lead` (Object): Lead object to validate

**Returns:**
- `Object`: Validation result

#### `calculateLeadQualityScore(lead)`
Calculate lead quality score.

**Parameters:**
- `lead` (Object): Lead object

**Returns:**
- `Object`: Scoring result

#### `analyzeWebsite(url)`
Analyze website for technical quality and SEO performance.

**Parameters:**
- `url` (String): Website URL

**Returns:**
- `Promise<Object>`: Website analysis result

#### `extractSocialMediaProfiles(website)`
Extract and analyze social media profiles.

**Parameters:**
- `website` (String): Business website URL

**Returns:**
- `Promise<Object>`: Social media analysis result

#### `analyzePakistanBusiness(lead)`
Analyze Pakistan-specific business data.

**Parameters:**
- `lead` (Object): Lead object

**Returns:**
- `Object`: Pakistan analysis result

### Export Functions

#### `exportLeads(leads, options)`
Export leads to different formats.

**Parameters:**
- `leads` (Array): Array of lead objects
- `options` (Object): Export options

**Returns:**
- `Promise<Object>`: Export result

#### `exportToCSV(leads, options)`
Export leads to CSV format.

**Parameters:**
- `leads` (Array): Array of lead objects
- `options` (Object): Export options

**Returns:**
- `Promise<Object>`: Export result

#### `exportToExcel(leads, options)`
Export leads to Excel format.

**Parameters:**
- `leads` (Array): Array of lead objects
- `options` (Object): Export options

**Returns:**
- `Promise<Object>`: Export result

#### `exportToJSON(leads, options)`
Export leads to JSON format.

**Parameters:**
- `leads` (Array): Array of lead objects
- `options` (Object): Export options

**Returns:**
- `Promise<Object>`: Export result

## 🎯 Best Practices

### 1. Rate Limiting
- Always respect rate limits to avoid IP blocking
- Use random delays between requests
- Monitor error rates and adjust accordingly

### 2. Data Quality
- Enable data validation for better lead quality
- Use duplicate detection to avoid redundant data
- Implement lead scoring for prioritization

### 3. Anti-Detection
- Enable mouse movements and keyboard events
- Use random scroll amounts and delays
- Rotate user agents when possible

### 4. Error Handling
- Implement retry logic for transient errors
- Log errors for debugging and analysis
- Have fallback strategies for common failures

### 5. Performance Optimization
- Monitor performance metrics
- Optimize request timing and concurrency
- Use caching where appropriate

## 📊 Monitoring and Analytics

### Key Metrics to Track
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Percentage of failed requests
- **Average Response Time**: Time taken for requests
- **Leads Processed**: Number of leads successfully processed
- **Duplicate Rate**: Percentage of duplicate leads detected
- **Quality Scores**: Average lead quality scores

### Performance Monitoring
```javascript
// Monitor performance in real-time
setInterval(() => {
    const stats = getPerformanceStats();
    console.log('Performance Stats:', stats);
    
    if (stats.errorRate > 0.1) {
        console.warn('High error rate detected!');
    }
    
    if (stats.avgResponseTime > 5000) {
        console.warn('Slow response times detected!');
    }
}, 30000); // Every 30 seconds
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Rate Limiting Errors
```
Error: Rate limit exceeded. Wait 60 seconds.
```
**Solution:** Increase delays between requests or reduce concurrency.

#### 2. Element Not Found
```
Error: Could not find Google Maps results panel.
```
**Solution:** Ensure you're on a Google Maps search results page.

#### 3. Authentication Issues
```
Error: Authentication required.
```
**Solution:** Check if you're logged into Google account.

#### 4. Data Quality Issues
```
Warning: Low lead quality scores detected.
```
**Solution:** Enable data validation and improve extraction accuracy.

### Debug Mode
```javascript
// Enable debug mode for detailed logging
const debugConfig = {
    enableDebugLogging: true,
    logLevel: 'verbose',
    trackPerformance: true,
    saveDebugData: true
};

updateConfiguration(debugConfig);
```

## 📈 Future Enhancements

### Planned Features
- **Machine Learning Integration**: AI-powered lead scoring and prediction
- **Advanced Analytics**: Detailed business intelligence and market analysis
- **API Integration**: Third-party service integrations (CRM, marketing tools)
- **Real-time Updates**: Live lead monitoring and notifications
- **Multi-language Support**: International language and localization
- **Advanced Reporting**: Custom report generation and dashboard

### Roadmap
- **Q1 2024**: Enhanced AI features and machine learning integration
- **Q2 2024**: Advanced analytics and reporting dashboard
- **Q3 2024**: API integrations and third-party services
- **Q4 2024**: Mobile app and real-time monitoring

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/geolead-ai.git

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you need help or have questions:
- Check the [Documentation](https://docs.geolead-ai.com)
- Open an [Issue](https://github.com/your-username/geolead-ai/issues)
- Join our [Discord Community](https://discord.gg/geolead-ai)

## 🙏 Acknowledgments

- Google Maps API (for providing the data source)
- Open source community for various libraries and tools
- Beta testers and early adopters for valuable feedback

---

**GeoLead AI** - *Smart lead extraction for the modern business world*