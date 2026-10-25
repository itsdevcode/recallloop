from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.v1.endpoints.auth import router as auth_router

router = APIRouter()
router.include_router(auth_router)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["recallloop-api"] = "recallloop-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Report application liveness without accessing the database."""
    return HealthResponse()
