import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * Trial Revenue - Sum of paid trial invoices (invoice_type_id = 1)
 * Used for Payback M1 calculation
 *
 * HARDENING: Filter by website_id through subscriptions table
 */
export const trialRevenue7dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteJoin = websiteId ? `
    INNER JOIN avocode.subscriptions s ON i.customer_id = s.customer_id AND s.website_id = ?
  ` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "trial-revenue-7d",
    name: "Trial Revenue (7 days)",
    description: "Revenue from paid trial invoices in the last 7 days",
    sql: `
      SELECT
        i.currency_code,
        SUM(i.amount) as total_amount,
        COUNT(DISTINCT i.customer_id) as trial_count
      FROM avocode.invoices i
      ${websiteJoin}
      WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND i.invoice_type_id = 1
        AND i.invoice_status_id = 1
      GROUP BY i.currency_code
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * First Rebill Revenue - Sum of first subscription invoices (invoice_type_id = 2, first per customer)
 * Used for Payback M1 calculation
 *
 * HARDENING: Filter by website_id through subscriptions table
 */
export const firstRebillRevenue7dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteJoin = websiteId ? `
    INNER JOIN avocode.subscriptions s ON i.customer_id = s.customer_id AND s.website_id = ?
  ` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "first-rebill-revenue-7d",
    name: "First Rebill Revenue (7 days)",
    description: "Revenue from first subscription payments in the last 7 days",
    sql: `
      SELECT
        i.currency_code,
        SUM(i.amount) as total_amount,
        COUNT(DISTINCT i.customer_id) as first_rebill_count
      FROM avocode.invoices i
      ${websiteJoin}
      WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND i.invoice_type_id = 2
        AND i.invoice_status_id = 1
        AND i.id = (
          SELECT MIN(i2.id)
          FROM avocode.invoices i2
          WHERE i2.customer_id = i.customer_id
            AND i2.invoice_type_id = 2
            AND i2.invoice_status_id = 1
        )
      GROUP BY i.currency_code
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Refunds M1 - Refunds that occurred before the customer's second rebill date
 * For customers who had their first rebill in the last 7 days
 *
 * HARDENING: Filter by website_id through subscriptions table
 */
export const refundsM1Query: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteJoin = websiteId ? `
    INNER JOIN avocode.subscriptions s ON first_rebill.customer_id = s.customer_id AND s.website_id = ?
  ` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "refunds-m1-7d",
    name: "Refunds M1 (7 days)",
    description: "Refunds before second rebill for customers with first rebill in last 7 days",
    sql: `
      SELECT
        ref.currency_code,
        SUM(ref.amount) as total_refunds,
        COUNT(*) as refund_count
      FROM (
        -- First, get customers with their first rebill date in the last 7 days
        SELECT
          i.customer_id,
          i.transacted_at as first_rebill_date
        FROM avocode.invoices i
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          AND i.id = (
            SELECT MIN(i2.id)
            FROM avocode.invoices i2
            WHERE i2.customer_id = i.customer_id
              AND i2.invoice_type_id = 2
              AND i2.invoice_status_id = 1
          )
      ) first_rebill
      ${websiteJoin}
      -- Get second rebill date (if exists), or use first_rebill_date + 30 days as proxy
      LEFT JOIN (
        SELECT
          customer_id,
          MIN(transacted_at) as second_rebill_date
        FROM (
          SELECT
            i.customer_id,
            i.transacted_at,
            ROW_NUMBER() OVER (PARTITION BY i.customer_id ORDER BY i.transacted_at) as rn
          FROM avocode.invoices i
          WHERE i.invoice_type_id = 2
            AND i.invoice_status_id = 1
        ) ranked
        WHERE rn = 2
        GROUP BY customer_id
      ) second_rebill ON first_rebill.customer_id = second_rebill.customer_id
      -- Join with refunds (invoice_type_id = 3 or 6)
      INNER JOIN avocode.invoices ref ON ref.customer_id = first_rebill.customer_id
        AND ref.invoice_type_id IN (3, 6)
        AND ref.invoice_status_id = 1
        AND ref.transacted_at >= first_rebill.first_rebill_date
        AND ref.transacted_at < COALESCE(
          second_rebill.second_rebill_date,
          DATE_ADD(first_rebill.first_rebill_date, INTERVAL 30 DAY)
        )
      GROUP BY ref.currency_code
    `,
    params,
    permissions: ["SELECT"],
  };
};
