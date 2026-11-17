import { describe, expect, it } from 'vitest';
import { escapeText, foldLine, icsFileName, planToIcs } from '../calendar';
import { samplePlan } from './sample-plan';

const now = new Date('2026-11-01T12:00:00Z');
const unfold = (ics: string) => ics.replaceAll('\r\n ', '');

describe('planToIcs', () => {
  const ics = planToIcs(samplePlan, now);
  const lines = unfold(ics).split('\r\n');

  it('is a calendar with one event per stop, in UTC', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines).toContain('X-WR-CALNAME:Tapas and a late club');
    expect(lines).toContain(`UID:${samplePlan.id}-1@linkup.th7bo.dev`);
    expect(lines).toContain('DTSTAMP:20261101T120000Z');
    expect(lines).toContain('DTSTART:20261106T193000Z');
    expect(lines).toContain('DTEND:20261107T030000Z');
  });

  it('describes every stop with its place, price and directions', () => {
    expect(lines).toContain('SUMMARY:Cantamanyanes');
    expect(lines).toContain('LOCATION:Carrer de Jaume II\\, 55\\, 25001 Lleida');
    expect(lines).toContain('GEO:41.6201;0.6248');
    const description = lines.find((line) => line.startsWith('DESCRIPTION:'));
    expect(description).toBe(
      'DESCRIPTION:Dinner. About €18 per person.\\nDirections: https://www.google.com/maps/search/?api=1&query=41.6201\\,0.6248\\nPart of "Tapas and a late club"\\, planned with LinkUp.',
    );
  });

  it('says when a price is not known', () => {
    const plan = {
      ...samplePlan,
      items: [{ ...samplePlan.items[0], estimatedCostPerPerson: null }],
    };
    expect(unfold(planToIcs(plan, now))).toContain('Dinner. Price not known.');
  });

  it('keeps every line within 75 bytes', () => {
    const bytes = (line: string) => new TextEncoder().encode(line).length;
    expect(Math.max(...ics.split('\r\n').map(bytes))).toBeLessThanOrEqual(75);
  });
});

describe('escapeText', () => {
  it('escapes the characters that have a meaning in iCalendar', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\;c\\,d\\ne\\nf');
  });
});

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:Bar')).toBe('SUMMARY:Bar');
  });

  it('folds long lines without splitting a character', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`;
    const folded = foldLine(line);

    expect(folded.replaceAll('\r\n ', '')).toBe(line);
    for (const part of folded.split('\r\n'))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  });
});

describe('icsFileName', () => {
  it('makes a readable ASCII file name', () => {
    expect(icsFileName('Tapas, vermut & a late club!')).toBe('tapas-vermut-a-late-club.ics');
    expect(icsFileName('Nit a la Plaça Sant Joan')).toBe('nit-a-la-placa-sant-joan.ics');
  });

  it('falls back when nothing readable is left', () => {
    expect(icsFileName('🎉🎉')).toBe('linkup-plan.ics');
  });
});
