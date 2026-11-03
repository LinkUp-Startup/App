# web

The LinkUp website, live at https://linkup.th7bo.dev. Next.js (App Router) + TypeScript + Tailwind CSS.

- `/` explains LinkUp with an example night.
- `/plan/<token>` shows a plan someone shared from the app (read-only, no account needed). Coming with #156.

## Run it

Requirements: Node 22.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

| Command                 | What                                       |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | Development server with hot reload         |
| `npm run build`         | Production build (`.next/standalone`)      |
| `npm start`             | Serve the production build                 |
| `npm run lint`          | ESLint (Next.js rules)                     |
| `npm run typecheck`     | TypeScript                                 |
| `npm run format`        | Prettier (same settings as the app)        |
| `npm test`              | Vitest + Testing Library                   |
| `npm run test:coverage` | Tests with coverage (`coverage/lcov.info`) |

CI runs lint, type-check, format check, tests with coverage and the build on every pull request; SonarQube
analyses `web/` together with the app and the backend.

## Configuration

| Variable         | Default                        | What                                           |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| `SITE_URL`       | `https://linkup.th7bo.dev`     | Public URL of the site, used for link previews |
| `LINKUP_API_URL` | `https://linkup-api.th7bo.dev` | API the shared plan page reads from            |

`.npmrc` sets `legacy-peer-deps`: npm 10 crashes resolving Vitest's optional peer dependencies otherwise.

## Deploy (Dokploy)

`web/Dockerfile` builds a small Node image with the Next.js standalone server. The build context is the repo
root, because the build type-checks against `shared/api.ts`:

```bash
docker build -f web/Dockerfile -t linkup-web .
docker run -p 3000:3000 linkup-web    # http://localhost:3000
```

Dokploy application settings:

| Setting             | Value                                      |
| ------------------- | ------------------------------------------ |
| Source              | GitHub `LinkUp-Startup/App`, branch `main` |
| Build type          | Dockerfile                                 |
| Dockerfile path     | `web/Dockerfile`                           |
| Docker context path | `.` (repo root)                            |
| Watch paths         | `web/**`, `shared/**`                      |
| Domain              | `linkup.th7bo.dev`, HTTPS                  |
| Container port      | `3000`                                     |
| Environment         | none needed (see Configuration)            |

The container runs as the non-root `node` user and has a health check on `/`. Share links come from the API's
`Sharing__WebBaseUrl`, which defaults to `https://linkup.th7bo.dev`.

## Design

A night theme: indigo instead of black, lavender text, the app's violet for links and the route line, and
amber only for times. Headings and times use Bricolage Grotesque; text uses Lexend, made for readability, for reading on a
phone outside at night. The plan is drawn as a route (`src/components/route.tsx`): times on the
left, a line through the stops, and the walking distance between them.
