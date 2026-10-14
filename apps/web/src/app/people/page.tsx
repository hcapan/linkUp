import Link from 'next/link';
import { Suspense } from 'react';
import { shortLabelOf } from '@linkup/core';
import { geoLine, roleLine } from '@/components/labels';
import { PageHeader } from '@/components/page-header';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonaRequired } from '@/components/persona-required';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, getMe } from '@/lib/api';
import type { PersonSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DirectoryFilters } from './filters';

type Search = Record<string, string | undefined>;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getMe();
  if (!me) return <PersonaRequired what="the mentor directory" />;
  const params = await searchParams;
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const data = await api<{ items: PersonSummary[]; total: number; limit: number; offset: number }>(`/people?${qs.toString()}`);
  const nextOffset = data.offset + data.limit;
  const nextQs = new URLSearchParams(qs);
  nextQs.set('offset', String(nextOffset));
  const prevQs = new URLSearchParams(qs);
  prevQs.set('offset', String(Math.max(0, data.offset - data.limit)));

  return (
    <>
      <PageHeader
        eyebrow="Mentor directory"
        title="Find expertise across EMEAR"
        lead="Browse the mentor pool by architecture, subcategory depth, region or free text. Matching does this automatically — the directory is for exploring."
      />
      <Suspense>
        <DirectoryFilters canSeeAll={me.isAdmin} isManager={me.isManager} />
      </Suspense>
      <p className="mt-5 mb-3 text-xs font-semibold text-muted-foreground">
        {data.total} {params.pool === 'all' ? 'people' : params.pool === 'team' ? 'team members' : 'mentors'}
        {data.total > data.limit ? ` · showing ${data.offset + 1}–${Math.min(data.total, nextOffset)}` : ''}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((p) => {
          const slots = p.menteeCapacity - p.activeMentees;
          return (
            <Link key={p.id} href={`/people/${p.id}`} className="group">
              <Card className="h-full shadow-card transition-transform group-hover:-translate-y-0.5 group-hover:ring-primary/40">
                <CardContent className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={p.fullName} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{p.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.jobTitle}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{[roleLine(p), geoLine(p)].filter(Boolean).join(' · ')}</div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.bio || '—'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.topSkills.map((s) => (
                      <span
                        key={s.subcategory}
                        className={cn('rounded-md px-2 py-0.5 text-[10.5px] font-bold', s.level === 3 ? 'bg-primary-soft text-primary-text' : 'bg-cyan-soft text-cyan-text')}
                      >
                        {shortLabelOf(s.subcategory)} L{s.level}
                      </span>
                    ))}
                  </div>
                  {p.isMentor ? (
                    <Badge className={cn('w-fit font-semibold', slots > 0 ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text')}>
                      {slots > 0 ? `${slots} of ${p.menteeCapacity} slots open` : 'Fully booked'}
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      {data.total > data.limit ? (
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline" disabled={data.offset === 0}>
            <Link href={`/people?${prevQs.toString()}`} aria-disabled={data.offset === 0} className={cn(data.offset === 0 && 'pointer-events-none opacity-50')}>
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/people?${nextQs.toString()}`} className={cn(nextOffset >= data.total && 'pointer-events-none opacity-50')}>
              Next
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
