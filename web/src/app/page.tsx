import { Route, type RouteStop } from '@/components/route';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

// Real venues from the Lleida dataset; times and prices are only an example.
const exampleNight: RouteStop[] = [
  {
    name: 'Cantamanyanes',
    activity: 'dinner',
    address: 'Carrer de Jaume II, 55',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T19:30:00Z',
    endTime: '2026-11-06T21:15:00Z',
    costPerPerson: 18,
    distanceKm: 0,
  },
  {
    name: 'La Casa del Vermut',
    activity: 'drinks',
    address: 'Carrer del Corregidor Escofet, 14',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T21:30:00Z',
    endTime: '2026-11-06T23:15:00Z',
    costPerPerson: 8,
    distanceKm: 1.6,
  },
  {
    name: 'Traganits',
    activity: 'club',
    address: 'Carrer Darrera Sant Martí, 57',
    latitude: 0,
    longitude: 0,
    startTime: '2026-11-06T23:30:00Z',
    endTime: '2026-11-07T03:00:00Z',
    costPerPerson: 12,
    distanceKm: 1.9,
  },
];

const steps = [
  {
    title: "Say what you're up for",
    text: 'Your budget, how many of you there are, when you start, how you get around and the kind of night: dinner, drinks, a club.',
  },
  {
    title: 'Pick a plan',
    text: 'You get two or three complete nights. Each one lists every stop with its time, the price per person and how far it is to the next.',
  },
  {
    title: 'Send it to your friends',
    text: 'Share a link. Your friends open the plan in their browser, no app needed.',
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 sm:px-8">
        <section className="grid items-start gap-12 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <h1 className="font-display text-5xl leading-[0.95] font-bold tracking-tight text-balance sm:text-7xl">
              Plan the whole night in one go.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-haze">
              Tell LinkUp your budget, how many of you there are and how far you want to go. It puts
              together complete nights out in Lleida, with real places, times and prices.
            </p>
          </div>

          <figure className="rounded-3xl bg-dusk p-6 sm:p-8">
            <figcaption className="mb-6 text-sm text-haze">An example Friday night</figcaption>
            <Route stops={exampleNight} withDirections={false} />
          </figure>
        </section>

        <section aria-labelledby="how" className="mt-24 sm:mt-32">
          <h2 id="how" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span
                  className="font-display text-5xl font-bold text-sodium tabular-nums"
                  aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-haze">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
