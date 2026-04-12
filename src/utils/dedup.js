/**
 * Duplicate detection for leads
 * Uses business name + address hash to identify duplicates
 */

/**
 * Generate a hash key from business name and address
 */
export function generateLeadHash(name, address) {
    const normalized = `${(name || '').toLowerCase().trim()}|${(address || '').toLowerCase().trim()}`;
    return normalized;
}

/**
 * Check if a lead already exists in the leads array
 */
export function isDuplicate(newLead, existingLeads) {
    const newHash = generateLeadHash(newLead.businessName, newLead.address);
    return existingLeads.some(lead => {
        const existingHash = generateLeadHash(lead.businessName, lead.address);
        return existingHash === newHash;
    });
}

/**
 * Remove duplicates from leads array
 */
export function deduplicateLeads(leads) {
    const seen = new Set();
    return leads.filter(lead => {
        const hash = generateLeadHash(lead.businessName, lead.address);
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
    });
}
