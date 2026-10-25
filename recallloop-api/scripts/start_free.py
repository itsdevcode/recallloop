#!/usr/bin/env python3
"""Colocated supervisor for Render Free tier deployment.

Starts and supervises one FastAPI (Uvicorn) process and one Celery background
worker process inside a single 512MB Render Free web service. Runs Alembic
database migrations synchronously on startup before exposing the API.

Monitors both processes: if either process exits (such as Celery being terminated
by Linux cgroups OOM or unhandled exception), the supervisor terminates the remaining
process and exits immediately. This prevents the API from silently remaining up
and accumulating user articles that will never be processed.

Forwards SIGTERM and SIGINT to both child processes for clean graceful shutdown.
Respects Render's dynamic PORT environment variable.
"""

import logging
import os
import signal
import subprocess
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [free-supervisor] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("free_supervisor")


def run_migrations() -> None:
    """Run database migrations synchronously before launching servers.

    Render's Free tier provides no SSH shell access and does not support
    preDeployCommand (paid plans only). Running migrations here ensures the
    schema is updated before the API accepts requests.
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.warning("DATABASE_URL not set; skipping startup database migrations.")
        return

    logger.info("Applying database migrations via Alembic...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                logger.info("[alembic] %s", line)
        logger.info("Alembic migrations completed successfully.")
    except subprocess.TimeoutExpired:
        logger.error("Alembic migration timed out after 60 seconds.")
        sys.exit(1)
    except subprocess.CalledProcessError as err:
        logger.error("Alembic migration failed with exit code %s", err.returncode)
        if err.stdout:
            logger.error("[alembic stdout] %s", err.stdout.strip())
        if err.stderr:
            logger.error("[alembic stderr] %s", err.stderr.strip())
        sys.exit(err.returncode or 1)


def main() -> None:
    # 1. Synchronous migration check
    run_migrations()

    # 2. Prepare port and commands
    port = os.environ.get("PORT", "10000")
    logger.info("Starting colocated API and Celery worker (PORT=%s)...", port)

    uvicorn_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(port),
        "--no-access-log",
    ]

    # Concurrency strictly 1, without gossip/mingle to conserve 512MB RAM
    celery_cmd = [
        sys.executable,
        "-m",
        "celery",
        "-A",
        "app.workers.celery_app:celery_app",
        "worker",
        "--loglevel=warning",
        "--concurrency=1",
        "--without-gossip",
        "--without-mingle",
    ]

    # 3. Spawn processes
    logger.info("Spawning Uvicorn API process...")
    uvicorn_proc = subprocess.Popen(uvicorn_cmd)

    logger.info("Spawning Celery worker process (concurrency=1)...")
    celery_proc = subprocess.Popen(celery_cmd)

    procs = [("uvicorn", uvicorn_proc), ("celery", celery_proc)]
    shutting_down = False

    def handle_signal(sig_num: int, _frame) -> None:
        nonlocal shutting_down
        if shutting_down:
            return
        shutting_down = True
        sig_name = signal.Signals(sig_num).name
        logger.info("Received %s. Forwarding to child processes...", sig_name)

        # Forward signal to child processes
        for _, p in procs:
            if p.poll() is None:
                try:
                    p.send_signal(sig_num)
                except OSError:
                    pass

        # Allow child processes up to 15 seconds to shut down cleanly
        deadline = time.time() + 15
        while time.time() < deadline:
            if uvicorn_proc.poll() is not None and celery_proc.poll() is not None:
                break
            time.sleep(0.5)

        # Force kill any hung process
        for name, p in procs:
            if p.poll() is None:
                logger.warning("%s did not exit within grace period; sending SIGKILL.", name)
                try:
                    p.kill()
                except OSError:
                    pass

        logger.info("Colocated processes terminated. Exiting.")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    # 4. Supervision loop
    while not shutting_down:
        uvicorn_status = uvicorn_proc.poll()
        celery_status = celery_proc.poll()

        if uvicorn_status is not None:
            logger.error("Uvicorn API process exited with code %s.", uvicorn_status)
            shutting_down = True
            if celery_proc.poll() is None:
                logger.info("Stopping Celery worker...")
                try:
                    celery_proc.terminate()
                    celery_proc.wait(timeout=5)
                except Exception:
                    celery_proc.kill()
            sys.exit(uvicorn_status if uvicorn_status != 0 else 1)

        if celery_status is not None:
            logger.error(
                "Celery worker process exited unexpectedly with code %s (e.g. OOM or crash). "
                "Terminating Uvicorn API to prevent unhandled article queue accumulation.",
                celery_status,
            )
            shutting_down = True
            if uvicorn_proc.poll() is None:
                logger.info("Stopping Uvicorn API...")
                try:
                    uvicorn_proc.terminate()
                    uvicorn_proc.wait(timeout=5)
                except Exception:
                    uvicorn_proc.kill()
            sys.exit(celery_status if celery_status != 0 else 1)

        time.sleep(1)


if __name__ == "__main__":
    main()
