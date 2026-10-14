import { CalendarClock, Check, Clock, MessageSquare, Target, TrendingUp, X } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { shortLabelOf } from '@linkup/core';
import { formatDate, geoLine } from '@/components/labels';
import { MentorshipActions } from '@/components/mentorship-actions';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonaRequired } from '@/components/persona-required';
import { Highlights, ScoreBreakdown } from '@/components/score-breakdown';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiOrNull, getMe } from '@/lib/api';
import type { MentorshipDetail, PersonLite } from '@/lib/types';
import { cn } from '@/lib/utils';

const BANNERS = {
  PENDING: { tone: 'bg-warning', icon: Clock, title: (m: MentorshipDetail) => `Waiting for ${m.mentor.fullName} to respond` },
  ACTIVE: { tone: 'bg-success', icon: Check, title: (m: MentorshipDetail) => `${m.mentee.fullName} ↔ ${m.mentor.fullName}` },
  COMPLETED: { tone: 'bg-primary', icon: Check, title: () => 'Mentorship completed' },
  DECLINED: { tone: 'bg-destructive', icon: X, title: (m: MentorshipDetail) => `${m.mentor.fullName} declined this request` },
  CANCELLED: { tone: 'bg-muted-foreground', icon: X, title: () => 'Mentorship cancelled' },
} as const;

function Participant({ person, role }: { person: PersonLite; role: string }) {
  return (
    <Link href={`/people/${person.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent">
      <PersonAvatar name={person.fullName} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold tracking-wide text-subtle uppercase">{role}</div>
        <div className="truncate text-sm font-bold">{person.fullName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {person.jobTitle} · {geoLine(person)}
        </div>
      </div>
    </Link>
  );
}

function Step({ icon: Icon, title, body, state }: { icon: typeof Check; title: string; body: React.ReactNode; state: 'done' | 'current' | 'todo' }) {
  return (
    <div className="flex gap-3.5 border-b py-3.5 last:border-b-0">
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
          state === 'done' ? 'bg-success-soft text-success-text' : state === 'current' ? 'bg-primary-soft text-primary-text' : 'bg-muted text-subtle',
        )}
      >
        <Icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold">{title}</h4>
        <div className="text-xs leading-relaxed text-muted-foreground">{body}</div>
      </div>
      <span className={cn('self-center text-xs font-bold', state === 'done' ? 'text-success-text' : state === 'current' ? 'text-primary-text' : 'text-subtle')}>
        {state === 'done' ? '✓ Done' : state === 'current' ? 'In progress' : 'Next'}
      </span>
    </div>
  );
}

export default async function MentorshipPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getMe())) return <PersonaRequired what="this mentorship" />;
  const { id } = await params;
  const m = await apiOrNull<MentorshipDetail>(`/mentorships/${id}`);
  if (!m) notFound();

  const banner = BANNERS[m.status];
  const Icon = banner.icon;
  const approved = !!m.startedAt;
  const space = m.webexRoomTitle ?? `LinkUP · ${m.mentee.fullName} ↔ ${m.mentor.fullName}`;
  const bothLinked = m.mentee.webexLinked && m.mentor.webexLinked;

  return (
    <div className="grid gap-5">
      <Card className="gap-0 overflow-hidden py-0 shadow-card">
        <div className={cn('px-6 py-6 text-center text-white', banner.tone)}>
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-white/20">
            <Icon className="size-6" />
          </div>
          <h1 className="text-xl font-bold">{banner.title(m)}</h1>
          <p className="mt-1 text-[13px] opacity-90">
            {m.status === 'ACTIVE'
              ? `${m.program.months}-month engagement · ${m.program.cadence} · ends ${formatDate(m.endsAt)}`
              : m.status === 'PENDING'
                ? 'They can approve from the Webex card or here. Nothing is booked until they say yes.'
                : m.status === 'DECLINED'
                  ? m.declineReason ?? 'You can request another mentor from your matches.'
                  : m.status === 'COMPLETED'
                    ? `Completed ${formatDate(m.completedAt)}`
                    : `Cancelled`}
          </p>
        </div>
        <CardContent className="grid gap-4 py-5 md:grid-cols-2">
          <Participant person={m.mentee} role="Mentee" />
          <Participant person={m.mentor} role="Mentor" />
        </CardContent>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={m.status} />
            <span className="text-muted-foreground">
              Focus <b className="text-foreground">{m.focus || '—'}</b> · Match <b className="text-foreground">{m.matchScore ?? '—'}%</b>
            </span>
          </div>
          <MentorshipActions id={m.id} status={m.status} menteeName={m.mentee.fullName} permissions={m.permissions} />
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">Journey</CardTitle>
          </CardHeader>
          <CardContent>
            <Step
              icon={Target}
              title="Growth request & match"
              state="done"
              body={
                <>
                  Requested {formatDate(m.requestedAt)}
                  {m.targetSubcategories.length ? ` for ${m.targetSubcategories.map(shortLabelOf).join(', ')}` : ''}.
                  {m.message ? <span className="mt-1 block italic">“{m.message}”</span> : null}
                </>
              }
            />
            <Step
              icon={Check}
              title="Mentor approval"
              state={m.respondedAt ? 'done' : m.status === 'PENDING' ? 'current' : 'todo'}
              body={m.respondedAt ? `${m.status === 'DECLINED' ? 'Declined' : 'Approved'} ${formatDate(m.respondedAt)}` : 'Approval card sent to the mentor in Webex.'}
            />
            <Step
              icon={MessageSquare}
              title="Dedicated Webex 1:1 space"
              state={m.webexRoomId ? 'done' : approved ? 'current' : 'todo'}
              body={
                m.webexRoomId
                  ? `“${space}” created by the LinkUP bot with both participants.`
                  : approved
                    ? bothLinked
                      ? 'The bot is creating the space…'
                      : 'Created by the bot once both people have linked their Webex account (bot command: link <cec-id>).'
                    : 'Created automatically on approval.'
              }
            />
            <Step
              icon={CalendarClock}
              title="Bi-weekly cadence"
              state={approved ? 'done' : 'todo'}
              body={approved ? `${m.program.cadence} until ${formatDate(m.endsAt)}. Outlook booking comes in a later phase.` : m.program.label}
            />
            <Step
              icon={TrendingUp}
              title="Milestones"
              state={m.status === 'COMPLETED' ? 'done' : m.status === 'ACTIVE' ? 'current' : 'todo'}
              body={
                m.status === 'ACTIVE' ? (
                  <div className="mt-1.5 flex items-center gap-3">
                    <Progress value={m.progress} className="h-1.5 w-40" /> {m.progress}% of the programme elapsed
                  </div>
                ) : (
                  'Mid-point and final check-ins.'
                )
              }
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-bold">Why this pairing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {m.goal ? (
              <p className="rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                <b className="text-foreground">Growth goal:</b> “{m.goal}”
              </p>
            ) : null}
            {m.breakdown ? (
              <>
                <p className="text-[13px] font-semibold">{m.breakdown.headline}</p>
                <Highlights breakdown={m.breakdown} />
                <ScoreBreakdown breakdown={m.breakdown} detailed />
                <p className="text-[11px] text-subtle">Scored with algorithm {m.breakdown.algorithmVersion} at request time.</p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
