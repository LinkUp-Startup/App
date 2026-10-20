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

PostgreSQL 18 runs in a container defined in `docker-compose.yml` at the repo root. The image is multi-arch (x86-64 and ARM64), so it works on every laptop and on the VPS.

### Requirements

| OS      | Install                                                                                                  |
| ------- | -------------------------------------------------------------------------------------------------------- |
| Windows | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) (WSL 2 backend)          |
| macOS   | [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/)                             |
| Linux   | Docker Engine + Compose plugin, Docker Desktop, or Podman (use `podman compose` instead of `docker compose`) |

Plus the .NET 10 SDK (any 10.0 feature band, see `global.json`).

### First-time setup

From the repo root:

```bash
docker compose up -d                          # 1. start PostgreSQL
docker compose ps                             # 2. wait until STATUS shows "healthy"
cd backend && dotnet tool restore && cd ..    # 3. install the pinned dotnet-ef CLI
dotnet run --project backend/src/LinkUp.Api   # 4. start the API
curl http://localhost:5000/health             # 5. expect "database":"healthy"
```

No extra configuration needed: `appsettings.Development.json` already points at this database.

### Everyday commands

```bash
docker compose up -d          # start (data persists in the `linkup_db-data` volume)
docker compose down           # stop, keep data
docker compose down -v        # stop and wipe the database
docker compose exec db psql -U linkup -d linkup   # SQL shell
```

| Setting  | Default     |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5432`      |
| Database | `linkup`    |
| User     | `linkup`    |
| Password | `linkup`    |

These are local-only development credentials. To change them, copy `.env.example` to `.env` in the repo root and edit it, then set the matching connection string (see [Configuration](#configuration)).

### Troubleshooting

| Problem                                                                    | Fix                                                                                                         |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `failed to connect to the docker API` / `Cannot connect to the Docker daemon` | Docker isn't running: start Docker Desktop, or `sudo systemctl start docker`. Podman: `systemctl --user start podman.socket` |
| `port is already allocated` / `address already in use` on 5432             | A local PostgreSQL is running. Stop it, or set `POSTGRES_PORT=5433` in `.env` and use `Port=5433` in the connection string |
| `/health` returns `503` with `"database":"unhealthy"`                       | Container not running or not healthy yet (`docker compose ps`), or the connection string doesn't match `.env` |
| `password authentication failed` after changing `.env`                      | The password is only set when the volume is first created. Reset with `docker compose down -v` (wipes data) |
| `A compatible .NET SDK was not found`                                       | Install a .NET 10 SDK                                                                                         |

## Database tooling

EF Core (with the Npgsql PostgreSQL provider) is the ORM. The `dotnet-ef` CLI is pinned as a local tool in `dotnet-tools.json`; restore it once per clone:

```bash
cd backend
dotnet tool restore
dotnet ef --version
```

Migrations live in `src/LinkUp.Api/Data/Migrations`. Run from `backend/`:

```bash
dotnet ef migrations add <Name> --project src/LinkUp.Api --output-dir Data/Migrations   # after changing entities
dotnet ef database update --project src/LinkUp.Api                                     # apply to the local database
dotnet ef migrations remove --project src/LinkUp.Api                                   # undo the last, unapplied migration
```

To apply to another database (e.g. `project_dev`), set `ConnectionStrings__Default` for that command. Commit the generated migration files together with the entity changes.

## Tests

xUnit tests live in `tests/LinkUp.Api.Tests`: unit tests plus HTTP tests that run the real API in memory (`WebApplicationFactory`, see `ApiFactory`). They don't need a database.

```bash
dotnet test backend/LinkUp.sln
dotnet test backend/LinkUp.sln --collect:"XPlat Code Coverage;Format=opencover"   # with coverage
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
