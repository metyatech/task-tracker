# task-tracker

Persistent task lifecycle tracker for AI agent sessions. Stores tasks in `.tasks.jsonl` at the root of your git repository — making task state version-controllable and syncable across PCs via git.

## Overview

When using AI agents (Claude, Codex, Gemini, Copilot), tasks from conversations get forgotten across sessions. Agents are forcefully terminated and cannot persist state on exit. `task-tracker` lets agents record tasks to disk immediately when they arise, and check for stale work at session start.

Tasks are stored per-repository in `.tasks.jsonl` alongside your code. Commit the file to track task state in version control; add it to `.gitignore` to keep it local.

## Compatibility

- Node.js 18+
- macOS, Linux, Windows
- Requires git (tasks are scoped to the current git repository)

## Install

```bash
npm install -g @metyatech/task-tracker
```

Or link locally for development:

```bash
npm link
```

## Storage

Tasks are stored in `<git-repo-root>/.tasks.jsonl` (JSONL format, one JSON object per line). All commands must be run from within a git repository. The file is created automatically on first `add`.

Each task: `{ id, description, stage, committedEventId?, createdAt, updatedAt }`

`committedEventId` is a unique ID written when the task transitions to `committed`. It is used to locate the git commit that introduced the event into `.tasks.jsonl`, enabling accurate `pushed` detection even when `update --stage committed` is called before the actual commit.

To sync tasks across PCs, commit `.tasks.jsonl` and push/pull like any other file.

## Usage

### Add a task

```bash
task-tracker add "Implement feature X"
task-tracker add "Deploy to staging" --stage in-progress
task-tracker add "Review PR #42" --json
```

### List tasks

```bash
task-tracker list              # active tasks only
task-tracker list --all        # include done tasks
task-tracker list --stage in-progress
task-tracker list --json
```

### Update a task

```bash
task-tracker update <id> --stage committed
task-tracker update <id> --description "Updated description"
task-tracker update <id> --stage released --json
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
task-tracker check
task-tracker check --json
```

The `check` command:

1. Lists all active (non-done) tasks from this repo's `.tasks.jsonl`
2. Runs `git status --porcelain` on the repo root
3. Runs `git log @{u}..HEAD --oneline` to show unpushed commits
4. Outputs a combined report

## Lifecycle Stages

Persisted stages: `pending` → `in-progress` → `committed` → `released` → `done`

The `pushed` stage is **derived** and cannot be set manually. When a task is in `committed`
stage, `list` and `check` display its effective stage as `pushed` automatically once the
`.tasks.jsonl` commit that first introduced the task's `committedEventId` is reachable from
the remote upstream branch (`git merge-base --is-ancestor`). This means derivation is
accurate even when `update --stage committed` is called before the actual git commit.

To filter by effective `pushed` stage: `task-tracker list --stage pushed`

Setting `--stage pushed` on `add` or `update` is an error.

## Dev Commands

```bash
npm run build        # Build with tsup
npm run test         # Run tests with vitest
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check)
npm run verify       # format:check + lint + build + test
```

## Release and Publish

Publishing uses npm trusted publishing from GitHub Actions. The publish workflow is
[`publish.yml`](.github/workflows/publish.yml) and does not require an npm write token in GitHub.

Typical release flow:

1. Update `CHANGELOG.md` and bump `package.json` / `package-lock.json`
2. Run `npm run verify`
3. Commit and push to `main`
4. Create and push a `v<version>` tag
5. GitHub Actions publishes the package from the tag via npm trusted publishing

If a release tag already exists before trusted publishing is configured, run the
`Publish Package` workflow manually and set `publish_ref` to the tag name
(for example, `v0.2.5`).

## Community

- [Security Policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## License

MIT © [metyatech](https://github.com/metyatech)
