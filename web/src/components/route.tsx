import { activityLabel, directionsUrl, formatEuros, formatKm, formatTime } from '@/lib/format';

export type RouteStop = {
  name: string;
  activity: string;
  address: string;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  costPerPerson: number | null;
  // From the previous stop; 0 or less for the first stop when there is no start point.
  distanceKm: number;
};

// Ticket colours alternate so neighbouring stops stay apart.
const paper = ['bg-butter', 'bg-coral'];
// On the home page the tickets lie a little scattered, as if just handed out.
const scattered = ['', 'sm:ml-10', 'sm:ml-4'];

/**
 * The night as a stack of tickets: the time on the stub, the place on the ticket, and how far it is to the next.
 * This is the one visual idea of the site, used for shared plans and the example on the home page.
 */
export function Route({
  stops,
  withDirections = true,
  tilted = false,
}: {
  stops: RouteStop[];
  withDirections?: boolean;
  tilted?: boolean;
}) {
  return (
    <ol className={tilted ? 'deal sm:-rotate-2' : undefined}>
      {stops.map((stop, index) => (
        <li
          key={`${stop.name}-${stop.startTime}`}
          className={tilted ? scattered[index % scattered.length] : undefined}>
          {index > 0 && stop.distanceKm > 0 && (
            <p className="py-2 pl-24 text-sm text-mauve sm:pl-32">
              {formatKm(stop.distanceKm)} to here
            </p>
          )}
          {index > 0 && stop.distanceKm <= 0 && <div className="h-3" />}

          <article
            className={`relative grid grid-cols-[5.5rem_1fr] rounded-xl text-wine sm:grid-cols-[7.5rem_1fr] ${paper[index % paper.length]}`}>
            {/* The perforation: a dashed line with a notch bitten out at each end. */}
            <span
              aria-hidden="true"
              className="absolute -top-2.5 left-[calc(5.5rem-0.625rem)] size-5 rounded-full bg-wine sm:left-[calc(7.5rem-0.625rem)]"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-2.5 left-[calc(5.5rem-0.625rem)] size-5 rounded-full bg-wine sm:left-[calc(7.5rem-0.625rem)]"
            />

            <div className="border-r-[3px] border-dashed border-wine/60 px-2 py-5 text-center">
              <time
                dateTime={stop.startTime}
                className="block font-display text-3xl leading-none font-black tabular-nums sm:text-4xl">
                {formatTime(stop.startTime)}
              </time>
              <p className="mt-1.5 text-xs font-bold tabular-nums opacity-75">
                until {formatTime(stop.endTime)}
              </p>
            </div>

            <div className="min-w-0 px-4 py-4 sm:px-5">
              <h3 className="font-display text-2xl leading-none font-black uppercase sm:text-3xl">
                {stop.name}
              </h3>
              <p className="mt-1.5 text-sm font-medium">
                {activityLabel(stop.activity)}, {stop.address}
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm font-bold">
                <span>
                  {stop.costPerPerson === null
                    ? 'Price not known'
                    : `About ${formatEuros(stop.costPerPerson)} per person`}
                </span>
                {withDirections && (
                  <a
                    href={directionsUrl(stop.latitude, stop.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Directions to ${stop.name} (opens Google Maps)`}
                    className="underline decoration-2 underline-offset-4 hover:decoration-wine/50 focus-visible:outline-wine">
                    Directions
                  </a>
                )}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
