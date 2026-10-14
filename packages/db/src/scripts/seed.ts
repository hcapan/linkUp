/**
 * Demo seed CLI.
 *
 *   pnpm db:seed                         taxonomy + ~300 fictional EMEAR SEs + mentorships
 *   pnpm db:seed --fresh                 wipe people/mentorships first
 *   pnpm db:seed --fresh --count=10000   scale test
 *   pnpm db:seed --taxonomy-only         sync taxonomy_items from @linkup/core only
 */
import { closeDb, createDb } from '../index.js';
import { seedDemo, syncTaxonomy } from '../seed/run.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k!, v ?? 'true'];
  }),
);

const db = createDb();
const started = Date.now();
const log = (msg: string) => console.log(`[seed ${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);

try {
  if (args.has('taxonomy-only')) await syncTaxonomy(db, log);
  else await seedDemo(db, { count: Number(args.get('count') ?? 300), fresh: args.has('fresh'), log });
} finally {
  await closeDb(db);
}
