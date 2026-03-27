import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI = join(__dirname, '..', '..', 'dist', 'cli.js');
const LONG_CLI_TEST_TIMEOUT_MS = 45_000;
const CLI_HOOK_TIMEOUT_MS = 30_000;

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@test.com',
};

function initGitRepo(dir: string): void {
  mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init'], { cwd: dir, encoding: 'utf-8', env: GIT_ENV });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, env: GIT_ENV });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, env: GIT_ENV });
  writeFileSync(join(dir, '.gitkeep'), '');
  spawnSync('git', ['add', '.'], { cwd: dir, encoding: 'utf-8', env: GIT_ENV });
  spawnSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
    cwd: dir,
    encoding: 'utf-8',
    env: GIT_ENV,
  });
}

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    cwd,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? 1,
  };
}

function writeTasksJsonl(
  dir: string,
  tasks: Array<{
    id: string;
    description: string;
    stage: string;
    createdAt: string;
    updatedAt: string;
  }>,
): void {
  writeFileSync(join(dir, '.tasks.jsonl'), tasks.map((task) => JSON.stringify(task)).join('\n'));
}

describe('CLI integration', { timeout: LONG_CLI_TEST_TIMEOUT_MS }, () => {
  let tmpDir: string;
  let repoDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'task-tracker-cli-test-'));
    repoDir = join(tmpDir, 'repo');
    initGitRepo(repoDir);
  }, CLI_HOOK_TIMEOUT_MS);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, CLI_HOOK_TIMEOUT_MS);

  it('shows version', () => {
    const r = spawnSync('node', [CLI, '--version'], { encoding: 'utf-8', cwd: repoDir });
    expect(r.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    expect(r.status).toBe(0);
  });

  it('shows help', () => {
    const r = spawnSync('node', [CLI, '--help'], { encoding: 'utf-8', cwd: repoDir });
    expect(r.stdout).toContain('task-tracker');
    expect(r.status).toBe(0);
  });

  it('add and list task', () => {
    const add = runCli(['add', 'My first task'], repoDir);
    expect(add.code).toBe(0);
    expect(add.stdout).toContain('Created');

    const list = runCli(['list'], repoDir);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain('My first task');
  });

  it('add with --json output', () => {
    const add = runCli(['add', 'JSON task', '--json'], repoDir);
    expect(add.code).toBe(0);
    const parsed = JSON.parse(add.stdout) as { description: string; stage: string; id: string };
    expect(parsed.description).toBe('JSON task');
    expect(parsed.stage).toBe('pending');
    expect(parsed.id).toHaveLength(8);
  });

  it('update task stage', () => {
    const add = runCli(['add', 'Updateable', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const update = runCli(['update', task.id, '--stage', 'in-progress', '--json'], repoDir);
    expect(update.code).toBe(0);
    const updated = JSON.parse(update.stdout) as { stage: string };
    expect(updated.stage).toBe('in-progress');
  });

  it('update supports task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-C72J5Lc',
        description: 'Hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const update = runCli(['update', '-C72J5Lc', '--stage', 'in-progress', '--json'], repoDir);
    expect(update.code).toBe(0);
    const updated = JSON.parse(update.stdout) as { id: string; stage: string };
    expect(updated.id).toBe('-C72J5Lc');
    expect(updated.stage).toBe('in-progress');
  });

  it('update supports shorter task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-probe',
        description: 'Short hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const update = runCli(['update', '-probe', '--stage', 'in-progress', '--json'], repoDir);
    expect(update.code).toBe(0);
    const updated = JSON.parse(update.stdout) as { id: string; stage: string };
    expect(updated.id).toBe('-probe');
    expect(updated.stage).toBe('in-progress');
  });

  it('done command marks task as done', () => {
    const add = runCli(['add', 'Finish me', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const done = runCli(['done', task.id], repoDir);
    expect(done.code).toBe(0);

    const list = runCli(['list'], repoDir);
    expect(list.stdout).not.toContain('Finish me');

    const listAll = runCli(['list', '--all'], repoDir);
    expect(listAll.stdout).toContain('Finish me');
  });

  it('done supports task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-C72J5Lc',
        description: 'Finish hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const done = runCli(['done', '-C72J5Lc'], repoDir);
    expect(done.code).toBe(0);

    const listAll = runCli(['list', '--all', '--json'], repoDir);
    const tasks = JSON.parse(listAll.stdout) as Array<{ id: string; stage: string }>;
    expect(tasks).toContainEqual(expect.objectContaining({ id: '-C72J5Lc', stage: 'done' }));
  });

  it('done supports shorter task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-probe',
        description: 'Finish short hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const done = runCli(['done', '-probe'], repoDir);
    expect(done.code).toBe(0);

    const listAll = runCli(['list', '--all', '--json'], repoDir);
    const tasks = JSON.parse(listAll.stdout) as Array<{ id: string; stage: string }>;
    expect(tasks).toContainEqual(expect.objectContaining({ id: '-probe', stage: 'done' }));
  });

  it('remove task', () => {
    const add = runCli(['add', 'Remove me', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const remove = runCli(['remove', task.id], repoDir);
    expect(remove.code).toBe(0);

    const list = runCli(['list', '--all'], repoDir);
    expect(list.stdout).not.toContain('Remove me');
  });

  it('remove supports task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-C72J5Lc',
        description: 'Remove hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const remove = runCli(['remove', '-C72J5Lc'], repoDir);
    expect(remove.code).toBe(0);

    const listAll = runCli(['list', '--all', '--json'], repoDir);
    const tasks = JSON.parse(listAll.stdout) as Array<{ id: string }>;
    expect(tasks).not.toContainEqual(expect.objectContaining({ id: '-C72J5Lc' }));
  });

  it('remove supports shorter task ids starting with a hyphen', () => {
    writeTasksJsonl(repoDir, [
      {
        id: '-probe',
        description: 'Remove short hyphen task',
        stage: 'pending',
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    ]);

    const remove = runCli(['remove', '-probe'], repoDir);
    expect(remove.code).toBe(0);

    const listAll = runCli(['list', '--all', '--json'], repoDir);
    const tasks = JSON.parse(listAll.stdout) as Array<{ id: string }>;
    expect(tasks).not.toContainEqual(expect.objectContaining({ id: '-probe' }));
  });

  it('check command shows repo status', () => {
    writeFileSync(join(repoDir, 'dirty.txt'), 'dirty');

    const check = runCli(['check'], repoDir);
    expect(check.code).toBe(0);
    expect(check.stdout).toContain('Git Status');
  });

  it('check command with --json', () => {
    const check = runCli(['check', '--json'], repoDir);
    expect(check.code).toBe(0);
    const parsed = JSON.parse(check.stdout) as {
      activeTasks: unknown[];
      repoStatus: unknown;
    };
    expect(parsed).toHaveProperty('activeTasks');
    expect(parsed).toHaveProperty('repoStatus');
  });

  it(
    'purge removes done tasks',
    () => {
      runCli(['add', 'Active task'], repoDir);
      const add2 = runCli(['add', 'Done task', '--json'], repoDir);
      const task2 = JSON.parse(add2.stdout) as { id: string };
      runCli(['done', task2.id], repoDir);

      const purge = runCli(['purge'], repoDir);
      expect(purge.code).toBe(0);
      expect(purge.stdout).toContain('Purged 1 task(s)');
      expect(purge.stdout).toContain(task2.id);

      const list = runCli(['list'], repoDir);
      expect(list.stdout).toContain('Active task');
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it(
    'purge --dry-run does not remove tasks',
    () => {
      const add = runCli(['add', 'To purge', '--json'], repoDir);
      const task = JSON.parse(add.stdout) as { id: string };
      runCli(['done', task.id], repoDir);

      const dryRun = runCli(['purge', '--dry-run'], repoDir);
      expect(dryRun.code).toBe(0);
      expect(dryRun.stdout).toContain('Would purge 1 task(s)');

      const listAll = runCli(['list', '--all'], repoDir);
      expect(listAll.stdout).toContain('To purge');
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it(
    'purge --json outputs structured result',
    () => {
      const add = runCli(['add', 'Done JSON task', '--json'], repoDir);
      const task = JSON.parse(add.stdout) as { id: string };
      runCli(['done', task.id], repoDir);

      const purge = runCli(['purge', '--json'], repoDir);
      expect(purge.code).toBe(0);
      const parsed = JSON.parse(purge.stdout) as { count: number; ids: string[] };
      expect(parsed.count).toBe(1);
      expect(parsed.ids).toContain(task.id);
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it('purge with no done tasks outputs appropriate message', () => {
    runCli(['add', 'Just active'], repoDir);

    const purge = runCli(['purge'], repoDir);
    expect(purge.code).toBe(0);
    expect(purge.stdout).toContain('No done tasks to purge');
  });

  it(
    'done --keep N auto-purges keeping only N most recent done tasks',
    () => {
      // Add 3 tasks directly as done (no auto-purge side effects)
      runCli(['add', 'Old task 1', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 2', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 3', '--stage', 'done'], repoDir);
      // Mark one more done with explicit --keep 2 → triggers auto-purge keeping 2
      const add = runCli(['add', 'Final task', '--json'], repoDir);
      const finalTask = JSON.parse(add.stdout) as { id: string };
      const done = runCli(['done', finalTask.id, '--keep', '2'], repoDir);
      expect(done.code).toBe(0);

      const all = runCli(['list', '--all', '--json'], repoDir);
      const parsed = JSON.parse(all.stdout) as unknown[];
      expect(parsed).toHaveLength(2);
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it(
    'done --keep 0 disables auto-purge',
    () => {
      // Add 3 tasks directly as done
      runCli(['add', 'Old task 1', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 2', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 3', '--stage', 'done'], repoDir);
      // Mark one more done with --keep 0 → auto-purge disabled
      const add = runCli(['add', 'Task 4', '--json'], repoDir);
      const t = JSON.parse(add.stdout) as { id: string };
      const done = runCli(['done', t.id, '--keep', '0'], repoDir);
      expect(done.code).toBe(0);

      const all = runCli(['list', '--all', '--json'], repoDir);
      const parsed = JSON.parse(all.stdout) as unknown[];
      expect(parsed).toHaveLength(4);
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it(
    'purge --keep N keeps N most recent done tasks',
    () => {
      // Add 4 tasks directly as done
      runCli(['add', 'Old task 1', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 2', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 3', '--stage', 'done'], repoDir);
      runCli(['add', 'Old task 4', '--stage', 'done'], repoDir);

      const purge = runCli(['purge', '--keep', '2'], repoDir);
      expect(purge.code).toBe(0);
      expect(purge.stdout).toContain('Purged 2 task(s)');

      const all = runCli(['list', '--all', '--json'], repoDir);
      const parsed = JSON.parse(all.stdout) as unknown[];
      expect(parsed).toHaveLength(2);
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it('update --stage pushed fails with derived stage error', () => {
    const add = runCli(['add', 'Push me', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const update = runCli(['update', task.id, '--stage', 'pushed'], repoDir);
    expect(update.code).not.toBe(0);
    expect(update.stderr).toContain('pushed');
    expect(update.stderr).toContain('derived');
  });

  it('add --stage pushed fails with derived stage error', () => {
    const r = runCli(['add', 'Push task', '--stage', 'pushed'], repoDir);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('pushed');
    expect(r.stderr).toContain('derived');
  });

  it('update --stage committed stores committedEventId (not committedCommit) in json output', () => {
    const add = runCli(['add', 'Commit me', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const update = runCli(['update', task.id, '--stage', 'committed', '--json'], repoDir);
    expect(update.code).toBe(0);
    const updated = JSON.parse(update.stdout) as { stage: string; committedEventId?: string };
    expect(updated.stage).toBe('committed');
    expect(updated.committedEventId).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it(
    'pushed is derived from the git commit that introduced committedEventId into .tasks.jsonl',
    () => {
      const add = runCli(['add', 'Push via history', '--json'], repoDir);
      const task = JSON.parse(add.stdout) as { id: string };

      // Mark committed — writes committedEventId into .tasks.jsonl (not yet git-committed)
      runCli(['update', task.id, '--stage', 'committed'], repoDir);

      // Now commit .tasks.jsonl (the closing commit that includes the event ID)
      spawnSync('git', ['add', '.tasks.jsonl'], { cwd: repoDir, encoding: 'utf-8', env: GIT_ENV });
      spawnSync('git', ['commit', '-m', 'commit tasks', '--no-gpg-sign'], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });

      // Set up a bare remote and push so upstream tracking is configured
      const remoteDir = join(tmpDir, 'remote.git');
      spawnSync('git', ['init', '--bare', remoteDir], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });
      spawnSync('git', ['remote', 'add', 'origin', remoteDir], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });
      const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      }).stdout.trim();
      spawnSync('git', ['push', '-u', 'origin', branch], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });

      // After push, the task should be derived as 'pushed'
      const list = runCli(['list', '--stage', 'pushed', '--json'], repoDir);
      expect(list.code).toBe(0);
      const tasks = JSON.parse(list.stdout) as Array<{ id: string; effectiveStage: string }>;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task.id);
      expect(tasks[0].effectiveStage).toBe('pushed');
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it(
    'pushed is NOT derived when update --stage committed is called but .tasks.jsonl not yet committed',
    () => {
      const add = runCli(['add', 'Uncommitted event', '--json'], repoDir);
      const task = JSON.parse(add.stdout) as { id: string };

      // Mark committed — writes committedEventId but do NOT git-commit the file
      runCli(['update', task.id, '--stage', 'committed'], repoDir);

      // Set up a remote and push WITHOUT committing .tasks.jsonl
      const remoteDir = join(tmpDir, 'remote2.git');
      spawnSync('git', ['init', '--bare', remoteDir], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });
      spawnSync('git', ['remote', 'add', 'origin2', remoteDir], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });
      const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      }).stdout.trim();
      // Push the existing HEAD (without .tasks.jsonl changes) as the upstream
      spawnSync('git', ['push', '-u', 'origin2', `HEAD:${branch}`], {
        cwd: repoDir,
        encoding: 'utf-8',
        env: GIT_ENV,
      });

      // The committedEventId is not in git history yet → should NOT be pushed
      const list = runCli(['list', '--stage', 'pushed', '--json'], repoDir);
      expect(list.code).toBe(0);
      const tasks = JSON.parse(list.stdout) as unknown[];
      expect(tasks).toHaveLength(0);
    },
    LONG_CLI_TEST_TIMEOUT_MS,
  );

  it('list --json includes effectiveStage for each task', () => {
    const add = runCli(['add', 'Effective task', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };
    runCli(['update', task.id, '--stage', 'committed', '--json'], repoDir);

    const list = runCli(['list', '--json'], repoDir);
    expect(list.code).toBe(0);
    const tasks = JSON.parse(list.stdout) as Array<{
      id: string;
      stage: string;
      effectiveStage: string;
    }>;
    const found = tasks.find((t) => t.id === task.id);
    expect(found?.stage).toBe('committed');
    // No upstream in test repo, so effective stage stays 'committed'
    expect(found?.effectiveStage).toBe('committed');
  });

  it('list --stage pushed returns empty when no upstream configured', () => {
    const add = runCli(['add', 'Committed task', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };
    runCli(['update', task.id, '--stage', 'committed'], repoDir);

    const list = runCli(['list', '--stage', 'pushed', '--json'], repoDir);
    expect(list.code).toBe(0);
    const tasks = JSON.parse(list.stdout) as unknown[];
    // No upstream → no tasks qualify as pushed
    expect(tasks).toHaveLength(0);
  });

  it('check --json includes effectiveStage for active tasks', () => {
    const add = runCli(['add', 'Check task', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };
    runCli(['update', task.id, '--stage', 'committed'], repoDir);

    const check = runCli(['check', '--json'], repoDir);
    expect(check.code).toBe(0);
    const parsed = JSON.parse(check.stdout) as {
      activeTasks: Array<{ id: string; effectiveStage: string }>;
      repoStatus: unknown;
    };
    const found = parsed.activeTasks.find((t) => t.id === task.id);
    expect(found?.effectiveStage).toBe('committed');
  });
});
