import { nanoid } from 'nanoid';
import { readTasks, writeTasks, addTaskToStorage } from './storage.js';
import type { Task, Stage } from './types.js';
import { DONE_STAGES } from './types.js';

export function createTask(
  storagePath: string,
  description: string,
  options: { stage?: Stage } = {},
): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: nanoid(8),
    description,
    stage: options.stage ?? 'pending',
    createdAt: now,
    updatedAt: now,
  };
  addTaskToStorage(storagePath, task);
  return task;
}

export function listTasks(
  storagePath: string,
  options: { all?: boolean; stage?: Stage } = {},
): Task[] {
  let tasks = readTasks(storagePath);
  if (!options.all) {
    tasks = tasks.filter((t) => !DONE_STAGES.includes(t.stage));
  }
  if (options.stage) {
    tasks = tasks.filter((t) => t.stage === options.stage);
  }
  return tasks;
}

export function updateTask(
  storagePath: string,
  id: string,
  updates: { stage?: Stage; description?: string },
): Task | null {
  const tasks = readTasks(storagePath);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const task = tasks[idx];
  if (updates.stage !== undefined) task.stage = updates.stage;
  if (updates.description !== undefined) task.description = updates.description;
  task.updatedAt = new Date().toISOString();
  writeTasks(storagePath, tasks);
  return task;
}

export function removeTask(storagePath: string, id: string): boolean {
  const tasks = readTasks(storagePath);
  const filtered = tasks.filter((t) => t.id !== id);
  if (filtered.length === tasks.length) return false;
  writeTasks(storagePath, filtered);
  return true;
}

export function purgeTasks(
  storagePath: string,
  options: { dryRun?: boolean; keep?: number } = {},
): { purged: Task[]; count: number } {
  const tasks = readTasks(storagePath);
  const doneTasks = tasks.filter((t) => DONE_STAGES.includes(t.stage));

  let toPurge: Task[];
  if (options.keep !== undefined) {
    const sorted = [...doneTasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    toPurge = sorted.slice(options.keep);
  } else {
    toPurge = doneTasks;
  }

  if (!options.dryRun && toPurge.length > 0) {
    const purgeIds = new Set(toPurge.map((t) => t.id));
    const remaining = tasks.filter((t) => !purgeIds.has(t.id));
    writeTasks(storagePath, remaining);
  }
  return { purged: toPurge, count: toPurge.length };
}

export function autoPurgeTasks(
  storagePath: string,
  options: { keep?: number } = {},
): { purged: Task[]; count: number } {
  const keep = options.keep ?? 20;
  if (keep === 0) {
    return { purged: [], count: 0 };
  }
  return purgeTasks(storagePath, { keep });
}
