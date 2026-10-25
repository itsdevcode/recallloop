# Render launch runbook

This is a configuration-only release. No cloud resource or deployment is claimed.
**Do not create or sync the Blueprint until the operator explicitly approves the
paid resources.** `autoDeployTrigger: "off"` prevents later commit-triggered
deployments; it does not prevent initial provisioning/deployment when a Blueprint
is created. Review resource names against the target workspace before applying;
never attach this Blueprint to unrelated existing resources.

## Reviewed configuration

`render.yaml` defines one production project environment in Oregon with:

| Resource | Root / runtime | Proposed compute plan | Purpose |
| --- | --- | --- | --- |
| recallloop-web | recallloop-web / Node 24 | 0.5c-512mb | Next.js server and same-origin API proxy |
| recallloop-api | recallloop-api / Python 3.12 | 0.5c-512mb | FastAPI, public liveness, private application data |
| recallloop-worker | recallloop-api / Python 3.12 | 0.5c-512mb | Celery, concurrency 1 |
| recallloop-db | PostgreSQL 16 | 0.1c-256mb | Durable application state |
| recallloop-broker | Key Value / Valkey | 256mb | Queue, noeviction, journal-snapshot persistence |

All selected plans are paid. Verify the final price and workspace eligibility in
the Dashboard before approval. Workers have no free compute plan. Free web services
cannot receive private-network traffic, so a free API would break the internal
web-to-API connection. A free web frontend can initiate private requests, but sleeps
and cold starts make it unsuitable for this proposed always-on launch. Free Key
Value has no persistence; free PostgreSQL is intended for evaluation rather than
this production configuration. No pricing or capacity benchmark is implied.

References checked on 2026-10-25:
[Blueprint specification](https://render.com/docs/blueprint-spec),
[compute plans](https://render.com/docs/compute-plans),
[private networking](https://render.com/docs/private-network),
[environment variables](https://render.com/docs/configure-environment-variables),
[workers](https://render.com/docs/background-workers), and
[Key Value persistence](https://render.com/docs/key-value#data-persistence).

The Blueprint is validated against Render's current public JSON Schema. It uses
current compute plan IDs. Schema validation does not verify account entitlement,
resource-name collisions, provider credentials, or actual capacity. Reproduce the
read-only schema check from the repository root:

```bash
uv run --with pyyaml --with jsonschema python scripts/validate-render.py
```

The Render CLI is not installed in this development environment; run
`render blueprints validate render.yaml` with a current CLI before applying.

## Build and service configuration

Commands and root directories are authoritative in `render.yaml`. Python builds
install pinned uv then use `uv sync --frozen --no-dev`; startup uses `--no-sync`.
The API serves one Uvicorn process; Celery consumes with concurrency one, prefetch
one, late acknowledgment, and 105/120-second soft/hard task limits. Its 150-second
shutdown allowance lets Celery finish a bounded job on SIGTERM. Do not use `--reload`.

The web build is `npm ci && npm run build`; runtime binds `0.0.0.0:$PORT`.
`API_INTERNAL_URL` references the API's private `hostport`. The server proxy adds
`http://` when the value has no scheme. It is read at request time and never sent
to the browser. No `NEXT_PUBLIC_API_URL` is required by the current UI. Such variables
are embedded at build time and must never contain internal addresses or secrets.
The landing page is statically rendered, uses CSS instead of bitmap assets, and
uses local system fonts without a font-provider request. No new UI dependencies.

## Environment variables

| Variable | API | Worker | Web |
| --- | --- | --- | --- |
| APP_ENV | production | production | — |
| DATABASE_URL | internal database reference | same reference | — |
| CELERY_BROKER_URL | internal Key Value reference | same reference | — |
| JWT_SECRET_KEY | generated secret | references API value for shared Settings validation | — |
| FRONTEND_ORIGIN | exact public HTTPS web origin, no trailing slash | references API | — |
| CORS_ORIGINS | same explicit HTTPS origin; comma-separated if needed | references API | — |
| AUTH_COOKIE_SECURE | true | true | — |
| GEMINI_API_KEY | operator-supplied secret | references API secret | — |
| GEMMA_MODEL | gemma-4-26b-a4b-it | same model | — |
| DB_POOL_SIZE / DB_MAX_OVERFLOW | 5 / 5 by default | ignored: worker uses NullPool | — |
| PROCESSING_REQUESTS_PER_DAY | default 10; keep aligned | default 10 | — |
| API_INTERNAL_URL | — | — | private API hostport reference |

Other supported auth settings retain their defaults: HS256, 15 minutes, host-only
`recallloop_session`, SameSite=Lax, path `/`. All services in this environment must
share workspace and region. Standard Render `postgresql://` connections are
normalized to `postgresql+asyncpg://` in Settings for API, worker, and Alembic.
Public datastore IP allowlists are empty. Use an approved private shell/job for
migrations rather than opening the database to the world.

Supply the final frontend origin and matching CORS value at initial creation.
Choose the service hostname/custom domain in advance; verify the actual assigned
URL before enabling registration. `sync: false` prompts only on initial creation;
subsequent changes must be made deliberately in the service environment settings.
Cross-service values refresh on Blueprint sync, not immediately on rotation.
Rotate JWT signing secrets on API and worker together; this signs users out.

## Explicit migration and deployment sequence

There is intentionally no import-time migration, worker migration, or automatic
pre-deploy migration command. Alembic is a separate operator action:

1. After cost approval, provision the chosen resources with application access
   restricted until setup is complete. Build the reviewed commit. Fresh services
   may start before schema initialization; liveness alone does not mean ready.
2. Back up the database and verify restore access before changing an existing
   installation. Stop writes and pause the worker if migration compatibility
   requires it. Review the upgrade/downgrade SQL and the release diff.
3. In the API service shell, using its root and environment, run:
   ```bash
   uv run --no-sync alembic current
   uv run --no-sync alembic upgrade head
   uv run --no-sync alembic heads
   uv run --no-sync alembic check
   ```
   This release adds no migration beyond `0004`; a new install applies 0001–0004.
   Run exactly one migration process, then deploy API, worker, and web from the
   same reviewed commit. Do not run migrations from each service start command.
4. Check public `/api/v1/health` (process liveness, no database access) and
   `/api/v1/ready` (database connectivity, bounded to three seconds, safe 503).
   Readiness does not assert that migrations are current or that broker/AI is ready;
   check Alembic and the release flow separately. Render's health check uses liveness.
5. Run `uv run --no-sync python -m app.ai.smoke` from the API shell with the real
   provider key. Never paste keys or article contents into logs/issues.
6. Run the release flow on the actual HTTPS origin: register, login, save a public
   sample, observe PENDING/PROCESSING → READY, reveal and rate a card, check updated
   dashboard/history, logout. Check cookie flags, CSRF rejection, mobile navigation,
   and private-response no-store headers. Only then enable public access.

Rollback means redeploying a compatible previous code version. Do not automatically
run `alembic downgrade`: schema rollback can drop data. Restore backups only under
an explicit recovery plan. Validate migrations in staging first.

## Reliability, monitoring and limits

The API pool is bounded to ten connections per process, waits five seconds for
checkout, recycles at 30 minutes, pings before use, and sets connection/query
timeouts. Workers use short-lived NullPool engines. Account for worker/recovery
connections and migration headroom before increasing processes or replicas.

PostgreSQL retains PENDING work, attempts, leases, and budgets. Recovery scans every
60 seconds; expired leases become eligible after 180 seconds. Reconciliation can
republish work after a broker loss; database fencing and attempt limits remain
authoritative. At-least-once delivery means duplicates can occur, and tasks are
designed to tolerate them. Exhausted jobs become FAILED and must follow the bounded
retry policy. Reviewed cards/history are preserved during regeneration.

`noeviction` protects queue keys from eviction but writes fail if memory fills.
Journal + Snapshot can lose the last second of writes. Neither broker persistence
nor a database commit makes database-and-publish atomic. Watch FAILED/PENDING age,
recovery warnings, provider errors/quotas, worker restarts, queue memory, database
connections and service memory. Initial 512 MB service plans are proposals, not
verified production sizing; load-test extraction/Argon2/Celery before a public surge.

Extraction retains public-IP/DNS/redirect checks, byte/time bounds, and a parser
subprocess with Linux resource limits. Provider work stays outside database
transactions. Safe errors omit provider output and secrets. SQL parameter logging
is hidden; API access logs are disabled in the proposed start command. Provider SDK
and hosting logs still need an operator review; never enable HTTP debug logging.

Registration and login currently have no distributed abuse limiter; processing has
persisted per-user quotas. Before public registration, configure and verify an edge
rate limit for auth and request-body limits (or implement a shared limiter). Do not
trust arbitrary forwarded client-IP headers for an application limiter. Configure
outbound network restrictions as defense in depth, and protect database backups.
Hardened defaults do not constitute a penetration test or production load test.

## Remaining public-launch work

Obtain explicit cost/deployment approval, choose the real domain, configure secrets,
verify the current provider model/key, supply operator privacy/contact/deletion and
backup-retention details, apply migrations, verify backups and auth abuse controls,
load-test the selected plans, run deployed HTTPS smoke tests, and replace the demo
placeholder in `docs/submission.md`. No live demo URL is available yet.
