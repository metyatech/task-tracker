import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTask, listTasks, updateTask, removeTask } from '../tasks.js';

describe('tasks', () => {
  let tmpDir: string;
  let storagePath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `task-tracker-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    storagePath = join(tmpDir, 'tasks.jsonl');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a task', () => {
    const task = createTask(storagePath, 'Do something');
    expect(task.id).toHaveLength(8);
    expect(task.description).toBe('Do something');
    expect(task.stage).toBe('pending');
    expect(task.createdAt).toBeTruthy();
  });

  it('creates a task with options', () => {
    const task = createTask(storagePath, 'Deploy', { repo: 'myapp', stage: 'in-progress' });
    expect(task.repo).toBe('myapp');
    expect(task.stage).toBe('in-progress');
  });

  it('lists active tasks (excludes done)', () => {
    createTask(storagePath, 'Active');
    const t2 = createTask(storagePath, 'Done task');
    updateTask(storagePath, t2.id, { stage: 'done' });
    const active = listTasks(storagePath);
    expect(active).toHaveLength(1);
    expect(active[0].description).toBe('Active');
  });

  it('lists all tasks with --all', () => {
    createTask(storagePath, 'Active');
    const t2 = createTask(storagePath, 'Done task');
    updateTask(storagePath, t2.id, { stage: 'done' });
    const all = listTasks(storagePath, { all: true });
    expect(all).toHaveLength(2);
  });

  it('filters by repo', () => {
    createTask(storagePath, 'Repo A task', { repo: 'repoA' });
    createTask(storagePath, 'Repo B task', { repo: 'repoB' });
    const filtered = listTasks(storagePath, { repo: 'repoA' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].repo).toBe('repoA');
  });

  it('updates a task stage', () => {
    const t = createTask(storagePath, 'Update me');
    const updated = updateTask(storagePath, t.id, { stage: 'in-progress' });
    expect(updated?.stage).toBe('in-progress');
    const tasks = listTasks(storagePath);
    expect(tasks[0].stage).toBe('in-progress');
  });

  it('returns null when updating missing task', () => {
    const result = updateTask(storagePath, 'notexist', { stage: 'done' });
    expect(result).toBeNull();
  });

  it('removes a task', () => {
    const t = createTask(storagePath, 'Remove me');
    const removed = removeTask(storagePath, t.id);
    expect(removed).toBe(true);
    expect(listTasks(storagePath)).toHaveLength(0);
  });

  it('returns false when removing missing task', () => {
    const removed = removeTask(storagePath, 'notexist');
    expect(removed).toBe(false);
  });
});
