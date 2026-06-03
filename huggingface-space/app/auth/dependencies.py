"""FastAPI dependencies for auth: required and optional user resolution."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_access_token, get_user_by_id, TokenExpiredError, InvalidTokenError
from app.database import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Returns the authenticated user, or None for unauthenticated requests."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except (TokenExpiredError, InvalidTokenError):
        return None
    user = await get_user_by_id(db, payload["sub"])
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Returns the authenticated user, raises 401 if not authenticated."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except (TokenExpiredError, InvalidTokenError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await get_user_by_id(db, payload["sub"])
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
