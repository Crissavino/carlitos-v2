/**
 * AdsScriptSearchTermsSource - Google Ads Scripts Search Terms DataSource
 *
 * Receives search term data exported from Google Ads Scripts via webhook.
 * Search terms represent actual user queries that triggered ads.
 */

import { ValidationResult } from "./interface.js";
import {
  SearchTermsIngestPayload,
  SearchTermMetrics,
  KeywordMatchType,
} from "../types.js";

interface AdsScriptRawSearchTermsPayload {
  source: string;
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: string;
  fetchedAt: string;
  chunk?: number;
  totalChunks?: number;
  searchTerms: AdsScriptRawSearchTerm[];
}

interface AdsScriptRawSearchTerm {
  searchTerm: string;
  keywordText: string;
  matchType: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr?: number;
  conversionRate?: number;
}

const VALID_DATE_RANGES = ['7d', '30d'];
const VALID_MATCH_TYPES: (KeywordMatchType | 'UNKNOWN')[] = ['EXACT', 'PHRASE', 'BROAD', 'UNKNOWN'];

// HARDENING: Account → Currency mapping (source of truth)
const ACCOUNT_CURRENCY_MAP: Record<string, string> = {
  '338-426-8994': 'EUR',  // Jackcode
  '502-581-1084': 'RON',  // KiwiKode
};

export interface SearchTermsDataSource {
  readonly type: 'ads-script-search-terms';
  readonly name: string;
  validate(rawData: unknown): ValidationResult;
  transform(rawData: unknown): SearchTermsIngestPayload;
  isConfigured(): boolean;
}

export class AdsScriptSearchTermsSource implements SearchTermsDataSource {
  readonly type = 'ads-script-search-terms' as const;
  readonly name = 'Google Ads Scripts - Search Terms';

  isConfigured(): boolean {
    return true;
  }

  validate(rawData: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('[SearchTermsValidation] Raw payload received, validating...');

    if (!rawData || typeof rawData !== 'object') {
      return { valid: false, errors: ['Payload must be an object'], warnings };
    }

    const data = rawData as Record<string, unknown>;

    if (data.source !== 'ads-script-search-terms') {
      errors.push("Invalid source: expected 'ads-script-search-terms', got '" + data.source + "'");
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

    if (!data.dateRange || !VALID_DATE_RANGES.includes(data.dateRange as string)) {
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

    if (!Array.isArray(data.searchTerms)) {
      errors.push('searchTerms must be an array');
    } else if (data.searchTerms.length === 0) {
      warnings.push('No search terms in payload');
    } else {
      // Log first search term for debugging
      console.log('[SearchTermsValidation] First search term sample:', JSON.stringify(data.searchTerms[0], null, 2));
      console.log('[SearchTermsValidation] Total search terms:', data.searchTerms.length);

      // Validate first few search terms (don't validate all to save time)
      const maxValidate = Math.min(data.searchTerms.length, 10);
      for (let i = 0; i < maxValidate; i++) {
        const st = data.searchTerms[i] as Record<string, unknown>;
        const prefix = 'searchTerms[' + i + ']';

        if (!st.searchTerm || typeof st.searchTerm !== 'string') {
          errors.push(prefix + ': missing or invalid searchTerm');
        }

        if (typeof st.keywordText !== 'string') {
          errors.push(prefix + ': keywordText must be a string');
        }

        const normalizedMatchType = typeof st.matchType === 'string' ? st.matchType.toUpperCase() : '';
        if (!VALID_MATCH_TYPES.includes(normalizedMatchType as KeywordMatchType | 'UNKNOWN')) {
          warnings.push(prefix + ": matchType '" + st.matchType + "' normalized to UNKNOWN");
        }

        if (!st.campaignId || typeof st.campaignId !== 'string') {
          errors.push(prefix + ': missing or invalid campaignId');
        }

        if (!st.adGroupId || typeof st.adGroupId !== 'string') {
          errors.push(prefix + ': missing or invalid adGroupId');
        }

        const numericFields = ['cost', 'clicks', 'impressions', 'conversions', 'conversionValue'];
        for (const field of numericFields) {
          if (typeof st[field] !== 'number' || isNaN(st[field] as number)) {
            errors.push(prefix + ': ' + field + ' must be a valid number');
          } else if ((st[field] as number) < 0) {
            errors.push(prefix + ': ' + field + ' cannot be negative');
          }
        }
      }

      if (data.searchTerms.length > 5000) {
        warnings.push('Large payload: ' + data.searchTerms.length + ' search terms');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  transform(rawData: unknown): SearchTermsIngestPayload {
    const data = rawData as AdsScriptRawSearchTermsPayload;

    const searchTerms: SearchTermMetrics[] = data.searchTerms.map(st => {
      const clicks = st.clicks || 0;
      const impressions = st.impressions || 0;
      const conversions = st.conversions || 0;

      // Normalize matchType
      let matchType: KeywordMatchType | 'UNKNOWN' = 'UNKNOWN';
      if (st.matchType) {
        const normalized = st.matchType.toUpperCase().replace('MATCH_TYPE_', '');
        if (['EXACT', 'PHRASE', 'BROAD'].includes(normalized)) {
          matchType = normalized as KeywordMatchType;
        }
      }

      return {
        searchTerm: st.searchTerm || '',
        keywordText: st.keywordText || '',
        matchType,
        campaignId: st.campaignId || '',
        campaignName: st.campaignName || '',
        adGroupId: st.adGroupId || '',
        adGroupName: st.adGroupName || '',
        cost: st.cost || 0,
        clicks,
        impressions,
        conversions,
        conversionValue: st.conversionValue || 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
      };
    });

    return {
      source: 'ads-script-search-terms',
      accountId: data.accountId,
      accountName: data.accountName,
      currency: data.currency,
      dateRange: data.dateRange as '7d' | '30d',
      fetchedAt: data.fetchedAt,
      chunk: data.chunk,
      totalChunks: data.totalChunks,
      searchTerms,
    };
  }
}

// Singleton instance
export const searchTermsDataSource = new AdsScriptSearchTermsSource();
