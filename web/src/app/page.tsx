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

// What the group asked for. The example night above is one of the plans LinkUp could make from it.
const request = ['4 of us', '€40 each', 'from 20:30', 'on foot', 'dinner, drinks, a club'];

const steps = [
  {
    title: "Say what you're up for",
    text: 'Your budget, how many of you there are, when you start, how you get around and the kind of night.',
  },
  {
    title: 'Pick a plan',
    text: 'You get two or three complete nights, each with every stop, its time, the price per person and the walk to the next.',
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
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid items-center gap-14 pt-12 sm:pt-20 lg:grid-cols-[1fr_28rem] lg:gap-20">
          <div>
            <h1 className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] font-extrabold tracking-[-0.035em] text-balance">
              Plan the whole night in one go.
            </h1>
            <p className="mt-7 max-w-[32rem] text-lg leading-relaxed text-haze">
              Tell LinkUp what your group wants. It puts together complete nights out in Lleida,
              with real places, times and prices.
            </p>

            <div className="mt-10 max-w-[32rem] border-l-2 border-violet/40 pl-5">
              <p className="text-sm text-haze">A group asked for</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="What the group asked for">
                {request.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-violet/50 bg-dusk px-3.5 py-1.5 text-sm text-lavender">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-haze">
                One of the plans they got back: €38 each, 3.5 km on foot.
              </p>
            </div>
          </div>

          <figure className="streetlight relative rounded-[2rem] bg-dusk p-6 ring-1 ring-violet/20 sm:p-8">
            <figcaption className="mb-7 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="font-display text-lg font-semibold">An example Friday night</span>
              <span className="shrink-0 text-sm whitespace-nowrap text-haze tabular-nums">
                20:30 to 04:00
              </span>
            </figcaption>
            <div className="route-intro">
              <Route stops={exampleNight} withDirections={false} />
            </div>
          </figure>
        </section>

        <section aria-labelledby="how" className="mt-24 sm:mt-32">
          <h2 id="how" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative pl-10 sm:pl-0">
                {/* The route line again, from this step to the next. */}
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 -bottom-10 left-[0.4375rem] w-0.5 bg-violet/40 sm:top-[0.4375rem] sm:-right-10 sm:bottom-auto sm:left-2 sm:h-0.5 sm:w-auto"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 z-10 block size-3.5 rounded-full border-[3px] border-violet bg-night sm:relative"
                />
                <h3 className="font-display text-xl font-semibold sm:mt-6">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] leading-relaxed text-haze">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
