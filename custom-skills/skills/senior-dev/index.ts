/**
 * SeniorDev - Main Entry Point
 *
 * OpenClaw's Senior Developer / Tech Lead skill.
 * Propone cambios de código alineados a impacto económico.
 *
 * Reglas:
 * - Read-only a repositorios
 * - NO merge, NO deploy - solo propuestas
 * - Cada PR debe justificar impacto económico
 * - Sin impacto económico → no se propone PR
 *
 * T10.1 - Repo Awareness: Indexación y navegación del codebase
 * T10.2 - Task → Code Mapping: Mapeo de tareas a código con justificación económica
 * T10.3 - PR Proposal Engine: (futuro)
 * T10.4 - Economic Justification: (futuro)
 * T10.5 - Review Mode: (futuro)
 */

// T10.1 - Repo Awareness
export { indexCodebase, saveIndex, loadIndex, indexExists } from "./repo/indexer.js";
export { find, explain, listModules, listSkills, listApis, getModuleDependencies } from "./repo/navigator.js";

// T10.2 - Task → Code Mapping
export { mapTaskToCode, mapAllTasks } from "./task-mapper/mapper.js";

// Types
export * from "./types.js";
export * from "./task-mapper/types.js";
