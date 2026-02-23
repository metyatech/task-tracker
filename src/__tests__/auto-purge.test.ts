import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTask, updateTask, autoPurgeTasks, purgeTasks, listTasks } from '../tasks.js';
import { readTasks, writeTasks } from '../storage.js';

describe('autoPurgeTasks', () => {
  let tmpDir: string;
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tt-auto-purge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('purges oldest done tasks keeping N most recent', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = autoPurgeTasks(storagePath, { keep: 3 });
    expect(result.count).toBe(2);

    const remaining = listTasks(storagePath, { all: true });
    expect(remaining).toHaveLength(3);

    const purgedIds = new Set(result.purged.map((t) => t.id));
    remaining.forEach((t) => expect(purgedIds.has(t.id)).toBe(false));
  });

  it('does not purge when fewer than keep done tasks exist', () => {
    const tasks = ['A', 'B'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = autoPurgeTasks(storagePath, { keep: 5 });
    expect(result.count).toBe(0);
    expect(listTasks(storagePath, { all: true })).toHaveLength(2);
  });

  it('does not purge when keep=0 (disabled)', () => {
    const tasks = ['A', 'B', 'C'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = autoPurgeTasks(storagePath, { keep: 0 });
    expect(result.count).toBe(0);
    expect(listTasks(storagePath, { all: true })).toHaveLength(3);
  });

  it('uses default keep=20 and purges excess', () => {
    const tasks = Array.from({ length: 25 }, (_, i) => createTask(storagePath, `Task ${i}`));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = autoPurgeTasks(storagePath);
    expect(result.count).toBe(5);
    expect(listTasks(storagePath, { all: true })).toHaveLength(20);
  });

  it('uses default keep=20 and purges nothing when fewer than 20 done tasks', () => {
    const tasks = Array.from({ length: 15 }, (_, i) => createTask(storagePath, `Task ${i}`));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = autoPurgeTasks(storagePath);
    expect(result.count).toBe(0);
    expect(listTasks(storagePath, { all: true })).toHaveLength(15);
  });

  it('preserves non-done tasks', () => {
    const active = createTask(storagePath, 'Active task');
    const tasks = ['A', 'B', 'C'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    autoPurgeTasks(storagePath, { keep: 1 });

    const all = listTasks(storagePath, { all: true });
    expect(all.some((t) => t.id === active.id)).toBe(true);
  });

  it('keeps the most recently updated tasks', () => {
    const t1 = createTask(storagePath, 'First');
    const t2 = createTask(storagePath, 'Second');
    const t3 = createTask(storagePath, 'Third');
    updateTask(storagePath, t1.id, { stage: 'done' });
    updateTask(storagePath, t2.id, { stage: 'done' });
    updateTask(storagePath, t3.id, { stage: 'done' });
    // Set explicit updatedAt to ensure deterministic ordering (t3 = newest)
    const tasks = readTasks(storagePath).map((t, i) => ({
      ...t,
      updatedAt: `2024-01-0${i + 1}T00:00:00.000Z`,
    }));
    writeTasks(storagePath, tasks);
    const newestId = tasks[2].id; // index 2 = t3, has 2024-01-03 (latest)

    autoPurgeTasks(storagePath, { keep: 1 });

    const remaining = listTasks(storagePath, { all: true });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(newestId);
  });
});

describe('purgeTasks with keep option', () => {
  let tmpDir: string;
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tt-purge-keep-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('purge with keep=N keeps N most recent done tasks', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = purgeTasks(storagePath, { keep: 2 });
    expect(result.count).toBe(3);
    expect(listTasks(storagePath, { all: true })).toHaveLength(2);
  });

  it('purge without keep purges all done tasks (existing behaviour)', () => {
    const tasks = ['A', 'B', 'C'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = purgeTasks(storagePath);
    expect(result.count).toBe(3);
    expect(listTasks(storagePath, { all: true })).toHaveLength(0);
  });

  it('purge with keep=N and fewer than N done tasks purges nothing', () => {
    const tasks = ['A', 'B'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = purgeTasks(storagePath, { keep: 5 });
    expect(result.count).toBe(0);
    expect(listTasks(storagePath, { all: true })).toHaveLength(2);
  });

  it('purge with keep and dry-run reports but does not remove', () => {
    const tasks = ['A', 'B', 'C'].map((d) => createTask(storagePath, d));
    tasks.forEach((t) => updateTask(storagePath, t.id, { stage: 'done' }));

    const result = purgeTasks(storagePath, { keep: 1, dryRun: true });
    expect(result.count).toBe(2);
    expect(listTasks(storagePath, { all: true })).toHaveLength(3);
  });
});
