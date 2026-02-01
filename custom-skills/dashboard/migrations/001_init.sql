-- ============================================================================
-- OpenClaw Internal Database - Initial Schema
-- Phase 5A.2: Separate DB for dashboard, tasks, learning
--
-- Database: openclaw_internal (isolated from core business DB)
--
-- ADMIN SETUP (run as MySQL root/admin ONCE):
--   CREATE DATABASE IF NOT EXISTS openclaw_internal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   CREATE USER IF NOT EXISTS 'openclaw_admin'@'%' IDENTIFIED BY 'your-secure-password';
--   GRANT ALL PRIVILEGES ON openclaw_internal.* TO 'openclaw_admin'@'%';
--   FLUSH PRIVILEGES;
--
-- Then run this migration:
--   mysql -h HOST -u openclaw_admin -p openclaw_internal < 001_init.sql
-- ============================================================================

-- ============================================================================
-- KPI SNAPSHOTS (Historical data for graphs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  snapshot_date DATE NOT NULL,

  -- Business status from BusinessExpert
  business_status VARCHAR(20) NOT NULL,  -- healthy, warning, critical, unknown

  -- Core KPIs
  frr DECIMAL(5,4),           -- First Rebill Rate (0.0000 - 1.0000)
  cpfr DECIMAL(10,2),         -- Cost Per First Rebill (EUR)
  srr DECIMAL(5,4),           -- Second Rebill Rate (0.0000 - 1.0000)
  ur2 DECIMAL(5,4),           -- Usage Rate before R2 (0.0000 - 1.0000)
  net_roas DECIMAL(6,3),      -- Net ROAS (e.g., 1.250 = 125%)

  -- Raw metrics snapshot
  trials INT DEFAULT 0,
  first_rebills INT DEFAULT 0,
  first_rebills_cohorte_30d INT DEFAULT 0,
  second_rebills INT DEFAULT 0,
  active_subscriptions INT DEFAULT 0,

  -- Financials (EUR)
  ad_spend_eur DECIMAL(12,2) DEFAULT 0.00,
  net_revenue_eur DECIMAL(12,2) DEFAULT 0.00,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_date (snapshot_date),
  INDEX idx_date_range (snapshot_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- TASKS (Kanban board)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Kanban
  status ENUM('backlog', 'todo', 'in_progress', 'done', 'archived') DEFAULT 'backlog',
  priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',

  -- Origin
  source ENUM('decision_engine', 'manual', 'alert', 'learning') DEFAULT 'manual',
  decision_rule_id VARCHAR(50) DEFAULT NULL,

  -- Categorization
  area VARCHAR(50) DEFAULT NULL,  -- marketing, product, operations, finance
  due_date DATE DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,

  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_source (source),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- TASK COMMENTS (Discussion & notes on tasks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,

  -- Content
  comment TEXT NOT NULL,
  author VARCHAR(100) DEFAULT 'system',  -- 'system', 'openclaw', 'user:name'

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task (task_id),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- TASK RUNS (Execution history - when OpenClaw works on a task)
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,

  -- Execution info
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  status ENUM('running', 'success', 'failed', 'cancelled') DEFAULT 'running',

  -- Results
  output TEXT,           -- Summary of what was done
  error_message TEXT,    -- If failed
  changes_made JSON,     -- Structured log of changes: files modified, API calls, etc.

  -- Metrics
  duration_ms INT DEFAULT NULL,
  tokens_used INT DEFAULT NULL,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task (task_id),
  INDEX idx_status (status),
  INDEX idx_started (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- TASK ARTIFACTS (Future: learning & knowledge capture)
-- Placeholder for Phase 6+
-- ============================================================================

-- CREATE TABLE IF NOT EXISTS task_artifacts (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   task_id INT NOT NULL,
--   run_id INT DEFAULT NULL,
--
--   artifact_type ENUM('file', 'snippet', 'insight', 'metric', 'screenshot') NOT NULL,
--   name VARCHAR(255) NOT NULL,
--   content MEDIUMTEXT,
--   metadata JSON,
--
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--
--   FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
--   FOREIGN KEY (run_id) REFERENCES task_runs(id) ON DELETE SET NULL,
--   INDEX idx_task (task_id),
--   INDEX idx_type (artifact_type)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
