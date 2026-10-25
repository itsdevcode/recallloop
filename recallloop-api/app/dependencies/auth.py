from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request

from app.core.config import Settings
from app.core.security import decode_access_token
from app.db.session import SessionDep
from app.models import User


def request_settings(request: Request) -> Settings:
    return request.app.state.settings


SettingsDep = Annotated[Settings, Depends(request_settings)]


def require_csrf(request: Request, settings: SettingsDep) -> None:
    """Strict Origin + non-simple header: reject forms and cross-site requests."""
    if (
        request.headers.get("origin") != settings.frontend_origin
        or request.headers.get("x-csrf-protection") != "1"
        or request.headers.get("sec-fetch-site") == "cross-site"
    ):
        raise HTTPException(status_code=403, detail="CSRF validation failed")


async def get_current_user(request: Request, session: SessionDep, settings: SettingsDep) -> User:
    error = HTTPException(status_code=401, detail="Authentication required")
    token = request.cookies.get(settings.auth_cookie_name)
    if not token:
        raise error
    try:
        user_id = decode_access_token(token, settings)
    except (jwt.InvalidTokenError, ValueError, TypeError, AttributeError):
        raise error from None
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
