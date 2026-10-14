import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import pg from 'pg';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };

/**
 * The app's database handle. Two drivers share one API:
 *  - `postgres://…`  → node-postgres pool (local Podman, Neon, any Postgres + pgvector)
 *  - `pglite:<dir>`  → embedded PGlite (Postgres compiled to WASM, + pgvector) storing data
 *                      in <dir>; used by the one-click desktop bundle. `pglite:memory` is in-memory.
 * Both speak the same SQL, so schema, migrations and queries are shared.
 */
export type Database = NodePgDatabase<typeof schema>;

export type DatabaseDriver = 'postgres' | 'pglite';

interface Handle {
  driver: DatabaseDriver;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const handles = new WeakMap<object, Handle>();

function handleOf(db: Database): Handle {
  const handle = handles.get(db);
  if (!handle) throw new Error('Not a database created by createDb()');
  return handle;
}

export function createDb(url = process.env.DATABASE_URL, opts: { max?: number } = {}): Database {
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');

  if (url.startsWith('pglite:')) {
    const location = url.slice('pglite:'.length);
    const client = new PGlite(location === 'memory' || location === '' ? 'memory://' : location, {
      extensions: { vector },
    });
    const db = drizzlePglite(client, { schema }) as unknown as Database;
    handles.set(db, {
      driver: 'pglite',
      exec: async (sql) => void (await client.exec(sql)),
      close: () => client.close(),
    });
    return db;
  }

  const pool = new pg.Pool({ connectionString: url, max: opts.max ?? 10 });
  const db = drizzlePg(pool, { schema }) as Database;
  handles.set(db, {
    driver: 'postgres',
    exec: async (sql) => void (await pool.query(sql)),
    close: () => pool.end(),
  });
  return db;
}

export const databaseDriver = (db: Database): DatabaseDriver => handleOf(db).driver;

/** Run raw SQL (may contain several statements). */
export const execSql = (db: Database, sql: string): Promise<void> => handleOf(db).exec(sql);

export const closeDb = (db: Database): Promise<void> => handleOf(db).close();

export * from './repository.js';
export { migrateDatabase } from './setup.js';
export { seedDemo, syncTaxonomy, type SeedOptions, type SeedSummary } from './seed/run.js';
