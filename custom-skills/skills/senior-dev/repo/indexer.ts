/**
 * SeniorDev - Codebase Indexer
 *
 * Genera un índice estructurado del repositorio para que OpenClaw
 * pueda navegar y entender el código.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

import type {
  CodebaseIndex,
  ModuleInfo,
  FileInfo,
  DependencyGraph,
  SkillPattern,
  ApiEndpoint,
  TableInfo,
  ComponentInfo,
  FileType,
  ModuleType,
  ExportInfo,
  ImportInfo,
  FunctionInfo,
} from "../types.js";

import {
  DEFAULT_EXCLUDE_DIRS,
  DEFAULT_INCLUDE_EXTENSIONS,
  MODULE_DEFINITIONS,
  FILE_TYPE_MAP,
  type GitInfo,
  type FileAnalysis,
} from "./types.js";

const execAsync = promisify(exec);

// ============================================================================
// MAIN INDEXER
// ============================================================================

export async function indexCodebase(repoPath: string): Promise<CodebaseIndex> {
  // 1. Get git info
  const gitInfo = await getGitInfo(repoPath);

  // 2. Scan all files
  const allFiles = await scanAllFiles(repoPath);

  // 3. Analyze files and build structures
  const files = await analyzeFiles(repoPath, allFiles);
  const modules = buildModules(repoPath, files);
  const dependencies = buildDependencyGraph(files);

  // 4. Detect patterns
  const skills = await detectSkills(repoPath);
  const apis = await detectApiEndpoints(repoPath, files);
  const dbTables = await detectDbTables(repoPath, files);
  const components = await detectComponents(repoPath, files);

  return {
    repoPath,
    indexedAt: new Date().toISOString(),
    gitBranch: gitInfo.branch,
    gitCommit: gitInfo.commit,
    modules,
    files,
    dependencies,
    patterns: {
      skills,
      apis,
      dbTables,
      components,
    },
  };
}

// ============================================================================
// GIT INFO
// ============================================================================

async function getGitInfo(repoPath: string): Promise<GitInfo> {
  try {
    const [branchResult, commitResult, statusResult] = await Promise.all([
      execAsync("git branch --show-current", { cwd: repoPath }),
      execAsync("git rev-parse --short HEAD", { cwd: repoPath }),
      execAsync("git status --porcelain", { cwd: repoPath }),
    ]);

    const modifiedFiles = statusResult.stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.substring(3).trim());

    return {
      branch: branchResult.stdout.trim(),
      commit: commitResult.stdout.trim(),
      isClean: modifiedFiles.length === 0,
      modifiedFiles,
    };
  } catch {
    return {
      branch: "unknown",
      commit: "unknown",
      isClean: true,
      modifiedFiles: [],
    };
  }
}

// ============================================================================
// FILE SCANNING
// ============================================================================

async function scanAllFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];

  async function scanDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (DEFAULT_EXCLUDE_DIRS.includes(entry.name)) {
          continue;
        }
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (DEFAULT_INCLUDE_EXTENSIONS.includes(ext)) {
          files.push(relativePath);
        }
      }
    }
  }

  await scanDir(repoPath);
  return files.sort();
}

// ============================================================================
// FILE ANALYSIS
// ============================================================================

async function analyzeFiles(
  repoPath: string,
  filePaths: string[]
): Promise<FileInfo[]> {
  const results: FileInfo[] = [];

  for (const relativePath of filePaths) {
    const fullPath = path.join(repoPath, relativePath);
    const analysis = await analyzeFile(fullPath);
    const stats = await fs.stat(fullPath);

    results.push({
      path: fullPath,
      relativePath,
      type: getFileType(relativePath),
      module: getModuleName(relativePath),
      purpose: analysis.purpose || inferPurpose(relativePath, analysis),
      exports: analysis.exports.map((e) => e.name),
      imports: analysis.imports.map((i) => i.source),
      linesOfCode: await countLines(fullPath),
      lastModified: stats.mtime.toISOString(),
    });
  }

  return results;
}

async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const ext = path.extname(filePath);
  if (![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
    return { exports: [], imports: [], functions: [], classes: [], interfaces: [] };
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      exports: extractExports(content),
      imports: extractImports(content),
      functions: extractFunctions(content),
      classes: extractClasses(content),
      interfaces: extractInterfaces(content),
      purpose: extractPurpose(content),
    };
  } catch {
    return { exports: [], imports: [], functions: [], classes: [], interfaces: [] };
  }
}

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export function name
    const funcMatch = line.match(/^export\s+(async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      exports.push({ name: funcMatch[2], type: "function", line: i + 1 });
      continue;
    }

    // export class Name
    const classMatch = line.match(/^export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({ name: classMatch[1], type: "class", line: i + 1 });
      continue;
    }

    // export interface Name
    const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({ name: interfaceMatch[1], type: "interface", line: i + 1 });
      continue;
    }

    // export type Name
    const typeMatch = line.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({ name: typeMatch[1], type: "type", line: i + 1 });
      continue;
    }

    // export const name
    const constMatch = line.match(/^export\s+const\s+(\w+)/);
    if (constMatch) {
      exports.push({ name: constMatch[1], type: "const", line: i + 1 });
      continue;
    }

    // export default
    const defaultMatch = line.match(/^export\s+default\s+(?:function\s+)?(\w+)?/);
    if (defaultMatch) {
      exports.push({
        name: defaultMatch[1] || "default",
        type: "default",
        line: i + 1,
      });
    }
  }

  return exports;
}

function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+["']([^"']+)["']/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1];
    const defaultImport = match[2];
    const source = match[3];

    const names: string[] = [];
    if (namedImports) {
      names.push(
        ...namedImports
          .split(",")
          .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean)
      );
    }
    if (defaultImport) {
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

function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // function name or async function name
    const funcMatch = line.match(
      /^(export\s+)?(async\s+)?function\s+(\w+)/
    );
    if (funcMatch) {
      functions.push({
        name: funcMatch[3],
        line: i + 1,
        isExported: !!funcMatch[1],
        isAsync: !!funcMatch[2],
        description: extractJsDocComment(lines, i),
      });
      continue;
    }

    // const name = async () => or const name = function
    const arrowMatch = line.match(
      /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?(?:\([^)]*\)|[^=])\s*=>/
    );
    if (arrowMatch) {
      functions.push({
        name: arrowMatch[2],
        line: i + 1,
        isExported: !!arrowMatch[1],
        isAsync: !!arrowMatch[3],
        description: extractJsDocComment(lines, i),
      });
    }
  }

  return functions;
}

function extractClasses(content: string): string[] {
  const classes: string[] = [];
  const classRegex = /^(?:export\s+)?class\s+(\w+)/gm;

  let match;
  while ((match = classRegex.exec(content)) !== null) {
    classes.push(match[1]);
  }

  return classes;
}

function extractInterfaces(content: string): string[] {
  const interfaces: string[] = [];
  const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)/gm;

  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    interfaces.push(match[1]);
  }

  return interfaces;
}

function extractPurpose(content: string): string | undefined {
  // Look for file-level JSDoc comment
  const match = content.match(/^\/\*\*\s*\n([^*]*(?:\*(?!\/)[^*]*)*)\*\//);
  if (match) {
    const comment = match[1]
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .join(" ");
    // Return first sentence or first 100 chars
    const firstSentence = comment.match(/^[^.!?]+[.!?]/);
    return firstSentence ? firstSentence[0] : comment.substring(0, 100);
  }
  return undefined;
}

function extractJsDocComment(lines: string[], functionLine: number): string | undefined {
  // Look backwards for JSDoc comment
  for (let i = functionLine - 1; i >= 0 && i > functionLine - 10; i--) {
    const line = lines[i].trim();
    if (line.endsWith("*/")) {
      // Found end of JSDoc, look for start
      for (let j = i; j >= 0 && j > i - 20; j--) {
        if (lines[j].trim().startsWith("/**")) {
          const comment = lines
            .slice(j, i + 1)
            .map((l) => l.replace(/^\s*\/?\*+\/?/, "").trim())
            .filter(Boolean)
            .join(" ");
          return comment.substring(0, 200);
        }
      }
    }
    if (line && !line.startsWith("*") && !line.startsWith("/")) {
      break; // Non-comment, non-empty line found
    }
  }
  return undefined;
}

function inferPurpose(relativePath: string, analysis: FileAnalysis): string {
  const filename = path.basename(relativePath, path.extname(relativePath));

  // Common patterns
  if (filename === "index") return "Module entry point and exports";
  if (filename === "cli") return "CLI entry point";
  if (filename === "types") return "Type definitions";
  if (filename.endsWith("-analyzer")) return `Analyzer for ${filename.replace("-analyzer", "")}`;
  if (filename.endsWith("-reporter")) return `Reporter for ${filename.replace("-reporter", "")}`;
  if (relativePath.includes("/utils/")) return "Utility functions";
  if (relativePath.includes("/config/")) return "Configuration";

  // Based on exports
  if (analysis.classes.length > 0) {
    return `Defines ${analysis.classes.join(", ")}`;
  }
  if (analysis.interfaces.length > 2) {
    return `Type definitions (${analysis.interfaces.length} interfaces)`;
  }
  if (analysis.functions.length > 0) {
    const mainFunc = analysis.functions.find((f) => f.isExported);
    if (mainFunc) return `Exports ${mainFunc.name}`;
  }

  return "Unknown purpose";
}

// ============================================================================
// MODULE BUILDING
// ============================================================================

function buildModules(repoPath: string, files: FileInfo[]): ModuleInfo[] {
  const moduleMap = new Map<string, FileInfo[]>();

  // Group files by module
  for (const file of files) {
    const moduleName = file.module;
    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, []);
    }
    moduleMap.get(moduleName)!.push(file);
  }

  // Build module info
  const modules: ModuleInfo[] = [];
  for (const [name, moduleFiles] of moduleMap) {
    const type = getModuleType(name);
    const allExports = moduleFiles.flatMap((f) => f.exports);
    const allImports = moduleFiles.flatMap((f) => f.imports);

    // Find dependencies (other modules this module imports from)
    const dependencies = new Set<string>();
    for (const imp of allImports) {
      if (!imp.startsWith(".") && !imp.startsWith("/")) {
        // External package
        continue;
      }
      // Try to resolve to a module
      for (const [moduleName] of moduleMap) {
        if (moduleName !== name && imp.includes(moduleName)) {
          dependencies.add(moduleName);
        }
      }
    }

    modules.push({
      name,
      path: name,
      type,
      description: inferModuleDescription(name, type, moduleFiles),
      exports: [...new Set(allExports)],
      dependencies: [...dependencies],
      linesOfCode: moduleFiles.reduce((sum, f) => sum + f.linesOfCode, 0),
    });
  }

  return modules.sort((a, b) => a.name.localeCompare(b.name));
}

function inferModuleDescription(
  name: string,
  type: ModuleType,
  files: FileInfo[]
): string {
  // Try to find description from index.ts
  const indexFile = files.find((f) => f.relativePath.endsWith("index.ts"));
  if (indexFile && indexFile.purpose && indexFile.purpose !== "Module entry point and exports") {
    return indexFile.purpose;
  }

  // Common patterns
  if (name === "core") return "Core framework components (router, audit, permissions)";
  if (name === "config") return "Configuration files";
  if (name.startsWith("skills/")) {
    const skillName = name.replace("skills/", "");
    return `${skillName} skill implementation`;
  }

  return `${type} module`;
}

// ============================================================================
// DEPENDENCY GRAPH
// ============================================================================

function buildDependencyGraph(files: FileInfo[]): DependencyGraph {
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};

  // Group files by module
  const moduleFiles = new Map<string, FileInfo[]>();
  for (const file of files) {
    if (!moduleFiles.has(file.module)) {
      moduleFiles.set(file.module, []);
    }
    moduleFiles.get(file.module)!.push(file);
  }

  // Build dependency relationships
  for (const [moduleName, modFiles] of moduleFiles) {
    dependencies[moduleName] = [];
    if (!dependents[moduleName]) {
      dependents[moduleName] = [];
    }

    for (const file of modFiles) {
      for (const imp of file.imports) {
        // Find which module this import belongs to
        for (const [targetModule] of moduleFiles) {
          if (targetModule !== moduleName && imp.includes(targetModule)) {
            if (!dependencies[moduleName].includes(targetModule)) {
              dependencies[moduleName].push(targetModule);
            }
            if (!dependents[targetModule]) {
              dependents[targetModule] = [];
            }
            if (!dependents[targetModule].includes(moduleName)) {
              dependents[targetModule].push(moduleName);
            }
          }
        }
      }
    }
  }

  return { dependencies, dependents };
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

async function detectSkills(repoPath: string): Promise<SkillPattern[]> {
  const skillsDir = path.join(repoPath, "skills");

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: SkillPattern[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name);
      const skillFiles = await fs.readdir(skillPath);

      const hasIndex = skillFiles.includes("index.ts");
      const hasCli = skillFiles.includes("cli.ts");
      const hasTypes = skillFiles.includes("types.ts");

      // Extract CLI commands if cli.ts exists
      const commands: string[] = [];
      if (hasCli) {
        const cliContent = await fs.readFile(
          path.join(skillPath, "cli.ts"),
          "utf-8"
        );
        const caseMatches = cliContent.matchAll(/case\s+["'](\w+)["']/g);
        for (const match of caseMatches) {
          if (match[1] !== "help" && match[1] !== "default") {
            commands.push(match[1]);
          }
        }
      }

      // Extract exports from index.ts
      const exports: string[] = [];
      if (hasIndex) {
        const indexContent = await fs.readFile(
          path.join(skillPath, "index.ts"),
          "utf-8"
        );
        const exportMatches = indexContent.matchAll(
          /export\s+{\s*([^}]+)\s*}/g
        );
        for (const match of exportMatches) {
          exports.push(
            ...match[1].split(",").map((e) => e.trim().split(/\s+as\s+/)[0])
          );
        }
      }

      skills.push({
        name: entry.name,
        path: `skills/${entry.name}`,
        hasIndex,
        hasCli,
        hasTypes,
        commands,
        exports,
      });
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function detectApiEndpoints(
  repoPath: string,
  files: FileInfo[]
): Promise<ApiEndpoint[]> {
  const endpoints: ApiEndpoint[] = [];

  // Look for Express-style routes in server files
  const serverFiles = files.filter(
    (f) =>
      f.relativePath.includes("server") ||
      f.relativePath.includes("routes") ||
      f.relativePath.includes("api")
  );

  for (const file of serverFiles) {
    try {
      const content = await fs.readFile(file.path, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match app.get, app.post, router.get, etc.
        const match = line.match(
          /(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/i
        );
        if (match) {
          endpoints.push({
            method: match[1].toUpperCase() as ApiEndpoint["method"],
            path: match[2],
            file: file.relativePath,
            line: i + 1,
            description: extractJsDocComment(lines, i),
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return endpoints;
}

async function detectDbTables(
  repoPath: string,
  files: FileInfo[]
): Promise<TableInfo[]> {
  const tables: TableInfo[] = [];

  // Look for SQL files and queries
  const sqlFiles = files.filter((f) => f.type === "sql");
  const tsFiles = files.filter(
    (f) => f.type === "typescript" || f.type === "javascript"
  );

  // Parse SQL files
  for (const file of sqlFiles) {
    try {
      const content = await fs.readFile(file.path, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(
          /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)/i
        );
        if (match) {
          tables.push({
            name: match[2],
            schema: match[1],
            file: file.relativePath,
            line: i + 1,
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Look for table references in TypeScript
  for (const file of tsFiles) {
    try {
      const content = await fs.readFile(file.path, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        // Match FROM table_name or INTO table_name patterns
        const fromMatch = lines[i].match(
          /(?:FROM|INTO|UPDATE|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s|$|,|\))/gi
        );
        if (fromMatch) {
          for (const m of fromMatch) {
            const parsed = m.match(
              /(?:FROM|INTO|UPDATE|JOIN)\s+(?:(\w+)\.)?(\w+)/i
            );
            if (parsed && !tables.some((t) => t.name === parsed[2])) {
              // Only add if looks like a table name (not a subquery)
              if (/^[a-z_][a-z0-9_]*$/i.test(parsed[2])) {
                tables.push({
                  name: parsed[2],
                  schema: parsed[1],
                  file: file.relativePath,
                  line: i + 1,
                });
              }
            }
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Dedupe by name
  const seen = new Set<string>();
  return tables.filter((t) => {
    const key = `${t.schema || ""}.${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function detectComponents(
  repoPath: string,
  files: FileInfo[]
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  // Look for React components in .tsx files
  const tsxFiles = files.filter((f) => f.type === "tsx");

  for (const file of tsxFiles) {
    try {
      const content = await fs.readFile(file.path, "utf-8");

      // Match function components
      const funcMatches = content.matchAll(
        /(?:export\s+)?(?:function|const)\s+(\w+)\s*[=:][^{]*\([^)]*\)[^{]*{[^}]*return\s*\(/gs
      );
      for (const match of funcMatches) {
        const name = match[1];
        // Check if it's a component (starts with uppercase)
        if (/^[A-Z]/.test(name)) {
          components.push({
            name,
            path: file.relativePath,
            type: "react",
            exports: [name],
          });
        }
      }

      // Match React.FC or FC type
      const fcMatches = content.matchAll(
        /(?:export\s+)?const\s+(\w+)\s*:\s*(?:React\.)?FC/g
      );
      for (const match of fcMatches) {
        if (!components.some((c) => c.name === match[1])) {
          components.push({
            name: match[1],
            path: file.relativePath,
            type: "react",
            exports: [match[1]],
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return components;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getFileType(relativePath: string): FileType {
  const ext = path.extname(relativePath);
  return FILE_TYPE_MAP[ext] || "unknown";
}

function getModuleName(relativePath: string): string {
  const parts = relativePath.split(path.sep);

  // Handle skills/skill-name/... pattern
  if (parts[0] === "skills" && parts.length > 1) {
    return `skills/${parts[1]}`;
  }

  // Handle dashboard/frontend/src/... pattern
  if (
    parts[0] === "dashboard" &&
    parts[1] === "frontend" &&
    parts[2] === "src"
  ) {
    return "dashboard/frontend/src";
  }

  // Return first directory
  return parts[0];
}

function getModuleType(moduleName: string): ModuleType {
  if (moduleName === "core") return "core";
  if (moduleName === "config") return "config";
  if (moduleName.startsWith("skills/")) return "skill";
  if (moduleName === "dashboard") return "dashboard";
  if (moduleName.includes("frontend")) return "frontend";
  return "unknown";
}

async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

// ============================================================================
// INDEX PERSISTENCE
// ============================================================================

// Data directory - always in source tree, not dist
function getDataDir(): string {
  const dirname = import.meta.dirname;
  // Check if we're running from dist/
  if (dirname.includes("/dist/")) {
    // Go from dist/skills/senior-dev/repo to custom-skills/skills/senior-dev/data
    const sourceRoot = dirname.replace(/\/dist\/.*$/, "");
    return path.join(sourceRoot, "skills", "senior-dev", "data");
  }
  // Running from source
  return path.join(dirname, "..", "data");
}

const DATA_DIR = getDataDir();
const INDEX_FILE = path.join(DATA_DIR, "codebase-index.json");

export async function saveIndex(index: CodebaseIndex): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export async function loadIndex(): Promise<CodebaseIndex | null> {
  try {
    const content = await fs.readFile(INDEX_FILE, "utf-8");
    return JSON.parse(content) as CodebaseIndex;
  } catch {
    return null;
  }
}

export async function indexExists(): Promise<boolean> {
  try {
    await fs.access(INDEX_FILE);
    return true;
  } catch {
    return false;
  }
}
