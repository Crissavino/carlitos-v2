/**
 * Dashboard Tasks - Main Entry Point
 *
 * Allows OpenClaw to interact with the Kanban board:
 * - List and filter tasks
 * - Take tasks and start runs
 * - Save artifacts with analysis results
 * - Complete runs and update task status
 */

export {
  getTasks,
  getTaskById,
  updateTask,
  startRun,
  completeRun,
  createArtifact,
  addComment,
  getKanbanSummary,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type ArtifactType,
  type TaskRun,
  type TaskArtifact,
  type TaskComment,
} from "../../dashboard/db.js";
