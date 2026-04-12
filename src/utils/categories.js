// Business categories with icons and labels
export const CATEGORIES = [
    { id: 'restaurant', label: 'Restaurants', icon: '' },
    { id: 'hotel', label: 'Hotels', icon: '🏨' },
    { id: 'bank', label: 'Banks', icon: '🏦' },
    { id: 'retail', label: 'Retail Shops', icon: '' },
    { id: 'clinic', label: 'Clinics', icon: '🏥' },
    { id: 'salon', label: 'Salons', icon: '💇' },
    { id: 'gym', label: 'Gyms', icon: '' },
    { id: 'cafe', label: 'Cafes', icon: '☕' },
    { id: 'pharmacy', label: 'Pharmacies', icon: '💊' },
    { id: 'auto', label: 'Auto Repair', icon: '🔧' },
    { id: 'education', label: 'Schools', icon: '🎓' },
    { id: 'other', label: 'Other', icon: '' },
];

// Mapping from category IDs to Google Maps search queries
export const CATEGORY_QUERIES = {
    restaurant: 'restaurants',
    hotel: 'hotels',
    bank: 'banks',
    retail: 'shops',
    clinic: 'clinics',
    salon: 'beauty salons',
    gym: 'gyms',
    cafe: 'cafes',
    pharmacy: 'pharmacies',
    auto: 'auto repair',
    education: 'schools',
    other: 'businesses',
};
