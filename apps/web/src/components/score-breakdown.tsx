import type { MatchBreakdown } from '@linkup/core';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  tech: 'bg-primary',
  biz: 'bg-cyan',
  stakeholder: 'bg-success',
  format: 'bg-warning',
};

const TONES: Record<string, string> = {
  tech: 'bg-cyan-soft text-cyan-text',
  biz: 'bg-success-soft text-success-text',
  competitor: 'bg-magenta-soft text-magenta-text',
  geo: 'bg-primary-soft text-primary-text',
  format: 'bg-warning-soft text-warning-text',
  cert: 'bg-muted text-muted-foreground',
  stakeholder: 'bg-muted text-foreground',
};

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Category bars; with `detailed`, every scoring line and penalty is listed. */
export function ScoreBreakdown({ breakdown, detailed = false }: { breakdown: MatchBreakdown; detailed?: boolean }) {
  return (
    <div className="grid gap-3">
      {breakdown.categories.map((c) => (
        <div key={c.key}>
          <div className="grid grid-cols-[minmax(120px,170px)_1fr_52px] items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span>{c.label}</span>
            <div className="h-[7px] overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', COLORS[c.key])} style={{ width: `${(c.points / c.max) * 100}%` }} />
            </div>
            <span className="text-right text-foreground tabular-nums">
              {fmt(c.points)}/{c.max}
            </span>
          </div>
          {detailed ? (
            <ul className="mt-1.5 ml-1 grid gap-1 border-l pl-3">
              {c.lines.map((l) => (
                <li key={l.key} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{l.label}</span> — {l.detail}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {fmt(l.points)}/{l.max}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {breakdown.penalties.length > 0 && (
        <div className="grid gap-1">
          {breakdown.penalties.map((p) => (
            <div key={p.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-destructive-text">
                <span className="font-semibold">{p.label}</span> — {p.detail}
              </span>
              <span className="shrink-0 font-semibold text-destructive-text tabular-nums">{p.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Highlights({ breakdown, limit }: { breakdown: MatchBreakdown; limit?: number }) {
  const items = limit ? breakdown.highlights.slice(0, limit) : breakdown.highlights;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((h, i) => (
        <span key={`${h.label}-${i}`} className={cn('rounded-md px-2 py-1 text-[10.5px] font-bold', TONES[h.tone])}>
          {h.label}
        </span>
      ))}
    </div>
  );
}
