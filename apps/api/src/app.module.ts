import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { closeDb, createDb, type Database } from '@linkup/db';
import { createEmbeddingProvider } from '@linkup/embeddings';
import { OutboxService } from './common/outbox.service.js';
import { DB, EMBEDDINGS } from './common/tokens.js';
import { ViewerGuard } from './common/viewer.js';
import { BotController } from './modules/bot.js';
import { DashboardController, DashboardService } from './modules/dashboard.js';
import { MatchingService, MentorshipsController, RequestsController } from './modules/matching.js';
import { DemoController, MeController, MetaController } from './modules/misc.js';
import { PeopleController, PeopleService } from './modules/people.js';

/** Closes the pool / embedded PGlite cleanly on shutdown (PGlite flushes its files). */
@Injectable()
class DbLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Database) {}
  async onApplicationShutdown() {
    await closeDb(this.db);
  }
}

@Global()
@Module({
  providers: [
    { provide: DB, useFactory: () => createDb() },
    {
      provide: EMBEDDINGS,
      useFactory: async () => {
        const logger = new Logger('Embeddings');
        const provider = await createEmbeddingProvider(undefined, (m) => logger.warn(m));
        logger.log(`Using ${provider.model}`);
        return provider;
      },
    },
    OutboxService,
    ViewerGuard,
    DbLifecycle,
  ],
  exports: [DB, EMBEDDINGS, OutboxService, ViewerGuard],
})
class InfraModule {}

@Module({
  imports: [InfraModule],
  controllers: [
    MetaController,
    DemoController,
    MeController,
    PeopleController,
    RequestsController,
    MentorshipsController,
    DashboardController,
    BotController,
  ],
  providers: [PeopleService, MatchingService, DashboardService],
})
export class AppModule {}
