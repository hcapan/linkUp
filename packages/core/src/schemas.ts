import { z } from 'zod';
import {
  ARCHITECTURES,
  PORTFOLIO_TARGET,
  SE_ROLES,
  codesOfKind,
  isCodeOfKind,
  type TaxonomyKind,
} from './taxonomy.js';

/** A string that must be a taxonomy code of the given kind. */
function codeOf(kind: TaxonomyKind) {
  return z.string().refine((code) => isCodeOfKind(kind, code), {
    message: `Unknown ${kind.toLowerCase().replace('_', ' ')} code`,
  });
}

function codesOf(kind: TaxonomyKind, opts: { min?: number; max?: number } = {}) {
  let schema = z.array(codeOf(kind));
  if (opts.min !== undefined) schema = schema.min(opts.min);
  if (opts.max !== undefined) schema = schema.max(opts.max);
  return schema.transform((codes) => [...new Set(codes)]);
}

const archCodes = ARCHITECTURES.map((a) => a.code) as [string, ...string[]];

export const SkillRatingSchema = z.object({
  subcategory: codeOf('SUBCATEGORY'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type SkillRating = z.infer<typeof SkillRatingSchema>;

/**
 * Full intake profile (spec sections 1–4). The same profile is used whether the
 * person acts as a mentor, a mentee, or both.
 */
export const ProfileInputSchema = z
  .object({
    // 1. Identity (auto-populated from Directory / Workday in production)
    fullName: z.string().trim().min(2).max(120),
    cecId: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9._-]{1,31}$/, 'CEC ID: letters, digits, dot, dash or underscore'),
    email: z.email(),
    jobTitle: z.string().trim().min(2).max(80),
    managerId: z.uuid().nullable().optional(),

    // Role gating
    seRole: z.enum(SE_ROLES.map((r) => r.code) as [string, ...string[]]),
    specialistArch: z.enum(archCodes).nullable().optional(),

    // Geo / segment / timezone
    theater: codeOf('THEATER'),
    segment: codeOf('SEGMENT'),
    regionalSub: codeOf('REGIONAL_SUB'),
    timezone: codeOf('TIMEZONE'),

    // Superpower bio + certifications
    bio: z.string().trim().max(400).default(''),
    certifications: codesOf('CERT'),

    // Mentoring availability
    isMentor: z.boolean(),
    menteeCapacity: z.union([z.literal(1), z.literal(2)]),

    // 2. Technology subcategories (L1–L3)
    skills: z.array(SkillRatingSchema).max(64),

    // 3. Business acumen
    dealSizes: codesOf('DEAL_SIZE'),
    licensing: codesOf('LICENSING'),
    financial: codesOf('FINANCIAL'),

    // 4. Stakeholders, competitors, coaching formats
    stakeholder: codesOf('STAKEHOLDER'),
    competitors: codesOf('COMPETITOR'),
    formats: codesOf('FORMAT'),
  })
  .superRefine((p, ctx) => {
    if (p.seRole === 'SPECIALIST' && !p.specialistArch) {
      ctx.addIssue({
        code: 'custom',
        path: ['specialistArch'],
        message: 'Specialist SEs must pick a primary architecture',
      });
    }
    const seen = new Set<string>();
    for (const s of p.skills) {
      if (seen.has(s.subcategory)) {
        ctx.addIssue({ code: 'custom', path: ['skills'], message: `Duplicate rating for ${s.subcategory}` });
      }
      seen.add(s.subcategory);
    }
    if (p.isMentor) {
      if (p.bio.length < 20) {
        ctx.addIssue({ code: 'custom', path: ['bio'], message: 'Mentors need a 1–2 sentence superpower bio' });
      }
      if (!p.skills.some((s) => s.level >= 2)) {
        ctx.addIssue({
          code: 'custom',
          path: ['skills'],
          message: 'Mentors should rate at least one subcategory at L2 or L3',
        });
      }
      if (p.formats.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['formats'], message: 'Pick at least one coaching format you offer' });
      }
    }
  })
  .transform((p) => ({
    ...p,
    specialistArch: p.seRole === 'SPECIALIST' ? (p.specialistArch ?? null) : null,
    managerId: p.managerId ?? null,
  }));
export type ProfileInput = z.input<typeof ProfileInputSchema>;
export type Profile = z.output<typeof ProfileInputSchema>;

/**
 * Mentee growth query. Fields map 1:1 to the scoring rules in spec section 5.
 * Empty optional lists mean "no preference" and score as satisfied.
 */
export const MentorshipRequestInputSchema = z.object({
  primaryArch: z.enum([...archCodes, PORTFOLIO_TARGET] as [string, ...string[]]),
  targetSubcategories: codesOf('SUBCATEGORY', { min: 1, max: 3 }),
  commercialSkills: z
    .array(z.string().refine((c) => isCodeOfKind('LICENSING', c) || isCodeOfKind('FINANCIAL', c), 'Unknown commercial skill'))
    .max(8)
    .transform((codes) => [...new Set(codes)]),
  stakeholderInterests: codesOf('STAKEHOLDER', { max: 4 }),
  dealSize: codeOf('DEAL_SIZE').nullable(),
  competitors: codesOf('COMPETITOR', { max: 5 }),
  formats: codesOf('FORMAT', { min: 1, max: 4 }),
  goal: z.string().trim().min(10).max(500),
});
export type MentorshipRequestInput = z.input<typeof MentorshipRequestInputSchema>;
export type MentorshipRequest = z.output<typeof MentorshipRequestInputSchema>;

export const SelectMentorInputSchema = z.object({
  mentorId: z.uuid(),
  message: z.string().trim().max(500).optional(),
});

export const DeclineInputSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const MENTORSHIP_STATUSES = ['PENDING', 'ACTIVE', 'DECLINED', 'CANCELLED', 'COMPLETED'] as const;
export type MentorshipStatus = (typeof MENTORSHIP_STATUSES)[number];

export const REQUEST_STATUSES = ['OPEN', 'MATCHED', 'CLOSED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Helper used by forms: all tag kinds as arrays of valid codes. */
export const ALL_CODES = {
  dealSizes: codesOfKind('DEAL_SIZE'),
  licensing: codesOfKind('LICENSING'),
  financial: codesOfKind('FINANCIAL'),
  stakeholder: codesOfKind('STAKEHOLDER'),
  competitors: codesOfKind('COMPETITOR'),
  formats: codesOfKind('FORMAT'),
  certifications: codesOfKind('CERT'),
};
