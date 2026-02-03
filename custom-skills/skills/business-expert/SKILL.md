# Business Expert - Modelo UTILITY

## Contexto del Negocio

Este skill analiza un negocio de **UTILITY SITES** (herramientas PDF), **NO SaaS tradicional**:

- Trial corto (24-48h) → subscription ~€40/mes
- Usuarios con problema puntual → usa 1 vez → se va
- M2 es estructuralmente difícil (no es churn evitable)
- **El negocio gana plata con M1, M2+ es bonus**

### Datos Reales del Negocio

| Métrica | ConversiePDF (RO/PL) | ConviertePDF (CL/BR) |
|---------|---------------------|----------------------|
| FRR real | ~50% | ~40% |
| SRR real | ~45-50% | ~45-50% |
| Profit mensual | ~€25-30k | Variable |

## Jerarquía de KPIs

### P0 - Weekly Profit (HEADLINE)

**El indicador más importante.** Si hay profit, el negocio está bien.

```
Weekly Profit = Net Revenue (7d) - Ad Spend (7d) - €250 (costos fijos)
```

| Estado | Threshold |
|--------|-----------|
| Verde | > €5,000/semana |
| Amarillo | €2,500 - €5,000 |
| Rojo | < €2,500 |

### P1 - Payback M1 (Cohort-based)

Rentabilidad del primer mes por cohorte.

```
Payback M1 = M1_Net_Revenue (cohorte) / Ad_Spend (cohorte)
```

| Estado | Threshold |
|--------|-----------|
| Verde | ≥ 1.20x |
| Amarillo | 0.90 - 1.19x |
| Rojo | < 0.90x |

### P2 - FRR (First Rebill Rate)

Calidad de adquisición. **Thresholds varían por mercado.**

| Website | Verde | Amarillo | Rojo |
|---------|-------|----------|------|
| ConversiePDF (1) | ≥ 45% | 35-44% | < 35% |
| ConviertePDF (3) | ≥ 35% | 25-34% | < 25% |
| DeviceFinder (4) | ≥ 35% | 25-34% | < 25% |

### P3 - CPFR (Cost Per First Rebill)

Costo de adquisición. **Thresholds varían por mercado.**

| Website | Verde | Amarillo | Rojo |
|---------|-------|----------|------|
| ConversiePDF (1) | ≤ €60 | ≤ €80 | > €80 |
| ConviertePDF (3) | ≤ €100 | ≤ €130 | > €130 |
| DeviceFinder (4) | ≤ €80 | ≤ €100 | > €100 |

### P4 - Net ROAS

Eficiencia del gasto en ads.

| Estado | Threshold |
|--------|-----------|
| Verde | ≥ 1.5x |
| Amarillo | 1.2 - 1.49x |
| Rojo | < 1.2x |

### P5 - Refund Rate M1

Tasa de refunds en el primer mes.

| Estado | Threshold |
|--------|-----------|
| Verde | ≤ 8% |
| Amarillo | 8% - 15% |
| Rojo | > 15% |

## KPIs Informativos (Sin Alertas)

### SRR (Second Rebill Rate)

**NO genera alertas.** SRR ~45-50% es **estructural** en modelo utility, no un problema.

- Los usuarios resuelven su problema en M1 y no necesitan M2
- No confundir con churn de SaaS (ese sí es problema)

### U-R2 (Usage Before Rebill 2)

Métrica diagnóstica. Bajo uso antes de R2 es esperado en utility.

### Payback 30d/51d/81d

Métricas legacy. Reemplazadas por Payback M1.

## Jerarquía de Alertas

| Prioridad | Alerta | Acción |
|-----------|--------|--------|
| 1 | Weekly Profit rojo | **CRÍTICO** - El negocio pierde plata |
| 2 | FRR rojo | **CRÍTICO** - Revisar fuentes de tráfico |
| 3 | CPFR rojo | **NO ESCALAR** - Optimizar antes de crecer |
| 4 | ROAS rojo | **OPTIMIZAR** - Ajustar campañas |
| 5 | Payback M1 rojo | Pérdida en M1, revisar adquisición |
| 6 | Refund Rate M1 rojo | Revisar calidad producto/tráfico |
| - | SRR | **NUNCA** - Es estructural |

## Estado del Negocio

### ESTABLE

- Weekly Profit ≥ €5,000/semana, O
- Payback M1 ≥ 1.20x

### EN RIESGO

- Weekly Profit €2,500 - €5,000, O
- Payback M1 0.90 - 1.19x, O
- Refund Rate M1 8% - 15%

### CRÍTICO

- Weekly Profit < €2,500, O
- Payback M1 < 0.90x, O
- Refund Rate M1 > 15%

## Archivos Principales

| Archivo | Propósito |
|---------|-----------|
| `types.ts` | Thresholds y definiciones de KPIs |
| `analyzers/cross-analyzer.ts` | Cálculo de KPIs y estado del negocio |
| `analyzers/revenue-analyzer.ts` | Queries de revenue y métricas |

## Notas Importantes

1. **SRR bajo NO es un problema** - Es estructural en utility
2. **Weekly Profit > otros KPIs** - Si hay profit, el negocio está bien
3. **Thresholds por mercado** - RO/PL vs CL/BR tienen diferentes benchmarks
4. **M2+ es bonus** - El negocio se gana o pierde en M1
