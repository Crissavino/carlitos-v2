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
 * Uses subscriptions.refunded and subscriptions.refund_date fields
 * Joins with invoices to get currency_code and amount
 * HARDENING: Filter by website_id
 */
export const refundsM1Query: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? 'AND s.website_id = ?' : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "refunds-m1-7d",
    name: "Refunds M1 (7 days)",
    description: "Refunds before second rebill for customers with first rebill in last 7 days",
    sql: `
      SELECT
        i.currency_code,
        SUM(i.amount) as total_refunds,
        COUNT(*) as refund_count
      FROM avocode.subscriptions s
      INNER JOIN avocode.invoices i ON i.id = s.first_subscription_invoice_id
      WHERE s.subscription_started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND s.refunded = 1
        AND s.refund_date IS NOT NULL
        AND s.refund_date < DATE_ADD(s.subscription_started_at, INTERVAL 30 DAY)
        ${websiteFilter}
      GROUP BY i.currency_code
    `,
    params,
    permissions: ["SELECT"],
  };
};
