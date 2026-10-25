# Render Free-Tier Demonstration Deployment Guide

This runbook documents the deployment of RecallLoop on **Render Free-tier resources with zero intentionally paid services**.

> [!WARNING]
> **Evaluation & Demonstration Only — Not Production Ready**
> This deployment configuration is designed strictly for demonstration, evaluation, and testing. It operates within the strict bounds of Render's free tier. Do not use this configuration for mission-critical or commercial production workloads.

---

## 1. Overview and Architecture

The free demonstration Blueprint (`render.free.yaml`) provisions zero-paid resources across Oregon:

| Resource | Service Type | Runtime | Plan | Purpose |
| --- | --- | --- | --- | --- |
| **recallloop-web** | Web Service | Node 24 | `free` | Next.js frontend and server-side API proxy |
| **recallloop-api** | Web Service | Python 3.12 | `free` | Colocated FastAPI backend, Alembic migrations, & Celery worker |
| **recallloop-db** | PostgreSQL | PostgreSQL 16 | `free` | Relational application database (30-day lifetime) |
| **recallloop-broker** | Key Value | Valkey / Redis | `free` | In-memory Celery broker (`persistenceMode: off`) |

### Key Differences from Production (`render.yaml`)

1. **No Paid Background Worker**: Render Background Workers require a paid compute plan. On the free tier, Celery worker execution is colocated inside the `recallloop-api` web service container under a custom supervisor.
2. **No Private Web Networking**: Render Free web services cannot receive inbound private network traffic. The Next.js server-side proxy reaches the backend via its **public HTTPS URL** (`https://recallloop-api.onrender.com`).
3. **No Disk-Backed Key Value Persistence**: Free Key Value stores data in memory only (`persistenceMode: off`). Task recovery relies entirely on durable state reconciliation from PostgreSQL.
4. **Reduced Database Pool**: Connection pool size and max overflow are clamped to 2 to stay well within free PostgreSQL connection and memory boundaries.

---

## 2. Complete Environment Variables Reference

### A. Frontend Service (`recallloop-web`)

| Variable | Required Value / Source | Description |
| --- | --- | --- |
| `NODE_VERSION` | `24.21.0` | Pinned Node.js version. |
| `API_INTERNAL_URL` | `https://recallloop-api.onrender.com` | Public HTTPS URL of the backend web service. *Free web services cannot receive private traffic; do not use internal hostport references.* |

### B. Backend API & Colocated Worker Service (`recallloop-api`)

| Variable | Required Value / Source | Description |
| --- | --- | --- |
| `PYTHON_VERSION` | `3.12.12` | Pinned Python runtime. |
| `APP_ENV` | `production` | Enables production security checks (HTTPS cookies, strict origins). |
| `DATABASE_URL` | `fromDatabase: recallloop-db` (connectionString) | Internal connection string to the free PostgreSQL instance. Normalized to `postgresql+asyncpg://` automatically. |
| `JWT_SECRET_KEY` | `generateValue: true` | Generated 32+ character random secret for HS256 authentication cookies. |
| `FRONTEND_ORIGIN` | `https://recallloop-web.onrender.com` | Exact public HTTPS origin of the frontend (no trailing slash). |
| `CORS_ORIGINS` | `https://recallloop-web.onrender.com` | Explicit HTTPS origin matching `FRONTEND_ORIGIN`. |
| `AUTH_COOKIE_SECURE` | `"true"` | Enforces `Secure` flag on `recallloop_session` HttpOnly cookie. |
| `GEMINI_API_KEY` | Operator Secret (`sync: false`) | Google Gemini API key with access to `gemma-4-26b-a4b-it`. |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | Pinned Gemma inference model. |
| `CELERY_BROKER_URL` | `fromService: recallloop-broker` (connectionString) | Internal connection string to the free Key Value instance. |
| `DB_POOL_SIZE` | `"2"` | Reduced connection pool size for free tier limits. |
| `DB_MAX_OVERFLOW` | `"2"` | Reduced connection overflow for free tier limits. |
| `PROCESSING_REQUESTS_PER_DAY` | `"10"` | Rate limit for article processing per user per day. |

---

## 3. Colocated Supervisor Design (`scripts/start_free.py`)

Render Free tier does not support background worker services. To process background article extraction and active recall concept generation without paid infrastructure, the API and worker run together in a single container managed by `recallloop-api/scripts/start_free.py`.

### Supervisor Capabilities:
1. **Synchronous Migration Execution**: Runs `alembic upgrade head` before binding network ports.
2. **Concurrency Clamping**: Starts Celery with strictly `--concurrency=1`, `--without-gossip`, and `--without-mingle` to minimize RAM consumption.
3. **Dynamic Port Respect**: Reads Render's assigned `$PORT` (defaulting to 10000) and passes it to Uvicorn.
4. **Crash Detection & Anti-Orphan Defense**: Continuously monitors both Uvicorn and Celery child processes. If Celery crashes (e.g. from an Out-Of-Memory kill) or Uvicorn fails, the supervisor **immediately terminates the surviving process and exits with the failure exit code**. This prevents the API from remaining up while unable to process queued articles, and prompts Render's container orchestrator to restart the instance.
5. **Signal Forwarding**: Traps `SIGTERM` and `SIGINT` from Render, forwards them to both child processes, allows up to 15 seconds for bounded tasks to complete, and gracefully exits.

---

## 4. Technical Feasibility & Memory Review (512MB RAM)

Render Free web services provide **512 MB of RAM** and shared **0.1 vCPU**.

### Memory Footprint Breakdown:
* Python 3.12 base + standard library: ~35 MB
* FastAPI + Uvicorn + SQLAlchemy + asyncpg: ~65 MB
* Celery worker master process: ~60 MB
* Celery worker child process (`concurrency=1`, including `trafilatura`, `lxml`, `google-genai`): ~100 MB
* **Total Baseline Idle Footprint**: ~260 MB (~51% of capacity)
* **Active Processing Footprint (Normal Article)**: ~340–380 MB (~66–74% of capacity)
* **Headroom Remaining**: ~130–170 MB

### Feasibility Conclusion & Risks:
* **Feasible for Demonstration**: For standard articles (< 100 KB HTML) and low request volume, colocating the single-concurrency worker within 512 MB works.
* **OOM Risk on Large Documents**: If a user submits a multi-megabyte article or heavily nested DOM tree, Trafilatura/lxml DOM parsing can allocate 100+ MB, risking a Linux cgroup Out-Of-Memory kill (exit code 137).
* **CPU Contention**: Both the API event loop and Trafilatura text extraction share 0.1 vCPU. Ingestion tasks will temporarily degrade API response latency.
* **Process Recycling**: `worker_max_tasks_per_child=50` is configured in `celery_app.py` to periodically recycle the worker process and eliminate long-term Python heap fragmentation.

---

## 5. Next.js Public HTTPS Proxy Configuration

Because Render Free web services cannot receive private network traffic, the frontend and backend communicate through the backend's public HTTPS address.

In `recallloop-web/src/lib/server-proxy.ts`:
* The proxy reads `process.env.API_INTERNAL_URL`.
* When configured with `https://recallloop-api.onrender.com` (or `recallloop-api.onrender.com`), the proxy routes requests over public HTTPS.
* **Timeout Extended to 60s**: The fetch timeout is set to 60,000ms (`AbortSignal.timeout(60000)`) to accommodate Render's 30–50s cold-start spin-up time when the backend wakes from idle sleep.
* **Cookie & Security Preservation**: The proxy forwards browser `Cookie`, `Origin`, `X-CSRF-Protection`, and `Idempotency-Key` headers to the backend, and passes `Set-Cookie` headers back to the browser. Cookies remain first-party to the frontend domain with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes intact.

---

## 6. Database Migration Strategy on Free Plan

### Why Standard Methods Do Not Work on Free Tier:
* `preDeployCommand` is restricted to paid compute plans.
* Render Shell access (`render ssh`) is not available for free instances.
* Build environments cannot reach internal databases because builds execute outside the private network.

### Free-Tier Migration Execution:
The colocated supervisor executes migrations inside the live container environment right at startup:
```bash
uv run alembic upgrade head
```
* **Safety**: Because free web services only run a single instance (`numInstances: 1`), concurrent migration conflicts do not occur.
* **Transactional Locking**: Alembic wraps schema migrations within a PostgreSQL transaction with table-level exclusive locks on the schema version table.
* **Startup Gate**: If migrations fail or time out, the supervisor exits immediately before Uvicorn binds to `$PORT`, preventing traffic from reaching an unmigrated database.

---

## 7. Celery Task Recovery Across Sleep and Restarts

Render Free web services spin down after 15 minutes of zero HTTP traffic. When asleep:
1. Active processing is suspended.
2. In-memory broker state in Free Key Value is ephemeral (`persistenceMode: off`).

### How RecallLoop Recovers:
* **Durable PostgreSQL State**: When an article is submitted, its status is recorded in PostgreSQL as `PENDING` with an expiration lease. When a worker picks it up, it is marked `PROCESSING` with a 180-second lease token (`lease_expires_at`).
* **Startup Reconciliation**: Whenever the service wakes up from sleep upon receiving a new user request, Celery initializes the `Recovery` bootstep (`app.workers.recovery:Recovery`).
* **Automatic Re-enqueuing**: The reconciler queries PostgreSQL for any articles stuck in `PROCESSING` with expired leases or stale `PENDING` states:
  * Articles under the retry limit (`processing_attempts < 3`) are refreshed to `PENDING` and re-published to the Celery broker.
  * Articles exceeding the retry limit are safely marked `FAILED` with clear error explanations.
* **Zero Lost Work**: Even if Key Value completely loses its state during container shutdown, all unprocessed or interrupted articles are automatically re-queued upon waking.

---

## 8. Honest Assessment of Free-Tier Limitations

Operators deploying this demonstration must understand the following built-in Render free-tier limitations:

1. **15-Minute Idle Sleep & Cold Starts**:
   Web services spin down after 15 minutes without inbound HTTP requests. The next visit will experience a 30- to 60-second cold-start delay while the container boots and runs migration checks.
2. **750 Shared Monthly Instance Hours**:
   Free accounts receive 750 free instance hours per calendar month shared across all free services. Continuously running two free web services would consume 1,460 hours/month and exhaust the monthly allowance before mid-month. Services must sleep when idle to stay within quota.
3. **PostgreSQL 30-Day Lifetime**:
   Free Render PostgreSQL databases **expire and are permanently deleted after 30 days**. They do not support automated backups, point-in-time recovery, or persistent retention beyond 30 days.
4. **Key Value Ephemeral State**:
   Free Key Value instances have no disk persistence (`persistenceMode: off`). Any restart or maintenance completely clears broker queues.
5. **Worker Reliability**:
   Because the worker is colocated with the web service, background task processing is suspended whenever the web service goes to sleep.
6. **No Uptime Pingers**:
   Do **not** configure external uptime monitors or pinging bots to keep free services awake. Pinging free services to defeat idle sleep violates Render's Terms of Service and will exhaust your free monthly hours quota prematurely.
7. **Potential Usage Charges**:
   While this Blueprint uses only `free` plans, exceeding bandwidth quotas or accidentally adding paid add-ons in your Render workspace will result in billing.

---

## 9. Step-by-Step Deployment Instructions

### Step 1: Pre-Deployment Validation
Run the schema validator from the repository root to verify Blueprint syntax:
```bash
uv run --with pyyaml --with jsonschema python scripts/validate-render.py render.free.yaml
```

### Step 2: Create the Blueprint Instance in Render
1. Log in to the [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your repository (`https://github.com/itsdevcode/recallloop`).
4. Select the branch: `feat/free-render-deployment`.
5. Specify the Blueprint path: `render.free.yaml`.
6. Click **Continue**.

### Step 3: Populate Required Secrets
Render will detect variables marked `sync: false` and prompt for them:
* `GEMINI_API_KEY`: Enter your Google Gemini API key.
* `FRONTEND_ORIGIN`: Enter `https://recallloop-web.onrender.com` (or your assigned web service URL).
* `CORS_ORIGINS`: Enter the same `https://recallloop-web.onrender.com` origin.
* `API_INTERNAL_URL`: Enter `https://recallloop-api.onrender.com` (the public HTTPS address of the API service).

### Step 4: Initial Deploy and Verification
1. Click **Apply Blueprint**.
2. Wait for `recallloop-db` and `recallloop-broker` to become available.
3. Observe the `recallloop-api` build and deploy logs:
   * Verify Alembic migrations run and report completion.
   * Verify both Uvicorn and Celery launch successfully.
4. Open `https://recallloop-web.onrender.com` in your browser.
5. Test creating an account, logging in, and saving an article to verify end-to-end active recall processing.
