/**
 * SeniorDev Skill - Types
 *
 * Tipos para el indexador de repositorios y navegador de código.
 * OpenClaw usa esto para proponer cambios como Senior Developer.
 *
 * REGLAS:
 * - Read-only a repositorios
 * - NO merge, NO deploy - solo propuestas
 * - Cada PR debe justificar impacto económico
 */

// ============================================================================
// CODEBASE INDEX
// ============================================================================

export interface CodebaseIndex {
  repoPath: string;
  indexedAt: string;
  gitBranch: string;
  gitCommit: string;

  // Estructura
  modules: ModuleInfo[];
  files: FileInfo[];
  dependencies: DependencyGraph;

  // Patrones detectados
  patterns: {
    skills: SkillPattern[];
    apis: ApiEndpoint[];
    dbTables: TableInfo[];
    components: ComponentInfo[];
  };
}

export type ModuleType = "skill" | "core" | "dashboard" | "frontend" | "config" | "unknown";

export interface ModuleInfo {
  name: string;
  path: string;
  type: ModuleType;
  description: string;
  exports: string[];
  dependencies: string[];
  linesOfCode: number;
}

export type FileType =
  | "typescript"
  | "javascript"
  | "sql"
  | "yaml"
  | "json"
  | "tsx"
  | "css"
  | "markdown"
  | "unknown";

export interface FileInfo {
  path: string;
  relativePath: string;
  type: FileType;
  module: string;
  purpose: string;
  exports: string[];
  imports: string[];
  linesOfCode: number;
  lastModified: string;
}

export interface DependencyGraph {
  /** module -> modules it depends on */
  dependencies: Record<string, string[]>;
  /** module -> modules that depend on it */
  dependents: Record<string, string[]>;
}

// ============================================================================
// DETECTED PATTERNS
// ============================================================================

export interface SkillPattern {
  name: string;
  path: string;
  hasIndex: boolean;
  hasCli: boolean;
  hasTypes: boolean;
  commands: string[];
  exports: string[];
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  file: string;
  line: number;
  description?: string;
}

export interface TableInfo {
  name: string;
  schema?: string;
  file: string;
  line: number;
  columns?: string[];
}

export interface ComponentInfo {
  name: string;
  path: string;
  type: "react" | "vue" | "svelte" | "unknown";
  props?: string[];
  exports: string[];
}

// ============================================================================
// SEARCH & NAVIGATION
// ============================================================================

export interface SearchResult {
  type: "file" | "module" | "function" | "class" | "api" | "skill";
  name: string;
  path: string;
  line?: number;
  matchReason: string;
  relevanceScore: number;
}

export interface FileExplanation {
  path: string;
  purpose: string;
  module: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  keyFunctions: FunctionInfo[];
  relatedFiles: string[];
}

export interface ExportInfo {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "default";
  line: number;
}

export interface ImportInfo {
  source: string;
  names: string[];
  isRelative: boolean;
}

export interface FunctionInfo {
  name: string;
  line: number;
  isExported: boolean;
  isAsync: boolean;
  description?: string;
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export type Complexity = "trivial" | "simple" | "medium" | "complex";

// ============================================================================
// CLI OUTPUT
// ============================================================================

export interface IndexStatus {
  exists: boolean;
  indexedAt?: string;
  gitBranch?: string;
  gitCommit?: string;
  moduleCount?: number;
  fileCount?: number;
  skillCount?: number;
  apiCount?: number;
  stale?: boolean;
  staleReason?: string;
}
