import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI = join(__dirname, '..', '..', 'dist', 'cli.js');

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

describe('CLI integration', () => {
  let tmpDir: string;
  let repoDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `task-tracker-cli-test-${Date.now()}`);
    repoDir = join(tmpDir, 'repo');
    initGitRepo(repoDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

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

  it('remove task', () => {
    const add = runCli(['add', 'Remove me', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };

    const remove = runCli(['remove', task.id], repoDir);
    expect(remove.code).toBe(0);

    const list = runCli(['list', '--all'], repoDir);
    expect(list.stdout).not.toContain('Remove me');
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

  it('purge removes done tasks', () => {
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
  });

  it('purge --dry-run does not remove tasks', () => {
    const add = runCli(['add', 'To purge', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };
    runCli(['done', task.id], repoDir);

    const dryRun = runCli(['purge', '--dry-run'], repoDir);
    expect(dryRun.code).toBe(0);
    expect(dryRun.stdout).toContain('Would purge 1 task(s)');

    const listAll = runCli(['list', '--all'], repoDir);
    expect(listAll.stdout).toContain('To purge');
  });

  it('purge --json outputs structured result', () => {
    const add = runCli(['add', 'Done JSON task', '--json'], repoDir);
    const task = JSON.parse(add.stdout) as { id: string };
    runCli(['done', task.id], repoDir);

    const purge = runCli(['purge', '--json'], repoDir);
    expect(purge.code).toBe(0);
    const parsed = JSON.parse(purge.stdout) as { count: number; ids: string[] };
    expect(parsed.count).toBe(1);
    expect(parsed.ids).toContain(task.id);
  });

  it('purge with no done tasks outputs appropriate message', () => {
    runCli(['add', 'Just active'], repoDir);

    const purge = runCli(['purge'], repoDir);
    expect(purge.code).toBe(0);
    expect(purge.stdout).toContain('No done tasks to purge');
  });
});
