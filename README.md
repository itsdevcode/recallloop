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
- Bounded, SSRF-protected public HTML fetching and Trafilatura extraction in Celery.
- Hosted Gemma concepts and recall questions/answers with source evidence and validation.
- PostgreSQL job leases, bounded retries, per-user quotas, and recovery after queue loss.
- Dashboard quick-add, saved count, and recent articles. Get Started links to registration.
- Async SQLAlchemy sessions, Alembic migration, configurable settings and CORS.
- Backend security/integration tests and real-browser auth/library tests.

Planned PR #5 features include recall ratings (Forgot, Hard, Easy), daily reviews,
and spaced repetition. These planned features, social login, email verification, password recovery, refresh tokens, and cloud
resources are not implemented in this PR.

## Stack and structure

Python 3.12+, FastAPI, Pydantic v2, PostgreSQL 13+, async SQLAlchemy 2.0, asyncpg,
Alembic, pwdlib/Argon2, PyJWT, Next.js App Router, TypeScript, and Tailwind CSS.
Extraction uses aiohttp and Trafilatura; background processing uses Celery with
Redis-compatible Valkey, and hosted AI uses the Google GenAI Python SDK. Checks
use Pytest, Ruff, ESLint, TypeScript, and Playwright. The bounded parser subprocess requires Linux (Ubuntu/Render).

```text
recallloop-api/
  app/
    main.py                 # Factory, lifespan, safe validation errors
    api/v1/endpoints/       # Auth and article routes
    core/                   # Settings, hashing and JWT helpers
    db/                     # Shared Base and async sessions
    models/                 # User and Article typed models
    schemas/                # Validated auth/article inputs and safe public responses
    services/               # Auth, articles, queue publishing, and leased processing
    ai/                     # Gemma SDK client, prompts, and validated output
    workers/                # Celery tasks and automatic/manual reconciliation
    dependencies/auth.py    # Cookie authentication and CSRF checks
  alembic/                  # Registered metadata; 0001 users, 0002 articles, 0003 learning/jobs
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
`/dashboard`. Start the broker and worker below before saving articles. Registration does not automatically log in. Passwords must contain
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
| `GEMINI_API_KEY` | Google AI Studio key; server/worker only, no default |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it`; no silent model substitution |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0`; use Render's internal Key Value URL there |
| `PROCESSING_REQUESTS_PER_DAY` | `10` create/retry submissions per user per rolling 24h; range 1–100 |
| `TEST_DATABASE_URL` | Test runner only; explicit separate local database ending in `_test` |
| `TEST_CELERY_BROKER_URL` | Browser tests only; separate local Redis database, never database 0 |

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
| `POST /api/v1/articles` | JSON `{"url":"https://example.com/article"}`; 202 with PENDING metadata after commit/enqueue |
| `GET /api/v1/articles` | Own articles, newest first; `limit` 1–100, `offset` ≥0, optional `status` |
| `GET /api/v1/articles/{id}` | Own article metadata plus extracted `content` |
| `DELETE /api/v1/articles/{id}` | Owner only; 204, with CSRF protection |
| `GET /api/v1/articles/{id}/concepts` | Own concepts/cards when READY; `[]` while pending/processing/failed |
| `POST /api/v1/articles/{id}/retry` | Owner-only FAILED retry; 202, CSRF required, bounded attempts/quota |

Queue publication failure returns 503 with a safe message and leaves a saved FAILED
entry for owner retry. Duplicate URLs still return 409; invalid URLs return 422,
and exhausted user quota returns 429. Non-FAILED/exhausted retries return 409.

The list response contains `items`, `total`, `limit`, and `offset`. Summaries include
id, URL, title, source/domain, excerpt, status, safe error message, and UTC timestamps;
full content is neither loaded nor returned in list responses. Responses also expose
processing attempt count, model attribution, and a long-article coverage note. Missing and foreign-owned
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

### Processing and extraction bounds

Saving commits a PENDING article and publishes only its UUID to Celery, then returns
202. The form is released immediately after submission. Visible library/detail pages
poll every three seconds while jobs are active, stop on READY/FAILED, and pause after
100 polling requests until manually refreshed. Hidden tabs do not poll; leaving a
page cancels its polling timer. Failed entries offer Retry processing while attempts
remain. New detail pages show the concepts, supporting passages, questions, and
reveal-answer controls; daily review scheduling is explicitly reserved for PR #5.

The worker claims a 180-second, randomly fenced lease in a short transaction. It then
closes the session, securely extracts content, saves that content in another short
transaction, invokes Gemma outside any database transaction, and atomically replaces
concepts/cards and marks READY. If AI fails, extracted content remains available and
later attempts reuse it. Duplicate deliveries cannot claim a live lease; an expired
worker cannot write after another worker takes its lease. Deleting an article during
processing prevents a later worker from recreating it.

- Only public HTTP(S) HTML/XHTML on standard ports 80/443; at most three redirects.
- Maximum 1 MiB body, checked via Content-Length and streamed bytes. Identity
  encoding is requested; compressed responses are conservatively rejected.
- Three-second connect/read timeouts, ten seconds per hop, and twelve seconds
  across DNS and the complete redirect/download chain.
- Trafilatura parses fetched bytes in an awaited subprocess: five-second wall,
  three-second CPU, 512 MiB address-space limits. Timed-out children are killed/reaped.
  At least 200 characters and 30 words of readable text are required.
- The worker pipeline has a 95-second deadline; Celery soft/hard limits are 105/120
  seconds, below the 180-second lease/Redis visibility timeout. Concurrency and
  prefetch are one by default. Each task creates/disposes its own NullPool async
  engine/event loop; no database connection is created at module import.

### Gemma generation and disclosure

Production uses Google's hosted **`gemma-4-26b-a4b-it`** through `google-genai`,
not Gemini Flash, OpenAI, or a fallback model. Obtain `GEMINI_API_KEY` from Google
AI Studio. The SDK's installed async API was inspected during implementation.
See [Google's hosted Gemma guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).

AI reads the extracted text, identifies key ideas, writes understanding questions,
and drafts source-grounded answers. Up to three concepts are requested, with one
question/answer each; one or two are allowed when reliable material is limited.
Article text is sent to Google for this processing. Treat generated material as a
learning aid and check its evidence, especially for consequential claims.

Inputs are limited to 12,000 characters. Longer articles use deterministic beginning,
middle, and ending passages; the stored/displayed coverage note discloses omissions.
The full extracted text is retained in PostgreSQL. Untrusted article content is
quoted separately from application system instructions. No model tools, automatic
function execution, or SDK automatic continuation are enabled. Keys, cookies and
other user articles are not included in prompts; model text never chooses task
UUIDs, outbound URLs or database operations.

The adapter uses prompt-based JSON rather than assuming provider-enforced structured
output is supported identically across hosted Gemma/SDK versions. Pydantic validates
1–3 concepts, exact required fields, nonempty bounded text, duplicate titles/questions,
and verbatim evidence (whitespace normalized) in both the selected input and full
article. Invalid JSON/evidence receives one regeneration attempt; there is no repair
loop or model fallback. Each SDK request has a 30-second timeout and one transport
attempt, with a 65-second overall generation budget. Schema/excerpt validation does
not mathematically prove semantic entailment or factual quality; prompt injection
can still affect draft quality, but it cannot invoke tools or application actions.

Gemma 4 is developed by **Google DeepMind** and released under **Apache 2.0**;
see its [model card and license](https://ai.google.dev/gemma/docs/core/model_card_4).
RecallLoop does not distribute model weights. The repository's MIT license applies
to RecallLoop code, independently of model/provider terms.

### Queue reliability, recovery and abuse limits

PostgreSQL is the source of truth; Redis/Valkey is only the broker. No Celery result
backend is configured. Tasks/results accept JSON only, use late acknowledgment and
worker-loss redelivery, and carry only article UUIDs. Temporary website/provider
network failures and provider 429/5xx failures use two bounded retries (5s, 10s
backoff), with a total of three claimed attempts per article, including manual
retries and crash recovery. Each attempt can make at most two provider calls when
repair is necessary. Permanent extraction/output errors become FAILED; failure
messages never include raw provider/network responses or article bodies.

Each worker includes a lifecycle-managed reconciliation timer every 60 seconds,
without Celery Beat. It requeues PENDING records stale for 180 seconds and expired
PROCESSING leases, in batches of 100, after committing short row-lock transactions.
Publication is timestamp-fenced; duplicate publication remains safe. Exhausted jobs
become FAILED instead of looping. After losing a queue or killing a worker, recovery
normally starts within the stale/lease interval plus the next timer tick once the
broker/database/worker are available. Recovery can also be run explicitly:

```bash
cd recallloop-api
uv run python -m app.workers.reconcile
```

A persistent per-user `processing_budgets` row serializes quota usage across API
instances. By default ten create/manual-retry submissions are permitted in a rolling
24-hour window. The counter survives article deletion, so deleting/re-saving cannot
bypass it. Automatic retries do not consume new submission slots but remain capped
by the article attempt count. Failed queue publications consume a slot conservatively.
There is no cross-user billing or review scheduling in this implementation.

### Local broker and worker

On Ubuntu, Redis is a compatible local alternative to Valkey:

```bash
sudo apt install redis-server
sudo systemctl start redis-server
redis-cli ping
```

Configure `.env` with the broker URL and Google AI Studio key, then run from
`recallloop-api` in a separate terminal:

```bash
uv sync --locked --extra dev
uv run alembic upgrade head
uv run celery -A app.workers.celery_app:celery_app worker --loglevel=info --concurrency=1
```

Keep the API, web app and worker running. Migration `0003` adds `concepts`,
`recall_cards`, per-user budgets, article attempts/leases/recovery timestamps, and
model/coverage fields. Article deletion cascades through concepts to cards. Concept
positions are unique per article, and successful results are replaced atomically.
No authentication columns change. Existing PR #3 READY articles are moved to PENDING
while retaining their extracted text; reconciliation queues their AI generation.
Downgrading to `0002` removes learning/job tables and restores extraction-era status
meaning while preserving articles, content and users. Use downgrades only on disposable
or deliberately backed-up data; generated learning material is removed.

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
remain useful defense in depth. There is no JavaScript browser extraction, distributed inference scheduling, or
spaced-repetition algorithm in this PR.

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
# Isolated local test Redis; does not alter the development broker:
redis-server --bind 127.0.0.1 --port 56379 --save '' --appendonly no
# In another terminal, with TEST_DATABASE_URL still exported and migrated:
export TEST_CELERY_BROKER_URL='redis://127.0.0.1:56379/13'
npm run test:e2e
```

Browser tests start API/production web servers on ports 18000/13000 and a real
Celery prefork worker using the explicit isolated test broker. Only website/provider
I/O is replaced by `tests.browser_worker` fixtures; production has no mock flag or
fallback output. The real worker calls the real Gemma adapter against a mocked SDK
response, validates it, and persists results in PostgreSQL. Browser coverage includes
PENDING/PROCESSING/READY, failed-job retry, concepts/reveal-answer, mobile library
CRUD, and existing authentication. One PENDING snapshot and a transient list outage
are browser mocks for deterministic UI assertions. Test accounts remain in the
disposable database until the next backend cleanup. Do not run backend destructive
tests alongside browser/worker tests using the same database.
`npm start` serves the production app on port 3000 after a build.

## Render deployment preparation

No cloud resources are provisioned or deployed by this PR. The intended deployment
has five resources: Next.js web service, FastAPI web service, PostgreSQL, Render Key
Value/Valkey, and a **paid Render Background Worker**. Use the same workspace/region
for private communication. Follow the [worker guide](https://render.com/docs/background-workers)
and [Key Value guide](https://render.com/docs/key-value).

- API root `recallloop-api`: build `pip install .`; start
  `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"`. Apply `alembic upgrade head`
  in the deployment migration step before starting the new API/worker version.
- Worker root `recallloop-api`: build `pip install .`; start
  `celery -A app.workers.celery_app:celery_app worker --loglevel=info --concurrency=1`.
  It needs no inbound port or HTTP health check. Celery SIGTERM starts warm shutdown;
  set `maxShutdownDelaySeconds: 150` to let bounded jobs complete before SIGKILL.
  Interrupted jobs recover through leases/reconciliation.
- API and worker share `DATABASE_URL`, `CELERY_BROKER_URL`, `GEMINI_API_KEY`, and
  `GEMMA_MODEL`. Use PostgreSQL's asyncpg URL and the **internal** Key Value URL
  (`redis://...`, or authenticated internal URL if configured). Never expose broker
  credentials, database URLs, or the Google key through `NEXT_PUBLIC_` variables.
- Set Key Value eviction to `noeviction`. **Free Key Value is not durable**: all
  queue data is lost on restart/upgrade. Database recovery is required even with a
  paid durable broker because publishing and database commits are not atomic.
- Web root `recallloop-web`: build `npm ci && npm run build`; start
  `npm start -- --hostname 0.0.0.0 --port "$PORT"`. Set server-only
  `API_INTERNAL_URL` to the trusted API service origin.
- API auth: `APP_ENV=production`, generated `JWT_SECRET_KEY`,
  `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, exact HTTPS
  `FRONTEND_ORIGIN`, and matching explicit `CORS_ORIGINS` (never `*`). Configure the
  shared production settings on the worker too if using `APP_ENV=production` there.

The browser uses only the web origin's `/api/auth/...` and `/api/articles/...`;
Next.js forwards cookies/security headers only to allowlisted API paths and returns
host-only cookies for the web domain. Separate Render domains do not require
third-party cookies, `SameSite=None`, or a shared cookie Domain. Deployment-level
abuse controls and outbound restrictions remain defense in depth. Production Render
memory/performance and live provider access must be verified during deployment;
local real-broker tests use Redis 7, not a provisioned Render Valkey instance.

### Live Gemma smoke test

No live inference is claimed without an actual API key. With a valid key in the
API directory's `.env`, run the optional short, single-call smoke test:

```bash
cd recallloop-api
uv run python -m app.ai.smoke
```

It reports only model ID, elapsed time, success/failure category and concept count,
never the key, article body or raw provider error. The smoke bypasses repair so it
makes exactly one provider request. Deterministic tests always mock provider I/O.

## License

[MIT](LICENSE).
