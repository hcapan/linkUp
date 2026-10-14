'use client';

import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ARCHITECTURES,
  CERTIFICATIONS,
  COACHING_FORMATS,
  COMPETITORS,
  DEAL_SIZES,
  FINANCIAL_SKILLS,
  LICENSING_MODELS,
  PROFICIENCY_LEVELS,
  PROGRAM_COMMITMENT,
  REGIONAL_SUBS,
  SEGMENTS,
  STAKEHOLDER_DISCIPLINES,
  SUBCATEGORIES,
  THEATERS,
  TIMEZONES,
  type ProfileInput,
} from '@linkup/core';
import { createProfile, updateProfile } from '@/app/actions';
import { ChipGroup, ChipSelect } from '@/components/chip-group';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface ManagerOption {
  id: string;
  fullName: string;
  jobTitle: string;
}

const NONE = '__none';

function Section({ n, title, badge, description, children }: { n: number; title: string; badge?: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n}</span>
          <CardTitle className="font-bold">{title}</CardTitle>
          {badge ? <Badge className="ml-auto bg-ink text-[10px] tracking-wide text-ink-foreground uppercase">{badge}</Badge> : null}
        </div>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

const levelChip =
  'h-7 min-w-10 rounded-full border border-border bg-card px-2.5 text-[11px] font-bold text-muted-foreground ' +
  'data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-text';

export function ProfileForm({
  mode,
  personId,
  initial,
  managers,
}: {
  mode: 'create' | 'edit';
  personId?: string;
  initial: ProfileInput;
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ProfileInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const levels = new Map(form.skills.map((s) => [s.subcategory, s.level]));
  const setLevel = (code: string, level: number | null) =>
    set(
      'skills',
      level ? [...form.skills.filter((s) => s.subcategory !== code), { subcategory: code, level: level as 1 | 2 | 3 }] : form.skills.filter((s) => s.subcategory !== code),
    );

  const submit = () =>
    startTransition(async () => {
      setErrors({});
      const result = mode === 'create' ? await createProfile(form) : await updateProfile(personId!, form);
      if (!result.ok) {
        const map: Record<string, string> = {};
        for (const i of result.issues ?? []) map[i.path.split('.')[0]!] ??= i.message;
        setErrors(map);
        toast.error(result.error, { description: Object.values(map).slice(0, 3).join(' · ') || undefined });
        return;
      }
      toast.success(mode === 'create' ? `Welcome, ${result.data.fullName.split(' ')[0]}! You are now viewing as yourself.` : 'Profile saved — embedding refreshed');
      router.push(`/people/${result.data.id}`);
      router.refresh();
    });

  return (
    <div className="grid gap-5 pb-24">
      <Section n={1} title="Identity, role gating, geo & timezone" badge="Schema v5" description="In production, name, CEC ID and manager are auto-populated from Cisco Directory / Workday.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="fullName" error={errors.fullName}>
            <Input id="fullName" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </FormField>
          <FormField label="CEC ID" htmlFor="cecId" error={errors.cecId}>
            <Input id="cecId" value={form.cecId} onChange={(e) => set('cecId', e.target.value)} placeholder="e.g. jdoe" />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </FormField>
          <FormField label="Job title" htmlFor="jobTitle" error={errors.jobTitle}>
            <Input id="jobTitle" value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
          </FormField>
          <FormField label="Direct manager" hint="Workday · used for the same-pod rule">
            <Select value={form.managerId ?? NONE} onValueChange={(v) => set('managerId', v === NONE ? null : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No manager</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName} — {m.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField label="SE role classification" hint="primary gate" error={errors.seRole}>
          <RadioGroup
            value={form.seRole}
            onValueChange={(v) => setForm((f) => ({ ...f, seRole: v, specialistArch: v === 'SPECIALIST' ? (f.specialistArch ?? 'AI') : null }))}
            className="grid gap-3 sm:grid-cols-2"
          >
            {[
              ['PORTFOLIO', 'Portfolio SE', 'Broad multi-architecture coverage'],
              ['SPECIALIST', 'Specialist SE (TSA / Specialist)', 'Select your primary architecture'],
            ].map(([value, title, detail]) => (
              <Label
                key={value}
                htmlFor={`role-${value}`}
                className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5', form.seRole === value && 'border-primary bg-primary-soft')}
              >
                <RadioGroupItem id={`role-${value}`} value={value!} className="mt-0.5" />
                <span>
                  <span className="block text-[13px] font-bold">{title}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{detail}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </FormField>

        {form.seRole === 'SPECIALIST' && (
          <FormField label="Specialist architecture" error={errors.specialistArch}>
            <ChipSelect
              options={ARCHITECTURES.map((a) => ({ value: a.code, label: `${a.short}: ${a.label}`, hint: a.detail }))}
              value={form.specialistArch ?? null}
              onChange={(v) => set('specialistArch', v)}
            />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Region / theater" description="Phase 1 covers EMEAR; Americas and APJC follow.">
            <ChipSelect
              options={THEATERS.filter((t) => t.enabled).map((t) => ({ value: t.code, label: t.label }))}
              value={form.theater}
              onChange={(v) => set('theater', v ?? 'EMEAR')}
            />
          </FormField>
          <FormField label="Segment / org sub-category" error={errors.segment}>
            <Select value={form.segment} onValueChange={(v) => set('segment', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Regional sub-category" error={errors.regionalSub}>
            <Select value={form.regionalSub} onValueChange={(v) => set('regionalSub', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONAL_SUBS.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Timezone" hint="DST-aware" error={errors.timezone}>
            <Select value={form.timezone} onValueChange={(v) => set('timezone', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => (
                  <SelectItem key={t.code} value={t.code}>
                    <b>{t.label}</b> <span className="text-muted-foreground">· {t.detail}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField
          label="1–2 sentence brief profile summary (superpower)"
          hint="ingested for semantic matching"
          htmlFor="bio"
          error={errors.bio}
          description={`${form.bio?.length ?? 0}/400`}
        >
          <Textarea
            id="bio"
            rows={3}
            maxLength={400}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="Senior AI & Security Specialist with deep expertise in Nexus HyperFabric, SASE, and EA 3.0 commercial structuring across Germany, METAC, and Commercial GVE."
          />
        </FormField>

        <FormField label="Valid active certifications" hint="self-declared · Certmetrics later">
          <div className="grid gap-2">
            {['Cisco', 'AI & Industry'].map((group) => (
              <div key={group} className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-subtle">{group}</span>
                <ChipGroup
                  options={CERTIFICATIONS.filter((c) => c.group === group).map((c) => ({ value: c.code, label: c.label }))}
                  value={form.certifications.filter((c) => CERTIFICATIONS.find((x) => x.code === c)?.group === group)}
                  onChange={(v) =>
                    set('certifications', [...form.certifications.filter((c) => CERTIFICATIONS.find((x) => x.code === c)?.group !== group), ...v])
                  }
                />
              </div>
            ))}
          </div>
        </FormField>

        <div className="grid gap-4 rounded-xl border bg-muted/40 p-4 sm:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-3">
            <Switch id="isMentor" checked={form.isMentor} onCheckedChange={(v) => set('isMentor', v)} className="mt-0.5" />
            <Label htmlFor="isMentor" className="block cursor-pointer">
              <span className="block text-[13px] font-bold">Add me to the mentor pool</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Program commitment: {PROGRAM_COMMITMENT.label}. Mentees only see you while you have open slots.
              </span>
            </Label>
          </div>
          {form.isMentor ? (
            <FormField label="Active mentee capacity">
              <ChipSelect
                options={[
                  { value: '1', label: 'Max 1 mentee' },
                  { value: '2', label: 'Max 2 mentees' },
                ]}
                value={String(form.menteeCapacity)}
                onChange={(v) => set('menteeCapacity', Number(v ?? 1) as 1 | 2)}
              />
            </FormField>
          ) : null}
        </div>
      </Section>

      <Section
        n={2}
        title="Granular technology & architecture subcategories"
        badge="L1–L3 rating"
        description={PROFICIENCY_LEVELS.map((l) => `${l.code} (${l.label}): ${l.detail}`).join('  ·  ')}
      >
        {errors.skills ? <p className="text-xs font-medium text-destructive">{errors.skills}</p> : null}
        <div className="grid gap-5 md:grid-cols-2">
          {ARCHITECTURES.map((arch) => (
            <div key={arch.code} className={cn('min-w-0 rounded-xl border p-3.5', arch.code === 'AI' && 'bg-success-soft/40')}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-bold">
                  {arch.label} <span className="text-muted-foreground">({arch.short})</span>
                </h3>
                {arch.code === 'AI' ? <span className="text-[10px] font-semibold text-success-text">Dedicated category</span> : null}
              </div>
              <div className="grid grid-cols-1">
                {SUBCATEGORIES.filter((s) => s.arch === arch.code).map((s) => (
                  <div key={s.code} className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">
                        {s.code} · {s.label}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground" title={s.detail}>
                        {s.detail}
                      </div>
                    </div>
                    <ToggleGroup
                      type="single"
                      spacing={1}
                      className="shrink-0"
                      value={levels.get(s.code) ? String(levels.get(s.code)) : ''}
                      onValueChange={(v) => setLevel(s.code, v ? Number(v) : null)}
                      aria-label={`${s.code} proficiency`}
                    >
                      {[1, 2, 3].map((l) => (
                        <ToggleGroupItem key={l} value={String(l)} className={levelChip}>
                          L{l}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} title="Business acumen & commercial experience" badge="Commercial">
        <FormField label="Deal size scale experience">
          <ChipGroup options={DEAL_SIZES.map((d) => ({ value: d.code, label: `${d.label} · ${d.detail}` }))} value={form.dealSizes} onChange={(v) => set('dealSizes', v)} />
        </FormField>
        <FormField label="Licensing & commercial models">
          <ChipGroup options={LICENSING_MODELS.map((l) => ({ value: l.code, label: l.label }))} value={form.licensing} onChange={(v) => set('licensing', v)} />
        </FormField>
        <FormField label="Financial justification & ROI">
          <ChipGroup options={FINANCIAL_SKILLS.map((f) => ({ value: f.code, label: f.label }))} value={form.financial} onChange={(v) => set('financial', v)} />
        </FormField>
      </Section>

      <Section n={4} title="Stakeholder management, competitor takeouts & coaching formats" badge="Relationship depth">
        <FormField label="Stakeholder engagement disciplines" hint="shown on your profile · tie-breaker">
          <ChipGroup
            options={STAKEHOLDER_DISCIPLINES.map((s) => ({ value: s.code, label: s.label, hint: s.detail }))}
            value={form.stakeholder}
            onChange={(v) => set('stakeholder', v)}
          />
        </FormField>
        <FormField label="Verified competitor takeouts" hint="tag proven wins">
          <ChipGroup
            options={COMPETITORS.map((c) => ({ value: c.code, label: `${c.short} — ${c.detail.replace(/\.$/, '')}` }))}
            value={form.competitors}
            onChange={(v) => set('competitors', v)}
          />
        </FormField>
        <FormField label="Practical coaching formats" hint={form.isMentor ? 'required for mentors' : 'what you would offer'} error={errors.formats}>
          <ChipGroup options={COACHING_FORMATS.map((f) => ({ value: f.code, label: f.label }))} value={form.formats} onChange={(v) => set('formats', v)} />
        </FormField>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-xs text-muted-foreground">
            {form.skills.length} subcategories rated · {form.isMentor ? `mentor (capacity ${form.menteeCapacity})` : 'not in the mentor pool'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button size="lg" className="font-bold" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} {mode === 'create' ? 'Create profile' : 'Save profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
