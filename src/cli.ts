import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { getStoragePath } from './storage.js';
import {
  createTask,
  listTasks,
  updateTask,
  removeTask,
  purgeTasks,
  autoPurgeTasks,
} from './tasks.js';
import { getRepoStatus, deriveEffectiveStage } from './git.js';
import { formatTask, formatTaskTable, formatCheckReport } from './format.js';
import { STAGES } from './types.js';
import type { Stage, Task, EffectiveStage } from './types.js';
import { startGui } from './gui.js';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TASK_ID_COMMAND_OPTIONS: Record<string, Record<string, boolean>> = {
  update: {
    '--stage': true,
    '--description': true,
    '--json': false,
  },
  done: {
    '--keep': true,
  },
  remove: {},
};

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

function isDerivedStage(s: string): boolean {
  return s === 'pushed';
}

function derivedStageError(stage: string): string {
  return (
    `\`${stage}\` is a derived stage and cannot be set manually.\n` +
    `Set stage to \`committed\` instead; \`${stage}\` is derived automatically when the ` +
    `commit containing \`committedEventId\` is reachable from the upstream branch.`
  );
}

function getStorage(): string {
  try {
    return getStoragePath();
  } catch (e) {
    console.error(e instanceof Error ? e.message : 'Not in a git repository');
    process.exit(1);
  }
}

function normalizeHyphenatedTaskIdArg(argv: string[]): string[] {
  const commandName = argv[2];
  const optionSpec = TASK_ID_COMMAND_OPTIONS[commandName];

  if (!optionSpec) {
    return argv;
  }

  const args = argv.slice(3);
  if (args.includes('--')) {
    return argv;
  }

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    const consumesValue = optionSpec[token];

    if (consumesValue !== undefined) {
      if (consumesValue) {
        i += 1;
      }
      continue;
    }

    if (!token.startsWith('-')) {
      return argv;
    }

    if (!/^-[^-].*/.test(token)) {
      return argv;
    }

    return [...argv.slice(0, 3), ...args.slice(0, i), ...args.slice(i + 1), '--', token];
  }

  return argv;
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
  .option(
    '--stage <stage>',
    `Initial stage (valid: ${STAGES.join(', ')}; \`pushed\` is derived, not settable)`,
    'pending',
  )
  .option('--json', 'Output created task as JSON')
  .action((description: string, opts: { stage: string; json?: boolean }) => {
    if (isDerivedStage(opts.stage)) {
      console.error(derivedStageError(opts.stage));
      process.exit(1);
    }
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
  .option('--stage <stage>', `Filter by stage; use \`pushed\` to filter by derived effective stage`)
  .option('--json', 'JSON output')
  .action((opts: { all?: boolean; stage?: string; json?: boolean }) => {
    const storage = getStorage();
    const repoRoot = dirname(storage);

    // Special case: 'pushed' is a derived stage — filter committed tasks whose
    // committedEventId is present in a commit reachable from upstream.
    if (opts.stage === 'pushed') {
      const committed = listTasks(storage, { all: opts.all, stage: 'committed' });
      const tasks = committed.filter((t) => deriveEffectiveStage(t, repoRoot) === 'pushed');
      if (opts.json) {
        console.log(
          JSON.stringify(
            tasks.map((t) => ({ ...t, effectiveStage: 'pushed' as EffectiveStage })),
            null,
            2,
          ),
        );
      } else {
        console.log(formatTaskTable(tasks, () => 'pushed'));
      }
      return;
    }

    if (opts.stage && !isValidStage(opts.stage)) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }

    const stage = opts.stage ? (opts.stage as Stage) : undefined;
    const tasks = listTasks(storage, { all: opts.all, stage });
    const getEffective = (t: Task): EffectiveStage => deriveEffectiveStage(t, repoRoot);

    if (opts.json) {
      console.log(
        JSON.stringify(
          tasks.map((t) => ({ ...t, effectiveStage: getEffective(t) })),
          null,
          2,
        ),
      );
    } else {
      console.log(formatTaskTable(tasks, getEffective));
    }
  });

// update
program
  .command('update <id>')
  .description('Update a task')
  .option(
    '--stage <stage>',
    `Set lifecycle stage (valid: ${STAGES.join(', ')}; \`pushed\` is derived, not settable)`,
  )
  .option('--description <text>', 'Update description')
  .option('--json', 'JSON output')
  .action((id: string, opts: { stage?: string; description?: string; json?: boolean }) => {
    if (opts.stage && isDerivedStage(opts.stage)) {
      console.error(derivedStageError(opts.stage));
      process.exit(1);
    }
    if (opts.stage && !isValidStage(opts.stage)) {
      console.error(`Invalid stage: ${opts.stage}\nValid stages: ${STAGES.join(', ')}`);
      process.exit(1);
    }
    const storage = getStorage();
    const updates: { stage?: Stage; description?: string } = {};
    if (opts.stage) updates.stage = opts.stage as Stage;
    if (opts.description) updates.description = opts.description;
    const task = updateTask(storage, id, updates);
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
  .option('--keep <n>', 'Auto-purge: keep N most recent done tasks (0=disabled)', '20')
  .action((id: string, opts: { keep: string }) => {
    const storage = getStorage();
    const task = updateTask(storage, id, { stage: 'done' });
    if (!task) {
      console.error(`Task not found: ${id}`);
      process.exit(1);
    }
    console.log('Done: ' + formatTask(task));
    const keep = parseInt(opts.keep, 10);
    if (!isNaN(keep)) {
      autoPurgeTasks(storage, { keep });
    }
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
    const getEffective = (t: Task): EffectiveStage => deriveEffectiveStage(t, repoRoot);
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            activeTasks: activeTasks.map((t) => ({ ...t, effectiveStage: getEffective(t) })),
            repoStatus,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(formatCheckReport(activeTasks, repoStatus, getEffective));
    }
  });

// purge
program
  .command('purge')
  .description('Remove all done tasks from storage')
  .option('--dry-run', 'Show what would be removed without removing')
  .option('--keep <n>', 'Keep N most recent done tasks, purge the rest')
  .option('--json', 'JSON output')
  .action((opts: { dryRun?: boolean; keep?: string; json?: boolean }) => {
    const keep = opts.keep !== undefined ? parseInt(opts.keep, 10) : undefined;
    const result = purgeTasks(getStorage(), { dryRun: opts.dryRun, keep });
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

program.parse(normalizeHyphenatedTaskIdArg(process.argv));
