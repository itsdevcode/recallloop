"""Bounded parser subprocess: stdin HTML, stdout JSON. Never fetch URLs here."""

import json
import logging
import resource
import sys


def main() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    logging.disable(logging.CRITICAL)
    from trafilatura import extract

    html = sys.stdin.buffer.read(1024 * 1024 + 1)
    if len(html) > 1024 * 1024:
        sys.exit(1)
    result = extract(
        html,
        output_format="json",
        with_metadata=True,
        include_comments=False,
        include_tables=False,
        fast=True,
        date_extraction_params={"extensive_search": False},
    )
    data = json.loads(result) if result else {}
    content = (data.get("text") or "").strip()
    if len(content) < 200 or len(content.split()) < 30:
        sys.exit(1)
    print(json.dumps({"content": content, "title": (data.get("title") or "")[:500] or None}))


if __name__ == "__main__":
    main()
