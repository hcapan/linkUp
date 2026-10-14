import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MentorshipStatus } from '@/lib/types';

const STYLES: Record<MentorshipStatus, string> = {
  PENDING: 'bg-warning-soft text-warning-text',
  ACTIVE: 'bg-success-soft text-success-text',
  COMPLETED: 'bg-primary-soft text-primary-text',
  DECLINED: 'bg-destructive-soft text-destructive-text',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const LABELS: Record<MentorshipStatus, string> = {
  PENDING: 'Awaiting mentor',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export function StatusBadge({ status, className }: { status: MentorshipStatus; className?: string }) {
  return <Badge className={cn('font-semibold', STYLES[status], className)}>{LABELS[status]}</Badge>;
}

export function ScoreBadge({ score, strong }: { score: number; strong?: boolean }) {
  const isStrong = strong ?? score >= 70;
  return (
    <Badge className={cn('font-bold', isStrong ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text')}>
      {score}% · {isStrong ? 'Strong' : 'Partial'}
    </Badge>
  );
}
