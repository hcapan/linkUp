import { fileURLToPath } from 'node:url';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { databaseDriver, execSql, type Database } from './index.js';

/** Enable pgvector and apply all Drizzle migrations (idempotent, either driver). */
export async function migrateDatabase(db: Database): Promise<void> {
  await execSql(db, 'create extension if not exists vector');
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  if (databaseDriver(db) === 'pglite') await migratePglite(db as never, { migrationsFolder });
  else await migratePg(db, { migrationsFolder });
}
