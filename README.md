# RecallLoop

**Save it. Learn it. Remember it.**

RecallLoop is an open-source learning companion that aims to turn saved articles
into personalized recall cards, then schedule reviews with spaced repetition.

## The problem

Bookmarks help us collect information, but rarely help us remember it. RecallLoop
will bridge that gap with short active-recall questions and regular reviews.

## Current scope

This first foundation PR implements:

- A FastAPI application with versioned routing and configurable CORS.
- `GET /api/v1/health`, returning `{"status":"ok","service":"recallloop-api"}`.
- Environment-based settings, async PostgreSQL session support, shared SQLAlchemy
  metadata, and an async Alembic migration environment.
- A responsive Next.js placeholder with reusable button and container components.
- Backend tests, Ruff, ESLint, strict TypeScript, and dependency lockfiles.

The Get Started button is a disabled placeholder, with a visible coming-soon note.
The frontend does not call the API yet. There are no business tables or migration
revisions, and the health endpoint reports application liveness rather than
PostgreSQL readiness.

### Planned MVP

1. Registration and login.
2. Save article URLs and extract their readable content with Trafilatura.
3. Identify key concepts and generate recall questions and answers with an
   open-weight Gemma model.
4. Review cards and rate recall as Forgot, Hard, or Easy.
5. Schedule subsequent reviews with spaced repetition.

Authentication, article management, extraction, AI, review scheduling, Celery,
and Redis-compatible Render Key Value / Valkey are future work. They are not
installed or implemented in this PR.

## Stack

| Area | Foundation |
| --- | --- |
| API | Python 3.12+, FastAPI, Pydantic v2 / Pydantic Settings |
| Database | PostgreSQL, SQLAlchemy 2.0 async sessions, asyncpg, Alembic |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS |
| Checks | Pytest, Ruff, ESLint, TypeScript |
| Deployment target | Render; deployment configuration is planned |

## Repository structure

```text
recallloop-api/
  app/
    main.py              # Application factory and lifespan
    api/v1/router.py     # Versioned health endpoint
    core/config.py       # Environment settings
    db/base.py           # DeclarativeBase / shared metadata
    db/session.py        # Async session dependency
  alembic/
    env.py               # Async and offline migrations
    versions/            # Empty until business models are introduced
  alembic.ini
  tests/                 # Health, CORS, and environment configuration tests
  pyproject.toml
  uv.lock
  .env.example
recallloop-web/
  src/app/               # Root layout, global styles, home page
  src/components/        # Reusable button and responsive container
  src/lib/config.ts      # Public API base URL
  package.json
  package-lock.json
  .env.example
LICENSE
```

## Prerequisites

- Ubuntu or another system with Python 3.12+.
- Node.js 22+ and npm (Node.js 24 LTS is suitable).
- PostgreSQL for database operations. It is unnecessary for health checks or tests.
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for the locked Python
  environment, or Python's built-in `venv` and pip.

Run each service from its own directory. They can run independently.

## Backend setup

```bash
cd recallloop-api
cp .env.example .env
uv sync --locked --extra dev
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Edit `.env` to use your local database credentials. Never commit it.
For a pip-based setup instead of uv:

```bash
cd recallloop-api
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The pip route resolves the ranges in `pyproject.toml`; `uv sync --locked` uses the
committed lockfile for reproducible versions.

- Health: <http://localhost:8000/api/v1/health>
- Interactive API documentation: <http://localhost:8000/docs>

```bash
curl http://localhost:8000/api/v1/health
# {"status":"ok","service":"recallloop-api"}
```

### Backend environment

| Variable | Meaning |
| --- | --- |
| `APP_NAME` | API documentation title; defaults to `RecallLoop API` |
| `APP_ENV` | Environment label; defaults to `development` |
| `DATABASE_URL` | PostgreSQL connection string using `postgresql+asyncpg://` |
| `CORS_ORIGINS` | Comma-separated origins, e.g. `http://localhost:3000,https://app.example.com` |

Settings read `.env` in the working directory, and process environment variables
take precedence. CORS defaults to `http://localhost:3000`; configure explicit
origins without trailing slashes. Do not use a wildcard with credentialed requests.
`APP_ENV` is descriptive and does not automatically change other settings.

`DATABASE_URL` is required for sessions and migrations. The API can start without
it; even with a configured URL, no database connection is made until database work
is requested. The application disposes of its engine on shutdown. Session consumers
must explicitly commit write transactions; the dependency closes sessions and rolls
back uncommitted work.

## PostgreSQL configuration

For an Ubuntu development machine:

```bash
sudo apt update
sudo apt install postgresql postgresql-client
sudo systemctl start postgresql
sudo -u postgres psql
```

Inside psql, create a local role and database. `\password` prompts for a password:

```sql
CREATE ROLE recallloop LOGIN;
\password recallloop
CREATE DATABASE recallloop OWNER recallloop;
\q
```

Set `DATABASE_URL` in `recallloop-api/.env` using that role, password, and database:

```dotenv
DATABASE_URL=postgresql+asyncpg://recallloop:YOUR_URL_ENCODED_PASSWORD@localhost:5432/recallloop
```

Percent-encode reserved characters in credentials. The example values in
`.env.example` are placeholders. Tests do not create tables or contact PostgreSQL.

## Alembic

Run these commands from `recallloop-api`, with `DATABASE_URL` configured:

```bash
# Inspect the migration graph; no connection required.
uv run alembic heads
uv run alembic history

# Load settings and the PostgreSQL dialect, and generate SQL without connecting.
uv run alembic upgrade head --sql

# Once future models have been added and imported in alembic/env.py:
uv run alembic revision --autogenerate -m "describe schema change"
# Review the generated revision before applying it.
uv run alembic upgrade head
uv run alembic current
```

There are deliberately no revisions yet. Offline SQL output verifies configuration,
not live connectivity or schema parity. Autogeneration, online upgrades, and
`alembic current` require a running database. Alembic reads the same settings and
`Base.metadata` as the application, and uses asyncpg for online migrations. No
credentials are stored in `alembic.ini`.

## Frontend setup

In a separate terminal:

```bash
cd recallloop-web
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000>. The placeholder works without the API running.

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000` and is exposed through
`src/lib/config.ts` as `API_BASE_URL`. It is the service origin; future API callers
should append `/api/v1/...`. Next.js embeds public variables at build time, so set
the deployed API URL before building and rebuild after changing it. Never put
secrets in `NEXT_PUBLIC_` variables.

The page uses local system fonts and a warm ivory, forest-green, and sage palette.
It does not need an external font service to build or render.

## Local checks

Backend, from `recallloop-api`:

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
uv run python -c 'from app.main import app; from app.db.base import Base; from app.db.session import get_session; print(app.title)'
uv run alembic heads
uv run alembic upgrade head --sql
```

The last command requires a configured URL but no live PostgreSQL instance. For
example, use the placeholder URL from `.env.example`. The tests check the exact
health response with absent and unreachable database configurations, and CORS
allow/deny behavior, plus database URL and comma-separated origin settings. With pip, activate `.venv` and omit `uv run`.

Frontend, from `recallloop-web`:

```bash
npm run lint
npm run typecheck
npm run build
npm start
```

Type checking generates Next.js route types first, so it works on a clean checkout.
Run lint separately from the production build. `npm start` serves the production
build on port 3000; stop the development server first if it is using that port.

## Planned Render deployment

Deployment is future work; this PR does not create cloud resources or add a
Blueprint. The intended setup is:

- A web service rooted at `recallloop-api`, installing the Python package and
  running `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"`.
- Managed PostgreSQL with its connection URL configured as `DATABASE_URL`, using
  the `postgresql+asyncpg://` scheme. Run migrations as a separate deployment step.
- A Node web service rooted at `recallloop-web`, with `npm ci && npm run build`
  for builds and `npm start -- --hostname 0.0.0.0 --port "$PORT"` for startup.
- Explicit production `CORS_ORIGINS` on the API and `NEXT_PUBLIC_API_URL` set before
  building the frontend. Use `/api/v1/health` for API liveness checks.

Workers, Key Value, extraction, and model hosting will be designed when those
features are introduced.

## License

[MIT](LICENSE).
