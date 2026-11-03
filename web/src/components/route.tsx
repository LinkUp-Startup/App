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

/**
 * The night as a route: times on the left, a line connecting the stops, and how far it is to walk between them.
 * This is the one visual idea of the site, used for shared plans and the example on the home page.
 */
export function Route({
  stops,
  withDirections = true,
}: {
  stops: RouteStop[];
  withDirections?: boolean;
}) {
  return (
    <ol className="relative">
      {stops.map((stop, index) => {
        const last = index === stops.length - 1;
        return (
          <li
            key={`${stop.name}-${stop.startTime}`}
            className="grid grid-cols-[4.5rem_1.75rem_1fr] sm:grid-cols-[6rem_2rem_1fr]">
            {index > 0 && stop.distanceKm > 0 && (
              <>
                <span />
                <span className="flex justify-center">
                  <span className="w-0.5 bg-violet/40" />
                </span>
                <p className="pb-4 text-sm text-haze">{formatKm(stop.distanceKm)} to here</p>
              </>
            )}

            <div className="pt-0.5 text-right">
              <time
                dateTime={stop.startTime}
                className="font-display text-2xl font-semibold tabular-nums leading-none text-sodium sm:text-3xl">
                {formatTime(stop.startTime)}
              </time>
              <p className="mt-1.5 font-display text-xs text-haze tabular-nums">
                until {formatTime(stop.endTime)}
              </p>
            </div>

            <span className="relative flex justify-center" aria-hidden="true">
              <span className="relative z-10 mt-1.5 size-3.5 rounded-full border-[3px] border-violet bg-night" />
              {!last && <span className="absolute top-1.5 bottom-0 w-0.5 bg-violet/40" />}
            </span>

            <div className={last ? 'pb-0' : 'pb-6'}>
              <h3 className="font-display text-xl font-semibold leading-tight sm:text-2xl">
                {stop.name}
              </h3>
              <p className="mt-1 text-sm text-haze">
                {activityLabel(stop.activity)}, {stop.address}
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
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
                    className="font-bold text-violet underline decoration-violet/40 underline-offset-4 hover:decoration-violet">
                    Directions
                  </a>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
