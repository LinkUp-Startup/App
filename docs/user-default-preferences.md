# User default preferences (#179)

Defaults are nullable fields on `User`, persisted in the existing `users` table.
The existing services use `AppDbContext.Users` directly, so no repository, separate
preferences entity, join table, or service is needed. Updates use ordinary tracked
entity changes followed by `SaveChangesAsync`.

| User property | CLR type | PostgreSQL column | Meaning |
| --- | --- | --- | --- |
| `DefaultBudgetPerPerson` | `decimal?` | `numeric(8,2)` | EUR per participant; 0 means free, null means unspecified |
| `DefaultGroupSize` | `int?` | `integer` | Number of participants |
| `DefaultMaxDistanceKm` | `double?` | `double precision` | Maximum travel distance in kilometres |
| `DefaultTransport` | `Transport[]?` | `integer[]` | Multiple existing planning transport modes |
| `DefaultActivities` | `Activity[]?` | `integer[]` | Multiple existing planning activities |

Database check constraints use the existing `NightPreferencesDto` limits:
budget EUR 0–500, group size 1–20, and distance 0.5–30 km. These are existing
form rules, not new participant or radius limits. Null passes each constraint.
The budget check casts to numeric so SQLite's decimal text storage is compared
numerically too. PostgreSQL stores amounts to two decimal places, matching the
existing monetary persistence convention. Constraint failures surface as
`DbUpdateException`; the future API must validate input before saving.

Selections reuse `LinkUp.Api.Dtos.Activity` and `Transport`. EF primitive
collections handle serialization and change tracking, including changes to an
array element. PostgreSQL uses native integer arrays; SQLite tests use JSON.
Keep enum numeric identities stable when extending these enums. Activities remain
compatible with `VenueFilteringService.CategoriesFor` (#59), and distance uses
the same kilometres as distance filtering (#54). Transport records modes, not
invented vehicle counts or passenger capacity.

Null scalars and null/empty selections mean no saved preference. No budget,
activity, transport mode, group size, or radius is assumed for existing accounts.
Individual fields can be cleared independently. These nullable defaults cannot
by themselves constitute a complete `NightPreferencesDto`, which also requires
a time window. Fully populated defaults use its existing types directly.

## Migration

`20261115161147_AddUserDefaultPreferences` adds five nullable columns and three
check constraints. It leaves existing accounts and their authentication fields
intact, with all preferences null. Its generated designer and the model snapshot
register the model change. No earlier migration was changed. The rollback removes
only the new constraints and columns (and therefore any saved defaults).

Verification applies the actual migration to disposable PostgreSQL databases
through the existing `AuthApiFactory`. One test inserts an account before this
migration, upgrades through API startup, verifies the account and null defaults,
then saves a zero budget. No shared or production database is migrated.

## Verification

Use the project's existing tooling:

```powershell
dotnet build backend/LinkUp.sln
dotnet test backend/LinkUp.sln --collect:"XPlat Code Coverage;Format=opencover"
```

PostgreSQL tests require `docker compose up -d db` or the established
`TEST_POSTGRES` connection string. Each test factory creates, migrates, and drops
its own database. SQLite persistence tests can run independently:

```powershell
dotnet test backend/LinkUp.sln --filter FullyQualifiedName~UserPreferencesPersistenceTests
```

The shared persistence contract tests missing defaults, all fields and boundary
values, multiple selections, retrieval, updates, in-place array changes, clearing,
empty collection serialization, independent users, invalid numeric values, and
compatibility with `NightPreferencesDto`. Additional PostgreSQL tests verify a
fresh context/connection and upgrading an existing account. Existing auth and
planning regression tests verify compatibility outside the new persistence tests.

Local verification on 2026-11-15: solution build succeeded with zero warnings and
zero errors; the focused run passed 39 checks; the complete backend run passed
631 tests with zero failures and zero skipped. PostgreSQL 18 ran through the
repository's local Docker Compose service. EF also successfully generated the
upgrade SQL from `AddFriendships` to `AddUserDefaultPreferences`.

Local Coverlet OpenCover measurement on the focused suite covered all 14 added
executable sequence points in `User.cs` and `UserConfiguration.cs` (100%). This was
calculated by matching the added lines from `git diff --unified=0` with the report's
sequence points and visit counts. Both modified classes also have 100% sequence
coverage. There are no new branches. Generated migrations already fall under the
repository's existing Sonar analysis exclusion; no coverage settings were changed.
SonarQube's PR-specific new-code coverage and quality gate must still be confirmed
by the existing CI workflow, which imports the same OpenCover format.

## Follow-up issues

- #180: expose and validate updates, including enum values and duplicate selections;
  preserve nullable values when mapping requests and responses.
- #181: build the preference screen using the existing activities and transport modes.
- #182: explicitly merge saved defaults with the plan form, preserving values supplied
  for an individual plan; handle missing fields and null/empty selections.
- #183: add tests across the complete feature once those layers exist.

No preference endpoints, frontend changes, automatic loading, or plan prefilling
are implemented by #179. Authentication DTOs and plan generation are unchanged.
