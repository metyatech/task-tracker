import { execSync } from 'child_process';
import { join, relative } from 'path';
import type { Task, EffectiveStage } from './types.js';

export interface GitRepoStatus {
  path: string;
  name: string;
  dirty: boolean;
  dirtyFiles: string[];
  unpushed: boolean;
  unpushedCommits: string[];
  error?: string;
}

function tryExec(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

export function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('Not in a git repository. task-tracker requires a git repository.');
  }
}

export function getRepoStatus(repoPath: string): GitRepoStatus {
  const name = repoPath.split(/[\\/]/).pop() ?? repoPath;
  const status: GitRepoStatus = {
    path: repoPath,
    name,
    dirty: false,
    dirtyFiles: [],
    unpushed: false,
    unpushedCommits: [],
  };

  const porcelain = tryExec('git status --porcelain', repoPath);
  if (porcelain === null) {
    status.error = 'git status failed';
    return status;
  }
  if (porcelain) {
    status.dirty = true;
    status.dirtyFiles = porcelain.split('\n').filter(Boolean);
  }

  const unpushed = tryExec('git log @{u}..HEAD --oneline', repoPath);
  if (unpushed !== null && unpushed) {
    status.unpushed = true;
    status.unpushedCommits = unpushed.split('\n').filter(Boolean);
  }

  return status;
}

export function isCommitReachableFromUpstream(repoPath: string, commit: string): boolean {
  // Validate commit hash format to prevent shell injection
  if (!/^[0-9a-f]{4,40}$/i.test(commit)) return false;
  // Exit 0 = commit is ancestor of upstream; exit 1 / error = not reachable or no upstream
  const result = tryExec(`git merge-base --is-ancestor ${commit} @{u}`, repoPath);
  return result !== null;
}

/**
 * Search git history for the commit that introduced `eventId` into the tasks
 * storage file. This is the commit that actually committed .tasks.jsonl after
 * the task was marked as `committed`, making it the correct anchor for
 * `pushed` derivation regardless of when `update --stage committed` was called.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @param storageFile - Absolute path to the .tasks.jsonl file.
 * @param eventId - The committedEventId stored in the task.
 * @returns The full commit hash that first introduced the event ID, or null.
 */
export function findCommitByEventId(
  repoPath: string,
  storageFile: string,
  eventId: string,
): string | null {
  // Validate eventId: nanoid characters only (URL-safe base64 alphabet), 4-64 chars
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(eventId)) return null;
  // Compute repo-relative path using forward slashes (git accepts these on all platforms)
  const relPath = relative(repoPath, storageFile).replace(/\\/g, '/');
  // git log -S <string> finds commits where the occurrence count of <string> changed.
  // Since an eventId is written once and never removed, there is exactly one match —
  // the commit that introduced the event ID into the file.
  const result = tryExec(`git log -S "${eventId}" --format=%H -- "${relPath}"`, repoPath);
  if (!result) return null;
  const hash = result.split('\n')[0].trim();
  return hash || null;
}

export function deriveEffectiveStage(task: Task, repoPath: string): EffectiveStage {
  if (task.stage === 'committed') {
    if (task.committedEventId) {
      const storageFile = join(repoPath, '.tasks.jsonl');
      const commit = findCommitByEventId(repoPath, storageFile, task.committedEventId);
      if (commit && isCommitReachableFromUpstream(repoPath, commit)) {
        return 'pushed';
      }
    }
  }
  return task.stage;
}
