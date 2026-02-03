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
  isInformative?: boolean;  // If true, KPI does not trigger alerts (context only)
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

  /**
   * P6 - LTV 30 días (proxy intermedio)
   * LTV_30d = (SUM(revenue) - SUM(refunds)) / COUNT(customers)
   * NOTA: Solo proxy, no usar para decisiones fuertes.
   */
  ltv30d: KpiResult;

  /**
   * P7 - Payback Ratio 30d (proxy)
   * PaybackRatio = LTV_30d / CPFR
   * NOTA: Solo proxy, no usar para decisiones fuertes.
   */
  paybackRatio: KpiResult;

  // ============================================================================
  // LTV/PAYBACK CON VENTANAS CORRECTAS (Phase 6.1)
  // Basadas en modelo de cobro real:
  // - R1 ventana completa: D21
  // - R2 ventana completa: D51
  // - R3 ventana completa: D81
  // ============================================================================

  /**
   * LTV 21 días (R1 completo)
   * Para warning temprano. NUNCA decisiones fuertes.
   */
  ltv21d: KpiResult;

  /**
   * Payback 21d = LTV_21d / CPFR
   * Solo para warning/monitor. NUNCA freeze/pause/stop.
   */
  payback21d: KpiResult;

  /**
   * LTV 51 días (R2 completo)
   * Para decisiones fuertes (pause/scale).
   */
  ltv51d: KpiResult;

  /**
   * Payback 51d = LTV_51d / CPFR
   * Base para decisiones de ads.
   * < 1.0 → pause, >= 1.5 → scale
   */
  payback51d: KpiResult;

  /**
   * LTV 81 días (R3 completo) - opcional
   * Para análisis estratégico.
   */
  ltv81d?: KpiResult;

  /**
   * Payback 81d = LTV_81d / CPFR - opcional
   */
  payback81d?: KpiResult;

  // ============================================================================
  // UTILITY MODEL KPIs (Phase 9 + Phase 11 FIX)
  // El negocio se gana o pierde en M1
  // ============================================================================

  /**
   * P1 HEADLINE - Payback M1 (COHORT-BASED)
   *
   * Phase 11 FIX: Ahora usa datos de COHORTE, no cashflow.
   * Cohorte: Clientes adquiridos 30-60 días atrás.
   *
   * PaybackM1 = (Trial_Revenue + First_Rebill_Revenue - Refunds_M1) / Ad_Spend
   * TODOS los componentes de la MISMA cohorte de adquisición.
   *
   * PROHIBIDO mezclar revenue histórico con gasto reciente.
   */
  paybackM1: KpiResult;

  /**
   * P2 - Refund Rate M1 (COHORT-BASED)
   * RefundRateM1 = Refunds_M1 / First_Rebill_Revenue (de la cohorte)
   */
  refundRateM1: KpiResult;

  /**
   * P3 - CPT (Cost Per Trial)
   * CPT = Ad_Spend / Trials
   * Contexto, no genera alertas fuertes.
   */
  cpt: KpiResult;

  /**
   * INFORMATIVO - Cashflow Coverage 7d (ex-Payback M1 cashflow)
   *
   * DEPRECATED para decisiones. Solo informativo.
   * Calcula: (Trial_Revenue + First_Rebill - Refunds) / CPFR
   * PERO mezcla ventanas incompatibles (cualquier cohorte).
   *
   * NO usar para business status ni alertas.
   */
  cashflowCoverage7d?: KpiResult;
}

// ============================================================================
// THRESHOLDS (SEMÁFOROS)
// ============================================================================

export const THRESHOLDS = {
  // FRR: First Rebill Rate
  FRR_GREEN: 0.35, // ≥ 35%
  FRR_YELLOW: 0.25, // 25%–34%
  // < 25% = red

  // CPFR: Cost per First Rebill
  // Ahora se valida contra LTV real, no TARGET_LTV
  // Verde: CPFR < LTV * 0.6 (Payback > 1.67)
  // Amarillo: CPFR < LTV * 0.8 (Payback > 1.25)
  // Rojo: CPFR >= LTV * 0.8 (Payback <= 1.25)
  TARGET_LTV: 150, // EUR - fallback si no hay LTV real
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

  // Payback Ratio (LTV / CPFR) - proxy 30d
  PAYBACK_GREEN: 1.5, // ≥ 1.5x (rentable)
  PAYBACK_YELLOW: 1.0, // 1.0–1.49x (break-even)
  // < 1.0x = red (pérdida)

  // ============================================================================
  // PAYBACK VENTANAS CORRECTAS (Phase 6.1)
  // ============================================================================

  // Payback 21d (solo warning, nunca decisiones fuertes)
  PAYBACK_21D_WARNING: 0.5, // < 0.5 → warning temprano

  // Payback 51d (decisiones fuertes)
  PAYBACK_51D_PAUSE: 1.0,   // < 1.0 → pause ads
  PAYBACK_51D_SCALE: 1.5,   // >= 1.5 → scale ready

  // Minimum cohort age for decisions
  MIN_AGE_WARNING: 21,      // Días mínimos para warning
  MIN_AGE_DECISION: 51,     // Días mínimos para decisiones fuertes

  // ============================================================================
  // PAYBACK M1 (Utility Model - Phase 9)
  // El negocio se gana o pierde en M1
  // ============================================================================

  // Payback M1 = (Trial Revenue + First Rebill Revenue - Refunds M1) / CPFR
  PAYBACK_M1_GREEN: 1.20,   // >= 1.20x es verde (rentable en M1)
  PAYBACK_M1_YELLOW: 0.90,  // 0.90 - 1.19x es amarillo
  // < 0.90x es rojo

  // Refund Rate M1 = Refunds before M2 / First Rebills
  // Ajustado para modelo utility
  REFUND_RATE_M1_GREEN: 0.08,   // <= 8% es verde
  REFUND_RATE_M1_YELLOW: 0.15,  // 8% - 15% es amarillo
  // > 15% es rojo (CRÍTICO)

  // CPT = Ad Spend / Trials (contexto, no alertas fuertes)
  CPT_GREEN: 30,    // <= €30 es verde
  CPT_YELLOW: 50,   // €30 - €50 es amarillo
  // > €50 es rojo
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

  // HARDENING: Required website_id - no global metrics
  websiteId: number;

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

  // LTV 30d (proxy intermedio)
  ltv30d: number;
  ltv30dSampleSize: number;

  // LTV ventanas correctas (Phase 6.1)
  ltv21d: number;           // Ventana R1 completa
  ltv21dCohortSize: number;
  ltv51d: number;           // Ventana R2 completa
  ltv51dCohortSize: number;
  ltv81d?: number;          // Ventana R3 completa (opcional)
  ltv81dCohortSize?: number;

  // Utility Model (Phase 9) - DEPRECATED for Payback M1, used for Cashflow Coverage only
  trialRevenueEur: number;        // SUM(invoices) WHERE invoice_type_id = 1 (CASHFLOW - last 7d)
  firstRebillRevenueEur: number;  // SUM(invoices) WHERE invoice_type_id = 2 AND es primer rebill (CASHFLOW)
  refundsM1Eur: number;           // SUM(refunds) WHERE fecha_refund < fecha_R2 (CASHFLOW)

  // Phase 11: Payback M1 Cohort (FIX - real cohort-based calculation)
  // Cohorte 30-60 días atrás (M1 completado)
  paybackM1Cohort?: {
    cohortSize: number;           // Customers en la cohorte
    firstRebills: number;         // First rebills de la cohorte
    trialRevenueEur: number;      // Trial revenue de la cohorte
    firstRebillRevenueEur: number; // First rebill revenue de la cohorte
    refundsM1Eur: number;         // Refunds M1 de la cohorte
    m1NetRevenueEur: number;      // Trial + FirstRebill - Refunds de la cohorte
    adSpendEur: number;           // Ad spend de la misma ventana (30-60d ago)
    paybackM1: number;            // m1NetRevenueEur / adSpendEur
    cpfrCohort: number;           // adSpendEur / firstRebills
  };
}

// ============================================================================
// ALERTS (SOLO 2 - U-R2 es diagnóstica)
// ============================================================================

export type AlertType = "frr_red" | "cpfr_red" | "payback_red" | "refund_m1_red";

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
  grossRevenueEur: number;
  netRevenueEur: number;
  adSpendEur: number;

  // Acquisition data (for funnel visualization)
  acquisitionData: {
    trials: number;
    firstRebills: number;
  };

  // Refunds M1 (for funnel visualization)
  refundsM1Total: number;

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
