'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ARCHITECTURES,
  COACHING_FORMATS,
  COMPETITORS,
  DEAL_SIZES,
  FINANCIAL_SKILLS,
  LICENSING_MODELS,
  PORTFOLIO_TARGET,
  STAKEHOLDER_DISCIPLINES,
  SUBCATEGORIES,
  type MentorshipRequestInput,
} from '@linkup/core';
import { createRequest } from '@/app/actions';
import { AdaptiveCard } from '@/components/adaptive-card';
import { ChipGroup, ChipSelect } from '@/components/chip-group';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const ARCH_OPTIONS = [
  ...ARCHITECTURES.map((a) => ({ value: a.code, label: `${a.label} (${a.short})`, hint: a.detail })),
  { value: PORTFOLIO_TARGET, label: 'Portfolio breadth', hint: 'Broad multi-architecture coverage' },
];

export function RequestForm({ defaultTimezoneNote }: { defaultTimezoneNote: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<MentorshipRequestInput>({
    primaryArch: 'AI',
    targetSubcategories: [],
    commercialSkills: [],
    stakeholderInterests: [],
    dealSize: null,
    competitors: [],
    formats: ['FMT_LIVE_SHADOWING'],
    goal: '',
  });
  const set = <K extends keyof MentorshipRequestInput>(key: K, value: MentorshipRequestInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const subOptions = useMemo(() => {
    const inArch = SUBCATEGORIES.filter((s) => form.primaryArch === PORTFOLIO_TARGET || s.arch === form.primaryArch);
    const selectedElsewhere = SUBCATEGORIES.filter((s) => form.targetSubcategories.includes(s.code) && !inArch.includes(s));
    return [...inArch, ...selectedElsewhere].map((s) => ({ value: s.code, label: `${s.code} · ${s.short}`, hint: `${s.label}: ${s.detail}` }));
  }, [form.primaryArch, form.targetSubcategories]);

  const submit = () =>
    startTransition(async () => {
      setErrors({});
      const result = await createRequest(form);
      if (!result.ok) {
        const map: Record<string, string> = {};
        for (const i of result.issues ?? []) map[i.path.split('.')[0]!] = i.message;
        setErrors(map);
        toast.error(result.error);
        return;
      }
      toast.success(`Matched against ${result.data.evaluated} mentors`);
      router.push(`/requests/${result.data.id}`);
    });

  return (
    <AdaptiveCard title="Webex Bot · Mentee Growth Query">
      <div className="grid gap-5">
        <FormField label="Target architecture" hint="primary growth domain" error={errors.primaryArch}>
          <ChipSelect
            options={ARCH_OPTIONS}
            value={form.primaryArch}
            onChange={(v) => setForm((f) => ({ ...f, primaryArch: v ?? 'AI', targetSubcategories: [] }))}
          />
        </FormField>

        <FormField
          label="Target subcategories"
          hint="pick 1–3"
          description="Scored against mentors' L2 / L3 ratings — the Subcategory Gap Match (15 pts)."
          error={errors.targetSubcategories}
        >
          <ChipGroup options={subOptions} value={form.targetSubcategories} onChange={(v) => set('targetSubcategories', v)} max={3} />
        </FormField>

        <Separator />

        <FormField label="Commercial skills to grow" hint="optional" error={errors.commercialSkills}>
          <div className="grid gap-2">
            <ChipGroup
              options={LICENSING_MODELS.map((l) => ({ value: l.code, label: l.short, hint: l.label }))}
              value={form.commercialSkills.filter((c) => c.startsWith('LIC_'))}
              onChange={(v) => set('commercialSkills', [...v, ...form.commercialSkills.filter((c) => c.startsWith('FIN_'))])}
            />
            <ChipGroup
              options={FINANCIAL_SKILLS.map((f) => ({ value: f.code, label: f.short, hint: f.label }))}
              value={form.commercialSkills.filter((c) => c.startsWith('FIN_'))}
              onChange={(v) => set('commercialSkills', [...form.commercialSkills.filter((c) => c.startsWith('LIC_')), ...v])}
            />
          </div>
        </FormField>

        <FormField label="Deal tier to master" hint="optional">
          <ChipSelect
            allowEmpty
            options={DEAL_SIZES.map((d) => ({ value: d.code, label: `${d.label} · ${d.detail}` }))}
            value={form.dealSize}
            onChange={(v) => set('dealSize', v)}
          />
        </FormField>

        <FormField label="Active competitor battle" hint="optional" description="Matched against mentors' verified takeouts (10 pts).">
          <ChipGroup
            options={COMPETITORS.map((c) => ({ value: c.code, label: c.short, hint: c.detail }))}
            value={form.competitors}
            onChange={(v) => set('competitors', v)}
          />
        </FormField>

        <FormField label="Preferred coaching format" hint="at least one" error={errors.formats}>
          <ChipGroup
            options={COACHING_FORMATS.map((f) => ({ value: f.code, label: f.label }))}
            value={form.formats}
            onChange={(v) => set('formats', v)}
          />
        </FormField>

        <FormField
          label="Stakeholder skills you'd like to build"
          hint="optional · tie-breaker only"
          description="Not part of the 100 points — used to order equally scored mentors and shown on the match card."
        >
          <ChipGroup
            options={STAKEHOLDER_DISCIPLINES.map((s) => ({ value: s.code, label: s.label, hint: s.detail }))}
            value={form.stakeholderInterests}
            onChange={(v) => set('stakeholderInterests', v)}
          />
        </FormField>

        <FormField
          label="Growth goal"
          hint="used for semantic match"
          htmlFor="goal"
          error={errors.goal}
          description={`Compared with every mentor's superpower bio by an on-device embedding model (5 pts). ${defaultTimezoneNote}`}
        >
          <Textarea
            id="goal"
            rows={3}
            value={form.goal}
            onChange={(e) => set('goal', e.target.value)}
            placeholder="e.g. Associate SE seeking an AI Specialist mentor to master Nexus HyperFabric, RoCEv2 GPU networking, and EA 3.0 deal defense."
          />
        </FormField>

        <Button size="lg" className="h-11 w-full text-sm font-bold" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? 'Scoring every mentor…' : 'Run 100-point match'}
        </Button>
      </div>
    </AdaptiveCard>
  );
}
