/**
 * Legacy Dashboard - Header Cards Queries
 *
 * Replica las métricas del dashboard legacy (avocode-bo)
 */

import { QueryDefinition } from "../types.js";

// Currency conversion: amount / rate = EUR
// invoices uses currency_code (string like 'EUR', 'USD', 'RON')
const CURRENCY_RATE_CASE = `
  CASE currency_code
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

/**
 * Active Acquisitions - Suscripciones activas (no canceladas)
 */
export function activeAcquisitionsQuery(): QueryDefinition {
  return {
    id: "legacy-active-acquisitions" as any,
    name: "Active Acquisitions",
    description: "Subscriptions not cancelled",
    sql: `
      SELECT COUNT(*) as active_acquisitions
      FROM avocode.subscriptions s
      WHERE s.cancelled_at IS NULL
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Active Subscribers - Suscripciones con al menos 1 rebill pagado
 */
export function activeSubscribersQuery(): QueryDefinition {
  return {
    id: "legacy-active-subscribers" as any,
    name: "Active Subscribers",
    description: "Active subscriptions with at least 1 paid rebill",
    sql: `
      SELECT COUNT(DISTINCT s.id) as active_subscribers
      FROM avocode.subscriptions s
      WHERE s.cancelled_at IS NULL
        AND EXISTS (
          SELECT 1 FROM avocode.invoices i
          WHERE i.customer_id = s.customer_id
            AND i.invoice_type_id = 2
            AND i.invoice_status_id = 1
        )
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Gross Turnover Per Day - MTD promedio diario (trials + rebills)
 */
export function grossTurnoverPerDayQuery(): QueryDefinition {
  return {
    id: "legacy-gross-turnover" as any,
    name: "Gross Turnover Per Day",
    description: "MTD daily average of paid invoices (trials + rebills) converted to EUR",
    sql: `
      SELECT
        ROUND(SUM(amount / ${CURRENCY_RATE_CASE}) / DAY(CURDATE()), 2) as gross_turnover_per_day,
        SUM(amount / ${CURRENCY_RATE_CASE}) as gross_turnover_mtd,
        DAY(CURDATE()) as days_in_month
      FROM avocode.invoices
      WHERE invoice_type_id IN (1, 2)
        AND invoice_status_id = 1
        AND transacted_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        AND transacted_at < CURDATE() + INTERVAL 1 DAY
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds MTD - Para calcular Net Turnover
 * Incluye invoice refunds (type 3) + zoho_refunds (Jackcode)
 */
export function refundsMtdQuery(): QueryDefinition {
  return {
    id: "legacy-refunds-mtd" as any,
    name: "Refunds MTD",
    description: "Total refunds MTD (invoice type 3 + zoho_refunds)",
    sql: `
      SELECT COALESCE(SUM(refund_eur), 0) as total_refunds_eur
      FROM (
        -- Invoice refunds (Avocode/KiwiKode) - type 3, company != 3
        SELECT amount / ${CURRENCY_RATE_CASE} as refund_eur
        FROM avocode.invoices
        WHERE invoice_type_id = 3
          AND company_id != 3
          AND transacted_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND transacted_at < CURDATE() + INTERVAL 1 DAY

        UNION ALL

        -- Zoho refunds (Jackcode) - join via zoho_credit_notes
        SELECT
          zr.amount / CASE COALESCE(zc.currency_code, zosc.currency_code)
            WHEN 'EUR' THEN 1
            WHEN 'USD' THEN 1.08
            WHEN 'GBP' THEN 0.84
            WHEN 'RON' THEN 4.97
            ELSE 1
          END as refund_eur
        FROM avocodebo.zoho_refunds zr
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        WHERE zr.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND zr.created_at < CURDATE() + INTERVAL 1 DAY
      ) refunds
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Ads Expense MTD - Gasto en publicidad del mes
 * campaigns.currency_id: 2=EUR, 4=RON
 */
export function adsExpenseMtdQuery(): QueryDefinition {
  return {
    id: "legacy-ads-expense-mtd" as any,
    name: "Ads Expense MTD",
    description: "Total ads expense MTD converted to EUR",
    sql: `
      SELECT COALESCE(SUM(
        a.cost / CASE c.currency_id
          WHEN 2 THEN 1      -- EUR
          WHEN 4 THEN 4.97   -- RON
          ELSE 1
        END
      ), 0) as ads_expense_eur
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE a.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        AND a.date <= CURDATE()
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Cost Per First Rebill por Website (MTD)
 * Fórmula: Ad Spend / First Rebills
 */
export function costPerFirstRebillByWebsiteQuery(): QueryDefinition {
  return {
    id: "legacy-cpfr-by-website" as any,
    name: "Cost Per First Rebill by Website",
    description: "MTD cost per first rebill grouped by website",
    sql: `
      WITH monthly_rebills AS (
        SELECT
          w.id as website_id,
          w.name as website_name,
          COUNT(DISTINCT CASE WHEN i.invoice_type_id = 2 THEN i.id END) as first_rebills,
          COUNT(DISTINCT CASE WHEN i.invoice_type_id = 1 THEN i.id END) as trials
        FROM avocode.invoices i
        JOIN avocode.websites w ON w.id = i.website_id
        WHERE i.invoice_type_id IN (1, 2)
          AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND i.transacted_at < CURDATE() + INTERVAL 1 DAY
        GROUP BY w.id, w.name
      ),
      monthly_ads AS (
        SELECT
          c.website_id,
          SUM(
            a.cost / CASE c.currency_id
              WHEN 2 THEN 1      -- EUR
              WHEN 4 THEN 4.97   -- RON
              ELSE 1
            END
          ) as ads_expense_eur
        FROM avocodebo.ads a
        INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
        WHERE a.date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND a.date <= CURDATE()
        GROUP BY c.website_id
      )
      SELECT
        mr.website_id,
        mr.website_name,
        mr.first_rebills,
        mr.trials,
        COALESCE(ma.ads_expense_eur, 0) as ads_expense_eur,
        CASE
          WHEN mr.first_rebills > 0
          THEN ROUND(COALESCE(ma.ads_expense_eur, 0) / mr.first_rebills, 2)
          ELSE 0
        END as cost_per_first_rebill,
        CASE
          WHEN mr.trials > 0
          THEN ROUND((mr.first_rebills * 100.0) / mr.trials, 2)
          ELSE 0
        END as rebill_rate
      FROM monthly_rebills mr
      LEFT JOIN monthly_ads ma ON ma.website_id = mr.website_id
      ORDER BY mr.website_name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
