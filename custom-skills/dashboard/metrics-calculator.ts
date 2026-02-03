/**
 * Metrics Calculator
 *
 * Pre-calculates dashboard metrics and stores them in dashboard_metrics table.
 * Run this as a scheduled job (hourly or after data ingestion).
 *
 * This eliminates slow queries on dashboard load by pre-computing:
 * - Payback M1 cohort
 * - LTV windows (21d, 51d, 81d)
 * - Revenue aggregates
 * - Customer counts
 */

import { createPool, Pool, RowDataPacket } from "mysql2/promise";

// Database connection
let pool: Pool | null = null;

async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_DATABASE || "avocode",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

// Jackcode company_id (for Zoho refunds)
const JACKCODE_COMPANY_ID = 3;

// Currency conversion rates (simplified - in production use live rates)
const CURRENCY_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  RON: 5.0,
  GBP: 0.85,
  PLN: 4.3,
};

function getCurrencyRate(currency: string): number {
  return CURRENCY_RATES[currency] || 1;
}

interface WebsiteMetrics {
  websiteId: number;
  metricDate: string;

  // Core counts
  trials7d: number;
  firstRebills7d: number;
  secondRebills7d: number;
  activeSubscriptions: number;

  // Revenue
  grossRevenueEur: number;
  netRevenueEur: number;
  refundsEur: number;
  adSpendEur: number;

  // Utility Model
  paybackM1Cohort: number | null;
  refundRateM1: number | null;
  m1NetRevenueEur: number;
  m1AdSpendEur: number;
  m1CohortSize: number;
  m1FirstRebills: number;

  // LTV Windows
  ltv21d: number | null;
  ltv21dCohortSize: number;
  ltv51d: number | null;
  ltv51dCohortSize: number;
  ltv81d: number | null;
  ltv81dCohortSize: number;

  // Customers
  totalCustomers: number;
  activeCustomers: number;
}

/**
 * Calculate all metrics for a website
 */
async function calculateMetricsForWebsite(websiteId: number): Promise<WebsiteMetrics> {
  const db = await getPool();
  const today = new Date().toISOString().split("T")[0];

  console.log(`[MetricsCalc] Calculating metrics for website ${websiteId}...`);
  const startTime = Date.now();

  // Run all queries in parallel for speed
  const [
    coreCountsResult,
    revenueResult,
    adSpendResult,
    paybackM1Result,
    ltv21dResult,
    ltv51dResult,
    ltv81dResult,
    customerCountsResult,
  ] = await Promise.all([
    // Core counts (7-day)
    db.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM avocode.customers
         WHERE create_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND website_id = ?) as trials_7d,
        (SELECT COUNT(*) FROM avocode.invoices i
         JOIN avocode.customers c ON i.customer_id = c.id
         WHERE i.invoice_type_id = 2
           AND i.invoice_status_id = 1
           AND i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND c.website_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM avocode.invoices i2
             WHERE i2.customer_id = i.customer_id
               AND i2.invoice_type_id = 2
               AND i2.invoice_status_id = 1
               AND i2.transacted_at < i.transacted_at
           )) as first_rebills_7d,
        (SELECT COUNT(*) FROM avocode.subscriptions
         WHERE is_subscription_active = 1
           AND website_id = ?) as active_subscriptions
    `, [websiteId, websiteId, websiteId]),

    // Revenue (7-day, simplified)
    db.query<RowDataPacket[]>(`
      SELECT
        COALESCE(SUM(CASE WHEN i.invoice_type_id IN (1,2) THEN i.amount / ? ELSE 0 END), 0) as gross_revenue_eur,
        COALESCE(SUM(CASE WHEN i.invoice_type_id = 3 AND i.company_id != ? THEN i.amount / ? ELSE 0 END), 0) as refunds_eur
      FROM avocode.invoices i
      JOIN avocode.customers c ON i.customer_id = c.id
      WHERE i.invoice_status_id = 1
        AND i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND c.website_id = ?
    `, [getCurrencyRate("EUR"), JACKCODE_COMPANY_ID, getCurrencyRate("EUR"), websiteId]),

    // Ad spend (7-day)
    db.query<RowDataPacket[]>(`
      SELECT COALESCE(SUM(
        CASE
          WHEN camp.currency_id = 2 THEN a.cost
          WHEN camp.currency_id = 4 THEN a.cost / 5.0
          ELSE a.cost
        END
      ), 0) as ad_spend_eur
      FROM avocodebo.ads a
      JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
      WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND camp.website_id = ?
    `, [websiteId]),

    // Payback M1 Cohort (30-60 days ago) - OPTIMIZED
    db.query<RowDataPacket[]>(`
      SELECT
        COUNT(DISTINCT c.id) as cohort_size,
        SUM(CASE WHEN fr.customer_id IS NOT NULL THEN 1 ELSE 0 END) as first_rebills,
        COALESCE(SUM(trial_rev.amount_eur), 0) as trial_revenue_eur,
        COALESCE(SUM(m1_rev.amount_eur), 0) as m1_revenue_eur,
        COALESCE(SUM(ref.amount_eur), 0) as refunds_eur
      FROM avocode.customers c
      -- First rebills (has at least one type=2 invoice)
      LEFT JOIN (
        SELECT DISTINCT customer_id
        FROM avocode.invoices
        WHERE invoice_type_id = 2 AND invoice_status_id = 1
      ) fr ON fr.customer_id = c.id
      -- Trial revenue
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as amount_eur
        FROM avocode.invoices
        WHERE invoice_type_id = 1 AND invoice_status_id = 1
        GROUP BY customer_id
      ) trial_rev ON trial_rev.customer_id = c.id
      -- M1 subscription revenue (within 30 days of acquisition)
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
        GROUP BY i.customer_id
      ) m1_rev ON m1_rev.customer_id = c.id
      -- Refunds
      LEFT JOIN (
        SELECT customer_id, SUM(amount) as amount_eur
        FROM avocode.invoices
        WHERE invoice_type_id = 3 AND invoice_status_id = 1
        GROUP BY customer_id
      ) ref ON ref.customer_id = c.id
      WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND c.website_id = ?
    `, [websiteId]),

    // LTV 21d - OPTIMIZED
    db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as cohort_size,
        ROUND(SUM(COALESCE(rev.amount_eur, 0) - COALESCE(ref.amount_eur, 0)) / NULLIF(COUNT(*), 0), 2) as ltv
      FROM avocode.customers c
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 21 DAY)
        GROUP BY i.customer_id
      ) rev ON rev.customer_id = c.id
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 3 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 21 DAY)
        GROUP BY i.customer_id
      ) ref ON ref.customer_id = c.id
      WHERE c.create_time <= DATE_SUB(CURDATE(), INTERVAL 21 DAY)
        AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND c.website_id = ?
    `, [websiteId]),

    // LTV 51d - OPTIMIZED
    db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as cohort_size,
        ROUND(SUM(COALESCE(rev.amount_eur, 0) - COALESCE(ref.amount_eur, 0)) / NULLIF(COUNT(*), 0), 2) as ltv
      FROM avocode.customers c
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 51 DAY)
        GROUP BY i.customer_id
      ) rev ON rev.customer_id = c.id
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 3 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 51 DAY)
        GROUP BY i.customer_id
      ) ref ON ref.customer_id = c.id
      WHERE c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
        AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
        AND c.website_id = ?
    `, [websiteId]),

    // LTV 81d - OPTIMIZED
    db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as cohort_size,
        ROUND(SUM(COALESCE(rev.amount_eur, 0) - COALESCE(ref.amount_eur, 0)) / NULLIF(COUNT(*), 0), 2) as ltv
      FROM avocode.customers c
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 81 DAY)
        GROUP BY i.customer_id
      ) rev ON rev.customer_id = c.id
      LEFT JOIN (
        SELECT i.customer_id, SUM(i.amount) as amount_eur
        FROM avocode.invoices i
        JOIN avocode.customers c2 ON i.customer_id = c2.id
        WHERE i.invoice_type_id = 3 AND i.invoice_status_id = 1
          AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 81 DAY)
        GROUP BY i.customer_id
      ) ref ON ref.customer_id = c.id
      WHERE c.create_time <= DATE_SUB(CURDATE(), INTERVAL 81 DAY)
        AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        AND c.website_id = ?
    `, [websiteId]),

    // Customer counts
    db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as total_customers,
        SUM(CASE WHEN is_subscription_active = 1 THEN 1 ELSE 0 END) as active_customers
      FROM avocode.subscriptions
      WHERE website_id = ?
    `, [websiteId]),
  ]);

  // Extract results
  const coreCounts = (coreCountsResult[0] as RowDataPacket[])[0] || {};
  const revenue = (revenueResult[0] as RowDataPacket[])[0] || {};
  const adSpend = (adSpendResult[0] as RowDataPacket[])[0] || {};
  const paybackM1 = (paybackM1Result[0] as RowDataPacket[])[0] || {};
  const ltv21d = (ltv21dResult[0] as RowDataPacket[])[0] || {};
  const ltv51d = (ltv51dResult[0] as RowDataPacket[])[0] || {};
  const ltv81d = (ltv81dResult[0] as RowDataPacket[])[0] || {};
  const customerCounts = (customerCountsResult[0] as RowDataPacket[])[0] || {};

  // Calculate derived metrics
  const grossRevenueEur = parseFloat(revenue.gross_revenue_eur) || 0;
  const refundsEur = parseFloat(revenue.refunds_eur) || 0;
  const netRevenueEur = grossRevenueEur - refundsEur;
  const adSpendEur = parseFloat(adSpend.ad_spend_eur) || 0;

  const m1NetRevenueEur =
    (parseFloat(paybackM1.trial_revenue_eur) || 0) +
    (parseFloat(paybackM1.m1_revenue_eur) || 0) -
    (parseFloat(paybackM1.refunds_eur) || 0);

  // Get ad spend for cohort period (30-60 days ago)
  const [adSpendCohortResult] = await db.query<RowDataPacket[]>(`
    SELECT COALESCE(SUM(
      CASE
        WHEN camp.currency_id = 2 THEN a.cost
        WHEN camp.currency_id = 4 THEN a.cost / 5.0
        ELSE a.cost
      END
    ), 0) as ad_spend_eur
    FROM avocodebo.ads a
    JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
    WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
      AND a.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND camp.website_id = ?
  `, [websiteId]);

  const m1AdSpendEur = parseFloat((adSpendCohortResult as RowDataPacket[])[0]?.ad_spend_eur) || 0;
  const paybackM1Cohort = m1AdSpendEur > 0 ? m1NetRevenueEur / m1AdSpendEur : null;
  const m1FirstRebills = parseInt(paybackM1.first_rebills) || 0;
  const refundRateM1 = m1FirstRebills > 0
    ? (parseFloat(paybackM1.refunds_eur) || 0) / ((parseFloat(paybackM1.m1_revenue_eur) || 0) + 0.01)
    : null;

  const elapsed = Date.now() - startTime;
  console.log(`[MetricsCalc] Website ${websiteId} calculated in ${elapsed}ms`);

  return {
    websiteId,
    metricDate: today,
    trials7d: parseInt(coreCounts.trials_7d) || 0,
    firstRebills7d: parseInt(coreCounts.first_rebills_7d) || 0,
    secondRebills7d: 0, // TODO: calculate
    activeSubscriptions: parseInt(coreCounts.active_subscriptions) || 0,
    grossRevenueEur,
    netRevenueEur,
    refundsEur,
    adSpendEur,
    paybackM1Cohort,
    refundRateM1,
    m1NetRevenueEur,
    m1AdSpendEur,
    m1CohortSize: parseInt(paybackM1.cohort_size) || 0,
    m1FirstRebills,
    ltv21d: parseFloat(ltv21d.ltv) || null,
    ltv21dCohortSize: parseInt(ltv21d.cohort_size) || 0,
    ltv51d: parseFloat(ltv51d.ltv) || null,
    ltv51dCohortSize: parseInt(ltv51d.cohort_size) || 0,
    ltv81d: parseFloat(ltv81d.ltv) || null,
    ltv81dCohortSize: parseInt(ltv81d.cohort_size) || 0,
    totalCustomers: parseInt(customerCounts.total_customers) || 0,
    activeCustomers: parseInt(customerCounts.active_customers) || 0,
  };
}

/**
 * Save metrics to database
 */
async function saveMetrics(metrics: WebsiteMetrics): Promise<void> {
  const db = await getPool();

  await db.query(`
    INSERT INTO dashboard_metrics (
      website_id, metric_date,
      trials_7d, first_rebills_7d, second_rebills_7d, active_subscriptions,
      gross_revenue_eur, net_revenue_eur, refunds_eur, ad_spend_eur,
      payback_m1_cohort, refund_rate_m1, m1_net_revenue_eur, m1_ad_spend_eur, m1_cohort_size, m1_first_rebills,
      ltv_21d, ltv_21d_cohort_size, ltv_51d, ltv_51d_cohort_size, ltv_81d, ltv_81d_cohort_size,
      total_customers, active_customers,
      calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      trials_7d = VALUES(trials_7d),
      first_rebills_7d = VALUES(first_rebills_7d),
      second_rebills_7d = VALUES(second_rebills_7d),
      active_subscriptions = VALUES(active_subscriptions),
      gross_revenue_eur = VALUES(gross_revenue_eur),
      net_revenue_eur = VALUES(net_revenue_eur),
      refunds_eur = VALUES(refunds_eur),
      ad_spend_eur = VALUES(ad_spend_eur),
      payback_m1_cohort = VALUES(payback_m1_cohort),
      refund_rate_m1 = VALUES(refund_rate_m1),
      m1_net_revenue_eur = VALUES(m1_net_revenue_eur),
      m1_ad_spend_eur = VALUES(m1_ad_spend_eur),
      m1_cohort_size = VALUES(m1_cohort_size),
      m1_first_rebills = VALUES(m1_first_rebills),
      ltv_21d = VALUES(ltv_21d),
      ltv_21d_cohort_size = VALUES(ltv_21d_cohort_size),
      ltv_51d = VALUES(ltv_51d),
      ltv_51d_cohort_size = VALUES(ltv_51d_cohort_size),
      ltv_81d = VALUES(ltv_81d),
      ltv_81d_cohort_size = VALUES(ltv_81d_cohort_size),
      total_customers = VALUES(total_customers),
      active_customers = VALUES(active_customers),
      calculated_at = NOW()
  `, [
    metrics.websiteId, metrics.metricDate,
    metrics.trials7d, metrics.firstRebills7d, metrics.secondRebills7d, metrics.activeSubscriptions,
    metrics.grossRevenueEur, metrics.netRevenueEur, metrics.refundsEur, metrics.adSpendEur,
    metrics.paybackM1Cohort, metrics.refundRateM1, metrics.m1NetRevenueEur, metrics.m1AdSpendEur, metrics.m1CohortSize, metrics.m1FirstRebills,
    metrics.ltv21d, metrics.ltv21dCohortSize, metrics.ltv51d, metrics.ltv51dCohortSize, metrics.ltv81d, metrics.ltv81dCohortSize,
    metrics.totalCustomers, metrics.activeCustomers,
  ]);

  console.log(`[MetricsCalc] Saved metrics for website ${metrics.websiteId}`);
}

/**
 * Calculate and save metrics for all websites
 */
export async function calculateAllMetrics(): Promise<void> {
  console.log("[MetricsCalc] Starting full metrics calculation...");
  const startTime = Date.now();

  const websiteIds = [1, 3, 4]; // ConversiePDF, ConviertePDF, DeviceFinder

  for (const websiteId of websiteIds) {
    try {
      const metrics = await calculateMetricsForWebsite(websiteId);
      await saveMetrics(metrics);
    } catch (error) {
      console.error(`[MetricsCalc] Error calculating metrics for website ${websiteId}:`, error);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[MetricsCalc] All metrics calculated in ${elapsed}ms`);
}

/**
 * Get cached metrics for a website (fast read from pre-calculated table)
 */
export async function getCachedMetrics(websiteId: number): Promise<WebsiteMetrics | null> {
  const db = await getPool();

  const [rows] = await db.query<RowDataPacket[]>(`
    SELECT * FROM dashboard_metrics
    WHERE website_id = ?
    ORDER BY metric_date DESC
    LIMIT 1
  `, [websiteId]);

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    websiteId: row.website_id,
    metricDate: row.metric_date,
    trials7d: row.trials_7d,
    firstRebills7d: row.first_rebills_7d,
    secondRebills7d: row.second_rebills_7d,
    activeSubscriptions: row.active_subscriptions,
    grossRevenueEur: parseFloat(row.gross_revenue_eur),
    netRevenueEur: parseFloat(row.net_revenue_eur),
    refundsEur: parseFloat(row.refunds_eur),
    adSpendEur: parseFloat(row.ad_spend_eur),
    paybackM1Cohort: row.payback_m1_cohort ? parseFloat(row.payback_m1_cohort) : null,
    refundRateM1: row.refund_rate_m1 ? parseFloat(row.refund_rate_m1) : null,
    m1NetRevenueEur: parseFloat(row.m1_net_revenue_eur),
    m1AdSpendEur: parseFloat(row.m1_ad_spend_eur),
    m1CohortSize: row.m1_cohort_size,
    m1FirstRebills: row.m1_first_rebills,
    ltv21d: row.ltv_21d ? parseFloat(row.ltv_21d) : null,
    ltv21dCohortSize: row.ltv_21d_cohort_size,
    ltv51d: row.ltv_51d ? parseFloat(row.ltv_51d) : null,
    ltv51dCohortSize: row.ltv_51d_cohort_size,
    ltv81d: row.ltv_81d ? parseFloat(row.ltv_81d) : null,
    ltv81dCohortSize: row.ltv_81d_cohort_size,
    totalCustomers: row.total_customers,
    activeCustomers: row.active_customers,
  };
}

// CLI entry point
if (process.argv[1]?.includes("metrics-calculator")) {
  calculateAllMetrics()
    .then(() => {
      console.log("[MetricsCalc] Done");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[MetricsCalc] Fatal error:", err);
      process.exit(1);
    });
}
