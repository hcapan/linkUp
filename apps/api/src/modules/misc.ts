import { Controller, ForbiddenException, Get, Inject, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import {
  ALGORITHM_VERSION,
  PROGRAM_COMMITMENT,
  STRONG_MATCH_THRESHOLD,
  TAXONOMY,
  TAXONOMY_VERSION,
  WEIGHTS,
} from '@linkup/core';
import { loadProfile, seedDemo, type Database } from '@linkup/db';
import type { EmbeddingProvider } from '@linkup/embeddings';
import { DB, EMBEDDINGS } from '../common/tokens.js';
import { CurrentViewer, ViewerGuard, type Viewer } from '../common/viewer.js';
import { MatchingService } from './matching.js';
import { toSummary } from './people.js';

@ApiTags('meta')
@Controller()
export class MetaController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingProvider,
  ) {}

  @Get('health')
  async health() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok', db: 'up', embeddings: this.embeddings.model, algorithm: ALGORITHM_VERSION };
  }

  @Get('taxonomy')
  taxonomy() {
    return {
      version: TAXONOMY_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
      strongMatchThreshold: STRONG_MATCH_THRESHOLD,
      weights: WEIGHTS,
      program: PROGRAM_COMMITMENT,
      items: TAXONOMY,
    };
  }
}

@ApiTags('me')
@Controller('me')
@UseGuards(ViewerGuard)
export class MeController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly matching: MatchingService,
  ) {}

  @Get()
  async me(@CurrentViewer() viewer: Viewer) {
    const profile = await loadProfile(this.db, viewer.id);
    const { rows } = await this.db.execute<{ as_mentee: number; as_mentor: number; open_requests: number }>(sql`
      select
        (select count(*)::int from mentorships where mentee_id = ${viewer.id} and status in ('PENDING', 'ACTIVE')) as as_mentee,
        (select count(*)::int from mentorships where mentor_id = ${viewer.id} and status = 'ACTIVE') as as_mentor,
        (select count(*)::int from mentorship_requests where mentee_id = ${viewer.id} and status = 'OPEN') as open_requests`);
    return {
      ...toSummary(profile!),
      isAdmin: viewer.isAdmin,
      isManager: viewer.reportIds.length > 0,
      directReports: viewer.reportIds.length,
      webexEmail: profile!.webexEmail,
      pendingApprovals: await this.matching.pendingApprovals(viewer.id),
      openAsMentee: rows[0]?.as_mentee ?? 0,
      activeAsMentor: rows[0]?.as_mentor ?? 0,
      openRequests: rows[0]?.open_requests ?? 0,
    };
  }
}

/** Persona switcher for the auth-less demo. */
@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Regenerate the fictional demo dataset (program admin only). Persona ids change. */
  @Post('reset')
  @UseGuards(ViewerGuard)
  async reset(@CurrentViewer() viewer: Viewer) {
    if (!viewer.isAdmin) throw new ForbiddenException('Only the program admin can reset the demo data');
    const logger = new Logger('DemoReset');
    const summary = await seedDemo(this.db, { fresh: true, log: (m) => logger.log(m) });
    return { ok: true, ...summary };
  }

  @Get('personas')
  async personas(@Query('q') q?: string) {
    const pick = async (label: string, description: string, query: ReturnType<typeof sql>) => {
      const { rows } = await this.db.execute<{ id: string; full_name: string; cec_id: string; job_title: string }>(query);
      const row = rows[0];
      return row ? { id: row.id, fullName: row.full_name, cecId: row.cec_id, jobTitle: row.job_title, label, description } : null;
    };
    const featured = (
      await Promise.all([
        pick('Program admin', 'Full program dashboard, every profile and mentorship', sql`
          select id, full_name, cec_id, job_title from people where is_admin order by created_at limit 1`),
        pick('SE manager', "Sees their direct reports' mentorships", sql`
          select p.id, p.full_name, p.cec_id, p.job_title from people p
          where p.job_title like 'SE Manager%'
          order by (select count(*) from mentorships m join people e on e.id = m.mentee_id where e.manager_id = p.id and m.status = 'ACTIVE') desc
          limit 1`),
        pick('Mentor with a request to approve', 'Has a pending mentorship request waiting', sql`
          select p.id, p.full_name, p.cec_id, p.job_title from people p
          join mentorships m on m.mentor_id = p.id and m.status = 'PENDING'
          group by p.id order by count(*) desc, p.full_name limit 1`),
        pick('Mentee in an active mentorship', 'Mid-way through a 6-month pairing', sql`
          select p.id, p.full_name, p.cec_id, p.job_title from people p
          join mentorships m on m.mentee_id = p.id and m.status = 'ACTIVE'
          where not p.is_mentor order by m.started_at limit 1`),
        pick('New Associate SE', 'No requests yet — try "Find a mentor"', sql`
          select p.id, p.full_name, p.cec_id, p.job_title from people p
          where p.job_title = 'Associate Systems Engineer'
            and not exists (select 1 from mentorship_requests q where q.mentee_id = p.id)
          order by p.full_name limit 1`),
      ])
    ).filter((p) => p !== null);

    const like = `%${(q ?? '').trim()}%`;
    const { rows } = await this.db.execute<{
      id: string;
      full_name: string;
      cec_id: string;
      job_title: string;
      is_mentor: boolean;
      is_admin: boolean;
      is_manager: boolean;
    }>(sql`
      select p.id, p.full_name, p.cec_id, p.job_title, p.is_mentor, p.is_admin,
             exists (select 1 from people r where r.manager_id = p.id) as is_manager
      from people p
      where ${q?.trim() ? sql`(p.full_name ilike ${like} or p.cec_id ilike ${like} or p.job_title ilike ${like})` : sql`true`}
      order by p.updated_at desc, p.full_name limit 25`);
    return {
      featured,
      people: rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        cecId: r.cec_id,
        jobTitle: r.job_title,
        isMentor: r.is_mentor,
        isAdmin: r.is_admin,
        isManager: r.is_manager,
      })),
    };
  }
}
