#!/usr/bin/env bash
set -euo pipefail

# Start the colocated API and Celery worker supervisor
exec python scripts/start_free.py
