/**
 * LinkUP Demo — one-click launcher.
 *
 * Compiled with `bun build --compile` (see desktop/build.ts) into a single executable
 * that sits next to an `app/` folder. It reuses itself as the Bun runtime
 * (BUN_BE_BUN=1) to start:
 *   1. the API (NestJS) with an embedded PGlite database in the user's profile folder,
 *   2. the Next.js web server,
 * then opens the browser. Closing the window (or Ctrl+C) stops everything.
 */
import { type Subprocess } from 'bun';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

const APP_NAME = 'LinkUP Demo';
// Uncommon fixed ports (CCW Canvas uses 39510/39511).
const WEB_PORT = 39520;
const API_PORT = 39521;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

const isWindows = platform() === 'win32';
const appDir = process.env.LINKUP_APP_DIR ?? join(dirname(process.execPath), 'app');
const dataDir =
  process.env.LINKUP_DATA_DIR ??
  (isWindows
    ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), APP_NAME)
    : platform() === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', APP_NAME)
      : join(homedir(), '.linkup-demo'));
const dbDir = join(dataDir, 'db');
const logDir = join(dataDir, 'logs');

const children: Subprocess[] = [];
let stopping = false;

const say = (msg = '') => console.log(msg);

async function waitForKey() {
  if (!process.stdin.isTTY) return;
  say('\nPress Enter to close this window.');
  for await (const _ of console) break;
}

async function fail(message: string, logFile?: string): Promise<never> {
  console.error(`\n✗ ${message}`);
  if (logFile && existsSync(logFile)) {
    const tail = readFileSync(logFile, 'utf8').trim().split('\n').slice(-15).join('\n');
    console.error(`\nLast lines of ${logFile}:\n${tail}`);
  }
  await stop(1, false);
  await waitForKey();
  process.exit(1);
}

async function stop(code = 0, exit = true) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  await Promise.race([Promise.all(children.map((c) => c.exited)), Bun.sleep(4000)]);
  for (const child of children) if (child.exitCode === null) child.kill(9);
  if (exit) process.exit(code);
}

async function probe(url: string, timeoutMs = 1500): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return await res.text();
  } catch {
    return null;
  }
}

async function waitFor(url: string, seconds: number, child: Subprocess): Promise<boolean> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    if ((await probe(url)) !== null) return true;
    await Bun.sleep(400);
  }
  return false;
}

function openBrowser(url: string) {
  const cmd = isWindows ? ['cmd', '/c', 'start', '', url] : platform() === 'darwin' ? ['open', url] : ['xdg-open', url];
  try {
    Bun.spawn(cmd, { stdout: 'ignore', stderr: 'ignore' });
  } catch {
    say(`Open ${url} in your browser.`);
  }
}

function start(name: string, cwd: string, script: string, env: Record<string, string>): Subprocess {
  const log = openSync(join(logDir, `${name}.log`), 'w');
  const child = Bun.spawn([process.execPath, script], {
    cwd,
    env: { ...process.env, BUN_BE_BUN: '1', NODE_ENV: 'production', ...env },
    stdout: log,
    stderr: log,
  });
  children.push(child);
  return child;
}

// ---------------------------------------------------------------------------

say('');
say('  Cisco SE LinkUP — demo');
say('  ───────────────────────');

if (!existsSync(join(appDir, 'api', 'dist', 'main.js'))) {
  await fail(`The "app" folder is missing next to ${process.execPath}. Unzip the whole package and run it from there.`);
}

// Already running? Just open it.
const existing = await probe(WEB_URL);
if (existing !== null) {
  if (existing.includes('LinkUP')) {
    say(`  LinkUP is already running — opening ${WEB_URL}`);
    if (!process.env.LINKUP_NO_BROWSER) openBrowser(WEB_URL);
    process.exit(0);
  }
  await fail(`Port ${WEB_PORT} is used by another program. Close it and try again.`);
}
if ((await probe(`${API_URL}/health`)) !== null) {
  await fail(`Port ${API_PORT} is used by another program. Close it and try again.`);
}

// macOS: once the user has approved this launcher, clear the download quarantine flag on
// the rest of the package so Gatekeeper doesn't block the bundled onnxruntime library.
if (platform() === 'darwin') {
  try {
    Bun.spawnSync(['xattr', '-dr', 'com.apple.quarantine', dirname(process.execPath)]);
  } catch {
    // best effort
  }
}

mkdirSync(logDir, { recursive: true });
const firstRun = !existsSync(dbDir);

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    say('\n  Stopping LinkUP…');
    void stop(0);
  });
}

say(firstRun ? '  First start: creating the demo database (about 10–20 seconds)…' : '  Starting…');

const api = start('api', join(appDir, 'api'), 'dist/main.js', {
  API_HOST: '127.0.0.1',
  API_PORT: String(API_PORT),
  DATABASE_URL: `pglite:${dbDir}`,
  DB_AUTO_SETUP: '1',
  EMBEDDINGS_PROVIDER: 'local',
  MODELS_CACHE_DIR: join(appDir, 'models'),
  MODELS_OFFLINE: '1',
  WEB_BASE_URL: WEB_URL,
});
if (!(await waitFor(`${API_URL}/health`, 120, api))) {
  await fail('The LinkUP API did not start.', join(logDir, 'api.log'));
}

const web = start('web', join(appDir, 'web', 'apps', 'web'), 'server.js', {
  PORT: String(WEB_PORT),
  HOSTNAME: '127.0.0.1',
  API_URL,
});
if (!(await waitFor(WEB_URL, 60, web))) {
  await fail('The LinkUP web server did not start.', join(logDir, 'web.log'));
}

if (firstRun) {
  // The demo people are generated in the background right after the API starts.
  for (let i = 0; i < 60; i++) {
    const personas = await probe(`${API_URL}/demo/personas`);
    if (personas && personas.includes('"featured":[{')) break;
    await Bun.sleep(1000);
  }
}

if (!process.env.LINKUP_NO_BROWSER) openBrowser(WEB_URL);
say(`  ✓ LinkUP is running at ${WEB_URL} (opened in your browser)`);
say(`    Data: ${dataDir}`);
say('');
say('  Keep this window open while you use LinkUP.');
say('  Close it, or press Ctrl+C, to stop.');

const exited = await Promise.race([api.exited.then(() => 'api'), web.exited.then(() => 'web')]);
if (!stopping) await fail(`The LinkUP ${exited} process stopped unexpectedly.`, join(logDir, `${exited}.log`));
