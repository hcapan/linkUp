import { ALGORITHM_VERSION, STRONG_MATCH_THRESHOLD, WEIGHTS } from '@linkup/core';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const RULES = [
  {
    category: 'Tech & subcategory',
    max: WEIGHTS.tech.max,
    color: 'bg-primary',
    lines: [
      [
        'Role & architecture',
        WEIGHTS.tech.roleArch,
        'Same-architecture Specialist 15 · Portfolio SE with L2+ in the target architecture 10, L1 only 5 · other-architecture Specialist 0. For a “Portfolio breadth” target: Portfolio SE 15, any Specialist 5.',
      ],
      ['Subcategory gap match', WEIGHTS.tech.subcategory, 'Per target subcategory: mentor L3 = 15, L2 = 10, else 0 — averaged over your 1–3 targets.'],
      ['Adjacent domain / cert breadth', WEIGHTS.tech.certs, 'A certification relevant to the target architecture 5 · any other active cert 2.'],
    ],
  },
  {
    category: 'Business acumen',
    max: WEIGHTS.biz.max,
    color: 'bg-cyan',
    lines: [
      ['Commercial focus match', WEIGHTS.biz.commercial, 'Share of your requested licensing / financial skills (EA 3.0, TCO, CapEx→OpEx…) the mentor covers.'],
      ['Deal size tier fit', WEIGHTS.biz.dealSize, 'Mentor has closed deals in your target tier 10 · only larger tiers 5.'],
    ],
  },
  {
    category: 'Stakeholder & competitor',
    max: WEIGHTS.stakeholder.max,
    color: 'bg-success',
    lines: [
      ['Competitor battle match', WEIGHTS.stakeholder.competitor, 'Share of the competitors you face where the mentor has verified takeouts.'],
      ['Regional sub-category & segment', WEIGHTS.stakeholder.regionSegment, 'Same regional sub-category 5 + same segment 5.'],
    ],
  },
  {
    category: 'Coaching format & style',
    max: WEIGHTS.format.max,
    color: 'bg-warning',
    lines: [
      ['Coaching format match', WEIGHTS.format.format, 'Share of your preferred formats the mentor offers.'],
      [
        'Superpower bio semantic match',
        WEIGHTS.format.semantic,
        `Cosine similarity between your growth goal and the mentor's bio (on-device MiniLM embeddings), mapped linearly from ${WEIGHTS.semantic.floor} → 0 to ${WEIGHTS.semantic.ceiling} → 5.`,
      ],
    ],
  },
] as const;

export default function ScoringPage() {
  return (
    <>
      <PageHeader
        eyebrow={`Matching engine ${ALGORITHM_VERSION} · spec v5 section 5`}
        title="How the 100-point match works"
        lead="TOTAL = S_tech (35) + S_biz (25) + S_stakeholder (20) + S_format (20) − penalties. Every match card shows this exact breakdown, so a match is never a black box."
      />
      <div className="grid gap-5">
        {RULES.map((r) => (
          <Card key={r.category} className="shadow-card">
            <CardHeader className="flex-row items-center gap-3">
              <span className={`h-3 w-3 rounded-sm ${r.color}`} />
              <CardTitle className="font-bold">
                {r.category} · {r.max} points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Rule</TableHead>
                    <TableHead className="w-[70px] text-right">Max</TableHead>
                    <TableHead>How it is scored</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.lines.map(([name, max, how]) => (
                    <TableRow key={name}>
                      <TableCell className="font-semibold">{name}</TableCell>
                      <TableCell className="text-right tabular-nums">{max}</TableCell>
                      <TableCell className="text-[13px] whitespace-normal text-muted-foreground">{how}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">Penalties, gates and ordering</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>
              <b className="text-foreground">Timezone gap &gt; {WEIGHTS.penalties.timezoneGapHours}h: {WEIGHTS.penalties.timezone}.</b> Computed from
              real IANA timezones, DST included, measured around the clock (PST ↔ SGT is an 8–9h gap, not 15–16h).
            </p>
            <p>
              <b className="text-foreground">Same pod / quota conflict: {WEIGHTS.penalties.samePod}.</b> Same direct manager, or a direct
              manager/report pair — the program favours cross-team learning.
            </p>
            <p>
              <b className="text-foreground">Capacity gate:</b> mentors whose active mentees equal their capacity (1 or 2) are excluded, as are
              non-mentors, yourself, and mentors you already have a pending or active pairing with.
            </p>
            <p>
              <b className="text-foreground">No preference = no constraint:</b> leaving competitor, commercial skill or deal tier empty scores
              that rule as satisfied.
            </p>
            <p>
              <b className="text-foreground">Results:</b> the top 3 are always shown; scores ≥ {STRONG_MATCH_THRESHOLD} are labelled{' '}
              <i>Strong</i>, lower ones <i>Partial</i>. Ties break on stakeholder-discipline overlap (not scored), then open slots, then bio
              similarity.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
