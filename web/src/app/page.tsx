import { buttonClass } from '@/components/button';
import { Route } from '@/components/route';
import { exampleNight } from '@/lib/example-night';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

// What the group asked for. The example night above is one of the plans LinkUp could make from it.
const request = ['4 of us', '€40 each', 'from 20:30', 'on foot', 'dinner, drinks, a club'];

const steps = [
  {
    title: "Say what you're up for",
    text: 'Your budget, how many of you there are, when you start, how you get around and the kind of night.',
  },
  {
    title: 'Pick a plan',
    text: 'You get two or three complete nights, each with every stop, its time, the price per person and the distance to the next.',
  },
  {
    title: 'Send it to your friends',
    text: 'Share a link. Your friends open the plan in their browser, no app needed.',
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader
        account={
          <a
            href="#app"
            className="text-sm font-bold text-butter underline decoration-butter/40 underline-offset-4 hover:decoration-butter">
            Get the app
          </a>
        }
      />
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid items-center gap-16 pt-12 sm:pt-16 lg:grid-cols-[1fr_30rem] lg:gap-20">
          <div>
            <h1 className="font-display text-[clamp(4rem,12vw,9rem)] leading-none font-black text-butter uppercase">
              Your whole night, planned.
            </h1>
            <p className="mt-8 max-w-[30rem] text-lg leading-relaxed text-mauve">
              Tell LinkUp what your group wants. You get the whole night out in Lleida, stop by
              stop, with real places, times and prices.
            </p>
          </div>

          <figure>
            <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-display text-2xl font-black uppercase">
                An example Friday night
              </span>
              <span className="text-sm text-mauve">€38 each, 3.5 km</span>
            </figcaption>
            <Route stops={exampleNight} withDirections={false} tilted />
          </figure>
        </section>

        <section
          aria-labelledby="ask"
          className="mt-20 flex flex-col gap-4 sm:mt-24 sm:flex-row sm:items-center sm:gap-6">
          <h2 id="ask" className="shrink-0 text-mauve">
            That night came from
          </h2>
          <ul className="flex flex-wrap gap-2" aria-label="What the group asked for">
            {request.map((item) => (
              <li
                key={item}
                className="rounded-full border-2 border-mauve/50 px-4 py-1.5 text-sm font-medium">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how" className="mt-24 sm:mt-32">
          <h2
            id="how"
            className="font-display text-5xl leading-none font-black text-butter uppercase sm:text-6xl">
            How it works
          </h2>
          <ol className="mt-10 grid sm:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="border-dashed border-plum py-6 not-first:border-t-[3px] sm:px-8 sm:py-2 sm:first:pl-0 sm:not-first:border-t-0 sm:not-first:border-l-[3px]">
                <p className="font-display text-xl font-black text-coral">Step {index + 1}</p>
                <h3 className="mt-1 font-display text-3xl leading-none font-black uppercase">
                  {step.title}
                </h3>
                <p className="mt-3 leading-relaxed text-mauve">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="app"
          aria-labelledby="app-title"
          className="mt-24 flex flex-col gap-8 rounded-3xl bg-plum p-8 sm:mt-32 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2
              id="app-title"
              className="font-display text-5xl leading-[0.9] font-black text-butter uppercase sm:text-6xl">
              Coming to <span className="normal-case">iOS</span> and Android
            </h2>
            <p className="mt-4 max-w-[30rem] leading-relaxed text-mauve">
              The app is in testing with a small group. Follow the project on GitHub to see when
              it&apos;s out.
            </p>
          </div>
          <a
            href="https://github.com/LinkUp-Startup/App"
            className={`${buttonClass} shrink-0 self-start lg:self-center`}>
            Follow LinkUp on GitHub
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
