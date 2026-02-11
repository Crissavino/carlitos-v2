/**
 * Legacy Dashboard - Today Performance Queries
 *
 * Replica la tabla "Today Performance" del dashboard legacy (avocode-bo)
 * Muestra trials y rebills por website/campaign para hoy y ayer
 *
 * IMPORTANTE: Usa CONVERT_TZ para Europe/Bucharest (UTC+2) como el legacy
 */

import { QueryDefinition } from "../types.js";

// Currency conversion: amount / rate = EUR
const CURRENCY_RATE_CASE = `
  CASE i.currency_code
    WHEN 'EUR' THEN 1
    WHEN 'USD' THEN 1.08
    WHEN 'GBP' THEN 0.84
    WHEN 'RON' THEN 4.97
    WHEN 'HUF' THEN 408
    WHEN 'CLP' THEN 1020
    WHEN 'BRL' THEN 6.35
    WHEN 'UAH' THEN 43.5
    ELSE 1
  END
`;

// Timezone conversion to Europe/Bucharest (UTC+2)
// Legacy uses: CONVERT_TZ(processed, '+00:00', '+02:00')
const TZ_CONVERT = (field: string) => `CONVERT_TZ(${field}, '+00:00', '+02:00')`;
const TODAY_BUCHAREST = `DATE(CONVERT_TZ(NOW(), '+00:00', '+02:00'))`;
const YESTERDAY_BUCHAREST = `DATE(CONVERT_TZ(NOW(), '+00:00', '+02:00')) - INTERVAL 1 DAY`;

/**
 * Trials (Premium Acquisitions) by Website - Today & Yesterday
 * Uses invoice_type_id = 1 (trial payments)
 */
export function trialsPerformanceByWebsiteQuery(): QueryDefinition {
  return {
    id: "today-perf-trials-website" as any,
    name: "Trials Performance by Website",
    description: "Trial counts and amounts by website for today and yesterday",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN 1 ELSE 0 END) as yesterday_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as today_amount,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as yesterday_amount
      FROM avocode.invoices i
      JOIN avocode.websites w ON w.id = i.website_id
      WHERE i.invoice_type_id = 1
        AND i.invoice_status_id = 1
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
      GROUP BY w.id, w.name
      ORDER BY w.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Trials by Website and Campaign - Today & Yesterday
 * Links via google_ads_details.utm_campaign → campaigns.google_campaign_id
 */
export function trialsPerformanceByCampaignQuery(): QueryDefinition {
  return {
    id: "today-perf-trials-campaign" as any,
    name: "Trials Performance by Campaign",
    description: "Trial counts by website and campaign for today and yesterday",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        COALESCE(camp.id, 0) as campaign_id,
        COALESCE(camp.name, 'No Campaign') as campaign_name,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN 1 ELSE 0 END) as yesterday_count
      FROM avocode.invoices i
      JOIN avocode.websites w ON w.id = i.website_id
      LEFT JOIN avocode.google_ads_details gad ON gad.customer_id = i.customer_id
      LEFT JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign AND camp.website_id = w.id
      WHERE i.invoice_type_id = 1
        AND i.invoice_status_id = 1
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
      GROUP BY w.id, w.name, camp.id, camp.name
      ORDER BY w.name, camp.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Rebills by Website - Today & Yesterday
 * Uses invoice_type_id = 2 (rebill payments)
 */
export function rebillsPerformanceByWebsiteQuery(): QueryDefinition {
  return {
    id: "today-perf-rebills-website" as any,
    name: "Rebills Performance by Website",
    description: "Rebill counts and amounts by website for today and yesterday",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN 1 ELSE 0 END) as yesterday_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as today_amount,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as yesterday_amount
      FROM avocode.invoices i
      JOIN avocode.websites w ON w.id = i.website_id
      WHERE i.invoice_type_id = 2
        AND i.invoice_status_id = 1
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
      GROUP BY w.id, w.name
      ORDER BY w.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Rebills by Website and Campaign - Today & Yesterday
 */
export function rebillsPerformanceByCampaignQuery(): QueryDefinition {
  return {
    id: "today-perf-rebills-campaign" as any,
    name: "Rebills Performance by Campaign",
    description: "Rebill counts by website and campaign for today and yesterday",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        COALESCE(camp.id, 0) as campaign_id,
        COALESCE(camp.name, 'No Campaign') as campaign_name,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN 1 ELSE 0 END) as yesterday_count
      FROM avocode.invoices i
      JOIN avocode.websites w ON w.id = i.website_id
      LEFT JOIN avocode.google_ads_details gad ON gad.customer_id = i.customer_id
      LEFT JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign AND camp.website_id = w.id
      WHERE i.invoice_type_id = 2
        AND i.invoice_status_id = 1
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
      GROUP BY w.id, w.name, camp.id, camp.name
      ORDER BY w.name, camp.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Rebills Refunded - Today & Yesterday
 * Uses invoice_type_id = 3 (refunds)
 */
export function refundedRebillsQuery(): QueryDefinition {
  return {
    id: "today-perf-refunded-rebills" as any,
    name: "Refunded Rebills",
    description: "Count and amount of refunded rebills for today and yesterday",
    sql: `
      SELECT
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN 1 ELSE 0 END) as yesterday_count,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as today_amount,
        SUM(CASE WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST} THEN i.amount / ${CURRENCY_RATE_CASE} ELSE 0 END) as yesterday_amount
      FROM avocode.invoices i
      WHERE i.invoice_type_id = 3
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Total Revenue - Today & Yesterday
 * Trials + Rebills - Refunds
 */
export function totalRevenueQuery(): QueryDefinition {
  return {
    id: "today-perf-total-revenue" as any,
    name: "Total Revenue",
    description: "Total revenue (trials + rebills - refunds) for today and yesterday",
    sql: `
      SELECT
        SUM(CASE
          WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${TODAY_BUCHAREST}
          THEN (CASE WHEN i.invoice_type_id IN (1, 2) THEN 1 ELSE -1 END) * i.amount / ${CURRENCY_RATE_CASE}
          ELSE 0
        END) as today_total,
        SUM(CASE
          WHEN DATE(${TZ_CONVERT('i.transacted_at')}) = ${YESTERDAY_BUCHAREST}
          THEN (CASE WHEN i.invoice_type_id IN (1, 2) THEN 1 ELSE -1 END) * i.amount / ${CURRENCY_RATE_CASE}
          ELSE 0
        END) as yesterday_total
      FROM avocode.invoices i
      WHERE i.invoice_status_id = 1
        AND i.transacted_at >= ${YESTERDAY_BUCHAREST}
        AND i.transacted_at < ${TODAY_BUCHAREST} + INTERVAL 1 DAY
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
