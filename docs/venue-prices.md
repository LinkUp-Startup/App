# Venue price model (issue #47)

All venue monetary amounts are **EUR per person**, represented by nullable C# `decimal` values.
The existing dataset provides a typical consumption range and an independent admission fee;
keeping these inputs preserves their meaning instead of inventing a single all-inclusive price.

## Fields

| Venue field | Meaning |
| --- | --- |
| `MinSpend`, `MaxSpend` | Lower/upper typical spend when consuming food or drinks, excluding admission. Either bound may be unknown (`null`). Equal bounds describe a single estimated amount. |
| `EstimatedSpendPerPerson` | Derived midpoint `(MinSpend + MaxSpend) / 2`, rounded to two decimal places using `MidpointRounding.AwayFromZero`. Returns `null` unless both bounds are known. It is an estimate, not an observed average or a minimum purchase requirement. |
| `EntranceFee` | Separate admission fee per person. `null` means unknown/event-dependent; zero is a known free admission amount. `EntranceType` continues to describe free, paid, event-dependent or unverified admission. |
| `PriceLevel` | Optional coarse consumption-price label, from 1 (cheapest) to 4 (most expensive); `null` means no known label. It is not a monetary amount or a substitute for missing numeric data. |
| `Currency` | Always `"EUR"`. This is a read-only domain/API value, not a configurable currency or a stored column. |

The estimate is derived on the entity, not stored separately, so it cannot become stale after
range changes. `VenueDetailsDto` exposes the range, fee, optional level, estimate and currency.
Existing plan response amounts and the app's price presentation are unchanged.

### Unknown versus free

Unknown money is `null`, never an implicit zero. A new venue can have all price fields and its
price level unset. A partial range does not produce an estimate. A zero consumption range
produces a known zero consumption estimate; it does **not** establish free admission. Likewise,
free admission does not imply food/drinks are free. Unknown admission does not erase an otherwise
known consumption estimate, because the two components are independent. No attempt is made to
infer a total visit price from `EntranceType`, notes or the price level.

## Existing price levels

The seed importer already uses the following thresholds, based on the **unrounded** consumption
range midpoint. Issue #47 preserves them rather than adding new price bands:

| Level | Midpoint in EUR per person |
| --- | --- |
| 1 | Up to and including 10 |
| 2 | Above 10, up to and including 20 |
| 3 | Above 20, up to and including 35 |
| 4 | Above 35 |

The seed importer derives the level using `VenueSeedData.PriceLevelFor`. Arbitrary entity edits
do not automatically update the stored label. Writers should derive it using the same rule when
a complete range is available; if the label is unknown, leave it null. The cent-rounded estimate
is for monetary use; rounding must not move a venue into another level. A separately known label
can coexist with incomplete numeric prices and still does not imply an exact EUR value.

## Validation and persistence

PostgreSQL stores `EntranceFee`, `MinSpend` and `MaxSpend` as nullable `numeric(8,2)`: six integer
digits and two fractional digits, supporting known amounts from 0 to 999,999.99 EUR. Monetary
arithmetic uses `decimal`, never floating-point values. PostgreSQL rounds excess fractional digits
to its two-decimal storage scale; inputs should normally already use cents. The derived estimate
rounds half-cent midpoints away from zero, matching the convention for nonnegative numeric prices.

Database check constraints enforce nonnegative known fees and spend bounds, `MinSpend <= MaxSpend`
when both are known, and a level of 1–4 when present. Nullable values remain allowed. As with the
existing venue validation, these are persistence constraints: entity setters alone do not reject
invalid temporary values. There is no venue-write API in scope.

`DefineVenuePriceModel` makes `PriceLevel` nullable and adds the two missing nonnegative-spend
constraints. It preserves existing columns, values and seeded prices, with no price backfill or
misleading defaults. Existing invalid negative spend data, if manually inserted under the old
schema, must be reviewed before applying the constraints; migration deliberately fails rather
than silently changing it. `Currency` and `EstimatedSpendPerPerson` are explicitly not mapped.
Rollback requires all price labels to be known before restoring the old NOT NULL column; it does
not fabricate a level such as 0 or 1 for unknown prices.

## Future budget work and limitations

The numeric per-person consumption estimate and separate admission amount provide inputs for
future plan estimates (#48), budget filters (#49), validation (#50), and app display (#51).
Those features must choose how to combine fees/consumption, handle unknown components, and apply
group size. No group-total calculation, price filtering, budget validation, currency conversion,
or new price UI is implemented here. Group discounts, fixed booking charges and verified observed
averages are not represented by the source data.

EF Core cannot translate the ordinary `EstimatedSpendPerPerson` getter in a database predicate.
Future database filters should compose supported expressions over the stored decimal fields;
they must not load all venues to evaluate the getter. Unknown prices must remain distinguishable
from free venues in any future budget policy.

Tests verify entity estimates, nulls/zero, cent rounding, persistence and DTO mappings using
SQLite, and PostgreSQL metadata/migration SQL generation without connecting to a server. Dedicated
PostgreSQL tests verify native numeric scale and constraints in CI. SQLite does not enforce
PostgreSQL's numeric precision/scale and does not substitute for that native-provider check.
