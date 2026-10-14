/**
 * Mentee growth requests → ranked matches → mentorship lifecycle.
 *
 *   POST /requests                 run the 100-point engine, store a snapshot
 *   POST /requests/:id/select      mentee picks a mentor  → PENDING
 *   POST /mentorships/:id/approve  mentor says yes        → ACTIVE (6 months)
 *   POST /mentorships/:id/decline                        → DECLINED (mentee may pick another)
 *   POST /mentorships/:id/cancel | complete
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq, sql } from 'drizzle-orm';
import {
  ALGORITHM_VERSION,
  DeclineInputSchema,
  MentorshipRequestInputSchema,
  PROGRAM_COMMITMENT,
  SelectMentorInputSchema,
  rankMentors,
  shortLabelOf,
  type MatchBreakdown,
  type MentorshipRequest,
} from '@linkup/core';
import {
  loadMentorCandidates,
  loadProfiles,
  matchResults,
  mentorshipRequests,
  mentorships,
  people,
  type Database,
} from '@linkup/db';
import type { EmbeddingProvider } from '@linkup/embeddings';
import { OutboxService } from '../common/outbox.service.js';
import { DB, EMBEDDINGS } from '../common/tokens.js';
import { CurrentViewer, ViewerGuard, type Viewer } from '../common/viewer.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { toSummary } from './people.js';

const DAY = 86_400_000;

export interface PersonLite {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  regionalSub: string | null;
  segment: string | null;
  timezone: string | null;
  managerId: string | null;
  webexLinked: boolean;
}

export interface MentorshipRowView {
  id: string;
  requestId: string | null;
  status: string;
  matchScore: number | null;
  focus: string;
  message: string | null;
  declineReason: string | null;
  requestedAt: Date;
  respondedAt: Date | null;
  startedAt: Date | null;
  endsAt: Date | null;
  completedAt: Date | null;
  webexRoomId: string | null;
  webexRoomTitle: string | null;
  progress: number;
  mentee: PersonLite;
  mentor: PersonLite;
}

const MENTORSHIP_SELECT = sql`
  select m.id, m.request_id, m.status, m.match_score, m.focus, m.message, m.decline_reason,
         m.requested_at, m.responded_at, m.started_at, m.ends_at, m.completed_at,
         m.webex_room_id, m.webex_room_title,
         jsonb_build_object('id', e.id, 'fullName', e.full_name, 'cecId', e.cec_id, 'jobTitle', e.job_title,
           'regionalSub', e.regional_sub, 'segment', e.segment, 'timezone', e.timezone, 'managerId', e.manager_id,
           'webexLinked', e.webex_email is not null) as mentee,
         jsonb_build_object('id', r.id, 'fullName', r.full_name, 'cecId', r.cec_id, 'jobTitle', r.job_title,
           'regionalSub', r.regional_sub, 'segment', r.segment, 'timezone', r.timezone, 'managerId', r.manager_id,
           'webexLinked', r.webex_email is not null) as mentor
  from mentorships m
  join people e on e.id = m.mentee_id
  join people r on r.id = m.mentor_id`;

type RawMentorship = {
  id: string;
  request_id: string | null;
  status: string;
  match_score: number | null;
  focus: string;
  message: string | null;
  decline_reason: string | null;
  requested_at: string;
  responded_at: string | null;
  started_at: string | null;
  ends_at: string | null;
  completed_at: string | null;
  webex_room_id: string | null;
  webex_room_title: string | null;
  mentee: PersonLite;
  mentor: PersonLite;
};

const toDate = (v: string | null) => (v ? new Date(v) : null);

function toMentorshipView(r: RawMentorship): MentorshipRowView {
  const startedAt = toDate(r.started_at);
  const endsAt = toDate(r.ends_at);
  let progress = 0;
  if (r.status === 'COMPLETED') progress = 100;
  else if (r.status === 'ACTIVE' && startedAt && endsAt) {
    progress = Math.round(Math.min(1, Math.max(0, (Date.now() - startedAt.getTime()) / (endsAt.getTime() - startedAt.getTime()))) * 100);
  }
  return {
    id: r.id,
    requestId: r.request_id,
    status: r.status,
    matchScore: r.match_score,
    focus: r.focus,
    message: r.message,
    declineReason: r.decline_reason,
    requestedAt: new Date(r.requested_at),
    respondedAt: toDate(r.responded_at),
    startedAt,
    endsAt,
    completedAt: toDate(r.completed_at),
    webexRoomId: r.webex_room_id,
    webexRoomTitle: r.webex_room_title,
    progress,
    mentee: r.mentee,
    mentor: r.mentor,
  };
}

@Injectable()
export class MatchingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingProvider,
    private readonly outbox: OutboxService,
  ) {}

  /* ------------------------------ requests ------------------------------ */

  private async rank(menteeId: string, request: MentorshipRequest, goalEmbedding: number[] | null) {
    const [mentee] = await this.db.select().from(people).where(eq(people.id, menteeId));
    if (!mentee) throw new NotFoundException('Mentee not found');
    const candidates = await loadMentorCandidates(this.db, {
      menteeId,
      goalEmbedding,
      embeddingModel: goalEmbedding ? this.embeddings.model : null,
    });
    return rankMentors(
      request,
      { id: mentee.id, managerId: mentee.managerId, segment: mentee.segment, regionalSub: mentee.regionalSub, timezone: mentee.timezone },
      candidates,
    );
  }

  async createRequest(viewer: Viewer, request: MentorshipRequest, channel: 'web' | 'webex' = 'web') {
    const [goalEmbedding] = await this.embeddings.embed([request.goal]);
    const ranked = await this.rank(viewer.id, request, goalEmbedding!);
    const id = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(mentorshipRequests)
        .values({
          menteeId: viewer.id,
          ...request,
          goalEmbedding: goalEmbedding!,
          embeddingModel: this.embeddings.model,
          channel,
          algorithmVersion: ALGORITHM_VERSION,
          evaluated: ranked.evaluated,
          excluded: ranked.excluded,
        })
        .returning({ id: mentorshipRequests.id });
      if (ranked.matches.length) {
        await tx.insert(matchResults).values(
          ranked.matches.map((m, i) => ({
            requestId: row!.id,
            mentorId: m.mentor.id,
            rank: i + 1,
            score: m.score.total,
            strong: m.score.strong,
            breakdown: m.score,
          })),
        );
      }
      return row!.id;
    });
    return this.getRequest(viewer, id);
  }

  /** Re-run the engine for an open request against the current mentor pool. */
  async rematch(viewer: Viewer, id: string) {
    const req = await this.requireRequest(viewer, id, { ownerOnly: true });
    if (req.status !== 'OPEN') throw new ConflictException('Only open requests can be re-matched');
    const request = MentorshipRequestInputSchema.parse(req);
    const ranked = await this.rank(req.menteeId, request, req.goalEmbedding ?? null);
    await this.db.transaction(async (tx) => {
      await tx.delete(matchResults).where(eq(matchResults.requestId, id));
      if (ranked.matches.length) {
        await tx.insert(matchResults).values(
          ranked.matches.map((m, i) => ({ requestId: id, mentorId: m.mentor.id, rank: i + 1, score: m.score.total, strong: m.score.strong, breakdown: m.score })),
        );
      }
      await tx
        .update(mentorshipRequests)
        .set({ evaluated: ranked.evaluated, excluded: ranked.excluded, algorithmVersion: ALGORITHM_VERSION })
        .where(eq(mentorshipRequests.id, id));
    });
    return this.getRequest(viewer, id);
  }

  private async requireRequest(viewer: Viewer, id: string, opts: { ownerOnly?: boolean } = {}) {
    const [req] = await this.db.select().from(mentorshipRequests).where(eq(mentorshipRequests.id, id));
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.menteeId === viewer.id;
    const allowed = opts.ownerOnly ? isOwner || viewer.isAdmin : isOwner || viewer.isAdmin || viewer.reportIds.includes(req.menteeId);
    if (!allowed) throw new ForbiddenException('Not your request');
    return req;
  }

  async getRequest(viewer: Viewer, id: string) {
    const req = await this.requireRequest(viewer, id);
    const results = await this.db.select().from(matchResults).where(eq(matchResults.requestId, id)).orderBy(matchResults.rank);
    const profiles = await loadProfiles(this.db, [req.menteeId, ...results.map((r) => r.mentorId)]);
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const related = await this.db
      .select({ id: mentorships.id, mentorId: mentorships.mentorId, status: mentorships.status })
      .from(mentorships)
      .where(eq(mentorships.requestId, id));
    const { goalEmbedding: _g, embeddingModel: _m, ...rest } = req;
    const open = related.find((m) => m.status === 'PENDING' || m.status === 'ACTIVE') ?? null;
    return {
      ...rest,
      mentee: byId.get(req.menteeId) ? toSummary(byId.get(req.menteeId)!) : null,
      isOwner: req.menteeId === viewer.id,
      openMentorship: open,
      matches: results.map((r) => ({
        rank: r.rank,
        score: r.score,
        strong: r.strong,
        breakdown: r.breakdown,
        mentor: byId.get(r.mentorId) ? toSummary(byId.get(r.mentorId)!) : null,
        mentorships: related.filter((m) => m.mentorId === r.mentorId),
      })),
    };
  }

  async listRequests(viewer: Viewer) {
    const { rows } = await this.db.execute<{
      id: string;
      primary_arch: string;
      target_subcategories: string[];
      goal: string;
      status: string;
      channel: string;
      created_at: string;
      top_score: number | null;
      matches: number;
      mentorship_status: string | null;
    }>(sql`
      select q.id, q.primary_arch, q.target_subcategories, q.goal, q.status, q.channel, q.created_at,
             (select max(score) from match_results r where r.request_id = q.id) as top_score,
             (select count(*)::int from match_results r where r.request_id = q.id) as matches,
             (select m.status from mentorships m where m.request_id = q.id order by m.requested_at desc limit 1) as mentorship_status
      from mentorship_requests q where q.mentee_id = ${viewer.id}
      order by q.created_at desc limit 50`);
    return rows.map((r) => ({
      id: r.id,
      primaryArch: r.primary_arch,
      targetSubcategories: r.target_subcategories,
      goal: r.goal,
      status: r.status,
      channel: r.channel,
      createdAt: new Date(r.created_at),
      topScore: r.top_score,
      matches: r.matches,
      mentorshipStatus: r.mentorship_status,
    }));
  }

  async select(viewer: Viewer, requestId: string, input: { mentorId: string; message?: string }) {
    const req = await this.requireRequest(viewer, requestId, { ownerOnly: true });
    if (req.menteeId !== viewer.id) throw new ForbiddenException('Only the mentee can request a mentor');
    if (req.status !== 'OPEN') throw new ConflictException('This request already has a mentor');

    const id = await this.db.transaction(async (tx) => {
      const open = await tx
        .select({ id: mentorships.id })
        .from(mentorships)
        .where(and(eq(mentorships.requestId, requestId), sql`${mentorships.status} in ('PENDING', 'ACTIVE')`));
      if (open.length) throw new ConflictException('You already have a pending request for this growth goal — wait for the mentor or cancel it');

      const [match] = await tx
        .select()
        .from(matchResults)
        .where(and(eq(matchResults.requestId, requestId), eq(matchResults.mentorId, input.mentorId)));
      if (!match) throw new BadRequestException('That mentor is not one of your matches');

      const [mentor] = await tx.select().from(people).where(eq(people.id, input.mentorId)).for('update');
      if (!mentor?.isMentor) throw new ConflictException('This person has left the mentor pool');
      const [{ active }] = (await tx.execute<{ active: number }>(sql`
        select count(*)::int as active from mentorships where mentor_id = ${mentor.id} and status = 'ACTIVE'`)).rows as [{ active: number }];
      if (active >= mentor.menteeCapacity) throw new ConflictException(`${mentor.fullName} has no open mentee slots right now`);

      const focus = [
        shortLabelOf(req.targetSubcategories[0]),
        req.commercialSkills.includes('LIC_EA3') ? 'EA 3.0' : shortLabelOf(req.commercialSkills[0]),
      ]
        .filter(Boolean)
        .join(' · ');
      try {
        const [row] = await tx
          .insert(mentorships)
          .values({
            requestId,
            menteeId: viewer.id,
            mentorId: mentor.id,
            status: 'PENDING',
            matchScore: match.score,
            breakdown: match.breakdown,
            focus,
            message: input.message || null,
          })
          .returning({ id: mentorships.id });
        await this.outbox.emit('MENTORSHIP_REQUESTED', { mentorshipId: row!.id }, tx);
        return row!.id;
      } catch (err) {
        if ((err as { cause?: { code?: string } }).cause?.code === '23505' || (err as { code?: string }).code === '23505') {
          throw new ConflictException('You already have an open mentorship with this mentor');
        }
        throw err;
      }
    });
    return this.getMentorship(viewer, id);
  }

  /* ----------------------------- mentorships ----------------------------- */

  async listMentorships(viewer: Viewer, scope: 'mine' | 'team' | 'all' = 'mine', status?: string) {
    let where;
    if (scope === 'all') {
      if (!viewer.isAdmin) throw new ForbiddenException('Program admins only');
      where = sql`true`;
    } else if (scope === 'team') {
      if (!viewer.isAdmin && viewer.reportIds.length === 0) throw new ForbiddenException('Managers only');
      where = sql`(e.manager_id = ${viewer.id} or r.manager_id = ${viewer.id})`;
    } else {
      where = sql`(m.mentee_id = ${viewer.id} or m.mentor_id = ${viewer.id})`;
    }
    const statusFilter = status ? sql`and m.status = ${status}` : sql``;
    const { rows } = await this.db.execute<RawMentorship>(sql`
      ${MENTORSHIP_SELECT}
      where ${where} ${statusFilter}
      order by case m.status when 'PENDING' then 0 when 'ACTIVE' then 1 else 2 end, m.requested_at desc
      limit 500`);
    return rows.map(toMentorshipView);
  }

  private async loadMentorship(id: string) {
    const { rows } = await this.db.execute<RawMentorship>(sql`${MENTORSHIP_SELECT} where m.id = ${id}`);
    return rows[0] ?? null;
  }

  async getMentorship(viewer: Viewer, id: string) {
    const { rows } = await this.db.execute<{ breakdown: MatchBreakdown | null; goal: string | null; target_subcategories: string[] | null }>(sql`
      select m.breakdown, q.goal, q.target_subcategories from mentorships m
      left join mentorship_requests q on q.id = m.request_id where m.id = ${id}`);
    const raw = await this.loadMentorship(id);
    if (!raw || !rows[0]) throw new NotFoundException('Mentorship not found');
    const view = toMentorshipView(raw);
    const isMentee = view.mentee.id === viewer.id;
    const isMentor = view.mentor.id === viewer.id;
    const isManager = viewer.reportIds.includes(view.mentee.id) || viewer.reportIds.includes(view.mentor.id);
    if (!isMentee && !isMentor && !viewer.isAdmin && !isManager) throw new ForbiddenException('Not your mentorship');
    const pending = view.status === 'PENDING';
    const active = view.status === 'ACTIVE';
    return {
      ...view,
      breakdown: rows[0].breakdown,
      goal: rows[0].goal,
      targetSubcategories: rows[0].target_subcategories ?? [],
      viewerRole: isMentee ? 'mentee' : isMentor ? 'mentor' : viewer.isAdmin ? 'admin' : 'manager',
      permissions: {
        canApprove: pending && (isMentor || viewer.isAdmin),
        canDecline: pending && (isMentor || viewer.isAdmin),
        canCancel: (pending && (isMentee || viewer.isAdmin)) || (active && (isMentee || isMentor || viewer.isAdmin)),
        canComplete: active && (isMentee || isMentor || viewer.isAdmin),
      },
      program: PROGRAM_COMMITMENT,
    };
  }

  private async transition(
    viewer: Viewer,
    id: string,
    action: 'approve' | 'decline' | 'cancel' | 'complete',
    reason?: string,
  ) {
    await this.db.transaction(async (tx) => {
      const [m] = await tx.select().from(mentorships).where(eq(mentorships.id, id)).for('update');
      if (!m) throw new NotFoundException('Mentorship not found');
      const isMentee = m.menteeId === viewer.id;
      const isMentor = m.mentorId === viewer.id;
      const now = new Date();

      if (action === 'approve' || action === 'decline') {
        if (!isMentor && !viewer.isAdmin) throw new ForbiddenException('Only the mentor can respond to this request');
        if (m.status !== 'PENDING') throw new ConflictException(`Request is already ${m.status.toLowerCase()}`);
        if (action === 'approve') {
          const [mentor] = await tx.select().from(people).where(eq(people.id, m.mentorId)).for('update');
          const { rows } = await tx.execute<{ active: number }>(sql`
            select count(*)::int as active from mentorships where mentor_id = ${m.mentorId} and status = 'ACTIVE'`);
          if ((rows[0]?.active ?? 0) >= (mentor?.menteeCapacity ?? 0)) {
            throw new ConflictException('All your mentee slots are taken — complete a mentorship or raise your capacity first');
          }
          await tx
            .update(mentorships)
            .set({ status: 'ACTIVE', respondedAt: now, startedAt: now, endsAt: new Date(now.getTime() + 182 * DAY) })
            .where(eq(mentorships.id, id));
          if (m.requestId) await tx.update(mentorshipRequests).set({ status: 'MATCHED' }).where(eq(mentorshipRequests.id, m.requestId));
          await this.outbox.emit('MENTORSHIP_APPROVED', { mentorshipId: id }, tx);
        } else {
          await tx.update(mentorships).set({ status: 'DECLINED', respondedAt: now, declineReason: reason || null }).where(eq(mentorships.id, id));
          await this.outbox.emit('MENTORSHIP_DECLINED', { mentorshipId: id }, tx);
        }
        return;
      }

      if (action === 'cancel') {
        const canCancel =
          (m.status === 'PENDING' && (isMentee || viewer.isAdmin)) ||
          (m.status === 'ACTIVE' && (isMentee || isMentor || viewer.isAdmin));
        if (!canCancel) throw new ConflictException(`Cannot cancel a ${m.status.toLowerCase()} mentorship`);
        await tx.update(mentorships).set({ status: 'CANCELLED', completedAt: m.status === 'ACTIVE' ? now : null }).where(eq(mentorships.id, id));
        if (m.requestId && m.status === 'ACTIVE') {
          await tx.update(mentorshipRequests).set({ status: 'CLOSED' }).where(eq(mentorshipRequests.id, m.requestId));
        }
        await this.outbox.emit('MENTORSHIP_CANCELLED', { mentorshipId: id, by: viewer.id }, tx);
        return;
      }

      if (m.status !== 'ACTIVE' || !(isMentee || isMentor || viewer.isAdmin)) {
        throw new ConflictException('Only participants can complete an active mentorship');
      }
      await tx.update(mentorships).set({ status: 'COMPLETED', completedAt: now }).where(eq(mentorships.id, id));
      if (m.requestId) await tx.update(mentorshipRequests).set({ status: 'CLOSED' }).where(eq(mentorshipRequests.id, m.requestId));
      await this.outbox.emit('MENTORSHIP_COMPLETED', { mentorshipId: id }, tx);
    });
    return this.getMentorship(viewer, id);
  }

  approve = (viewer: Viewer, id: string) => this.transition(viewer, id, 'approve');
  decline = (viewer: Viewer, id: string, reason?: string) => this.transition(viewer, id, 'decline', reason);
  cancel = (viewer: Viewer, id: string) => this.transition(viewer, id, 'cancel');
  complete = (viewer: Viewer, id: string) => this.transition(viewer, id, 'complete');

  async pendingApprovals(viewerId: string) {
    const { rows } = await this.db.execute<{ n: number }>(sql`
      select count(*)::int as n from mentorships where mentor_id = ${viewerId} and status = 'PENDING'`);
    return rows[0]?.n ?? 0;
  }
}

@ApiTags('matching')
@Controller('requests')
@UseGuards(ViewerGuard)
export class RequestsController {
  constructor(private readonly matching: MatchingService) {}

  @Post()
  create(
    @CurrentViewer() viewer: Viewer,
    @Body(new ZodPipe(MentorshipRequestInputSchema)) body: MentorshipRequest,
    @Query('channel') channel?: string,
  ) {
    return this.matching.createRequest(viewer, body, channel === 'webex' ? 'webex' : 'web');
  }

  @Get()
  list(@CurrentViewer() viewer: Viewer) {
    return this.matching.listRequests(viewer);
  }

  @Get(':id')
  get(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.getRequest(viewer, id);
  }

  @Post(':id/rematch')
  rematch(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.rematch(viewer, id);
  }

  @Post(':id/select')
  select(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SelectMentorInputSchema)) body: { mentorId: string; message?: string },
  ) {
    return this.matching.select(viewer, id, body);
  }
}

@ApiTags('matching')
@Controller('mentorships')
@UseGuards(ViewerGuard)
export class MentorshipsController {
  constructor(private readonly matching: MatchingService) {}

  @Get()
  list(@CurrentViewer() viewer: Viewer, @Query('scope') scope?: 'mine' | 'team' | 'all', @Query('status') status?: string) {
    return this.matching.listMentorships(viewer, scope ?? 'mine', status);
  }

  @Get(':id')
  get(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.getMentorship(viewer, id);
  }

  @Post(':id/approve')
  approve(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.approve(viewer, id);
  }

  @Post(':id/decline')
  decline(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(DeclineInputSchema)) body: { reason?: string },
  ) {
    return this.matching.decline(viewer, id, body.reason);
  }

  @Post(':id/cancel')
  cancel(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.cancel(viewer, id);
  }

  @Post(':id/complete')
  complete(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.matching.complete(viewer, id);
  }
}
