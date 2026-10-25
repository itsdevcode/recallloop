"""Test-only API entry point. No production feature flags or live website fetching."""

import os
from urllib.parse import urlsplit

from app.core.config import Settings
from app.main import create_app
from app.services import extraction
from app.services.public_web import ExtractionError
from tests.conftest import validate_test_database
from tests.test_public_web import HTML

url = os.environ["TEST_DATABASE_URL"]
validate_test_database(url, None)
if os.environ.get("DATABASE_URL") != url:
    raise RuntimeError("Browser tests must use their explicit disposable database")


_failed_once: set[str] = set()


async def fixture_html(value: str) -> bytes:
    parsed = urlsplit(value)
    if parsed.hostname != "example.com" or not parsed.path.startswith("/browser-"):
        raise ExtractionError("Browser tests permit only fixture article URLs.")
    if parsed.path.startswith("/browser-failed") and value not in _failed_once:
        _failed_once.add(value)
        raise ExtractionError("The fixture website could not be accessed.")
    return HTML


extraction.fetch_public_html = fixture_html
app = create_app(Settings(_env_file=None))
