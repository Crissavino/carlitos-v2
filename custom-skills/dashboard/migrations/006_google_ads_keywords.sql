-- Migration 006: Google Ads Keywords Metrics
-- Phase 8A: Store keyword data from Google Ads Scripts
--
-- This table is the SOURCE OF TRUTH for KEYWORD COST.
-- Attribution and revenue come from avocode tables (Phase 8B+ if needed).
--
-- NOTE: keyword_id is NOT stable long-term in Google Ads.
-- Use the composite key (campaign_id, ad_group_id, keyword_text, match_type) for identity.

CREATE TABLE IF NOT EXISTS google_ads_keyword_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Keyword identification
  keyword_id VARCHAR(50) NOT NULL COMMENT 'Google Ads Keyword ID (may change)',
  keyword_text VARCHAR(500) NOT NULL COMMENT 'The actual keyword text',
  match_type VARCHAR(20) NOT NULL COMMENT 'EXACT, PHRASE, or BROAD',

  -- Hierarchy
  campaign_id VARCHAR(50) NOT NULL COMMENT 'Parent campaign ID',
  campaign_name VARCHAR(255) COMMENT 'Campaign name (informational)',
  ad_group_id VARCHAR(50) NOT NULL COMMENT 'Parent ad group ID',
  ad_group_name VARCHAR(255) COMMENT 'Ad group name (informational)',

  -- Temporal window (logical time, NOT ingested_at)
  date_range VARCHAR(10) NOT NULL COMMENT '7d or 30d',
  metrics_start_date DATE NOT NULL COMMENT 'Start of metrics window',
  metrics_end_date DATE NOT NULL COMMENT 'End of metrics window',

  -- Cost metrics from Google Ads Script
  cost DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Total cost in original currency',
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  conversions DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Google-reported conversions',
  conversion_value DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Google-reported conversion value',
  ctr DECIMAL(8,6) DEFAULT 0 COMMENT 'Click-through rate (0-1)',
  cpc DECIMAL(10,4) DEFAULT 0 COMMENT 'Cost per click',
  conversion_rate DECIMAL(8,6) DEFAULT 0 COMMENT 'Conversions / clicks (0-1)',

  -- Account info
  account_id VARCHAR(50) COMMENT 'Google Ads Account ID',
  account_name VARCHAR(255) COMMENT 'Google Ads Account Name',

  -- Technical metadata
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_id VARCHAR(50) COMMENT 'UUID from ingest',
  source VARCHAR(50) DEFAULT 'ads-script' COMMENT 'Data source identifier',

  -- Indexes for efficient queries
  -- NOTE: keyword_id is NOT stable, use composite key for identity
  UNIQUE KEY uk_keyword_identity (campaign_id, ad_group_id, keyword_text(100), match_type, date_range, metrics_end_date),
  INDEX idx_keyword_id (keyword_id),
  INDEX idx_campaign (campaign_id, date_range),
  INDEX idx_ad_group (ad_group_id, date_range),
  INDEX idx_keyword_text (keyword_text(100)),
  INDEX idx_ingested (ingested_at),
  INDEX idx_match_type (match_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for getting latest metrics per keyword
CREATE INDEX idx_latest_keyword_metrics ON google_ads_keyword_metrics (keyword_id, date_range, ingested_at DESC);

-- Index for cost analysis (finding high-spend keywords)
CREATE INDEX idx_cost_analysis ON google_ads_keyword_metrics (date_range, cost DESC, conversions);
