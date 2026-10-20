# LinkUp API (ASP.NET Core)

Backend for the LinkUp night planner. .NET 10 SDK is pinned in `global.json`.

## Run

```bash
dotnet run --project backend/src/LinkUp.Api
```

Listens on `http://0.0.0.0:5000` (what the app's `EXPO_PUBLIC_API_URL` expects; Android emulator reaches it via `10.0.2.2`).

- Swagger UI (development only): http://localhost:5000/swagger
- OpenAPI spec: http://localhost:5000/openapi/v1.json
- Health check: `GET /health` — `200` when the API and database are reachable, `503` otherwise
- Generate plans: `POST /api/plans/generate`

## Local database

PostgreSQL 18 runs in a container defined in `docker-compose.yml` at the repo root. The image is multi-arch (x86-64 and ARM64).

Requirements: Docker Desktop / Docker Engine with Compose, or Podman (`podman compose`).

```bash
# from the repo root
docker compose up -d          # start (data persists in the `linkup_db-data` volume)
docker compose ps             # STATUS should become "healthy"
docker compose down           # stop, keep data
docker compose down -v        # stop and wipe the database
```

| Setting  | Default     |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5432`      |
| Database | `linkup`    |
| User     | `linkup`    |
| Password | `linkup`    |

These are local-only development credentials. To change them (e.g. port 5432 is already taken by a local PostgreSQL), copy `.env.example` to `.env` in the repo root and edit it.

Connect manually: `docker compose exec db psql -U linkup -d linkup`.

## Database tooling

EF Core (with the Npgsql PostgreSQL provider) is the ORM. The `dotnet-ef` CLI is pinned as a local tool in `dotnet-tools.json`; restore it once per clone:

```bash
cd backend
dotnet tool restore
dotnet ef --version
```

## Structure

```
backend/src/LinkUp.Api/
  Controllers/   HTTP endpoints. Thin: bind, call a service, return a DTO.
  Services/      Business logic behind interfaces (IPlanService), registered in Program.cs.
  Dtos/          Request/response records. Mirror app/src/types/api.ts (camelCase JSON, enums as camelCase strings).
  Data/          EF Core AppDbContext and entity configurations.
  Middleware/    Cross-cutting: global exception handling (ProblemDetails).
  Options/       Strongly typed configuration sections.
```

Conventions: constructor injection, one interface per service, controllers never touch data access directly.

## Configuration

- `appsettings.json` holds defaults, `appsettings.Development.json` holds local development overrides.
- Never commit secrets. Override any setting with an environment variable, using `__` for nesting, e.g. `Cors__AllowedOrigins__0=https://example.com`. Future secrets (DB connection string, AI key) go the same way, e.g. `ConnectionStrings__Default`.
- `appsettings.*.local.json` and `.env` are git-ignored for machine-specific values.
- Database: `ConnectionStrings:Default`. Accepts the Npgsql format (`Host=...;Port=...;Database=...;Username=...;Password=...`) or a `postgresql://user:password@host:port/database` URL (the format Dokploy shows). The API refuses to start without it.
  - **Local** (default): `appsettings.Development.json`, matching the docker-compose database.
  - **Local against another database** (e.g. the dev server): use user-secrets, stored outside the repo:
    ```bash
    dotnet user-secrets set "ConnectionStrings:Default" "<connection string>" --project backend/src/LinkUp.Api
    dotnet user-secrets clear --project backend/src/LinkUp.Api   # back to the local database
    ```
  - **Server** (Dokploy): set the environment variable `ConnectionStrings__Default`.
