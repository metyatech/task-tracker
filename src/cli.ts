import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { getStoragePath } from './storage.js';
import { createTask, listTasks, updateTask, removeTask, purgeTasks } from './tasks.js';
import { getRepoStatus } from './git.js';
import { formatTask, formatTaskTable, formatCheckReport } from './format.js';
import { STAGES } from './types.js';
import type { Stage } from './types.js';
import { startGui } from './gui.js';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as {
    version: string;
  };
  version = pkg.version;
} catch {
  // ignore
}

function isValidStage(s: string): s is Stage {
  return (STAGES as string[]).includes(s);
}

function getStorage(): string {
  try {
    return getStoragePath();
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'Not in a git repository');
    process.exit(1);
  }
}

const program = new Command();

program
  .name('task-tracker')
  .description('Persistent task lifecycle tracker for AI agent sessions')
  .version(version, '-V, --version');

// add
program
  .command('add <description>')
  .description('Add a new task')
  .option('--stage <stage>', 'Initial stage', 'pending')
  .option('--json', 'Output created task as JSON')
  .action((description: string, opts: { stage: string; json?: boolean }) => {
    if (!isValidStage(opts.stage)) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const task = createTask(getStorage(), description, { stage: opts.stage as Stage });
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log('Created: ' + formatTask(task));
    }
  });

// list
program
  .command('list')
  .description('List tasks')
  .option('--all', 'Include completed/done tasks')
  .option('--stage <stage>', 'Filter by stage')
  .option('--json', 'JSON output')
  .action((opts: { all?: boolean; stage?: string; json?: boolean }) => {
    const stage = opts.stage && isValidStage(opts.stage) ? (opts.stage as Stage) : undefined;
    if (opts.stage && !stage) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const tasks = listTasks(getStorage(), { all: opts.all, stage });
    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      console.log(formatTaskTable(tasks));
    }
  });

// update
program
  .command('update <id>')
  .description('Update a task')
  .option('--stage <stage>', 'Set lifecycle stage')
  .option('--description <text>', 'Update description')
  .option('--json', 'JSON output')
  .action((id: string, opts: { stage?: string; description?: string; json?: boolean }) => {
    if (opts.stage && !isValidStage(opts.stage)) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const updates: { stage?: Stage; description?: string } = {};
    if (opts.stage) updates.stage = opts.stage as Stage;
    if (opts.description) updates.description = opts.description;
    const task = updateTask(getStorage(), id, updates);
    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    if (opts.json) {
      console.log(JSON.stringify(task, null, 2));
    } else {
      console.log('Updated: ' + formatTask(task));
    }
  });

// done
program
  .command('done <id>')
  .description('Mark task as done')
  .action((id: string) => {
    const task = updateTask(getStorage(), id, { stage: 'done' });
    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    console.log('Done: ' + formatTask(task));
  });

// remove
program
  .command('remove <id>')
  .description('Remove a task permanently')
  .action((id: string) => {
    const removed = removeTask(getStorage(), id);
    if (!removed) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    console.log(`Removed task: ${id}`);
  });

// check
program
  .command('check')
  .description('Show active tasks and git status for this repo')
  .option('--json', 'JSON output')
  .action((opts: { json?: boolean }) => {
    const storage = getStorage();
    const repoRoot = dirname(storage);
    const activeTasks = listTasks(storage, { all: false });
    const repoStatus = getRepoStatus(repoRoot);
    if (opts.json) {
      console.log(JSON.stringify({ activeTasks, repoStatus }, null, 2));
    } else {
      console.log(formatCheckReport(activeTasks, repoStatus));
    }
  });

// purge
program
  .command('purge')
  .description('Remove all done tasks from storage')
  .option('--dry-run', 'Show what would be removed without removing')
  .option('--json', 'JSON output')
  .action((opts: { dryRun?: boolean; json?: boolean }) => {
    const result = purgeTasks(getStorage(), { dryRun: opts.dryRun });
    const ids = result.purged.map((t) => t.id);
    if (opts.json) {
      console.log(JSON.stringify({ count: result.count, ids }));
    } else if (opts.dryRun) {
      if (result.count === 0) {
        console.log('No done tasks to purge.');
      } else {
        console.log(`Would purge ${result.count} task(s): ${ids.join(', ')}`);
      }
    } else {
      if (result.count === 0) {
        console.log('No done tasks to purge.');
      } else {
        console.log(`Purged ${result.count} task(s): ${ids.join(', ')}`);
      }
    }
  });

// gui
program
  .command('gui [dir]')
  .description('Start the web GUI (defaults to current directory)')
  .option('--port <port>', 'Port to listen on', '3333')
  .action((dir: string | undefined, opts: { port: string }) => {
    const targetDir = dir ?? process.cwd();
    const port = parseInt(opts.port, 10) || 3333;
    startGui(targetDir, port);
  });

program.parse(process.argv);
