import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { migrateDatabase, seedDemo, syncTaxonomy, type Database } from '@linkup/db';
import { AppModule } from './app.module.js';
import { DB } from './common/tokens.js';

const logger = new Logger('LinkUP');
const app = await NestFactory.create(AppModule);

// Hosted demo and desktop bundle (DB_AUTO_SETUP=1): prepare an empty database on
// first boot. Schema + taxonomy run before listening; the demo people are generated
// in the background so readiness checks pass fast. Uses the app's own DB handle —
// an embedded PGlite data directory must only be opened once per process.
const autoSetup = process.env.DB_AUTO_SETUP === '1';
const db = app.get<Database>(DB);
if (autoSetup) {
  await migrateDatabase(db);
  await syncTaxonomy(db);
  logger.log('Database schema and taxonomy ready');
}

app.enableCors({
  origin: [process.env.WEB_BASE_URL ?? 'http://localhost:5050'],
  allowedHeaders: ['content-type', 'x-linkup-user'],
});
app.enableShutdownHooks();

const config = new DocumentBuilder()
  .setTitle('Cisco SE LinkUP API')
  .setDescription('Profiles, 100-point matching, mentorship lifecycle, program dashboard and bot integration.')
  .setVersion('0.1.0')
  .addApiKey({ type: 'apiKey', in: 'header', name: 'x-linkup-user' }, 'persona')
  .build();
SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

// 127.0.0.1 locally; the Cloudflare container sets API_HOST=0.0.0.0.
const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 4100);
await app.listen(port, host);
logger.log(`API on http://${host}:${port} · docs at /docs`);

if (autoSetup) {
  seedDemo(db, { log: (m) => logger.log(`[seed] ${m}`) }).catch((err) =>
    logger.error(`Demo seed failed: ${(err as Error).message}`),
  );
}
