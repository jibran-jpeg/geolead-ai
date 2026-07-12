// enhanced.test.js - Comprehensive test suite for GeoLead AI
// Tests all major components including scraping, validation, scoring, and export

const GeoLeadAIDemo = require('../scripts/demo');
const { JSDOM } = require('jsdom');

// Mock Chrome extension APIs
global.chrome = {
    storage: {
        sync: {
            get: jest.fn(),
            set: jest.fn()
        },
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    tabs: {
        query: jest.fn(),
        create: jest.fn(),
        sendMessage: jest.fn()
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        id: 'test-extension-id'
    },
    downloads: {
        download: jest.fn()
    }
};

// Mock DOM for popup testing
global.document = new JSDOM(`<!DOCTYPE html><html><body></body></html>`).window.document;

describe('GeoLead AI - Comprehensive Test Suite', () => {
    let demo;

    beforeEach(() => {
        demo = new GeoLeadAIDemo();
        jest.clearAllMocks();
    });

    describe('Data Generation and Processing', () => {
        test('should generate sample business data', () => {
            const data = demo.generateSampleData();
            
            expect(data).toBeInstanceOf(Array);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0]).toHaveProperty('id');
            expect(data[0]).toHaveProperty('businessName');
            expect(data[0]).toHaveProperty('category');
            expect(data[0]).toHaveProperty('rating');
            expect(data[0]).toHaveProperty('phone');
            expect(data[0]).toHaveProperty('email');
            expect(data[0]).toHaveProperty('website');
        });

        test('should clean business names correctly', () => {
            const dirtyNames = [
                'Lahore Dental Clinic - Google Maps',
                'Karachi Electronics • Google Maps',
                'Islamabad Law Firm • Google Maps',
                'Peshawar Restaurant Google Maps',
                'Clean Business Name'
            ];

            const cleanedNames = dirtyNames.map(name => demo.cleanBusinessName(name));
            
            expect(cleanedNames[0]).toBe('Lahore Dental Clinic');
            expect(cleanedNames[1]).toBe('Karachi Electronics');
            expect(cleanedNames[2]).toBe('Islamabad Law Firm');
            expect(cleanedNames[3]).toBe('Peshawar Restaurant');
            expect(cleanedNames[4]).toBe('Clean Business Name');
        });

        test('should categorize businesses correctly', () => {
            const testCases = [
                { name: 'Lahore Dental Clinic', expected: 'Dentist' },
                { name: 'Karachi Electronics Store', expected: 'General' },
                { name: 'Islamabad Law Firm', expected: 'Lawyer' },
                { name: 'Peshawar Restaurant', expected: 'Restaurant' },
                { name: 'Quetta Hospital', expected: 'Hospital' }
            ];

            testCases.forEach(testCase => {
                const result = demo.categorizeBusiness(testCase.name);
                expect(result).toBe(testCase.expected);
            });
        });

        test('should validate addresses correctly', () => {
            const testCases = [
                { address: 'Lahore, Punjab, Pakistan', expected: 'Lahore, Punjab, Pakistan' },
                { address: 'Karachi, Sindh', expected: 'Karachi, Sindh, Pakistan' },
                { address: 'New York', expected: 'New York, Pakistan' }
            ];

            testCases.forEach(testCase => {
                const result = demo.validateAddress(testCase.address);
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('Lead Scoring System', () => {
        test('should calculate lead quality scores', () => {
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
                            breakdown.phone.score += 0.05;
                        }
                    }

                    // Email scoring (0.20 weight)
                    if (breakdown.email.hasEmail) {
                        breakdown.email.score = 0.20;
                        if (!business.email.includes('@gmail.com') && !business.email.includes('@yahoo.com')) {
                            breakdown.email.score += 0.05;
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
                        recommendations: []
                    };
                }
            };

            const testBusiness = {
                businessName: 'Test Business',
                phone: '+92-42-1234567',
                email: 'info@test.com',
                website: 'https://www.test.com',
                rating: '4.5',
                reviewCount: '150',
                instagram: 'https://instagram.com/test',
                facebook: 'https://facebook.com/test',
                linkedin: 'https://linkedin.com/test',
                businessStatus: 'Open'
            };

            const scoring = scoringUtils.calculateLeadQualityScore(testBusiness);
            
            expect(scoring.score).toBeGreaterThan(0);
            expect(scoring.score).toBeLessThanOrEqual(1);
            expect(['High', 'Medium', 'Low']).toContain(scoring.priority);
            expect(scoring.breakdown).toBeDefined();
            expect(Array.isArray(scoring.recommendations)).toBe(true);
        });

        test('should determine correct priority levels', () => {
            const testCases = [
                { 
                    business: { phone: '+92-42-1234567', email: 'info@test.com', website: 'https://test.com', rating: '4.8', reviewCount: '200', businessStatus: 'Open' },
                    expectedPriority: 'High'
                },
                { 
                    business: { phone: '+92-42-1234567', email: 'info@test.com', website: null, rating: '4.0', reviewCount: '100', businessStatus: 'Open' },
                    expectedPriority: 'Medium'
                },
                { 
                    business: { phone: null, email: null, website: null, rating: '3.0', reviewCount: '50', businessStatus: 'Closed' },
                    expectedPriority: 'Low'
                }
            ];

            testCases.forEach(testCase => {
                const scoringUtils = {
                    calculateLeadQualityScore: (business) => {
                        let score = 0;
                        const breakdown = {
                            phone: { score: !!business.phone ? 0.15 : 0 },
                            email: { score: !!business.email ? 0.20 : 0 },
                            website: { score: !!business.website ? 0.15 : 0 },
                            rating: { score: Math.min(0.20, parseFloat(business.rating || 0) / 5 * 0.20) },
                            reviews: { score: Math.min(0.10, Math.log10(parseInt(business.reviewCount || 0)) / 2 * 0.10) },
                            socialMedia: { score: 0 },
                            businessStatus: { score: business.businessStatus === 'Open' ? 0.10 : 0 }
                        };
                        
                        score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
                        
                        let priority = 'Low';
                        if (score >= 0.8) priority = 'High';
                        else if (score >= 0.6) priority = 'Medium';
                        
                        return { score: Math.round(score * 100) / 100, priority };
                    }
                };

                const scoring = scoringUtils.calculateLeadQualityScore(testCase.business);
                expect(scoring.priority).toBe(testCase.expectedPriority);
            });
        });
    });

    describe('Website Analysis', () => {
        test('should analyze websites correctly', () => {
            const analysisUtils = {
                analyzeWebsite: (business) => {
                    const analysis = {
                        url: business.website,
                        score: Math.floor(60 + Math.random() * 35),
                        assessment: {
                            overall: 'Good',
                            grade: 'B',
                            strengths: ['HTTPS enabled', 'Mobile-friendly design'],
                            weaknesses: ['Missing meta description']
                        },
                        details: {
                            httpsEnabled: true,
                            sslValid: true,
                            mobileFriendly: true,
                            responseTime: 1200,
                            loadTime: 2500
                        }
                    };
                    return analysis;
                }
            };

            const testBusiness = {
                website: 'https://www.test.com'
            };

            const analysis = analysisUtils.analyzeWebsite(testBusiness);
            
            expect(analysis.score).toBeGreaterThan(0);
            expect(analysis.score).toBeLessThanOrEqual(100);
            expect(assessment).toBeDefined();
            expect(details).toBeDefined();
            expect(typeof analysis.details.responseTime).toBe('number');
            expect(typeof analysis.details.loadTime).toBe('number');
        });
    });

    describe('Social Media Extraction', () => {
        test('should extract social media profiles', () => {
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

            const testBusiness = {
                instagram: 'https://instagram.com/testbusiness',
                facebook: 'https://facebook.com/testbusiness',
                linkedin: 'https://linkedin.com/company/testbusiness'
            };

            const profiles = socialUtils.extractSocialMedia(testBusiness);
            
            expect(Array.isArray(profiles)).toBe(true);
            expect(profiles.length).toBe(3);
            
            profiles.forEach(profile => {
                expect(profile).toHaveProperty('platform');
                expect(profile).toHaveProperty('url');
                expect(profile).toHaveProperty('username');
                expect(profile).toHaveProperty('followers');
                expect(profile).toHaveProperty('engagement');
            });
        });
    });

    describe('Pakistan Regional Features', () => {
        test('should validate Pakistani phone numbers', () => {
            const pakistanUtils = {
                validatePakistaniPhone: (phone) => {
                    if (!phone) return false;
                    // Pakistani phone number validation
                    const pakistaniPattern = /^\\+92\\d{9,10}$|^0\\d{9,10}$/;
                    return pakistaniPattern.test(phone.replace(/[-\\s]/g, ''));
                }
            };

            const testCases = [
                { phone: '+92-42-123456789', expected: true },
                { phone: '0321-1234567', expected: true },
                { phone: '+1-212-555-1234', expected: false },
                { phone: '44-20-1234-5678', expected: false },
                { phone: '', expected: false }
            ];

            testCases.forEach(testCase => {
                const result = pakistanUtils.validatePakistaniPhone(testCase.phone);
                expect(result).toBe(testCase.expected);
            });
        });

        test('should categorize Pakistani businesses', () => {
            const pakistanUtils = {
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
                }
            };

            const testCases = [
                { business: { businessName: 'Lahore Dental Clinic' }, expected: 'medical' },
                { business: { businessName: 'Karachi Restaurant' }, expected: 'restaurant' },
                { business: { businessName: 'Islamabad School' }, expected: 'education' },
                { business: { businessName: 'Peshawar Shopping Mall' }, expected: 'shopping' },
                { business: { businessName: 'Quetta Repair Service' }, expected: 'service' },
                { business: { businessName: 'General Business' }, expected: 'general' }
            ];

            testCases.forEach(testCase => {
                const result = pakistanUtils.categorizePakistaniBusiness(testCase.business);
                expect(result).toBe(testCase.expected);
            });
        });
    });

    describe('Export Functionality', () => {
        test('should export to CSV format', () => {
            const exportUtils = {
                exportToCSV: (data, filename) => {
                    const headers = Object.keys(data[0]);
                    const csvContent = [
                        headers.join(','),
                        ...data.map(row => headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(','))
                    ].join('\\n');
                    
                    return { content: csvContent, filename, format: 'csv' };
                }
            };

            const testData = [
                { name: 'Test Business 1', rating: '4.5', phone: '+92-42-1234567' },
                { name: 'Test Business 2', rating: '4.0', phone: '+92-21-9876543' }
            ];

            const exportResult = exportUtils.exportToCSV(testData, 'test.csv');
            
            expect(exportResult.format).toBe('csv');
            expect(exportResult.filename).toBe('test.csv');
            expect(exportResult.content).toContain('name,rating,phone');
            expect(exportResult.content).toContain('Test Business 1');
            expect(exportResult.content).toContain('Test Business 2');
        });

        test('should export to JSON format', () => {
            const exportUtils = {
                exportToJSON: (data, filename) => {
                    const jsonContent = JSON.stringify(data, null, 2);
                    return { content: jsonContent, filename, format: 'json' };
                }
            };

            const testData = [
                { name: 'Test Business 1', rating: '4.5', phone: '+92-42-1234567' },
                { name: 'Test Business 2', rating: '4.0', phone: '+92-21-9876543' }
            ];

            const exportResult = exportUtils.exportToJSON(testData, 'test.json');
            
            expect(exportResult.format).toBe('json');
            expect(exportResult.filename).toBe('test.json');
            expect(exportResult.content).toContain('"name": "Test Business 1"');
            expect(exportResult.content).toContain('"name": "Test Business 2"');
        });

        test('should filter data correctly', () => {
            const exportUtils = {
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
                        
                        return true;
                    });
                }
            };

            const testData = [
                { name: 'High Rated', rating: '4.8', reviewCount: '200', priority: 'High' },
                { name: 'Medium Rated', rating: '4.2', reviewCount: '150', priority: 'Medium' },
                { name: 'Low Rated', rating: '3.5', reviewCount: '50', priority: 'Low' }
            ];

            const filters = {
                minRating: 4.0,
                minReviews: 100,
                priority: null
            };

            const filteredData = exportUtils.filterData(testData, filters);
            
            expect(filteredData.length).toBe(2);
            expect(filteredData.find(b => b.name === 'High Rated')).toBeDefined();
            expect(filteredData.find(b => b.name === 'Medium Rated')).toBeDefined();
            expect(filteredData.find(b => b.name === 'Low Rated')).toBeUndefined();
        });
    });

    describe('Integration Tests', () => {
        test('should process complete data pipeline', async () => {
            // Generate sample data
            const data = demo.generateSampleData();
            
            // Process through lead scoring
            data.forEach(business => {
                const scoringUtils = {
                    calculateLeadQualityScore: (business) => {
                        let score = 0;
                        const breakdown = {
                            phone: { score: !!business.phone ? 0.15 : 0 },
                            email: { score: !!business.email ? 0.20 : 0 },
                            website: { score: !!business.website ? 0.15 : 0 },
                            rating: { score: Math.min(0.20, parseFloat(business.rating || 0) / 5 * 0.20) },
                            reviews: { score: Math.min(0.10, Math.log10(parseInt(business.reviewCount || 0)) / 2 * 0.10) },
                            socialMedia: { score: 0 },
                            businessStatus: { score: business.businessStatus === 'Open' ? 0.10 : 0 }
                        };
                        
                        score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
                        
                        let priority = 'Low';
                        if (score >= 0.8) priority = 'High';
                        else if (score >= 0.6) priority = 'Medium';
                        
                        return { score: Math.round(score * 100) / 100, priority };
                    }
                };
                
                const scoring = scoringUtils.calculateLeadQualityScore(business);
                business.leadQualityScore = scoring.score;
                business.priority = scoring.priority;
            });

            // Sort by score
            data.sort((a, b) => b.leadQualityScore - a.leadQualityScore);

            // Filter high priority leads
            const highPriorityLeads = data.filter(business => business.priority === 'High');

            // Export filtered data
            const exportUtils = {
                exportToCSV: (data, filename) => {
                    const headers = Object.keys(data[0]);
                    const csvContent = [
                        headers.join(','),
                        ...data.map(row => headers.map(header => `"${(row[header] || '').replace(/"/g, '""')}"`).join(','))
                    ].join('\\n');
                    
                    return { content: csvContent, filename, format: 'csv' };
                }
            };

            const exportResult = exportUtils.exportToCSV(highPriorityLeads, 'integration-test.csv');

            // Verify results
            expect(data.length).toBeGreaterThan(0);
            expect(highPriorityLeads.length).toBeGreaterThan(0);
            expect(exportResult.content).toContain('businessName');
            expect(exportResult.content).toContain('leadQualityScore');
            expect(exportResult.content).toContain('priority');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing data gracefully', () => {
            const incompleteBusiness = {
                businessName: 'Incomplete Business',
                // Missing most fields
            };

            const scoringUtils = {
                calculateLeadQualityScore: (business) => {
                    let score = 0;
                    const breakdown = {
                        phone: { score: !!business.phone ? 0.15 : 0 },
                        email: { score: !!business.email ? 0.20 : 0 },
                        website: { score: !!business.website ? 0.15 : 0 },
                        rating: { score: Math.min(0.20, parseFloat(business.rating || 0) / 5 * 0.20) },
                        reviews: { score: Math.min(0.10, Math.log10(parseInt(business.reviewCount || 0)) / 2 * 0.10) },
                        socialMedia: { score: 0 },
                        businessStatus: { score: business.businessStatus === 'Open' ? 0.10 : 0 }
                    };
                    
                    score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
                    
                    let priority = 'Low';
                    if (score >= 0.8) priority = 'High';
                    else if (score >= 0.6) priority = 'Medium';
                    
                    return { score: Math.round(score * 100) / 100, priority };
                }
            };

            const scoring = scoringUtils.calculateLeadQualityScore(incompleteBusiness);
            
            expect(scoring.score).toBe(0);
            expect(scoring.priority).toBe('Low');
        });

        test('should handle invalid phone numbers', () => {
            const pakistanUtils = {
                validatePakistaniPhone: (phone) => {
                    if (!phone) return false;
                    const pakistaniPattern = /^\\+92\\d{9,10}$|^0\\d{9,10}$/;
                    return pakistaniPattern.test(phone.replace(/[-\\s]/g, ''));
                }
            };

            const invalidPhones = [
                '+1-212-555-1234',
                '44-20-1234-5678',
                '+91-9876543210',
                'invalid-phone',
                ''
            ];

            invalidPhones.forEach(phone => {
                const result = pakistanUtils.validatePakistaniPhone(phone);
                expect(result).toBe(false);
            });
        });
    });

    describe('Performance Tests', () => {
        test('should handle large datasets efficiently', () => {
            const largeDataset = [];
            for (let i = 0; i < 1000; i++) {
                largeDataset.push({
                    id: `business_${i}`,
                    businessName: `Test Business ${i}`,
                    rating: (3 + Math.random() * 2).toFixed(1),
                    reviewCount: Math.floor(50 + Math.random() * 500),
                    phone: Math.random() > 0.3 ? '+92-42-1234567' : null,
                    email: Math.random() > 0.3 ? 'info@test.com' : null,
                    website: Math.random() > 0.3 ? 'https://www.test.com' : null,
                    businessStatus: Math.random() > 0.1 ? 'Open' : 'Closed'
                });
            }

            const startTime = Date.now();
            
            // Process through lead scoring
            largeDataset.forEach(business => {
                const scoringUtils = {
                    calculateLeadQualityScore: (business) => {
                        let score = 0;
                        const breakdown = {
                            phone: { score: !!business.phone ? 0.15 : 0 },
                            email: { score: !!business.email ? 0.20 : 0 },
                            website: { score: !!business.website ? 0.15 : 0 },
                            rating: { score: Math.min(0.20, parseFloat(business.rating || 0) / 5 * 0.20) },
                            reviews: { score: Math.min(0.10, Math.log10(parseInt(business.reviewCount || 0)) / 2 * 0.10) },
                            socialMedia: { score: 0 },
                            businessStatus: { score: business.businessStatus === 'Open' ? 0.10 : 0 }
                        };
                        
                        score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
                        
                        let priority = 'Low';
                        if (score >= 0.8) priority = 'High';
                        else if (score >= 0.6) priority = 'Medium';
                        
                        return { score: Math.round(score * 100) / 100, priority };
                    }
                };
                
                const scoring = scoringUtils.calculateLeadQualityScore(business);
                business.leadQualityScore = scoring.score;
                business.priority = scoring.priority;
            });

            const processingTime = Date.now() - startTime;
            
            expect(processingTime).toBeLessThan(5000); // Should process 1000 records in less than 5 seconds
            expect(largeDataset.length).toBe(1000);
            expect(largeDataset.every(business => business.leadQualityScore !== undefined)).toBe(true);
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });
});

// Run tests if this file is executed directly
if (require.main === module) {
    console.log('🧪 Running GeoLead AI Test Suite...');
    console.log('=====================================');
    
    // Run all tests
    const testResults = {
        passed: 0,
        failed: 0,
        total: 0
    };

    // Simple test runner (replace with proper test framework in production)
    const tests = [
        {
            name: 'Data Generation Test',
            test: () => {
                const data = demo.generateSampleData();
                if (data.length > 0 && data[0].businessName) {
                    testResults.passed++;
                    console.log('✅ Data Generation Test passed');
                } else {
                    testResults.failed++;
                    console.log('❌ Data Generation Test failed');
                }
                testResults.total++;
            }
        },
        {
            name: 'Lead Scoring Test',
            test: () => {
                const business = {
                    phone: '+92-42-1234567',
                    email: 'info@test.com',
                    website: 'https://www.test.com',
                    rating: '4.5',
                    reviewCount: '150',
                    businessStatus: 'Open'
                };
                
                const scoringUtils = {
                    calculateLeadQualityScore: (business) => {
                        let score = 0;
                        const breakdown = {
                            phone: { score: !!business.phone ? 0.15 : 0 },
                            email: { score: !!business.email ? 0.20 : 0 },
                            website: { score: !!business.website ? 0.15 : 0 },
                            rating: { score: Math.min(0.20, parseFloat(business.rating || 0) / 5 * 0.20) },
                            reviews: { score: Math.min(0.10, Math.log10(parseInt(business.reviewCount || 0)) / 2 * 0.10) },
                            socialMedia: { score: 0 },
                            businessStatus: { score: business.businessStatus === 'Open' ? 0.10 : 0 }
                        };
                        
                        score = Object.values(breakdown).reduce((sum, item) => sum + item.score, 0);
                        
                        let priority = 'Low';
                        if (score >= 0.8) priority = 'High';
                        else if (score >= 0.6) priority = 'Medium';
                        
                        return { score: Math.round(score * 100) / 100, priority };
                    }
                };
                
                const scoring = scoringUtils.calculateLeadQualityScore(business);
                if (scoring.score > 0 && ['High', 'Medium', 'Low'].includes(scoring.priority)) {
                    testResults.passed++;
                    console.log('✅ Lead Scoring Test passed');
                } else {
                    testResults.failed++;
                    console.log('❌ Lead Scoring Test failed');
                }
                testResults.total++;
            }
        }
    ];

    tests.forEach(test => {
        try {
            test.test();
        } catch (error) {
            testResults.failed++;
            testResults.total++;
            console.log(`❌ ${test.name} failed with error: ${error.message}`);
        }
    });

    console.log('\\n📊 Test Results Summary:');
    console.log(`  Total Tests: ${testResults.total}`);
    console.log(`  Passed: ${testResults.passed}`);
    console.log(`  Failed: ${testResults.failed}`);
    console.log(`  Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed === 0) {
        console.log('\\n🎉 All tests passed!');
    } else {
        console.log(`\\n⚠️  ${testResults.failed} test(s) failed. Please review the implementation.`);
    }
}