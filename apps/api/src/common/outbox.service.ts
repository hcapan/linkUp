import { Inject, Injectable } from '@nestjs/common';
import { outboxEvents, type Database } from '@linkup/db';
import { DB } from './tokens.js';

export type OutboxEventType =
  | 'MENTORSHIP_REQUESTED'
  | 'MENTORSHIP_APPROVED'
  | 'MENTORSHIP_DECLINED'
  | 'MENTORSHIP_CANCELLED'
  | 'MENTORSHIP_COMPLETED';

type Executor = Pick<Database, 'insert'>;

/** Records domain events for asynchronous delivery (Webex bot today). */
@Injectable()
export class OutboxService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async emit(type: OutboxEventType, payload: Record<string, unknown>, tx: Executor = this.db): Promise<void> {
    await tx.insert(outboxEvents).values({ type, payload });
  }
}
