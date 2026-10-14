/**
 * The 100-point matching engine (spec section 5).
 *
 *   TOTAL = S_tech (35) + S_biz (25) + S_stakeholder (20) + S_format (20) − penalties
 *
 * Pure functions only: no I/O, so the API, the Webex bot and tests all share
 * exactly the same scoring. Every returned score carries a line-by-line
 * breakdown so a match is never a black box.
 *
 * Rules the spec leaves open, and how they are decided here:
 * - Role & Architecture (15): graduated. Same-architecture Specialist 15;
 *   Portfolio SE 10 with L2+ in the target architecture, 5 with only L1;
 *   other-architecture Specialist 0. For a "Portfolio breadth" target a
 *   Portfolio SE gets 15 and any Specialist 5.
 * - Subcategory gap (15): averaged over the mentee's 1–3 target subcategories.
 * - An empty mentee preference (no competitor, no commercial skill, no deal
 *   tier) means "no constraint" and scores as satisfied.
 * - Stakeholder disciplines are shown and used as a tie-breaker only.
 * - Same pod = same direct manager, or a direct manager/report pair.
 */
import {
  ARCHITECTURES,
  CERTIFICATIONS,
  DEAL_SIZES,
  PORTFOLIO_TARGET,
  archOfSubcategory,
  labelOf,
  shortLabelOf,
  timezoneLabel,
  type ArchCode,
} from './taxonomy.js';
import type { MentorshipRequest } from './schemas.js';
import { timezoneGapHours } from './timezone.js';

export const ALGORITHM_VERSION = 'v5.0';
export const STRONG_MATCH_THRESHOLD = 70;
export const DEFAULT_TOP_N = 3;

export const WEIGHTS = {
  tech: { max: 35, roleArch: 15, subcategory: 15, certs: 5 },
  biz: { max: 25, commercial: 15, dealSize: 10 },
  stakeholder: { max: 20, competitor: 10, regionSegment: 10 },
  format: { max: 20, format: 15, semantic: 5 },
  penalties: { timezoneGapHours: 4, timezone: -10, samePod: -15 },
  /** Cosine similarity mapped linearly onto 0–5 points between these bounds. */
  semantic: { floor: 0.25, ceiling: 0.75 },
} as const;

export interface MenteeContext {
  id: string;
  managerId: string | null;
  segment: string | null;
  regionalSub: string | null;
  timezone: string | null;
}

export interface MentorCandidate {
  id: string;
  fullName: string;
  cecId: string;
  jobTitle: string;
  seRole: string | null;
  specialistArch: string | null;
  segment: string | null;
  regionalSub: string | null;
  timezone: string | null;
  managerId: string | null;
  isMentor: boolean;
  menteeCapacity: number;
  activeMentees: number;
  /** subcategory code → level 1..3 */
  skills: Record<string, number>;
  dealSizes: string[];
  licensing: string[];
  financial: string[];
  stakeholder: string[];
  competitors: string[];
  formats: string[];
  certifications: string[];
  /** Cosine similarity of mentee goal vs mentor bio embeddings; null when unavailable. */
  bioSimilarity: number | null;
  /** Mentee and mentor already share a PENDING or ACTIVE mentorship. */
  hasOpenRelationship?: boolean;
}

export type CategoryKey = 'tech' | 'biz' | 'stakeholder' | 'format';

export interface ScoreLine {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoreCategory {
  key: CategoryKey;
  label: string;
  points: number;
  max: number;
  lines: ScoreLine[];
}

export interface PenaltyLine {
  key: 'timezone' | 'samePod';
  label: string;
  points: number;
  detail: string;
}

export type HighlightTone = 'tech' | 'biz' | 'competitor' | 'geo' | 'format' | 'cert' | 'stakeholder';

export interface Highlight {
  label: string;
  tone: HighlightTone;
}

export interface MatchBreakdown {
  algorithmVersion: string;
  total: number;
  strong: boolean;
  categories: ScoreCategory[];
  penalties: PenaltyLine[];
  highlights: Highlight[];
  /** PDF-style one-liner, e.g. "92% Match: AI Specialist (AI Fabrics L3 SME) + Arista displacement + …" */
  headline: string;
  /** "Why this match" sentence(s). */
  rationale: string;
  /** Mentee's requested stakeholder disciplines the mentor also covers (tie-breaker, not scored). */
  stakeholderOverlap: string[];
  timezoneGapHours: number | null;
  openSlots: number;
}

export type Exclusion = 'NOT_MENTOR' | 'SELF' | 'CAPACITY_FULL' | 'ALREADY_PAIRED';

export const EXCLUSION_LABELS: Record<Exclusion, string> = {
  NOT_MENTOR: 'Not in the mentor pool',
  SELF: 'Cannot mentor yourself',
  CAPACITY_FULL: 'Capacity gate: all mentee slots taken',
  ALREADY_PAIRED: 'Already paired or request pending',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const intersect = (a: readonly string[], b: readonly string[]) => a.filter((x) => b.includes(x));
const archShort = (code: string | null) => ARCHITECTURES.find((a) => a.code === code)?.short ?? code ?? '';
const levelName = (level: number) => (level === 3 ? 'L3 SME' : level === 2 ? 'L2 Proficient' : `L${level}`);

/** Capacity gate and hard exclusions — an excluded mentor scores 0 and is never shown. */
export function exclusionReason(mentee: MenteeContext, mentor: MentorCandidate): Exclusion | null {
  if (mentor.id === mentee.id) return 'SELF';
  if (!mentor.isMentor) return 'NOT_MENTOR';
  if (mentor.hasOpenRelationship) return 'ALREADY_PAIRED';
  if (mentor.activeMentees >= mentor.menteeCapacity) return 'CAPACITY_FULL';
  return null;
}

/* ------------------------------ S_tech ------------------------------ */

function roleArchLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.tech.roleArch;
  const base = { key: 'roleArch', label: 'Role & architecture', max };
  const target = request.primaryArch;
  const isSpecialist = mentor.seRole === 'SPECIALIST';

  if (target === PORTFOLIO_TARGET) {
    return isSpecialist
      ? { ...base, points: 5, detail: `${archShort(mentor.specialistArch)} Specialist — narrower than the requested portfolio breadth` }
      : { ...base, points: max, detail: 'Portfolio SE — broad multi-architecture coverage' };
  }

  if (isSpecialist) {
    return mentor.specialistArch === target
      ? { ...base, points: max, detail: `${archShort(target)} Specialist — exact architecture match` }
      : { ...base, points: 0, detail: `${archShort(mentor.specialistArch)} Specialist, not ${archShort(target)}` };
  }

  const levels = Object.entries(mentor.skills)
    .filter(([code]) => archOfSubcategory(code) === target)
    .map(([, level]) => level);
  const best = levels.length ? Math.max(...levels) : 0;
  if (best >= 2) return { ...base, points: 10, detail: `Portfolio SE with L${best} depth in ${archShort(target)}` };
  if (best === 1) return { ...base, points: 5, detail: `Portfolio SE, foundational (L1) in ${archShort(target)}` };
  return { ...base, points: 0, detail: `Portfolio SE without ${archShort(target)} ratings` };
}

function subcategoryLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.tech.subcategory;
  const per = request.targetSubcategories.map((code) => {
    const level = mentor.skills[code] ?? 0;
    return { code, level, points: level >= 3 ? 15 : level === 2 ? 10 : 0 };
  });
  const points = per.reduce((sum, p) => sum + p.points, 0) / per.length;
  const detail = per
    .map((p) => `${p.code} ${p.level ? `L${p.level}` : 'not rated'}`)
    .join(' · ');
  return { key: 'subcategory', label: 'Subcategory gap match', points: round1(points), max, detail };
}

function certLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.tech.certs;
  const base = { key: 'certs', label: 'Adjacent domain / cert breadth', max };
  const certs = CERTIFICATIONS.filter((c) => mentor.certifications.includes(c.code));
  if (certs.length === 0) return { ...base, points: 0, detail: 'No active certifications declared' };

  if (request.primaryArch === PORTFOLIO_TARGET) {
    const archs = new Set(certs.flatMap((c) => c.archs));
    const points = archs.size >= 2 ? max : 3;
    return { ...base, points, detail: `${certs.map((c) => c.label).join(', ')} — covers ${archs.size} architecture(s)` };
  }

  const wanted = new Set<ArchCode>([request.primaryArch as ArchCode]);
  for (const code of request.targetSubcategories) {
    const arch = archOfSubcategory(code);
    if (arch) wanted.add(arch);
  }
  const relevant = certs.filter((c) => c.archs.some((a) => wanted.has(a)));
  return relevant.length
    ? { ...base, points: max, detail: `Relevant: ${relevant.map((c) => c.label).join(', ')}` }
    : { ...base, points: 2, detail: `${certs.map((c) => c.label).join(', ')} (adjacent domain)` };
}

/* ------------------------------ S_biz ------------------------------- */

function commercialLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.biz.commercial;
  const base = { key: 'commercial', label: 'Commercial focus match', max };
  const wanted = request.commercialSkills;
  if (wanted.length === 0) return { ...base, points: max, detail: 'No commercial preference — not a constraint' };
  const offered = [...mentor.licensing, ...mentor.financial];
  const hit = intersect(wanted, offered);
  const miss = wanted.filter((c) => !hit.includes(c));
  const detail = [
    hit.length ? `Covers ${hit.map(shortLabelOf).join(', ')}` : '',
    miss.length ? `missing ${miss.map(shortLabelOf).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  return { ...base, points: round1((max * hit.length) / wanted.length), detail };
}

function dealSizeLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.biz.dealSize;
  const base = { key: 'dealSize', label: 'Deal size tier fit', max };
  if (!request.dealSize) return { ...base, points: max, detail: 'No deal tier preference — not a constraint' };
  if (mentor.dealSizes.includes(request.dealSize)) {
    return { ...base, points: max, detail: `Has closed ${labelOf(request.dealSize)} deals` };
  }
  const order = DEAL_SIZES.map((d) => d.code as string);
  const target = order.indexOf(request.dealSize);
  const larger = mentor.dealSizes.filter((d) => order.indexOf(d) > target);
  if (larger.length) {
    return { ...base, points: 5, detail: `Closed larger deals (${larger.map(labelOf).join(', ')}), not ${labelOf(request.dealSize)}` };
  }
  return { ...base, points: 0, detail: `No ${labelOf(request.dealSize)} deal experience declared` };
}

/* --------------------------- S_stakeholder -------------------------- */

function competitorLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.stakeholder.competitor;
  const base = { key: 'competitor', label: 'Competitor battle match', max };
  const facing = request.competitors;
  if (facing.length === 0) return { ...base, points: max, detail: 'No active competitor battle — not a constraint' };
  const hit = intersect(facing, mentor.competitors);
  const detail = hit.length
    ? `Verified takeouts vs ${hit.map(shortLabelOf).join(', ')}`
    : `No verified wins vs ${facing.map(shortLabelOf).join(', ')}`;
  return { ...base, points: round1((max * hit.length) / facing.length), detail };
}

function regionSegmentLine(mentee: MenteeContext, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.stakeholder.regionSegment;
  const sameRegion = !!mentee.regionalSub && mentee.regionalSub === mentor.regionalSub;
  const sameSegment = !!mentee.segment && mentee.segment === mentor.segment;
  const parts = [
    sameRegion ? `Same region (${labelOf(mentor.regionalSub)})` : `Region ${labelOf(mentor.regionalSub) || '—'}`,
    sameSegment ? `same segment (${labelOf(mentor.segment)})` : `segment ${labelOf(mentor.segment) || '—'}`,
  ];
  return {
    key: 'regionSegment',
    label: 'Regional sub-category & segment',
    points: (sameRegion ? 5 : 0) + (sameSegment ? 5 : 0),
    max,
    detail: parts.join(', '),
  };
}

/* ----------------------------- S_format ----------------------------- */

function formatLine(request: MentorshipRequest, mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.format.format;
  const hit = intersect(request.formats, mentor.formats);
  const detail = hit.length
    ? `Offers ${hit.map(labelOf).join(', ')}`
    : `Does not offer ${request.formats.map(labelOf).join(', ')}`;
  return { key: 'format', label: 'Coaching format match', points: round1((max * hit.length) / request.formats.length), max, detail };
}

function semanticLine(mentor: MentorCandidate): ScoreLine {
  const max = WEIGHTS.format.semantic;
  const base = { key: 'semantic', label: 'Superpower bio semantic match', max };
  if (mentor.bioSimilarity === null) return { ...base, points: 0, detail: 'No bio embedding available' };
  const { floor, ceiling } = WEIGHTS.semantic;
  const ratio = Math.min(1, Math.max(0, (mentor.bioSimilarity - floor) / (ceiling - floor)));
  return { ...base, points: round1(ratio * max), detail: `Cosine similarity ${mentor.bioSimilarity.toFixed(2)} (goal vs bio)` };
}

/* ----------------------------- Penalties ---------------------------- */

function penalties(mentee: MenteeContext, mentor: MentorCandidate, at: Date): { lines: PenaltyLine[]; gap: number | null } {
  const lines: PenaltyLine[] = [];
  let gap: number | null = null;
  if (mentee.timezone && mentor.timezone) {
    gap = timezoneGapHours(mentee.timezone, mentor.timezone, at);
    if (gap > WEIGHTS.penalties.timezoneGapHours) {
      lines.push({
        key: 'timezone',
        label: 'Timezone gap > 4h',
        points: WEIGHTS.penalties.timezone,
        detail: `${gap}h between ${timezoneLabel(mentee.timezone)} and ${timezoneLabel(mentor.timezone)}`,
      });
    }
  }
  const sameManager = !!mentee.managerId && mentee.managerId === mentor.managerId;
  const reportingLine = mentee.managerId === mentor.id || mentor.managerId === mentee.id;
  if (sameManager || reportingLine) {
    lines.push({
      key: 'samePod',
      label: 'Same pod / quota conflict',
      points: WEIGHTS.penalties.samePod,
      detail: reportingLine ? 'Direct reporting line' : 'Same direct manager — cross-team pairing preferred',
    });
  }
  return { lines, gap };
}

/* ----------------------------- Narrative ---------------------------- */

function narrative(
  request: MentorshipRequest,
  mentee: MenteeContext,
  mentor: MentorCandidate,
  total: number,
  gap: number | null,
  penaltyLines: PenaltyLine[],
): { headline: string; rationale: string; highlights: Highlight[] } {
  const highlights: Highlight[] = [];
  const headlineParts: string[] = [];
  const why: string[] = [];

  // Role + strongest target subcategory
  const targetLevels = request.targetSubcategories
    .map((code) => ({ code, level: mentor.skills[code] ?? 0 }))
    .sort((a, b) => b.level - a.level);
  const best = targetLevels[0];
  const roleText = mentor.seRole === 'SPECIALIST' ? `${archShort(mentor.specialistArch)} Specialist` : 'Portfolio SE';
  headlineParts.push(
    best && best.level >= 2 ? `${roleText} (${shortLabelOf(best.code)} ${levelName(best.level)})` : roleText,
  );
  for (const t of targetLevels.filter((t) => t.level >= 2)) {
    highlights.push({ label: `${shortLabelOf(t.code)} L${t.level}`, tone: 'tech' });
    why.push(`${levelName(t.level)} in ${labelOf(t.code)} (${t.code})`);
  }

  // Competitors
  const comps = intersect(request.competitors, mentor.competitors);
  if (comps.length) {
    headlineParts.push(comps.map((c) => `${shortLabelOf(c)} displacement`).join(' + '));
    for (const c of comps) highlights.push({ label: `${shortLabelOf(c)} takeout`, tone: 'competitor' });
    why.push(`verified ${comps.map(shortLabelOf).join(' and ')} takeouts`);
  }

  // Commercial
  const commercial = intersect(request.commercialSkills, [...mentor.licensing, ...mentor.financial]);
  if (commercial.length) {
    headlineParts.push(`${commercial.slice(0, 2).map(shortLabelOf).join(' & ')} expert`);
    for (const c of commercial) highlights.push({ label: shortLabelOf(c), tone: 'biz' });
    why.push(`coaches ${commercial.map(shortLabelOf).join(', ')}`);
  }
  if (request.dealSize && mentor.dealSizes.includes(request.dealSize)) {
    highlights.push({ label: `${labelOf(request.dealSize)} deals`, tone: 'biz' });
    why.push(`closes ${labelOf(request.dealSize)} deals`);
  }

  // Geo
  const sameRegion = !!mentee.regionalSub && mentee.regionalSub === mentor.regionalSub;
  const sameSegment = !!mentee.segment && mentee.segment === mentor.segment;
  const geo = [sameRegion ? labelOf(mentor.regionalSub) : '', sameSegment ? labelOf(mentor.segment) : '']
    .filter(Boolean)
    .join(' / ');
  if (geo) {
    headlineParts.push(geo);
    highlights.push({ label: geo, tone: 'geo' });
  }
  if (gap !== null && gap <= 1) {
    headlineParts.push(`${timezoneLabel(mentor.timezone)} overlap`);
    why.push(gap === 0 ? `same timezone (${timezoneLabel(mentor.timezone)})` : `${gap}h timezone delta`);
  } else if (gap !== null && gap <= WEIGHTS.penalties.timezoneGapHours) {
    why.push(`${gap}h timezone delta`);
  }

  // Formats
  const formats = intersect(request.formats, mentor.formats);
  if (formats.length) {
    for (const f of formats) highlights.push({ label: labelOf(f), tone: 'format' });
    why.push(`offers ${formats.map(labelOf).join(' and ')}`);
  }

  // Certifications (show the relevant ones only)
  const certs = CERTIFICATIONS.filter((c) => mentor.certifications.includes(c.code));
  if (certs.length) highlights.push({ label: certs.slice(0, 2).map((c) => c.label).join(' + '), tone: 'cert' });

  // Stakeholder (not scored)
  for (const s of intersect(request.stakeholderInterests, mentor.stakeholder)) {
    highlights.push({ label: labelOf(s), tone: 'stakeholder' });
  }

  const openSlots = Math.max(0, mentor.menteeCapacity - mentor.activeMentees);
  why.push(`${openSlots} of ${mentor.menteeCapacity} mentee slot${mentor.menteeCapacity > 1 ? 's' : ''} open`);
  for (const p of penaltyLines) why.push(`penalty: ${p.label.toLowerCase()} (${p.points})`);

  const sentence = why.join('; ');
  return {
    headline: `${total}% Match: ${headlineParts.join(' + ')}`,
    rationale: sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.',
    highlights,
  };
}

/* ------------------------------- API -------------------------------- */

export function scoreMentor(
  request: MentorshipRequest,
  mentee: MenteeContext,
  mentor: MentorCandidate,
  opts: { at?: Date } = {},
): MatchBreakdown {
  const at = opts.at ?? new Date();
  const category = (key: CategoryKey, label: string, max: number, lines: ScoreLine[]): ScoreCategory => ({
    key,
    label,
    max,
    lines,
    points: round1(lines.reduce((sum, l) => sum + l.points, 0)),
  });

  const categories = [
    category('tech', 'Tech & subcategory', WEIGHTS.tech.max, [
      roleArchLine(request, mentor),
      subcategoryLine(request, mentor),
      certLine(request, mentor),
    ]),
    category('biz', 'Business acumen', WEIGHTS.biz.max, [commercialLine(request, mentor), dealSizeLine(request, mentor)]),
    category('stakeholder', 'Stakeholder & competitor', WEIGHTS.stakeholder.max, [
      competitorLine(request, mentor),
      regionSegmentLine(mentee, mentor),
    ]),
    category('format', 'Coaching format & style', WEIGHTS.format.max, [formatLine(request, mentor), semanticLine(mentor)]),
  ];

  const { lines: penaltyLines, gap } = penalties(mentee, mentor, at);
  const raw =
    categories.reduce((sum, c) => sum + c.points, 0) + penaltyLines.reduce((sum, p) => sum + p.points, 0);
  const total = Math.max(0, Math.min(100, Math.round(raw)));
  const { headline, rationale, highlights } = narrative(request, mentee, mentor, total, gap, penaltyLines);

  return {
    algorithmVersion: ALGORITHM_VERSION,
    total,
    strong: total >= STRONG_MATCH_THRESHOLD,
    categories,
    penalties: penaltyLines,
    highlights,
    headline,
    rationale,
    stakeholderOverlap: intersect(request.stakeholderInterests, mentor.stakeholder),
    timezoneGapHours: gap,
    openSlots: Math.max(0, mentor.menteeCapacity - mentor.activeMentees),
  };
}

export interface RankedMatch {
  mentor: MentorCandidate;
  score: MatchBreakdown;
}

export interface RankResult {
  matches: RankedMatch[];
  evaluated: number;
  excluded: Partial<Record<Exclusion, number>>;
}

/**
 * Score every eligible mentor and return the top N.
 * Always returns the best available matches, flagged `strong` when ≥ 70.
 * Ties break on stakeholder overlap, then open slots, then bio similarity.
 */
export function rankMentors(
  request: MentorshipRequest,
  mentee: MenteeContext,
  candidates: readonly MentorCandidate[],
  opts: { limit?: number; at?: Date } = {},
): RankResult {
  const excluded: Partial<Record<Exclusion, number>> = {};
  const scored: RankedMatch[] = [];
  for (const mentor of candidates) {
    const reason = exclusionReason(mentee, mentor);
    if (reason) {
      excluded[reason] = (excluded[reason] ?? 0) + 1;
      continue;
    }
    scored.push({ mentor, score: scoreMentor(request, mentee, mentor, opts) });
  }
  scored.sort(
    (a, b) =>
      b.score.total - a.score.total ||
      b.score.stakeholderOverlap.length - a.score.stakeholderOverlap.length ||
      b.score.openSlots - a.score.openSlots ||
      (b.mentor.bioSimilarity ?? 0) - (a.mentor.bioSimilarity ?? 0) ||
      a.mentor.fullName.localeCompare(b.mentor.fullName),
  );
  return { matches: scored.slice(0, opts.limit ?? DEFAULT_TOP_N), evaluated: scored.length, excluded };
}
