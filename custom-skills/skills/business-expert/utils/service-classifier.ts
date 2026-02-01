/**
 * Service Classifier - Phase 7.5
 *
 * HEURISTIC classification of campaigns by service/product type.
 * Based on campaign name pattern matching.
 *
 * ⚠️ This is NOT a source of truth - used for directional insights only.
 * Future improvement: Add explicit service_id to campaigns table.
 */

import { ServiceCategory } from "../types/business-views.js";

interface ClassificationResult {
  category: ServiceCategory;
  serviceName: string;
  confidence: 'high' | 'medium' | 'low';
  matchedPatterns: string[];
}

// Pattern definitions with confidence levels
const SERVICE_PATTERNS: {
  category: ServiceCategory;
  serviceName: string;
  patterns: RegExp[];
  confidence: 'high' | 'medium';
}[] = [
  {
    category: 'PDF_TOOLS',
    serviceName: 'PDF Tools',
    patterns: [
      /pdf\s*to\s*word/i,
      /pdf\s*to\s*excel/i,
      /pdf\s*to\s*ppt/i,
      /merge\s*pdf/i,
      /compress\s*pdf/i,
      /edit\s*pdf/i,
      /sign\s*pdf/i,
      /split\s*pdf/i,
    ],
    confidence: 'high',
  },
  {
    category: 'IMAGE_TOOLS',
    serviceName: 'Image Tools',
    patterns: [
      /image\s*to\s*pdf/i,
      /jpg\s*to\s*pdf/i,
      /png\s*to\s*pdf/i,
      /photo\s*to\s*pdf/i,
    ],
    confidence: 'high',
  },
  {
    category: 'CONTRACTS',
    serviceName: 'Contracts',
    patterns: [
      /contrat/i,       // Matches "Contrato", "Contratos", "Contract"
      /commodat/i,
      /comodat/i,
    ],
    confidence: 'high',
  },
  {
    category: 'DEVICE_FINDER',
    serviceName: 'Device Finder',
    patterns: [
      /device\s*finder/i,
      /find\s*my\s*device/i,
      /phone\s*finder/i,
    ],
    confidence: 'high',
  },
  {
    category: 'FORMS',
    serviceName: 'Forms & Documents',
    patterns: [
      /formulari/i,     // Matches "Formularios", "Formular"
      /anaf/i,
      /declarati/i,     // Matches "Declaratie", "Declaration"
    ],
    confidence: 'high',
  },
];

/**
 * Classify a campaign by its name
 */
export function classifyCampaign(campaignName: string): ClassificationResult {
  const normalizedName = campaignName.toLowerCase().trim();
  const matchedPatterns: string[] = [];
  let matchedService: typeof SERVICE_PATTERNS[0] | null = null;

  for (const service of SERVICE_PATTERNS) {
    for (const pattern of service.patterns) {
      if (pattern.test(normalizedName)) {
        matchedPatterns.push(pattern.source);
        if (!matchedService) {
          matchedService = service;
        }
        break; // Only need one match per service
      }
    }
    if (matchedService) break; // Stop at first match
  }

  if (matchedService) {
    return {
      category: matchedService.category,
      serviceName: matchedService.serviceName,
      confidence: matchedService.confidence,
      matchedPatterns,
    };
  }

  // No match found
  return {
    category: 'OTHER',
    serviceName: 'Other Services',
    confidence: 'low',
    matchedPatterns: [],
  };
}

/**
 * Classify multiple campaigns and group by service
 */
export function classifyCampaigns(
  campaigns: { campaignId: string; campaignName: string }[]
): Map<ServiceCategory, { campaignId: string; campaignName: string; classification: ClassificationResult }[]> {
  const grouped = new Map<ServiceCategory, { campaignId: string; campaignName: string; classification: ClassificationResult }[]>();

  for (const campaign of campaigns) {
    const classification = classifyCampaign(campaign.campaignName);

    if (!grouped.has(classification.category)) {
      grouped.set(classification.category, []);
    }

    grouped.get(classification.category)!.push({
      ...campaign,
      classification,
    });
  }

  return grouped;
}

/**
 * Get human-readable service name
 */
export function getServiceDisplayName(category: ServiceCategory): string {
  const names: Record<ServiceCategory, string> = {
    PDF_TOOLS: 'PDF Tools',
    IMAGE_TOOLS: 'Image Tools',
    CONTRACTS: 'Contracts',
    DEVICE_FINDER: 'Device Finder',
    FORMS: 'Forms & Documents',
    OTHER: 'Other Services',
  };
  return names[category];
}

/**
 * Get all known service categories
 */
export function getAllServiceCategories(): ServiceCategory[] {
  return ['PDF_TOOLS', 'IMAGE_TOOLS', 'CONTRACTS', 'DEVICE_FINDER', 'FORMS', 'OTHER'];
}
