import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { Task } from './types.js';

export function getDefaultStoragePath(): string {
  return join(homedir(), '.task-tracker', 'tasks.jsonl');
}

export function ensureStorageDir(storagePath: string): void {
  const dir = dirname(storagePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readTasks(storagePath: string): Task[] {
  ensureStorageDir(storagePath);
  if (!existsSync(storagePath)) {
    return [];
  }
  const content = readFileSync(storagePath, 'utf-8').trim();
  if (!content) return [];
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Task);
}

export function writeTasks(storagePath: string, tasks: Task[]): void {
  ensureStorageDir(storagePath);
  const content = tasks.map((t) => JSON.stringify(t)).join('\n');
  writeFileSync(storagePath, content ? content + '\n' : '', 'utf-8');
}

export function addTaskToStorage(storagePath: string, task: Task): void {
  ensureStorageDir(storagePath);
  appendFileSync(storagePath, JSON.stringify(task) + '\n', 'utf-8');
}
