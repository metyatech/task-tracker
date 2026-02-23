import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanTaskFiles } from '../scanner.js';

describe('scanTaskFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tt-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null root when no .tasks.jsonl in root dir', () => {
    const result = scanTaskFiles(tmpDir);
    expect(result.root).toBeNull();
    expect(result.repos).toHaveLength(0);
  });

  it('returns root when .tasks.jsonl exists in root dir', () => {
    const taskFile = join(tmpDir, '.tasks.jsonl');
    writeFileSync(taskFile, '');

    const result = scanTaskFiles(tmpDir);
    expect(result.root).not.toBeNull();
    expect(result.root!.path).toBe(taskFile);
    expect(result.root!.dir).toBe(tmpDir);
  });

  it('finds .tasks.jsonl in immediate subdirectories', () => {
    const subDir = join(tmpDir, 'my-repo');
    mkdirSync(subDir);
    writeFileSync(join(subDir, '.tasks.jsonl'), '');

    const result = scanTaskFiles(tmpDir);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].name).toBe('my-repo');
    expect(result.repos[0].dir).toBe(subDir);
  });

  it('finds multiple subdirectories with .tasks.jsonl', () => {
    const dirs = ['repo-a', 'repo-b', 'repo-c'];
    dirs.forEach((d) => {
      const sub = join(tmpDir, d);
      mkdirSync(sub);
      writeFileSync(join(sub, '.tasks.jsonl'), '');
    });

    const result = scanTaskFiles(tmpDir);
    expect(result.repos).toHaveLength(3);
    const names = result.repos.map((r) => r.name).sort();
    expect(names).toEqual(['repo-a', 'repo-b', 'repo-c']);
  });

  it('skips subdirectories without .tasks.jsonl', () => {
    mkdirSync(join(tmpDir, 'no-tasks'));
    const withTasks = join(tmpDir, 'with-tasks');
    mkdirSync(withTasks);
    writeFileSync(join(withTasks, '.tasks.jsonl'), '');

    const result = scanTaskFiles(tmpDir);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].name).toBe('with-tasks');
  });

  it('does not recurse into nested subdirectories', () => {
    const nested = join(tmpDir, 'level1', 'level2');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, '.tasks.jsonl'), '');

    const result = scanTaskFiles(tmpDir);
    // level1 has no .tasks.jsonl so it's not a repo; level2 is nested and ignored
    expect(result.repos).toHaveLength(0);
  });

  it('skips hidden directories (starting with .)', () => {
    const hidden = join(tmpDir, '.git');
    mkdirSync(hidden);
    writeFileSync(join(hidden, '.tasks.jsonl'), '');

    const result = scanTaskFiles(tmpDir);
    expect(result.repos).toHaveLength(0);
  });

  it('returns both root and repos when both exist', () => {
    writeFileSync(join(tmpDir, '.tasks.jsonl'), '');
    const sub = join(tmpDir, 'sub-repo');
    mkdirSync(sub);
    writeFileSync(join(sub, '.tasks.jsonl'), '');

    const result = scanTaskFiles(tmpDir);
    expect(result.root).not.toBeNull();
    expect(result.repos).toHaveLength(1);
  });
});
