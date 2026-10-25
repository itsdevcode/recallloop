"""Tests for the Render Free tier colocated supervisor script."""

import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

from scripts import start_free


def test_run_migrations_skipped_when_no_database_url(monkeypatch):
    """When DATABASE_URL is not set, migrations are skipped with a warning."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # Should not raise or call subprocess
    with patch("subprocess.run") as mock_run:
        start_free.run_migrations()
        mock_run.assert_not_called()


def test_run_migrations_success(monkeypatch):
    """When DATABASE_URL is set, alembic upgrade head is executed."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="Running upgrade head...", stderr="")
        start_free.run_migrations()
        mock_run.assert_called_once_with(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )


def test_run_migrations_failure_exits(monkeypatch):
    """When alembic fails, run_migrations exits with an error."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = subprocess.CalledProcessError(1, ["alembic"], "error")
        with pytest.raises(SystemExit) as excinfo:
            start_free.run_migrations()
        assert excinfo.value.code == 1


def test_supervisor_terminates_api_when_worker_dies(monkeypatch):
    """If the Celery worker crashes, the supervisor terminates Uvicorn and exits."""
    monkeypatch.delenv("DATABASE_URL", raising=False)

    mock_uvicorn = MagicMock()
    mock_uvicorn.poll.return_value = None  # Uvicorn still running

    mock_celery = MagicMock()
    # Celery worker crashed with exit code 137 (OOM)
    mock_celery.poll.return_value = 137

    with patch("scripts.start_free.run_migrations"):
        with patch("subprocess.Popen", side_effect=[mock_uvicorn, mock_celery]):
            with pytest.raises(SystemExit) as excinfo:
                start_free.main()

            assert excinfo.value.code == 137
            # Uvicorn must be terminated
            mock_uvicorn.terminate.assert_called_once()
