# Preferences tests (#183)

Verified on 2026-11-17. This issue extends the tests from #179–#182 rather than
duplicating their existing persistence, validation, screen and storage contracts.
No production code, dependencies, migrations, coverage exclusions, quality gates
or CI configuration changed. No production defects were found, and no commits or
pull requests were created.

## Changes

Modified:

- `backend/tests/LinkUp.Api.Tests/UserPreferencesPersistenceTests.cs`: five new
  parameterized cases run against both SQLite and PostgreSQL (10 tests). Each
  preference is independently saved, reloaded, cleared and reloaded again, with
  the other four fields remaining unspecified. Collection cases use multiple
  enum values and exercise the providers' real serialization.
- `backend/tests/LinkUp.Api.Tests/UserPreferencesEndpointTests.cs`: four new
  tests. A registered user's real JWT authenticates saving and retrieving all
  five defaults, then generating plans with all five overridden. The HTTP
  pipeline, validation, database and stub generator are real; only venue
  discovery is controlled. The test checks the exact preferences received by
  the filter, a successful nonempty generation response, unchanged saved
  preferences and an independent second account. PATCH, POST and DELETE each
  return 405 without modifying saved values; PUT remains full replacement.
- `app/src/features/preferences/__tests__/plan-form-prefill-screen.test.tsx`:
  two new cross-screen workflows, one per identity type. Edit and save all five
  fields through the actual editor, unmount, open the plan screen, verify all
  prefilled values, override every field, submit, reopen the editor and verify
  the original defaults. The guest workflow uses actual storage serialization
  with the existing AsyncStorage adapter and makes no HTTP requests. The account
  workflow uses a stateful fetch adapter with bearer-header checks, verifies
  exactly one PUT, and confirms guest storage stays empty. Zero budget and a
  fractional radius are preserved throughout.

Created:

- `docs/preferences-tests.md`: this report and reproduction commands.

## Existing coverage retained and verified

Backend focused classes in the successful full run:

| Test class                               | Passed |
| ---------------------------------------- | -----: |
| UserPreferencesPersistenceTests (SQLite) |     23 |
| UserPreferencesPostgresTests             |     24 |
| UserPreferencesMigrationTests            |      1 |
| UserPreferencesEndpointTests             |     43 |
| PreferenceRuleParityTests                |     23 |
| PreferencesValidationTests               |     21 |

Persistence already covers absent/all defaults, numeric limits, collection
replacement and in-place tracking, independent users, separate contexts and
connections, invalid numeric values and upgrading existing accounts with the
actual EF migration. PostgreSQL uses native arrays; SQLite uses JSON collections.
The database enforces numeric constraints; supported/distinct selection validation
belongs to the shared production API rules, not additional database constraints.

API tests already cover full replacement/clearing, rounding, malformed JSON values,
all supported selections, invalid enums/duplicates/empty lists, no partial writes,
missing/invalid JWTs, invalid subjects, deleted accounts, and attempted account-ID
injection. The parity suite reuses the API invalid-value cases against plan
generation; tests do not invent separate validation limits.

Existing app suites verify Account navigation for guests and accounts, five-field
editing, request payloads, feedback, validation, failed loads/retry, failed saves
preserving edits, reopening, duplicate-save prevention, and cancelled requests.
Storage tests cover missing/corrupt/outdated records, replacements, clearing,
fresh-module readers and storage failures. Prefill tests cover absent/partial
defaults, malformed data, asynchronous edits, identity switches and late results,
rerenders, tab return, active drafts, starting a new plan and all overrides.
These tests remain unchanged except for the added cross-screen workflows.

## Results and coverage

| Check                                           | Result                                     |
| ----------------------------------------------- | ------------------------------------------ |
| Backend build                                   | Passed, 0 warnings, 0 errors               |
| Backend tests with coverage                     | 738 passed, 0 failed, 0 skipped            |
| App tests with coverage                         | 505 passed, 0 failed, 0 skipped; 44 suites |
| App typecheck and lint                          | Passed                                     |
| Expo Android and iOS export                     | Passed                                     |
| Formatting of changed JS/TS and diff whitespace | Passed                                     |

| Local scope                                  |              Lines |  Branch outcomes | Combined lines + branches |
| -------------------------------------------- | -----------------: | ---------------: | ------------------------: |
| Added backend preference code from #179–#182 |       73/73 (100%) |     32/32 (100%) |                      100% |
| Added app preference code from #179–#182     |     171/171 (100%) | 160/164 (97.56%) |                    98.81% |
| Added preference feature code combined       |     244/244 (100%) | 192/196 (97.96%) |                    99.09% |
| Entire app                                   | 1010/1018 (99.21%) | 715/749 (95.46%) |                         — |

The raw backend assembly report has 91.4% sequence-point and 73.37% branch
coverage; it includes unrelated and generated code and is not feature coverage or
Sonar new-code coverage. Feature figures above match executable report entries
to added lines from implementation commits `4c3343a`, `2866f28`, `a78a12e` and
`68f5273`, mapping surviving lines through subsequent changes to HEAD. The script
deduplicates lines and branch identities and applies existing migration/layout
analysis exclusions only to this measurement. It changes no coverage settings.

All measured preference feature lines are covered. Four uncovered editor branch
outcomes remain at lines 64, 77, 84 and 96: inactive-load rejection, guarded edit,
guarded duplicate save and optional abort-controller access. The existing tests
exercise cancellation and disabled controls; no artificial calls into component
internals were added to force these defensive paths.

**These local results exceed the 85% target for the implementation feature. They
are not an actual SonarQube analysis.** #183 changes tests and documentation only,
so it adds no executable production lines to measure against its own PR baseline.
SonarCloud's selected new-code period and quality gate require CI confirmation;
no Sonar token or remote analysis was used locally.

## Reproduce

From the repository root, using the existing local development PostgreSQL service:

```powershell
docker compose up -d db
dotnet build backend/LinkUp.sln
dotnet test backend/LinkUp.sln --collect:"XPlat Code Coverage;Format=opencover" --logger "trx;LogFileName=issue183-full.trx"
cd app
npm run typecheck
npm run lint
npm run test:coverage -- --runInBand
npx expo export --platform android --platform ios --max-workers 2 --output-dir dist
cd ..
```

On this Windows installation npm's PowerShell shim discarded forwarded Jest
flags. The verified equivalent coverage command, from `app`, is:

```powershell
node node_modules/jest/bin/jest.js --runInBand --coverage
```

Dependencies were already installed; use `npm ci --ignore-scripts` in `app` when
needed. There is no app build script: the native Expo export above is the existing
production JS/assets build check. If ignored Expo route types are stale after a
checkout, start `npx expo start --offline` once, stop after Metro starts, then
rerun typecheck. That resolved local stale types for the existing friends routes;
no source change was needed. Windows backend verification required permission
outside the sandbox for Windows event logging and the local database.

Each backend factory creates, migrates and drops a uniquely named test database.
No production database or credentials are needed. `TEST_POSTGRES` can override
the existing local connection convention. Jest resets device storage between
tests; tests require no real network or device and no execution ordering.

## CI and remaining limits

`.github/workflows/sonarqube.yml` already runs the complete Jest and backend
suites and supplies `app/coverage/lcov.info` and
`**/TestResults/**/coverage.opencover.xml` to the multi-language .NET scanner.
The workflow supplies PostgreSQL and uses full Git history. The new tests match
existing discovery patterns, so no CI edits were necessary. LCOV source paths
are repository-relative; OpenCover references the source files. Existing analysis
excludes dependencies, build artifacts, generated migrations and shared generated
contracts, and existing coverage exclusions include layouts, constants and tests.
Preference models/configuration, API controller/service/validation, editor,
storage and prefill files remain included.

App integration tests use mocked fetch and an established authenticated context;
backend integration tests independently exercise real auth/HTTP/PostgreSQL. There
is no new device-to-live-server E2E framework. Remount/fresh-reader restoration
checks persistent storage behavior through the native Jest adapter, not physical
process termination. No physical device, signed APK/IPA, deployed AI service or
remote SonarCloud gate was tested. These are the remaining external checks.

Local evidence is ignored: `app/.expo/issue183-{tests,coverage,build}.log`,
`app/.expo/issue183-feature-coverage.json`, `app/coverage/lcov.info`, and
`backend/tests/LinkUp.Api.Tests/TestResults/issue183-{build,full}.log`,
`issue183-full.trx` and run directory
`61411642-3d61-4155-a3c1-48f172b92e40/coverage.opencover.xml`.

The dependency-free measurement helper is retained locally as the ignored
`app/.expo/issue183-measure-coverage.mjs`. From the repository root, rerun it with
`node app/.expo/issue183-measure-coverage.mjs <OpenCover-report-path>` after collecting
both reports. It is a local evidence artifact, not part of the CI test suite.
