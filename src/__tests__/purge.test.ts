import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTask, updateTask, purgeTasks, listTasks } from '../tasks.js';

describe('purgeTasks', () => {
  let tmpDir: string;
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tt-purge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns zero count when no done tasks exist', () => {
    createTask(storagePath, 'Active task');
    const result = purgeTasks(storagePath);
    expect(result.count).toBe(0);
    expect(result.purged).toHaveLength(0);
  });

  it('removes done tasks and returns their IDs', () => {
    const t1 = createTask(storagePath, 'Keep me');
    const t2 = createTask(storagePath, 'Done 1');
    const t3 = createTask(storagePath, 'Done 2');
    updateTask(storagePath, t2.id, { stage: 'done' });
    updateTask(storagePath, t3.id, { stage: 'done' });

    const result = purgeTasks(storagePath);
    expect(result.count).toBe(2);
    expect(result.purged.map((t) => t.id)).toContain(t2.id);
    expect(result.purged.map((t) => t.id)).toContain(t3.id);

    const remaining = listTasks(storagePath, { all: true });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(t1.id);
  });

  it('dry-run reports done tasks without removing them', () => {
    const t1 = createTask(storagePath, 'Done task');
    updateTask(storagePath, t1.id, { stage: 'done' });

    const result = purgeTasks(storagePath, { dryRun: true });
    expect(result.count).toBe(1);
    expect(result.purged[0].id).toBe(t1.id);

    // Task should still be in storage
    const all = listTasks(storagePath, { all: true });
    expect(all).toHaveLength(1);
  });

  it('does not remove non-done tasks', () => {
    createTask(storagePath, 'Pending');
    const t2 = createTask(storagePath, 'In progress');
    updateTask(storagePath, t2.id, { stage: 'in-progress' });
    const t3 = createTask(storagePath, 'Published');
    updateTask(storagePath, t3.id, { stage: 'published' });

    const result = purgeTasks(storagePath);
    expect(result.count).toBe(0);
    expect(listTasks(storagePath, { all: true })).toHaveLength(3);
  });

  it('purges all tasks when all are done', () => {
    const tasks = ['A', 'B', 'C'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = purgeTasks(storagePath);
    expect(result.count).toBe(3);
    expect(listTasks(storagePath, { all: true })).toHaveLength(0);
  });

  it('works on empty storage', () => {
    const result = purgeTasks(storagePath);
    expect(result.count).toBe(0);
    expect(result.purged).toHaveLength(0);
  });
});
