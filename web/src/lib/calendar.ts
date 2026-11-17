import type { Plan } from './api';
import { activityLabel, directionsUrl, formatEuros } from './format';

// A plan as an iCalendar file (RFC 5545) with one event per stop (#227), for Google, Apple and Outlook calendars.

/** 20261106T193000Z: times in UTC, so every calendar shows them in its own time zone. */
const icsTime = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Text values escape backslashes, semicolons, commas and line breaks. */
export const escapeText = (text: string) =>
  text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\;')
    .replaceAll(',', '\\,')
    .replaceAll(/\r?\n/g, '\\n');

const encoder = new TextEncoder();

/** Lines longer than 75 bytes continue on the next line after a space, without splitting a character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function planToIcs(plan: Plan, now = new Date()): string {
  const stamp = icsTime(now.toISOString());
  const events = plan.items.flatMap((item, index) => {
    const { venue } = item;
    const price =
      item.estimatedCostPerPerson === null
        ? 'Price not known'
        : `About ${formatEuros(item.estimatedCostPerPerson)} per person`;
    const description = [
      `${activityLabel(venue.category)}. ${price}.`,
      `Directions: ${directionsUrl(venue.latitude, venue.longitude)}`,
      `Part of "${plan.title}", planned with LinkUp.`,
    ].join('\n');
    return [
      'BEGIN:VEVENT',
      `UID:${plan.id}-${index + 1}@linkup.th7bo.dev`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsTime(item.startTime)}`,
      `DTEND:${icsTime(item.endTime)}`,
      `SUMMARY:${escapeText(venue.name)}`,
      `LOCATION:${escapeText(venue.address)}`,
      `GEO:${venue.latitude};${venue.longitude}`,
      `DESCRIPTION:${escapeText(description)}`,
      'END:VEVENT',
    ];
  });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LinkUp//Night planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(plan.title)}`,
    ...events,
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** "tapas-and-a-late-club.ics": a readable file name, ASCII only. */
export function icsFileName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 60);
  return `${slug || 'linkup-plan'}.ics`;
}
