from fastapi import APIRouter, Depends, Response

from app.core.security import create_access_token
from app.db.session import SessionDep
from app.dependencies.auth import CurrentUser, SettingsDep, require_csrf
from app.schemas.auth import LoginRequest, PublicUser, RegisterRequest
from app.services.auth import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register", status_code=201, response_model=PublicUser, dependencies=[Depends(require_csrf)]
)
async def register(data: RegisterRequest, session: SessionDep) -> PublicUser:
    return PublicUser.model_validate(await register_user(session, data))


@router.post("/login", response_model=PublicUser, dependencies=[Depends(require_csrf)])
async def login(
    data: LoginRequest, session: SessionDep, settings: SettingsDep, response: Response
) -> PublicUser:
    user = await authenticate_user(session, data)
    token = create_access_token(user.id, settings)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path=settings.auth_cookie_path,
        max_age=settings.access_token_expire_minutes * 60,
    )
    return PublicUser.model_validate(user)


@router.get("/me", response_model=PublicUser)
async def me(user: CurrentUser) -> PublicUser:
    return PublicUser.model_validate(user)


@router.post("/logout", status_code=204, dependencies=[Depends(require_csrf)])
async def logout(settings: SettingsDep) -> Response:
    # Idempotent even for an expired session. This does not revoke an issued JWT.
    response = Response(status_code=204)
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path=settings.auth_cookie_path,
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
    )
    return response
