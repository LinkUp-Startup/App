# shared

The API contract between the app (and later the website) and the backend. **Generated — do not edit by hand.**

| File           | Produced by                                              |
| -------------- | -------------------------------------------------------- |
| `openapi.json` | Building the backend (`dotnet build backend/LinkUp.sln`) |
| `api.ts`       | `npm run generate:api` in `app/`, from `openapi.json`    |

The C# DTOs in `backend/src/LinkUp.Api/Dtos` are the source of truth. To change the contract:

1. Edit the DTOs.
2. `dotnet build backend/LinkUp.sln`
3. `cd app && npm run generate:api`
4. Commit the DTOs and `shared/` together.

The app imports these types through `app/src/types/api.ts`. CI regenerates both files and fails if they differ from what is committed.
