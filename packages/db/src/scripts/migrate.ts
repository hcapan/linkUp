import { closeDb, createDb } from '../index.js';
import { migrateDatabase } from '../setup.js';

const db = createDb();
try {
  await migrateDatabase(db);
  console.log('✓ migrations applied');
} finally {
  await closeDb(db);
}
