/**
 * Queries shared by the API and the seed script.
 */
import { eq, sql } from 'drizzle-orm';
import type { MentorCandidate, Profile, TagKind } from '@linkup/core';
import type { Database } from './index.js';
import { people, personSkills, personTags, type Person } from './schema.js';

/** person_tags.kind → profile field */
export const TAG_FIELDS = {
  DEAL_SIZE: 'dealSizes',
  LICENSING: 'licensing',
  FINANCIAL: 'financial',
  STAKEHOLDER: 'stakeholder',
  COMPETITOR: 'competitors',
  FORMAT: 'formats',
  CERT: 'certifications',
} as const satisfies Record<TagKind, string>;

type TagField = (typeof TAG_FIELDS)[TagKind];

export interface PersonProfile {
  id: string;
  cecId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  managerId: string | null;
  webexEmail: string | null;
  isAdmin: boolean;
  seRole: string | null;
  specialistArch: string | null;
  theater: string | null;
  segment: string | null;
  regionalSub: string | null;
  timezone: string | null;
  bio: string;
  isMentor: boolean;
  menteeCapacity: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  skills: { subcategory: string; level: number }[];
  dealSizes: string[];
  licensing: string[];
  financial: string[];
  stakeholder: string[];
  competitors: string[];
  formats: string[];
  certifications: string[];
  activeMentees: number;
  directReports: number;
}

export const toVector = (v: readonly number[]) => `[${v.join(',')}]`;

function emptyTags(): Record<TagField, string[]> {
  return { dealSizes: [], licensing: [], financial: [], stakeholder: [], competitors: [], formats: [], certifications: [] };
}

/** Load full profiles (person + skills + tags + counters) for the given ids. */
export async function loadProfiles(db: Database, ids: string[]): Promise<PersonProfile[]> {
  if (ids.length === 0) return [];
  const rows = await db.query.people.findMany({ where: (p, { inArray }) => inArray(p.id, ids) });
  const [skills, tags, counts] = await Promise.all([
    db.select().from(personSkills).where(sql`${personSkills.personId} = any(${sql.param(ids)}::uuid[])`),
    db.select().from(personTags).where(sql`${personTags.personId} = any(${sql.param(ids)}::uuid[])`),
    db.execute<{ id: string; active: number; reports: number }>(sql`
      select p.id,
        (select count(*)::int from mentorships m where m.mentor_id = p.id and m.status = 'ACTIVE') as active,
        (select count(*)::int from people r where r.manager_id = p.id) as reports
      from people p where p.id = any(${sql.param(ids)}::uuid[])`),
  ]);
  const countById = new Map(counts.rows.map((r) => [r.id, r]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => byId.get(id))
    .filter((row): row is Person => !!row)
    .map((row) => {
      const t = emptyTags();
      for (const tag of tags) {
        if (tag.personId === row.id) t[TAG_FIELDS[tag.kind as TagKind]].push(tag.code);
      }
      const { bioEmbedding: _e, embeddingModel: _m, ...person } = row;
      return {
        ...person,
        ...t,
        skills: skills
          .filter((s) => s.personId === row.id)
          .map(({ subcategory, level }) => ({ subcategory, level }))
          .sort((a, b) => a.subcategory.localeCompare(b.subcategory, 'en', { numeric: true })),
        activeMentees: countById.get(row.id)?.active ?? 0,
        directReports: countById.get(row.id)?.reports ?? 0,
      };
    });
}

export async function loadProfile(db: Database, id: string): Promise<PersonProfile | null> {
  return (await loadProfiles(db, [id]))[0] ?? null;
}

/**
 * Insert or update a profile with its skills and tags in one transaction.
 * `embedding` is the bio vector (or null to clear it).
 */
export async function saveProfile(
  db: Database,
  profile: Profile,
  opts: { id?: string; embedding: number[] | null; embeddingModel: string | null; source?: string; isAdmin?: boolean },
): Promise<string> {
  return db.transaction(async (tx) => {
    const values = {
      cecId: profile.cecId,
      fullName: profile.fullName,
      email: profile.email,
      jobTitle: profile.jobTitle,
      managerId: profile.managerId,
      seRole: profile.seRole,
      specialistArch: profile.specialistArch,
      theater: profile.theater,
      segment: profile.segment,
      regionalSub: profile.regionalSub,
      timezone: profile.timezone,
      bio: profile.bio,
      bioEmbedding: opts.embedding,
      embeddingModel: opts.embedding ? opts.embeddingModel : null,
      isMentor: profile.isMentor,
      menteeCapacity: profile.menteeCapacity,
      ...(opts.isAdmin !== undefined ? { isAdmin: opts.isAdmin } : {}),
    };
    let id = opts.id;
    if (id) {
      await tx.update(people).set(values).where(eq(people.id, id));
      await tx.delete(personSkills).where(eq(personSkills.personId, id));
      await tx.delete(personTags).where(eq(personTags.personId, id));
    } else {
      const [row] = await tx
        .insert(people)
        .values({ ...values, source: opts.source ?? 'self' })
        .returning({ id: people.id });
      id = row!.id;
    }
    if (profile.skills.length) {
      await tx.insert(personSkills).values(profile.skills.map((s) => ({ personId: id!, ...s })));
    }
    const tagRows = (Object.entries(TAG_FIELDS) as [TagKind, TagField][]).flatMap(([kind, field]) =>
      profile[field].map((code) => ({ personId: id!, kind, code })),
    );
    if (tagRows.length) await tx.insert(personTags).values(tagRows);
    return id;
  });
}

/**
 * The mentor pool, shaped for the scoring engine. Bio similarity is computed
 * in Postgres with pgvector (`<=>` is cosine distance) and only between vectors
 * produced by the same embedding model.
 */
export async function loadMentorCandidates(
  db: Database,
  opts: { menteeId: string; goalEmbedding: number[] | null; embeddingModel: string | null },
): Promise<MentorCandidate[]> {
  const goal = opts.goalEmbedding ? toVector(opts.goalEmbedding) : null;
  const result = await db.execute<{
    id: string;
    full_name: string;
    cec_id: string;
    job_title: string;
    se_role: string | null;
    specialist_arch: string | null;
    segment: string | null;
    regional_sub: string | null;
    timezone: string | null;
    manager_id: string | null;
    mentee_capacity: number;
    skills: Record<string, number> | null;
    tags: Record<string, string[]> | null;
    active_mentees: number;
    has_open: boolean;
    similarity: number | null;
  }>(sql`
    with skills as (
      select person_id, jsonb_object_agg(subcategory, level) as skills
      from person_skills group by person_id
    ), tags as (
      select person_id, jsonb_object_agg(kind, codes) as tags
      from (select person_id, kind, array_agg(code order by code) as codes from person_tags group by person_id, kind) k
      group by person_id
    ), active as (
      select mentor_id, count(*)::int as n from mentorships where status = 'ACTIVE' group by mentor_id
    ), open_pairs as (
      select mentor_id from mentorships
      where mentee_id = ${opts.menteeId} and status in ('PENDING', 'ACTIVE')
    )
    select p.id, p.full_name, p.cec_id, p.job_title, p.se_role, p.specialist_arch, p.segment,
           p.regional_sub, p.timezone, p.manager_id, p.mentee_capacity,
           s.skills, t.tags, coalesce(a.n, 0) as active_mentees,
           exists (select 1 from open_pairs o where o.mentor_id = p.id) as has_open,
           case when ${goal}::vector is not null and p.embedding_model = ${opts.embeddingModel}
                then 1 - (p.bio_embedding <=> ${goal}::vector) end as similarity
    from people p
    left join skills s on s.person_id = p.id
    left join tags t on t.person_id = p.id
    left join active a on a.mentor_id = p.id
    where p.is_mentor
  `);
  return result.rows.map((r) => {
    const tags = r.tags ?? {};
    return {
      id: r.id,
      fullName: r.full_name,
      cecId: r.cec_id,
      jobTitle: r.job_title,
      seRole: r.se_role,
      specialistArch: r.specialist_arch,
      segment: r.segment,
      regionalSub: r.regional_sub,
      timezone: r.timezone,
      managerId: r.manager_id,
      isMentor: true,
      menteeCapacity: r.mentee_capacity,
      activeMentees: r.active_mentees,
      skills: r.skills ?? {},
      dealSizes: tags.DEAL_SIZE ?? [],
      licensing: tags.LICENSING ?? [],
      financial: tags.FINANCIAL ?? [],
      stakeholder: tags.STAKEHOLDER ?? [],
      competitors: tags.COMPETITOR ?? [],
      formats: tags.FORMAT ?? [],
      certifications: tags.CERT ?? [],
      bioSimilarity: r.similarity === null ? null : Number(r.similarity),
      hasOpenRelationship: r.has_open,
    };
  });
}
