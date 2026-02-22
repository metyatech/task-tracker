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

function runCli(args: string[], storage: string): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('node', [CLI, '--storage', storage, ...args], {
    encoding: 'utf-8',
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
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `task-tracker-cli-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('shows version', () => {
    const r = spawnSync('node', [CLI, '--version'], { encoding: 'utf-8' });
    expect(r.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
    expect(r.status).toBe(0);
  });

  it('shows help', () => {
    const r = spawnSync('node', [CLI, '--help'], { encoding: 'utf-8' });
    expect(r.stdout).toContain('task-tracker');
    expect(r.status).toBe(0);
  });

  it('add and list task', () => {
    const add = runCli(['add', 'My first task'], storagePath);
    expect(add.code).toBe(0);
    expect(add.stdout).toContain('Created');

    const list = runCli(['list'], storagePath);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain('My first task');
  });

  it('add with --json output', () => {
    const add = runCli(['add', 'JSON task', '--json'], storagePath);
    expect(add.code).toBe(0);
    const parsed = JSON.parse(add.stdout) as { description: string; stage: string; id: string };
    expect(parsed.description).toBe('JSON task');
    expect(parsed.stage).toBe('pending');
    expect(parsed.id).toHaveLength(8);
  });

  it('update task stage', () => {
    const add = runCli(['add', 'Updateable', '--json'], storagePath);
    const task = JSON.parse(add.stdout) as { id: string };

    const update = runCli(['update', task.id, '--stage', 'in-progress', '--json'], storagePath);
    expect(update.code).toBe(0);
    const updated = JSON.parse(update.stdout) as { stage: string };
    expect(updated.stage).toBe('in-progress');
  });

  it('done command marks task as done', () => {
    const add = runCli(['add', 'Finish me', '--json'], storagePath);
    const task = JSON.parse(add.stdout) as { id: string };

    const done = runCli(['done', task.id], storagePath);
    expect(done.code).toBe(0);

    const list = runCli(['list'], storagePath);
    expect(list.stdout).not.toContain('Finish me');

    const listAll = runCli(['list', '--all'], storagePath);
    expect(listAll.stdout).toContain('Finish me');
  });

  it('remove task', () => {
    const add = runCli(['add', 'Remove me', '--json'], storagePath);
    const task = JSON.parse(add.stdout) as { id: string };

    const remove = runCli(['remove', task.id], storagePath);
    expect(remove.code).toBe(0);

    const list = runCli(['list', '--all'], storagePath);
    expect(list.stdout).not.toContain('Remove me');
  });

  it('check command with temp git repo', () => {
    const repoDir = join(tmpDir, 'myrepo');
    mkdirSync(repoDir, { recursive: true });
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
    };
    spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf-8', env: gitEnv });
    spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: repoDir, env: gitEnv });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir, env: gitEnv });
    writeFileSync(join(repoDir, 'test.txt'), 'hello');
    spawnSync('git', ['add', '.'], { cwd: repoDir, encoding: 'utf-8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--no-gpg-sign'], {
      cwd: repoDir,
      encoding: 'utf-8',
      env: gitEnv,
    });
    writeFileSync(join(repoDir, 'dirty.txt'), 'dirty');

    const check = runCli(['check', '--workspace', tmpDir], storagePath);
    expect(check.code).toBe(0);
    expect(check.stdout).toContain('myrepo');
  });

  it('check command with --json', () => {
    const check = runCli(['check', '--workspace', tmpDir, '--json'], storagePath);
    expect(check.code).toBe(0);
    const parsed = JSON.parse(check.stdout) as {
      activeTasks: unknown[];
      repoStatuses: unknown[];
    };
    expect(parsed).toHaveProperty('activeTasks');
    expect(parsed).toHaveProperty('repoStatuses');
  });
});
