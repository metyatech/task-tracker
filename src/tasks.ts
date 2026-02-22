import { nanoid } from 'nanoid';
import { readTasks, writeTasks, addTaskToStorage } from './storage.js';
import type { Task, Stage } from './types.js';
import { DONE_STAGES } from './types.js';

export function createTask(
  storagePath: string,
  description: string,
  options: { repo?: string; stage?: Stage } = {},
): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: nanoid(8),
    description,
    stage: options.stage ?? 'pending',
    createdAt: now,
    updatedAt: now,
  };
  if (options.repo) task.repo = options.repo;
  addTaskToStorage(storagePath, task);
  return task;
}

export function listTasks(
  storagePath: string,
  options: { all?: boolean; repo?: string; stage?: Stage } = {},
): Task[] {
  let tasks = readTasks(storagePath);
  if (!options.all) {
    tasks = tasks.filter((t) => !DONE_STAGES.includes(t.stage));
  }
  if (options.repo) {
    tasks = tasks.filter((t) => t.repo === options.repo);
  }
  if (options.stage) {
    tasks = tasks.filter((t) => t.stage === options.stage);
  }
  return tasks;
}

export function updateTask(
  storagePath: string,
  id: string,
  updates: { stage?: Stage; description?: string; repo?: string },
): Task | null {
  const tasks = readTasks(storagePath);
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const task = tasks[idx];
  if (updates.stage !== undefined) task.stage = updates.stage;
  if (updates.description !== undefined) task.description = updates.description;
  if (updates.repo !== undefined) task.repo = updates.repo;
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
