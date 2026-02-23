import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface TaskFileInfo {
  path: string;
  dir: string;
  name: string;
}

export interface ScanResult {
  root: TaskFileInfo | null;
  repos: TaskFileInfo[];
}

export function scanTaskFiles(dir: string): ScanResult {
  const rootFile = join(dir, '.tasks.jsonl');
  const root: TaskFileInfo | null = existsSync(rootFile)
    ? { path: rootFile, dir, name: basename(dir) }
    : null;

  const repos: TaskFileInfo[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const subDir = join(dir, entry);
      try {
        if (statSync(subDir).isDirectory()) {
          const taskFile = join(subDir, '.tasks.jsonl');
          if (existsSync(taskFile)) {
            repos.push({ path: taskFile, dir: subDir, name: entry });
          }
        }
      } catch {
        // ignore inaccessible entries
      }
    }
  } catch {
    // ignore if dir is not readable
  }

  return { root, repos };
}
