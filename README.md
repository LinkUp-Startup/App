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

- SonarQube Cloud: https://sonarcloud.io/project/overview?id=LinkUp-Startup_App
- How the analysis is set up, and the findings fixed so far: [docs/code-quality.md](docs/code-quality.md)

## Documentation

| Document                                        | Contents                                    |
| ----------------------------------------------- | ------------------------------------------- |
| [Sprint0_Planning.md](docs/Sprint0_Planning.md) | Sprint 0 project definition and planning    |
| [android-setup.md](docs/android-setup.md)       | Emulator / device setup and troubleshooting |
| [code-quality.md](docs/code-quality.md)         | Testing, SonarQube setup and findings       |
