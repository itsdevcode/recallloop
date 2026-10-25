"""Real Celery worker and PostgreSQL; only website/provider I/O is replaced in tests."""

import asyncio
import json
from types import SimpleNamespace

from celery.signals import worker_ready

from app.ai import gemma
from app.services import extraction
from app.workers.celery_app import celery_app
from tests.browser_app import fixture_html
from tests.learning_fixtures import LEARNING_JSON


class FixtureClient:
    def __init__(self, **kwargs):
        self.aio = self
        self.models = self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def generate_content(self, **kwargs):
        await asyncio.sleep(4)  # Make PROCESSING observable by the browser's 3s polling.
        return SimpleNamespace(text=json.dumps(LEARNING_JSON))


celery_app.conf.worker_redirect_stdouts = False
extraction.fetch_public_html = fixture_html
gemma.genai.Client = FixtureClient


@worker_ready.connect(weak=False)
def ready(**kwargs):
    print("fixture worker ready", flush=True)


__all__ = ["celery_app"]
