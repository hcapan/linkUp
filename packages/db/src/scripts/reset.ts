import { closeDb, createDb, execSql } from '../index.js';

const db = createDb();
await execSql(db, 'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
console.log('✓ database reset');
await closeDb(db);
