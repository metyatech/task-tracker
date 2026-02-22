import chalk from 'chalk';
import type { Task } from './types.js';
import type { GitRepoStatus } from './git.js';

const STAGE_COLORS: Record<string, (s: string) => string> = {
  pending: (s) => chalk.gray(s),
  'in-progress': (s) => chalk.blue(s),
  implemented: (s) => chalk.cyan(s),
  verified: (s) => chalk.yellow(s),
  committed: (s) => chalk.magenta(s),
  pushed: (s) => chalk.green(s),
  'pr-created': (s) => chalk.greenBright(s),
  merged: (s) => chalk.green(s),
  released: (s) => chalk.blueBright(s),
  published: (s) => chalk.greenBright(s),
  done: (s) => chalk.dim(s),
};

export function stageColor(stage: string): string {
  const fn = STAGE_COLORS[stage] ?? ((s: string) => chalk.white(s));
  return fn(stage);
}

export function formatTask(task: Task): string {
  const repo = task.repo ? chalk.dim(` [${task.repo}]`) : '';
  const stage = stageColor(task.stage);
  const id = chalk.bold(task.id);
  return `${id}  ${stage}${repo}  ${task.description}`;
}

export function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return chalk.dim('No tasks found.');
  }
  return tasks.map(formatTask).join('\n');
}

export function formatCheckReport(activeTasks: Task[], repoStatuses: GitRepoStatus[]): string {
  const lines: string[] = [];

  lines.push(chalk.bold('=== Task Tracker Check ==='));
  lines.push('');

  lines.push(chalk.bold(`Active Tasks (${activeTasks.length}):`));
  if (activeTasks.length === 0) {
    lines.push(chalk.dim('  No active tasks.'));
  } else {
    for (const t of activeTasks) {
      lines.push('  ' + formatTask(t));
    }
  }
  lines.push('');

  const dirty = repoStatuses.filter((r) => r.dirty || r.unpushed || r.error);
  lines.push(chalk.bold(`Workspace Git Status (${repoStatuses.length} repos scanned):`));
  if (dirty.length === 0) {
    lines.push(chalk.green('  All repos clean.'));
  } else {
    for (const r of dirty) {
      lines.push(chalk.yellow(`  ${r.name} (${r.path}):`));
      if (r.error) {
        lines.push(chalk.red(`    Error: ${r.error}`));
      }
      if (r.dirty) {
        lines.push(chalk.red(`    Uncommitted changes (${r.dirtyFiles.length} files)`));
        for (const f of r.dirtyFiles.slice(0, 5)) {
          lines.push(chalk.dim(`      ${f}`));
        }
        if (r.dirtyFiles.length > 5) {
          lines.push(chalk.dim(`      ... and ${r.dirtyFiles.length - 5} more`));
        }
      }
      if (r.unpushed) {
        lines.push(chalk.blue(`    Unpushed commits (${r.unpushedCommits.length}):`));
        for (const c of r.unpushedCommits.slice(0, 5)) {
          lines.push(chalk.dim(`      ${c}`));
        }
      }
    }
  }

  return lines.join('\n');
}
