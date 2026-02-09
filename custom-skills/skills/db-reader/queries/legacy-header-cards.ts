/**
 * Legacy Dashboard - Header Cards Queries
 *
 * Replica las métricas del dashboard legacy (avocode-bo)
 */

import { QueryDefinition } from "../types.js";

// Currency conversion rates to EUR (hardcoded como en el legacy)
const CURRENCY_CONVERSION = `
  CASE currency_id
    WHEN 1 THEN amount              -- EUR
    WHEN 2 THEN amount * 1.15       -- USD
    WHEN 3 THEN amount * 0.85       -- GBP
    WHEN 4 THEN amount * 0.2        -- RON
    WHEN 6 THEN amount * 0.0026     -- HUF
    WHEN 7 THEN amount * 0.00093    -- CLP
    WHEN 8 THEN amount * 0.16       -- BRL
    WHEN 9 THEN amount * 0.027      -- UAH
    ELSE amount
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
        ROUND(
          SUM(${CURRENCY_CONVERSION}) / DAY(CURDATE()),
          2
        ) as gross_turnover_per_day,
        SUM(${CURRENCY_CONVERSION}) as gross_turnover_mtd,
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
        SELECT ${CURRENCY_CONVERSION} as refund_eur
        FROM avocode.invoices
        WHERE invoice_type_id = 3
          AND company_id != 3
          AND transacted_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND transacted_at < CURDATE() + INTERVAL 1 DAY

        UNION ALL

        -- Zoho refunds (Jackcode)
        SELECT
          CASE zc.currency_code
            WHEN 'USD' THEN zr.amount * 1.15
            WHEN 'GBP' THEN zr.amount * 0.85
            WHEN 'RON' THEN zr.amount * 0.2
            ELSE zr.amount
          END as refund_eur
        FROM avocodebo.zoho_refunds zr
        JOIN avocodebo.zoho_customers zc ON zc.id = zr.customer_id
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
 */
export function adsExpenseMtdQuery(): QueryDefinition {
  return {
    id: "legacy-ads-expense-mtd" as any,
    name: "Ads Expense MTD",
    description: "Total ads expense MTD converted to EUR",
    sql: `
      SELECT COALESCE(SUM(
        CASE c.currency_id
          WHEN 4 THEN a.cost / 4.95  -- RON to EUR
          ELSE a.cost
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
            CASE c.currency_id
              WHEN 4 THEN a.cost / 4.95  -- RON to EUR
              ELSE a.cost
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
