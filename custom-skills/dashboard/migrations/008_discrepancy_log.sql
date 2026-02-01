-- Phase 8C: Discrepancy Log
-- Track false positives, false negatives, and late signals during production-assisted mode

CREATE TABLE IF NOT EXISTS discrepancy_log (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Classification
  discrepancy_type ENUM('false_positive', 'false_negative', 'late_signal', 'data_issue', 'other') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',

  -- Context
  entity_type ENUM('campaign', 'keyword', 'search_term', 'kpi', 'decision', 'recommendation') NOT NULL,
  entity_id VARCHAR(100),  -- campaign_id, keyword_id, etc.
  entity_name VARCHAR(255),

  -- What happened
  system_recommendation VARCHAR(100),  -- What OpenClaw recommended
  actual_outcome VARCHAR(100),         -- What should have happened
  description TEXT NOT NULL,           -- Detailed explanation

  -- Impact
  spend_involved DECIMAL(12,2) DEFAULT 0,
  days_delayed INT DEFAULT 0,          -- For late signals

  -- Resolution
  status ENUM('open', 'investigating', 'resolved', 'wont_fix') NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_at DATETIME,

  -- Metadata
  reported_by VARCHAR(50) DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_type (discrepancy_type),
  INDEX idx_status (status),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at DESC)
);

-- Summary view for quick stats
CREATE OR REPLACE VIEW discrepancy_summary AS
SELECT
  discrepancy_type,
  status,
  COUNT(*) as count,
  SUM(spend_involved) as total_spend_involved,
  AVG(days_delayed) as avg_days_delayed
FROM discrepancy_log
GROUP BY discrepancy_type, status;
