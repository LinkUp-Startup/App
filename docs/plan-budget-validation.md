# Generated-plan budget validation (#50)

Every successful AI or development-stub plan must have a complete EUR estimate from
`IPlanCostService` (#48) and satisfy:

```text
estimate.TotalEstimatedCost <= preferences.BudgetPerPerson × preferences.GroupSize
```

`BudgetPerPerson` is the existing **per-person** budget, not a group budget. The estimator already
multiplies the summed per-person venue costs by group size once; the budget is scaled once to
the same group basis. The estimate is not multiplied again. For example, EUR 20 per person for
three people permits a EUR 60 group estimate. A EUR 45-per-person plan costs EUR 135 for three
people and fails a EUR 33.33-per-person budget (EUR 99.99 total, approximately EUR 100). Supplying
`BudgetPerPerson = 100` means EUR 100 **each**, not EUR 100 for the whole group. No group-budget
request field or remaining-spend ledger is introduced.

## Canonical prices and completeness

The existing #48 estimator uses each loaded venue's cent-rounded `EstimatedSpendPerPerson` plus
its `EntranceFee`, all `decimal` and EUR, then sums and multiplies by group size. It ignores cached
plan/item costs and AI-provided amounts. Empty arithmetic inputs give a zero estimate, but the
plan validator still rejects generated plans with no valid stops.

The estimator's aggregate/unknown policy is preserved. If any item lacks either price component
or its loaded venue, the estimate is incomplete (`IsComplete = false`, null amounts, and an
unpriced-item count). Such a generated plan is rejected, even at a zero budget. Because of that,
`POST /api/plans/generate` leaves unpriced venues out of the candidates before the AI sees them (a
request that only matches unpriced venues gets `422 no_candidates`), so no AI tokens go to plans that
could never be returned; missing amounts
are never replaced with free prices or guessed from price level. A fully known free plan is
valid at zero. Missing/null/negative request budgets still return validation errors (400).
Direct generation calls also reject negative budgets and nonpositive groups before calling AI.

The estimator now exposes its already-calculated, read-only `ItemCostsPerPerson` in input order,
including nulls for unpriced items. This is calculation output, not a new venue price model or
HTTP field. Response mapping uses these values and the aggregate estimate without another
calculation. The legacy `PlanValidator.EstimateCost` placeholder has been removed, including its
unknown-as-zero and midpoint-to-even assumptions. The monetary policy remains #47's per-venue
midpoint rounded away from zero; budget comparisons add no rounding or tolerance.

## AI generation and retries

1. Existing validation repairs time windows and removes invalid, closed, overlapping or repeated
   stops, as before. Candidate membership remains mandatory.
2. The final repaired stop list is priced once through #48, with already loaded candidate venues.
3. Unknown costs or a group total above the available group budget reject the **whole plan**.
   Equality qualifies. No stops are silently removed merely to make a plan affordable.
4. Only priced, affordable plans count toward the existing two-plan minimum. Valid distinct plans
   from the first attempt are retained, and the existing AI loop retries when necessary.
5. Every regenerated alternative is priced and checked again. The existing limit remains
   `AiPlanService.MaxAttempts = 2`, sharing the same deadline and cancellation behavior.

Budget correctness does not depend on the prompt. When retries are exhausted after cost failures,
`PlanBudgetException` yields existing HTTP status 502 with `application/problem+json`, the title
`Couldn't generate plans within your budget.`, and a safe explanation suggesting different
activities or a higher budget. No rejected plans are included. Other AI failures retain their
existing generic 502 response. The app's current error UI is unchanged.

The no-key `StubPlanService` uses the same cost check. It skips unpriced/expensive candidates and
selects up to the existing two single-venue plans from the remaining candidates. If none is
fully priced and affordable it returns the same structured budget failure, rather than a 200
with unverified prices. The existing candidate-count guard (422) is unchanged. `IPlanService`'s
contract requires every successful implementation to enforce this budget guarantee.

All checks are synchronous arithmetic on already materialized venues. No database queries,
additional pricing formulas, migrations, budget relaxation, API fields, or frontend displays are
added. Venue filtering (#49) remains a separate preliminary check: individually affordable venues
may still make an unaffordable whole plan, and retained unknown-price venues cannot form verified
plans until their prices are known.

## Dependencies and verification

This feature depends on #48's `IPlanCostService`, registered in `Program.cs`. Its original aggregate
calculation and incomplete-result semantics are retained; already-calculated item prices are also
exposed so mapping does not duplicate that calculation.

Unit and HTTP tests use deterministic AI fakes: exact/below/above budgets, combined affordable
venues, zero/free/unknown prices, cent boundaries, group totals, retained/retried alternatives,
exhausted retries, and both AI/no-key success paths. Estimator spies verify the actual group size
and one call per complete candidate plan. Existing structural/filter tests retain their assertions;
their generic eligible fixtures now supply explicit known-zero prices. Separate unknown-price
tests exercise the new rejection policy.

```sh
dotnet test backend/LinkUp.sln --filter "FullyQualifiedName~AiPlanServiceTests|FullyQualifiedName~PlanBudgetEndpointTests|FullyQualifiedName~StubPlanBudgetTests|FullyQualifiedName~PlanValidatorTests|FullyQualifiedName~PlanCostServiceTests" --collect:"XPlat Code Coverage;Format=opencover"
```

These tests need neither PostgreSQL nor a live AI key. The full existing solution suite also has
native PostgreSQL fixtures, supplied automatically in CI. SonarQube imports the existing OpenCover
reports; local diff coverage is reported separately from its final PR new-code metric.
