/**
 * SeniorDev - Code Navigator
 *
 * Navega y busca en el índice del codebase para responder preguntas
 * y encontrar código relevante.
 */

import * as fs from "fs/promises";
import * as path from "path";

import type {
  CodebaseIndex,
  SearchResult,
  FileExplanation,
  FileInfo,
  ModuleInfo,
  ExportInfo,
  ImportInfo,
  FunctionInfo,
} from "../types.js";

import { loadIndex } from "./indexer.js";

// ============================================================================
// SEARCH
// ============================================================================

export async function find(query: string): Promise<SearchResult[]> {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);

  // Search in files
  for (const file of index.files) {
    const score = calculateFileRelevance(file, queryTerms);
    if (score > 0) {
      results.push({
        type: "file",
        name: path.basename(file.relativePath),
        path: file.relativePath,
        matchReason: file.purpose,
        relevanceScore: score,
      });
    }
  }

  // Search in modules
  for (const module of index.modules) {
    const score = calculateModuleRelevance(module, queryTerms);
    if (score > 0) {
      results.push({
        type: "module",
        name: module.name,
        path: module.path,
        matchReason: module.description,
        relevanceScore: score,
      });
    }
  }

  // Search in skills
  for (const skill of index.patterns.skills) {
    const score = calculateSkillRelevance(skill.name, skill.commands, queryTerms);
    if (score > 0) {
      results.push({
        type: "skill",
        name: skill.name,
        path: skill.path,
        matchReason: `Skill with commands: ${skill.commands.join(", ") || "none"}`,
        relevanceScore: score,
      });
    }
  }

  // Search in API endpoints
  for (const api of index.patterns.apis) {
    const score = calculateApiRelevance(api.path, api.method, queryTerms);
    if (score > 0) {
      results.push({
        type: "api",
        name: `${api.method} ${api.path}`,
        path: api.file,
        line: api.line,
        matchReason: api.description || `API endpoint`,
        relevanceScore: score,
      });
    }
  }

  // Sort by relevance and limit results
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 20);
}

function calculateFileRelevance(file: FileInfo, queryTerms: string[]): number {
  let score = 0;
  const filename = path.basename(file.relativePath).toLowerCase();
  const pathLower = file.relativePath.toLowerCase();
  const purposeLower = file.purpose.toLowerCase();

  for (const term of queryTerms) {
    // Exact filename match
    if (filename.includes(term)) score += 3;
    // Path match
    if (pathLower.includes(term)) score += 2;
    // Purpose match
    if (purposeLower.includes(term)) score += 2;
    // Export match
    if (file.exports.some((e) => e.toLowerCase().includes(term))) score += 1;
  }

  return score;
}

function calculateModuleRelevance(module: ModuleInfo, queryTerms: string[]): number {
  let score = 0;
  const nameLower = module.name.toLowerCase();
  const descLower = module.description.toLowerCase();

  for (const term of queryTerms) {
    if (nameLower.includes(term)) score += 3;
    if (descLower.includes(term)) score += 2;
    if (module.exports.some((e) => e.toLowerCase().includes(term))) score += 1;
  }

  return score;
}

function calculateSkillRelevance(
  name: string,
  commands: string[],
  queryTerms: string[]
): number {
  let score = 0;
  const nameLower = name.toLowerCase();

  for (const term of queryTerms) {
    if (nameLower.includes(term)) score += 3;
    if (commands.some((c) => c.toLowerCase().includes(term))) score += 2;
  }

  return score;
}

function calculateApiRelevance(
  apiPath: string,
  method: string,
  queryTerms: string[]
): number {
  let score = 0;
  const pathLower = apiPath.toLowerCase();
  const methodLower = method.toLowerCase();

  for (const term of queryTerms) {
    if (pathLower.includes(term)) score += 3;
    if (methodLower === term) score += 2;
    // Common API terms
    if (term === "api" || term === "endpoint" || term === "route") score += 1;
  }

  return score;
}

// ============================================================================
// EXPLAIN FILE
// ============================================================================

export async function explain(filePath: string): Promise<FileExplanation> {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  // Find file in index
  const file = index.files.find(
    (f) => f.relativePath === filePath || f.path === filePath
  );

  if (!file) {
    throw new Error(`File not found in index: ${filePath}`);
  }

  // Read file content for detailed analysis
  const content = await fs.readFile(file.path, "utf-8");
  const exports = extractDetailedExports(content);
  const imports = extractDetailedImports(content);
  const keyFunctions = extractKeyFunctions(content);

  // Find related files (same module, similar purpose)
  const relatedFiles = findRelatedFiles(index, file);

  return {
    path: file.relativePath,
    purpose: file.purpose,
    module: file.module,
    exports,
    imports,
    keyFunctions,
    relatedFiles,
  };
}

function extractDetailedExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export function
    const funcMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      exports.push({ name: funcMatch[2], type: "function", line: i + 1 });
      continue;
    }

    // export class
    const classMatch = line.match(/^export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({ name: classMatch[1], type: "class", line: i + 1 });
      continue;
    }

    // export interface
    const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({ name: interfaceMatch[1], type: "interface", line: i + 1 });
      continue;
    }

    // export type
    const typeMatch = line.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({ name: typeMatch[1], type: "type", line: i + 1 });
      continue;
    }

    // export const
    const constMatch = line.match(/^export\s+const\s+(\w+)/);
    if (constMatch) {
      exports.push({ name: constMatch[1], type: "const", line: i + 1 });
    }
  }

  return exports;
}

function extractDetailedImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex =
    /import\s+(?:type\s+)?(?:{([^}]+)}|(\w+)(?:\s*,\s*{([^}]+)})?)\s+from\s+["']([^"']+)["']/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1] || match[3];
    const defaultImport = match[2];
    const source = match[4];

    const names: string[] = [];
    if (namedImports) {
      names.push(
        ...namedImports
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
      );
    }
    if (defaultImport && defaultImport !== "type") {
      names.push(defaultImport);
    }

    imports.push({
      source,
      names,
      isRelative: source.startsWith(".") || source.startsWith("/"),
    });
  }

  return imports;
}

function extractKeyFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Exported functions are key
    const funcMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      functions.push({
        name: funcMatch[2],
        line: i + 1,
        isExported: true,
        isAsync: !!funcMatch[1],
        description: extractPrecedingComment(lines, i),
      });
    }

    // Exported const arrow functions
    const arrowMatch = line.match(
      /^export\s+const\s+(\w+)\s*=\s*(async\s+)?/
    );
    if (arrowMatch && (line.includes("=>") || lines[i + 1]?.includes("=>"))) {
      functions.push({
        name: arrowMatch[1],
        line: i + 1,
        isExported: true,
        isAsync: !!arrowMatch[2],
        description: extractPrecedingComment(lines, i),
      });
    }
  }

  return functions;
}

function extractPrecedingComment(lines: string[], lineIndex: number): string | undefined {
  // Look for JSDoc or regular comment above
  for (let i = lineIndex - 1; i >= 0 && i > lineIndex - 15; i--) {
    const line = lines[i].trim();

    if (line.endsWith("*/")) {
      // Found JSDoc end, collect until start
      const commentLines: string[] = [];
      for (let j = i; j >= 0 && j > i - 20; j--) {
        const commentLine = lines[j].trim();
        commentLines.unshift(commentLine);
        if (commentLine.startsWith("/**") || commentLine.startsWith("/*")) {
          break;
        }
      }
      return commentLines
        .map((l) => l.replace(/^\/?\*+\/?/, "").trim())
        .filter(Boolean)
        .join(" ")
        .substring(0, 200);
    }

    if (line.startsWith("//")) {
      return line.replace(/^\/\/\s*/, "").substring(0, 200);
    }

    if (line && !line.startsWith("*")) {
      break;
    }
  }

  return undefined;
}

function findRelatedFiles(index: CodebaseIndex, file: FileInfo): string[] {
  const related: string[] = [];

  // Same module files
  for (const f of index.files) {
    if (f.relativePath === file.relativePath) continue;
    if (f.module === file.module) {
      related.push(f.relativePath);
    }
  }

  // Files that import this file
  const filename = path.basename(file.relativePath, path.extname(file.relativePath));
  for (const f of index.files) {
    if (f.relativePath === file.relativePath) continue;
    if (f.imports.some((imp) => imp.includes(filename))) {
      if (!related.includes(f.relativePath)) {
        related.push(f.relativePath);
      }
    }
  }

  return related.slice(0, 10);
}

// ============================================================================
// MODULE INFO
// ============================================================================

export async function getModuleInfo(moduleName: string): Promise<ModuleInfo | null> {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return index.modules.find((m) => m.name === moduleName) || null;
}

export async function listModules(): Promise<ModuleInfo[]> {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return index.modules;
}

// ============================================================================
// SKILL INFO
// ============================================================================

export async function getSkillInfo(skillName: string) {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return index.patterns.skills.find((s) => s.name === skillName) || null;
}

export async function listSkills() {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return index.patterns.skills;
}

// ============================================================================
// API INFO
// ============================================================================

export async function listApis() {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return index.patterns.apis;
}

// ============================================================================
// DEPENDENCY INFO
// ============================================================================

export async function getModuleDependencies(moduleName: string) {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'index' command first.");
  }

  return {
    dependencies: index.dependencies.dependencies[moduleName] || [],
    dependents: index.dependencies.dependents[moduleName] || [],
  };
}
