/** UTC offset of an IANA zone at a given instant, in minutes (DST-aware). */
export function utcOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  const instant = new Date(Math.floor(at.getTime() / 1000) * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Working-hour distance between two zones in hours, 0–12.
 * A 15h raw difference (PST vs SGT) is really a 9h gap around the clock.
 */
export function timezoneGapHours(a: string, b: string, at: Date = new Date()): number {
  const diff = Math.abs(utcOffsetMinutes(a, at) - utcOffsetMinutes(b, at)) / 60;
  return Math.min(diff, 24 - diff);
}
