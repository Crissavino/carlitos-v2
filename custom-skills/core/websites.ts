/**
 * Website Configuration - Source of Truth
 *
 * Maps website_id to business properties.
 * All KPIs MUST be calculated per website - global KPIs are PROHIBITED.
 */

export interface WebsiteConfig {
  id: number;
  name: string;
  currency: string;       // Native currency (for display)
  googleAccountId: string; // Google Ads Account ID
}

// HARDENING: Website → Configuration mapping
// Source: avocode.websites table (id 2 is not operational)
//
// Business structure:
// - conversie-pdf.com (id=1): Avocode + Jackcode (Jack pays ads) - EUR
// - convierte-pdf.com (id=3): KiwiKode - RON
// - device-finder.com (id=4): Jackcode - EUR
export const WEBSITES: Record<number, WebsiteConfig> = {
  1: {
    id: 1,
    name: 'ConversiePDF',  // conversie-pdf.com - Avocode/Jackcode
    currency: 'EUR',
    googleAccountId: '338-426-8994',
  },
  3: {
    id: 3,
    name: 'ConviertePDF',  // convierte-pdf.com - KiwiKode
    currency: 'RON',
    googleAccountId: '502-581-1084',
  },
  4: {
    id: 4,
    name: 'DeviceFinder',  // device-finder.com - Jackcode
    currency: 'EUR',
    googleAccountId: '338-426-8994',
  },
};

// Valid website IDs (for validation)
export const VALID_WEBSITE_IDS = Object.keys(WEBSITES).map(Number);

/**
 * Validate website_id
 * Throws if invalid or NULL
 */
export function validateWebsiteId(websiteId: number | null | undefined): number {
  if (websiteId === null || websiteId === undefined) {
    throw new Error('WEBSITE_ID_REQUIRED: website_id cannot be NULL. Global KPIs are disabled.');
  }

  if (!VALID_WEBSITE_IDS.includes(websiteId)) {
    throw new Error(`INVALID_WEBSITE_ID: ${websiteId} is not a valid website_id. Valid: ${VALID_WEBSITE_IDS.join(', ')}`);
  }

  return websiteId;
}

/**
 * Get website config by ID
 */
export function getWebsiteConfig(websiteId: number): WebsiteConfig {
  const config = WEBSITES[websiteId];
  if (!config) {
    throw new Error(`WEBSITE_NOT_FOUND: website_id ${websiteId} not configured`);
  }
  return config;
}

/**
 * Get website ID from Google Ads account ID
 */
export function getWebsiteIdFromAccountId(accountId: string): number | null {
  for (const [id, config] of Object.entries(WEBSITES)) {
    if (config.googleAccountId === accountId) {
      return Number(id);
    }
  }
  return null;
}

/**
 * Get all website configs
 */
export function getAllWebsites(): WebsiteConfig[] {
  return Object.values(WEBSITES);
}
