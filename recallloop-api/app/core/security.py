from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings

password_hasher = PasswordHash.recommended()
# Unknown accounts still perform an Argon2 verification.
DUMMY_PASSWORD_HASH = password_hasher.hash("not-a-real-account-password")


def create_access_token(user_id: UUID, settings: Settings) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        },
        settings.signing_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str, settings: Settings) -> UUID:
    claims = jwt.decode(
        token,
        settings.signing_key,
        algorithms=["HS256"],
        options={"require": ["sub", "exp", "iat"]},
    )
    return UUID(claims["sub"])
