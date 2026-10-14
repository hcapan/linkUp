/**
 * SE Mentorship taxonomy — single source of truth.
 *
 * Mirrors "SE Mentorship: Intake Profile & Architecture Taxonomy v5" (internal spec, not in the repo).
 * Every code is globally unique so the database can reference any item through
 * one `taxonomy_items.code` foreign key. When the spec moves to v6, edit this
 * file and re-run `pnpm db:seed --taxonomy-only`; no schema change is needed.
 */

export const TAXONOMY_VERSION = 'v5';

export interface TaxonomyItem {
  code: string;
  label: string;
  /** Longer description / product families shown as helper text. */
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* 1. Identity, role gating, geo, segment, timezone                    */
/* ------------------------------------------------------------------ */

export const SE_ROLES = [
  { code: 'PORTFOLIO', label: 'Portfolio SE', detail: 'Broad multi-architecture coverage' },
  { code: 'SPECIALIST', label: 'Specialist SE', detail: 'TSA / Specialist with a primary architecture' },
] as const satisfies readonly TaxonomyItem[];
export type SeRole = (typeof SE_ROLES)[number]['code'];

export const ARCHITECTURES = [
  {
    code: 'AI',
    label: 'Artificial Intelligence',
    short: 'AI',
    detail: 'Nexus HyperFabric, RoCEv2, AI Defense, AgenticOps',
  },
  {
    code: 'CAI',
    label: 'Cloud, Compute & Observability',
    short: 'CAI',
    detail: 'UCS, ACI, Splunk, Intersight',
  },
  {
    code: 'EN',
    label: 'Enterprise Networking',
    short: 'EN',
    detail: 'Catalyst, Meraki, SD-WAN, Wireless',
  },
  {
    code: 'SEC',
    label: 'Cybersecurity',
    short: 'SEC',
    detail: 'Firewall, ISE, SASE, Duo, XDR',
  },
  {
    code: 'COL',
    label: 'Collaboration',
    short: 'Collab',
    detail: 'Webex Suite, Contact Center',
  },
] as const satisfies readonly (TaxonomyItem & { short: string })[];
export type ArchCode = (typeof ARCHITECTURES)[number]['code'];

/** Mentee growth target: one architecture, or Portfolio breadth. */
export const PORTFOLIO_TARGET = 'PORTFOLIO' as const;
export type GrowthTarget = ArchCode | typeof PORTFOLIO_TARGET;

export const THEATERS = [
  { code: 'AMERICAS', label: 'Americas', enabled: false },
  { code: 'EMEAR', label: 'EMEAR', enabled: true },
  { code: 'APJC', label: 'APJC', enabled: false },
] as const satisfies readonly (TaxonomyItem & { enabled: boolean })[];
export type TheaterCode = (typeof THEATERS)[number]['code'];

export const SEGMENTS = [
  { code: 'SEG_GLOBAL_ENTERPRISE', label: 'Global Enterprise' },
  { code: 'SEG_COMMERCIAL', label: 'Commercial' },
  { code: 'SEG_CGEM', label: 'CGEM' },
  { code: 'SEG_SP', label: 'SP' },
  { code: 'SEG_GVE', label: 'GVE' },
] as const satisfies readonly TaxonomyItem[];
export type SegmentCode = (typeof SEGMENTS)[number]['code'];

/** Regional sub-categories. v5 defines EMEAR only; other theaters come later. */
export const REGIONAL_SUBS = [
  { code: 'REG_NORTH', label: 'North', theater: 'EMEAR' },
  { code: 'REG_UK', label: 'UK', theater: 'EMEAR' },
  { code: 'REG_METAC', label: 'METAC', theater: 'EMEAR' },
  { code: 'REG_SOUTH', label: 'South', theater: 'EMEAR' },
  { code: 'REG_GERMANY', label: 'Germany', theater: 'EMEAR' },
] as const satisfies readonly (TaxonomyItem & { theater: TheaterCode })[];
export type RegionalSubCode = (typeof REGIONAL_SUBS)[number]['code'];

/**
 * Timezone selector. The spec lists PST | EST | GMT | CET | IST | SGT; we store
 * the IANA zone so the gap is computed with real DST rules, and add the
 * EMEAR zones (EET, TRT, GST) that the six spec labels cannot represent.
 */
export const TIMEZONES = [
  { code: 'America/Los_Angeles', label: 'PST', detail: 'Pacific · San José, Seattle' },
  { code: 'America/New_York', label: 'EST', detail: 'Eastern · New York, Toronto' },
  { code: 'Europe/London', label: 'GMT', detail: 'UK & Ireland · London, Dublin' },
  { code: 'Europe/Berlin', label: 'CET', detail: 'Central Europe · Berlin, Paris, Amsterdam' },
  { code: 'Europe/Athens', label: 'EET', detail: 'Eastern Europe · Athens, Bucharest' },
  { code: 'Europe/Istanbul', label: 'TRT', detail: 'Türkiye · Istanbul' },
  { code: 'Asia/Dubai', label: 'GST', detail: 'Gulf · Dubai, Abu Dhabi' },
  { code: 'Asia/Kolkata', label: 'IST', detail: 'India · Bangalore' },
  { code: 'Asia/Singapore', label: 'SGT', detail: 'APJC · Singapore, Sydney (approx.)' },
] as const satisfies readonly TaxonomyItem[];
export type TimezoneCode = (typeof TIMEZONES)[number]['code'];

export const MENTEE_CAPACITIES = [1, 2] as const;
export type MenteeCapacity = (typeof MENTEE_CAPACITIES)[number];

export const PROGRAM_COMMITMENT = {
  months: 6,
  label: '2 Quarters (6 Months) — Bi-weekly syncs',
  cadence: 'Bi-weekly 45-min sync',
} as const;

/* ------------------------------------------------------------------ */
/* 2. Granular technology subcategories (rated L1–L3)                   */
/* ------------------------------------------------------------------ */

export const PROFICIENCY_LEVELS = [
  {
    level: 1,
    code: 'L1',
    label: 'Foundational',
    detail: 'Conversant baseline understanding.',
  },
  {
    level: 2,
    code: 'L2',
    label: 'Proficient / Field-Active',
    detail: 'Regularly sizes, demos, and delivers in customer calls.',
  },
  {
    level: 3,
    code: 'L3',
    label: 'SME / Lead Architect',
    detail: 'Designs from scratch, runs complex PoVs, handles competitive teardowns & coaches peers.',
  },
] as const;
export type ProficiencyLevel = 1 | 2 | 3;

export const SUBCATEGORIES = [
  // Artificial Intelligence (dedicated category)
  {
    code: 'AI-1',
    arch: 'AI',
    short: 'AI Fabrics / HyperFabric',
    label: 'High-Performance AI Fabrics',
    detail: 'Nexus HyperFabric, RoCEv2, Lossless Ethernet, Ultra Ethernet (UEC), GPU cluster networking (NVIDIA SuperPOD/HGX)',
  },
  {
    code: 'AI-2',
    arch: 'AI',
    short: 'AI Compute',
    label: 'AI Compute & Acceleration',
    detail: 'UCS with NVIDIA GPU acceleration, liquid cooling, Intersight AI workload optimization',
  },
  {
    code: 'AI-3',
    arch: 'AI',
    short: 'AI Defense',
    label: 'AI Security & Data Defense',
    detail: 'Cisco AI Defense, GenAI prompt protection, LLM data residency & model API security',
  },
  {
    code: 'AI-4',
    arch: 'AI',
    short: 'AI Observability',
    label: 'AI Observability & Telemetry',
    detail: 'Splunk for AI telemetry, ThousandEyes for AI cloud interconnects & inference latency',
  },
  {
    code: 'AI-5',
    arch: 'AI',
    short: 'Agentic AI',
    label: 'Agentic AI & Operations',
    detail: 'Cisco IQ, AgenticOps, autonomous network/security remediation agents',
  },
  // Enterprise Networking
  { code: 'EN-1', arch: 'EN', short: 'Catalyst 9000', label: 'Catalyst 9000 Switching & Catalyst Center', detail: 'Catalyst 9000, Catalyst Center (DNA-C)' },
  { code: 'EN-2', arch: 'EN', short: 'Meraki', label: 'Meraki Cloud Full-Stack', detail: 'MX, MS, MR, MV' },
  { code: 'EN-3', arch: 'EN', short: 'SD-WAN', label: 'Enterprise Routing & Catalyst SD-WAN', detail: 'Enterprise routing, Catalyst SD-WAN (Viptela)' },
  { code: 'EN-4', arch: 'EN', short: 'Wireless', label: 'Wireless Architectures', detail: 'C9800, Wi-Fi 6E/7, Cisco Spaces' },
  // Cybersecurity
  { code: 'SEC-1', arch: 'SEC', short: 'Secure Firewall', label: 'Secure Firewall', detail: 'FTD / FMC / Threat Defense' },
  { code: 'SEC-2', arch: 'SEC', short: 'ISE / Zero Trust', label: 'Zero Trust & Network Access Control', detail: 'Cisco ISE / NAC' },
  { code: 'SEC-3', arch: 'SEC', short: 'SASE', label: 'SASE & Cloud Security Edge', detail: 'Secure Access, Umbrella, SSE' },
  { code: 'SEC-4', arch: 'SEC', short: 'Duo / Endpoint', label: 'User & Endpoint Access', detail: 'Duo Security, Secure Endpoint' },
  { code: 'SEC-5', arch: 'SEC', short: 'XDR / SecOps', label: 'SecOps & Threat Hunting', detail: 'Cisco XDR, Splunk Security' },
  // Cloud, Compute & Observability
  { code: 'CAI-1', arch: 'CAI', short: 'Splunk SIEM', label: 'Log Analytics & Enterprise SIEM', detail: 'Splunk Enterprise / Cloud' },
  { code: 'CAI-2', arch: 'CAI', short: 'ThousandEyes', label: 'Internet & Network Intelligence', detail: 'ThousandEyes' },
  { code: 'CAI-3', arch: 'CAI', short: 'DC Fabrics / ACI', label: 'Data Center Fabrics', detail: 'NX-OS / ACI / Nexus Dashboard' },
  { code: 'CAI-4', arch: 'CAI', short: 'Intersight', label: 'Hybrid Cloud Operations', detail: 'Intersight, Workload Optimizer' },
  // Collaboration
  { code: 'COL-1', arch: 'COL', short: 'Webex Calling', label: 'Cloud Calling & Webex Suite', detail: 'Webex Calling, Meetings, Messaging' },
  { code: 'COL-2', arch: 'COL', short: 'Contact Center', label: 'Customer Experience', detail: 'Webex Contact Center & AI Agents' },
  { code: 'COL-3', arch: 'COL', short: 'Video Devices', label: 'Smart Video Devices', detail: 'Room Kits, Board Pro' },
] as const satisfies readonly (TaxonomyItem & { arch: ArchCode; short: string })[];
export type SubcategoryCode = (typeof SUBCATEGORIES)[number]['code'];

/* ------------------------------------------------------------------ */
/* Certifications (self-declared in the demo; Certmetrics later)       */
/* ------------------------------------------------------------------ */

export const CERTIFICATIONS = [
  { code: 'CERT_CCIE_ENT', label: 'CCIE Enterprise', group: 'Cisco', archs: ['EN'] },
  { code: 'CERT_CCIE_SEC', label: 'CCIE Security', group: 'Cisco', archs: ['SEC'] },
  { code: 'CERT_CCIE_DC', label: 'CCIE Data Center', group: 'Cisco', archs: ['CAI', 'AI'] },
  { code: 'CERT_CCIE_COL', label: 'CCIE Collaboration', group: 'Cisco', archs: ['COL'] },
  { code: 'CERT_CCIE_SP', label: 'CCIE Service Provider', group: 'Cisco', archs: ['EN'] },
  { code: 'CERT_CCNP', label: 'CCNP', group: 'Cisco', archs: ['EN', 'SEC', 'CAI', 'COL'] },
  { code: 'CERT_DEVNET_PRO', label: 'DevNet Professional', group: 'Cisco', archs: ['EN', 'CAI', 'AI'] },
  { code: 'CERT_DEVNET_EXP', label: 'DevNet Expert', group: 'Cisco', archs: ['EN', 'CAI', 'AI'] },
  { code: 'CERT_CISCO_AI', label: 'Cisco AI Specialist', group: 'AI & Industry', archs: ['AI'] },
  { code: 'CERT_CISSP', label: 'CISSP', group: 'AI & Industry', archs: ['SEC'] },
  { code: 'CERT_AWS_SA', label: 'AWS Solutions Architect', group: 'AI & Industry', archs: ['CAI', 'AI'] },
  { code: 'CERT_AZURE_SA', label: 'Azure Solutions Architect', group: 'AI & Industry', archs: ['CAI', 'AI'] },
  { code: 'CERT_SPLUNK_ARCH', label: 'Splunk Architect', group: 'AI & Industry', archs: ['CAI', 'SEC', 'AI'] },
  { code: 'CERT_CKA', label: 'CKA (Kubernetes Administrator)', group: 'AI & Industry', archs: ['CAI', 'AI'] },
] as const satisfies readonly (TaxonomyItem & { group: string; archs: readonly ArchCode[] })[];
export type CertCode = (typeof CERTIFICATIONS)[number]['code'];

/* ------------------------------------------------------------------ */
/* 3. Business acumen & commercial experience                          */
/* ------------------------------------------------------------------ */

/** Ordered smallest → largest; the order is used for adjacent-tier credit. */
export const DEAL_SIZES = [
  { code: 'DEAL_LT_250K', label: '<$250K', detail: 'Run-rate velocity' },
  { code: 'DEAL_250K_1M', label: '$250K–$1M', detail: 'Mid-Market' },
  { code: 'DEAL_1M_5M', label: '$1M–$5M', detail: 'Enterprise Major' },
  { code: 'DEAL_GT_5M', label: '>$5M+', detail: 'Strategic Mega-Deal' },
] as const satisfies readonly TaxonomyItem[];
export type DealSizeCode = (typeof DEAL_SIZES)[number]['code'];

export const LICENSING_MODELS = [
  { code: 'LIC_EA3', label: 'Enterprise Agreement (EA 3.0)', short: 'EA 3.0' },
  { code: 'LIC_SAAS', label: 'SaaS / Term Subscriptions', short: 'SaaS / Subscriptions' },
  { code: 'LIC_TRUE_FORWARD', label: 'True-Forward & Growth Models', short: 'True-Forward' },
  { code: 'LIC_HAAS', label: 'Hardware-as-a-Service (HaaS)', short: 'HaaS' },
] as const satisfies readonly (TaxonomyItem & { short: string })[];

export const FINANCIAL_SKILLS = [
  { code: 'FIN_CAPEX_OPEX', label: 'CapEx to OpEx Financial Modeling', short: 'CapEx→OpEx' },
  { code: 'FIN_TCO', label: 'Total Cost of Ownership (TCO)', short: 'TCO' },
  { code: 'FIN_CFO_CASE', label: 'Business Case Defense to CFO', short: 'CFO business case' },
  { code: 'FIN_DOWNTIME_ROI', label: 'Downtime & Risk Mitigation ROI', short: 'Risk / downtime ROI' },
] as const satisfies readonly (TaxonomyItem & { short: string })[];

/** Licensing + financial = the pool used by "Commercial Focus Match". */
export const COMMERCIAL_SKILLS = [...LICENSING_MODELS, ...FINANCIAL_SKILLS] as const;
export type CommercialSkillCode = (typeof COMMERCIAL_SKILLS)[number]['code'];

/* ------------------------------------------------------------------ */
/* 4. Stakeholder disciplines, competitor takeouts, coaching formats   */
/* ------------------------------------------------------------------ */

/** Shown on profiles and used as a tie-breaker only — not part of the 100 points. */
export const STAKEHOLDER_DISCIPLINES = [
  { code: 'STK_TECH_CHAMPIONS', label: 'Coaching Technical Champions', detail: 'Equipping advocates to sell Cisco internally.' },
  { code: 'STK_CXO', label: 'CXO Engagement', detail: 'Pitching / whiteboarding to CIO, CISO, and CTO buyers.' },
  { code: 'STK_INTERNAL_NAV', label: 'Internal Cisco Navigation', detail: 'BU / Product Mgmt feature escalations & GVE sync.' },
  { code: 'STK_POLITICS', label: 'Handling Politics', detail: 'Overcoming competitor bias and winning customer architects.' },
] as const satisfies readonly TaxonomyItem[];
export type StakeholderCode = (typeof STAKEHOLDER_DISCIPLINES)[number]['code'];

export const COMPETITORS = [
  { code: 'COMP_ARISTA', label: 'Arista Networks', short: 'Arista', detail: 'Data Center, AI Fabric & Campus switching takeouts.', archs: ['AI', 'CAI', 'EN'] },
  { code: 'COMP_PALO_ALTO', label: 'Palo Alto Networks', short: 'Palo Alto', detail: 'Firewall & SASE / Prisma displacement.', archs: ['SEC'] },
  { code: 'COMP_FORTINET', label: 'Fortinet', short: 'Fortinet', detail: 'SASE, SD-WAN, and branch security takeover.', archs: ['SEC', 'EN'] },
  { code: 'COMP_HPE_ARUBA', label: 'HPE / Aruba', short: 'HPE / Aruba', detail: 'Enterprise campus switching & Wi-Fi displacement.', archs: ['EN'] },
  { code: 'COMP_CROWDSTRIKE_MS', label: 'CrowdStrike / Microsoft', short: 'CrowdStrike / MS', detail: 'Endpoint security & XDR consolidation.', archs: ['SEC'] },
] as const satisfies readonly (TaxonomyItem & { short: string; archs: readonly ArchCode[] })[];
export type CompetitorCode = (typeof COMPETITORS)[number]['code'];

export const COACHING_FORMATS = [
  { code: 'FMT_LIVE_SHADOWING', label: 'Live Deal Shadowing' },
  { code: 'FMT_DRY_RUN_WHITEBOARD', label: 'Dry-Run Whiteboard Review' },
  { code: 'FMT_TAKEOUT_LAB', label: 'Competitive Takeout Lab' },
  { code: 'FMT_POV_SCOPING', label: 'PoV Scoping Review' },
] as const satisfies readonly TaxonomyItem[];
export type FormatCode = (typeof COACHING_FORMATS)[number]['code'];

/* ------------------------------------------------------------------ */
/* Kinds, flat registry and lookups                                    */
/* ------------------------------------------------------------------ */

/** Multi-select attributes stored in `person_tags(kind, code)`. */
export const TAG_KINDS = [
  'DEAL_SIZE',
  'LICENSING',
  'FINANCIAL',
  'STAKEHOLDER',
  'COMPETITOR',
  'FORMAT',
  'CERT',
] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export type TaxonomyKind =
  | 'SE_ROLE'
  | 'ARCH'
  | 'SUBCATEGORY'
  | 'THEATER'
  | 'SEGMENT'
  | 'REGIONAL_SUB'
  | 'TIMEZONE'
  | TagKind;

export interface FlatTaxonomyItem {
  kind: TaxonomyKind;
  code: string;
  label: string;
  detail?: string;
  parent?: string;
  sort: number;
  meta?: Record<string, unknown>;
}

function flat<T extends TaxonomyItem>(
  kind: TaxonomyKind,
  items: readonly T[],
  extra?: (item: T) => Pick<FlatTaxonomyItem, 'parent' | 'meta'>,
): FlatTaxonomyItem[] {
  return items.map((item, sort) => ({
    kind,
    code: item.code,
    label: item.label,
    detail: item.detail,
    sort,
    ...(extra ? extra(item) : {}),
  }));
}

/** Every taxonomy item, flattened — synced into `taxonomy_items` by the seed. */
export const TAXONOMY: readonly FlatTaxonomyItem[] = [
  ...flat('SE_ROLE', SE_ROLES),
  ...flat('ARCH', ARCHITECTURES, (a) => ({ meta: { short: a.short } })),
  ...flat('SUBCATEGORY', SUBCATEGORIES, (s) => ({ parent: s.arch, meta: { short: s.short } })),
  ...flat('THEATER', THEATERS, (t) => ({ meta: { enabled: t.enabled } })),
  ...flat('SEGMENT', SEGMENTS),
  ...flat('REGIONAL_SUB', REGIONAL_SUBS, (r) => ({ parent: r.theater })),
  ...flat('TIMEZONE', TIMEZONES),
  ...flat('DEAL_SIZE', DEAL_SIZES),
  ...flat('LICENSING', LICENSING_MODELS, (l) => ({ meta: { short: l.short } })),
  ...flat('FINANCIAL', FINANCIAL_SKILLS, (f) => ({ meta: { short: f.short } })),
  ...flat('STAKEHOLDER', STAKEHOLDER_DISCIPLINES),
  ...flat('COMPETITOR', COMPETITORS, (c) => ({ meta: { short: c.short, archs: c.archs } })),
  ...flat('FORMAT', COACHING_FORMATS),
  ...flat('CERT', CERTIFICATIONS, (c) => ({ meta: { group: c.group, archs: c.archs } })),
];

const byCode = new Map(TAXONOMY.map((item) => [item.code, item]));

export function taxonomyItem(code: string): FlatTaxonomyItem | undefined {
  return byCode.get(code);
}

/** Human label for any taxonomy code; falls back to the code itself. */
export function labelOf(code: string | null | undefined): string {
  if (!code) return '';
  return byCode.get(code)?.label ?? code;
}

/** Short label where one exists (e.g. "EA 3.0", "Arista"), else the label. */
export function shortLabelOf(code: string | null | undefined): string {
  if (!code) return '';
  const item = byCode.get(code);
  const short = item?.meta?.short;
  return typeof short === 'string' ? short : (item?.label ?? code);
}

export function codesOfKind(kind: TaxonomyKind): string[] {
  return TAXONOMY.filter((item) => item.kind === kind).map((item) => item.code);
}

export function isCodeOfKind(kind: TaxonomyKind, code: string): boolean {
  return byCode.get(code)?.kind === kind;
}

export function subcategoriesOf(arch: ArchCode): (typeof SUBCATEGORIES)[number][] {
  return SUBCATEGORIES.filter((s) => s.arch === arch);
}

export function archOfSubcategory(code: string): ArchCode | undefined {
  return SUBCATEGORIES.find((s) => s.code === code)?.arch;
}

export function timezoneLabel(code: string | null | undefined): string {
  if (!code) return '';
  return TIMEZONES.find((t) => t.code === code)?.label ?? code;
}

export function growthTargetLabel(target: string): string {
  return target === PORTFOLIO_TARGET ? 'Portfolio breadth (multi-architecture)' : labelOf(target);
}
