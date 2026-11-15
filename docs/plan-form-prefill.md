# Saved defaults in the plan form (#182)

The Plan tab starts with the user's saved budget (EUR per person), group size,
activities, transport modes, and maximum distance (km). The controls and generation
route remain the same. Every field can still be changed for this plan. There is no
call to the preferences PUT endpoint or local preference writer from plan editing
or generation.

## Loading and initialization

The screen waits for the existing authentication session to finish restoring.
Signed-in users load through `getUserPreferences` (#180); guests load through
`loadGuestPreferences` and its existing versioned AsyncStorage record (#181).
Account loads never fall back to the guest record. No new storage, API, auth
mechanism, cache, or dependency is introduced.

`savedPlanFields` maps the five validated saved values to the existing
`PreferencesForm`. It preserves zero budget, copies selection arrays, and uses
the original form defaults for null fields and empty selections. Selections
replace the corresponding initial selections, rather than accumulating them.
Times, notes, and the start point are outside the mapping and remain unchanged.

Loading runs on focus when there is no active draft. This initializes a new form
and lets an untouched form reflect preferences changed in Account when returning
to Plan. Stable callbacks prevent requests or reads on ordinary rerenders. Once
the user edits or attempts generation, tab visits preserve the active draft and
skip preference reads. There is no persisted plan-draft restoration in the
existing app; this change preserves its mounted form state rather than adding a
new draft persistence feature.

**Start a new plan** explicitly discards the current draft, recreates the usual
application defaults (including the time window), and loads the current saved
preferences again. Returning from results via the existing Change preferences
action keeps the active form. Account identity changes create a fresh form and
cancel the old load. A token refresh for the same identity preserves its draft.

Initialization priority is:

1. Current plan edits and the submitted form snapshot.
2. Valid saved values for fields that have not been edited.
3. Existing application defaults for unspecified fields.

The form stays editable while loading. `usePreferencesForm` records edited fields
synchronously, then checks them when applying an async response. A late response
can populate untouched fields but cannot replace an edited field, including an
explicitly cleared value. Attempting generation freezes initialization entirely;
the submitted payload uses the current form, and late defaults cannot change it.
This also applies when generation is rejected by the existing form validation.
On blur, reset, unmount, or identity changes, cancelled results and errors are
ignored. Returning to an edited draft also clears any cancelled loading indicator.

## Validation and failures

Both sources pass through #181's existing `isUserPreferences` guard before
mapping. Invalid/outdated account data is rejected as a whole with useful feedback
and the ordinary defaults. The existing guest loader already handles missing,
corrupted, invalid, and unsupported-version records as unspecified preferences.
Read/API failures show a message while keeping manual planning available.
Unspecified selections continue to follow the plan's existing required-selection
rules when generating. Saved-value validation and manual plan validation are
reused without weakening their limits or adding conversions.

The screen submits the existing `toNightPreferences` result through the existing
navigation to `/plans`. Changes never update the profile's saved defaults or the
guest record. Guest defaults therefore continue to survive restarts independently
of temporary plan overrides.

## Verification

Focused tests exercise the actual budget input, group/radius steppers, selections,
and generation payload. They cover accounts and guests, all five overrides,
zero budget, missing/partial values, corrupt storage, API/read failures, invalid
saved values, field edits during loading, submitted snapshots, refocus behavior,
explicit new plans, and late responses from another account. Storage assertions
verify the saved guest record remains unchanged, and fetch assertions verify
authenticated reads without PUT requests or guest API calls.

Unit tests cover mapping, array ownership, untouched-field priority, preservation
of times/notes/location, cleared defaults, and submission freezing. Existing plan
screen assertions remain intact with updated authentication/focus test setup.

Run the established checks from `app/`:

```powershell
npm run typecheck
npm run lint
npm run test:coverage -- --runInBand
npx expo export --platform android --platform ios --max-workers 2 --output-dir dist
```

There is no existing `npm run build` script; the Expo export verifies production
Android/iOS JavaScript, Hermes bundles, and assets. Signed APK/IPA packaging and
physical-device testing are separate. The existing SonarQube workflow imports
`app/coverage/lcov.info`. No coverage exclusions or quality gate settings change.
Its PR-specific new-code coverage baseline and gate must still be verified in CI.

No backend code, authentication behavior, persistence implementation, schema,
preferences editor, or result generation service is changed. #183's broader
cross-feature test work remains separate.

## Local results (2026-11-15)

- Focused plan-form checks: 40 passed, including the existing screen and state tests.
- Complete frontend coverage run: 456 tests across 40 suites passed.
- TypeScript, ESLint, and `git diff --check`: passed.
- Android and iOS production exports: passed; bundles and assets are in ignored
  `app/dist/`.
- Backend build/tests: not rerun because #182 changes no backend files or contracts.

Full frontend coverage is 99.12% lines and 95.56% branches. Added #182 production
code has 100% local coverage: 47/47 executable lines and 36/36 branch outcomes.
This was measured by matching LCOV `DA`/`BRDA` entries against added lines in
`git diff --unified=0`, counting new production files in full. Per-file results are
in ignored `app/.expo/issue182-new-code-coverage.json`; the underlying report is
`app/coverage/lcov.info`. Verification logs are under `app/.expo/issue182-*.log`.
This exceeds the 80% local requirement without changing coverage configuration;
SonarQube must confirm its own PR baseline and quality gate in CI.

Native storage behavior is exercised through the project's existing AsyncStorage
Jest implementation; HTTP behavior uses the actual API request client with mocked
fetch responses. Production APIs, physical devices, signed APKs/IPAs, and a full
cross-feature end-to-end deployment are not exercised by these tests.

## Files

Created:

- `app/src/features/preferences/plan-prefill.ts`
- `app/src/features/preferences/use-plan-prefill.ts`
- `app/src/features/preferences/__tests__/plan-prefill.test.ts`
- `app/src/features/preferences/__tests__/plan-form-prefill-screen.test.tsx`
- `docs/plan-form-prefill.md`

Modified:

- `app/src/app/(tabs)/index.tsx`
- `app/src/features/preferences/use-preferences-form.ts`
- `app/src/features/preferences/__tests__/preferences-screen.test.tsx`
- `app/README.md`
