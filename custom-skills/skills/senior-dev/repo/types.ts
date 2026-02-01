/**
 * SeniorDev - Repo Types
 *
 * Tipos internos para el indexador y navegador de repositorios.
 */

import type {
  ModuleType,
  FileType,
  HttpMethod,
  ExportInfo,
  ImportInfo,
  FunctionInfo,
} from "../types.js";

// ============================================================================
// INDEXER INTERNAL TYPES
// ============================================================================

export interface ScanOptions {
  repoPath: string;
  excludeDirs?: string[];
  includeExtensions?: string[];
}

export const DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  ".git",
  ".next",
  "coverage",
  "__pycache__",
  ".cache",
];

export const DEFAULT_INCLUDE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".sql",
  ".yaml",
  ".yml",
  ".json",
  ".css",
  ".md",
];

export interface ModuleDefinition {
  path: string;
  type: ModuleType;
  namePattern?: RegExp;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { path: "core", type: "core" },
  { path: "skills", type: "skill" },
  { path: "dashboard", type: "dashboard" },
  { path: "dashboard/frontend/src", type: "frontend" },
  { path: "config", type: "config" },
];

// ============================================================================
// FILE ANALYSIS
// ============================================================================

export interface FileAnalysis {
  exports: ExportInfo[];
  imports: ImportInfo[];
  functions: FunctionInfo[];
  classes: string[];
  interfaces: string[];
  purpose?: string;
}

export const FILE_TYPE_MAP: Record<string, FileType> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".sql": "sql",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".json": "json",
  ".css": "css",
  ".md": "markdown",
};

// ============================================================================
// PATTERN DETECTION
// ============================================================================

export interface ApiPatternMatch {
  method: HttpMethod;
  path: string;
  line: number;
  fullMatch: string;
}

export interface SkillDirectoryInfo {
  name: string;
  path: string;
  files: string[];
  hasIndex: boolean;
  hasCli: boolean;
  hasTypes: boolean;
}

// ============================================================================
// GIT INFO
// ============================================================================

export interface GitInfo {
  branch: string;
  commit: string;
  isClean: boolean;
  modifiedFiles: string[];
}
