/**
 * Ads Analyzer
 *
 * Funciones auxiliares para datos de ads.
 * El ad spend principal viene de DBReader (avocodebo.ads).
 * El webhook de Google Ads se usa para keywords/search terms (futuro SEMrush).
 */

import { getLatestRecord } from "../../google-ads-expert/ingest.js";

/**
 * Get campaign data from Google Ads webhook (para análisis de keywords)
 * NO usar para ad spend - usar DBReader ad-spend-7d
 */
export function getGoogleAdsCampaigns(): any[] {
  const record = getLatestRecord();
  if (!record || !record.payload) return [];
  return record.payload.campaigns || [];
}

/**
 * Get top performing campaigns by CPA (for reference, not core KPI)
 * Usa datos del webhook de Google Ads
 */
export function getTopCampaigns(limit: number = 5): Array<{
  name: string;
  spend: number;
  conversions: number;
  cpa: number;
}> {
  const campaigns = getGoogleAdsCampaigns();

  return campaigns
    .filter((c: any) => c.conversions > 0 && c.cost > 0)
    .map((c: any) => ({
      name: c.campaignName,
      spend: Math.round(c.cost * 100) / 100,
      conversions: c.conversions,
      cpa: Math.round((c.cost / c.conversions) * 100) / 100,
    }))
    .sort((a: any, b: any) => a.cpa - b.cpa)
    .slice(0, limit);
}
