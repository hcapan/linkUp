import { ArrowRight, Repeat } from 'lucide-react';
import Link from 'next/link';
import { WEIGHTS, timezoneLabel } from '@linkup/core';
import { archShort, relativeTime } from '@/components/labels';
import { PageHeader } from '@/components/page-header';
import { PersonaRequired } from '@/components/persona-required';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getMe } from '@/lib/api';
import type { RequestListItem } from '@/lib/types';
import { RequestForm } from './request-form';

export default async function FindPage() {
  const me = await getMe();
  if (!me) {
    return (
      <>
        <PageHeader eyebrow="Find a mentor" title="Tell LinkUP what you want to master" />
        <PersonaRequired what="the mentee flow" />
      </>
    );
  }
  const requests = await api<RequestListItem[]>('/requests');
  const tzNote = me.timezone ? `Your region, segment and timezone (${timezoneLabel(me.timezone)}) come from your profile.` : '';

  const bars = [
    ['Tech & subcategory', WEIGHTS.tech.max, 'bg-primary'],
    ['Business acumen', WEIGHTS.biz.max, 'bg-cyan'],
    ['Stakeholder / competitor', WEIGHTS.stakeholder.max, 'bg-success'],
    ['Coaching format fit', WEIGHTS.format.max, 'bg-warning'],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="Find a mentor · growth query"
        title="Tell LinkUP what you want to master"
        lead="A 60-second form — the same Adaptive Card the Webex bot sends. Every mentor with an open slot is scored and the top 3 are shown with their full rationale."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
        <RequestForm defaultTimezoneNote={tzNote} />

        <div className="grid gap-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">How the 100-point engine scores</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-[13px] text-muted-foreground">Every eligible mentor is ranked; matches ≥ 70 are flagged as strong.</p>
              {bars.map(([label, max, color]) => (
                <div key={label} className="grid grid-cols-[150px_1fr_30px] items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <span>{label}</span>
                  <div className="h-[7px] overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${(max / 35) * 100}%` }} />
                  </div>
                  <span className="text-right text-foreground">{max}</span>
                </div>
              ))}
              <div className="rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                <b className="text-foreground">Penalty gates:</b> timezone gap &gt; 4h (−10), same pod / shared manager (−15),
                and a hard capacity gate that excludes fully-booked mentors.{' '}
                <Link href="/scoring" className="font-semibold text-primary-text">
                  All rules →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">Your previous requests</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {requests.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No requests yet — your first match is one click away.</p>
              ) : (
                requests.slice(0, 6).map((r) => (
                  <Link
                    key={r.id}
                    href={`/requests/${r.id}`}
                    className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <Badge variant="secondary" className="font-bold">
                      {archShort(r.primaryArch)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{r.targetSubcategories.join(', ')}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {relativeTime(r.createdAt)} · top {r.topScore ?? '—'}%{r.channel === 'webex' ? ' · via Webex' : ''}
                      </div>
                    </div>
                    {r.mentorshipStatus ? <StatusBadge status={r.mentorshipStatus} /> : <Badge variant="outline">Open</Badge>}
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-magenta-soft text-magenta-text">
                <Repeat size={20} />
              </div>
              <div>
                <h3 className="mb-1 text-[15px] font-bold">Bi-directional by default</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Your profile also registers what <b>you</b> can teach — the same engine may recommend you as a mentor on the
                  skills you already own.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
