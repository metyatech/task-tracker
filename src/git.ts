import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

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

export function scanWorkspace(workspaceDir: string): GitRepoStatus[] {
  const results: GitRepoStatus[] = [];

  if (existsSync(join(workspaceDir, '.git'))) {
    results.push(getRepoStatus(workspaceDir));
  }

  try {
    const entries = readdirSync(workspaceDir);
    for (const entry of entries) {
      const fullPath = join(workspaceDir, entry);
      try {
        const st = statSync(fullPath);
        if (st.isDirectory() && existsSync(join(fullPath, '.git'))) {
          if (fullPath !== workspaceDir) {
            results.push(getRepoStatus(fullPath));
          }
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // skip
  }

  return results;
}
