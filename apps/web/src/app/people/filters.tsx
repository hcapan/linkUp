'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ARCHITECTURES, REGIONAL_SUBS, SEGMENTS, SUBCATEGORIES } from '@linkup/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const ANY = '__any';

export function DirectoryFilters({ canSeeAll, isManager }: { canSeeAll: boolean; isManager: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== ANY) next.set(k, v);
      else next.delete(k);
    }
    next.delete('offset');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) update({ q: q || null });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const arch = params.get('arch') ?? ANY;
  const subs = SUBCATEGORIES.filter((s) => arch === ANY || s.arch === arch);

  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, CEC ID, title or superpower bio…" className="h-10 pl-9" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {canSeeAll || isManager ? (
          <Select value={params.get('pool') ?? 'mentors'} onValueChange={(v) => update({ pool: v === 'mentors' ? null : v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mentors">Mentor pool</SelectItem>
              {isManager ? <SelectItem value="team">My team</SelectItem> : null}
              {canSeeAll ? <SelectItem value="all">Everyone</SelectItem> : null}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={arch} onValueChange={(v) => update({ arch: v, subcategory: null })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Architecture" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any architecture</SelectItem>
            {ARCHITECTURES.map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get('subcategory') ?? ANY} onValueChange={(v) => update({ subcategory: v })}>
          <SelectTrigger className="w-full lg:col-span-2">
            <SelectValue placeholder="Subcategory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any subcategory</SelectItem>
            {subs.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.code} · {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get('minLevel') ?? '2'} onValueChange={(v) => update({ minLevel: v === '2' ? null : v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">L1+ (any rating)</SelectItem>
            <SelectItem value="2">L2+ proficient</SelectItem>
            <SelectItem value="3">L3 SME only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={params.get('region') ?? ANY} onValueChange={(v) => update({ region: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any region</SelectItem>
            {REGIONAL_SUBS.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={params.get('segment') ?? ANY} onValueChange={(v) => update({ segment: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any segment</SelectItem>
            {SEGMENTS.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="openSlots" checked={params.get('openSlots') === 'true'} onCheckedChange={(v) => update({ openSlots: v ? 'true' : null })} />
          <Label htmlFor="openSlots" className="text-xs font-semibold">
            Only mentors with open slots
          </Label>
        </div>
        {params.toString() ? (
          <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
            <X /> Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
