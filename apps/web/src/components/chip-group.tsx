'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: string;
  hint?: string;
}

const chip =
  'h-auto min-h-8 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground whitespace-normal ' +
  'hover:border-primary/50 hover:bg-card hover:text-foreground ' +
  'data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary-text';

/** Multi-select chips (the mockup's "chipset"), built on shadcn ToggleGroup. */
export function ChipGroup({
  options,
  value,
  onChange,
  max,
  className,
  ariaLabel,
}: {
  options: readonly ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      type="multiple"
      value={value}
      onValueChange={(next) => onChange(max && next.length > max ? next.slice(next.length - max) : next)}
      className={cn('flex-wrap justify-start', className)}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={chip} title={o.hint}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Single-select chips. */
export function ChipSelect({
  options,
  value,
  onChange,
  allowEmpty = false,
  className,
  ariaLabel,
}: {
  options: readonly ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allowEmpty?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value ?? ''}
      onValueChange={(next) => (next || allowEmpty ? onChange(next || null) : undefined)}
      className={cn('flex-wrap justify-start', className)}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={chip} title={o.hint}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
