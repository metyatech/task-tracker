import chalk from 'chalk';
import type { Task, EffectiveStage } from './types.js';
import type { GitRepoStatus } from './git.js';

const STAGE_COLORS: Record<string, (s: string) => string> = {
  pending: (s) => chalk.gray(s),
  'in-progress': (s) => chalk.blue(s),
  committed: (s) => chalk.magenta(s),
  pushed: (s) => chalk.green(s),
  released: (s) => chalk.blueBright(s),
  done: (s) => chalk.dim(s),
};

export function stageColor(stage: string): string {
  const fn = STAGE_COLORS[stage] ?? ((s: string) => chalk.white(s));
  return fn(stage);
}

export function formatTask(task: Task, effectiveStage?: EffectiveStage): string {
  const displayStage = effectiveStage ?? task.stage;
  const stage = stageColor(displayStage);
  const id = chalk.bold(task.id);
  return `${id}  ${stage}  ${task.description}`;
}

export function formatTaskTable(
  tasks: Task[],
  getEffectiveStage?: (t: Task) => EffectiveStage,
): string {
  if (tasks.length === 0) {
    return chalk.dim('No tasks found.');
  }
  return tasks.map((t) => formatTask(t, getEffectiveStage?.(t))).join('\n');
}

export function formatCheckReport(
  activeTasks: Task[],
  repoStatus: GitRepoStatus,
  getEffectiveStage?: (t: Task) => EffectiveStage,
): string {
  const lines: string[] = [];

  lines.push(chalk.bold('=== Task Tracker Check ==='));
  lines.push('');

  lines.push(chalk.bold(`Active Tasks (${activeTasks.length}):`));
  if (activeTasks.length === 0) {
    lines.push(chalk.dim('  No active tasks.'));
  } else {
    for (const t of activeTasks) {
      lines.push('  ' + formatTask(t, getEffectiveStage?.(t)));
    }
  }
  lines.push('');

  lines.push(chalk.bold(`Git Status (${repoStatus.name}):`));
  if (repoStatus.error) {
    lines.push(chalk.red(`  Error: ${repoStatus.error}`));
  } else if (!repoStatus.dirty && !repoStatus.unpushed) {
    lines.push(chalk.green('  Clean.'));
  } else {
    if (repoStatus.dirty) {
      lines.push(chalk.red(`  Uncommitted changes (${repoStatus.dirtyFiles.length} files):`));
      for (const f of repoStatus.dirtyFiles.slice(0, 5)) {
        lines.push(chalk.dim(`    ${f}`));
      }
      if (repoStatus.dirtyFiles.length > 5) {
        lines.push(chalk.dim(`    ... and ${repoStatus.dirtyFiles.length - 5} more`));
      }
    }
    if (repoStatus.unpushed) {
      lines.push(chalk.blue(`  Unpushed commits (${repoStatus.unpushedCommits.length}):`));
      for (const c of repoStatus.unpushedCommits.slice(0, 5)) {
        lines.push(chalk.dim(`    ${c}`));
      }
    }
  }

  return lines.join('\n');
}
