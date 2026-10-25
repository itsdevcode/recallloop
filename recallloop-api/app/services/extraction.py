import asyncio
import json
import sys
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.services.public_web import ExtractionError, fetch_public_html

PARSE_TIMEOUT = 5


@dataclass
class ExtractedArticle:
    title: str | None
    source: str
    content: str
    excerpt: str


async def extract_article(url: str) -> ExtractedArticle:
    html = await fetch_public_html(url)
    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "app.services.parse_article",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
    except OSError:
        raise ExtractionError("The article parser is temporarily unavailable.") from None
    try:
        async with asyncio.timeout(PARSE_TIMEOUT):
            output, _ = await process.communicate(html)
        if process.returncode != 0:
            raise ExtractionError("No meaningful readable article text was found on this page.")
        data = json.loads(output)
        return ExtractedArticle(
            title=data["title"],
            source=(urlsplit(url).hostname or "")[:150],
            content=data["content"],
            excerpt=data["content"][:300],
        )
    except (TimeoutError, ValueError, KeyError):
        raise ExtractionError(
            "Readable article extraction could not be completed within the time limit."
        ) from None
    finally:
        if process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()
