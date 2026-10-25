# RecallLoop

**Save it. Learn it. Remember it.**

RecallLoop is an open-source learning companion that aims to turn saved articles
into personalized recall cards and schedule reviews with spaced repetition.
Bookmarks collect information; RecallLoop will help people remember it.

## Implemented and planned

Implemented:

- Independently runnable FastAPI API and Next.js frontend.
- PostgreSQL users with database-generated UUIDs, normalized unique emails,
  Argon2 password hashes, active status, and timezone-aware timestamps.
- Registration, login, current profile, and logout endpoints.
- Fifteen-minute HS256 JWTs transported only in an HttpOnly cookie.
- Same-origin API proxies, CSRF protection, registration/login pages, and a protected dashboard.
- Per-user article saving, paginated library, readable text details, and confirmed deletion.
- Bounded, SSRF-protected public HTML fetching and Trafilatura extraction.
- Dashboard quick-add, saved count, and recent articles. Get Started links to registration.
- Async SQLAlchemy sessions, Alembic migration, configurable settings and CORS.
- Backend security/integration tests and real-browser auth/library tests.

Planned MVP features include concept/question generation with an open-weight
Gemma model, recall ratings (Forgot, Hard, Easy), and spaced repetition. These planned features, Celery, Valkey,
social login, email verification, password recovery, refresh tokens, and cloud
resources are not implemented in this PR.

## Stack and structure

Python 3.12+, FastAPI, Pydantic v2, PostgreSQL 13+, async SQLAlchemy 2.0, asyncpg,
Alembic, pwdlib/Argon2, PyJWT, Next.js App Router, TypeScript, and Tailwind CSS.
Extraction uses aiohttp and Trafilatura. Checks use Pytest, Ruff, ESLint, TypeScript,
and Playwright. The bounded parser subprocess requires Linux (Ubuntu/Render).

```text
recallloop-api/
  app/
    main.py                 # Factory, lifespan, safe validation errors
    api/v1/endpoints/       # Auth and article routes
    core/                   # Settings, hashing and JWT helpers
    db/                     # Shared Base and async sessions
    models/                 # User and Article typed models
    schemas/                # Validated auth/article inputs and safe public responses
    services/               # Authentication, article ownership, safe fetch and extraction
    dependencies/auth.py    # Cookie authentication and CSRF checks
  alembic/                  # Registered metadata; 0001 users, 0002 articles
  tests/                    # Health, configuration and PostgreSQL integration
  pyproject.toml
  uv.lock
  .env.example
recallloop-web/
  src/app/                  # Landing, auth, dashboard, library/details, API proxies
  src/components/           # Forms, button and container
  src/lib/                  # Same-origin auth client and public API config
  tests/e2e/                # Authentication and mobile article library flows
  playwright.config.ts
  package.json
  package-lock.json
  .env.example
```

## Local setup

Use Python 3.12+, Node.js 22+ (24 LTS is suitable), npm, PostgreSQL 13+,
and [uv](https://docs.astral.sh/uv/getting-started/installation/).
On Ubuntu, install PostgreSQL and create a development database:

```bash
sudo apt update
sudo apt install postgresql postgresql-client
sudo systemctl start postgresql
sudo -u postgres psql
```

Inside psql:

```sql
CREATE ROLE recallloop LOGIN;
\password recallloop
CREATE DATABASE recallloop OWNER recallloop;
\q
```

The password prompt avoids putting a password in SQL history. Configure the API:

```bash
cd recallloop-api
cp .env.example .env
uv sync --locked --extra dev
python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Set `DATABASE_URL` in `.env` using your credentials, and uncomment/set
`JWT_SECRET_KEY` to the generated secret. Percent-encode reserved password
characters in the database URL. Example URL shape:

```dotenv
DATABASE_URL=postgresql+asyncpg://recallloop:YOUR_URL_ENCODED_PASSWORD@localhost:5432/recallloop
```

Then, from `recallloop-api`:

```bash
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For pip instead of uv, run `python3.12 -m venv .venv`, activate it, and run
`python -m pip install -e '.[dev]'`; omit `uv run` from later commands. This resolves
package version ranges instead of using `uv.lock`.

In another terminal:

```bash
cd recallloop-web
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000/register>, create an account, log in, and use Log out on
`/dashboard`. Registration does not automatically log in. Passwords must contain
12–128 characters; names are trimmed and limited to 120 characters, and emails
are trimmed, validated, lowercased, and limited to 255 characters.

The health route <http://localhost:8000/api/v1/health> and API documentation
<http://localhost:8000/docs> remain available. Health returns
`{"status":"ok","service":"recallloop-api"}` without connecting to PostgreSQL.
Authentication requires PostgreSQL and a JWT secret. The default development
configuration allows health checks without either; production requires a secret,
secure cookies, and an HTTPS frontend origin at startup.

## Environment settings

Settings read `.env` in the API working directory; process variables take precedence.
Never commit real `.env` files or secrets. Backend settings:

| Variable | Default / purpose |
| --- | --- |
| `APP_NAME` | `RecallLoop API` |
| `APP_ENV` | `development`; use `production` on Render |
| `DATABASE_URL` | `postgresql+asyncpg://...`; required for auth/migrations |
| `JWT_SECRET_KEY` | No default; generate at least 32 random characters |
| `JWT_ALGORITHM` | Only `HS256` is accepted |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15`; configurable from 1 to 15 |
| `FRONTEND_ORIGIN` | `http://localhost:3000`; exact browser origin, no trailing slash |
| `CORS_ORIGINS` | Comma-separated explicit origins; defaults to `http://localhost:3000` |
| `AUTH_COOKIE_NAME` | `recallloop_session` |
| `AUTH_COOKIE_SECURE` | `false` locally; must be `true` in production |
| `AUTH_COOKIE_SAMESITE` | `lax`; `strict` also supported |
| `AUTH_COOKIE_PATH` | `/`; required for proxy cookie forwarding |
| `TEST_DATABASE_URL` | Test runner only; explicit separate local database ending in `_test` |

Frontend `API_INTERNAL_URL` is the **server-only** FastAPI origin, defaulting to
`http://127.0.0.1:8000`. Browser requests use relative `/api/auth/...` and `/api/articles` URLs. `NEXT_PUBLIC_API_URL` remains available for future non-auth API clients;
it is embedded at build time and must never contain a secret. Do not use it to
send browser authentication directly across Render domains.

## Authentication and CSRF

| Endpoint | Behavior |
| --- | --- |
| `POST /api/v1/auth/register` | JSON name/email/password; public profile, HTTP 201; duplicate email 409 |
| `POST /api/v1/auth/login` | JSON email/password; public profile and session cookie |
| `GET /api/v1/auth/me` | Cookie required; public profile or 401 |
| `POST /api/v1/auth/logout` | Idempotent 204; clears the cookie, including for expired sessions |

Incorrect passwords, unknown emails, and inactive users receive the same 401
message. JWT verification requires `sub`, `iat`, and `exp`, explicitly permits
only HS256, and loads the active user from PostgreSQL. Password hashes are never
included in public schemas; validation errors omit raw inputs to avoid echoing
passwords. Argon2 work runs outside the async event loop.

All state-changing auth requests, including login and registration, require both
an `Origin` exactly equal to `FRONTEND_ORIGIN` and `X-CSRF-Protection: 1`.
Cross-site Fetch Metadata requests are also rejected. The custom header forces
cross-origin browser requests through preflight; explicit Origin validation
rejects other origins even if CORS is accidentally broadened. The header is a
non-simple-request guard, not a secret CSRF token. Future authenticated mutation
routes must also depend on `require_csrf`. This follows the
[OWASP custom-header and Origin guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

The Next.js proxies forward the original Origin, CSRF header, Fetch Metadata and
cookie only to fixed, allowlisted authentication/article paths. It never manufactures a
trusted Origin or CSRF header. It forwards Set-Cookie, and both proxies and API mark
private auth/article responses `no-store`. Bearer tokens and localStorage are not used. The
browser sends the HttpOnly, host-only cookie automatically; no Domain attribute
is set, and logout matches Path, HttpOnly, Secure, and SameSite attributes.

Logout **does not revoke an issued JWT**. A copied token remains valid until it
expires, unless the account is disabled/deleted or the signing key changes.
There is no token blacklist or refresh-token system. Signing-key rotation logs
out all sessions. HTTPS and login/register abuse controls at the deployment edge
should be configured before public launch; distributed rate limiting is not
implemented here.

For a manual API check, use a local cookie jar (do not commit it):

```bash
curl -i http://localhost:8000/api/v1/auth/register \
  -H 'Origin: http://localhost:3000' -H 'X-CSRF-Protection: 1' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Example User","email":"user@example.com","password":"StrongPassword123!"}'
curl -i -c /tmp/recallloop-cookies http://localhost:8000/api/v1/auth/login \
  -H 'Origin: http://localhost:3000' -H 'X-CSRF-Protection: 1' \
  -H 'Content-Type: application/json' \
  --data '{"email":"user@example.com","password":"StrongPassword123!"}'
curl -b /tmp/recallloop-cookies http://localhost:8000/api/v1/auth/me
curl -i -b /tmp/recallloop-cookies -c /tmp/recallloop-cookies \
  -X POST http://localhost:8000/api/v1/auth/logout \
  -H 'Origin: http://localhost:3000' -H 'X-CSRF-Protection: 1'
rm /tmp/recallloop-cookies
```

## Article library and API

Visit `/dashboard` to quick-add a URL and see the saved count and five recent
articles. `/dashboard/articles` provides a responsive library, ten articles per
page with Load more, status badges, retry for list/network errors, and explicit
delete confirmation. `/dashboard/articles/[id]` shows the original link and
extracted plain text. HTML from a remote page is never rendered as markup.

All article endpoints require the existing session cookie. POST/DELETE also use
the existing Origin and CSRF header checks; the browser calls their same-origin
Next.js proxy equivalents under `/api/articles`.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/v1/articles` | JSON `{"url":"https://example.com/article"}`; 201 with metadata/status |
| `GET /api/v1/articles` | Own articles, newest first; `limit` 1–100, `offset` ≥0, optional `status` |
| `GET /api/v1/articles/{id}` | Own article metadata plus extracted `content` |
| `DELETE /api/v1/articles/{id}` | Owner only; 204, with CSRF protection |

The list response contains `items`, `total`, `limit`, and `offset`. Summaries include
id, URL, title, source/domain, excerpt, status, safe error message, and UTC timestamps;
full content is neither loaded nor returned in list responses. Missing and foreign-owned
IDs both return 404. Every database query is scoped to the authenticated owner.
Migration `0002` adds the article foreign key, status check, per-user canonical URL
unique constraint, and indexes for owner/newest and owner/status queries. Different
users can save the same URL; duplicate saves for one user, including concurrent
requests, return 409. `alembic downgrade 0001` removes articles and their indexes
while preserving users; only use downgrade commands on disposable data.

Canonicalization lowercases/IDNA-normalizes the hostname, removes the fragment and
default port, and retains query ordering and parameters. Normalized URLs are limited
to 2048 encoded bytes. Redirect destinations and publisher-provided canonical tags
are not used as deduplication keys: two different submitted URLs can reach the same
article. Title remains null when unavailable; readable content is never invented.

### Extraction behavior and bounds

Saving waits for extraction. A single database transaction moves the article through
PENDING/PROCESSING to READY or FAILED before the 201 response; transient statuses
are reserved for future worker integration. A failed download/extraction still saves
a FAILED entry with a safe message, whereas invalid/unsafe URL syntax returns 422
without creating a record. Delete a FAILED entry and save it again to retry extraction.
A crash or cancelled request rolls back an unfinished creation rather than leaving
an orphaned PROCESSING record. There are no fire-and-forget jobs or Celery workers.

- Only public HTTP(S) HTML/XHTML articles on standard ports 80/443 are supported.
- Maximum three redirects; every target is validated independently.
- Maximum 1 MiB HTML body, checked against both Content-Length and streamed bytes.
- Compressed responses are rejected; the client requests identity encoding, preventing
  decompression bombs. Sites that ignore this request are currently unsupported.
- Connect/read timeout: 3 seconds each; each hop has a 10-second total timeout,
  and DNS plus the entire redirect/download chain has a 12-second deadline.
- At most four concurrent extractions per API process, with a 20-second bound
  including waiting for an extraction slot, fetching, and parsing.
- Trafilatura runs in an awaited subprocess with a 5-second wall deadline, a
  3-second CPU limit, and a 512 MiB address-space limit; timeouts kill/reap the child.
  It only parses already fetched bytes. Meaningful text requires 200 characters
  and 30 words. Comments and tables are excluded.

### SSRF security and current limitations

The fetcher rejects credentials, unsupported schemes/ports, local/internal
hostnames, loopback, private, link-local, multicast, reserved and non-global IPs,
known metadata IPs, and IPv6 translation/tunnel addresses. **Every DNS answer**
must be public. A custom aiohttp connector resolver returns those exact numeric
addresses to the socket connector, closing the check-then-resolve DNS rebinding
gap while retaining the hostname for Host/SNI and TLS certificate verification.
Numeric IP URLs are validated before aiohttp can bypass DNS. Automatic redirects,
environment proxies/netrc, cross-request cookies, and automatic decompression are
disabled. Browser authentication cookies/headers are never sent to article websites.
Network errors and parser stderr are not exposed; SQL parameter logging is hidden
so failures do not print submitted URLs or extracted content. See the
[aiohttp connector documentation](https://docs.aiohttp.org/en/stable/client_reference.html#tcpconnector)
for the resolver mechanism.

This is a conservative bounded HTML reader, not a browser: JavaScript-only pages,
paywalls, PDFs, large/compressed pages, and blocked sites may fail. Respect site
terms and access restrictions. A per-process concurrency bound is not distributed
abuse protection; deployment-level request controls and outbound network restrictions
remain useful defense in depth. No AI, recall cards, workers, or Valkey are installed.

## Migrations and tests

From `recallloop-api`:

```bash
uv run alembic heads
uv run alembic upgrade head
uv run alembic current
# Destructive: removes users and articles. Only run on a disposable database.
uv run alembic downgrade base
uv run alembic upgrade head
# After future model changes; review the generated revision.
uv run alembic revision --autogenerate -m "describe schema change"
```

Model modules are registered through `app.models` in Alembic's environment.
UUIDs use PostgreSQL `gen_random_uuid()`. Timestamp columns are timezone-aware;
`updated_at` is refreshed by SQLAlchemy updates. Session consumers explicitly
commit writes; uncommitted work is rolled back when the session closes. No
`create_all()` is used. Offline `uv run alembic upgrade head --sql` needs a URL
but no live connection.

Create a **disposable** database separately from development/production:

```bash
sudo -u postgres createdb -O recallloop recallloop_test
# From recallloop-api, using the local role/password:
export TEST_DATABASE_URL='postgresql+asyncpg://recallloop:YOUR_URL_ENCODED_PASSWORD@localhost:5432/recallloop_test'
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests read `TEST_DATABASE_URL` explicitly from the process environment, apply the
real Alembic migration, and truncate **only the test articles and users tables** between tests.
They refuse non-local hosts, names without `_test`, and any database sharing the
development database name (including `.env` configuration). The migration test
also downgrades/recreates the schema; the article migration test verifies that
downgrading to `0001` preserves existing users. Do not point this variable at valuable data;
do not run the database suite in parallel or alongside browser tests using the
same database. Without it, PostgreSQL tests are explicitly skipped; health and
configuration tests still run. SQLite is not a substitute.

Coverage includes normalization, Argon2 storage, concurrent duplicate inserts,
credential failures, inactive accounts, cookie login/logout, missing/expired/
forged/altered JWTs, CSRF failures, safe validation responses, migration round
trips, metadata parity, and test-database safeguards. Article coverage adds
ownership, per-user duplicate races, pagination, response byte/type limits,
redirect validation, DNS pinning, parser deadlines, and deterministic HTML extraction.

Frontend checks, from `recallloop-web`:

```bash
npm run lint
npm run typecheck
npm run build
# Once per machine (Ubuntu may require OS packages via install-deps):
npx playwright install --with-deps chromium
# With TEST_DATABASE_URL still exported and migrated by the backend suite:
npm run test:e2e
```

Browser tests start their own API and production web server on ports 18000 and
13000 with a generated test signing key. They preserve auth coverage and exercise
the mobile library through the real proxy/API/PostgreSQL stack: empty state,
adding, details, duplicate errors, list retry, failure status, and confirmed deletion.
The test-only `tests.browser_app` entry point supplies fixed HTML for fixture URLs
on `example.com`; it never fetches live websites. The production app has no network
bypass or fixture flag. A transient list outage is mocked in the browser. Test
accounts remain in the disposable database until the next backend test cleanup.
`npm start` serves the production app on port 3000 after a build.

## Planned Render deployment

No cloud resources are created by this PR. Run FastAPI and Next.js as web services:

- API root `recallloop-api`; install the Python package and run
  `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"`. Configure the managed
  PostgreSQL URL with the asyncpg scheme and apply `alembic upgrade head` in the
  deployment migration step.
- Web root `recallloop-web`; build with `npm ci && npm run build` and run
  `npm start -- --hostname 0.0.0.0 --port "$PORT"`. Set `API_INTERNAL_URL` to the
  trusted API service origin, using Render's private network where appropriate.
- On the API, set `APP_ENV=production`, a generated `JWT_SECRET_KEY`,
  `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, and
  `FRONTEND_ORIGIN=https://YOUR-WEB-SERVICE.onrender.com`. Set `CORS_ORIGINS` to
  that explicit origin, never `*`.

The browser talks only to the web origin's `/api/auth/...` and `/api/articles/...`; Next.js forwards to
FastAPI server-to-server and returns the host-only Set-Cookie to the browser.
The cookie therefore belongs to the **web** domain even when the API is on a
separate `onrender.com` domain. This avoids third-party cookies and does not
require `SameSite=None` or a shared cookie Domain. A custom web domain works the
same way after updating `FRONTEND_ORIGIN` and CORS. Keep the upstream URL under
server configuration control and use HTTPS for public service communication.
Health remains a liveness check, not database readiness.

## License

[MIT](LICENSE).
