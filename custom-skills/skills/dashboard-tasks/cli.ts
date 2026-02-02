/**
 * Dashboard Tasks CLI
 *
 * Entry point for OpenClaw skill invocation.
 * Allows OpenClaw to interact with the Kanban board.
 *
 * Commands:
 *   list       - List pending tasks (backlog, todo)
 *   take <id>  - Claim a task and start working on it
 *   complete <id> <status> [output] - Complete a task run
 *   artifact <id> <type> <name> <content> - Save an artifact
 *   comment <id> <message> - Add a comment to a task
 *   status <id> <status> - Change task status
 */

import {
  getTasks,
  getTaskById,
  updateTask,
  createTask,
  startRun,
  completeRun,
  createArtifact,
  addComment,
  getKanbanSummary,
  closePool,
  type Task,
  type TaskStatus,
  type ArtifactType,
  type TaskPriority,
} from "../../dashboard/db.js";

const PRIORITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const STATUS_ICONS: Record<string, string> = {
  backlog: "📥",
  todo: "📋",
  in_progress: "⚡",
  review: "👁️",
  done: "✅",
  archived: "📦",
};

function formatTask(task: Task): string {
  const priority = PRIORITY_ICONS[task.priority] || "⚪";
  const status = STATUS_ICONS[task.status] || "❓";
  const area = task.area ? ` [${task.area}]` : "";
  const rule = task.decision_rule_id ? ` (rule: ${task.decision_rule_id})` : "";

  return `${status} #${task.id} ${priority} ${task.title}${area}${rule}`;
}

async function listTasks(statusFilter?: string) {
  const statuses = statusFilter
    ? (statusFilter.split(",") as TaskStatus[])
    : (["backlog", "todo"] as TaskStatus[]);

  const tasks = await getTasks({ status: statuses });
  const summary = await getKanbanSummary();

  console.log("TAREAS DEL KANBAN");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`Resumen: ${summary.backlog} backlog | ${summary.todo} todo | ${summary.in_progress} en progreso | ${summary.review} review | ${summary.done} done`);
  console.log("");

  if (tasks.length === 0) {
    console.log("✅ No hay tareas pendientes");
  } else {
    console.log(`Mostrando ${tasks.length} tarea(s) [${statuses.join(", ")}]:`);
    console.log("");

    for (const task of tasks) {
      console.log(formatTask(task));
      if (task.description) {
        const shortDesc = task.description.length > 80
          ? task.description.substring(0, 80) + "..."
          : task.description;
        console.log(`   └─ ${shortDesc}`);
      }
    }
  }
}

async function takeTask(taskId: number) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  // Start a run
  const runId = await startRun(taskId);

  // Update status to in_progress
  await updateTask(taskId, { status: "in_progress" });

  // Add comment
  await addComment(taskId, "OpenClaw ha comenzado a trabajar en esta tarea", "openclaw");

  console.log("TAREA ASIGNADA");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(formatTask({ ...task, status: "in_progress" }));
  console.log("");
  console.log(`Run ID: ${runId}`);
  console.log("");

  if (task.description) {
    console.log("Descripción:");
    console.log("───────────────────────────────────────────────────");
    console.log(task.description);
    console.log("");
  }

  if (task.decision_rule_id) {
    console.log(`Regla origen: ${task.decision_rule_id}`);
  }

  console.log("");
  console.log("Próximos pasos:");
  console.log("  1. Analizar la tarea");
  console.log("  2. Ejecutar acciones necesarias");
  console.log(`  3. Guardar artifacts: node cli.js artifact ${taskId} analysis "Nombre" "Contenido"`);
  console.log(`  4. Completar: node cli.js complete ${taskId} success "Resultado"`);

  // Return run_id for subsequent operations
  console.log("");
  console.log(`RUN_ID=${runId}`);
}

async function completeTask(taskId: number, status: "success" | "failed", output?: string) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  // Get the latest running run for this task
  const db = (await import("../../dashboard/db.js")).getPool();
  const [rows] = await db.execute(
    "SELECT id FROM task_runs WHERE task_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1",
    [taskId]
  );

  const runRow = (rows as Array<{ id: number }>)[0];
  if (!runRow) {
    console.error(`Error: No hay una ejecución activa para la tarea #${taskId}`);
    console.error("Usa 'take' primero para iniciar una ejecución.");
    process.exit(1);
  }

  const runId = runRow.id;

  // Complete the run
  await completeRun(runId, status, output);

  // Update task status based on result
  if (status === "success") {
    await updateTask(taskId, { status: "review" });
    await addComment(taskId, `Ejecución completada. Movida a review.\n\nResultado:\n${output || "(sin output)"}`, "openclaw");
  } else {
    await updateTask(taskId, { status: "todo" });
    await addComment(taskId, `Ejecución fallida. Movida de vuelta a todo.\n\nError:\n${output || "(sin detalles)"}`, "openclaw");
  }

  const icon = status === "success" ? "✅" : "❌";
  const newStatus = status === "success" ? "review" : "todo";

  console.log(`${icon} TAREA COMPLETADA`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(formatTask({ ...task, status: newStatus as TaskStatus }));
  console.log(`Run #${runId}: ${status}`);
  if (output) {
    console.log("");
    console.log("Output:");
    console.log("───────────────────────────────────────────────────");
    console.log(output);
  }
}

async function saveArtifact(
  taskId: number,
  artifactType: ArtifactType,
  name: string,
  content: string
) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  // Get latest run ID
  const db = (await import("../../dashboard/db.js")).getPool();
  const [rows] = await db.execute(
    "SELECT id FROM task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 1",
    [taskId]
  );

  const runRow = (rows as Array<{ id: number }>)[0];

  const artifactId = await createArtifact({
    task_id: taskId,
    run_id: runRow?.id,
    artifact_type: artifactType,
    name,
    content,
  });

  console.log(`✅ ARTIFACT GUARDADO`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`Artifact #${artifactId}`);
  console.log(`Tarea: #${taskId} - ${task.title}`);
  console.log(`Tipo: ${artifactType}`);
  console.log(`Nombre: ${name}`);
  console.log("");
  console.log("Contenido guardado correctamente.");
}

async function addTaskComment(taskId: number, message: string) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  await addComment(taskId, message, "openclaw");

  console.log(`💬 COMENTARIO AGREGADO`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`Tarea: #${taskId} - ${task.title}`);
  console.log(`Comentario: ${message}`);
}

async function changeStatus(taskId: number, status: TaskStatus) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  const validStatuses: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done", "archived"];
  if (!validStatuses.includes(status)) {
    console.error(`Error: Estado inválido '${status}'`);
    console.error(`Estados válidos: ${validStatuses.join(", ")}`);
    process.exit(1);
  }

  await updateTask(taskId, { status });
  await addComment(taskId, `Estado cambiado de '${task.status}' a '${status}'`, "openclaw");

  const icon = STATUS_ICONS[status] || "❓";
  console.log(`${icon} ESTADO ACTUALIZADO`);
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(formatTask({ ...task, status }));
}

async function getTaskDetails(taskId: number) {
  const task = await getTaskById(taskId);

  if (!task) {
    console.error(`Error: Tarea #${taskId} no encontrada`);
    process.exit(1);
  }

  console.log("DETALLE DE TAREA");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(formatTask(task));
  console.log("");
  console.log(`ID: ${task.id}`);
  console.log(`Estado: ${task.status}`);
  console.log(`Prioridad: ${task.priority}`);
  console.log(`Área: ${task.area || "-"}`);
  console.log(`Fuente: ${task.source}`);
  if (task.decision_rule_id) {
    console.log(`Regla: ${task.decision_rule_id}`);
  }
  console.log(`Creada: ${task.created_at}`);
  if (task.completed_at) {
    console.log(`Completada: ${task.completed_at}`);
  }
  console.log("");

  if (task.description) {
    console.log("Descripción:");
    console.log("───────────────────────────────────────────────────");
    console.log(task.description);
  }
}

async function createNewTask(
  title: string,
  options: {
    description?: string;
    priority?: TaskPriority;
    area?: string;
    status?: TaskStatus;
  }
) {
  const validPriorities: TaskPriority[] = ["critical", "high", "medium", "low"];
  const validStatuses: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "done", "archived"];

  const priority = options.priority || "medium";
  const status = options.status || "backlog";

  if (!validPriorities.includes(priority)) {
    console.error(`Error: Prioridad inválida '${priority}'`);
    console.error(`Prioridades válidas: ${validPriorities.join(", ")}`);
    process.exit(1);
  }

  if (!validStatuses.includes(status)) {
    console.error(`Error: Estado inválido '${status}'`);
    console.error(`Estados válidos: ${validStatuses.join(", ")}`);
    process.exit(1);
  }

  const taskId = await createTask({
    title,
    description: options.description,
    status,
    priority,
    area: options.area,
    source: "manual",
  });

  const task = await getTaskById(taskId);

  console.log("✅ TAREA CREADA");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(formatTask(task!));
  console.log("");
  console.log(`ID: ${taskId}`);
  console.log(`Título: ${title}`);
  console.log(`Estado: ${status}`);
  console.log(`Prioridad: ${priority}`);
  if (options.area) console.log(`Área: ${options.area}`);
  if (options.description) {
    console.log("");
    console.log("Descripción:");
    console.log("───────────────────────────────────────────────────");
    console.log(options.description);
  }
  console.log("");
  console.log(`TASK_ID=${taskId}`);
}

async function main() {
  const command = process.argv[2] || "help";

  try {
    switch (command) {
      case "list": {
        const statusFilter = process.argv[3];
        await listTasks(statusFilter);
        break;
      }

      case "take": {
        const taskId = parseInt(process.argv[3], 10);
        if (isNaN(taskId)) {
          console.error("Error: Se requiere un ID de tarea válido");
          console.error("Uso: node cli.js take <task-id>");
          process.exit(1);
        }
        await takeTask(taskId);
        break;
      }

      case "complete": {
        const taskId = parseInt(process.argv[3], 10);
        const status = process.argv[4] as "success" | "failed";
        const output = process.argv[5];

        if (isNaN(taskId) || !["success", "failed"].includes(status)) {
          console.error("Error: Parámetros inválidos");
          console.error('Uso: node cli.js complete <task-id> <success|failed> [output]');
          process.exit(1);
        }
        await completeTask(taskId, status, output);
        break;
      }

      case "artifact": {
        const taskId = parseInt(process.argv[3], 10);
        const artifactType = process.argv[4] as ArtifactType;
        const name = process.argv[5];
        const content = process.argv[6];

        const validTypes: ArtifactType[] = ["analysis", "insight", "data", "chart", "recommendation", "error"];
        if (isNaN(taskId) || !validTypes.includes(artifactType) || !name || !content) {
          console.error("Error: Parámetros inválidos");
          console.error("Uso: node cli.js artifact <task-id> <type> <name> <content>");
          console.error(`Tipos válidos: ${validTypes.join(", ")}`);
          process.exit(1);
        }
        await saveArtifact(taskId, artifactType, name, content);
        break;
      }

      case "comment": {
        const taskId = parseInt(process.argv[3], 10);
        const message = process.argv.slice(4).join(" ");

        if (isNaN(taskId) || !message) {
          console.error("Error: Parámetros inválidos");
          console.error("Uso: node cli.js comment <task-id> <mensaje>");
          process.exit(1);
        }
        await addTaskComment(taskId, message);
        break;
      }

      case "status": {
        const taskId = parseInt(process.argv[3], 10);
        const status = process.argv[4] as TaskStatus;

        if (isNaN(taskId) || !status) {
          console.error("Error: Parámetros inválidos");
          console.error("Uso: node cli.js status <task-id> <status>");
          console.error("Estados: backlog, todo, in_progress, review, done, archived");
          process.exit(1);
        }
        await changeStatus(taskId, status);
        break;
      }

      case "get": {
        const taskId = parseInt(process.argv[3], 10);
        if (isNaN(taskId)) {
          console.error("Error: Se requiere un ID de tarea válido");
          console.error("Uso: node cli.js get <task-id>");
          process.exit(1);
        }
        await getTaskDetails(taskId);
        break;
      }

      case "create": {
        // Parse arguments: create "title" [--priority medium] [--area Ads] [--status backlog] [--description "desc"]
        const args = process.argv.slice(3);

        if (args.length === 0) {
          console.error("Error: Se requiere un título para la tarea");
          console.error('Uso: node cli.js create "Título de la tarea" [opciones]');
          console.error("");
          console.error("Opciones:");
          console.error("  --priority <critical|high|medium|low>  (default: medium)");
          console.error("  --area <nombre>                        (ej: Ads, Retention, Dev)");
          console.error("  --status <estado>                      (default: backlog)");
          console.error("  --description <texto>                  (descripción detallada)");
          process.exit(1);
        }

        const title = args[0];
        const options: {
          description?: string;
          priority?: TaskPriority;
          area?: string;
          status?: TaskStatus;
        } = {};

        // Parse optional flags
        for (let i = 1; i < args.length; i++) {
          if (args[i] === "--priority" && args[i + 1]) {
            options.priority = args[++i] as TaskPriority;
          } else if (args[i] === "--area" && args[i + 1]) {
            options.area = args[++i];
          } else if (args[i] === "--status" && args[i + 1]) {
            options.status = args[++i] as TaskStatus;
          } else if (args[i] === "--description" && args[i + 1]) {
            options.description = args[++i];
          }
        }

        await createNewTask(title, options);
        break;
      }

      case "help":
      default:
        console.log(`
Dashboard Tasks - Gestión del Kanban

Comandos:
  list [status]              Lista tareas (default: backlog,todo)
  get <id>                   Ver detalle de una tarea
  create <título> [opts]     Crear una nueva tarea
  take <id>                  Tomar una tarea y empezar a trabajar
  complete <id> <status>     Completar tarea (success/failed)
  artifact <id> <type>       Guardar un artifact
  comment <id> <mensaje>     Agregar un comentario
  status <id> <estado>       Cambiar estado de la tarea

Opciones de create:
  --priority <critical|high|medium|low>  (default: medium)
  --area <nombre>                        (ej: Ads, Retention, Dev)
  --status <estado>                      (default: backlog)
  --description <texto>                  (descripción detallada)

Ejemplos:
  node cli.js list                    # Ver tareas pendientes
  node cli.js list backlog,todo       # Filtrar por estados
  node cli.js get 5                   # Ver tarea #5
  node cli.js create "Revisar métricas" --priority high --area Ads
  node cli.js create "Bug en login" --priority critical --description "El login falla con..."
  node cli.js take 5                  # Tomar tarea #5
  node cli.js artifact 5 analysis "Mi análisis" "Contenido..."
  node cli.js complete 5 success "Tarea completada exitosamente"
  node cli.js status 5 done           # Marcar como hecha

Workflow típico:
  1. create   → Crear nueva tarea
  2. list     → Ver qué hay por hacer
  3. take     → Tomar una tarea (inicia run)
  4. artifact → Guardar resultados del análisis
  5. complete → Finalizar la ejecución (success/failed)
`);
        break;
    }
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
