"""Auth endpoints: register, login, Google OAuth, refresh, logout, me."""
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.oauth import (
    build_google_redirect_url,
    exchange_code_for_tokens,
    fetch_google_userinfo,
    generate_oauth_state,
)
from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.auth.service import (
    create_access_token,
    create_refresh_token,
    get_user_by_email,
    hash_password,
    revoke_refresh_token,
    store_refresh_token,
    verify_password,
    get_valid_refresh_token,
    get_user_by_id,
)
from app.config import settings
from app.database import get_db
from app.models import AuthProvider, User

router = APIRouter(prefix="/auth", tags=["auth"])

_REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # set True in production (HTTPS)
        max_age=settings.refresh_token_expire_days * 86400,
        path="/auth/refresh",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path="/auth/refresh")


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        auth_provider=user.auth_provider.value,
        is_admin=user.is_admin,
    )


def _issue_tokens(user: User) -> tuple[str, str]:
    access = create_access_token({"sub": user.id, "email": user.email})
    refresh = create_refresh_token()
    return access, refresh


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        auth_provider=AuthProvider.email,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access, refresh = _issue_tokens(user)
    await store_refresh_token(db, user.id, refresh)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, body.email)
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")

    access, refresh = _issue_tokens(user)
    await store_refresh_token(db, user.id, refresh)
    _set_refresh_cookie(response, refresh)
    return TokenResponse(access_token=access)


@router.get("/google")
async def google_login(request: Request):
    state = generate_oauth_state()
    request.session["oauth_state"] = state
    url = build_google_redirect_url(state)
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    expected_state = request.session.pop("oauth_state", None)
    if expected_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    google_tokens = await exchange_code_for_tokens(code)
    userinfo = await fetch_google_userinfo(google_tokens["access_token"])

    google_id = userinfo["sub"]
    email = userinfo.get("email", "")
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = await get_user_by_email(db, email)

    if user is None:
        user = User(
            email=email,
            google_id=google_id,
            display_name=name,
            avatar_url=picture,
            auth_provider=AuthProvider.google,
        )
        db.add(user)
    else:
        if user.google_id is None:
            user.google_id = google_id
            user.auth_provider = AuthProvider.both
        user.display_name = user.display_name or name
        user.avatar_url = user.avatar_url or picture

    await db.commit()
    await db.refresh(user)

    access, refresh = _issue_tokens(user)
    await store_refresh_token(db, user.id, refresh)

    redirect = RedirectResponse(
        f"{settings.frontend_auth_callback_url}?token={access}",
        status_code=302,
    )
    _set_refresh_cookie(redirect, refresh)
    return redirect


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    rt = await get_valid_refresh_token(db, token)
    if rt is None:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

    user = await get_user_by_id(db, rt.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    await revoke_refresh_token(db, token)
    access, new_refresh = _issue_tokens(user)
    await store_refresh_token(db, user.id, new_refresh)
    _set_refresh_cookie(response, new_refresh)
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(_REFRESH_COOKIE)
    if token:
        await revoke_refresh_token(db, token)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_to_response(user)
