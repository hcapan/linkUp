import { Inbox } from 'lucide-react';
import Link from 'next/link';
import { relativeTime } from '@/components/labels';
import { MentorshipActions } from '@/components/mentorship-actions';
import { MentorshipTable } from '@/components/mentorship-table';
import { PageHeader } from '@/components/page-header';
import { PersonAvatar } from '@/components/person-avatar';
import { PersonaRequired } from '@/components/persona-required';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getMe } from '@/lib/api';
import type { Mentorship } from '@/lib/types';

export default async function MentorshipsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!me) return <PersonaRequired what="your mentorships" />;
  const { tab } = await searchParams;
  const [mine, team, all] = await Promise.all([
    api<Mentorship[]>('/mentorships?scope=mine'),
    me.isManager ? api<Mentorship[]>('/mentorships?scope=team') : Promise.resolve(null),
    me.isAdmin ? api<Mentorship[]>('/mentorships?scope=all') : Promise.resolve(null),
  ]);
  const asMentee = mine.filter((m) => m.mentee.id === me.id);
  const asMentor = mine.filter((m) => m.mentor.id === me.id);
  const approvals = asMentor.filter((m) => m.status === 'PENDING');
  const defaultTab = tab ?? (approvals.length ? 'mentor' : asMentee.length ? 'mentee' : asMentor.length ? 'mentor' : team ? 'team' : all ? 'all' : 'mentee');

  return (
    <>
      <PageHeader
        eyebrow="Mentorships"
        title={me.isAdmin ? 'Mentorships across the program' : 'My mentorships'}
        lead="Every pairing you are part of — as a mentee, as a mentor, or (for managers) across your team."
        actions={
          <Button asChild size="lg">
            <Link href="/find">Find a mentor</Link>
          </Button>
        }
      />

      {approvals.length > 0 && (
        <div className="mb-6 grid gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Inbox className="size-4 text-magenta-text" /> {approvals.length} request{approvals.length > 1 ? 's' : ''} waiting for your approval
          </h2>
          {approvals.map((m) => (
            <Card key={m.id} className="shadow-card ring-1 ring-warning/40">
              <CardContent className="flex flex-wrap items-center gap-4">
                <PersonAvatar name={m.mentee.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    <Link href={`/mentorships/${m.id}`} className="hover:underline">
                      {m.mentee.fullName}
                    </Link>{' '}
                    <span className="font-normal text-muted-foreground">wants you as their mentor · {m.matchScore}% match</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.mentee.jobTitle} · Focus: {m.focus || '—'} · {relativeTime(m.requestedAt)}
                  </div>
                  {m.message ? <p className="mt-1.5 text-xs italic text-muted-foreground">“{m.message}”</p> : null}
                </div>
                <MentorshipActions
                  id={m.id}
                  status={m.status}
                  menteeName={m.mentee.fullName}
                  permissions={{ canApprove: true, canDecline: true, canCancel: false, canComplete: false }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="mentee">As mentee ({asMentee.length})</TabsTrigger>
          <TabsTrigger value="mentor">As mentor ({asMentor.length})</TabsTrigger>
          {team ? <TabsTrigger value="team">My team ({team.length})</TabsTrigger> : null}
          {all ? <TabsTrigger value="all">All ({all.length})</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="mentee">
          <Card className="py-1 shadow-card">
            <MentorshipTable items={asMentee} empty="You have no mentorships as a mentee yet — start with Find a mentor." />
          </Card>
        </TabsContent>
        <TabsContent value="mentor">
          <Card className="py-1 shadow-card">
            <MentorshipTable
              items={asMentor}
              empty={me.isMentor ? 'No mentees yet. Matching mentees will see you while you have open slots.' : 'Join the mentor pool from My profile to start mentoring.'}
            />
          </Card>
        </TabsContent>
        {team ? (
          <TabsContent value="team">
            <Card className="py-1 shadow-card">
              <MentorshipTable items={team} empty="None of your direct reports are in a mentorship yet." />
            </Card>
          </TabsContent>
        ) : null}
        {all ? (
          <TabsContent value="all">
            <Card className="py-1 shadow-card">
              <MentorshipTable items={all} />
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}
