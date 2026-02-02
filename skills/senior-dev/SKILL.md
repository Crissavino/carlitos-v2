---
name: senior-dev
description: Tech Lead / Senior Developer advisory skill. Use for codebase analysis, task-to-code mapping, and PR proposal generation. Read-only mode - cannot modify code.
---

# Senior Dev Skill

Tech Lead / Senior Developer advisory skill for codebase understanding and task planning.

## Mode

**Read-only / Advisory** - This skill analyzes code and generates recommendations but does NOT execute changes.

## Capabilities

- **Repo awareness**: Index and understand the entire codebase structure
- **Task → Code mapping**: Map Kanban tasks to specific files and code locations
- **PR proposal (text-only)**: Generate PR proposals with rationale and file changes

## Explicit Restrictions

- **NO merge** - Cannot merge branches or PRs
- **NO deploy** - Cannot trigger deployments
- **NO write access** - Cannot modify files, only read and analyze

## CLI Commands

| Command | Description |
|---------|-------------|
| `index` | Generate/update the codebase index |
| `status` | Show index status and statistics |
| `find <query>` | Search for code patterns or files |
| `explain <path>` | Explain what a file/module does |
| `modules` | List all modules in the codebase |
| `skills` | List detected skills |
| `apis` | List API endpoints |
| `deps` | Show dependency analysis |
| `map-task <id>` | Map a single task to code locations |
| `map-tasks` | Map all pending tasks to code |
| `review` | Show tasks needing human approval |
| `pr-proposal <id>` | Generate PR proposal for a task |
| `pr-proposals` | Generate PR proposals for approved tasks |

## Implementation Note

> This skill is registered via shim. Logic lives in custom-skills/skills/senior-dev/.
