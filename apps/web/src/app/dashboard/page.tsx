import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { labelOf, shortLabelOf } from '@linkup/core';
import { MentorshipTable } from '@/components/mentorship-table';
import { PageHeader } from '@/components/page-header';
import { PersonaRequired } from '@/components/persona-required';
import { ResetDemoButton } from '@/components/reset-demo-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError, api, getMe } from '@/lib/api';
import type { Dashboard } from '@/lib/types';

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Card size="sm" className="shadow-card">
      <CardContent className="grid gap-1">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="text-[28px] leading-tight font-bold">{value}</span>
        {note ? <span className="text-[11px] text-subtle">{note}</span> : null}
      </CardContent>
    </Card>
  );
}

/** Grouped horizontal bars: L3 mentor supply vs request demand, per architecture. */
function SupplyDemandChart({ rows }: { rows: Dashboard['coverage'] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.l3Mentors, r.demand]));
  const Bar = ({ value, color }: { value: number; color: string }) => (
    <div className="flex h-[10px] items-center gap-2">
      <div className="h-full rounded-r-[4px]" style={{ width: `${(value / max) * 100}%`, minWidth: value ? 3 : 0, background: color }} />
      <span className="text-[11px] font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-viz-supply" /> L3 mentors (supply)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-viz-demand" /> Requests, last 180 days (demand)
        </span>
      </div>
      <div className="grid gap-3.5" role="img" aria-label="L3 mentor supply versus request demand by architecture">
        {rows.map((r) => (
          <Tooltip key={r.arch}>
            <TooltipTrigger asChild>
              <div className="grid cursor-default grid-cols-[minmax(120px,190px)_1fr] items-center gap-3 rounded-md py-1 hover:bg-muted/60">
                <span className="truncate text-xs font-semibold text-muted-foreground">{r.label}</span>
                <div className="grid gap-[2px] border-l border-border pl-0">
                  <Bar value={r.l3Mentors} color="var(--viz-supply)" />
                  <Bar value={r.demand} color="var(--viz-demand)" />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="grid gap-0.5 text-xs">
              <b>{r.label}</b>
              <span>L3 mentors: {r.l3Mentors} · L2 mentors: {r.l2Mentors}</span>
              <span>Open L2+ mentor slots: {r.openSlots}</span>
              <span>Requests (180 days): {r.demand}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-primary-text">View as table</summary>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Architecture</TableHead>
              <TableHead className="text-right">L3 mentors</TableHead>
              <TableHead className="text-right">L2 mentors</TableHead>
              <TableHead className="text-right">Open slots</TableHead>
              <TableHead className="text-right">Requests</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.arch}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.l3Mentors}</TableCell>
                <TableCell className="text-right tabular-nums">{r.l2Mentors}</TableCell>
                <TableCell className="text-right tabular-nums">{r.openSlots}</TableCell>
                <TableCell className="text-right tabular-nums">{r.demand}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  if (!(await getMe())) return <PersonaRequired what="the program dashboard" />;
  const { scope } = await searchParams;
  let d: Dashboard;
  try {
    d = await api<Dashboard>(`/dashboard${scope ? `?scope=${scope}` : ''}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <>
          <PageHeader eyebrow="Program dashboard" title="For program admins and SE managers" />
          <Alert>
            <AlertTriangle />
            <AlertDescription>
              This view is limited to the program admin (whole program) and SE managers (their direct reports). Switch persona in
              the top bar to explore it.
            </AlertDescription>
          </Alert>
        </>
      );
    }
    throw err;
  }
  const k = d.kpis;
  const thinnest = [...d.coverage].filter((c) => c.demand > 0).sort((a, b) => b.demand / Math.max(1, b.l3Mentors) - a.demand / Math.max(1, a.l3Mentors))[0];

  return (
    <>
      <PageHeader
        eyebrow={d.scope === 'program' ? 'Program view · SE enablement' : 'Team view · your direct reports'}
        title={d.scope === 'program' ? 'Mentorship program dashboard' : 'Team mentorship dashboard'}
        lead="Live from the demo database — every number below is computed from the profiles, requests and mentorships in LinkUP."
        actions={d.scope === 'program' ? <ResetDemoButton /> : null}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Active pairs" value={k.activePairs} note={`${k.pending} awaiting mentor approval`} />
        <Stat label="Avg. match score" value={k.avgMatchScore !== null ? `${k.avgMatchScore}%` : '—'} note="Active and completed pairs" />
        <Stat label="Mentor slots utilized" value={k.slotUtilization !== null ? `${k.slotUtilization}%` : '—'} note={`${k.openSlots} open slots`} />
        <Stat label="Requests, last 30 days" value={k.requests30d} note={k.avgResponseHours !== null ? `Mentors respond in ~${k.avgResponseHours}h` : undefined} />
        <Stat label={d.scope === 'program' ? 'People in LinkUP' : 'Direct reports'} value={k.people.toLocaleString('en')} />
        <Stat label="In the mentor pool" value={k.mentors.toLocaleString('en')} />
        <Stat label="Completed" value={k.completed} />
        <Stat label="Declined or cancelled" value={k.closed} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">Supply vs demand by architecture</CardTitle>
            <CardDescription className="text-xs">Mentors rated L3 in at least one subcategory, against requests targeting that architecture.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SupplyDemandChart rows={d.coverage} />
            {thinnest ? (
              <div className="rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                <b className="text-foreground">Gap signal:</b> {thinnest.label} has the highest demand per L3 mentor (
                {(thinnest.demand / Math.max(1, thinnest.l3Mentors)).toFixed(2)} requests each). Recruit L3 mentors there next quarter.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">Most requested subcategories</CardTitle>
            <CardDescription className="text-xs">Requests vs L3 SMEs in the mentor pool.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subcategory</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">L3 SMEs</TableHead>
                  <TableHead>Supply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.topSubcategories.map((s) => {
                  const thin = s.l3Mentors < Math.max(3, s.requests / 2);
                  return (
                    <TableRow key={s.code}>
                      <TableCell className="text-[13px]">
                        <b>{s.code}</b> · {shortLabelOf(s.code)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.requests}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.l3Mentors}</TableCell>
                      <TableCell>
                        {thin ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-text">
                            <AlertTriangle className="size-3.5" /> Thin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-text">
                            <CheckCircle2 className="size-3.5" /> Healthy
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_2fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">By regional sub-category</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">People</TableHead>
                  <TableHead className="text-right">Mentors</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.regions.map((r) => (
                  <TableRow key={r.region}>
                    <TableCell>{labelOf(r.region)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.people}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.mentors}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.activePairs}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">{d.scope === 'program' ? 'Latest mentorships' : 'Team mentorships'}</CardTitle>
          </CardHeader>
          <CardContent className="px-1">
            <MentorshipTable items={d.recent} empty="No mentorships yet." />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
