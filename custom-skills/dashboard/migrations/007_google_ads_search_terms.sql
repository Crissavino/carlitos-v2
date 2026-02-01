-- Phase 8B: Search Terms
-- Tabla para almacenar search terms de Google Ads Scripts

CREATE TABLE IF NOT EXISTS google_ads_search_terms (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Search term identification
  search_term VARCHAR(500) NOT NULL,
  keyword_text VARCHAR(500) NOT NULL DEFAULT '',
  match_type VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',

  -- Hierarchy
  campaign_id VARCHAR(50) NOT NULL,
  campaign_name VARCHAR(255) NOT NULL DEFAULT '',
  ad_group_id VARCHAR(50) NOT NULL,
  ad_group_name VARCHAR(255) NOT NULL DEFAULT '',

  -- Temporal window
  date_range VARCHAR(10) NOT NULL,  -- '7d' or '30d'
  metrics_start_date DATE NOT NULL,
  metrics_end_date DATE NOT NULL,

  -- Metrics
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  impressions INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  conversions DECIMAL(10,2) NOT NULL DEFAULT 0,
  conversion_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  ctr DECIMAL(8,6) DEFAULT 0,
  conversion_rate DECIMAL(8,6) DEFAULT 0,

  -- Account info
  account_id VARCHAR(50),
  account_name VARCHAR(255),

  -- Metadata
  ingested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  record_id VARCHAR(50),
  source VARCHAR(50) DEFAULT 'ads-script',

  -- Indexes
  -- Unique based on search term identity within campaign/adgroup/daterange
  UNIQUE KEY uk_search_term_identity (campaign_id, ad_group_id, search_term(100), date_range, metrics_end_date),
  INDEX idx_campaign (campaign_id, date_range),
  INDEX idx_keyword (keyword_text(100)),
  INDEX idx_search_term (search_term(100)),
  INDEX idx_ingested (ingested_at),
  INDEX idx_cost (cost DESC)
);
