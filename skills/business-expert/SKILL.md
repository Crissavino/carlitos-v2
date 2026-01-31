# business-expert

Tablero de gobierno del negocio. Calcula 5 KPIs CORE desde la DB para tomar decisiones de inversión en ads.

## 5 KPIs CORE (por prioridad)

| # | KPI | Fórmula | Qué representa |
|---|-----|---------|----------------|
| P1 | FRR | firstRebills / trials | Calidad real de adquisición |
| P2 | CPFR | adSpend / firstRebills | Costo real de adquisición paga |
| P3 | SRR | secondRebills / firstRebillsCohorte30d | Retención al segundo mes |
| P4 | U-R2 | usersWithUsage / firstRebillsCohorte30d | Activación (diagnóstica) |
| P5 | Net ROAS | netRevenue / adSpend | Retorno por euro invertido |

## Jerarquía de Prioridad

- FRR en rojo → negocio CRÍTICO aunque ROAS esté verde
- CPFR en rojo → NO escalar aunque FRR sea bueno
- SRR en rojo → EN RIESGO
- U-R2 es diagnóstica (modelo de necesidad puntual)
- ROAS nunca sobreescribe FRR o CPFR

## Semáforos

**FRR:**
- Verde ≥ 35%
- Amarillo 25%–34%
- Rojo < 25%

**CPFR (vs LTV €150):**
- Verde ≤ €90
- Amarillo ≤ €120
- Rojo > €120

**SRR:**
- Verde ≥ 70%
- Amarillo 55%–69%
- Rojo < 55%

**U-R2 (diagnóstica):**
- Verde ≥ 60%
- Amarillo 45%–59%
- Rojo < 45%

**Net ROAS:**
- Verde ≥ 2.0x
- Amarillo 1.3–1.99x
- Rojo < 1.3x

## Alertas (máximo 2)

1. FRR en rojo → Adquisición de baja calidad
2. CPFR en rojo → Costo de adquisición insostenible

U-R2 NO genera alerta (modelo de necesidad puntual).

## Data Sources

Todo desde DB (avocode + avocodebo):
- **Trials:** subscriptions (trial_started_at, cancelled_during_trial)
- **First/Second Rebills:** invoices (invoice_type_id=2)
- **Revenue:** invoices con conversión a EUR
- **Ad Spend:** avocodebo.ads con conversión a EUR
- **Usage:** documents (create_time)

## Commands

### summary
Resumen ejecutivo tipo CFO (6-8 líneas).
```bash
node /root/.openclaw/custom-skills/dist/skills/business-expert/cli.js summary
```

### kpis
Ver 5 KPIs CORE con semáforos.
```bash
node /root/.openclaw/custom-skills/dist/skills/business-expert/cli.js kpis
```

### alerts
Ver alertas activas.
```bash
node /root/.openclaw/custom-skills/dist/skills/business-expert/cli.js alerts
```

## Output Ejemplo

```
═══════════════════════════════════════════════════
     ESTADO DEL NEGOCIO – ÚLTIMOS 7 DÍAS
═══════════════════════════════════════════════════

En los últimos 7 días, el negocio está ESTABLE.
Revenue neto: €15,284 | Ad Spend: €9,937
Net ROAS: 1.54x (amarillo)
FRR: 56.1% (verde) | CPFR: €79 (verde)
SRR: 46.7% (rojo) [35/75 cohorte 30d]
Riesgo: retención al segundo mes (46.7%) por debajo del objetivo.
Recomendación: Investigar causas de baja retención al segundo mes.
```

## Números Validados (2026-02-01)

| Métrica | Valor |
|---------|-------|
| Trials 7d | 223 |
| First Rebills 7d | 125 |
| First Rebills Cohorte 30d | 75 |
| Second Rebills 7d | 35 |
| Net Revenue EUR | 15,284 |
| Ad Spend EUR | 9,937 |
| FRR | 56% 🟢 |
| CPFR | €79 🟢 |
| SRR | 46.7% 🔴 |
| U-R2 | 1.3% (diagnóstica) |
| Net ROAS | 1.54x 🟡 |

## Restricciones

- Read-only: no ejecuta cambios
- No optimiza campañas automáticamente
- Todo pasa por AuditLog
- Sin ML
- Sin fuentes adicionales
- Sin KPIs extra
