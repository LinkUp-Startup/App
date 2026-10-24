# LinkUp

A better way to decide what to do tonight. Users describe their night (budget, group, time, distance, transport) and get 2–3 complete plans built from real venues in Lleida.

ICT Project — Universitat de Lleida, 2026. Team: Lei, Andressa, Franjo, Thibo.

## Repository layout

| Folder                | What                                                       | Docs                                   |
| --------------------- | ---------------------------------------------------------- | -------------------------------------- |
| [`app/`](app)         | React Native + TypeScript mobile app (Expo), Android + iOS | [app/README.md](app/README.md)         |
| [`backend/`](backend) | ASP.NET Core API (C#, .NET 10) + EF Core + PostgreSQL      | [backend/README.md](backend/README.md) |
| [`web/`](web)         | React website (from Sprint 2)                              | —                                      |
| [`docs/`](docs)       | Planning, setup guides and quality reports                 | see below                              |

`docker-compose.yml` at the root starts the local PostgreSQL database.

## Quick start

Requirements: Node 22, .NET 10 SDK, Docker (or Podman), and an Android emulator or phone with Expo Go.

```bash
# 1. Database
docker compose up -d

# 2. API (http://localhost:5000, Swagger at /swagger)
dotnet run --project backend/src/LinkUp.Api

# 3. App
cd app
npm install
cp .env.example .env
npm start            # press a for Android, or scan the QR code with Expo Go
```

The app's Plan screen shows **API online** when it reaches the backend and database.

Detailed guides:

- [Local database setup](backend/README.md#local-database)
- [Android emulator and device setup](docs/android-setup.md)

## Tests and code quality

```bash
cd app && npm test                 # app (Jest)
dotnet test backend/LinkUp.sln     # backend (xUnit)
```

Every pull request and every push to `main` runs both test suites and a SonarQube Cloud analysis of the whole repository.

- **The backend account tests need PostgreSQL.** Start the local database first (`docker compose up -d`). Each test class creates a throwaway database on it, so your own data is untouched. Without it, only those tests fail (with a message saying so); set `TEST_POSTGRES` to use another server. In CI a Postgres service container is started for the test step.
- CI runs the app's Jest tests and all backend tests, then checks that `shared/` (the OpenAPI contract and generated app types) is committed and up to date. It does not run the app's lint, typecheck or Prettier: run `npm run lint`, `npm run typecheck` and `npm run format:check` in `app/` before pushing.
- After changing any API endpoint or DTO, rebuild the backend (`dotnet build backend/LinkUp.sln --no-incremental`) and run `npm run generate:api` in `app/`, then commit `shared/`. CI fails if they are out of date.
- On Windows, git may check files out with CRLF line endings, which makes `npm run format:check` report almost every file. Run it with `--end-of-line crlf`, or ignore it: the committed files are fine.
- The first Jest run after a fresh install can be slow and occasionally times out two suites on a busy machine; run it again.

- SonarQube Cloud: https://sonarcloud.io/project/overview?id=LinkUp-Startup_App
- How the analysis is set up, and the findings fixed so far: [docs/code-quality.md](docs/code-quality.md)

## Documentation

| Document                                        | Contents                                    |
| ----------------------------------------------- | ------------------------------------------- |
| [Sprint0_Planning.md](docs/Sprint0_Planning.md) | Sprint 0 project definition and planning    |
| [android-setup.md](docs/android-setup.md)       | Emulator / device setup and troubleshooting |
| [code-quality.md](docs/code-quality.md)         | Testing, SonarQube setup and findings       |
