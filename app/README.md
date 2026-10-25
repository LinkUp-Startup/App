# LinkUp — mobile app

React Native + TypeScript app built with [Expo](https://expo.dev) (SDK 57) and Expo Router. One codebase for Android and iOS; the school release targets Android first.

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

| Running on       | Value                             |
| ---------------- | --------------------------------- |
| Android emulator | `http://10.0.2.2:<port>`          |
| Physical device  | `http://<your-LAN-IP>:<port>`     |
| Deployed dev API | the Dokploy URL for `project_dev` |

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

The app works fully as a guest; an account is optional. The **Account** tab opens the login and register screens. Their form rules (`features/auth/form.ts`) mirror the server's limits, and a test fails if they drift apart. After a successful login or registration the API's access token is held in memory (`features/auth/auth-context.tsx`): it is lost when the app closes, because storing it securely is a separate issue (#86). To try it against a local API, run the backend and set `EXPO_PUBLIC_API_URL` to it (see `.env.example`); `npx expo start --web` also works for a quick look in a browser.

## Native builds

`android/` and `ios/` are generated (Continuous Native Generation) and git-ignored — configure native settings in `app.json`. Build installable binaries with EAS (`npx eas-cli@latest build:configure` once, then `npx eas-cli@latest build -p android`).
