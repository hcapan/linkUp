/**
 * Builds the one-click LinkUP demo packages.
 *
 *   bun desktop/build.ts                          macOS (Apple Silicon) + Windows x64
 *   bun desktop/build.ts --target=darwin-arm64    a single target
 *
 * Output: dist-desktop/LinkUP-Demo-<platform>.zip, each containing
 *   LinkUP Demo(.exe)   the launcher (Bun, compiled for that OS)
 *   app/api             NestJS API + production node_modules (flat, no symlinks)
 *   app/web             Next.js standalone server (flattened node_modules)
 *   app/models          MiniLM embedding model
 *   README.txt
 *
 * The packages contain no symlinks and keep paths short, so Windows' built-in
 * "Extract all" works.
 */
import { $ } from 'bun';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const OUT = join(ROOT, 'dist-desktop');
const STAGE = join(OUT, '.stage');

const TARGETS = {
  'darwin-arm64': { bun: 'bun-darwin-arm64', ort: ['darwin', 'arm64'], exe: 'LinkUP Demo', label: 'macOS-AppleSilicon' },
  'windows-x64': { bun: 'bun-windows-x64', ort: ['win32', 'x64'], exe: 'LinkUP Demo.exe', label: 'Windows-x64' },
} as const;
type TargetName = keyof typeof TARGETS;

const requested = process.argv.find((a) => a.startsWith('--target='))?.slice('--target='.length);
const targets = (requested ? requested.split(',') : Object.keys(TARGETS)) as TargetName[];
for (const t of targets) if (!(t in TARGETS)) throw new Error(`Unknown target "${t}". Use: ${Object.keys(TARGETS).join(', ')}`);

const step = (msg: string) => console.log(`\n▸ ${msg}`);

/** [name, path] for every package in a node_modules dir (scoped names included). */
function listPackages(nm: string): [string, string][] {
  const out: [string, string][] = [];
  for (const entry of readdirSync(nm)) {
    if (entry.startsWith('.')) continue;
    const p = join(nm, entry);
    if (entry.startsWith('@')) for (const sub of readdirSync(p)) out.push([`${entry}/${sub}`, join(p, sub)]);
    else out.push([entry, p]);
  }
  return out;
}

/**
 * Turn Next's standalone output (pnpm layout: node_modules/.pnpm + symlinks, very long
 * paths) into a plain hoisted node_modules. One version of each package goes to the top
 * level; a dependency that needs a different version is nested under its dependent.
 */
function flattenStandalone(src: string, dest: string, exclude: (name: string) => boolean) {
  const store = join(src, 'node_modules', '.pnpm');
  const deps = new Map<string, Map<string, string>>(); // package real dir -> (dep name -> dep real dir)
  const realByName = new Map<string, string>();

  for (const id of readdirSync(store)) {
    const nm = join(store, id, 'node_modules');
    if (id === 'node_modules' || !existsSync(nm)) continue;
    const entries = listPackages(nm);
    const own = entries.filter(([, p]) => !lstatSync(p).isSymbolicLink());
    const links = entries.filter(([, p]) => lstatSync(p).isSymbolicLink());
    for (const [name, p] of own) {
      const real = realpathSync(p);
      deps.set(real, new Map(links.map(([n, l]) => [n, realpathSync(l)])));
      if (!realByName.has(name)) realByName.set(name, real);
    }
  }
  // Prefer the version pnpm itself hoisted.
  const hoisted = join(store, 'node_modules');
  if (existsSync(hoisted)) for (const [name, p] of listPackages(hoisted)) realByName.set(name, realpathSync(p));

  const nmOut = join(dest, 'node_modules');
  for (const [name, real] of realByName) {
    if (exclude(name)) continue;
    cpSync(real, join(nmOut, name), { recursive: true, dereference: true });
    for (const [depName, depReal] of deps.get(real) ?? []) {
      if (exclude(depName) || realByName.get(depName) === depReal) continue;
      cpSync(depReal, join(nmOut, name, 'node_modules', depName), { recursive: true, dereference: true });
    }
  }
  // Everything else (server.js, .next, package.json) without the pnpm node_modules.
  cpSync(src, dest, {
    recursive: true,
    dereference: true,
    filter: (p) => !relative(src, p).split(/[\\/]/).includes('node_modules'),
  });
}

/** sharp is imported at load time by transformers.js but never used (no image models). */
function stubSharp(nm: string) {
  rmSync(join(nm, 'sharp'), { recursive: true, force: true });
  rmSync(join(nm, '@img'), { recursive: true, force: true });
  mkdirSync(join(nm, 'sharp'), { recursive: true });
  writeFileSync(join(nm, 'sharp', 'package.json'), JSON.stringify({ name: 'sharp', version: '0.0.0-linkup-stub', main: 'index.js' }));
  writeFileSync(
    join(nm, 'sharp', 'index.js'),
    "module.exports = function sharp() { throw new Error('Image processing is not included in the LinkUP demo bundle'); };\n",
  );
}

function walk(dir: string, visit: (path: string, isLink: boolean) => void) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = lstatSync(p);
    visit(p, st.isSymbolicLink());
    if (st.isDirectory()) walk(p, visit);
  }
}

function dirSize(dir: string): number {
  let total = 0;
  walk(dir, (p, isLink) => {
    if (!isLink) {
      const st = statSync(p);
      if (st.isFile()) total += st.size;
    }
  });
  return total;
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(0)} MB`;

const README = (exe: string, windows: boolean) => `Cisco SE LinkUP — demo (fictional sample data)
=================================================

START
${
  windows
    ? `  Double-click "${exe}".
  If Windows SmartScreen appears: "More info" -> "Run anyway".`
    : `  Double-click "${exe}".
  The first time, macOS may refuse to open it because the developer can't be verified:
    - right-click "${exe}" -> Open -> Open, or
    - System Settings -> Privacy & Security -> scroll down -> "Open Anyway".`
}

  A terminal window opens and LinkUP starts (the first start takes about 20 seconds
  while it creates the demo database). Your browser then opens http://127.0.0.1:39520

  Keep that window open while you use LinkUP. Close it (or press Ctrl+C) to stop.

USING THE DEMO
  There is no login. Use "Choose a demo persona" (top right) to act as the program
  admin, an SE manager, a mentor or a mentee — or create your own profile.
  Program admin -> Program dashboard -> "Reset demo data" regenerates the dataset.

YOUR DATA
  ${windows ? '%APPDATA%\\LinkUP Demo' : '~/Library/Application Support/LinkUP Demo'}
  Delete that folder to start over. Logs are in its "logs" subfolder.

Everything runs on this computer. No data is sent anywhere.
`;

// ---------------------------------------------------------------------------

step('Building packages, API and web');
await $`pnpm build:packages`.cwd(ROOT);
await $`pnpm --filter @linkup/api build`.cwd(ROOT);
await $`pnpm --filter @linkup/web build`.cwd(ROOT);
if (!existsSync(join(ROOT, '.cache/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx'))) {
  await $`pnpm models:fetch`.cwd(ROOT);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

step('Staging API (production dependencies, flat node_modules)');
await $`pnpm --config.node-linker=hoisted --filter @linkup/api deploy --prod --legacy ${join(STAGE, 'api')}`
  .cwd(ROOT)
  .env({ ...process.env, ONNXRUNTIME_NODE_INSTALL: 'skip' })
  .quiet();
const apiNm = join(STAGE, 'api', 'node_modules');
rmSync(join(apiNm, '.bin'), { recursive: true, force: true });
rmSync(join(apiNm, '.pnpm'), { recursive: true, force: true });
rmSync(join(apiNm, 'onnxruntime-web', 'dist'), { recursive: true, force: true });
stubSharp(apiNm);

step('Staging web (Next.js standalone, flattened)');
const standalone = join(ROOT, 'apps/web/.next/standalone');
flattenStandalone(standalone, join(STAGE, 'web'), (name) => name === 'sharp' || name.startsWith('@img/') || name === 'detect-libc');
cpSync(join(ROOT, 'apps/web/.next/static'), join(STAGE, 'web/apps/web/.next/static'), { recursive: true });
if (existsSync(join(ROOT, 'apps/web/public'))) cpSync(join(ROOT, 'apps/web/public'), join(STAGE, 'web/apps/web/public'), { recursive: true });

step('Staging embedding model');
cpSync(join(ROOT, '.cache/models'), join(STAGE, 'models'), { recursive: true });

for (const name of targets) {
  const t = TARGETS[name];
  const dirName = `LinkUP-Demo-${t.label}`;
  const dir = join(OUT, dirName);
  step(`Packaging ${dirName}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(STAGE, join(dir, 'app'), { recursive: true });

  // Keep only this platform's onnxruntime binaries.
  const ortBin = join(dir, 'app/api/node_modules/onnxruntime-node/bin');
  for (const napi of readdirSync(ortBin)) {
    for (const os of readdirSync(join(ortBin, napi))) {
      if (os !== t.ort[0]) rmSync(join(ortBin, napi, os), { recursive: true, force: true });
      else for (const arch of readdirSync(join(ortBin, napi, os))) if (arch !== t.ort[1]) rmSync(join(ortBin, napi, os, arch), { recursive: true, force: true });
    }
  }

  await $`bun build --compile --target=${t.bun} ${join(ROOT, 'desktop/launcher.ts')} --outfile ${join(dir, t.exe)}`.cwd(ROOT).quiet();
  writeFileSync(join(dir, 'README.txt'), README(t.exe, name.startsWith('windows')));

  let links = 0;
  let longest = '';
  walk(dir, (p, isLink) => {
    if (isLink) links++;
    const rel = relative(OUT, p);
    if (rel.length > longest.length) longest = rel;
  });
  if (links) throw new Error(`${dirName} still contains ${links} symlinks`);

  const zip = join(OUT, `${dirName}.zip`);
  rmSync(zip, { force: true });
  await $`zip -qrX ${zip} ${dirName}`.cwd(OUT);
  console.log(`  ${dirName}: ${mb(dirSize(dir))} unpacked, ${mb(statSync(zip).size)} zip, longest path ${longest.length} chars`);
}

rmSync(STAGE, { recursive: true, force: true });
console.log(`\n✓ Packages in ${relative(ROOT, OUT)}/`);
