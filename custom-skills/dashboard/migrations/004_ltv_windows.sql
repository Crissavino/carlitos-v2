-- ============================================================================
-- Migration 004: Add LTV Window Columns to KPI Snapshots
-- Phase 6.1: LTV/Payback con ventanas correctas
--
-- MODELO DE COBRO (desde acquisition D0):
-- - R1 ventana completa: D21
-- - R2 ventana completa: D51
-- - R3 ventana completa: D81
--
-- DEFINICIÓN LTV:
-- LTV_Nd = (SUM(revenue) - SUM(refunds)) / COUNT(customers_en_cohorte)
-- ============================================================================

-- Add LTV window columns
ALTER TABLE kpi_snapshots
  ADD COLUMN ltv_21d DECIMAL(10,2) DEFAULT NULL
    COMMENT 'LTV ventana R1 completa (21d desde acquisition)'
    AFTER ltv_30d,
  ADD COLUMN ltv_51d DECIMAL(10,2) DEFAULT NULL
    COMMENT 'LTV ventana R2 completa (51d desde acquisition)'
    AFTER ltv_21d,
  ADD COLUMN ltv_81d DECIMAL(10,2) DEFAULT NULL
    COMMENT 'LTV ventana R3 completa (81d desde acquisition)'
    AFTER ltv_51d;

-- Note: ltv_30d remains as intermediate proxy (from Phase 5)
-- Payback ratios are calculated on-the-fly: payback_Nd = ltv_Nd / cpfr
