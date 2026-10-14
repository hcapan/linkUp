/**
 * Deterministic mock data for the demo: EMEAR SE teams with managers,
 * realistic skill profiles, commercial acumen, competitor wins and bios.
 * All people are fictional and use @example.com addresses.
 */
import {
  COMPETITORS,
  SUBCATEGORIES,
  type ArchCode,
  type Profile,
} from '@linkup/core';

/* --------------------------- random helpers --------------------------- */

export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    chance: (p: number) => next() < p,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    weighted: <T>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [item, w] of items) {
        x -= w;
        if (x <= 0) return item;
      }
      return items[items.length - 1]![0];
    },
    sample: <T>(items: readonly T[], n: number): T[] => {
      const copy = [...items];
      const out: T[] = [];
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]!);
      return out;
    },
  };
  return r;
}
type Rng = ReturnType<typeof rng>;

/* ------------------------------ regions ------------------------------ */

type Region = 'REG_GERMANY' | 'REG_UK' | 'REG_NORTH' | 'REG_SOUTH' | 'REG_METAC';

const NAMES: Record<Region, { first: string[]; last: string[]; tz: readonly (readonly [string, number])[] }> = {
  REG_GERMANY: {
    first: ['Lena', 'Jonas', 'Felix', 'Anna', 'Maximilian', 'Sophie', 'Lukas', 'Laura', 'Tobias', 'Julia', 'Niklas', 'Hannah', 'Moritz', 'Katharina', 'Florian', 'Miriam', 'Jan', 'Vanessa', 'Stefan', 'Carla'],
    last: ['Fischer', 'Weber', 'Müller', 'Schmidt', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Braun'],
    tz: [['Europe/Berlin', 1]],
  },
  REG_UK: {
    first: ['Oliver', 'Amelia', 'Harry', 'Priya', 'George', 'Charlotte', 'James', 'Emily', 'Samuel', 'Grace', 'Tom', 'Isla', 'Arjun', 'Freya', 'Daniel', 'Chloe', 'Kwame', 'Hannah', 'Rhys', 'Aisha'],
    last: ['Smith', 'Jones', 'Taylor', 'Raman', 'Brown', 'Davies', 'Wilson', 'Evans', 'Okafor', 'Thomas', 'Roberts', 'Patel', 'Walker', 'Wright', 'Hughes', 'Green', 'Clarke', 'Murphy', 'Mensah', 'Khan'],
    tz: [['Europe/London', 1]],
  },
  REG_NORTH: {
    first: ['Erik', 'Sofie', 'Lars', 'Emma', 'Mikko', 'Ingrid', 'Daan', 'Freja', 'Anders', 'Liv', 'Sander', 'Noor', 'Johan', 'Astrid', 'Pieter', 'Elin', 'Mats', 'Saga', 'Bram', 'Aino'],
    last: ['Andersson', 'Jansen', 'Nielsen', 'de Vries', 'Virtanen', 'Hansen', 'Bakker', 'Johansson', 'Larsen', 'Visser', 'Lindqvist', 'Peeters', 'Korhonen', 'Berg', 'Mertens', 'Dahl', 'Smit', 'Holm', 'Maes', 'Nyström'],
    tz: [['Europe/Berlin', 0.8], ['Europe/Athens', 0.2]],
  },
  REG_SOUTH: {
    first: ['Lucas', 'Chiara', 'Marco', 'Lucía', 'Inès', 'Pedro', 'Giulia', 'Hugo', 'Alejandro', 'Camille', 'Matteo', 'Sofia', 'Diego', 'Élodie', 'Javier', 'Beatriz', 'Luca', 'Manon', 'Rafael', 'Martina'],
    last: ['Martin', 'Rossi', 'Bianchi', 'García', 'Dubois', 'Santos', 'Romano', 'Laurent', 'Fernández', 'Moreau', 'Ricci', 'López', 'Costa', 'Lefèvre', 'Navarro', 'Ferreira', 'Greco', 'Girard', 'Oliveira', 'Conti'],
    tz: [['Europe/Berlin', 0.85], ['Europe/London', 0.15]],
  },
  REG_METAC: {
    first: ['Ahmet', 'Elif', 'Omar', 'Layla', 'Mehmet', 'Zeynep', 'Thabo', 'Amina', 'Yusuf', 'Fatima', 'Can', 'Selin', 'Karim', 'Noura', 'Emre', 'Deniz', 'Tariq', 'Leila', 'Burak', 'Nadia'],
    last: ['Yılmaz', 'Demir', 'Haddad', 'Nasser', 'Kaya', 'Arslan', 'Nkosi', 'Bello', 'Aydın', 'Al-Mansouri', 'Öztürk', 'Şahin', 'Mansour', 'Khalil', 'Çelik', 'Aksoy', 'Rahman', 'Farouk', 'Koç', 'Saleh'],
    tz: [['Europe/Istanbul', 0.45], ['Asia/Dubai', 0.35], ['Europe/Athens', 0.2]],
  },
};

const REGION_WEIGHTS: (readonly [Region, number])[] = [
  ['REG_GERMANY', 0.24],
  ['REG_UK', 0.22],
  ['REG_NORTH', 0.16],
  ['REG_SOUTH', 0.18],
  ['REG_METAC', 0.2],
];

const SEGMENT_WEIGHTS = [
  ['SEG_COMMERCIAL', 0.3],
  ['SEG_GLOBAL_ENTERPRISE', 0.25],
  ['SEG_CGEM', 0.15],
  ['SEG_SP', 0.15],
  ['SEG_GVE', 0.15],
] as const;

const SEGMENT_TEAM_NAME: Record<string, string> = {
  SEG_COMMERCIAL: 'Commercial',
  SEG_GLOBAL_ENTERPRISE: 'Global Enterprise',
  SEG_CGEM: 'CGEM',
  SEG_SP: 'Service Provider',
  SEG_GVE: 'GVE',
};

/* ----------------------------- seniority ----------------------------- */

type Seniority = 'associate' | 'se' | 'senior' | 'tsa' | 'principal';

const TITLES: Record<Seniority, string> = {
  associate: 'Associate Systems Engineer',
  se: 'Systems Engineer',
  senior: 'Senior Systems Engineer',
  tsa: 'Technical Solutions Architect',
  principal: 'Principal Architect',
};

const MENTOR_PROBABILITY: Record<Seniority, number> = {
  associate: 0.04,
  se: 0.4,
  senior: 0.78,
  tsa: 0.82,
  principal: 0.9,
};

/* ------------------------------- people ------------------------------ */

export interface SeedPerson {
  key: string;
  managerKey: string | null;
  isAdmin: boolean;
  seniority: Seniority | 'manager' | 'director' | 'admin';
  profile: Profile;
}

const ARCHS: ArchCode[] = ['AI', 'CAI', 'EN', 'SEC', 'COL'];
const ARCH_WEIGHTS: (readonly [ArchCode, number])[] = [
  ['AI', 0.22],
  ['SEC', 0.26],
  ['EN', 0.24],
  ['CAI', 0.18],
  ['COL', 0.1],
];

const CERTS_BY_ARCH: Record<ArchCode, string[]> = {
  AI: ['CERT_CISCO_AI', 'CERT_CCIE_DC', 'CERT_CKA', 'CERT_AWS_SA'],
  CAI: ['CERT_SPLUNK_ARCH', 'CERT_CCIE_DC', 'CERT_AZURE_SA', 'CERT_AWS_SA', 'CERT_CKA'],
  EN: ['CERT_CCIE_ENT', 'CERT_CCNP', 'CERT_DEVNET_PRO', 'CERT_CCIE_SP'],
  SEC: ['CERT_CCIE_SEC', 'CERT_CISSP', 'CERT_CCNP'],
  COL: ['CERT_CCIE_COL', 'CERT_CCNP'],
};

const COMPETITORS_BY_ARCH: Record<ArchCode, string[]> = Object.fromEntries(
  ARCHS.map((arch) => [arch, COMPETITORS.filter((c) => (c.archs as readonly string[]).includes(arch)).map((c) => c.code)]),
) as Record<ArchCode, string[]>;
COMPETITORS_BY_ARCH.COL = [];

/** Adjacent architectures, used for Specialists' secondary skills. */
const ADJACENT: Record<ArchCode, ArchCode[]> = {
  AI: ['CAI', 'SEC'],
  CAI: ['AI', 'SEC'],
  EN: ['SEC', 'CAI'],
  SEC: ['EN', 'CAI'],
  COL: ['EN', 'AI'],
};

const ARCH_SHORT: Record<ArchCode, string> = { AI: 'AI', CAI: 'CAI', EN: 'EN', SEC: 'Security', COL: 'Collab' };

const subsOf = (arch: ArchCode) => SUBCATEGORIES.filter((s) => s.arch === arch).map((s) => s.code as string);

function asciiSlug(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function skillsFor(r: Rng, seniority: Seniority, role: 'PORTFOLIO' | 'SPECIALIST', arch: ArchCode | null) {
  const skills = new Map<string, number>();
  const cap = seniority === 'associate' ? 2 : 3;
  const boost = { associate: -1, se: 0, senior: 0, tsa: 1, principal: 1 }[seniority];
  const set = (code: string, level: number) =>
    skills.set(code, Math.max(skills.get(code) ?? 0, Math.min(cap, Math.max(1, level))));

  if (role === 'SPECIALIST' && arch) {
    const core = r.sample(subsOf(arch), r.int(2, subsOf(arch).length));
    core.forEach((code, i) => set(code, (i < 2 ? 3 : r.int(1, 3)) + (i < 2 ? boost - 0 : 0) - (seniority === 'associate' ? 1 : 0)));
    for (const adj of r.sample(ADJACENT[arch], r.int(1, 2))) {
      for (const code of r.sample(subsOf(adj), r.int(1, 2))) set(code, r.int(1, 2) + (boost > 0 ? r.int(0, 1) : 0));
    }
  } else {
    const archs = r.sample(ARCHS, r.int(3, 4));
    for (const a of archs) {
      for (const code of r.sample(subsOf(a), r.int(1, 3))) set(code, r.weighted([[1, 0.4], [2, 0.5], [3, 0.1]]) + boost);
    }
    if (seniority !== 'associate' && r.chance(0.6)) set(r.pick(subsOf(r.pick(archs))), 3);
  }
  return [...skills].map(([subcategory, level]) => ({ subcategory, level: level as 1 | 2 | 3 }));
}

function dealSizesFor(r: Rng, seniority: Seniority, segment: string): string[] {
  const bySegment: Record<string, string[]> = {
    SEG_COMMERCIAL: ['DEAL_LT_250K', 'DEAL_250K_1M', 'DEAL_1M_5M'],
    SEG_GLOBAL_ENTERPRISE: ['DEAL_250K_1M', 'DEAL_1M_5M', 'DEAL_GT_5M'],
    SEG_CGEM: ['DEAL_250K_1M', 'DEAL_1M_5M', 'DEAL_GT_5M'],
    SEG_SP: ['DEAL_1M_5M', 'DEAL_GT_5M'],
    SEG_GVE: ['DEAL_LT_250K', 'DEAL_250K_1M', 'DEAL_1M_5M'],
  };
  const pool = bySegment[segment] ?? bySegment.SEG_COMMERCIAL!;
  const n = { associate: 1, se: r.int(1, 2), senior: r.int(2, 3), tsa: r.int(2, 3), principal: 3 }[seniority];
  const sizes = pool.slice(0, Math.min(pool.length, n + (seniority === 'associate' ? 0 : 1)));
  return seniority === 'associate' ? sizes.slice(0, 1) : r.sample(sizes, Math.min(sizes.length, n));
}

function describe(profile: Omit<Profile, 'bio'>, seniority: Seniority, region: Region): string {
  const top = [...profile.skills].sort((a, b) => b.level - a.level).slice(0, 3);
  const products = top
    .map((s) => SUBCATEGORIES.find((x) => x.code === s.subcategory)!.detail.split(', ').slice(0, 2).join(' and '))
    .join(', ');
  const regionLabel = { REG_GERMANY: 'Germany', REG_UK: 'the UK', REG_NORTH: 'the Nordics & Benelux', REG_SOUTH: 'Southern Europe', REG_METAC: 'METAC' }[region];
  const segment = SEGMENT_TEAM_NAME[profile.segment]!;
  const archLabel = profile.specialistArch
    ? { AI: 'AI & AI Fabrics', CAI: 'Cloud, Compute & Observability', EN: 'Enterprise Networking', SEC: 'Security', COL: 'Collaboration' }[profile.specialistArch as ArchCode]
    : 'multi-architecture';
  const commercial = [
    profile.licensing.includes('LIC_EA3') ? 'EA 3.0 structuring' : '',
    profile.financial.includes('FIN_TCO') ? 'TCO modelling' : '',
    profile.financial.includes('FIN_CFO_CASE') ? 'CFO business cases' : '',
    profile.financial.includes('FIN_CAPEX_OPEX') ? 'CapEx-to-OpEx models' : '',
  ].filter(Boolean);
  const comp = profile.competitors
    .map((c) => COMPETITORS.find((x) => x.code === c)!.short)
    .slice(0, 2);
  const lead = {
    associate: 'Early-career SE',
    se: 'Field SE',
    senior: 'Senior SE',
    tsa: `${archLabel} specialist`,
    principal: `Principal ${archLabel} architect`,
  }[seniority];

  const parts = [`${lead} with hands-on depth in ${products}`];
  if (commercial.length) parts.push(`and a track record in ${commercial.slice(0, 2).join(' and ')}`);
  let bio = `${parts.join(' ')} across ${regionLabel} ${segment} accounts.`;
  if (comp.length) bio += ` Led ${comp.join(' and ')} displacements.`;
  return bio;
}

export function generatePeople(count: number, seed = 42): SeedPerson[] {
  const r = rng(seed);
  const used = new Set<string>();
  const out: SeedPerson[] = [];

  const makeName = (region: Region) => {
    for (let i = 0; i < 50; i++) {
      const first = r.pick(NAMES[region].first);
      const last = r.pick(NAMES[region].last);
      const full = `${first} ${last}`;
      if (!used.has(full)) {
        used.add(full);
        return { first, last, full };
      }
    }
    const first = r.pick(NAMES[region].first);
    const last = `${r.pick(NAMES[region].last)}-${r.pick(NAMES[region].last)}`;
    used.add(`${first} ${last}`);
    return { first, last, full: `${first} ${last}` };
  };
  const cecIds = new Set<string>();
  const makeCec = (first: string, last: string) => {
    const base = (asciiSlug(first)[0] + asciiSlug(last)).slice(0, 8);
    let cec = base;
    for (let n = 2; cecIds.has(cec); n++) cec = `${base.slice(0, 7)}${n}`;
    cecIds.add(cec);
    return cec;
  };
  const baseProfile = (region: Region, segment: string, name: { first: string; last: string; full: string }) => {
    const cecId = makeCec(name.first, name.last);
    const timezone =
      segment === 'SEG_GVE' && r.chance(0.3) ? 'Asia/Kolkata' : r.weighted(NAMES[region].tz);
    return {
      fullName: name.full,
      cecId,
      email: `${cecId}@example.com`,
      theater: 'EMEAR',
      segment,
      regionalSub: region,
      timezone,
    };
  };

  // Program admin
  out.push({
    key: 'admin',
    managerKey: null,
    isAdmin: true,
    seniority: 'admin',
    profile: {
      fullName: 'Morgan Ellis',
      cecId: 'mellis',
      email: 'mellis@example.com',
      jobTitle: 'SE Enablement Program Lead',
      managerId: null,
      seRole: 'PORTFOLIO',
      specialistArch: null,
      theater: 'EMEAR',
      segment: 'SEG_GLOBAL_ENTERPRISE',
      regionalSub: 'REG_UK',
      timezone: 'Europe/London',
      bio: 'Runs the EMEAR SE mentorship program and enablement strategy.',
      certifications: [],
      isMentor: false,
      menteeCapacity: 1,
      skills: [],
      dealSizes: [],
      licensing: [],
      financial: [],
      stakeholder: ['STK_INTERNAL_NAV'],
      competitors: [],
      formats: [],
    },
  });
  used.add('Morgan Ellis');
  cecIds.add('mellis');

  // Directors: one per regional sub-category
  const regions = REGION_WEIGHTS.map(([region]) => region);
  const directors = new Map<Region, string>();
  for (const region of regions) {
    const name = makeName(region);
    const key = `dir-${region}`;
    directors.set(region, key);
    out.push({
      key,
      managerKey: null,
      isAdmin: false,
      seniority: 'director',
      profile: {
        ...baseProfile(region, 'SEG_GLOBAL_ENTERPRISE', name),
        jobTitle: 'Regional SE Director',
        managerId: null,
        seRole: 'PORTFOLIO',
        specialistArch: null,
        bio: '',
        certifications: [],
        isMentor: false,
        menteeCapacity: 1,
        skills: [],
        dealSizes: ['DEAL_GT_5M'],
        licensing: ['LIC_EA3'],
        financial: ['FIN_CFO_CASE'],
        stakeholder: ['STK_CXO', 'STK_INTERNAL_NAV'],
        competitors: [],
        formats: [],
      },
    });
  }

  // Teams: ~9 SEs per manager, a team = region × segment
  const teamSize = 9;
  const teams = Math.max(regions.length, Math.round(count / teamSize));
  for (let t = 0; t < teams; t++) {
    const region = t < regions.length ? regions[t]! : r.weighted(REGION_WEIGHTS);
    const segment = r.weighted(SEGMENT_WEIGHTS);
    const mgrName = makeName(region);
    const mgrKey = `mgr-${t}`;
    out.push({
      key: mgrKey,
      managerKey: directors.get(region)!,
      isAdmin: false,
      seniority: 'manager',
      profile: {
        ...baseProfile(region, segment, mgrName),
        jobTitle: `SE Manager, ${SEGMENT_TEAM_NAME[segment]}`,
        managerId: null,
        seRole: 'PORTFOLIO',
        specialistArch: null,
        bio: '',
        certifications: [],
        isMentor: false,
        menteeCapacity: 1,
        skills: [],
        dealSizes: [],
        licensing: [],
        financial: [],
        stakeholder: ['STK_INTERNAL_NAV'],
        competitors: [],
        formats: [],
      },
    });

    const size = t === teams - 1 ? Math.max(3, count - t * teamSize) : r.int(teamSize - 2, teamSize + 2);
    for (let i = 0; i < size && out.filter((p) => p.managerKey?.startsWith('mgr-')).length < count; i++) {
      const seniority = r.weighted<Seniority>([
        ['associate', 0.16],
        ['se', 0.34],
        ['senior', 0.24],
        ['tsa', 0.2],
        ['principal', 0.06],
      ]);
      const role = seniority === 'tsa' || seniority === 'principal' || r.chance(0.12) ? 'SPECIALIST' : 'PORTFOLIO';
      const arch = role === 'SPECIALIST' ? r.weighted(ARCH_WEIGHTS) : null;
      const name = makeName(region);
      const base = baseProfile(region, segment, name);
      const skills = skillsFor(r, seniority, role, arch);
      const isMentor = r.chance(MENTOR_PROBABILITY[seniority]);
      const primaryArchs = arch
        ? [arch, ...ADJACENT[arch].slice(0, 1)]
        : [...new Set(skills.filter((s) => s.level >= 2).map((s) => SUBCATEGORIES.find((x) => x.code === s.subcategory)!.arch))];

      const certs = seniority === 'associate' ? [] : r.sample([...new Set(primaryArchs.flatMap((a) => CERTS_BY_ARCH[a]))], r.int(0, seniority === 'se' ? 1 : 3));
      const competitors =
        seniority === 'associate' || seniority === 'se' && !r.chance(0.5)
          ? []
          : r.sample([...new Set(primaryArchs.flatMap((a) => COMPETITORS_BY_ARCH[a]))], r.int(1, 2));

      const withoutBio = {
        ...base,
        jobTitle: arch && seniority !== 'tsa' && seniority !== 'principal' ? `${TITLES[seniority]} — ${ARCH_SHORT[arch]} Specialist` : TITLES[seniority],
        managerId: null,
        seRole: role,
        specialistArch: arch,
        certifications: certs,
        isMentor,
        menteeCapacity: (r.chance(0.55) ? 2 : 1) as 1 | 2,
        skills,
        dealSizes: dealSizesFor(r, seniority, segment),
        licensing: r.sample(['LIC_EA3', 'LIC_SAAS', 'LIC_TRUE_FORWARD', 'LIC_HAAS'], seniority === 'associate' ? r.int(0, 1) : r.int(1, 3)).sort(),
        financial: r.sample(['FIN_CAPEX_OPEX', 'FIN_TCO', 'FIN_CFO_CASE', 'FIN_DOWNTIME_ROI'], seniority === 'associate' ? r.int(0, 1) : r.int(1, 3)).sort(),
        stakeholder: r.sample(['STK_TECH_CHAMPIONS', 'STK_CXO', 'STK_INTERNAL_NAV', 'STK_POLITICS'], seniority === 'associate' ? r.int(0, 1) : r.int(1, 3)).sort(),
        competitors,
        formats: isMentor
          ? r.sample(['FMT_LIVE_SHADOWING', 'FMT_DRY_RUN_WHITEBOARD', 'FMT_TAKEOUT_LAB', 'FMT_POV_SCOPING'], r.int(1, 3)).sort()
          : [],
      };
      const bio = isMentor || r.chance(0.5) ? describe(withoutBio as Omit<Profile, 'bio'>, seniority, region) : '';
      out.push({
        key: `se-${out.length}`,
        managerKey: mgrKey,
        isAdmin: false,
        seniority,
        profile: { ...withoutBio, bio } as Profile,
      });
    }
  }
  return out;
}

/* --------------------------- mentee requests --------------------------- */

export interface SeedRequest {
  primaryArch: string;
  targetSubcategories: string[];
  commercialSkills: string[];
  stakeholderInterests: string[];
  dealSize: string | null;
  competitors: string[];
  formats: string[];
  goal: string;
}

/** A plausible growth query for a person: grow where they are weakest. */
export function generateRequest(r: Rng, person: SeedPerson): SeedRequest {
  const own = new Map(person.profile.skills.map((s) => [s.subcategory, s.level]));
  const arch = person.profile.specialistArch && r.chance(0.35)
    ? (person.profile.specialistArch as ArchCode)
    : r.weighted(ARCH_WEIGHTS);
  const candidates = subsOf(arch).filter((code) => (own.get(code) ?? 0) < 3);
  const targets = r.sample(candidates.length ? candidates : subsOf(arch), r.int(1, 2));
  const details = targets.map((code) => SUBCATEGORIES.find((s) => s.code === code)!.detail.split(', ').slice(0, 2).join(' and '));
  const commercial = r.sample(['LIC_EA3', 'LIC_SAAS', 'FIN_TCO', 'FIN_CFO_CASE', 'FIN_CAPEX_OPEX'], r.int(0, 2));
  const competitors = r.chance(0.6) ? r.sample(COMPETITORS_BY_ARCH[arch], 1) : [];
  const title = person.profile.jobTitle.split(' — ')[0];
  const goal = `${title} looking to master ${details.join(' and ')}${
    commercial.includes('LIC_EA3') ? ', plus EA 3.0 deal defense' : ''
  }${competitors.length ? ` to win against ${COMPETITORS.find((c) => c.code === competitors[0])!.short}` : ''}.`;
  return {
    primaryArch: arch,
    targetSubcategories: targets,
    commercialSkills: commercial,
    stakeholderInterests: r.chance(0.4) ? r.sample(['STK_CXO', 'STK_TECH_CHAMPIONS', 'STK_POLITICS'], 1) : [],
    dealSize: r.chance(0.8) ? r.pick(person.profile.dealSizes.length ? person.profile.dealSizes : ['DEAL_250K_1M']) : null,
    competitors,
    formats: r.sample(['FMT_LIVE_SHADOWING', 'FMT_DRY_RUN_WHITEBOARD', 'FMT_TAKEOUT_LAB', 'FMT_POV_SCOPING'], r.int(1, 2)),
    goal,
  };
}
