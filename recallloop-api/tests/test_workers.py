import socket
import time
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from celery import Celery
from celery.exceptions import Retry
from kombu.exceptions import OperationalError

from app.services import queue
from app.services.article_processing import Outcome
from app.workers import tasks


def test_task_uses_bounded_retry_delay(monkeypatch):
    monkeypatch.setattr(tasks, "run_article", AsyncMock(return_value=Outcome("retry", 5)))
    retry = MagicMock(side_effect=Retry())
    monkeypatch.setattr(tasks.process_article_task, "retry", retry)
    with pytest.raises(Retry):
        tasks.process_article_task.run(str(uuid4()))
    retry.assert_called_once_with(countdown=5, exc=None)
    assert tasks.process_article_task.max_retries == 2


def test_actual_broker_connection_failure_is_bounded(monkeypatch):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    app = Celery("unreachable-test-broker", broker=f"redis://127.0.0.1:{port}/13")
    app.conf.update(
        broker_connection_timeout=1,
        task_publish_retry=False,
        broker_transport_options={
            "max_retries": 0,
            "socket_connect_timeout": 1,
            "socket_timeout": 1,
        },
    )
    monkeypatch.setattr(queue, "celery_app", app)
    started = time.monotonic()
    try:
        with pytest.raises(OperationalError):
            queue.publish_article(uuid4())
        assert time.monotonic() - started < 6
    finally:
        app.close()
