# task-tracker

Persistent task lifecycle tracker for AI agent sessions.

## Overview

When using AI agents (Claude, Codex, Gemini, Copilot), tasks from conversations get forgotten across sessions. Agents are forcefully terminated and cannot persist state on exit. `task-tracker` lets agents record tasks to disk immediately when they arise, and check for stale work at session start.

## Compatibility

- Node.js 18+
- macOS, Linux, Windows

## Install

```bash
npm install -g @metyatech/task-tracker
```

Or link locally for development:

```bash
npm link
```

## Usage

### Add a task

```bash
task-tracker add "Implement feature X" --repo myapp --stage in-progress
task-tracker add "Review PR #42" --json
```

### List tasks

```bash
task-tracker list              # active tasks only
task-tracker list --all        # include done tasks
task-tracker list --repo myapp
task-tracker list --stage in-progress
task-tracker list --json
```

### Update a task

```bash
task-tracker update <id> --stage implemented
task-tracker update <id> --description "Updated description"
task-tracker update <id> --repo newrepo
```

### Mark done

```bash
task-tracker done <id>
```

### Remove a task

```bash
task-tracker remove <id>
```

### Check for stale work

```bash
task-tracker check                        # scan cwd
task-tracker check --workspace /path/to/workspace
task-tracker check --json
```

The `check` command:

1. Lists all active (non-done) tasks
2. Scans git repos in the workspace for uncommitted changes and unpushed commits

### Initialize storage

```bash
task-tracker init
```

### Override storage location

```bash
task-tracker --storage /custom/path/tasks.jsonl list
```

## Lifecycle Stages

`pending` → `in-progress` → `implemented` → `verified` → `committed` → `pushed` → `pr-created` → `merged` → `released` → `published` → `done`

Stages can be set in any order.

## Storage

Tasks are stored in `~/.task-tracker/tasks.jsonl` (JSONL format, one JSON object per line).

Each task: `{ id, description, repo?, stage, createdAt, updatedAt }`

## Dev Commands

```bash
npm run build        # Build with tsup
npm run test         # Run tests with vitest
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check)
npm run verify       # format:check + lint + build + test
```

## Required Config

- Default storage: `~/.task-tracker/tasks.jsonl`
- Override with `--storage <path>` flag

## Links

- [LICENSE](./LICENSE)

## License

MIT © metyatech
