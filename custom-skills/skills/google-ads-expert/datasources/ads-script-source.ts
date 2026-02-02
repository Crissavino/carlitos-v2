/**
 * AdsScriptSource - Google Ads Scripts DataSource
 * 
 * Recibe datos exportados desde Google Ads Scripts via webhook.
 * 
 * Limitaciones conocidas:
 * - Solo emite status ENABLED | PAUSED (no REMOVED)
 * - Depende de que el script se ejecute (manual o scheduled)
 */

import { AdsDataSource, ValidationResult } from "./interface.js";
import { 
  AdsIngestPayload, 
  CampaignMetrics, 
  CampaignStatus,
  DateRangeType 
} from "../types.js";

interface AdsScriptRawPayload {
  source: string;
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: string;
  fetchedAt: string;
  campaigns: AdsScriptRawCampaign[];
}

interface AdsScriptRawCampaign {
  campaignId: string;
  campaignName: string;
  status: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr?: number;
  cpc?: number;
  conversionRate?: number;
}

const VALID_DATE_RANGES: DateRangeType[] = ['LAST_7_DAYS', 'LAST_30_DAYS', 'TODAY', 'YESTERDAY'];
const VALID_STATUSES: CampaignStatus[] = ['ENABLED', 'PAUSED'];

// HARDENING: Account → Currency mapping (source of truth)
// If an account sends data with wrong currency, it's a configuration error
const ACCOUNT_CURRENCY_MAP: Record<string, string> = {
  '338-426-8994': 'EUR',  // Jackcode
  '502-581-1084': 'RON',  // KiwiKode
};

export class AdsScriptSource implements AdsDataSource {
  readonly type = 'ads-script' as const;
  readonly name = 'Google Ads Scripts';
  
  isConfigured(): boolean {
    return true;
  }
  
  validate(rawData: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!rawData || typeof rawData !== 'object') {
      return { valid: false, errors: ['Payload must be an object'], warnings };
    }
    
    const data = rawData as Record<string, unknown>;
    
    if (data.source !== 'ads-script') {
      errors.push("Invalid source: expected 'ads-script', got '" + data.source + "'");
    }
    
    if (!data.accountId || typeof data.accountId !== 'string') {
      errors.push('Missing or invalid accountId');
    }
    
    if (!data.accountName || typeof data.accountName !== 'string') {
      errors.push('Missing or invalid accountName');
    }
    
    if (!data.currency || typeof data.currency !== 'string') {
      errors.push('Missing or invalid currency');
    } else {
      // HARDENING: Validate currency matches expected for this account
      const accountId = data.accountId as string;
      const expectedCurrency = ACCOUNT_CURRENCY_MAP[accountId];
      if (expectedCurrency && data.currency !== expectedCurrency) {
        errors.push(`Currency mismatch: account ${accountId} should use ${expectedCurrency}, got ${data.currency}`);
      }
      if (!expectedCurrency) {
        warnings.push(`Unknown account ${accountId} - currency ${data.currency} not validated against source of truth`);
      }
    }
    
    if (!data.dateRange || !VALID_DATE_RANGES.includes(data.dateRange as DateRangeType)) {
      errors.push('Invalid dateRange: must be one of ' + VALID_DATE_RANGES.join(', '));
    }
    
    if (!data.fetchedAt || typeof data.fetchedAt !== 'string') {
      errors.push('Missing or invalid fetchedAt timestamp');
    } else {
      const ts = new Date(data.fetchedAt);
      if (isNaN(ts.getTime())) {
        errors.push('fetchedAt is not a valid ISO timestamp');
      }
    }
    
    if (!Array.isArray(data.campaigns)) {
      errors.push('campaigns must be an array');
    } else if (data.campaigns.length === 0) {
      warnings.push('No campaigns in payload');
    } else {
      for (let i = 0; i < data.campaigns.length; i++) {
        const camp = data.campaigns[i] as Record<string, unknown>;
        const prefix = 'campaigns[' + i + ']';
        
        if (!camp.campaignId || typeof camp.campaignId !== 'string') {
          errors.push(prefix + ': missing or invalid campaignId');
        }
        
        if (!camp.campaignName || typeof camp.campaignName !== 'string') {
          errors.push(prefix + ': missing or invalid campaignName');
        }
        
        if (!camp.status || !VALID_STATUSES.includes(camp.status as CampaignStatus)) {
          errors.push(prefix + ": invalid status '" + camp.status + "' (must be ENABLED or PAUSED)");
        }
        
        const numericFields = ['cost', 'clicks', 'impressions', 'conversions', 'conversionValue'];
        for (const field of numericFields) {
          if (typeof camp[field] !== 'number' || isNaN(camp[field] as number)) {
            errors.push(prefix + ': ' + field + ' must be a valid number');
          } else if ((camp[field] as number) < 0) {
            errors.push(prefix + ': ' + field + ' cannot be negative');
          }
        }
      }
      
      if (data.campaigns.length > 1000) {
        warnings.push('Large payload: ' + data.campaigns.length + ' campaigns');
      }
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  
  transform(rawData: unknown): AdsIngestPayload {
    const data = rawData as AdsScriptRawPayload;
    
    const campaigns: CampaignMetrics[] = data.campaigns.map(camp => {
      const clicks = camp.clicks || 0;
      const impressions = camp.impressions || 0;
      const cost = camp.cost || 0;
      const conversions = camp.conversions || 0;
      
      return {
        campaignId: camp.campaignId,
        campaignName: camp.campaignName,
        status: camp.status as CampaignStatus,
        cost: cost,
        clicks: clicks,
        impressions: impressions,
        conversions: conversions,
        conversionValue: camp.conversionValue || 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
      };
    });
    
    return {
      source: 'ads-script',
      accountId: data.accountId,
      accountName: data.accountName,
      currency: data.currency,
      dateRange: data.dateRange as DateRangeType,
      fetchedAt: data.fetchedAt,
      campaigns
    };
  }
}
