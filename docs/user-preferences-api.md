# Preferences API (#180)

`GET /api/users/me/preferences` reads the signed-in user's saved defaults.
`PUT /api/users/me/preferences` replaces them and returns the persisted values.
Both return `200 OK` with the five preference fields, without account details.

Send `Authorization: Bearer <accessToken>`, using the existing login/register
token. `[Authorize]` validates the JWT through the existing authentication setup;
the controller reads its `sub` claim as the account GUID. Neither endpoint accepts
a target user ID. Query/body fields cannot select another account. Missing,
invalid, missing-subject, or malformed-subject tokens return `401`, as do tokens
whose account has been deleted. Authentication responses use existing conventions.

## Request and response

Example PUT body, and its `200` response:

```json
{
  "budgetPerPerson": 25.75,
  "groupSize": 4,
  "activities": ["dinner", "drinks"],
  "maxDistanceKm": 5.5,
  "transport": ["walking", "publicTransport"]
}
```

Budget is EUR per participant, group size is the participant count, and distance
is kilometres. Activities and transport reuse the existing planning enums.
PostgreSQL rounds stored budgets to cents; the PUT response reads the persisted
values, so `25.755` returns `25.76`, consistently with later GET requests.

PUT is a full replacement, following the existing saved-plan PUT convention.
Omitted and explicitly null fields both clear the corresponding default. To
change one field while preserving the others, send the current values of those
other fields too. An empty object clears all defaults. For example,
`{"budgetPerPerson":0}` saves a zero budget and clears the other four defaults.
This does not modify the user's email, name, password, or saved plans.

A new account, or an account after `PUT {}`, gets this GET response:

```json
{
  "budgetPerPerson": null,
  "groupSize": null,
  "activities": null,
  "maxDistanceKm": null,
  "transport": null
}
```

Null scalars mean unspecified; zero budget means a free plan. Null selections
clear a preference. Supplied empty arrays are invalid, matching plan-request
selection validation. Existing null/empty collections saved through #179 remain
readable without inventing a selected mode or activity.

## Shared validation

The saved-default request and `NightPreferencesDto` share range constants and
`PreferenceRules.ValidateSelections`. Their supplied-value rules are the same:

| Field | Rule |
| --- | --- |
| `budgetPerPerson` | Decimal EUR value, inclusive 0–500 |
| `groupSize` | Integer, inclusive 1–20 |
| `maxDistanceKm` | Finite number, inclusive 0.5–30 |
| `activities` | At least one supported `Activity`, without duplicates |
| `transport` | At least one supported `Transport`, without duplicates |

Saved defaults allow null/missing fields; a complete plan request continues to
require its numeric fields, selections, and time window. Its duration, notes,
location, and required-field validation remain in place. Numeric strings are
still rejected by the existing strict JSON number configuration.

Two validation gaps found while testing parity are fixed for both endpoints:
budget ranges now validate as decimals, so fractional amounts such as `-0.01`
and `500.01` cannot pass through integer rounding; undefined numeric enum values
are rejected as unsupported, as unknown enum strings already were. Supported
transport combinations are not restricted further and no capacity rules are added.

Invalid requests return the existing `400 application/problem+json`
`ValidationProblemDetails` format with field errors. Model binding and validation
finish before the action calls the service, so invalid requests make no partial
updates. For example, a negative budget produces an error under `BudgetPerPerson`.

## Persistence and scope

The scoped `IUserPreferencesService`/`UserPreferencesService` uses the existing
`AppDbContext.Users` and #179 fields. GET projects only preference columns without
tracking. PUT loads the authenticated account once, updates its five fields,
calls `SaveChangesAsync`, then projects the actual saved values for the response.
All operations are asynchronous and accept cancellation. No new schema or migration
is needed; no shared or production database is migrated by verification.

The generated OpenAPI document and TypeScript contract expose these endpoints.
The app screen (#181) can use their nullable values and PUT replacement semantics.
Plan prefilling and merging defaults with explicitly entered values (#182) remain
future work. There is no automatic default loading in plan generation and no
frontend behavior change. Broader end-to-end feature testing belongs to #183.

## Verification

```powershell
dotnet build backend/LinkUp.sln
dotnet test backend/LinkUp.sln --no-build --collect:"XPlat Code Coverage;Format=opencover"
cd app
npm run generate:api
```

The API integration tests use the existing `AuthApiFactory`: real registration
tokens, HTTP requests, and disposable migrated PostgreSQL databases. They cover
saved/missing defaults, all fields and boundaries, monetary rounding, replacement
and clearing, a new API instance, independent users, attempted user-ID injection,
missing/invalid claims, deleted accounts, and invalid inputs without partial writes.
The plan-validation parity suite sends the same invalid cases to plan generation.
The existing backend suite also exercises authentication, persistence, migrations,
user search, and planning regressions. OpenAPI tests require bearer security for
both new operations.

Coverage is collected using the same Coverlet OpenCover format imported by the
existing SonarQube workflow. Local added-line measurement compares report sequence
points with `git diff --unified=0`; new production files are measured in full.
SonarQube's PR-specific new-code coverage and quality gate must be confirmed in CI.
No coverage exclusions, test weakening, or quality gate changes are introduced.

Local results on 2026-11-15:

- `dotnet build backend/LinkUp.sln`: passed, zero warnings and zero errors.
- Focused API, validation parity, existing plan validation, and OpenAPI run:
  93 passed, zero failures or skipped tests.
- Complete backend unit/integration suite: 695 passed, zero failures or skipped tests.
- Added production code: 100% sequence coverage (59/59 sequence points) and 100%
  branch coverage (32/32 branch points), measured from the complete run's OpenCover
  report against added lines and all new production files. This exceeds 80% locally;
  it does not substitute for SonarQube's CI gate.
- `npm run generate:api`: passed with the repository's pinned generator.
- `git diff --check`: passed.

Local evidence is under `backend/tests/LinkUp.Api.Tests/TestResults/`:
`issue180-build.log`, `issue180-focused.trx`, `issue180-full.trx`,
`issue180-new-code-coverage.json`, and the complete run's
`9f35aa8f-578f-4d37-80a9-a01a67df97c1/coverage.opencover.xml`.
These generated test artifacts remain ignored by Git.

## Files

Created:

- `backend/src/LinkUp.Api/Dtos/PreferenceRules.cs`
- `backend/src/LinkUp.Api/Dtos/UserPreferencesDtos.cs`
- `backend/src/LinkUp.Api/Services/IUserPreferencesService.cs`
- `backend/src/LinkUp.Api/Services/UserPreferencesService.cs`
- `backend/tests/LinkUp.Api.Tests/UserPreferencesEndpointTests.cs`
- `backend/tests/LinkUp.Api.Tests/PreferenceRuleParityTests.cs`
- `docs/user-preferences-api.md`

Modified:

- `backend/src/LinkUp.Api/Controllers/UsersController.cs`
- `backend/src/LinkUp.Api/Dtos/NightPreferencesDto.cs`
- `backend/src/LinkUp.Api/Program.cs`
- `backend/tests/LinkUp.Api.Tests/OpenApiDocumentTests.cs`
- `backend/README.md`
- `shared/openapi.json` (generated)
- `shared/api.ts` (generated)
