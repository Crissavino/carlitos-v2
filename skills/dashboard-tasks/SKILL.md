---
name: dashboard-tasks
description: Manage Kanban tasks from the OpenClaw dashboard. Use when asked to list pending tasks, take/claim a task, save analysis results, complete tasks, or update task status.
---

# Dashboard Tasks Skill

Gestión de tareas del Kanban board de OpenClaw.

## Objetivo

Permitir a OpenClaw:
- Ver tareas pendientes
- Tomar una tarea y trabajar en ella
- Guardar artifacts con resultados de análisis
- Completar tareas y moverlas a review

## Commands

### list
Lista tareas del Kanban. Por defecto muestra backlog y todo.
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js list
```

Filtrar por estados:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js list backlog,todo,in_progress
```

### get
Ver detalle completo de una tarea:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js get <task-id>
```

### take
Tomar una tarea e iniciar una ejecución. Esto:
1. Crea un nuevo "run" en la base de datos
2. Cambia el estado a "in_progress"
3. Agrega un comentario

```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js take <task-id>
```

### artifact
Guardar un artifact con resultados del análisis:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js artifact <task-id> <type> "<name>" "<content>"
```

Tipos de artifact:
- `analysis` - Análisis detallado
- `insight` - Insights y hallazgos
- `data` - Datos crudos o procesados
- `chart` - Datos para gráficos
- `recommendation` - Recomendaciones
- `error` - Errores encontrados

Ejemplo:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js artifact 5 analysis "Análisis de retención" "SRR está en 46.7% debido a..."
```

### complete
Completar una ejecución de tarea:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js complete <task-id> <success|failed> "<output>"
```

Si es `success`, la tarea se mueve a `review`.
Si es `failed`, la tarea vuelve a `todo`.

### comment
Agregar un comentario a una tarea:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js comment <task-id> <mensaje>
```

### status
Cambiar el estado de una tarea directamente:
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js status <task-id> <estado>
```

Estados válidos: `backlog`, `todo`, `in_progress`, `review`, `done`, `archived`

## Workflow Típico

1. **Listar tareas pendientes**
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js list
```

2. **Tomar una tarea**
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js take 5
```

3. **Analizar y guardar resultados**
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js artifact 5 analysis "Diagnóstico SRR" "El SRR bajo se debe a: 1. Usuarios resuelven en primer mes, 2. ..."
```

4. **Completar la tarea**
```bash
node /root/.openclaw/custom-skills/dist/skills/dashboard-tasks/cli.js complete 5 success "Análisis completado. Se identificaron 3 causas principales del bajo SRR."
```

## Output Ejemplo

### list
```
TAREAS DEL KANBAN
═══════════════════════════════════════════════════

Resumen: 3 backlog | 2 todo | 1 en progreso | 0 review | 5 done

Mostrando 5 tarea(s) [backlog, todo]:

📥 #7 🔴 FREEZE ADS - Pausar incrementos [Ads] (rule: frr-red-freeze)
   └─ FRR rojo indica problemas en la conversión de trials...
📥 #6 🟠 DIAGNÓSTICO RETENCIÓN [Retention] (rule: srr-red-diagnose)
📋 #5 🟡 ESCALAR READY [Ads] (rule: frr-cpfr-green-scale)
📋 #4 🟡 OPTIMIZAR MIX [Ads] (rule: roas-yellow-optimize)
📥 #3 🟢 OPERACIÓN NORMAL [Ads] (rule: all-green)
```

### take
```
TAREA ASIGNADA
═══════════════════════════════════════════════════

⚡ #6 🟠 DIAGNÓSTICO RETENCIÓN [Retention] (rule: srr-red-diagnose)

Run ID: 12

Descripción:
───────────────────────────────────────────────────
Investigar causas de baja renovación. SRR en 46.7% (rojo).

Regla origen: srr-red-diagnose

Próximos pasos:
  1. Analizar la tarea
  2. Ejecutar acciones necesarias
  3. Guardar artifacts: node cli.js artifact 6 analysis "Nombre" "Contenido"
  4. Completar: node cli.js complete 6 success "Resultado"

RUN_ID=12
```

## Restricciones

- Solo modifica la base de datos interna de OpenClaw (openclaw_internal)
- No tiene acceso a la base de datos de negocio (avocode) - para eso usar `db-reader`
- Todos los cambios quedan registrados con autor "openclaw"
- Las tareas completadas con éxito van a "review" para validación humana
