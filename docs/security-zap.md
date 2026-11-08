# OWASP ZAP security scan

Sprint 2 added a web component (the website at https://linkup.th7bo.dev), so the website and the API it uses
are scanned with [OWASP ZAP](https://www.zaproxy.org/) 2.17.0 (#184).

## How we scan

| Scan              | Target                                    | Kind                        | Where                          |
| ----------------- | ----------------------------------------- | --------------------------- | ------------------------------ |
| Website baseline  | https://linkup.th7bo.dev (production)     | Passive: spider + headers   | By hand (`zap-baseline.py`)    |
| API baseline      | https://linkup-api.th7bo.dev (production) | Passive, from the OpenAPI   | By hand (`zap-api-scan.py -S`) |
| Website full scan | A copy started in CI                      | Active: spider + attacks    | `.github/workflows/zap.yml`    |
| API full scan     | A copy started in CI, logged in           | Active, every OpenAPI route | `.github/workflows/zap.yml`    |

- **Active scans never run against production.** They send thousands of attack requests, which would hit the
  rate limits and the AI plan generator. The workflow starts PostgreSQL, the API and the website in the job
  instead. The API runs without an AI key, so it returns stub plans and the scan costs nothing.
- The workflow creates an account with a saved, shared plan, so the website scan starts at a real shared plan
  page and the API scan sends the account's token (`ZAP_AUTH_HEADER_VALUE`) to reach the logged-in endpoints.
- It runs every Monday, by hand (Actions → OWASP ZAP → Run workflow) and on pull requests that change the ZAP
  files. Reports (HTML, JSON, Markdown) are uploaded as the `zap-reports` artifact and shown in the job summary.
- Rule overrides go in `.github/zap/web-rules.tsv` and `.github/zap/api-rules.tsv`, each explained below.
  There are none: no finding needed to be ignored.

Baseline commands (production, passive only):

```bash
podman run --rm -v "$PWD/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:2.17.0 \
  zap-baseline.py -t https://linkup.th7bo.dev -m 2 -r web-baseline.html -I
podman run --rm -v "$PWD/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:2.17.0 \
  zap-api-scan.py -t /zap/wrk/openapi.json -f openapi -O https://linkup-api.th7bo.dev -S -r api-baseline.html -I
```

The production API doesn't serve its OpenAPI document, so the API scan reads `shared/openapi.json` from the
repository (copied into `zap/`).

## Results

### Before: production, 8 November 2026

No high-risk findings. Every finding was a missing or unsafe response header.

| Risk   | Finding                                          | Website | API |
| ------ | ------------------------------------------------ | ------- | --- |
| Medium | Content Security Policy header not set (10038)   | 4       | –   |
| Medium | Missing anti-clickjacking header (10020)         | 2       | –   |
| Low    | Strict-Transport-Security header not set (10035) | 5       | 5   |
| Low    | X-Content-Type-Options header missing (10021)    | 5       | 3   |
| Low    | Cross-Origin-Resource-Policy missing (90004)     | 5       | 3   |
| Low    | Cross-Origin-Embedder-Policy missing (90004)     | 2       | –   |
| Low    | Cross-Origin-Opener-Policy missing (90004)       | 2       | –   |
| Low    | Permissions-Policy header not set (10063)        | 5       | –   |
| Low    | Server leaks "X-Powered-By: Next.js" (10037)     | 4       | –   |

### Fixes

**Website** (`web/next.config.ts`, `web/src/proxy.ts`)

- A strict **Content Security Policy** with a fresh nonce for every page: only the scripts and styles Next.js
  renders with that nonce run, so injected scripts don't. No `unsafe-inline`, and `unsafe-eval` only in local
  development (React needs it there for error details). `frame-ancestors 'none'`, `object-src 'none'`,
  `form-action 'self'`, `base-uri 'self'`. Pages are rendered per request, because a nonce can't be added to a
  page built ahead of time.
- `X-Frame-Options: DENY` (with `frame-ancestors`) against clickjacking.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` turning off camera, microphone, location, payment and USB.
- `Cross-Origin-Opener-Policy`, `-Resource-Policy` (`same-origin`) and `-Embedder-Policy` (`require-corp`).
- No `X-Powered-By` header.

**API** (`backend/src/LinkUp.Api/Middleware/SecurityHeadersMiddleware.cs`)

- On every response, including errors and rate-limit (429) responses: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin` and a
  deny-all `Content-Security-Policy` (the API only returns JSON).
- `Strict-Transport-Security` outside development.
- No `Server: Kestrel` header.

Both are covered by tests (`SecurityHeadersTests`, `web/src/__tests__/proxy.test.ts`), and the website was
checked in a browser: every page still loads its scripts, styles and fonts with no policy errors.

### After: full (active) scans in CI

| Target  | High | Medium | Low | Informational |
| ------- | ---- | ------ | --- | ------------- |
| Website | 0    | 0      | 0   | 4             |
| API     | 0    | 0      | 0   | 3             |

The first CI run still reported one Low on the API: `Cross-Origin-Resource-Policy` was `same-site`, and ZAP
asks for `same-origin`. It is now `same-origin`; this policy only limits other sites embedding the API's
responses, so the app and the website (which call the API directly) are not affected.

The active scans found no injection (SQL, XSS, path traversal, command injection), no authentication or
session problems and no information leaks.

### After: production, 8 November 2026 (fixes deployed)

The same passive baselines as before, against the live website and API:

| Target  | High | Medium | Low | Informational |
| ------- | ---- | ------ | --- | ------------- |
| Website | 0    | 0      | 0   | 3             |
| API     | 0    | 0      | 0   | 5             |

All 9 website findings and all 3 API findings from before are gone.

### Remaining informational findings (no change needed)

| Finding                                     | Why it stays                                                                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-storable / storable content (10049)     | Describes caching. Pages and API answers are personal or change, so they are not cached; Next.js's hashed static files are cached for long. Both intended. |
| User agent fuzzer (10104)                   | ZAP lists that it tried other user agents; the site answers them all the same.                                                                             |
| Client error response code (100000)         | The API answers 400, 401 and 404 to the scanner's invalid and unauthenticated requests, as it should.                                                      |
| Authentication request identified (10111)   | ZAP noting that `/api/auth/login` is a login endpoint.                                                                                                     |
| Re-examine cache-control directives (10015) | A reminder to check caching on API answers that have no `Cache-Control`; these are public data (the health check and the venue list).                      |

## Open points

- The HTML reports (production before and after, CI full scans) are attached to the Sprint 2 delivery.
- The website calls the API from its server, so all web users share one IP for the API's per-IP rate limit
  (300 requests per minute). Fine at the current traffic; worth revisiting if the website grows.
