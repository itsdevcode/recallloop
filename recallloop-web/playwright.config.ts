import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "@playwright/test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "E2E requires TEST_DATABASE_URL for a migrated disposable database",
  );
const parsed = new URL(databaseUrl);
if (
  parsed.protocol !== "postgresql+asyncpg:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
  !parsed.pathname.endsWith("_test")
) {
  throw new Error(
    "E2E requires a local postgresql+asyncpg database ending in _test",
  );
}
const backendEnvFile = resolve("../recallloop-api/.env");
const localDatabaseUrl = existsSync(backendEnvFile)
  ? parseEnv(readFileSync(backendEnvFile, "utf8")).DATABASE_URL
  : undefined;
const developmentDatabaseUrl = process.env.DATABASE_URL ?? localDatabaseUrl;
if (
  developmentDatabaseUrl &&
  new URL(developmentDatabaseUrl).pathname === parsed.pathname
) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
}

const brokerUrl = process.env.TEST_CELERY_BROKER_URL;
if (!brokerUrl)
  throw new Error(
    "E2E requires explicit TEST_CELERY_BROKER_URL for an isolated local broker",
  );
const broker = new URL(brokerUrl);
if (
  !["redis:", "rediss:"].includes(broker.protocol) ||
  !["127.0.0.1", "localhost", "[::1]"].includes(broker.hostname) ||
  !/^\/[1-9][0-9]*$/.test(broker.pathname)
) {
  throw new Error(
    "E2E requires a local Redis-compatible test broker with a nonzero database number",
  );
}
const configuredBroker =
  process.env.CELERY_BROKER_URL ??
  (existsSync(backendEnvFile)
    ? parseEnv(readFileSync(backendEnvFile, "utf8")).CELERY_BROKER_URL
    : undefined);
if (configuredBroker && new URL(configuredBroker).href === broker.href)
  throw new Error("Test broker must differ from development broker");

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://127.0.0.1:13000", browserName: "chromium" },
  webServer: [
    {
      command:
        "uv run --project ../recallloop-api uvicorn tests.browser_app:app --app-dir ../recallloop-api --host 127.0.0.1 --port 18000",
      url: "http://127.0.0.1:18000/api/v1/health",
      env: {
        DATABASE_URL: databaseUrl,
        CELERY_BROKER_URL: brokerUrl,
        JWT_SECRET_KEY: randomBytes(48).toString("base64url"),
        APP_ENV: "development",
        AUTH_COOKIE_SECURE: "false",
        FRONTEND_ORIGIN: "http://127.0.0.1:13000",
        CORS_ORIGINS: "http://127.0.0.1:13000",
      },
      reuseExistingServer: false,
    },
    {
      command:
        "uv run celery -A tests.browser_worker:celery_app worker --loglevel=warning --concurrency=1 --without-gossip --without-mingle",
      cwd: "../recallloop-api",
      wait: { stdout: /fixture worker ready/ },
      env: {
        DATABASE_URL: databaseUrl,
        CELERY_BROKER_URL: brokerUrl,
        GEMINI_API_KEY: "fixture-key-no-live-provider",
        APP_ENV: "development",
      },
      gracefulShutdown: { signal: "SIGTERM", timeout: 150000 },
      reuseExistingServer: false,
    },
    {
      command: "npm start -- --hostname 127.0.0.1 --port 13000",
      url: "http://127.0.0.1:13000",
      env: { API_INTERNAL_URL: "http://127.0.0.1:18000" },
      reuseExistingServer: false,
    },
  ],
});
