-- Dashboard Metrics Cache
-- Pre-calculated metrics to speed up dashboard loads
-- Updated by scheduled job every hour

CREATE TABLE IF NOT EXISTS dashboard_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  website_id INT NOT NULL,
  metric_date DATE NOT NULL,

  -- Core counts (7-day rolling)
  trials_7d INT DEFAULT 0,
  first_rebills_7d INT DEFAULT 0,
  second_rebills_7d INT DEFAULT 0,
  active_subscriptions INT DEFAULT 0,

  -- Revenue (7-day rolling, in EUR)
  gross_revenue_eur DECIMAL(12,2) DEFAULT 0,
  net_revenue_eur DECIMAL(12,2) DEFAULT 0,
  refunds_eur DECIMAL(12,2) DEFAULT 0,
  ad_spend_eur DECIMAL(12,2) DEFAULT 0,

  -- Utility Model KPIs (cohort-based)
  payback_m1_cohort DECIMAL(6,4) DEFAULT NULL,
  refund_rate_m1 DECIMAL(6,4) DEFAULT NULL,
  m1_net_revenue_eur DECIMAL(12,2) DEFAULT 0,
  m1_ad_spend_eur DECIMAL(12,2) DEFAULT 0,
  m1_cohort_size INT DEFAULT 0,
  m1_first_rebills INT DEFAULT 0,

  -- LTV Windows (in EUR)
  ltv_21d DECIMAL(10,2) DEFAULT NULL,
  ltv_21d_cohort_size INT DEFAULT 0,
  ltv_51d DECIMAL(10,2) DEFAULT NULL,
  ltv_51d_cohort_size INT DEFAULT 0,
  ltv_81d DECIMAL(10,2) DEFAULT NULL,
  ltv_81d_cohort_size INT DEFAULT 0,

  -- Customer counts
  total_customers INT DEFAULT 0,
  active_customers INT DEFAULT 0,

  -- Metadata
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uk_website_date (website_id, metric_date),
  INDEX idx_website_id (website_id),
  INDEX idx_metric_date (metric_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- View for latest metrics per website
CREATE OR REPLACE VIEW dashboard_metrics_latest AS
SELECT dm.*
FROM dashboard_metrics dm
INNER JOIN (
  SELECT website_id, MAX(metric_date) as max_date
  FROM dashboard_metrics
  GROUP BY website_id
) latest ON dm.website_id = latest.website_id AND dm.metric_date = latest.max_date;
