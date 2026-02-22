import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readTasks, writeTasks, addTaskToStorage } from '../storage.js';
import type { Task } from '../types.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test1234',
    description: 'Test task',
    stage: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('storage', () => {
  let tmpDir: string;
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tt-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads empty storage', () => {
    expect(readTasks(storagePath)).toEqual([]);
  });

  it('writes and reads tasks', () => {
    const tasks = [makeTask({ id: 'aaa' }), makeTask({ id: 'bbb', description: 'Second' })];
    writeTasks(storagePath, tasks);
    const read = readTasks(storagePath);
    expect(read).toHaveLength(2);
    expect(read[0].id).toBe('aaa');
    expect(read[1].id).toBe('bbb');
  });

  it('appends a task', () => {
    const t1 = makeTask({ id: 'first' });
    const t2 = makeTask({ id: 'second' });
    addTaskToStorage(storagePath, t1);
    addTaskToStorage(storagePath, t2);
    const tasks = readTasks(storagePath);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('first');
    expect(tasks[1].id).toBe('second');
  });

  it('overwrites on writeTasks', () => {
    writeTasks(storagePath, [makeTask({ id: 'old' })]);
    writeTasks(storagePath, [makeTask({ id: 'new' })]);
    const tasks = readTasks(storagePath);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('new');
  });
});
