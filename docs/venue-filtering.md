# Venue filtering rules

`VenueFilteringService.FilterAsync` accepts `NightPreferencesDto`. The rules below describe
the implemented candidate filtering, including issue #60's resource and group-size limits.

## Resources and transport

The resource checklist is `NightPreferencesDto.Transport`; there is no separate resource model.
At least one recognized transport option is required, consistent with the preference form and
the DTO's minimum-length validation. Missing, empty, or entirely unknown transport selections
produce no candidates when the service is called directly. The HTTP layer validates requests
separately. No implicit walking or car access is inferred.

| Selection | Implemented effect |
| --- | --- |
| Walking | Satisfies the transport requirement; no walking radius is defined. |
| Bike | Satisfies the transport requirement; no cycling radius or bike-access data exists. |
| Car | Satisfies the transport requirement; no car radius or parking data exists. |
| PublicTransport | Satisfies the transport requirement; no route, stop or timetable data exists. |
| Taxi | Satisfies the transport requirement; no taxi-specific radius or vehicle capacity exists. |

Multiple selections use OR: any recognized mode suffices. Duplicates do not change results.
Unknown enum values do not establish transport availability, but do not invalidate a recognized
mode selected alongside them. Selecting a car does not bypass any other filter. Not selecting
a car does not currently impose an additional numeric distance limit.

## Maximum distance (#54) and the start-location dependency (#53)

`MaxDistanceKm` is the user's distance preference (validated from 0.5 to 30 km).
`Venue` stores latitude/longitude in degrees. The origin-aware overload
`IVenueFilteringService.FilterAsync(preferences, startLatitude, startLongitude, cancellationToken)`
filters on great-circle Haversine distance from that same start point to each venue, in kilometres.
It uses `GeoDistance` from #52, including its 6371 km Earth radius and antipodal rounding clamp.
This is straight-line distance, not walking/driving distance, distance between consecutive stops,
or a total itinerary length. Transport selection does not scale or override the user's radius.

Distance must be at most `MaxDistanceKm`; equality qualifies with no added tolerance or implicit
radius expansion. Lowering the maximum can only keep/remove candidates, and increasing it can
only keep/add candidates with respect to distance. The service/query helper supports a zero
radius for a venue at the exact start coordinates. The existing HTTP form/DTO still validates
0.5–30 km; this issue does not change that API contract. Missing/null maximum-distance requests
remain 400 validation errors, not unrestricted or zero-radius requests.

The origin-aware call rejects out-of-range/non-finite start coordinates and negative, NaN, or
infinite radii before a database query. Stored venue coordinates are non-nullable and range
constrained. The distance predicate also excludes coordinates outside the valid ranges. There
is no missing-location sentinel: zero latitude/longitude is a real coordinate, not an inferred
origin or a missing-value marker. Truly missing coordinates cannot be stored under this schema.

`GeoDistance.HaversineKmExpression` is the single formula used by the existing validated C# helper
and by the database predicate. An opaque call to the original C# method cannot translate into SQL;
instead, EF expands the shared expression and translates its Math operations to PostgreSQL
trigonometric functions. The calculation is combined with existing filters before asynchronous
materialization, with one database query and no client-side distance filtering or N+1 queries.
Ordinary helper calls compile the same expression once and retain coordinate validation. Tests
exercise SQLite SQL execution as well as PostgreSQL translation and native-provider CI execution.

**#53 integration is still blocked:** preferences, the app and controllers currently supply no
starting coordinates and there is no location provider to reuse. The existing two-argument service
call therefore preserves earlier filtering without a distance restriction. The production HTTP
flow still uses that call, so changing the app's maximum distance cannot affect its results until
#53 supplies a validated origin and calls the origin-aware overload. No city centre, `(0, 0)`,
or venue is substituted as a default. This issue implements the independently testable filtering
capability; it does not implement GPS/manual location acquisition, new request fields or UI wiring.

## Group size and unknown capacity

`GroupSize` is validated from 1 to 20 people. That range is an input limit, **not venue capacity**.
Neither the venue entity nor the seed data contains capacity or supported party-size information.
All venues therefore have unknown capacity for filtering purposes. Otherwise eligible venues
remain included for every valid group size, including a single person and a group of 20.

**Capacity filtering is not implemented** because there are no capacities to compare. Tests for
smaller-than, equal-to and greater-than capacity cannot be meaningful until capacity data exists.
A future capacity rule requires a defined capacity field and its meaning; equality and unknown
capacity behavior should then be specified. No capacity is inferred from venue category, price,
tags, notes, transport modes, or vehicle seating.

## Combining filters and incomplete data

All currently applicable constraints are ANDed in one EF Core query: active venue, positive
opening-hours overlap, category matching at least one selected activity, at least one
recognized transport mode, and known venue costs within the per-person budget (see
[venue-prices.md](venue-prices.md#venue-budget-filtering-49) for the unknown-price and rounding rules).
When the caller supplies an origin, maximum-distance eligibility is ANDed into that same query.
Results include opening hours, are ordered by venue id, and are
loaded asynchronously without tracking or intermediate venue materialization.

Opening hours use Madrid time, include overnight slots, and handle daylight-saving transitions.
Only positive overlap counts; merely touching an opening or closing boundary does not match.
Missing hours are closed. Activity matching uses OR: Dinner matches Restaurant/BarRestaurant;
Drinks matches Bar/Pub/BarRestaurant/Cafe/BakeryCafe; Club matches Nightclub. Other activities
have no mapped categories. Missing activities or unknown stored categories do not match.

Capacity, parking and transit access are absent from the model and do not exclude venues.
Coordinates are non-nullable with database range constraints, but cannot distinguish an omitted
value from a legitimate zero coordinate; `(0, 0)` is not treated as a missing-location sentinel.
Coordinates measure straight-line distance only when an origin is supplied; absent access metadata
is not used to infer transport accessibility. Free-text `Notes`
are not interpreted as machine-readable resource or capacity rules. There is no fallback,
candidate-count adjustment, or recommendation logic.

## Verification

### No or insufficient candidates (#62)

`POST /api/plans/generate` calls the existing filtering service once before invoking the plan
generator. It uses the count of the filtered list, not a second database query or the raw venue
count. It does not relax preferences or insert fallback venues.

`PlanGeneration:MinimumCandidateCount` (environment variable
`PlanGeneration__MinimumCandidateCount`) defaults to **1** and must be positive. The current
`StubPlanService` returns a one-stop plan, and there is no requirement for more venues. This
default is an explicit assumption based on the current implementation, not a requirement for
future AI plans. A future generator's agreed minimum can be configured centrally. There is no
positive insufficient count at the default minimum; tests configure 3 to exercise that case.

| Filtered count | HTTP response | Code | Generation |
| --- | --- | --- | --- |
| Zero | 422 `application/problem+json` | `no_candidates` | Not called |
| Positive but below minimum | 422 `application/problem+json` | `insufficient_candidates` | Not called |
| At least minimum | Existing 200 `{ "plans": [...] }` | No change to success shape | Called once |

Both expected 422 problems include `status`, `title`, `detail`, `code`, `candidateCount`,
`minimumRequired`, and `suggestion`. Detail distinguishes zero matches from too few and the
insufficient case includes both counts. The suggestion recommends different activities, a wider
time window, or checking transport selection, which affect the implemented filters. Invalid
requests still return validation errors (400) before filtering or generation.

The app recognizes these problem codes in `describeApiError` and displays the explanation and
suggestion in its existing results error panel. The existing **Change preferences** button
returns to the form; the app does not automatically retry, alter preferences, or treat a 422 as
an unexpected server failure. Unknown or malformed responses retain the existing generic message.

The generator is still the existing placeholder: this issue adds the pre-generation candidate
guard, not candidate-aware AI generation. The success payload and stub implementation are
unchanged. Capacity and distance limitations documented above still apply.

### Test commands

Service tests in `backend/tests/LinkUp.Api.Tests/VenueFilteringServiceTests.cs` exercise each
transport mode, combinations, duplicates, missing/unknown transport, unknown capacities across
valid group sizes, unchanged eligibility without an origin, and composition with existing filters
using SQLite. CI collects OpenCover using:

```sh
dotnet test backend/LinkUp.sln --collect:"XPlat Code Coverage;Format=opencover"
```

The full existing integration suite requires PostgreSQL. SonarQube's final new-code coverage
must be verified in CI; local OpenCover measurements do not replace its branch/base comparison.
Distance tests additionally cover changing radii, exact/zero boundaries, date-line crossing,
invalid origins/radii, missing maximum-distance requests, and composition with all current filters.
`VenueDistancePostgresTests` executes the origin-aware service against the native provider in CI.
