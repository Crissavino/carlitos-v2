-- ============================================================================
-- Migration 005: KPIs by Website
-- Phase 11: Currency Hardening - Separate KPIs by website_id
--
-- RATIONALE:
-- - Jackcode (website_id=1) and KiwiKode (website_id=3) have different currencies
-- - Mixing EUR and RON in global KPIs produces invalid metrics
-- - Each website should have independent KPI tracking
--
-- CHANGES:
-- 1. Add website_id column to kpi_snapshots
-- 2. Update unique key to include website_id
-- 3. Add baseline_post_reset flag for tracking data quality reset points
-- ============================================================================

-- Add website_id column (nullable for backward compatibility)
ALTER TABLE kpi_snapshots
ADD COLUMN website_id INT DEFAULT NULL AFTER snapshot_date,
ADD COLUMN baseline_post_reset BOOLEAN DEFAULT FALSE AFTER ad_spend_eur;

-- Update unique key to include website_id
ALTER TABLE kpi_snapshots
DROP INDEX unique_date;

ALTER TABLE kpi_snapshots
ADD UNIQUE KEY unique_date_website (snapshot_date, website_id);

-- Add index for website queries
ALTER TABLE kpi_snapshots
ADD INDEX idx_website (website_id);

-- Add comment explaining website mapping
-- website_id values (from avocodebo.websites):
-- 1 = Jackcode (EUR) - Account 338-426-8994
-- 3 = KiwiKode (RON) - Account 502-581-1084
