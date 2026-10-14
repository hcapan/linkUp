import Link from 'next/link';
import { PersonAvatar } from '@/components/person-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Mentorship } from '@/lib/types';
import { formatDate } from './labels';

function Person({ name, sub }: { name: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <PersonAvatar name={name} size="sm" />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

export function MentorshipTable({ items, empty = 'Nothing here yet.' }: { items: Mentorship[]; empty?: string }) {
  if (items.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mentee</TableHead>
          <TableHead>Mentor</TableHead>
          <TableHead>Focus</TableHead>
          <TableHead className="text-right">Match</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => (
          <TableRow key={m.id} className="relative">
            <TableCell>
              <Link href={`/mentorships/${m.id}`} className="absolute inset-0" aria-label={`Open mentorship ${m.mentee.fullName} and ${m.mentor.fullName}`} />
              <Person name={m.mentee.fullName} sub={m.mentee.jobTitle} />
            </TableCell>
            <TableCell>
              <Person name={m.mentor.fullName} sub={m.mentor.jobTitle} />
            </TableCell>
            <TableCell className="text-[13px]">{m.focus || '—'}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{m.matchScore ?? '—'}%</TableCell>
            <TableCell>
              <Progress value={m.progress} className="h-1.5 w-24" />
            </TableCell>
            <TableCell>
              <StatusBadge status={m.status} />
            </TableCell>
            <TableCell className="text-[12px] text-muted-foreground">{formatDate(m.requestedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
