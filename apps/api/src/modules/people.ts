import {
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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, eq, ne, sql, type SQL } from 'drizzle-orm';
import { ProfileInputSchema, archOfSubcategory, type Profile } from '@linkup/core';
import { loadProfile, loadProfiles, people, saveProfile, type Database, type PersonProfile } from '@linkup/db';
import type { EmbeddingProvider } from '@linkup/embeddings';
import { DB, EMBEDDINGS } from '../common/tokens.js';
import { CurrentViewer, ViewerGuard, type Viewer } from '../common/viewer.js';
import { ZodPipe } from '../common/zod.pipe.js';

export interface PersonSummary {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  seRole: string | null;
  specialistArch: string | null;
  regionalSub: string | null;
  segment: string | null;
  timezone: string | null;
  isMentor: boolean;
  menteeCapacity: number;
  activeMentees: number;
  bio: string;
  topSkills: { subcategory: string; level: number }[];
}

export function toSummary(p: PersonProfile): PersonSummary {
  return {
    id: p.id,
    fullName: p.fullName,
    cecId: p.cecId,
    jobTitle: p.jobTitle,
    seRole: p.seRole,
    specialistArch: p.specialistArch,
    regionalSub: p.regionalSub,
    segment: p.segment,
    timezone: p.timezone,
    isMentor: p.isMentor,
    menteeCapacity: p.menteeCapacity,
    activeMentees: p.activeMentees,
    bio: p.bio,
    topSkills: [...p.skills].sort((a, b) => b.level - a.level).slice(0, 4),
  };
}

export interface DirectoryQuery {
  pool?: 'mentors' | 'all' | 'team';
  q?: string;
  arch?: string;
  subcategory?: string;
  minLevel?: string;
  region?: string;
  segment?: string;
  openSlots?: string;
  limit?: string;
  offset?: string;
}

@Injectable()
export class PeopleService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingProvider,
  ) {}

  /** Who may open a full profile: self, admins, the person's manager, anyone for pool mentors, and mentorship partners. */
  async canView(viewer: Viewer, target: PersonProfile): Promise<boolean> {
    if (viewer.isAdmin || viewer.id === target.id || target.isMentor || target.managerId === viewer.id) return true;
    const { rows } = await this.db.execute(sql`
      select 1 from mentorships
      where (mentee_id = ${viewer.id} and mentor_id = ${target.id})
         or (mentor_id = ${viewer.id} and mentee_id = ${target.id})
      limit 1`);
    return rows.length > 0;
  }

  async directory(viewer: Viewer, query: DirectoryQuery) {
    const pool = query.pool ?? 'mentors';
    const where: SQL[] = [];
    if (pool === 'mentors') where.push(sql`p.is_mentor`);
    else if (pool === 'team') where.push(sql`p.manager_id = ${viewer.id}`);
    else if (!viewer.isAdmin) throw new ForbiddenException('Only program admins can list everyone');

    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      where.push(sql`(p.full_name ilike ${like} or p.cec_id ilike ${like} or p.bio ilike ${like} or p.job_title ilike ${like})`);
    }
    if (query.region) where.push(sql`p.regional_sub = ${query.region}`);
    if (query.segment) where.push(sql`p.segment = ${query.segment}`);
    const minLevel = Math.min(3, Math.max(1, Number(query.minLevel ?? 2)));
    if (query.subcategory) {
      where.push(sql`exists (select 1 from person_skills s where s.person_id = p.id and s.subcategory = ${query.subcategory} and s.level >= ${minLevel})`);
    } else if (query.arch) {
      where.push(sql`(p.specialist_arch = ${query.arch} or exists (
        select 1 from person_skills s join taxonomy_items t on t.code = s.subcategory
        where s.person_id = p.id and t.parent = ${query.arch} and s.level >= ${minLevel}))`);
    }
    if (query.openSlots === 'true') {
      where.push(sql`p.mentee_capacity > (select count(*) from mentorships m where m.mentor_id = p.id and m.status = 'ACTIVE')`);
    }
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 24)));
    const offset = Math.max(0, Number(query.offset ?? 0));
    const condition = where.length ? sql.join(where, sql` and `) : sql`true`;

    const order = query.subcategory
      ? sql`(select s.level from person_skills s where s.person_id = p.id and s.subcategory = ${query.subcategory}) desc nulls last, p.full_name`
      : sql`p.full_name`;
    const { rows } = await this.db.execute<{ id: string; total: number }>(sql`
      select p.id, count(*) over ()::int as total from people p
      where ${condition} order by ${order} limit ${limit} offset ${offset}`);
    const profiles = await loadProfiles(this.db, rows.map((r) => r.id));
    return { items: profiles.map(toSummary), total: rows[0]?.total ?? 0, limit, offset };
  }

  async get(viewer: Viewer, id: string) {
    const profile = await loadProfile(this.db, id);
    if (!profile) throw new NotFoundException('Person not found');
    if (!(await this.canView(viewer, profile))) throw new ForbiddenException('This profile is private');
    const manager = profile.managerId ? await loadProfile(this.db, profile.managerId) : null;
    return {
      ...profile,
      manager: manager ? { id: manager.id, fullName: manager.fullName, jobTitle: manager.jobTitle } : null,
      canEdit: viewer.isAdmin || viewer.id === profile.id,
    };
  }

  async managers() {
    const { rows } = await this.db.execute<{ id: string; full_name: string; job_title: string; region: string | null }>(sql`
      select p.id, p.full_name, p.job_title, p.regional_sub as region from people p
      where exists (select 1 from people r where r.manager_id = p.id) or p.job_title ilike '%manager%'
      order by p.full_name`);
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, jobTitle: r.job_title, regionalSub: r.region }));
  }

  private async embedBio(profile: Profile) {
    if (!profile.bio.trim()) return { embedding: null, embeddingModel: null };
    const [embedding] = await this.embeddings.embed([profile.bio]);
    return { embedding: embedding!, embeddingModel: this.embeddings.model };
  }

  private async assertUniqueCec(cecId: string, exceptId?: string) {
    const clash = await this.db
      .select({ id: people.id })
      .from(people)
      .where(exceptId ? and(eq(people.cecId, cecId), ne(people.id, exceptId)) : eq(people.cecId, cecId))
      .limit(1);
    if (clash.length) throw new ConflictException(`CEC ID "${cecId}" is already taken`);
  }

  private normalize(profile: Profile): Profile {
    // A Specialist's primary architecture should be consistent with their ratings; keep data as entered.
    const skills = profile.skills.filter((s) => archOfSubcategory(s.subcategory));
    return { ...profile, skills };
  }

  async create(profile: Profile) {
    await this.assertUniqueCec(profile.cecId);
    const id = await saveProfile(this.db, this.normalize(profile), { ...(await this.embedBio(profile)), source: 'self' });
    return loadProfile(this.db, id);
  }

  async update(viewer: Viewer, id: string, profile: Profile) {
    if (!viewer.isAdmin && viewer.id !== id) throw new ForbiddenException('You can only edit your own profile');
    const existing = await loadProfile(this.db, id);
    if (!existing) throw new NotFoundException('Person not found');
    await this.assertUniqueCec(profile.cecId, id);
    if (profile.managerId === id) throw new ConflictException('A person cannot be their own manager');
    if (!profile.isMentor && existing.activeMentees > 0) {
      throw new ConflictException('You still have active mentees — complete those mentorships before leaving the pool');
    }
    await saveProfile(this.db, this.normalize(profile), { id, ...(await this.embedBio(profile)) });
    return loadProfile(this.db, id);
  }
}

@ApiTags('people')
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  /** Demo onboarding: anyone may create a profile (then switch to it). */
  @Post()
  create(@Body(new ZodPipe(ProfileInputSchema)) body: Profile) {
    return this.people.create(body);
  }

  @Get('managers')
  managers() {
    return this.people.managers();
  }

  @Get()
  @UseGuards(ViewerGuard)
  directory(@CurrentViewer() viewer: Viewer, @Query() query: DirectoryQuery) {
    return this.people.directory(viewer, query);
  }

  @Get(':id')
  @UseGuards(ViewerGuard)
  get(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.people.get(viewer, id);
  }

  @Put(':id')
  @UseGuards(ViewerGuard)
  update(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ProfileInputSchema)) body: Profile,
  ) {
    return this.people.update(viewer, id, body);
  }
}
