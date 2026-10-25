import asyncio
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from app.api.v1.endpoints.articles import router as articles_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.reviews import router as reviews_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(articles_router)
router.include_router(reviews_router)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["recallloop-api"] = "recallloop-api"


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Report application liveness without accessing the database."""
    return HealthResponse()


@router.get("/ready", tags=["health"], response_model=None)
async def ready(request: Request) -> JSONResponse:
    """Bounded database readiness, separate from process liveness. No error details."""
    engine = request.app.state.db_engine
    try:
        if engine is None:
            raise RuntimeError("Database not configured")
        async with asyncio.timeout(3):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(
            {"status": "unavailable"}, status_code=503, headers={"Cache-Control": "no-store"}
        )
    return JSONResponse({"status": "ready"}, headers={"Cache-Control": "no-store"})
