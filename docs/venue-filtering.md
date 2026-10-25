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
`PlanGeneration__MinimumCandidateCount`) defaults to **2** and must be positive. The endpoint
returns 2 or 3 distinct plans (#71), and two plans with different venues need at least two
venues, so a single match gets the clear `insufficient_candidates` response instead of an AI
call that cannot succeed.

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

### Filtering regression suite (#61)

The individual cases in `VenueFilteringServiceTests`, `VenueOpenAtTests` and `GeoDistanceTests`
already cover budget/rounding, free and unknown prices, distance boundaries and invalid inputs,
weekday/overnight/DST hours, multi-activity and compound categories, and transport/unknown capacity.
Issue #61 adds composition coverage instead of copying those individual cases.

`VenueFilteringCombinationTests` uses 16 deterministic venues, one for every pass/fail combination
of the four primary constraints. Broad preferences include all 16. Tightening each dimension
independently distinguishes:

| Dimension | Two venue variants | Broad preference | Tight preference |
| --- | --- | --- | --- |
| Budget | EUR 4 or 14 consumption plus EUR 1 admission | EUR 30 per person | EUR 5 per person |
| Distance | Approximately 0.56 or 5.56 km from an explicit Lleida test origin | 10 km | 1 km |
| Hours | Friday 19:00–22:00 or Friday 23:00–Saturday 02:00, Madrid time | Friday 20:00–Saturday 02:00 | Friday 20:00–22:00 |
| Category | Restaurant or Bar | Dinner OR Drinks | Dinner |

The dataset and expected IDs are shared with `VenueFilteringCombinationPostgresTests`. Expected
membership follows the independently assigned scenario flags, not production filter helpers or
copied price/distance formulas. Each database is isolated, records are inserted in reverse order,
and assertions check exact ordered candidate IDs. The local suite also checks one read query
per filtering call and an empty change tracker.

The parameterized matrix covers all requested combinations:

- All six pairs: budget/distance, budget/hours, budget/category, distance/hours, distance/category,
  hours/category.
- All four triples: budget/distance/hours, budget/distance/category, budget/hours/category,
  distance/hours/category.
- All four primary constraints together.

Additional regressions compare the combined result with the intersection of four independently
filtered sets; relax and re-tighten each preference while keeping the others active; combine all
four with transport selections and group sizes 1–20; and verify that omitting an origin removes
only distance filtering. Other cases combine overnight availability with exact price/distance
boundaries, ensure unknown prices do not disable other filters, and return no matches when the
only otherwise eligible venue is inactive. Capacity thresholds are not invented: the model has
no capacity data, so the suite verifies the documented unknown-capacity behavior.

From the repository root, run the portable suite with **one command**:

```sh
dotnet test backend/LinkUp.sln --filter "(FullyQualifiedName~VenueFiltering|FullyQualifiedName~VenueOpenAtTests|FullyQualifiedName~GeoDistanceTests)&FullyQualifiedName!~Postgres"
```

For coverage, append `--collect:"XPlat Code Coverage;Format=opencover"`. This runs real relational
SQLite queries, with no mocked IQueryable, database server, production data, live AI calls or
location service. .NET restores the existing test dependencies; no new package or CI step is needed.

Run `dotnet test backend/LinkUp.sln` for the full solution, including PostgreSQL integration cases.
Those require the development/test PostgreSQL server described in `backend/README.md`. The existing
SonarQube workflow supplies PostgreSQL 18, runs that solution command with coverage, and discovers
all new tests automatically. PostgreSQL cases insert their scenario rows in a transaction and roll
back per case, in the fixture's temporary database. The portable command selects SQLite/unit tests;
no test is disabled, and every native-provider case remains part of the full CI suite.

SQLite catches unsupported LINQ and exercises decimal/trigonometric query execution, but it does
not enforce PostgreSQL's numeric storage precision/scale and may use different arithmetic/math
implementations. Native PostgreSQL matrix tests therefore remain necessary for production-provider
execution. The pre-existing SQL-translation tests also run locally without a PostgreSQL server.

Measure `VenueFilteringService`, `VenueQueries` and `GeoDistance` separately in OpenCover rather than
using overall project coverage as a proxy. Issue #61 changes only tests/docs: there are no new
executable production lines on which to calculate a new-code coverage percentage. Existing CI
already excludes test files from that metric; no exclusions or gate thresholds are changed.
Report existing filtering coverage separately, and let CI determine the final SonarQube metric.
