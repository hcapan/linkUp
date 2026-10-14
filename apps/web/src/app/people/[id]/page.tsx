import { Lock, Pencil, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ARCHITECTURES,
  CERTIFICATIONS,
  PROFICIENCY_LEVELS,
  SUBCATEGORIES,
  labelOf,
  timezoneLabel,
} from '@linkup/core';
import { roleLine } from '@/components/labels';
import { PageHeader } from '@/components/page-header';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonaRequired } from '@/components/persona-required';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, api, getMe } from '@/lib/api';
import type { PersonProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

function Chips({ codes, tone = 'bg-secondary text-secondary-foreground' }: { codes: string[]; tone?: string }) {
  if (codes.length === 0) return <span className="text-xs text-subtle">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((c) => (
        <span key={c} className={cn('rounded-md px-2 py-1 text-[11px] font-semibold', tone)}>
          {labelOf(c)}
        </span>
      ))}
    </div>
  );
}

const LEVEL_TONE = ['', 'bg-muted text-muted-foreground', 'bg-cyan-soft text-cyan-text', 'bg-primary text-primary-foreground'];

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) return <PersonaRequired what="profiles" />;
  const { id } = await params;
  let p: PersonProfile;
  try {
    p = await api<PersonProfile>(`/people/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <Card className="mx-auto max-w-lg text-center shadow-card">
          <CardContent className="grid justify-items-center gap-3 py-10">
            <Lock className="text-muted-foreground" />
            <h1 className="text-lg font-bold">This profile is private</h1>
            <p className="text-sm text-muted-foreground">Only mentors are publicly visible. Managers and mentorship partners can see full profiles.</p>
          </CardContent>
        </Card>
      );
    }
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const isSelf = p.id === me.id;
  const ratings = new Map(p.skills.map((s) => [s.subcategory, s.level]));
  const slots = p.menteeCapacity - p.activeMentees;

  return (
    <>
      <PageHeader
        eyebrow={isSelf ? 'My profile' : p.isMentor ? 'Mentor profile' : 'Profile'}
        title={p.fullName}
        lead={[p.jobTitle, roleLine(p)].filter(Boolean).join(' · ')}
        actions={
          <>
            {isSelf ? (
              <Button asChild size="lg" variant="outline">
                <Link href="/find">
                  <Sparkles /> Find a mentor
                </Link>
              </Button>
            ) : null}
            {p.canEdit ? (
              <Button asChild size="lg">
                <Link href={isSelf ? '/profile/edit' : `/profile/edit?id=${p.id}`}>
                  <Pencil /> Edit profile
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="grid gap-5">
          <Card className="shadow-card">
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-3.5">
                <PersonAvatar name={p.fullName} size="lg" />
                <div className="min-w-0">
                  <div className="font-bold">{p.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.cecId} · {p.email}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-muted-foreground">Theater</dt>
                <dd>{labelOf(p.theater) || '—'}</dd>
                <dt className="text-muted-foreground">Segment</dt>
                <dd>{labelOf(p.segment) || '—'}</dd>
                <dt className="text-muted-foreground">Region</dt>
                <dd>{labelOf(p.regionalSub) || '—'}</dd>
                <dt className="text-muted-foreground">Timezone</dt>
                <dd>{timezoneLabel(p.timezone) || '—'}</dd>
                <dt className="text-muted-foreground">Manager</dt>
                <dd>{p.manager ? <Link href={`/people/${p.manager.id}`} className="hover:underline">{p.manager.fullName}</Link> : '—'}</dd>
                {p.directReports ? (
                  <>
                    <dt className="text-muted-foreground">Team</dt>
                    <dd>{p.directReports} direct reports</dd>
                  </>
                ) : null}
                {isSelf || p.canEdit ? (
                  <>
                    <dt className="text-muted-foreground">Webex bot</dt>
                    <dd>{p.webexEmail ? `Linked (${p.webexEmail})` : <span className="text-subtle">Not linked — message the bot “link {p.cecId}”</span>}</dd>
                  </>
                ) : null}
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                {p.isMentor ? (
                  <Badge className={cn('font-semibold', slots > 0 ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text')}>
                    Mentor · {slots > 0 ? `${slots} of ${p.menteeCapacity} slots open` : 'fully booked'}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not in the mentor pool</Badge>
                )}
                {p.isAdmin ? <Badge className="bg-magenta-soft text-magenta-text">Program admin</Badge> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">Superpower</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{p.bio || 'No bio yet.'}</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Chips codes={CERTIFICATIONS.filter((c) => p.certifications.includes(c.code)).map((c) => c.code)} tone="bg-primary-soft text-primary-text" />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">Technology proficiency</CardTitle>
              <p className="text-xs text-muted-foreground">{PROFICIENCY_LEVELS.map((l) => `${l.code} ${l.label}`).join(' · ')}</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {ARCHITECTURES.map((arch) => {
                const subs = SUBCATEGORIES.filter((s) => s.arch === arch.code);
                const rated = subs.filter((s) => ratings.has(s.code));
                return (
                  <div key={arch.code} className={cn('min-w-0 rounded-xl border p-3', rated.length === 0 && 'opacity-60')}>
                    <div className="mb-2 flex items-center justify-between text-[13px] font-bold">
                      {arch.label}
                      {p.specialistArch === arch.code ? <Badge className="bg-primary text-[10px]">Specialist</Badge> : null}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {subs.map((s) => {
                        const level = ratings.get(s.code) ?? 0;
                        return (
                          <div key={s.code} className="flex items-center justify-between gap-2 text-xs">
                            <span className={cn('truncate', level ? 'text-foreground' : 'text-subtle')} title={s.detail}>
                              {s.code} · {s.short}
                            </span>
                            {level ? (
                              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', LEVEL_TONE[level])}>L{level}</span>
                            ) : (
                              <span className="text-[10px] text-subtle">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-bold">Commercial, stakeholders & coaching</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-[13px]">
              {[
                ['Deal size experience', p.dealSizes, 'bg-success-soft text-success-text'],
                ['Licensing models', p.licensing, 'bg-success-soft text-success-text'],
                ['Financial justification', p.financial, 'bg-success-soft text-success-text'],
                ['Stakeholder disciplines', p.stakeholder, 'bg-secondary text-secondary-foreground'],
                ['Verified competitor takeouts', p.competitors, 'bg-magenta-soft text-magenta-text'],
                ['Coaching formats offered', p.formats, 'bg-warning-soft text-warning-text'],
              ].map(([label, codes, tone]) => (
                <div key={label as string} className="grid gap-1.5">
                  <span className="text-xs font-bold">{label as string}</span>
                  <Chips codes={codes as string[]} tone={tone as string} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
