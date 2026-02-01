-- ============================================================================
-- Migration 003: Add LTV to KPI Snapshots
-- Phase 5A Extension: LTV como KPI core
--
-- LTV_30d es el valor primario para decisiones de ads
-- Payback Ratio = LTV_30d / CPFR (debe ser > 1.0 para rentabilidad)
-- ============================================================================

-- Add LTV column after net_roas
ALTER TABLE kpi_snapshots
  ADD COLUMN ltv_30d DECIMAL(10,2) DEFAULT NULL
  COMMENT 'Lifetime Value 30d en EUR - para decisiones de ads'
  AFTER net_roas;

-- Add Payback Ratio as computed metric (optional, can be calculated on the fly)
-- ALTER TABLE kpi_snapshots
--   ADD COLUMN payback_ratio DECIMAL(6,3)
--   GENERATED ALWAYS AS (CASE WHEN cpfr > 0 THEN ltv_30d / cpfr ELSE NULL END) STORED
--   COMMENT 'LTV/CPFR ratio - debe ser > 1.0'
--   AFTER ltv_30d;
