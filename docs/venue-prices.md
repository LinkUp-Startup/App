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

## Venue budget filtering (#49)

`VenueFilteringService` applies `VenueQueries.WithinBudget` in the same database query as the
other filters. `BudgetPerPerson` is a required EUR **per-person** amount from 0 to 500. Group
size does not multiply a per-person price or divide this budget. There is no unlimited-budget
sentinel: missing/null budget requests return 400, zero is a real zero budget, and negative
budgets are rejected (also for direct query-helper/service calls).

No remaining-budget ledger or spent-amount input exists. At initial candidate selection the
entire `BudgetPerPerson` is still available. This is the applicable amount for this call; future
planning code can pass preferences with `BudgetPerPerson` set to its remaining per-person amount.
This issue neither calculates prior spending nor estimates the cost of a whole plan.

The following explicit policy uses the known price components without asserting affordability
when information is missing:

- With both spend bounds and an admission fee known, compare
  `EstimatedSpendPerPerson + EntranceFee` with the available budget. Equality qualifies.
- With complete consumption prices but unknown admission, exclude only if the consumption
  estimate alone exceeds the budget. Admission stays unknown, not free.
- With an incomplete/unknown consumption range, exclude if the known admission fee alone
  exceeds the budget. A partial range is still not a complete consumption estimate.
- With neither component known, retain the venue without inventing a price. No monetary value
  is inferred from `PriceLevel` or `EntranceType`. Retention does not guarantee affordability.

Known free venues qualify at zero budget; known positive costs do not. Unknown-price venues may
also remain at zero under this policy. A later plan-cost/validation policy must address their
uncertainty; this filter does not resolve it by silently turning missing amounts into zero.

All arithmetic is decimal and stays database-side. To preserve #47's cent rounding without
calling the unmapped getter or a provider-specific rounding function, the query compares the
unrounded midpoint plus the known fee against the exclusive bound
`Floor(budget * 100) / 100 + 0.005`. For nonnegative, cent-stored prices this is exactly equivalent
to the rounded consumption estimate plus fee being at most the budget: a midpoint exactly at
the half-cent boundary rounds up and is excluded at the lower budget. The half cent is a rounding
boundary, not an additional allowance. Budgets with fractional cents are therefore also compared
correctly. A separate admission-fee check handles unknown consumption. Coalescing an unknown fee
inside the midpoint comparison tests a known-cost lower bound; it does not change stored values.

Lowering only the budget can only keep or remove candidates, never add them. All other eligibility
conditions remain ANDed with this price condition; no filters are relaxed and no fallback is added.

## Plan cost estimation (#48)

`IPlanCostService.Estimate(Plan plan, int groupSize)` is a synchronous, stateless service registered
in dependency injection. It accepts the existing plan entity with its item/venue relationships
already loaded and returns a `PlanCostEstimate` in EUR. It performs no database queries and never
changes the plan, its items, or the venue prices. Callers loading a persisted plan should include
`Items` and then each item's `Venue`; an unloaded/missing venue cannot be priced from its id alone.
An unpopulated item collection cannot be distinguished from a genuinely empty plan by this pure
service; loading the collection is the caller's responsibility.

For every item, the per-person visit estimate is the venue's existing `EstimatedSpendPerPerson`
plus its separate `EntranceFee`. The service sums these item amounts and multiplies the sum by
the supplied group size **once**:

```text
EstimatedCostPerPerson = Sum(venue.EstimatedSpendPerPerson + venue.EntranceFee)
TotalEstimatedCost = EstimatedCostPerPerson × groupSize
```

All monetary calculations use `decimal`. Consumption midpoint rounding remains exactly #47's
cent rounding on the venue getter. The estimator adds no further rounding to the item sum or group
multiplication. For example, three fully priced items at EUR 12.50, 20.00 and 9.50 per person give
EUR 42.00 per person and EUR 168.00 for four participants. Known zero amounts contribute zero.

`GroupSize` comes from preferences when used in a request; the current request range is 1–20.
The reusable arithmetic service requires a positive integer, without inventing another upper
capacity limit. Zero/negative group sizes throw `ArgumentOutOfRangeException`. Null plans, null
item lists and null item entries are invalid arguments. Negative prices and inverted spend ranges
on in-memory venues are rejected instead of producing misleading totals, matching the model's
existing persistence rules. Ordinary decimal overflow is not suppressed or replaced with a total.

### Complete and incomplete results

- All items have a loaded venue, both spend bounds and a known admission fee: return numeric
  `EstimatedCostPerPerson` and `TotalEstimatedCost`, `IsComplete = true`, and `UnpricedItemCount = 0`.
- Any item lacks a venue reference or either price component: return **null for both amounts**,
  `IsComplete = false`, and the number of unpriced items. A partial range is not a consumption
  estimate. Neither `EntranceType.Free` nor `PriceLevel` substitutes for missing numeric prices.
- An empty plan or a plan with only fully known free items has a **complete zero** estimate. This
  is different from unknown pricing. Estimating an empty plan does not make it a valid itinerary.

No partial subtotal is presented as a complete cost. An item with several missing components counts
as one unpriced item. Every supplied plan-item occurrence is counted; repeat visits to the same
venue are not deduplicated. Itinerary structure/eligibility remains the responsibility of existing
planning validation. Cached `Plan.EstimatedCostPerPerson` and `PlanItem.EstimatedCostPerPerson` are
not trusted as source prices and are not overwritten.

This policy intentionally differs from #49's permissive candidate filter: an unknown cost may be
retained as a candidate, but does not establish a complete plan total. Budget validation (#50) and
app price display (#51) can consume the result and `IsComplete` without repeating the arithmetic;
neither behavior is implemented here. No schema, request, or response fields are changed.

Generated plans use this service (`Planning/PlanPricing.cs`, for both the AI and the stub plans).
Policy for incomplete estimates in the response: `PlanItemDto.EstimatedCostPerPerson` is the stop's
own estimate, null when that venue is unpriced, and `PlanDto.EstimatedCostPerPerson` /
`EstimatedTotalCost` (the group) are null as soon as any stop is unpriced. A null is never turned
back into zero. The app shows such a cost as "price unknown"; the price design itself is #51.

Run its unit tests without a database server or AI calls:

```sh
dotnet test backend/LinkUp.sln --filter FullyQualifiedName~PlanCostServiceTests --collect:"XPlat Code Coverage;Format=opencover"
```

## Future budget work and limitations

The numeric per-person consumption estimate and separate admission amount provide inputs for
plan cost estimation (#48), future validation (#50), and app display (#51).
The latter features must choose their policies for consuming complete/incomplete estimates.
No whole-plan budget validation, currency conversion,
or new price UI is implemented here. Group discounts, fixed booking charges and verified observed
averages are not represented by the source data.

EF Core cannot translate the ordinary `EstimatedSpendPerPerson` getter in a database predicate.
Database filters compose supported expressions over the stored decimal fields;
they must not load all venues to evaluate the getter. Unknown prices must remain distinguishable
from free venues in any future budget policy.

Tests verify entity estimates, nulls/zero, cent rounding, persistence and DTO mappings using
SQLite, and PostgreSQL metadata/migration SQL generation without connecting to a server. Dedicated
PostgreSQL tests verify native numeric scale and constraints in CI. SQLite does not enforce
PostgreSQL's numeric precision/scale and does not substitute for that native-provider check.
Budget tests additionally verify zero, exact/half-cent boundaries, unknown components, monotonic
candidate sets, per-person group semantics, and composition through the service on SQLite.
PostgreSQL budget tests verify native query execution in CI; SQL translation is tested locally
without requiring a server.
