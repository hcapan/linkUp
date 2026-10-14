/**
 * Integration endpoints for the Webex bot (shared-secret protected).
 * The bot drains the outbox, resolves Webex users to LinkUP people, and
 * records the Webex space it creates for each approved pair.
 */
import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { mentorships, outboxEvents, people, type Database } from '@linkup/db';
import { BotKeyGuard } from '../common/bot-key.guard.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';

const LinkSchema = z.object({ email: z.email(), cecId: z.string().trim().toLowerCase().min(2) });
const AckSchema = z.object({ error: z.string().max(2000).optional() });
const RoomSchema = z.object({ roomId: z.string().min(1), title: z.string().max(200) });

@ApiTags('bot')
@Controller('bot')
@UseGuards(BotKeyGuard)
export class BotController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('outbox')
  outbox(@Query('limit') limit?: string) {
    return this.db
      .select()
      .from(outboxEvents)
      .where(and(isNull(outboxEvents.processedAt), lt(outboxEvents.attempts, 5)))
      .orderBy(outboxEvents.id)
      .limit(Math.min(50, Number(limit ?? 20)));
  }

  @Post('outbox/:id/ack')
  async ack(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(AckSchema)) body: { error?: string }) {
    await this.db
      .update(outboxEvents)
      .set(
        body.error
          ? { attempts: sql`${outboxEvents.attempts} + 1`, lastError: body.error }
          : { processedAt: new Date(), attempts: sql`${outboxEvents.attempts} + 1`, lastError: null },
      )
      .where(eq(outboxEvents.id, id));
    return { ok: true };
  }

  @Get('people/by-email')
  async byEmail(@Query('email') email: string) {
    const { rows } = await this.db.execute<{ id: string; full_name: string; cec_id: string; is_mentor: boolean }>(sql`
      select id, full_name, cec_id, is_mentor from people
      where lower(webex_email) = lower(${email}) or lower(email) = lower(${email})
      order by (lower(webex_email) = lower(${email})) desc nulls last limit 1`);
    const row = rows[0];
    if (!row) throw new NotFoundException('No LinkUP profile is linked to this Webex account');
    return { id: row.id, fullName: row.full_name, cecId: row.cec_id, isMentor: row.is_mentor };
  }

  /** Demo: attach a real Webex account to a (fictional) persona. */
  @Post('link')
  async link(@Body(new ZodPipe(LinkSchema)) body: { email: string; cecId: string }) {
    return this.db.transaction(async (tx) => {
      const [target] = await tx.select().from(people).where(eq(people.cecId, body.cecId));
      if (!target) throw new NotFoundException(`No person with CEC ID "${body.cecId}"`);
      await tx.update(people).set({ webexEmail: null }).where(sql`lower(${people.webexEmail}) = lower(${body.email})`);
      await tx.update(people).set({ webexEmail: body.email }).where(eq(people.id, target.id));
      return { id: target.id, fullName: target.fullName, cecId: target.cecId };
    });
  }

  @Get('mentorships/:id')
  async mentorship(@Param('id', ParseUUIDPipe) id: string) {
    const { rows } = await this.db.execute(sql`
      select m.id, m.status, m.match_score as "matchScore", m.focus, m.message, m.decline_reason as "declineReason",
             m.breakdown->>'headline' as headline, m.breakdown->>'rationale' as rationale,
             m.webex_room_id as "webexRoomId", m.ends_at as "endsAt", q.goal,
             jsonb_build_object('id', e.id, 'fullName', e.full_name, 'cecId', e.cec_id, 'jobTitle', e.job_title, 'webexEmail', e.webex_email) as mentee,
             jsonb_build_object('id', r.id, 'fullName', r.full_name, 'cecId', r.cec_id, 'jobTitle', r.job_title, 'webexEmail', r.webex_email) as mentor
      from mentorships m join people e on e.id = m.mentee_id join people r on r.id = m.mentor_id
      left join mentorship_requests q on q.id = m.request_id
      where m.id = ${id}`);
    if (!rows[0]) throw new NotFoundException('Mentorship not found');
    return rows[0];
  }

  @Patch('mentorships/:id/room')
  async room(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(RoomSchema)) body: { roomId: string; title: string }) {
    await this.db.update(mentorships).set({ webexRoomId: body.roomId, webexRoomTitle: body.title }).where(eq(mentorships.id, id));
    return { ok: true };
  }
}
