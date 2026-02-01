-- Migration 005: Google Ads Campaign Metrics
-- Phase 7: Store campaign cost data from Google Ads Scripts
--
-- This table is the SOURCE OF TRUTH for Ads COST.
-- Attribution and revenue come from avocode.google_ads_details and avocode.invoices.

CREATE TABLE IF NOT EXISTS google_ads_campaign_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Campaign identification (canonical key)
  campaign_id VARCHAR(50) NOT NULL COMMENT 'Google Ads Campaign ID (canonical key)',
  campaign_name VARCHAR(255) COMMENT 'Campaign name (informational only)',
  campaign_status VARCHAR(20) COMMENT 'ENABLED, PAUSED, REMOVED',

  -- Temporal window (logical time, NOT ingested_at)
  date_range VARCHAR(10) NOT NULL COMMENT '7d or 30d',
  metrics_start_date DATE NOT NULL COMMENT 'Start of metrics window',
  metrics_end_date DATE NOT NULL COMMENT 'End of metrics window',

  -- Cost metrics from Google Ads Script
  cost DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Total cost in original currency',
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  conversions DECIMAL(10,2) NOT NULL DEFAULT 0,
  ctr DECIMAL(8,6) DEFAULT 0 COMMENT 'Click-through rate (0-1)',
  cpc DECIMAL(10,4) DEFAULT 0 COMMENT 'Cost per click',

  -- Account info
  account_id VARCHAR(50) COMMENT 'Google Ads Account ID',
  account_name VARCHAR(255) COMMENT 'Google Ads Account Name',

  -- Technical metadata
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_id VARCHAR(50) COMMENT 'UUID from ingest',
  source VARCHAR(50) DEFAULT 'ads-script' COMMENT 'Data source identifier',

  -- Indexes for efficient queries
  INDEX idx_campaign_window (campaign_id, metrics_end_date),
  INDEX idx_date_range (date_range, metrics_end_date),
  INDEX idx_ingested (ingested_at),

  -- Unique constraint: one record per campaign per date_range per metrics_end_date
  UNIQUE KEY uk_campaign_range_date (campaign_id, date_range, metrics_end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for getting latest metrics per campaign
CREATE INDEX idx_latest_metrics ON google_ads_campaign_metrics (campaign_id, date_range, ingested_at DESC);
