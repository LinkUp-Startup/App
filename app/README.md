# LinkUp — mobile app

React Native + TypeScript app built with [Expo](https://expo.dev) (SDK 57) and Expo Router. One codebase for Android and iOS; the school release targets Android first.

## Requirements

- Node 22 (`nvm use` reads `.nvmrc`)
- Android: Android Studio emulator, or the **Expo Go** app on a phone
- iOS: Expo Go on an iPhone (no Mac needed for development). Simulator builds need macOS + Xcode.

## Getting started

```bash
cd app
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL to the backend
npm start              # then press a (Android) / i (iOS), or scan the QR code with Expo Go
```

`EXPO_PUBLIC_API_URL`:

| Running on        | Value                          |
| ----------------- | ------------------------------ |
| Android emulator  | `http://10.0.2.2:<port>`       |
| Physical device   | `http://<your-LAN-IP>:<port>`  |
| Deployed dev API  | the Dokploy URL for `project_dev` |

`EXPO_PUBLIC_*` values are bundled into the app — never put secrets (e.g. AI API keys) there. AI calls stay on the backend.

## Scripts

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm start`         | Start Metro dev server             |
| `npm run android`   | Start and open on Android          |
| `npm run ios`       | Start and open on iOS              |
| `npm run lint`      | ESLint (`eslint-config-expo`)      |
| `npm run typecheck` | TypeScript check                   |
| `npm run doctor`    | Check Expo dependency/config health |

Add packages with `npx expo install <pkg>` (not `npm install`) so versions match the Expo SDK.

## Structure

```
src/
├── app/                 Routes (Expo Router — every file is a screen)
│   ├── _layout.tsx      Root stack + theme
│   ├── (tabs)/          Bottom tabs: Plan (index), Saved
│   └── plans.tsx        Generated plans screen
├── api/                 REST client + endpoint functions
├── components/          Reusable UI (Screen, Button, ThemedText, ThemedView)
├── constants/theme.ts   Colors, spacing, fonts
├── hooks/               Theme / color scheme hooks
├── storage/             Local (guest) persistence — AsyncStorage
├── types/api.ts         API contract with the ASP.NET Core backend
└── config.ts            Env-based config
```

Keep non-route code out of `src/app/`. Import from `src` with the `@/` alias.

## Native builds

`android/` and `ios/` are generated (Continuous Native Generation) and git-ignored — configure native settings in `app.json`. Build installable binaries with EAS (`npx eas-cli@latest build:configure` once, then `npx eas-cli@latest build -p android`).
