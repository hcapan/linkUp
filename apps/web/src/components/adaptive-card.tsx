import { Card } from '@/components/ui/card';

/** Card styled like a Webex Adaptive Card (the same form the bot sends). */
export function AdaptiveCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 py-0 shadow-card">
      <div className="flex items-center gap-2.5 bg-ink px-5 py-3.5 text-sm font-bold text-ink-foreground">
        <span className="flex size-[22px] items-center justify-center rounded-md bg-cyan text-[13px] text-ink">◆</span>
        {title}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </Card>
  );
}
