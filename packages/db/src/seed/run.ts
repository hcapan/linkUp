/**
 * Demo dataset: taxonomy sync + fictional EMEAR SEs + mentorships.
 * Seeded mentorships are produced by running the real matching engine, so
 * their scores and rationales are genuine. Used by `pnpm db:seed` and by the
 * API container's first-boot setup (DB_AUTO_SETUP=1).
 */
import { sql } from 'drizzle-orm';
import {
  ALGORITHM_VERSION,
  MentorshipRequestInputSchema,
  TAXONOMY,
  TAXONOMY_VERSION,
  rankMentors,
  shortLabelOf,
} from '@linkup/core';
import { createEmbeddingProvider } from '@linkup/embeddings';
import type { Database } from '../index.js';
import { TAG_FIELDS, loadMentorCandidates } from '../repository.js';
import {
  matchResults,
  mentorshipRequests,
  mentorships,
  people,
  personSkills,
  personTags,
  taxonomyItems,
} from '../schema.js';
import { generatePeople, generateRequest, rng } from './generate.js';

type Log = (msg: string) => void;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function syncTaxonomy(db: Database, log: Log = () => {}) {
  for (const part of chunk([...TAXONOMY], 200)) {
    await db
      .insert(taxonomyItems)
      .values(part.map((t) => ({ ...t, detail: t.detail ?? null, parent: t.parent ?? null, meta: t.meta ?? null, version: TAXONOMY_VERSION, active: true })))
      .onConflictDoUpdate({
        target: taxonomyItems.code,
        set: {
          kind: sql`excluded.kind`,
          label: sql`excluded.label`,
          detail: sql`excluded.detail`,
          parent: sql`excluded.parent`,
          sort: sql`excluded.sort`,
          meta: sql`excluded.meta`,
          version: sql`excluded.version`,
          active: sql`true`,
        },
      });
  }
  log(`taxonomy ${TAXONOMY_VERSION}: ${TAXONOMY.length} items`);
}

export interface SeedOptions {
  /** Number of SEs to generate (managers, directors and the admin are added on top). */
  count?: number;
  /** Wipe people, requests and mentorships first. */
  fresh?: boolean;
  log?: Log;
}

export interface SeedSummary {
  people: number;
  mentors: number;
  mentorships: Record<string, number>;
}

/**
 * Generate the demo dataset. Skips (returns null) when people already exist,
 * unless `fresh` is set. Always syncs the taxonomy first.
 */
export async function seedDemo(db: Database, { count = 300, fresh = false, log = () => {} }: SeedOptions = {}): Promise<SeedSummary | null> {
  await syncTaxonomy(db, log);

  const existing = await db.$count(people);
  if (existing > 0 && !fresh) {
    log(`${existing} people already present — skipping. Use --fresh to regenerate.`);
    return null;
  }
  if (fresh) {
    await db.execute(sql`truncate outbox_events, match_results, mentorships, mentorship_requests, person_tags, person_skills, people restart identity cascade`);
    log('wiped existing demo data');
  }

  const seedPeople = generatePeople(count);
  log(`generated ${seedPeople.length} people (${count} SEs + managers, directors, admin)`);

  const embeddings = await createEmbeddingProvider(undefined, (m) => log(m));
  log(`embedding provider: ${embeddings.model}`);
  const bios = seedPeople.map((p) => p.profile.bio);
  const withBio = bios.map((b, i) => [b, i] as const).filter(([b]) => b.length > 0);
  const vectors = new Map<number, number[]>();
  for (const part of chunk(withBio, 256)) {
    const out = await embeddings.embed(part.map(([b]) => b));
    part.forEach(([, i], j) => vectors.set(i, out[j]!));
  }
  log(`embedded ${vectors.size} bios`);

  // People (manager links in a second pass)
  const idByKey = new Map<string, string>();
  for (const part of chunk(seedPeople.map((p, i) => [p, i] as const), 500)) {
    const rows = await db
      .insert(people)
      .values(
        part.map(([p, i]) => ({
          cecId: p.profile.cecId,
          fullName: p.profile.fullName,
          email: p.profile.email,
          jobTitle: p.profile.jobTitle,
          isAdmin: p.isAdmin,
          seRole: p.profile.seRole,
          specialistArch: p.profile.specialistArch,
          theater: p.profile.theater,
          segment: p.profile.segment,
          regionalSub: p.profile.regionalSub,
          timezone: p.profile.timezone,
          bio: p.profile.bio,
          bioEmbedding: vectors.get(i) ?? null,
          embeddingModel: vectors.has(i) ? embeddings.model : null,
          isMentor: p.profile.isMentor,
          menteeCapacity: p.profile.menteeCapacity,
          source: 'seed',
        })),
      )
      .returning({ id: people.id, cecId: people.cecId });
    const idByCec = new Map(rows.map((r) => [r.cecId, r.id]));
    for (const [p] of part) idByKey.set(p.key, idByCec.get(p.profile.cecId)!);
  }
  const managerPairs = seedPeople.filter((p) => p.managerKey).map((p) => [idByKey.get(p.key)!, idByKey.get(p.managerKey!)!]);
  for (const part of chunk(managerPairs, 1000)) {
    await db.execute(sql`
      update people set manager_id = v.manager_id::uuid
      from (values ${sql.join(part.map(([id, m]) => sql`(${id}, ${m})`), sql`, `)}) as v(id, manager_id)
      where people.id = v.id::uuid`);
  }
  log(`inserted ${idByKey.size} people`);

  const skillRows = seedPeople.flatMap((p) => p.profile.skills.map((s) => ({ personId: idByKey.get(p.key)!, ...s })));
  for (const part of chunk(skillRows, 2000)) await db.insert(personSkills).values(part);
  const tagRows = seedPeople.flatMap((p) =>
    (Object.entries(TAG_FIELDS) as [keyof typeof TAG_FIELDS, (typeof TAG_FIELDS)[keyof typeof TAG_FIELDS]][]).flatMap(([kind, field]) =>
      p.profile[field].map((code) => ({ personId: idByKey.get(p.key)!, kind, code })),
    ),
  );
  for (const part of chunk(tagRows, 2000)) await db.insert(personTags).values(part);
  log(`inserted ${skillRows.length} skill ratings, ${tagRows.length} tags`);

  // Mentorships, produced by the real engine
  const r = rng(7);
  const menteePool = seedPeople.filter((p) => ['associate', 'se', 'senior', 'tsa'].includes(p.seniority));
  const target = Math.min(400, Math.round(count * 0.24));
  const mentees = r.sample(menteePool, target);
  const day = 86_400_000;
  const now = Date.now();
  const tally: Record<string, number> = {};

  for (const mentee of mentees) {
    const menteeId = idByKey.get(mentee.key)!;
    const request = MentorshipRequestInputSchema.parse(generateRequest(r, mentee));
    const [goalVector] = await embeddings.embed([request.goal]);
    const candidates = await loadMentorCandidates(db, { menteeId, goalEmbedding: goalVector!, embeddingModel: embeddings.model });
    const ranked = rankMentors(
      request,
      {
        id: menteeId,
        managerId: mentee.managerKey ? idByKey.get(mentee.managerKey)! : null,
        segment: mentee.profile.segment,
        regionalSub: mentee.profile.regionalSub,
        timezone: mentee.profile.timezone,
      },
      candidates,
    );
    if (ranked.matches.length === 0) continue;

    const status = r.weighted([
      ['ACTIVE', 0.55],
      ['PENDING', 0.13],
      ['COMPLETED', 0.18],
      ['DECLINED', 0.08],
      ['CANCELLED', 0.06],
    ] as const);
    const daysAgo = {
      ACTIVE: r.int(8, 160),
      PENDING: r.int(0, 6),
      COMPLETED: r.int(190, 320),
      DECLINED: r.int(5, 70),
      CANCELLED: r.int(20, 120),
    }[status];
    const requestedAt = new Date(now - daysAgo * day - r.int(0, 600) * 60_000);
    const [req] = await db
      .insert(mentorshipRequests)
      .values({
        menteeId,
        ...request,
        goalEmbedding: goalVector!,
        embeddingModel: embeddings.model,
        status: status === 'ACTIVE' || status === 'COMPLETED' ? 'MATCHED' : 'OPEN',
        channel: r.chance(0.35) ? 'webex' : 'web',
        algorithmVersion: ALGORITHM_VERSION,
        evaluated: ranked.evaluated,
        excluded: ranked.excluded,
        createdAt: new Date(requestedAt.getTime() - 5 * 60_000),
      })
      .returning({ id: mentorshipRequests.id });
    await db.insert(matchResults).values(
      ranked.matches.map((m, i) => ({
        requestId: req!.id,
        mentorId: m.mentor.id,
        rank: i + 1,
        score: m.score.total,
        strong: m.score.strong,
        breakdown: m.score,
        createdAt: requestedAt,
      })),
    );

    const choice = ranked.matches[r.weighted([[0, 0.72], [1, 0.18], [2, 0.1]] as const)] ?? ranked.matches[0]!;
    const startedAt = status === 'ACTIVE' || status === 'COMPLETED' ? new Date(requestedAt.getTime() + r.int(1, 4) * day) : null;
    const endsAt = startedAt ? new Date(startedAt.getTime() + 182 * day) : null;
    await db.insert(mentorships).values({
      requestId: req!.id,
      menteeId,
      mentorId: choice.mentor.id,
      status,
      matchScore: choice.score.total,
      breakdown: choice.score,
      focus: [shortLabelOf(request.targetSubcategories[0]!), request.commercialSkills.includes('LIC_EA3') ? 'EA 3.0' : ''].filter(Boolean).join(' · '),
      message: r.chance(0.5) ? 'Would love your help on this — I have a live opportunity this quarter.' : null,
      requestedAt,
      respondedAt: status === 'PENDING' ? null : new Date(requestedAt.getTime() + r.int(2, 48) * 3_600_000),
      startedAt,
      endsAt,
      completedAt: status === 'COMPLETED' ? endsAt : null,
      declineReason: status === 'DECLINED' ? 'At capacity on a big PoV this quarter — please try another mentor.' : null,
    });
    tally[status] = (tally[status] ?? 0) + 1;
  }
  log(`mentorships: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  const mentorCount = seedPeople.filter((p) => p.profile.isMentor).length;
  log(`done — ${idByKey.size} people, ${mentorCount} in the mentor pool. Program admin persona: Morgan Ellis (mellis).`);
  return { people: idByKey.size, mentors: mentorCount, mentorships: tally };
}
