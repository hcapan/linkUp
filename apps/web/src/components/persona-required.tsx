import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export function PersonaRequired({ what = 'this page' }: { what?: string }) {
  return (
    <Empty className="rounded-2xl border bg-card py-16 shadow-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserRound />
        </EmptyMedia>
        <EmptyTitle>Pick a demo persona first</EmptyTitle>
        <EmptyDescription>
          There is no login in the demo. Use <b>Viewing as</b> in the top bar to act as any SE, manager or the program admin
          to see {what}.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/profile/new">Or create your own profile</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
