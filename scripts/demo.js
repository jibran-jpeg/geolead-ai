// demo.js - Comprehensive demonstration script for GeoLead AI
// This script demonstrates the scraper functionality with sample data and testing scenarios

class GeoLeadAIDemo {
    constructor() {
        this.demoData = this.generateSampleData();
        this.currentScenario = 0;
        this.scenarios = [
            'Basic Scraping',
            'Advanced Lead Scoring',
            'Website Analysis',
            'Social Media Extraction',
            'Pakistan Regional Mode',
            'Export Functionality'
        ];
        this.results = [];
    }

    // Generate realistic sample business data for demonstration
    generateSampleData() {
        const businessNames = [
            'Lahore Dental Clinic',
            'Karachi Electronics Store',
            'Islamabad Law Firm',
            'Peshawar Restaurant',
            'Quetta Hospital',
            'Sialkot Textile Mills',
            'Faisalabad Garments',
            'Multan Real Estate',
            'Hyderabad Engineering',
            'Sukkur Trading Co'
        ];

        const categories = [
            'Dentist', 'Electronics', 'Lawyer', 'Restaurant', 'Hospital',
            'Textile', 'Garments', 'Real Estate', 'Engineering', 'Trading'
        ];

        const locations = [
            'Lahore, Punjab, Pakistan',
            'Karachi, Sindh, Pakistan',
            'Islamabad, Islamabad Capital Territory, Pakistan',
            'Peshawar, Khyber Pakhtunkhwa, Pakistan',
            'Quetta, Balochistan, Pakistan'
        ];

        const phoneNumbers = [
            '+92-42-1234567',
            '+92-21-9876543',
            '+92-51-4567890',
            '+92-91-2345678',
            '+92-31-8765432'
        ];

        const websites = [
            'https://www.lahoredental.com',
            'https://karachielectronics.pk',
            'https://islamabadlaw.com',
            'https://peshawarrestaurant.com',
            'https://quettahospital.org'
        ];

        const socialMedia = [
            'https://facebook.com/business',
            'https://instagram.com/business',
            'https://linkedin.com/company',
            'https://twitter.com/business',
            'https://tiktok.com/@business'
        ];

        return businessNames.map((name, index) => ({
            id: `business_${index + 1}`,
            businessName: name,
            category: categories[index % categories.length],
            rating: (3.5 + Math.random() * 1.5).toFixed(1),
            reviewCount: Math.floor(50 + Math.random() * 500),
            address: locations[index % locations.length],
            phone: phoneNumbers[index % phoneNumbers.length],
            email: `info@${name.toLowerCase().replace(/\s+/g, '')}.com`,
            website: websites[index % websites.length],
            instagram: socialMedia[Math.floor(Math.random() * socialMedia.length)],
            facebook: socialMedia[Math.floor(Math.random() * socialMedia.length)],
            linkedin: socialMedia[2],
            businessStatus: Math.random() > 0.1 ? 'Open' : 'Closed',
            openingHours: '9:00 AM - 6:00 PM',
            services: this.generateServices(categories[index % categories.length]),
            scrapedAt: new Date().toISOString(),
            websiteAnalysis: this.generateWebsiteAnalysis(),
            leadQualityScore: 0,
            priority: 'Medium',
            region: 'Pakistan',
            isValid: true,
            validation: {
                phoneValid: true,
                emailValid: true,
                websiteValid: true,
                hasSocialMedia: Math.random() > 0.3
            }
        }));
    }

    generateServices(category) {
        const serviceMap = {
            'Dentist': ['General Dentistry', 'Orthodontics', 'Cosmetic Dentistry', 'Emergency Care'],
            'Electronics': ['Mobile Phones', 'Laptops', 'Accessories', 'Repair Services'],
            'Lawyer': ['Corporate Law', 'Family Law', 'Criminal Defense', 'Real Estate'],
            'Restaurant': ['Dine-in', 'Delivery', 'Catering', 'Takeaway'],
            'Hospital': ['Emergency Services', 'Outpatient', 'Inpatient', 'Specialty Care'],
            'Textile': ['Fabric Manufacturing', 'Garment Production', 'Export', 'Wholesale'],
            'Garments': ['Men\'s Clothing', 'Women\'s Clothing', 'Kids Wear', 'Accessories'],
            'Real Estate': ['Property Sales', 'Rental Management', 'Construction', 'Consulting'],
            'Engineering': ['Design', 'Consulting', 'Project Management', 'Implementation'],
            'Trading': ['Import/Export', 'Distribution', 'Retail', 'Wholesale']
        };

        return serviceMap[category] || ['General Services'];
    }

    generateWebsiteAnalysis() {
        return {
            url: 'https://www.example.com',
            score: Math.floor(70 + Math.random() * 25),
            assessment: {
                overall: Math.random() > 0.5 ? 'Good' : 'Needs Improvement',
                grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
                strengths: ['HTTPS enabled', 'Mobile-friendly design'],
                weaknesses: ['Missing meta description', 'Slow load time']
            },
            details: {
                httpsEnabled: true,
                sslValid: Math.random() > 0.2,
                mobileFriendly: Math.random() > 0.3,
                responseTime: Math.floor(800 + Math.random() * 2000),
                loadTime: Math.floor(1500 + Math.random() * 3000)
            }
        };
    }

    // Start the demonstration
    async startDemo() {
        console.log('🚀 Starting GeoLead AI Demo');
        console.log('=====================================');
        
        this.displayIntro();
        
        for (let i = 0; i < this.scenarios.length; i++) {
            await this.runScenario(i);
        }
        
        this.displaySummary();
    }

    displayIntro() {
        console.log(`
🎯 GeoLead AI - Production-Grade Google Maps Scraper Demo

This demonstration showcases the advanced capabilities of GeoLead AI:
• Advanced data validation and cleaning
• Intelligent lead scoring system  
• Website analysis and SEO assessment
• Social media profile extraction
• Pakistan regional optimization
• Multiple export formats
• Comprehensive error handling

Version: 3.0.0
Author: GeoLead AI Team
        `);
    }

    async runScenario(scenarioIndex) {
        console.log(`\n📋 Scenario ${scenarioIndex + 1}: ${this.scenarios[scenarioIndex]}`);
        console.log('─'.repeat(50));
        
        switch (scenarioIndex) {
            case 0:
                await this.basicScrapingDemo();
                break;
            case 1:
                await this.leadScoringDemo();
                break;
            case 2:
                await this.websiteAnalysisDemo();
                break;
            case 3:
                await this.socialMediaDemo();
                break;
            case 4:
                await this.pakistanRegionalDemo();
                break;
            case 5:
                await this.exportDemo();
                break;
        }
        
        console.log(`✅ Scenario ${scenarioIndex + 1} completed successfully`);
    }

    async basicScrapingDemo() {
        console.log('🔍 Testing basic scraping functionality...');
        
        // Simulate scraping process
        const totalBusinesses = this.demoData.length;
        let processed = 0;
        
        for (let i = 0; i < this.demoData.length; i++) {
            const business = this.demoData[i];
            
            // Simulate processing delay
            await this.delay(100);
            
            // Extract basic information
            business.businessName = this.cleanBusinessName(business.businessName);
            business.category = this.categorizeBusiness(business.businessName);
            business.address = this.validateAddress(business.address);
            
            processed++;
            const progress = Math.round((processed / totalBusinesses) * 100);
            process.stdout.write(`📊 Progress: ${progress}% (${processed}/${totalBusinesses})\\r`);
        }
        
        console.log(`\\n📊 Successfully scraped ${totalBusinesses} businesses`);
        
        // Display sample results
        console.log('\\n📋 Sample Scraped Data:');
        this.demoData.slice(0, 3).forEach((business, index) => {
            console.log(`  ${index + 1}. ${business.businessName}`);
            console.log(`     Category: ${business.category}`);
            console.log(`     Rating: ${business.rating}/5 (${business.reviewCount} reviews)`);
            console.log(`     Phone: ${business.phone}`);
            console.log(`     Email: ${business.email}`);
            console.log(`     Website: ${business.website}\\n`);
        });
    }

    async leadScoringDemo() {
        console.log('🎯 Testing lead scoring algorithm...');
        
        const scoringUtils = {
            calculateLeadQualityScore: (business) => {
                let score = 0;
                const breakdown = {
                    phone: { score: 0, hasPhone: !!business.phone },
                    email: { score: 0, hasEmail: !!business.email },
                    website: { score: 0, hasWebsite: !!business.website },
                    rating: { score: 0, rating: parseFloat(business.rating) || 0 },
                    reviews: { score: 0, reviewCount: parseInt(business.reviewCount) || 0 },
                    socialMedia: { score: 0, platformCount: 0 },
                    businessStatus: { score: 0, isOpen: business.businessStatus === 'Open' }
                };

                // Phone scoring (0.15 weight)
                if (breakdown.phone.hasPhone) {
                    breakdown.phone.score = 0.15;
                    if (business.phone.startsWith('+92')) {
                        breakdown.phone.score += 0.05; // Pakistan local bonus
                    }
                }

                // Email scoring (0.20 weight)
                if (breakdown.email.hasEmail) {
                    breakdown.email.score = 0.20;
                    if (!business.email.includes('@gmail.com') && !business.email.includes('@yahoo.com')) {
                        breakdown.email.score += 0.05; // Business email bonus
                    }
                }

                // Website scoring (0.15 weight)
                if (breakdown.website.hasWebsite) {
                    breakdown.website.score = 0.15;
                    if (business.website.startsWith('https://')) {
                        breakdown.website.score += 0.05;
                    }
                }

                // Rating scoring (0.20 weight)
                if (business.rating) {
                    breakdown.rating.score = Math.min(0.20, parseFloat(business.rating) / 5 * 0.20);
                }

                // Reviews scoring (0.10 weight)
                if (business.reviewCount) {
                    breakdown.reviews.score = Math.min(0.10, Math.log10(parseInt(business.reviewCount)) / 2 * 0.10);
                }

                // Social media scoring (0.10 weight)
                const socialPlatforms = [business.instagram, business.facebook, business.linkedin].filter(Boolean);
                breakdown.socialMedia.platformCount = socialPlatforms.length;
                breakdown.socialMedia.score = Math.min(0.10, socialPlatforms.length * 0.033);

                // Business status scoring (0.10 weight)
                if (breakdown.businessStatus.isOpen) {
                    breakdown.businessStatus.score = 0.10;
                }

                // Calculate total score
                score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);

                // Determine priority
                let priority = 'Low';
                if (score >= 0.8) priority = 'High';
                else if (score >= 0.6) priority = 'Medium';

                return {
                    score: Math.round(score * 100) / 100,
                    priority: priority,
                    breakdown: breakdown,
                    recommendations: this.generateRecommendations(breakdown)
                };
            },

            generateRecommendations: (breakdown) => {
                const recommendations = [];
                
                if (!breakdown.phone.hasPhone) {
                    recommendations.push('Add phone number for better contactability');
                }
                if (!breakdown.email.hasEmail) {
                    recommendations.push('Add business email for professional communication');
                }
                if (!breakdown.website.hasWebsite) {
                    recommendations.push('Create a website to establish online presence');
                }
                if (breakdown.rating.score < 0.15) {
                    recommendations.push('Improve customer service to increase rating');
                }
                if (breakdown.socialMedia.platformCount < 2) {
                    recommendations.push('Create social media profiles for better engagement');
                }
                if (!breakdown.businessStatus.isOpen) {
                    recommendations.push('Update business hours to reflect current operating status');
                }

                return recommendations;
            }
        };

        // Calculate scores for all businesses
        this.demoData.forEach(business => {
            const scoring = scoringUtils.calculateLeadQualityScore(business);
            business.leadQualityScore = scoring.score;
            business.priority = scoring.priority;
            business.recommendations = scoring.recommendations;
        });

        // Sort by score
        this.demoData.sort((a, b) => b.leadQualityScore - a.leadQualityScore);

        console.log(`📊 Lead scoring completed for ${this.demoData.length} businesses`);
        
        // Display top leads
        console.log('\\n🏆 Top 5 High-Priority Leads:');
        const highPriorityLeads = this.demoData.filter(business => business.priority === 'High').slice(0, 5);
        
        highPriorityLeads.forEach((business, index) => {
            console.log(`  ${index + 1}. ${business.businessName}`);
            console.log(`     Score: ${business.leadQualityScore}/10 | Priority: ${business.priority}`);
            console.log(`     Rating: ${business.rating}/5 | Reviews: ${business.reviewCount}`);
            console.log(`     Contact: ${business.phone} | ${business.email}`);
            console.log(`     Recommendations: ${business.recommendations.slice(0, 2).join(', ')}\\n`);
        });
    }

    async websiteAnalysisDemo() {
        console.log('🌐 Testing website analysis capabilities...');
        
        const analysisUtils = {
            analyzeWebsite: (business) => {
                const analysis = business.websiteAnalysis;
                
                // Simulate website analysis
                analysis.score = Math.floor(60 + Math.random() * 35);
                assessment: {
                    overall: analysis.score > 80 ? 'Excellent' : analysis.score > 65 ? 'Good' : analysis.score > 50 ? 'Fair' : 'Poor',
                    grade: analysis.score > 80 ? 'A' : analysis.score > 65 ? 'B' : analysis.score > 50 ? 'C' : 'D',
                    strengths: [
                        analysis.details.httpsEnabled ? 'HTTPS enabled' : null,
                        analysis.details.mobileFriendly ? 'Mobile-friendly design' : null,
                        analysis.details.responseTime < 2000 ? 'Fast response time' : null
                    ].filter(Boolean),
                    weaknesses: [
                        !analysis.details.httpsEnabled ? 'No HTTPS' : null,
                        !analysis.details.mobileFriendly ? 'Not mobile-friendly' : null,
                        analysis.details.responseTime > 3000 ? 'Slow response time' : null,
                        analysis.details.loadTime > 5000 ? 'Slow page load' : null
                    ].filter(Boolean)
                };

                return analysis;
            }
        };

        // Analyze websites for all businesses
        this.demoData.forEach(business => {
            if (business.website) {
                analysisUtils.analyzeWebsite(business);
            }
        });

        console.log(`📊 Website analysis completed for ${this.demoData.filter(b => b.website).length} businesses`);
        
        // Display analysis results
        console.log('\\n📋 Website Analysis Results:');
        const businessesWithWebsites = this.demoData.filter(business => business.website);
        
        businessesWithWebsites.slice(0, 5).forEach((business, index) => {
            const analysis = business.websiteAnalysis;
            console.log(`  ${index + 1}. ${business.businessName}`);
            console.log(`     Website: ${business.website}`);
            console.log(`     Score: ${analysis.score}/100 (${analysis.assessment.overall})`);
            console.log(`     Grade: ${analysis.assessment.grade}`);
            if (analysis.assessment.strengths.length > 0) {
                console.log(`     Strengths: ${analysis.assessment.strengths.join(', ')}`);
            }
            if (analysis.assessment.weaknesses.length > 0) {
                console.log(`     Areas for improvement: ${analysis.assessment.weaknesses.join(', ')}`);
            }
            console.log();
        });
    }

    async socialMediaDemo() {
        console.log('📱 Testing social media extraction...');
        
        const socialUtils = {
            extractSocialMedia: (business) => {
                const platforms = [];
                
                if (business.instagram) {
                    platforms.push({
                        platform: 'Instagram',
                        url: business.instagram,
                        username: business.instagram.split('/').pop(),
                        followers: Math.floor(1000 + Math.random() * 50000),
                        engagement: (Math.random() * 5).toFixed(1) + '%'
                    });
                }
                
                if (business.facebook) {
                    platforms.push({
                        platform: 'Facebook',
                        url: business.facebook,
                        username: business.facebook.split('/').pop(),
                        followers: Math.floor(500 + Math.random() * 25000),
                        engagement: (Math.random() * 3).toFixed(1) + '%'
                    });
                }
                
                if (business.linkedin) {
                    platforms.push({
                        platform: 'LinkedIn',
                        url: business.linkedin,
                        username: business.linkedin.split('/').pop(),
                        followers: Math.floor(100 + Math.random() * 5000),
                        engagement: (Math.random() * 2).toFixed(1) + '%'
                    });
                }

                return platforms;
            }
        };

        // Extract social media data
        this.demoData.forEach(business => {
            business.socialMediaProfiles = socialUtils.extractSocialMedia(business);
        });

        console.log(`📊 Social media extraction completed for ${this.demoData.length} businesses`);
        
        // Display social media results
        console.log('\\n📋 Social Media Profiles:');
        this.demoData.slice(0, 5).forEach((business, index) => {
            console.log(`  ${index + 1}. ${business.businessName}`);
            if (business.socialMediaProfiles.length > 0) {
                business.socialMediaProfiles.forEach(profile => {
                    console.log(`     ${profile.platform}: ${profile.url}`);
                    console.log(`        Followers: ${profile.followers.toLocaleString()} | Engagement: ${profile.engagement}`);
                });
            } else {
                console.log('     No social media profiles found');
            }
            console.log();
        });
    }

    async pakistanRegionalDemo() {
        console.log('🇵🇰 Testing Pakistan regional optimization...');
        
        const pakistanUtils = {
            validatePakistaniPhone: (phone) => {
                if (!phone) return false;
                // Pakistani phone number validation
                const pakistaniPattern = /^\\+92\\d{9,10}$|^0\\d{9,10}$/;
                return pakistaniPattern.test(phone.replace(/[-\\s]/g, ''));
            },

            categorizePakistaniBusiness: (business) => {
                const name = business.businessName.toLowerCase();
                const categories = {
                    'restaurant': ['restaurant', 'hotel', 'cafe', 'dining'],
                    'medical': ['hospital', 'clinic', 'doctor', 'dental', 'medical'],
                    'education': ['school', 'college', 'university', 'education'],
                    'shopping': ['mall', 'market', 'store', 'shop'],
                    'service': ['service', 'repair', 'consulting', 'agency']
                };

                for (const [category, keywords] of Object.entries(categories)) {
                    if (keywords.some(keyword => name.includes(keyword))) {
                        return category;
                    }
                }
                return 'general';
            },

            analyzePakistaniMarket: (businesses) => {
                const stats = {
                    totalBusinesses: businesses.length,
                    byCategory: {},
                    byCity: {},
                    avgRating: 0,
                    avgReviews: 0,
                    phoneCoverage: 0,
                    websiteCoverage: 0,
                    highPriorityLeads: 0
                };

                businesses.forEach(business => {
                    // Category distribution
                    stats.byCategory[business.category] = (stats.byCategory[business.category] || 0) + 1;
                    
                    // City distribution
                    const city = business.address.split(',')[0].trim();
                    stats.byCity[city] = (stats.byCity[city] || 0) + 1;
                    
                    // Calculate averages
                    stats.avgRating += parseFloat(business.rating);
                    stats.avgReviews += parseInt(business.reviewCount);
                    
                    // Coverage stats
                    if (business.phone) stats.phoneCoverage++;
                    if (business.website) stats.websiteCoverage++;
                    if (business.priority === 'High') stats.highPriorityLeads++;
                });

                // Calculate averages
                stats.avgRating = (stats.avgRating / businesses.length).toFixed(1);
                stats.avgReviews = Math.round(stats.avgReviews / businesses.length);
                stats.phoneCoverage = Math.round((stats.phoneCoverage / businesses.length) * 100);
                stats.websiteCoverage = Math.round((stats.websiteCoverage / businesses.length) * 100);
                stats.highPriorityLeads = Math.round((stats.highPriorityLeads / businesses.length) * 100);

                return stats;
            }
        };

        // Analyze Pakistani market data
        const marketStats = pakistanUtils.analyzePakistaniMarket(this.demoData);

        console.log(`🇵🇰 Pakistan regional analysis completed`);
        
        // Display market statistics
        console.log('\\n📊 Pakistan Market Statistics:');
        console.log(`  Total Businesses: ${marketStats.totalBusinesses}`);
        console.log(`  Average Rating: ${marketStats.avgRating}/5`);
        console.log(`  Average Reviews: ${marketStats.avgReviews}`);
        console.log(`  Phone Coverage: ${marketStats.phoneCoverage}%`);
        console.log(`  Website Coverage: ${marketStats.websiteCoverage}%`);
        console.log(`  High Priority Leads: ${marketStats.highPriorityLeads}%`);
        
        console.log('\\n📋 Business Distribution by Category:');
        Object.entries(marketStats.byCategory).forEach(([category, count]) => {
            console.log(`  ${category}: ${count} businesses`);
        });
        
        console.log('\\n📋 Business Distribution by City:');
        Object.entries(marketStats.byCity).forEach(([city, count]) => {
            console.log(`  ${city}: ${count} businesses`);
        });
    }

    async exportDemo() {
        console.log('📤 Testing export functionality...');
        
        const exportUtils = {
            exportToCSV: (data, filename) => {
                const headers = Object.keys(data[0]);
                const csvContent = [
                    headers.join(','),
                    ...data.map(row => headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(','))
                ].join('\\n');
                
                console.log(`📄 CSV Export: ${filename}`);
                console.log(`📊 Records exported: ${data.length}`);
                console.log(`📋 Columns: ${headers.join(', ')}`);
                
                return { content: csvContent, filename, format: 'csv' };
            },

            exportToExcel: (data, filename) => {
                // Simulate Excel export with proper formatting
                const headers = Object.keys(data[0]);
                const excelContent = [
                    headers.join('\\t'),
                    ...data.map(row => headers.map(header => (row[header] || '')).join('\\t'))
                ].join('\\n');
                
                console.log(`📊 Excel Export: ${filename}`);
                console.log(`📄 Records exported: ${data.length}`);
                console.log(`📋 Sheet format: Tab-separated with proper formatting`);
                
                return { content: excelContent, filename, format: 'excel' };
            },

            exportToJSON: (data, filename) => {
                const jsonContent = JSON.stringify(data, null, 2);
                
                console.log(`📄 JSON Export: ${filename}`);
                console.log(`📊 Records exported: ${data.length}`);
                console.log(`📋 Structure: Nested JSON with metadata`);
                
                return { content: jsonContent, filename, format: 'json' };
            },

            filterData: (data, filters) => {
                return data.filter(business => {
                    // Rating filter
                    if (filters.minRating && parseFloat(business.rating) < filters.minRating) {
                        return false;
                    }
                    
                    // Review filter
                    if (filters.minReviews && parseInt(business.reviewCount) < filters.minReviews) {
                        return false;
                    }
                    
                    // Priority filter
                    if (filters.priority && business.priority !== filters.priority) {
                        return false;
                    }
                    
                    // Category filter
                    if (filters.category && business.category !== filters.category) {
                        return false;
                    }
                    
                    return true;
                });
            }
        };

        // Test different export formats
        const filters = {
            minRating: 4.0,
            minReviews: 100,
            priority: 'High',
            category: null
        };

        const filteredData = exportUtils.filterData(this.demoData, filters);
        
        const exports = [
            exportUtils.exportToCSV(filteredData, 'geolead-ai-pakistan-leads.csv'),
            exportUtils.exportToExcel(filteredData, 'geolead-ai-pakistan-leads.xlsx'),
            exportUtils.exportToJSON(filteredData, 'geolead-ai-pakistan-leads.json')
        ];

        console.log(`\\n📤 Export Results:`);
        exports.forEach(exportResult => {
            console.log(`  ${exportResult.format.toUpperCase()}: ${exportResult.filename}`);
            console.log(`    Size: ${Math.round(exportResult.content.length / 1024)}KB`);
            console.log(`    Records: ${filteredData.length}\\n`);
        });

        // Show export summary
        console.log('📊 Export Summary:');
        console.log(`  Total records in dataset: ${this.demoData.length}`);
        console.log(`  Records after filtering: ${filteredData.length}`);
        console.log(`  Export formats available: CSV, Excel, JSON`);
        console.log(`  Filter applied: Rating >= ${filters.minRating}, Reviews >= ${filters.minReviews}, Priority: ${filters.priority}`);
    }

    displaySummary() {
        console.log('\\n🎉 Demo Summary');
        console.log('===============');
        
        const totalBusinesses = this.demoData.length;
        const highPriority = this.demoData.filter(b => b.priority === 'High').length;
        const avgScore = (this.demoData.reduce((sum, b) => sum + b.leadQualityScore, 0) / totalBusinesses).toFixed(1);
        const websites = this.demoData.filter(b => b.website).length;
        const socialMedia = this.demoData.filter(b => b.socialMediaProfiles && b.socialMediaProfiles.length > 0).length;
        
        console.log(`📊 Total Businesses Processed: ${totalBusinesses}`);
        console.log(`🏆 High Priority Leads: ${highPriority} (${Math.round((highPriority/totalBusinesses)*100)}%)`);
        console.log(`📈 Average Lead Score: ${avgScore}/10`);
        console.log(`🌐 Websites Analyzed: ${websites} (${Math.round((websites/totalBusinesses)*100)}%)`);
        console.log(`📱 Social Media Profiles: ${socialMedia} (${Math.round((socialMedia/totalBusinesses)*100)}%)`);
        
        console.log('\\n✅ All scenarios completed successfully!');
        console.log('🚀 GeoLead AI is ready for production use!');
        
        console.log('\\n📚 Next Steps:');
        console.log('  1. Install the extension in Chrome');
        console.log('  2. Navigate to Google Maps');
        console.log('  3. Click the GeoLead AI icon');
        console.log('  4. Configure your scraping preferences');
        console.log('  5. Start extracting high-quality leads!');
    }

    // Utility functions
    cleanBusinessName(name) {
        return name.replace(/( - Google Maps|• Google Maps|Google Maps|•)$/i, '').trim();
    }

    categorizeBusiness(name) {
        const nameLower = name.toLowerCase();
        const categories = [
            { keywords: ['dental', 'dentist', 'teeth', 'oral'], category: 'Dentist' },
            { keywords: ['restaurant', 'cafe', 'dining', 'food'], category: 'Restaurant' },
            { keywords: ['hospital', 'clinic', 'medical', 'doctor'], category: 'Hospital' },
            { keywords: ['school', 'education', 'university', 'college'], category: 'Education' },
            { keywords: ['lawyer', 'attorney', 'legal', 'court'], category: 'Lawyer' },
            { keywords: ['real estate', 'property', 'realty', 'housing'], category: 'Real Estate' }
        ];

        for (const cat of categories) {
            if (cat.keywords.some(keyword => nameLower.includes(keyword))) {
                return cat.category;
            }
        }
        return 'General';
    }

    validateAddress(address) {
        // Basic address validation for Pakistani addresses
        if (address.includes('Pakistan')) {
            return address;
        }
        return `${address}, Pakistan`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the demo
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoLeadAIDemo;
}

// If running directly, start the demo
if (require.main === module) {
    const demo = new GeoLeadAIDemo();
    demo.startDemo().catch(console.error);
}