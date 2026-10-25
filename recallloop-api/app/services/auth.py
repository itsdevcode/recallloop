from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import DUMMY_PASSWORD_HASH, password_hasher
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest


async def register_user(session: AsyncSession, data: RegisterRequest) -> User:
    user = User(
        name=data.name,
        email=str(data.email).lower(),
        password_hash=await run_in_threadpool(
            password_hasher.hash, data.password.get_secret_value()
        ),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # Only translate the known email uniqueness violation, including concurrent inserts.
        cause = getattr(exc.orig, "__cause__", None)
        if getattr(cause, "constraint_name", None) == "uq_users_email":
            raise HTTPException(status_code=409, detail="Email is already registered") from None
        raise
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, data: LoginRequest) -> User:
    user = await session.scalar(select(User).where(User.email == str(data.email).lower()))
    valid = await run_in_threadpool(
        password_hasher.verify,
        data.password.get_secret_value(),
        user.password_hash if user else DUMMY_PASSWORD_HASH,
    )
    if user is None or not valid or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return user
