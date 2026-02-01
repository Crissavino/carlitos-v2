-- ============================================================================
-- OpenClaw Internal Database - Admin Setup
--
-- RUN THIS AS MySQL ROOT/ADMIN (one-time setup)
--
-- Usage:
--   mysql -h 13.49.227.149 -u root -p < 000_setup_db.sql
--
-- After this, run 001_init.sql as openclaw_admin
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS openclaw_internal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create user (change password!)
CREATE USER IF NOT EXISTS 'openclaw_admin'@'%' IDENTIFIED BY 'CHANGE_THIS_PASSWORD';

-- Grant full access ONLY to openclaw_internal
GRANT ALL PRIVILEGES ON openclaw_internal.* TO 'openclaw_admin'@'%';

-- No access to other databases
-- (User is created with no default privileges)

FLUSH PRIVILEGES;

-- Verify
SELECT User, Host FROM mysql.user WHERE User = 'openclaw_admin';
SHOW GRANTS FOR 'openclaw_admin'@'%';
