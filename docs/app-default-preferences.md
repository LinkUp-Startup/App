# Default preferences screen (#181)

Open **Account → Default preferences**. The Expo Router stack route is
`/default-preferences`, separate from the existing Plan tab. Both guests and
signed-in users can edit budget in EUR per person, participant count, activities,
maximum distance in kilometres, and multiple transport modes. The screen reuses
`Screen`, `FormField`, `TextField`, `ChipGroup`, `CheckboxList`, and `Button`, along
with the existing activity/transport labels and numeric limits. Numeric fields
use text inputs so they can be left unspecified without inventing a default.
Content scrolls within the existing maximum width and safe-area layout.

All fields are optional. Blank numbers and deselecting all options clear a
default; requests send explicit nulls for them. Zero budget stays zero. An explicit
Save action is required, and changing a field is not treated as persistence.
Unsaved changes are identified on screen. As with the existing planning form,
normal back navigation leaves without saving; reopening restores only the last
successfully saved values. No new navigation interception is introduced.

## Accounts

The screen waits for the existing `useAuth` session restoration, then uses
`GET /api/users/me/preferences` and `PUT /api/users/me/preferences` from #180.
`api/user-preferences.ts` uses the existing `apiRequest` client, access token,
timeout/error handling, and abort signal. Requests never accept a user ID.
The `UserPreferences` type aliases #180's generated response schema. Every save
is a full replacement of the five displayed fields, following the API's PUT
semantics. The response repopulates the saved state, reflecting database monetary
rounding. There is no account cache or fallback to guest storage.

The editor remounts on account/session changes and cancels outstanding requests.
Late load/save results from another session cannot populate the current form.
Neither login nor logout copies preferences between account and guest storage.
Existing authentication behavior is unchanged.

## Guests

Guest defaults use the existing `@react-native-async-storage/async-storage`
dependency, suitable for React Native iOS and Android. These planning preferences
do not need credential storage; authentication tokens remain in the existing
secure session store. The dedicated key `linkup.guestPreferences.v1` contains
`{"version":1,"preferences":{...}}`. No new dependency, browser-only localStorage,
or preference API request is needed for guest reads or writes.

The store has no in-memory cache. Each screen mount reads the persisted key;
values survive normal process restarts through AsyncStorage. Missing, malformed,
unsupported-version, invalid-shape, unsupported-enum, or out-of-range data is
treated as unspecified. Corrupted data is replaced only by an explicit successful
save. Read/write errors are not swallowed: the screen explains local storage
failure and supports retry. A guest save only touches this key, never account data
or saved plans. Guest values remain available after logging out of an account.

## Validation and asynchronous behavior

The editor reuses `Limits`, `parseAmount`, existing labels, and the selection
toggle helper from the planning feature. The defaults form adds optional-field
handling rather than using the complete plan form's time window or business
defaults. Limits are EUR 0–500, 1–20 participants, and 0.5–30 km. Budget uses the
existing frontend convention of at most two decimal places and supports decimal
commas; the backend accepts extra budget precision and rounds stored values.
Radius supports decimal fractions without the plan stepper's UI step restriction.
Numbers must be finite, group sizes whole, and selections supported and distinct.
No selected options are converted to null because the API rejects supplied empty
lists. A test compares frontend bounds with #180's `PreferenceRules` constants.

Invalid fields show inline messages, updated after the first save attempt. They
cannot be persisted. API validation errors use the existing parsed validation
messages; offline, server, rate-limit, and invalid-session failures use existing
error conventions or a specific session message. Failed saves preserve edits and
never display success. Failed initial loads show Retry and keep the form unavailable
to avoid accidentally replacing unread defaults with blanks. Edits are unavailable
while loading, so late loading cannot overwrite edits. A synchronous save lock and
disabled Save button prevent duplicate submissions; fields are locked while saving.

## Verification and scope

Tests use React Native Testing Library and the existing native AsyncStorage Jest
mock. They exercise visible controls, actual storage serialization, remount/fresh
reader restoration, API client request headers and payloads through mocked fetch,
success/failure/retry, field validation, account switching, and late async results.
Existing Account tests also verify the new navigation for guests and account users.
They do not require a phone or make calls to production services.

There is no `npm run build` script. Expo's native production bundle export is the
frontend build verification, together with the existing typecheck, lint, and Jest
coverage commands. LCOV is generated by `npm run test:coverage` and imported by
the existing SonarQube workflow from `app/coverage/lcov.info`. No exclusions or gate
thresholds are changed. SonarQube's PR-specific new-code gate remains a CI check.

No backend code, schema, endpoint, authentication mechanism, or plan generation
behavior is changed for #181. The working branch was fast-forwarded to the existing
#180 merge commit before implementation verification; this created no commit.
No UI logic applies saved defaults to the Plan tab. #182 must implement deliberate
prefilling/merging while preserving explicit plan values. #183 remains responsible
for comprehensive cross-feature tests. The tests added here cover only #181.

## Local results (2026-11-15)

- `npm ci --ignore-scripts`: restored the existing lockfile without changing dependencies.
- `npm run lint`: passed.
- `npm run typecheck`: passed after Expo regenerated its ignored local route types.
- `npm run test:coverage -- --runInBand`: 38 suites and 422 tests passed.
- `npx expo export --platform android --platform ios --max-workers 2 --output-dir dist`:
  passed; Android and iOS Hermes bundles and assets are under ignored `app/dist/`.
- Existing #180 API/validation regression tests: 62 passed against disposable local
  PostgreSQL databases using `dotnet test backend/LinkUp.sln --filter
  "FullyQualifiedName~UserPreferencesEndpointTests|FullyQualifiedName~PreferenceRuleParityTests"`.
  The command also built the existing backend successfully. No #181 backend changes
  or migrations were necessary.
- `git diff --check`: passed.

Full frontend LCOV coverage is 98.96% lines and 95.31% branches. For #181 added code,
the same report covers 124/124 executable added lines (100%) and 124/128 branch
outcomes (96.88%). Combining covered lines and branch outcomes gives 98.41% locally.
Measurement matches `DA` and `BRDA` entries in `app/coverage/lcov.info` against added
lines in `git diff --unified=0`, counting new production files in full. Type aliases
have no executable lines; the existing layout coverage exclusion remains unchanged.
SonarQube CI must confirm the PR-specific baseline and quality gate separately.

Local logs and the per-file added-code coverage breakdown are under ignored
`app/.expo/issue181-*.log` and `app/.expo/issue181-new-code-coverage.json`.
Backend verification output is in the ignored
`backend/tests/LinkUp.Api.Tests/TestResults/issue181-api-regression.log`.
Jest verifies storage restoration with the native storage mock and a fresh module
reader/screen mount. Physical-device restarts and signed APK/IPA builds were not run;
the successful native exports verify production JS/assets, not store packaging.

## Files

Created:

- `app/src/api/user-preferences.ts`
- `app/src/app/default-preferences.tsx`
- `app/src/features/preferences/default-preferences-editor.tsx`
- `app/src/features/preferences/defaults-form.ts`
- `app/src/storage/guest-preferences.ts`
- `app/src/features/preferences/__tests__/default-preferences-screen.test.tsx`
- `app/src/features/preferences/__tests__/defaults-form.test.ts`
- `app/src/storage/__tests__/guest-preferences.test.ts`
- `docs/app-default-preferences.md`

Modified:

- `app/src/app/(tabs)/account.tsx`
- `app/src/app/_layout.tsx`
- `app/src/types/api.ts`
- `app/src/features/auth/__tests__/account-screen.test.tsx`
- `app/README.md`
