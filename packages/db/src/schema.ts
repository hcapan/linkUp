/**
 * LinkUP data model (PostgreSQL + pgvector).
 *
 * - `taxonomy_items` mirrors @linkup/core's taxonomy; every coded column
 *   references it, so an unknown code can never be stored.
 * - A person has ONE profile and can be mentor, mentee, or both.
 * - Multi-select answers (deal sizes, competitors, formats, certs, …) live in a
 *   single `person_tags(kind, code)` table, so a new spec question adds rows,
 *   not columns.
 * - Mentee growth queries and their ranked results are snapshots: the score
 *   breakdown and algorithm version are stored with each match for audit and
 *   for comparing future algorithm versions.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { MatchBreakdown } from '@linkup/core';

export const EMBEDDING_DIMENSIONS = 384;

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const taxonomyItems = pgTable(
  'taxonomy_items',
  {
    code: text('code').primaryKey(),
    kind: text('kind').notNull(),
    label: text('label').notNull(),
    detail: text('detail'),
    parent: text('parent'),
    sort: integer('sort').notNull().default(0),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    version: text('version').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('taxonomy_items_kind_idx').on(t.kind, t.sort)],
);

const taxonomyRef = (name: string) => text(name).references(() => taxonomyItems.code);

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Identity (Directory / Workday in production)
    cecId: text('cec_id').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    jobTitle: text('job_title').notNull(),
    managerId: uuid('manager_id').references((): AnyPgColumn => people.id, { onDelete: 'set null' }),
    /** Real Webex account linked to this (possibly fictional) person for bot demos. */
    webexEmail: text('webex_email'),
    isAdmin: boolean('is_admin').notNull().default(false),

    // Role gating
    seRole: taxonomyRef('se_role'),
    specialistArch: taxonomyRef('specialist_arch'),

    // Geo / segment / timezone
    theater: taxonomyRef('theater'),
    segment: taxonomyRef('segment'),
    regionalSub: taxonomyRef('regional_sub'),
    timezone: taxonomyRef('timezone'),

    // Superpower bio + embedding
    bio: text('bio').notNull().default(''),
    bioEmbedding: vector('bio_embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text('embedding_model'),

    // Mentoring availability
    isMentor: boolean('is_mentor').notNull().default(false),
    menteeCapacity: smallint('mentee_capacity').notNull().default(1),

    /** seed | self | import */
    source: text('source').notNull().default('self'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('people_cec_id_uq').on(t.cecId),
    uniqueIndex('people_webex_email_uq').on(sql`lower(${t.webexEmail})`),
    index('people_manager_idx').on(t.managerId),
    index('people_mentor_pool_idx').on(t.isMentor, t.specialistArch),
    check('people_capacity_ck', sql`${t.menteeCapacity} between 1 and 2`),
  ],
);

export const personSkills = pgTable(
  'person_skills',
  {
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    subcategory: text('subcategory')
      .notNull()
      .references(() => taxonomyItems.code),
    level: smallint('level').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.personId, t.subcategory] }),
    index('person_skills_lookup_idx').on(t.subcategory, t.level),
    check('person_skills_level_ck', sql`${t.level} between 1 and 3`),
  ],
);

export const personTags = pgTable(
  'person_tags',
  {
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** DEAL_SIZE | LICENSING | FINANCIAL | STAKEHOLDER | COMPETITOR | FORMAT | CERT */
    kind: text('kind').notNull(),
    code: text('code')
      .notNull()
      .references(() => taxonomyItems.code),
  },
  (t) => [primaryKey({ columns: [t.personId, t.kind, t.code] }), index('person_tags_lookup_idx').on(t.kind, t.code)],
);

export const mentorshipRequests = pgTable(
  'mentorship_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    menteeId: uuid('mentee_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** Architecture code or PORTFOLIO */
    primaryArch: text('primary_arch').notNull(),
    targetSubcategories: text('target_subcategories').array().notNull(),
    commercialSkills: text('commercial_skills').array().notNull().default(sql`'{}'`),
    stakeholderInterests: text('stakeholder_interests').array().notNull().default(sql`'{}'`),
    dealSize: taxonomyRef('deal_size'),
    competitors: text('competitors').array().notNull().default(sql`'{}'`),
    formats: text('formats').array().notNull(),
    goal: text('goal').notNull(),
    goalEmbedding: vector('goal_embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text('embedding_model'),
    /** OPEN | MATCHED | CLOSED */
    status: text('status').notNull().default('OPEN'),
    /** web | webex */
    channel: text('channel').notNull().default('web'),
    algorithmVersion: text('algorithm_version').notNull(),
    evaluated: integer('evaluated').notNull().default(0),
    excluded: jsonb('excluded').$type<Record<string, number>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index('mentorship_requests_mentee_idx').on(t.menteeId, t.createdAt)],
);

export const matchResults = pgTable(
  'match_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => mentorshipRequests.id, { onDelete: 'cascade' }),
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    rank: smallint('rank').notNull(),
    score: smallint('score').notNull(),
    strong: boolean('strong').notNull(),
    breakdown: jsonb('breakdown').$type<MatchBreakdown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('match_results_request_mentor_uq').on(t.requestId, t.mentorId)],
);

export const mentorships = pgTable(
  'mentorships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id').references(() => mentorshipRequests.id, { onDelete: 'set null' }),
    menteeId: uuid('mentee_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** PENDING | ACTIVE | DECLINED | CANCELLED | COMPLETED */
    status: text('status').notNull().default('PENDING'),
    matchScore: smallint('match_score'),
    breakdown: jsonb('breakdown').$type<MatchBreakdown>(),
    /** Short focus label, e.g. "AI Fabrics · EA 3.0" */
    focus: text('focus').notNull().default(''),
    message: text('message'),
    declineReason: text('decline_reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    webexRoomId: text('webex_room_id'),
    webexRoomTitle: text('webex_room_title'),
    ...timestamps,
  },
  (t) => [
    index('mentorships_mentor_status_idx').on(t.mentorId, t.status),
    index('mentorships_mentee_status_idx').on(t.menteeId, t.status),
    // One open (pending or active) mentorship per pair.
    uniqueIndex('mentorships_open_pair_uq')
      .on(t.menteeId, t.mentorId)
      .where(sql`${t.status} in ('PENDING', 'ACTIVE')`),
  ],
);

/**
 * Transactional outbox: the API records domain events here; the Webex bot
 * (or any future integration) polls, delivers and acknowledges them.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_events_pending_idx').on(t.id).where(sql`${t.processedAt} is null`)],
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type MentorshipRow = typeof mentorships.$inferSelect;
export type MentorshipRequestRow = typeof mentorshipRequests.$inferSelect;
export type MatchResultRow = typeof matchResults.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
