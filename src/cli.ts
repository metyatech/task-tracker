import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { getDefaultStoragePath, ensureStorageDir } from './storage.js';
import { createTask, listTasks, updateTask, removeTask } from './tasks.js';
import { scanWorkspace } from './git.js';
import { formatTask, formatTaskTable, formatCheckReport } from './format.js';
import { STAGES } from './types.js';
import type { Stage } from './types.js';
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

const program = new Command();

program
  .name('task-tracker')
  .description('Persistent task lifecycle tracker for AI agent sessions')
  .version(version, '-V, --version')
  .option('--storage <path>', 'Override storage location');

function getStorage(): string {
  const opts = program.opts<{ storage?: string }>();
  return opts.storage ?? getDefaultStoragePath();
}

// init
program
  .command('init')
  .description('Initialize storage directory')
  .action(() => {
    const storage = getStorage();
    ensureStorageDir(storage);
    console.log(`Storage initialized at: ${storage}`);
  });

// add
program
  .command('add <description>')
  .description('Add a new task')
  .option('--repo <name>', 'Associate with a repository')
  .option('--stage <stage>', 'Initial stage', 'pending')
  .option('--json', 'Output created task as JSON')
  .action((description: string, opts: { repo?: string; stage: string; json?: boolean }) => {
    if (!isValidStage(opts.stage)) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const task = createTask(getStorage(), description, {
      repo: opts.repo,
      stage: opts.stage as Stage,
    });
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
  .option('--repo <name>', 'Filter by repository')
  .option('--stage <stage>', 'Filter by stage')
  .option('--json', 'JSON output')
  .action((opts: { all?: boolean; repo?: string; stage?: string; json?: boolean }) => {
    const stage = opts.stage && isValidStage(opts.stage) ? (opts.stage as Stage) : undefined;
    if (opts.stage && !stage) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const tasks = listTasks(getStorage(), { all: opts.all, repo: opts.repo, stage });
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
  .option('--repo <name>', 'Update repo association')
  .option('--json', 'JSON output')
  .action(
    (id: string, opts: { stage?: string; description?: string; repo?: string; json?: boolean }) => {
      if (opts.stage && !isValidStage(opts.stage)) {
        console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
        process.exit(1);
      }
      const updates: { stage?: Stage; description?: string; repo?: string } = {};
      if (opts.stage) updates.stage = opts.stage as Stage;
      if (opts.description) updates.description = opts.description;
      if (opts.repo) updates.repo = opts.repo;
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
    },
  );

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
  .description('Comprehensive stale work check')
  .option('--workspace <dir>', 'Workspace directory to scan', process.cwd())
  .option('--json', 'JSON output')
  .action((opts: { workspace: string; json?: boolean }) => {
    const activeTasks = listTasks(getStorage(), { all: false });
    const repoStatuses = scanWorkspace(opts.workspace);
    if (opts.json) {
      console.log(JSON.stringify({ activeTasks, repoStatuses }, null, 2));
    } else {
      console.log(formatCheckReport(activeTasks, repoStatuses));
    }
  });

program.parse(process.argv);
