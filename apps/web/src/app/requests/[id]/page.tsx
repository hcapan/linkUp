import { Info } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EXCLUSION_LABELS, growthTargetLabel, labelOf, shortLabelOf, type Exclusion } from '@linkup/core';
import { geoLine, relativeTime, roleLine } from '@/components/labels';
import { PageHeader } from '@/components/page-header';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonaRequired } from '@/components/persona-required';
import { RematchButton } from '@/components/rematch-button';
import { Highlights, ScoreBreakdown } from '@/components/score-breakdown';
import { SelectMentorButton } from '@/components/select-mentor-button';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiOrNull, getMe } from '@/lib/api';
import type { MatchView, RequestDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

function MatchCard({ match, request, top }: { match: MatchView; request: RequestDetail; top: boolean }) {
  const mentor = match.mentor;
  if (!mentor) return null;
  const b = match.breakdown;
  const relation = match.mentorships.find((m) => m.status === 'PENDING' || m.status === 'ACTIVE') ?? match.mentorships.at(-1);
  const canSelect = request.isOwner && request.status === 'OPEN' && !request.openMentorship;
  const color = match.strong ? (top ? 'text-primary-text' : 'text-success-text') : 'text-warning-text';

  return (
    <Card className={cn('relative overflow-visible shadow-card', top && 'ring-2 ring-primary')}>
      {top ? (
        <span className="absolute -top-3 left-5 rounded-full bg-primary px-3 py-1 text-[10px] font-extrabold tracking-wide text-primary-foreground">
          ★ TOP RECOMMENDATION · {match.score}% MATCH
        </span>
      ) : null}
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-3.5">
          <PersonAvatar name={mentor.fullName} size="lg" />
          <div className="min-w-0">
            <h3 className="text-base font-bold">
              <Link href={`/people/${mentor.id}`} className="hover:underline">
                {mentor.fullName}
              </Link>{' '}
              <span className="text-xs font-medium text-muted-foreground">· {mentor.cecId}</span>
            </h3>
            <div className="text-xs text-muted-foreground">
              {[roleLine(mentor), geoLine(mentor)].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-0.5 text-[11px] text-subtle">
              {mentor.jobTitle} · {mentor.menteeCapacity - mentor.activeMentees} of {mentor.menteeCapacity} slots open
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className={cn('text-[28px] leading-none font-extrabold tabular-nums', color)}>{match.score}%</div>
            <div className="text-[10px] font-bold tracking-wide text-subtle uppercase">{match.strong ? 'Strong match' : 'Partial match'}</div>
          </div>
        </div>

        <ScoreBreakdown breakdown={b} />

        <div className="rounded-[10px] bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">Why this match:</b> {b.rationale}
        </div>
        <Highlights breakdown={b} />

        <details className="group rounded-lg border px-3.5 py-2.5">
          <summary className="cursor-pointer text-xs font-semibold text-primary-text select-none">Show every scoring rule</summary>
          <div className="mt-3">
            <ScoreBreakdown breakdown={b} detailed />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2.5">
          {relation ? (
            <>
              <StatusBadge status={relation.status} />
              <Button asChild variant="outline" size="lg">
                <Link href={`/mentorships/${relation.id}`}>Open mentorship</Link>
              </Button>
            </>
          ) : canSelect ? (
            <SelectMentorButton requestId={request.id} mentorId={mentor.id} mentorName={mentor.fullName} primary={top} />
          ) : null}
          <Button asChild variant="ghost" size="lg">
            <Link href={`/people/${mentor.id}`}>View full profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getMe())) return <PersonaRequired what="these matches" />;
  const { id } = await params;
  const request = await apiOrNull<RequestDetail>(`/requests/${id}`);
  if (!request) notFound();

  const [top, ...rest] = request.matches;
  const excluded = Object.entries(request.excluded) as [Exclusion, number][];
  const summary = [
    growthTargetLabel(request.primaryArch),
    request.targetSubcategories.map(shortLabelOf).join(', '),
    request.competitors.length ? `vs ${request.competitors.map(shortLabelOf).join(', ')}` : '',
    request.dealSize ? labelOf(request.dealSize) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader
        eyebrow={request.isOwner ? 'Your top mentor matches' : `Matches for ${request.mentee?.fullName ?? 'mentee'}`}
        title={request.matches.length ? `Top ${request.matches.length} mentor matches` : 'No eligible mentors yet'}
        lead={
          <>
            Ranked by the 100-point engine for <b className="text-foreground">{summary}</b>. Evaluated{' '}
            {request.evaluated} mentors with open slots{excluded.length ? ` (${excluded.map(([k, v]) => `${v} excluded: ${EXCLUSION_LABELS[k].toLowerCase()}`).join('; ')})` : ''}
            . Requested {relativeTime(request.createdAt)}.
          </>
        }
        actions={request.isOwner && request.status === 'OPEN' ? <RematchButton requestId={request.id} /> : null}
      />

      <Card className="mb-6 shadow-card">
        <CardContent className="text-[13px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">Growth goal:</b> “{request.goal}”
        </CardContent>
      </Card>

      {request.openMentorship ? (
        <Alert className="mb-6">
          <Info />
          <AlertTitle>
            {request.openMentorship.status === 'PENDING' ? 'Waiting for the mentor to respond' : 'You are paired for this goal'}
          </AlertTitle>
          <AlertDescription>
            <span>
              {request.openMentorship.status === 'PENDING'
                ? 'Other mentors become selectable again if this request is declined or cancelled.'
                : 'This growth goal is matched.'}{' '}
              <Link className="font-semibold text-primary-text underline" href={`/mentorships/${request.openMentorship.id}`}>
                Open mentorship
              </Link>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {top ? (
        <div className="grid gap-6">
          <MatchCard match={top} request={request} top />
          {rest.length ? (
            <div className="grid gap-5 md:grid-cols-2">
              {rest.map((m) => (
                <MatchCard key={m.rank} match={m} request={request} top={false} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Every mentor in this area is fully booked right now. Try again later or broaden your target subcategories.
          </CardContent>
        </Card>
      )}
    </>
  );
}
