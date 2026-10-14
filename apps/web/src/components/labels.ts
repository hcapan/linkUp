import { ARCHITECTURES, labelOf, shortLabelOf, timezoneLabel } from '@linkup/core';

export const archShort = (code: string | null | undefined) =>
  code === 'PORTFOLIO' ? 'Portfolio' : (ARCHITECTURES.find((a) => a.code === code)?.short ?? code ?? '');

export function roleLine(p: { seRole: string | null; specialistArch: string | null }) {
  if (p.seRole === 'SPECIALIST') return `Specialist SE · ${labelOf(p.specialistArch)}`;
  if (p.seRole === 'PORTFOLIO') return 'Portfolio SE';
  return '';
}

export function geoLine(p: { regionalSub: string | null; segment: string | null; timezone: string | null }) {
  return [labelOf(p.regionalSub), labelOf(p.segment), timezoneLabel(p.timezone)].filter(Boolean).join(' · ');
}

export function skillLabel(code: string, level?: number) {
  return `${code} · ${shortLabelOf(code)}${level ? ` L${level}` : ''}`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}
