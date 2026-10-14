import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';

export function FormField({
  label,
  hint,
  description,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  description?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={!!error} className="gap-2">
      <FieldLabel htmlFor={htmlFor} className="text-xs font-bold">
        {label}
        {hint ? <span className="ml-1 text-[11px] font-medium text-subtle">({hint})</span> : null}
      </FieldLabel>
      {children}
      {description ? <FieldDescription className="text-xs">{description}</FieldDescription> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </Field>
  );
}
