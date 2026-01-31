# decision-engine

Motor de decisiones que traduce KPIs en acciones concretas. Read-only, explicable, reversible.

## Objetivo

Convertir el estado del negocio (verde/amarillo/rojo) en decisiones claras, no más métricas.

## Matriz de Decisiones

| Condición | Decisión | Prioridad | Área |
|-----------|----------|-----------|------|
| FRR rojo | FREEZE ADS - Pausar incrementos | Critical | Ads |
| FRR rojo | AUDITAR ONBOARDING | High | Onboarding |
| CPFR rojo | NO ESCALAR - Mantener budget | Critical | Ads |
| FRR verde + CPFR verde | ESCALAR READY (+10-20%) | Medium | Ads |
| SRR rojo | DIAGNÓSTICO RETENCIÓN | High | Retention |
| SRR amarillo | MONITOREAR | Medium | Retention |
| ROAS amarillo | OPTIMIZAR MIX | Medium | Ads |
| ROAS rojo | REDUCIR SPEND 20-30% | High | Ads |
| FRR amarillo | ALERTA - No escalar | High | Ads |
| Todo verde | OPERACIÓN NORMAL | Low | Ads |

## Prioridades

- 🔴 **Critical**: Acción inmediata requerida
- 🟠 **High**: Acción esta semana
- 🟡 **Medium**: Considerar próxima semana
- 🟢 **Low**: Informativo

## Tipos de Decisión

- 🛑 **Freeze**: Pausar/detener
- ⛔ **Block**: No permitir
- ✅ **Ready**: Luz verde para acción
- 🔍 **Diagnose**: Requiere investigación
- ⚡ **Optimize**: Ajustar/mejorar
- 👁️ **Monitor**: Solo observar

## Commands

### report
Reporte semanal de decisiones (default).
```bash
node /root/.openclaw/custom-skills/dist/skills/decision-engine/cli.js report
```

### rules
Listar todas las reglas de decisión.
```bash
node /root/.openclaw/custom-skills/dist/skills/decision-engine/cli.js rules
```

### evaluate
Evaluar reglas contra KPIs actuales.
```bash
node /root/.openclaw/custom-skills/dist/skills/decision-engine/cli.js evaluate
```

## Output Ejemplo

```
═══════════════════════════════════════════════════
   DECISIONES RECOMENDADAS – SEMANA 5/2026
═══════════════════════════════════════════════════

Estado del negocio: 🟡 EN RIESGO

KPIs:
  🟢 FRR: 56.1%
  🟢 CPFR: €79
  🔴 SRR: 46.7%
  🟡 Net ROAS: 1.54x

───────────────────────────────────────────────────
ACCIONES RECOMENDADAS:

1. 🔍 DIAGNÓSTICO RETENCIÓN: Investigar causas de baja renovación
   🟠 Prioridad: HIGH
   📊 KPIs: SRR=46.7% (red)
   💡 SRR bajo puede indicar: producto no cumple expectativa,
      pricing no coincide, usuarios resuelven en primer mes.

2. ✅ ESCALAR READY: OK para incrementar spend +10-20%
   🟡 Prioridad: MEDIUM
   📊 KPIs: FRR=56.1% (green), CPFR=€79 (green)
   💡 FRR y CPFR verdes indican adquisición eficiente.

3. ⚡ OPTIMIZAR MIX: Revisar campañas con peor CPA
   🟡 Prioridad: MEDIUM
   📊 KPIs: ROAS=1.54x (yellow)
   💡 ROAS 1.3-2.0x indica margen ajustado.

───────────────────────────────────────────────────
Próxima revisión: 2026-02-08
```

## Restricciones

- Read-only: no ejecuta cambios
- Explicable: cada decisión tiene condición clara y KPIs que la disparan
- Reversible: todas las decisiones son reversibles
- Sin ML: reglas determinísticas
- Sin nuevos KPIs: usa los 5 KPIs de BusinessExpert
