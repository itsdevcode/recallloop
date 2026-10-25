from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends


def review_time() -> datetime:
    return datetime.now(UTC)


ReviewTime = Annotated[datetime, Depends(review_time)]
