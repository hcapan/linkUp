import { Controller, ForbiddenException, Get, Inject, Injectable, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { ARCHITECTURES } from '@linkup/core';
import type { Database } from '@linkup/db';
import { DB } from '../common/tokens.js';
import { CurrentViewer, ViewerGuard, type Viewer } from '../common/viewer.js';
import { MatchingService } from './matching.js';

/** Program view for admins; team view (direct reports) for managers. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly matching: MatchingService,
  ) {}

  async get(viewer: Viewer, requested?: 'program' | 'team') {
    const scope = requested ?? (viewer.isAdmin ? 'program' : 'team');
    if (scope === 'program' && !viewer.isAdmin) throw new ForbiddenException('Program admins only');
    if (scope === 'team' && !viewer.isAdmin && viewer.reportIds.length === 0) throw new ForbiddenException('Managers only');

    const team = scope === 'team';
    const personFilter = team ? sql`p.manager_id = ${viewer.id}` : sql`true`;
    const pairFilter = team ? sql`(e.manager_id = ${viewer.id} or r.manager_id = ${viewer.id})` : sql`true`;

    const [kpis, coverage, subcategories, regions] = await Promise.all([
      this.db.execute<Record<string, number | null>>(sql`
        with pairs as (
          select m.* from mentorships m join people e on e.id = m.mentee_id join people r on r.id = m.mentor_id
          where ${pairFilter}
        ), mentors as (
          select p.id, p.mentee_capacity,
                 (select count(*) from mentorships m where m.mentor_id = p.id and m.status = 'ACTIVE') as active
          from people p where p.is_mentor and ${personFilter}
        )
        select
          (select count(*)::int from people p where ${personFilter}) as people,
          (select count(*)::int from mentors) as mentors,
          (select count(*)::int from pairs where status = 'ACTIVE') as active_pairs,
          (select count(*)::int from pairs where status = 'PENDING') as pending,
          (select count(*)::int from pairs where status = 'COMPLETED') as completed,
          (select count(*)::int from pairs where status in ('DECLINED', 'CANCELLED')) as closed,
          (select round(avg(match_score))::int from pairs where status in ('ACTIVE', 'COMPLETED')) as avg_match_score,
          (select round(100.0 * sum(active) / nullif(sum(mentee_capacity), 0))::int from mentors) as slot_utilization,
          (select coalesce(sum(greatest(mentee_capacity - active, 0)), 0)::int from mentors) as open_slots,
          (select count(*)::int from mentorship_requests q join people p on p.id = q.mentee_id
            where q.created_at > now() - interval '30 days' and ${personFilter}) as requests_30d,
          (select round(avg(extract(epoch from responded_at - requested_at) / 3600))::int from pairs
            where responded_at is not null) as avg_response_hours`),
      this.db.execute<{ arch: string; l3: number; l2: number; open_slots: number; demand: number }>(sql`
        with best as (
          select s.person_id, t.parent as arch, max(s.level) as level
          from person_skills s join taxonomy_items t on t.code = s.subcategory
          join people p on p.id = s.person_id
          where p.is_mentor and ${personFilter}
          group by s.person_id, t.parent
        ), slots as (
          select p.id, greatest(p.mentee_capacity - (select count(*) from mentorships m where m.mentor_id = p.id and m.status = 'ACTIVE'), 0) as free
          from people p where p.is_mentor
        ), demand as (
          select coalesce(t.parent, q.primary_arch) as arch, count(distinct q.id) as n
          from mentorship_requests q
          join people p on p.id = q.mentee_id
          left join lateral unnest(q.target_subcategories) as sub(code) on true
          left join taxonomy_items t on t.code = sub.code
          where q.created_at > now() - interval '180 days' and ${personFilter}
          group by 1
        )
        select a.code as arch,
          (select count(*)::int from best b where b.arch = a.code and b.level = 3) as l3,
          (select count(*)::int from best b where b.arch = a.code and b.level = 2) as l2,
          (select coalesce(sum(s.free), 0)::int from best b join slots s on s.id = b.person_id where b.arch = a.code and b.level >= 2) as open_slots,
          coalesce((select n::int from demand d where d.arch = a.code), 0) as demand
        from taxonomy_items a where a.kind = 'ARCH' order by a.sort`),
      this.db.execute<{ code: string; requests: number; l3_mentors: number }>(sql`
        select sub.code, count(*)::int as requests,
          (select count(*)::int from person_skills s join people m on m.id = s.person_id
            where s.subcategory = sub.code and s.level = 3 and m.is_mentor) as l3_mentors
        from mentorship_requests q
        join people p on p.id = q.mentee_id
        cross join lateral unnest(q.target_subcategories) as sub(code)
        where ${personFilter}
        group by sub.code order by requests desc limit 8`),
      this.db.execute<{ region: string; people: number; mentors: number; active_pairs: number }>(sql`
        select p.regional_sub as region, count(*)::int as people,
          count(*) filter (where p.is_mentor)::int as mentors,
          (select count(*)::int from mentorships m join people e on e.id = m.mentee_id
            where m.status = 'ACTIVE' and e.regional_sub = p.regional_sub ${team ? sql`and e.manager_id = ${viewer.id}` : sql``}) as active_pairs
        from people p where p.regional_sub is not null and ${personFilter}
        group by p.regional_sub order by people desc`),
    ]);

    const k = kpis.rows[0] ?? {};
    const recent = (await this.matching.listMentorships(viewer, team ? 'team' : 'all')).slice(0, 15);
    return {
      scope,
      kpis: {
        people: k.people ?? 0,
        mentors: k.mentors ?? 0,
        activePairs: k.active_pairs ?? 0,
        pending: k.pending ?? 0,
        completed: k.completed ?? 0,
        closed: k.closed ?? 0,
        avgMatchScore: k.avg_match_score ?? null,
        slotUtilization: k.slot_utilization ?? null,
        openSlots: k.open_slots ?? 0,
        requests30d: k.requests_30d ?? 0,
        avgResponseHours: k.avg_response_hours ?? null,
      },
      coverage: coverage.rows.map((c) => ({
        arch: c.arch,
        label: ARCHITECTURES.find((a) => a.code === c.arch)?.label ?? c.arch,
        l3Mentors: c.l3,
        l2Mentors: c.l2,
        openSlots: c.open_slots,
        demand: c.demand,
      })),
      topSubcategories: subcategories.rows.map((s) => ({ code: s.code, requests: s.requests, l3Mentors: s.l3_mentors })),
      regions: regions.rows.map((r) => ({ region: r.region, people: r.people, mentors: r.mentors, activePairs: r.active_pairs })),
      recent,
    };
  }
}

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(ViewerGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentViewer() viewer: Viewer, @Query('scope') scope?: 'program' | 'team') {
    return this.dashboard.get(viewer, scope);
  }
}
