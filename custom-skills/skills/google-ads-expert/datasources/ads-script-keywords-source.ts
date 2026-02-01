/**
 * AdsScriptKeywordsSource - Google Ads Scripts Keywords DataSource
 *
 * Receives keyword data exported from Google Ads Scripts via webhook.
 *
 * Known limitations:
 * - Depends on script execution (manual or scheduled)
 * - keyword_id may change over time in Google Ads
 */

import { ValidationResult } from "./interface.js";
import {
  KeywordsIngestPayload,
  KeywordMetrics,
  KeywordMatchType,
  DateRangeType,
} from "../types.js";

interface AdsScriptRawKeywordsPayload {
  source: string;
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: string;
  fetchedAt: string;
  keywords: AdsScriptRawKeyword[];
}

interface AdsScriptRawKeyword {
  keywordId: string;
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
  cpc?: number;
  conversionRate?: number;
}

const VALID_DATE_RANGES: DateRangeType[] = ['LAST_7_DAYS', 'LAST_30_DAYS', 'TODAY', 'YESTERDAY'];
const VALID_MATCH_TYPES: KeywordMatchType[] = ['EXACT', 'PHRASE', 'BROAD'];
const VALID_MATCH_TYPES_LOWERCASE = ['exact', 'phrase', 'broad'];

export interface KeywordsDataSource {
  readonly type: 'ads-script-keywords';
  readonly name: string;
  validate(rawData: unknown): ValidationResult;
  transform(rawData: unknown): KeywordsIngestPayload;
  isConfigured(): boolean;
}

export class AdsScriptKeywordsSource implements KeywordsDataSource {
  readonly type = 'ads-script-keywords' as const;
  readonly name = 'Google Ads Scripts - Keywords';

  isConfigured(): boolean {
    return true;
  }

  validate(rawData: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('[KeywordsValidation] Raw payload received:', JSON.stringify(rawData, null, 2).substring(0, 2000));

    if (!rawData || typeof rawData !== 'object') {
      return { valid: false, errors: ['Payload must be an object'], warnings };
    }

    const data = rawData as Record<string, unknown>;

    if (data.source !== 'ads-script-keywords') {
      errors.push("Invalid source: expected 'ads-script-keywords', got '" + data.source + "'");
    }

    if (!data.accountId || typeof data.accountId !== 'string') {
      errors.push('Missing or invalid accountId');
    }

    if (!data.accountName || typeof data.accountName !== 'string') {
      errors.push('Missing or invalid accountName');
    }

    if (!data.currency || typeof data.currency !== 'string') {
      errors.push('Missing or invalid currency');
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

    if (!Array.isArray(data.keywords)) {
      errors.push('keywords must be an array');
    } else if (data.keywords.length === 0) {
      warnings.push('No keywords in payload');
    } else {
      // Log first keyword for debugging
      console.log('[KeywordsValidation] First keyword sample:', JSON.stringify(data.keywords[0], null, 2));
      console.log('[KeywordsValidation] Total keywords:', data.keywords.length);

      for (let i = 0; i < data.keywords.length; i++) {
        const kw = data.keywords[i] as Record<string, unknown>;
        const prefix = 'keywords[' + i + ']';

        if (!kw.keywordId || typeof kw.keywordId !== 'string') {
          errors.push(prefix + ': missing or invalid keywordId');
        }

        if (!kw.keywordText || typeof kw.keywordText !== 'string') {
          errors.push(prefix + ': missing or invalid keywordText');
        }

        const normalizedMatchType = typeof kw.matchType === 'string' ? kw.matchType.toUpperCase() : '';
        if (!kw.matchType || !VALID_MATCH_TYPES.includes(normalizedMatchType as KeywordMatchType)) {
          errors.push(prefix + ": invalid matchType '" + kw.matchType + "' (must be EXACT, PHRASE, or BROAD)");
        }

        if (!kw.campaignId || typeof kw.campaignId !== 'string') {
          errors.push(prefix + ': missing or invalid campaignId');
        }

        if (!kw.adGroupId || typeof kw.adGroupId !== 'string') {
          errors.push(prefix + ': missing or invalid adGroupId');
        }

        const numericFields = ['cost', 'clicks', 'impressions', 'conversions', 'conversionValue'];
        for (const field of numericFields) {
          if (typeof kw[field] !== 'number' || isNaN(kw[field] as number)) {
            errors.push(prefix + ': ' + field + ' must be a valid number');
          } else if ((kw[field] as number) < 0) {
            errors.push(prefix + ': ' + field + ' cannot be negative');
          }
        }
      }

      if (data.keywords.length > 10000) {
        warnings.push('Large payload: ' + data.keywords.length + ' keywords');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  transform(rawData: unknown): KeywordsIngestPayload {
    const data = rawData as AdsScriptRawKeywordsPayload;

    const keywords: KeywordMetrics[] = data.keywords.map(kw => {
      const clicks = kw.clicks || 0;
      const impressions = kw.impressions || 0;
      const cost = kw.cost || 0;
      const conversions = kw.conversions || 0;

      return {
        keywordId: kw.keywordId,
        keywordText: kw.keywordText,
        matchType: kw.matchType.toUpperCase() as KeywordMatchType,
        campaignId: kw.campaignId,
        campaignName: kw.campaignName || '',
        adGroupId: kw.adGroupId,
        adGroupName: kw.adGroupName || '',
        cost: cost,
        clicks: clicks,
        impressions: impressions,
        conversions: conversions,
        conversionValue: kw.conversionValue || 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? cost / clicks : 0,
        conversionRate: clicks > 0 ? conversions / clicks : 0,
      };
    });

    return {
      source: 'ads-script-keywords',
      accountId: data.accountId,
      accountName: data.accountName,
      currency: data.currency,
      dateRange: data.dateRange as DateRangeType,
      fetchedAt: data.fetchedAt,
      keywords,
    };
  }
}

// Singleton instance
export const keywordsDataSource = new AdsScriptKeywordsSource();
