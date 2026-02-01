-- ============================================================================
-- OpenClaw Internal Database - Kanban Enhancements
-- Phase 5B.1: Extended task states + artifacts
-- ============================================================================

-- Add 'review' status to tasks
ALTER TABLE tasks
MODIFY COLUMN status ENUM('backlog', 'todo', 'in_progress', 'review', 'done', 'archived') DEFAULT 'backlog';

-- Add dedupe key for decision engine tasks (rule_id + week)
ALTER TABLE tasks
ADD COLUMN dedupe_key VARCHAR(100) DEFAULT NULL,
ADD UNIQUE KEY unique_dedupe (dedupe_key);

-- Add assignee for future multi-user support
ALTER TABLE tasks
ADD COLUMN assignee VARCHAR(100) DEFAULT NULL;

-- ============================================================================
-- TASK ARTIFACTS (Analysis results, insights, data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_artifacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  run_id INT DEFAULT NULL,

  -- Artifact info
  artifact_type ENUM('analysis', 'insight', 'data', 'chart', 'recommendation', 'error') NOT NULL,
  name VARCHAR(255) NOT NULL,
  content MEDIUMTEXT,      -- JSON or text content
  metadata JSON,           -- Additional structured data

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (run_id) REFERENCES task_runs(id) ON DELETE SET NULL,
  INDEX idx_task (task_id),
  INDEX idx_run (run_id),
  INDEX idx_type (artifact_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TASK GENERATION LOG (Track when tasks were auto-generated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_generation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Generation info
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) NOT NULL,           -- 'decision_engine', 'alert', etc.
  trigger_type VARCHAR(50) NOT NULL,     -- 'weekly', 'daily', 'manual', 'threshold'

  -- Results
  rules_evaluated INT DEFAULT 0,
  tasks_created INT DEFAULT 0,
  tasks_skipped INT DEFAULT 0,           -- Due to dedupe

  -- Context
  business_status VARCHAR(20),
  snapshot_id INT DEFAULT NULL,

  INDEX idx_generated (generated_at DESC),
  INDEX idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
