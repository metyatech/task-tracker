import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { getRepoRoot } from './git.js';
import type { Task } from './types.js';

export function getStoragePath(): string {
  const root = getRepoRoot();
  return join(root, '.tasks.jsonl');
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
    .map((line) => {
      try {
        return JSON.parse(line) as Task;
      } catch {
        process.stderr.write(`[task-tracker] Warning: skipping malformed line in tasks file\n`);
        return null;
      }
    })
    .filter((task): task is Task => task !== null);
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
