# 🚀 GeoLead AI - Production-Grade Google Maps Scraper

A comprehensive, enterprise-grade Chrome extension for extracting business leads from Google Maps with advanced data validation, scoring, and export capabilities.

## 🎯 Overview

GeoLead AI is a professional lead-generation platform that goes beyond basic scraping to provide:

- **Advanced Data Validation**: Ensures data quality with comprehensive validation rules
- **Intelligent Lead Scoring**: Prioritizes leads based on multiple factors
- **Website Analysis**: Evaluates website quality and SEO performance
- **Regional Optimization**: Specialized handling for Pakistan and international markets
- **Export Capabilities**: Multiple export formats with filtering and sorting
- **Quality Assurance**: Built-in error handling and recovery mechanisms

## ✨ Key Features

### 🔍 Advanced Scraping Capabilities
- **Layout-Agnostic Parsing**: Uses multiple selectors to handle different Google Maps layouts
- **Deep Scraping**: Clicks into business cards to extract detailed information
- **Real-time Processing**: Instant data capture using MutationObserver
- **Anti-Detection Measures**: Rate limiting and human-like scrolling patterns

### 📊 Data Quality & Validation
- **Phone Number Validation**: Pakistan and international format validation
- **Email Verification**: Disposable domain detection and business email scoring
- **Website Analysis**: HTTPS validation, mobile-friendliness, and SEO assessment
- **Business Name Cleaning**: Removes Google Maps artifacts and suffixes
- **Duplicate Detection**: Advanced fuzzy matching algorithm

### 🎯 Lead Scoring System
- **Quality Score (1-10)**: Comprehensive scoring based on:
  - Contact information completeness
  - Business reputation (rating, reviews)
  - Digital presence (website, social media)
  - Business status and hours
- **Website Improvement Score**: Technical quality and SEO assessment
- **Priority Classification**: High/Medium/Low priority categories
- **Category Multipliers**: Industry-specific scoring adjustments

### 🌍 Regional Handling
- **Pakistan-Specific**: Optimized for Pakistani business data
- **International Support**: Multi-regional phone and address validation
- **Local Format Recognition**: Handles regional phone and address formats
- **Language Support**: Urdu and English business name processing

### 📤 Export Capabilities
- **Multiple Formats**: CSV, Excel, JSON export
- **Advanced Filtering**: Filter by rating, contact info, region, priority
- **Sorting Options**: Sort by quality score, rating, review count
- **Summary Reports**: Comprehensive analytics and recommendations
- **Batch Processing**: Handle large datasets efficiently

## 🛠️ Installation

### Prerequisites
- Node.js 16+
- Chrome Browser
- Google Maps API Key (for advanced features)

### Setup
1. Clone the repository:
```bash
git clone https://github.com/your-username/geolead-ai.git
cd geolead-ai
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## 🚀 Usage

### Basic Scraping
1. Navigate to Google Maps
2. Search for businesses in your target area
3. Click the GeoLead AI extension icon
4. Configure scraping settings:
   - Scroll depth (number of results)
   - Scraping speed
   - Category filters
5. Click "Start Scraping"

### Advanced Features

#### Lead Scoring
The system automatically scores leads based on:
- **Contact Information**: Phone, email, website presence
- **Business Reputation**: Google rating and review count
- **Digital Presence**: Social media profiles and website quality
- **Business Status**: Operating hours and current status

#### Website Analysis
For businesses with websites, the system analyzes:
- **Technical Quality**: HTTPS, SSL validity, mobile-friendliness
- **SEO Performance**: Meta tags, heading structure, content quality
- **Performance**: Load time, response time, resource optimization
- **Recommendations**: Specific improvement suggestions

#### Export Options
Export leads in multiple formats:
- **CSV**: For spreadsheet applications
- **Excel**: For advanced analysis and reporting
- **JSON**: For integration with other systems

Filter and sort options:
- By rating (minimum threshold)
- By contact information (phone, email, website)
- By region (Pakistan, International)
- By priority (High, Medium, Low)
- By quality score (minimum threshold)

## 📁 Project Structure

```
geolead-ai/
├── src/
│   ├── content/
│   │   ├── scraper.js          # Enhanced scraper implementation
│   │   └── productionScraper.js # Production-grade scraper
│   ├── background/
│   │   ├── background.js       # Background service worker
│   │   ├── geminiService.js   # AI pitch generation
│   │   └── agentService.js     # Agent management
│   ├── utils/
│   │   ├── dataValidation.js  # Data validation utilities
│   │   ├── leadScoring.js     # Lead scoring algorithms
│   │   ├── websiteAnalysis.js # Website analysis tools
│   │   ├── socialMediaExtractor.js # Social media profile extraction
│   │   ├── pakistanRegional.js # Pakistan-specific handling
│   │   ├── exportUtils.js     # Export functionality
│   │   └── dedup.js           # Duplicate detection
│   ├── popup/
│   │   └── App.jsx            # Main UI component
│   └── main.jsx               # Application entry point
├── scripts/
│   └── demo.js                # Demonstration script
├── tests/
│   └── enhanced.test.js      # Comprehensive test suite
├── dist/                     # Built extension files
├── package.json              # Project configuration
└── README.md                 # This file
```

## 🔧 Configuration

### Package.json Scripts
```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "jest",
    "test:watch": "jest --watch",
    "demo": "node scripts/demo.js",
    "export:demo": "node scripts/demo.js"
  }
}
```

### Environment Variables
Create a `.env` file for configuration:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
MAX_REQUESTS_PER_MINUTE=30
SCROLL_DELAY=2000
```

## 🧪 Testing

Run the comprehensive test suite:
```bash
npm test
```

Run specific test categories:
```bash
npm run test -- --testNamePattern="Data Validation"
npm run test -- --testNamePattern="Lead Scoring"
npm run test -- --testNamePattern="Export"
```

Run the demo:
```bash
npm run demo
```

## 📊 Example Output

### Lead Data Structure
```json
{
  "id": "abc123",
  "businessName": "Lahore Dental Clinic",
  "category": "Dentist",
  "rating": "4.5",
  "reviewCount": "125",
  "address": "123 Main Street, Lahore, Punjab, Pakistan",
  "phone": "+92-42-1234567",
  "email": "info@lahoredental.com",
  "website": "https://www.lahoredental.com",
  "instagram": "https://instagram.com/lahoredental",
  "facebook": "https://facebook.com/lahoredental",
  "businessStatus": "Open",
  "openingHours": "9:00 AM - 6:00 PM",
  "services": "General Dentistry, Orthodontics, Cosmetic Dentistry",
  "leadQualityScore": 8.7,
  "priority": "High",
  "region": "Pakistan",
  "scrapedAt": "2024-01-15T10:30:00.000Z"
}
```

### Quality Score Breakdown
```json
{
  "score": 8.7,
  "priority": "High",
  "breakdown": {
    "phone": { "score": 0.8, "hasPhone": true },
    "email": { "score": 0.9, "hasEmail": true },
    "website": { "score": 0.7, "hasWebsite": true },
    "rating": { "score": 0.9, "rating": 4.5 },
    "reviews": { "score": 0.8, "reviewCount": 125 },
    "socialMedia": { "score": 0.6, "platformCount": 2 },
    "businessStatus": { "score": 1.0, "isOpen": true }
  },
  "recommendations": [
    "Add LinkedIn profile for better professional presence",
    "Consider improving website load time"
  ]
}
```

### Website Analysis Report
```json
{
  "url": "https://www.lahoredental.com",
  "score": 85,
  "assessment": {
    "overall": "Very Good",
    "grade": "B",
    "strengths": ["HTTPS enabled", "Mobile-friendly design", "Fast response time"],
    "weaknesses": ["Missing meta description", "No image alt texts"]
  },
  "details": {
    "httpsEnabled": true,
    "sslValid": true,
    "mobileFriendly": true,
    "responseTime": 1200,
    "loadTime": 2500
  }
}
```

## 🚨 Important Notes

### Legal Compliance
- **Google Terms of Service**: Ensure compliance with Google's terms
- **Data Privacy**: Respect privacy regulations in your jurisdiction
- **Usage Limits**: Be mindful of rate limits to avoid being blocked

### Best Practices
1. **Start Small**: Test with small datasets first
2. **Monitor Performance**: Keep an eye on success rates
3. **Clean Data**: Regularly validate and clean extracted data
4. **Update Selectors**: Google Maps layouts change frequently
5. **Respect Limits**: Use appropriate delays between requests

### Performance Optimization
- **Network**: Use stable internet connection
- **Browser**: Keep Chrome updated
- **Memory**: Close unnecessary tabs during scraping
- **Storage**: Monitor storage usage for large datasets

## 🔧 Troubleshooting

### Common Issues

**Extension Not Loading**
- Check manifest.json syntax
- Verify file paths in dist/ folder
- Ensure all dependencies are installed

**Scraping Not Working**
- Verify you're on a Google Maps page
- Check if results are loaded and visible
- Try different scroll depths and speeds

**Data Quality Issues**
- Review validation rules in utils/dataValidation.js
- Check for layout changes in Google Maps
- Update selectors in scraper.js

**Export Problems**
- Ensure export directory exists
- Check file permissions
- Verify data format requirements

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('geolead-debug', 'true');
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **GitHub Issues**: [Report bugs and request features](https://github.com/your-username/geolead-ai/issues)
- **Documentation**: Check the [Wiki](https://github.com/your-username/geolead-ai/wiki)
- **Community**: Join our [Discord server](https://discord.gg/geolead-ai)

## 🙏 Acknowledgments

- **Google Maps Team**: For the platform and data
- **Open Source Community**: For the tools and libraries
- **Beta Testers**: For valuable feedback and suggestions

## 📈 Roadmap

### Version 3.0 (Planned)
- [ ] **AI-Powered Lead Qualification**: Machine learning for lead scoring
- [ ] **CRM Integration**: Direct sync with popular CRM systems
- [ ] **Advanced Analytics**: Business intelligence dashboards
- [ ] **Multi-Language Support**: International business data
- [ ] **API Access**: RESTful API for programmatic access

### Version 2.1 (Next Release)
- [ ] **Real-time Monitoring**: Live scraping progress
- [ ] **Bulk Processing**: Batch lead processing
- [ ] **Custom Export Templates**: User-defined export formats
- [ ] **Advanced Filtering**: Complex query filters

---

Made with ❤️ by the GeoLead AI Team