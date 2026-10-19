# LinkUp API (ASP.NET Core)

Backend for the LinkUp night planner. .NET 10 SDK is pinned in `global.json`.

## Run

```bash
dotnet run --project backend/src/LinkUp.Api
```

Listens on `http://0.0.0.0:5000` (what the app's `EXPO_PUBLIC_API_URL` expects; Android emulator reaches it via `10.0.2.2`).

- Swagger UI (development only): http://localhost:5000/swagger
- OpenAPI spec: http://localhost:5000/openapi/v1.json
- Health check: `GET /health`
- Generate plans: `POST /api/plans/generate`

## Structure

```
backend/src/LinkUp.Api/
  Controllers/   HTTP endpoints. Thin: bind, call a service, return a DTO.
  Services/      Business logic behind interfaces (IPlanService), registered in Program.cs.
  Dtos/          Request/response records. Mirror app/src/types/api.ts (camelCase JSON, enums as camelCase strings).
  Middleware/    Cross-cutting: global exception handling (ProblemDetails).
  Options/       Strongly typed configuration sections.
```

Conventions: constructor injection, one interface per service, controllers never touch data access directly.

## Configuration

- `appsettings.json` holds defaults, `appsettings.Development.json` holds local development overrides.
- Never commit secrets. Override any setting with an environment variable, using `__` for nesting, e.g. `Cors__AllowedOrigins__0=https://example.com`. Future secrets (DB connection string, AI key) go the same way, e.g. `ConnectionStrings__Default`.
- `appsettings.*.local.json` and `.env` are git-ignored for machine-specific values.
