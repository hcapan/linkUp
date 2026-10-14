import { describe, expect, it } from 'vitest';
import {
  MentorshipRequestInputSchema,
  ProfileInputSchema,
  rankMentors,
  scoreMentor,
  timezoneGapHours,
  type MenteeContext,
  type MentorCandidate,
  type MentorshipRequest,
} from '../src/index.js';

const AT = new Date('2026-01-15T12:00:00Z'); // winter: CET = UTC+1, PST = UTC-8

const mentee: MenteeContext = {
  id: 'mentee',
  managerId: 'mgr-a',
  segment: 'SEG_COMMERCIAL',
  regionalSub: 'REG_GERMANY',
  timezone: 'Europe/Berlin',
};

function request(overrides: Partial<MentorshipRequest> = {}): MentorshipRequest {
  return MentorshipRequestInputSchema.parse({
    primaryArch: 'AI',
    targetSubcategories: ['AI-1'],
    commercialSkills: ['LIC_EA3'],
    stakeholderInterests: [],
    dealSize: 'DEAL_1M_5M',
    competitors: ['COMP_ARISTA'],
    formats: ['FMT_LIVE_SHADOWING'],
    goal: 'Master Nexus HyperFabric and RoCEv2 GPU networking for AI deals.',
    ...overrides,
  });
}

function mentor(overrides: Partial<MentorCandidate> = {}): MentorCandidate {
  return {
    id: 'mentor',
    fullName: 'Ada Mentor',
    cecId: 'amentor',
    jobTitle: 'Technical Solutions Architect',
    seRole: 'SPECIALIST',
    specialistArch: 'AI',
    segment: 'SEG_COMMERCIAL',
    regionalSub: 'REG_GERMANY',
    timezone: 'Europe/Berlin',
    managerId: 'mgr-b',
    isMentor: true,
    menteeCapacity: 2,
    activeMentees: 0,
    skills: { 'AI-1': 3, 'AI-2': 2 },
    dealSizes: ['DEAL_1M_5M'],
    licensing: ['LIC_EA3'],
    financial: [],
    stakeholder: ['STK_CXO'],
    competitors: ['COMP_ARISTA'],
    formats: ['FMT_LIVE_SHADOWING'],
    certifications: ['CERT_CISCO_AI'],
    bioSimilarity: 0.7,
    ...overrides,
  };
}

const line = (score: ReturnType<typeof scoreMentor>, key: string) =>
  score.categories.flatMap((c) => c.lines).find((l) => l.key === key)!;

describe('scoreMentor', () => {
  it('gives a perfect-fit mentor 100 with a PDF-style headline', () => {
    const s = scoreMentor(request(), mentee, mentor(), { at: AT });
    expect(s.total).toBe(100);
    expect(s.strong).toBe(true);
    expect(s.penalties).toEqual([]);
    expect(s.headline).toMatch(/^100% Match: AI Specialist \(AI Fabrics \/ HyperFabric L3 SME\) \+ Arista displacement/);
    expect(s.headline).toContain('Germany / Commercial');
    expect(s.headline).toContain('CET overlap');
  });

  it('category maxima sum to 100', () => {
    const s = scoreMentor(request(), mentee, mentor(), { at: AT });
    expect(s.categories.reduce((sum, c) => sum + c.max, 0)).toBe(100);
    expect(s.categories.map((c) => c.max)).toEqual([35, 25, 20, 20]);
  });

  describe('role & architecture (graduated)', () => {
    it.each([
      ['same-arch Specialist', { seRole: 'SPECIALIST', specialistArch: 'AI' }, 15],
      ['other-arch Specialist', { seRole: 'SPECIALIST', specialistArch: 'SEC' }, 0],
      ['Portfolio with L2 in target', { seRole: 'PORTFOLIO', specialistArch: null, skills: { 'AI-4': 2 } }, 10],
      ['Portfolio with L1 only', { seRole: 'PORTFOLIO', specialistArch: null, skills: { 'AI-1': 1 } }, 5],
      ['Portfolio without target ratings', { seRole: 'PORTFOLIO', specialistArch: null, skills: { 'EN-1': 3 } }, 0],
    ] as const)('%s → %i', (_name, overrides, expected) => {
      const s = scoreMentor(request(), mentee, mentor(overrides as Partial<MentorCandidate>), { at: AT });
      expect(line(s, 'roleArch').points).toBe(expected);
    });

    it('Portfolio breadth target: Portfolio 15, Specialist 5', () => {
      const req = request({ primaryArch: 'PORTFOLIO', targetSubcategories: ['EN-1', 'SEC-3'] });
      expect(line(scoreMentor(req, mentee, mentor({ seRole: 'PORTFOLIO', specialistArch: null }), { at: AT }), 'roleArch').points).toBe(15);
      expect(line(scoreMentor(req, mentee, mentor(), { at: AT }), 'roleArch').points).toBe(5);
    });
  });

  it('averages the subcategory gap score over targets (L3=15, L2=10, else 0)', () => {
    const req = request({ targetSubcategories: ['AI-1', 'AI-2', 'AI-3'] });
    const s = scoreMentor(req, mentee, mentor({ skills: { 'AI-1': 3, 'AI-2': 2, 'AI-3': 1 } }), { at: AT });
    expect(line(s, 'subcategory').points).toBeCloseTo((15 + 10 + 0) / 3, 1);
  });

  it('treats empty preferences as satisfied', () => {
    const req = request({ commercialSkills: [], competitors: [], dealSize: null });
    const s = scoreMentor(req, mentee, mentor({ licensing: [], competitors: [], dealSizes: [] }), { at: AT });
    expect(line(s, 'commercial').points).toBe(15);
    expect(line(s, 'competitor').points).toBe(10);
    expect(line(s, 'dealSize').points).toBe(10);
  });

  it('gives partial deal-size credit for larger deal experience only', () => {
    expect(line(scoreMentor(request(), mentee, mentor({ dealSizes: ['DEAL_GT_5M'] }), { at: AT }), 'dealSize').points).toBe(5);
    expect(line(scoreMentor(request(), mentee, mentor({ dealSizes: ['DEAL_LT_250K'] }), { at: AT }), 'dealSize').points).toBe(0);
  });

  it('applies the timezone penalty above 4h', () => {
    const s = scoreMentor(request(), mentee, mentor({ timezone: 'America/Los_Angeles' }), { at: AT });
    expect(s.timezoneGapHours).toBe(9);
    expect(s.penalties.map((p) => [p.key, p.points])).toEqual([['timezone', -10]]);
    expect(s.total).toBe(90);
  });

  it('applies the same-pod penalty for a shared manager or reporting line', () => {
    expect(scoreMentor(request(), mentee, mentor({ managerId: 'mgr-a' }), { at: AT }).total).toBe(85);
    expect(scoreMentor(request(), mentee, mentor({ id: 'mgr-a', managerId: null }), { at: AT }).penalties[0]?.key).toBe('samePod');
  });

  it('maps bio similarity linearly onto 0–5', () => {
    expect(line(scoreMentor(request(), mentee, mentor({ bioSimilarity: 0.2 }), { at: AT }), 'semantic').points).toBe(0);
    expect(line(scoreMentor(request(), mentee, mentor({ bioSimilarity: 0.5 }), { at: AT }), 'semantic').points).toBe(2.5);
    expect(line(scoreMentor(request(), mentee, mentor({ bioSimilarity: null }), { at: AT }), 'semantic').points).toBe(0);
  });

  it('never goes below zero', () => {
    const weak = mentor({
      seRole: 'SPECIALIST',
      specialistArch: 'COL',
      skills: {},
      licensing: [],
      dealSizes: [],
      competitors: [],
      formats: [],
      certifications: [],
      segment: 'SEG_SP',
      regionalSub: 'REG_UK',
      timezone: 'Asia/Singapore',
      managerId: 'mgr-a',
      bioSimilarity: 0,
    });
    expect(scoreMentor(request(), mentee, weak, { at: AT }).total).toBe(0);
  });
});

describe('rankMentors', () => {
  it('excludes self, non-mentors, full capacity and existing pairs', () => {
    const result = rankMentors(
      request(),
      mentee,
      [
        mentor({ id: 'mentee' }),
        mentor({ id: 'm1', isMentor: false }),
        mentor({ id: 'm2', menteeCapacity: 1, activeMentees: 1 }),
        mentor({ id: 'm3', hasOpenRelationship: true }),
        mentor({ id: 'm4' }),
      ],
      { at: AT },
    );
    expect(result.matches.map((m) => m.mentor.id)).toEqual(['m4']);
    expect(result.evaluated).toBe(1);
    expect(result.excluded).toEqual({ SELF: 1, NOT_MENTOR: 1, CAPACITY_FULL: 1, ALREADY_PAIRED: 1 });
  });

  it('returns the top 3 by score even when below the strong threshold', () => {
    const candidates = [
      mentor({ id: 'a', fullName: 'A', timezone: 'Asia/Singapore' }),
      mentor({ id: 'b', fullName: 'B' }),
      mentor({ id: 'c', fullName: 'C', seRole: 'SPECIALIST', specialistArch: 'SEC', skills: {}, competitors: [] }),
      mentor({ id: 'd', fullName: 'D', formats: [] }),
    ];
    const { matches } = rankMentors(request(), mentee, candidates, { at: AT });
    expect(matches.map((m) => m.mentor.id)).toEqual(['b', 'a', 'd']);
    const weakest = rankMentors(request(), mentee, [candidates[2]!], { at: AT }).matches[0]!;
    expect(weakest.score.strong).toBe(false);
  });

  it('breaks ties on stakeholder overlap, then open slots', () => {
    const req = request({ stakeholderInterests: ['STK_CXO'] });
    const { matches } = rankMentors(
      req,
      mentee,
      [
        mentor({ id: 'no-cxo', fullName: 'A', stakeholder: [] }),
        mentor({ id: 'cxo-busy', fullName: 'B', activeMentees: 1 }),
        mentor({ id: 'cxo-free', fullName: 'C' }),
      ],
      { at: AT },
    );
    expect(matches.map((m) => m.mentor.id)).toEqual(['cxo-free', 'cxo-busy', 'no-cxo']);
  });
});

describe('timezoneGapHours', () => {
  it('handles DST and wraps around the clock', () => {
    expect(timezoneGapHours('Europe/Berlin', 'Europe/London', AT)).toBe(1);
    expect(timezoneGapHours('America/Los_Angeles', 'Asia/Singapore', AT)).toBe(8); // 16h raw → 8h
    // US switches to DST two weeks before Europe
    expect(timezoneGapHours('Europe/Berlin', 'America/New_York', new Date('2026-03-20T12:00:00Z'))).toBe(5);
    expect(timezoneGapHours('Europe/Berlin', 'America/New_York', AT)).toBe(6);
  });
});

describe('schemas', () => {
  const base = {
    fullName: 'Test Person',
    cecId: 'tperson',
    email: 'tperson@example.com',
    jobTitle: 'Systems Engineer',
    seRole: 'PORTFOLIO',
    theater: 'EMEAR',
    segment: 'SEG_COMMERCIAL',
    regionalSub: 'REG_UK',
    timezone: 'Europe/London',
    bio: '',
    certifications: [],
    isMentor: false,
    menteeCapacity: 1,
    skills: [],
    dealSizes: [],
    licensing: [],
    financial: [],
    stakeholder: [],
    competitors: [],
    formats: [],
  };

  it('requires an architecture for Specialists and clears it for Portfolio SEs', () => {
    expect(ProfileInputSchema.safeParse({ ...base, seRole: 'SPECIALIST' }).success).toBe(false);
    expect(ProfileInputSchema.parse({ ...base, specialistArch: 'AI' }).specialistArch).toBeNull();
  });

  it('asks mentors for a bio, an L2+ skill and a coaching format', () => {
    const result = ProfileInputSchema.safeParse({ ...base, isMentor: true });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['bio', 'skills', 'formats']));
  });

  it('rejects unknown taxonomy codes', () => {
    expect(ProfileInputSchema.safeParse({ ...base, competitors: ['COMP_UNKNOWN'] }).success).toBe(false);
    expect(MentorshipRequestInputSchema.safeParse({ ...request(), targetSubcategories: ['AI-9'] }).success).toBe(false);
  });
});
