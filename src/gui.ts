import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { scanTaskFiles } from './scanner.js';
import { readTasks } from './storage.js';
import { createTask, updateTask, removeTask, purgeTasks } from './tasks.js';
import { STAGES } from './types.js';
import type { Stage } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getHtmlPath(): string {
  const candidates = [
    join(__dirname, 'public', 'index.html'),
    join(__dirname, '..', 'public', 'index.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not find public/index.html. Make sure the public/ directory exists.');
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, message: string, status = 400): void {
  sendJson(res, { error: message }, status);
}

function tryListen(server: Server, port: number, maxAttempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('error', onError);
      if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
        tryListen(server, port + 1, maxAttempts - 1).then(resolve, reject);
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(port);
    });
  });
}

function openBrowser(url: string): void {
  let cmd: string;
  if (process.platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit: ${url}`);
    }
  });
}

export function startGui(dir: string, port = 3333): void {
  const resolvedDir = resolve(dir);

  const server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const method = req.method ?? 'GET';
      const pathname = url.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        // GET / — serve HTML
        if (pathname === '/' && method === 'GET') {
          const html = readFileSync(getHtmlPath(), 'utf-8');
          const injected = html.replace('__GUI_DIR__', JSON.stringify(resolvedDir));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(injected);
          return;
        }

        // GET /api/tasks
        if (pathname === '/api/tasks' && method === 'GET') {
          const queryDir = url.searchParams.get('dir') ?? resolvedDir;
          const scan = scanTaskFiles(queryDir);
          const result = {
            root: scan.root
              ? {
                  path: scan.root.path,
                  dir: scan.root.dir,
                  name: scan.root.name,
                  tasks: readTasks(scan.root.path),
                }
              : null,
            repos: scan.repos.map((r) => ({
              path: r.path,
              dir: r.dir,
              name: r.name,
              tasks: readTasks(r.path),
            })),
          };
          sendJson(res, result);
          return;
        }

        // POST /api/tasks/purge — must come before the /:id route
        if (pathname === '/api/tasks/purge' && method === 'POST') {
          const body = await parseBody(req);
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const taskFile = join(targetDir, '.tasks.jsonl');
          const result = purgeTasks(taskFile);
          sendJson(res, { count: result.count, ids: result.purged.map((t) => t.id) });
          return;
        }

        // POST /api/tasks
        if (pathname === '/api/tasks' && method === 'POST') {
          const body = await parseBody(req);
          if (typeof body.description !== 'string' || !body.description) {
            sendError(res, 'description is required');
            return;
          }
          const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
          const taskFile = join(targetDir, '.tasks.jsonl');
          const stage =
            typeof body.stage === 'string' && (STAGES as string[]).includes(body.stage)
              ? (body.stage as Stage)
              : undefined;
          const task = createTask(taskFile, body.description, { stage });
          sendJson(res, task, 201);
          return;
        }

        // PUT or DELETE /api/tasks/:id
        const taskIdMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
        if (taskIdMatch) {
          const id = taskIdMatch[1];

          if (method === 'PUT') {
            const body = await parseBody(req);
            const targetDir = typeof body.dir === 'string' ? body.dir : resolvedDir;
            const taskFile = join(targetDir, '.tasks.jsonl');
            const updates: { stage?: Stage; description?: string } = {};
            if (typeof body.stage === 'string' && (STAGES as string[]).includes(body.stage)) {
              updates.stage = body.stage as Stage;
            }
            if (typeof body.description === 'string' && body.description) {
              updates.description = body.description;
            }
            const task = updateTask(taskFile, id, updates);
            if (!task) {
              sendError(res, 'Task not found', 404);
              return;
            }
            sendJson(res, task);
            return;
          }

          if (method === 'DELETE') {
            const queryDir = url.searchParams.get('dir') ?? resolvedDir;
            const taskFile = join(queryDir, '.tasks.jsonl');
            const removed = removeTask(taskFile, id);
            if (!removed) {
              sendError(res, 'Task not found', 404);
              return;
            }
            sendJson(res, { removed: true });
            return;
          }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } catch (err) {
        console.error('[gui] Request error:', err);
        sendError(res, 'Internal server error', 500);
      }
    })();
  });

  tryListen(server, port)
    .then((actualPort) => {
      const url = `http://localhost:${actualPort}`;
      console.log(`Task Tracker GUI running at ${url}`);
      console.log(`Watching: ${resolvedDir}`);
      console.log('Press Ctrl+C to stop.');
      openBrowser(url);
    })
    .catch((err: Error) => {
      console.error('Failed to start GUI server:', err.message);
      process.exit(1);
    });
}
