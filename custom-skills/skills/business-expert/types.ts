/**
 * BusinessExpert - Types
 *
 * 5 KPIs CORE de gobierno del negocio.
 * Jerarquía de prioridad: FRR > CPFR > SRR > U-R2 > Net ROAS
 *
 * NOTA: U-R2 es métrica diagnóstica, no alerta crítica.
 * El modelo de negocio es de necesidad puntual, no uso recurrente.
 */

export type Period = "LAST_7_DAYS" | "LAST_30_DAYS";
export type KpiStatus = "green" | "yellow" | "red";
export type BusinessStatus = "ESTABLE" | "EN RIESGO" | "CRÍTICO";

// ============================================================================
// KPI CORE DEFINITIONS
// ============================================================================

export interface KpiResult {
  value: number;
  status: KpiStatus;
  shortReason: string;
}

export interface CoreKpis {
  /**
   * P1 - First Rebill Rate (FRR)
   * FRR = firstRebills / trials
   * Representa calidad real de adquisición.
   */
  frr: KpiResult;

  /**
   * P2 - Cost per First Rebill (CPFR)
   * CPFR = totalAdSpend / firstRebills
   * Representa el costo real de adquisición paga.
   */
  cpfr: KpiResult;

  /**
   * P3 - Second Rebill Rate (SRR)
   * SRR = secondRebills / firstRebillsCohorte30d
   * Representa estabilidad y retención temprana.
   * Usa cohorte de 30-37 días para comparación correcta.
   */
  srr: KpiResult;

  /**
   * P4 - Usage before Rebill 2 (U-R2)
   * U-R2 = usersWithUsageBeforeRebill2 / firstRebillsCohorte30d
   * Representa activación real del producto.
   * NOTA: Métrica diagnóstica, NO alerta crítica.
   */
  ur2: KpiResult;

  /**
   * P5 - Net ROAS Real
   * NetROAS = netRevenue / totalAdSpend
   * Revenue real desde DB (refunds incluidos).
   */
  netRoas: KpiResult;
}

// ============================================================================
// THRESHOLDS (SEMÁFOROS)
// ============================================================================

export const THRESHOLDS = {
  // FRR: First Rebill Rate
  FRR_GREEN: 0.35, // ≥ 35%
  FRR_YELLOW: 0.25, // 25%–34%
  // < 25% = red

  // CPFR: Cost per First Rebill (requires target LTV)
  // Verde ≤ target_LTV * 0.6
  // Amarillo ≤ target_LTV * 0.8
  // Rojo > target_LTV * 0.8
  TARGET_LTV: 150, // EUR - configurable
  CPFR_GREEN_FACTOR: 0.6,
  CPFR_YELLOW_FACTOR: 0.8,

  // SRR: Second Rebill Rate
  SRR_GREEN: 0.70, // ≥ 70%
  SRR_YELLOW: 0.55, // 55%–69%
  // < 55% = red

  // U-R2: Usage before Rebill 2 (diagnóstica, no alerta)
  UR2_GREEN: 0.60, // ≥ 60%
  UR2_YELLOW: 0.45, // 45%–59%
  // < 45% = red

  // Net ROAS Real
  ROAS_GREEN: 2.0, // ≥ 2.0x
  ROAS_YELLOW: 1.3, // 1.3–1.99x
  // < 1.3x = red
} as const;

// Derived thresholds for CPFR
export const CPFR_GREEN = THRESHOLDS.TARGET_LTV * THRESHOLDS.CPFR_GREEN_FACTOR; // 90 EUR
export const CPFR_YELLOW = THRESHOLDS.TARGET_LTV * THRESHOLDS.CPFR_YELLOW_FACTOR; // 120 EUR

// ============================================================================
// INPUT DATA (from DBReader)
// ============================================================================

export interface RawMetrics {
  period: Period;
  generatedAt: string;

  // From DBReader
  trials: number;
  firstRebills: number;
  firstRebillsCohorte30d: number; // Para SRR y U-R2
  secondRebills: number;
  usersWithUsageBeforeRebill2: number;
  netRevenueEur: number;
  subscriptionEur: number;
  refundsEur: number;
  activeSubscriptions: number;

  // From DBReader (avocodebo.ads)
  totalAdSpendEur: number;
}

// ============================================================================
// ALERTS (SOLO 2 - U-R2 es diagnóstica)
// ============================================================================

export type AlertType = "frr_red" | "cpfr_red";

export interface Alert {
  type: AlertType;
  severity: "critical";
  message: string;
}

// ============================================================================
// EXECUTIVE SUMMARY OUTPUT
// ============================================================================

export interface ExecutiveSummary {
  period: Period;
  generatedAt: string;

  // Estado general
  businessStatus: BusinessStatus;

  // Datos clave
  netRevenueEur: number;
  adSpendEur: number;

  // 5 KPIs CORE
  kpis: CoreKpis;

  // Alertas (máximo 2)
  alerts: Alert[];

  // Resumen ejecutivo (texto corto)
  summaryText: string;
}

// ============================================================================
// KPI HIERARCHY (para resolución de conflictos)
// ============================================================================

export const KPI_PRIORITY = {
  frr: 1, // Máxima prioridad
  cpfr: 2,
  srr: 3,
  ur2: 4, // Diagnóstica
  netRoas: 5, // Mínima prioridad
} as const;
