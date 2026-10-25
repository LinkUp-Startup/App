# LinkUp — mobile app

React Native + TypeScript app built with [Expo](https://expo.dev) (SDK 58) and Expo Router. One codebase for Android and iOS; the school release targets Android first.

## Requirements

- Node 22 (`nvm use` reads `.nvmrc`)
- Android: Android Studio emulator, or the **Expo Go** app on a phone
- iOS: Expo Go on an iPhone (no Mac needed for development). Simulator builds need macOS + Xcode.

Step-by-step emulator and device setup: [docs/android-setup.md](../docs/android-setup.md).

## Getting started

```bash
cd app
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to the backend
npm start              # then press a (Android) / i (iOS), or scan the QR code with Expo Go
```

`EXPO_PUBLIC_API_URL`:

| Running on       | Value                          |
| ---------------- | ------------------------------ |
| Android emulator | `http://10.0.2.2:<port>`       |
| Physical device  | `http://<your-LAN-IP>:<port>`  |
| Deployed API     | `https://linkup-api.th7bo.dev` |

`EXPO_PUBLIC_*` values are bundled into the app — never put secrets (e.g. AI API keys) there. AI calls stay on the backend.

## Scripts

| Command                 | What it does                          |
| ----------------------- | ------------------------------------- |
| `npm start`             | Start Metro dev server                |
| `npm run android`       | Start and open on Android             |
| `npm run ios`           | Start and open on iOS                 |
| `npm run lint`          | ESLint (`eslint-config-expo`)         |
| `npm run format`        | Format all files with Prettier        |
| `npm run format:check`  | Check formatting (no changes)         |
| `npm run typecheck`     | TypeScript check                      |
| `npm test`              | Run Jest tests                        |
| `npm run test:coverage` | Tests + coverage report (`coverage/`) |
| `npm run doctor`        | Check Expo dependency/config health   |

Tests live in `__tests__/` folders next to the code they test (never inside `src/app/`, where every file becomes a route). They use Jest (`jest-expo`) and React Native Testing Library.

Add packages with `npx expo install <pkg>` (not `npm install`) so versions match the Expo SDK.

## Structure

```
src/
├── app/                 Routes (Expo Router — every file is a screen)
│   ├── _layout.tsx      Root stack + theme
│   ├── (tabs)/          Bottom tabs: Plan (index), Saved, Account
│   ├── plans.tsx        Generated plans screen
│   ├── login.tsx        Log in
│   └── register.tsx     Create account
├── api/                 REST client + endpoint functions
├── components/          Reusable UI (Screen, Button, ThemedText, ThemedView)
├── constants/theme.ts   Colors, spacing, fonts
├── features/            Per-feature logic: preferences form, plans, auth (form rules, session, errors)
├── hooks/               Theme / color scheme hooks
├── storage/             Local (guest) persistence — AsyncStorage
├── types/api.ts         API contract with the ASP.NET Core backend
└── config.ts            Env-based config
```

Keep non-route code out of `src/app/`. Import from `src` with the `@/` alias.

### Accounts

The app works fully as a guest; an account is optional. The **Account** tab opens the login and register screens. Their form rules (`features/auth/form.ts`) mirror the server's limits, and a test fails if they drift apart.

**The session survives closing the app.** After a login or registration the account and access token are kept in the phone's secure storage (iOS Keychain / Android Keystore, via `expo-secure-store`, not backed up or moved to another device); `storage/session.ts` is the only code that touches it. On launch (`features/auth/auth-context.tsx`):

- the saved session is restored, unless it has expired or is damaged (then it is removed and the user starts as a guest). The splash screen stays up until this is done, so a signed-in user never sees the app flash as a guest.
- the token is confirmed in the background with `GET /api/auth/me`. A `401` (expired, or the server no longer accepts it) signs the user out; being offline or a server error does not, because the app can't tell.
- while the app runs, the user is signed out when the token expires (30 seconds early, so a request never leaves with a token about to lapse), including after the app was in the background.
- **Log out** removes the session from the device.

On the **web** there is no secure storage, so a production web build keeps the session in memory only (a reload logs out). In development builds the browser preview uses `localStorage` instead, only so a reload behaves like reopening the app; never rely on it for anything real.

To try it against a local API, run the backend and set `EXPO_PUBLIC_API_URL` to it (see `.env.example`); `npx expo start --web` also works for a quick look in a browser. Tests use an in-memory stand-in for the secure storage (`jest.setup.ts`), emptied before every test.

## Native builds

`android/` and `ios/` are generated (Continuous Native Generation) and git-ignored — configure native settings in `app.json`. Build installable binaries with EAS (`npx eas-cli@latest build:configure` once, then `npx eas-cli@latest build -p android`).
