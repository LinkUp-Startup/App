import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exampleNight } from '../example-night';
import { defaultCard, planCard, shareImage, ShareCardView } from '../share-image';
import { samplePlan } from './sample-plan';

const { ImageResponse, readFile } = vi.hoisted(() => ({
  ImageResponse: vi.fn(),
  readFile: vi.fn(async (path: string) => Buffer.from(path)),
}));
vi.mock('next/og', () => ({ ImageResponse }));
vi.mock('node:fs/promises', () => ({ default: { readFile }, readFile }));

beforeEach(() => ImageResponse.mockClear());

describe('plan card', () => {
  it('uses the title, the night and the price per person', () => {
    const card = planCard(samplePlan);

    expect(card.heading).toBe('Tapas and a late club');
    expect(card.lines).toEqual(['Friday 6 November, 20:30 to 04:00', 'About €38 per person']);
    expect(card.stops.map((stop) => stop.name)).toEqual(['Cantamanyanes', 'Traganits']);
  });

  it('leaves out the price when it is not known', () => {
    expect(planCard({ ...samplePlan, estimatedCostPerPerson: null }).lines).toHaveLength(1);
  });
});

describe('share card', () => {
  it('shows the heading, the lines and a ticket per stop', () => {
    render(<ShareCardView {...planCard(samplePlan)} />);

    expect(screen.getByText('Tapas and a late club')).toBeInTheDocument();
    expect(screen.getByText('About €38 per person')).toBeInTheDocument();
    expect(screen.getByText('20:30')).toBeInTheDocument();
    expect(screen.getByText('Traganits')).toBeInTheDocument();
    expect(screen.getByText('Club')).toBeInTheDocument();
  });

  it('shortens long titles and names and counts the stops that do not fit', () => {
    const stops = [...exampleNight, exampleNight[0], exampleNight[1]].map((stop, index) =>
      index === 0 ? { ...stop, name: 'A very long venue name that goes on' } : stop,
    );
    render(<ShareCardView heading={'A'.repeat(60)} lines={[]} stops={stops} />);

    expect(screen.getByText(`${'A'.repeat(47)}…`)).toBeInTheDocument();
    expect(screen.getByText('A very long venue n…')).toBeInTheDocument();
    expect(screen.getByText('and 2 more stops')).toBeInTheDocument();
  });

  it('says "1 more stop" for one', () => {
    render(<ShareCardView {...defaultCard([...exampleNight, exampleNight[0]])} />);

    expect(screen.getByText('Your whole night, planned.')).toBeInTheDocument();
    expect(screen.getByText('and 1 more stop')).toBeInTheDocument();
  });
});

describe('share image', () => {
  it('renders the card at 1200x630 with the site fonts, read once', async () => {
    await shareImage(defaultCard(exampleNight));
    await shareImage(defaultCard(exampleNight));

    expect(ImageResponse).toHaveBeenCalledTimes(2);
    const options = ImageResponse.mock.calls[0][1];
    expect(options).toMatchObject({ width: 1200, height: 630 });
    expect(options.fonts.map((font: { name: string }) => font.name)).toEqual([
      'Big Shoulders',
      'Figtree',
      'Figtree',
    ]);
    expect(readFile).toHaveBeenCalledTimes(3);
    expect(String(readFile.mock.calls[0][0])).toMatch(/assets\/fonts\/BigShoulders-Black\.ttf$/);
  });
});
