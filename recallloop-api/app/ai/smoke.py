"""Optional one-call live-provider smoke test. Never prints credentials or raw output."""

import asyncio
import json
import time

from app.ai.gemma import AIError, generate_learning
from app.core.config import get_settings

SAMPLE = (
    "Database indexes help locate rows without scanning an entire table. "
    "An index requires additional storage and must be updated when indexed data changes. "
    "Transactions group changes into a unit that either commits or rolls back. "
    "Regular backups preserve copies of data so it can be restored after accidental loss."
)


async def main() -> int:
    settings = get_settings()
    result = {"model": settings.gemma_model}
    if not settings.gemini_api_key or not settings.gemini_api_key.get_secret_value():
        print(
            json.dumps(
                {**result, "status": "skipped", "reason": "GEMINI_API_KEY is not configured"}
            )
        )
        return 2
    started = time.monotonic()
    try:
        generated = await generate_learning(SAMPLE, settings, max_repairs=0)
        result.update(status="passed", concepts=len(generated.learning.concepts))
    except AIError as exc:
        result.update(status="failed", category=type(exc).__name__)
    except Exception:
        result.update(status="failed", category="UnexpectedProviderFailure")
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    print(json.dumps(result))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
