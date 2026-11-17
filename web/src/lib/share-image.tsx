import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { RouteStop } from '@/components/route';
import type { Plan } from './api';
import { activityLabel, formatEuros, formatTime } from './format';
import { describeWhen, toRouteStops } from './plan';

// Link previews (#226): what WhatsApp, iMessage and others show for a link to the site, in the same ticket look.
export const imageSize = { width: 1200, height: 630 };

const colors = {
  wine: '#2b0d1e',
  butter: '#ffe7a3',
  coral: '#ff6b5b',
  blush: '#f6e3ea',
  mauve: '#c79aae',
};
const paper = [colors.butter, colors.coral];
const MAX_STOPS = 3;
const MAX_TITLE = 48;

export type ShareCard = { heading: string; lines: string[]; stops: RouteStop[] };

export const defaultCard = (stops: RouteStop[]): ShareCard => ({
  heading: 'Your whole night, planned.',
  lines: ['Real places, times and prices for a night out in Lleida.'],
  stops,
});

export function planCard(plan: Plan): ShareCard {
  const lines = [describeWhen(plan)];
  if (plan.estimatedCostPerPerson !== null)
    lines.push(`About ${formatEuros(plan.estimatedCostPerPerson)} per person`);
  return { heading: plan.title, lines, stops: toRouteStops(plan) };
}

const shorten = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/** The card as the image renderer (Satori) understands it: flexbox only, inline styles. */
export function ShareCardView({ heading, lines, stops }: ShareCard) {
  const title = shorten(heading, MAX_TITLE);
  const shown = stops.slice(0, MAX_STOPS);
  const more = stops.length - shown.length;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '56px 64px',
        backgroundColor: colors.wine,
        color: colors.blush,
        fontFamily: 'Figtree',
      }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        <div style={{ fontFamily: 'Big Shoulders', fontSize: 40, textTransform: 'uppercase' }}>
          LinkUp
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontFamily: 'Big Shoulders',
            fontSize: title.length > 24 ? 76 : 104,
            lineHeight: 1,
            color: colors.butter,
            textTransform: 'uppercase',
          }}>
          {title}
        </div>
        {lines.map((line) => (
          <div key={line} style={{ marginTop: 16, fontSize: 28, color: colors.mauve }}>
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          width: 500,
          transform: 'rotate(-2deg)',
        }}>
        {shown.map((stop, index) => (
          <Ticket key={`${stop.name}-${stop.startTime}`} stop={stop} index={index} />
        ))}
        {more > 0 && (
          <div style={{ fontSize: 26, color: colors.mauve, paddingLeft: 24 }}>
            {more === 1 ? 'and 1 more stop' : `and ${more} more stops`}
          </div>
        )}
      </div>
    </div>
  );
}

function Ticket({ stop, index }: { stop: RouteStop; index: number }) {
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        marginLeft: index === 1 ? 32 : 0,
        borderRadius: 16,
        backgroundColor: paper[index % paper.length],
        color: colors.wine,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 140,
          padding: '20px 0',
          borderRight: `4px dashed ${colors.wine}`,
          fontFamily: 'Big Shoulders',
          fontSize: 48,
        }}>
        {formatTime(stop.startTime)}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 22px',
        }}>
        <div style={{ fontFamily: 'Big Shoulders', fontSize: 38, textTransform: 'uppercase' }}>
          {shorten(stop.name, 20)}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{activityLabel(stop.activity)}</div>
      </div>
      {/* The notches of the perforation. */}
      <div style={notch({ top: -14 })} />
      <div style={notch({ bottom: -14 })} />
    </div>
  );
}

const notch = (edge: { top: number } | { bottom: number }) => ({
  position: 'absolute' as const,
  left: 128,
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: colors.wine,
  ...edge,
});

const fontFile = (name: string) => readFile(join(process.cwd(), 'assets/fonts', name));

// Read once per server: the same three fonts serve every image.
type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'];
let fonts: Promise<Fonts> | undefined;

function loadFonts() {
  fonts ??= Promise.all([
    fontFile('BigShoulders-Black.ttf'),
    fontFile('Figtree-Medium.ttf'),
    fontFile('Figtree-Bold.ttf'),
  ]).then(([display, medium, bold]) => [
    { name: 'Big Shoulders', data: display, weight: 900 as const, style: 'normal' as const },
    { name: 'Figtree', data: medium, weight: 500 as const, style: 'normal' as const },
    { name: 'Figtree', data: bold, weight: 700 as const, style: 'normal' as const },
  ]);
  return fonts;
}

export async function shareImage(card: ShareCard) {
  return new ImageResponse(<ShareCardView {...card} />, {
    ...imageSize,
    fonts: await loadFonts(),
  });
}
