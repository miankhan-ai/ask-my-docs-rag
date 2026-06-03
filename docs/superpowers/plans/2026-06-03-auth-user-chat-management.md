# Auth, User Management & Chat Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT + Google OAuth authentication, per-user document isolation, and persistent named chat sessions (ChatGPT-style sidebar) to the Ask My Docs RAG application.

**Architecture:** FastAPI auth module (`app/auth/`) handles email/password registration+login and Google OAuth2 callback; a `RefreshToken` DB table enables httpOnly-cookie-based token rotation. All existing document/query endpoints gain a `get_current_user` dependency that scopes DB queries to the authenticated user. A new `app/conversations/` module persists chat sessions and messages. The React frontend gains an `AuthContext`, protected routes, login/register pages, a conversation sidebar, and a user menu.

**Tech Stack:** Python (python-jose, passlib[bcrypt], httpx already in requirements), FastAPI, SQLAlchemy async, React 18 + TypeScript, react-router-dom v6, Tailwind CSS, Lucide icons.

---

## File Map

### Backend — new files
- `backend/app/auth/__init__.py`
- `backend/app/auth/schemas.py` — Pydantic in/out schemas for auth endpoints
- `backend/app/auth/service.py` — password hashing, JWT issue/verify, refresh token CRUD
- `backend/app/auth/dependencies.py` — `get_current_user` FastAPI dependency
- `backend/app/auth/oauth.py` — Google OAuth2 redirect + callback helpers
- `backend/app/auth/router.py` — `/auth/*` endpoints wired together
- `backend/app/conversations/__init__.py`
- `backend/app/conversations/schemas.py` — Pydantic schemas for conversations + messages
- `backend/app/conversations/service.py` — conversation/message CRUD
- `backend/app/conversations/router.py` — `/conversations/*` endpoints
- `backend/tests/test_auth.py`
- `backend/tests/test_conversations.py`

### Backend — modified files
- `backend/app/models.py` — add `User`, `RefreshToken`, `Conversation`, `Message`; add `user_id` FK to `Document`
- `backend/app/config.py` — add JWT + Google OAuth settings
- `backend/app/main.py` — include auth + conversation routers; add `get_current_user` to existing endpoints

### Frontend — new files
- `frontend/src/contexts/AuthContext.tsx` — token store, user info, login/logout, silent refresh
- `frontend/src/hooks/useAuth.ts` — convenience hook
- `frontend/src/components/ProtectedRoute.tsx` — redirect unauthenticated users
- `frontend/src/pages/LoginPage.tsx` — email+password form + Google button
- `frontend/src/pages/RegisterPage.tsx` — register form + Google button
- `frontend/src/components/ConversationSidebar.tsx` — named chat list with create/rename/delete
- `frontend/src/components/UserMenu.tsx` — avatar + email chip + logout

### Frontend — modified files
- `frontend/src/api/index.ts` — add auth helpers (login, register, refresh, logout, me), inject Bearer token, 401 interceptor
- `frontend/src/App.tsx` — add `/login`, `/register`, `/auth/callback` routes; wrap `/app` in ProtectedRoute
- `frontend/src/app/AppLayout.tsx` — add UserMenu to header, ConversationSidebar to left rail
- `frontend/src/app/ChatLayout.tsx` — remove UploadPanel from layout (moves into sidebar)
- `frontend/src/hooks/useStream.ts` — accept `conversationId`, persist messages via API
- `frontend/src/components/ChatWindow.tsx` — accept conversation prop, load history on mount

---

## Task 1: Backend — DB models (User, RefreshToken, Conversation, Message + Document FK)

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add imports and new enums**

Open `backend/app/models.py`. After the existing imports block add:

```python
import uuid

from sqlalchemy import Boolean, UUID, Index
```

Replace the existing `import enum` line (it's already there) — just note we need `uuid` too. Then add two new enums after `DocumentStatus`:

```python
class AuthProvider(str, enum.Enum):
    email = "email"
    google = "google"
    both = "both"


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
```

- [ ] **Step 2: Add User model**

After the `Base` class definition and before `class Document`, insert:

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(SAEnum(AuthProvider), default=AuthProvider.email)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents: Mapped[list["Document"]] = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
```

- [ ] **Step 3: Add user_id FK to Document**

In `class Document`, add after the `status` field and before `chunks`:

```python
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    owner: Mapped["User | None"] = relationship("User", back_populates="documents")
```

- [ ] **Step 4: Add Conversation and Message models**

After `class Chunk`, append:

```python
class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New Conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[MessageRole] = mapped_column(SAEnum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded list
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
```

- [ ] **Step 5: Verify the file parses cleanly**

```bash
cd backend && python -c "from app.models import User, RefreshToken, Conversation, Message, Document, Chunk; print('OK')"
```
Expected output: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add User, RefreshToken, Conversation, Message models; add user_id FK to Document"
```

---

## Task 2: Backend — Config + requirements

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add auth settings to config.py**

In `class Settings`, after the `# --- Caching ---` block, add:

```python
    # --- Auth ---
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Google OAuth2
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    # After OAuth, backend redirects here with ?token=<access_token>
    frontend_auth_callback_url: str = "http://localhost:5173/auth/callback"
```

- [ ] **Step 2: Add new packages to requirements.txt**

Append to `backend/requirements.txt`:

```
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
```

`httpx` is already in requirements at `0.27.2` — no change needed.

- [ ] **Step 3: Install the new packages**

```bash
cd backend && pip install "python-jose[cryptography]==3.3.0" "passlib[bcrypt]==1.7.4"
```

Expected: both packages install without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/app/config.py backend/requirements.txt
git commit -m "feat: add JWT and Google OAuth config settings"
```

---

## Task 3: Backend — Auth service (passwords + JWT + refresh tokens)

**Files:**
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/schemas.py`
- Create: `backend/app/auth/service.py`

- [ ] **Step 1: Create the auth package**

```bash
mkdir -p backend/app/auth && touch backend/app/auth/__init__.py
```

- [ ] **Step 2: Write failing tests for auth service**

Create `backend/tests/test_auth.py`:

```python
"""Tests for auth service: hashing, JWT, refresh token CRUD."""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from app.auth.service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    create_refresh_token,
)


def test_hash_and_verify_password():
    pw = "SuperSecret123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_create_and_decode_access_token():
    payload = {"sub": "user-uuid-123", "email": "test@example.com"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))
    decoded = decode_access_token(token)
    assert decoded["sub"] == "user-uuid-123"
    assert decoded["email"] == "test@example.com"


def test_decode_expired_token_raises():
    from app.auth.service import TokenExpiredError
    payload = {"sub": "user-uuid-123"}
    token = create_access_token(payload, expires_delta=timedelta(seconds=-1))
    with pytest.raises(TokenExpiredError):
        decode_access_token(token)


def test_decode_invalid_token_raises():
    from app.auth.service import InvalidTokenError
    with pytest.raises(InvalidTokenError):
        decode_access_token("not.a.real.token")


def test_create_refresh_token_is_uuid():
    import uuid
    token = create_refresh_token()
    uuid.UUID(token)  # raises ValueError if not valid UUID
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_auth.py -v 2>&1 | head -30
```
Expected: `ModuleNotFoundError` or `ImportError` for `app.auth.service`.

- [ ] **Step 4: Create auth/schemas.py**

```python
"""Pydantic schemas for authentication endpoints."""
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None
    avatar_url: str | None
    auth_provider: str
    is_admin: bool


class RefreshRequest(BaseModel):
    pass  # refresh token comes from httpOnly cookie
```

- [ ] **Step 5: Create auth/service.py**

```python
"""Auth service: password hashing, JWT, and refresh token helpers."""
from datetime import datetime, timedelta, timezone
import uuid

from jose import jwt, JWTError, ExpiredSignatureError
from passlib.context import CryptContext
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import RefreshToken, User

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenExpiredError(Exception):
    pass


class InvalidTokenError(Exception):
    pass


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + delta
    return jwt.encode(
        {**data, "exp": expire},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except ExpiredSignatureError:
        raise TokenExpiredError("Access token has expired")
    except JWTError:
        raise InvalidTokenError("Invalid access token")


def create_refresh_token() -> str:
    return str(uuid.uuid4())


async def store_refresh_token(db: AsyncSession, user_id: str, token: str) -> RefreshToken:
    rt = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return rt


async def get_valid_refresh_token(db: AsyncSession, token: str) -> RefreshToken | None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return result.scalar_one_or_none()


async def revoke_refresh_token(db: AsyncSession, token: str) -> None:
    await db.execute(delete(RefreshToken).where(RefreshToken.token == token))
    await db.commit()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    return await db.get(User, user_id)
```

- [ ] **Step 6: Run the auth service tests**

```bash
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: all 5 tests **PASS**.

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth/ backend/tests/test_auth.py
git commit -m "feat: auth service — password hashing, JWT issue/verify, refresh token CRUD"
```

---

## Task 4: Backend — Auth dependency (get_current_user)

**Files:**
- Create: `backend/app/auth/dependencies.py`

- [ ] **Step 1: Create dependencies.py**

```python
"""FastAPI dependency: extract and validate the current user from the Bearer token."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_access_token, get_user_by_id, TokenExpiredError, InvalidTokenError
from app.database import get_db
from app.models import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
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
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from app.auth.dependencies import get_current_user; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth/dependencies.py
git commit -m "feat: get_current_user FastAPI dependency"
```

---

## Task 5: Backend — Google OAuth helpers

**Files:**
- Create: `backend/app/auth/oauth.py`

- [ ] **Step 1: Create oauth.py**

```python
"""Google OAuth2 flow helpers."""
import secrets
import httpx

from app.config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def build_google_redirect_url(state: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GOOGLE_AUTH_URL}?{query}"


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(32)


async def exchange_code_for_tokens(code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def fetch_google_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from app.auth.oauth import build_google_redirect_url, generate_oauth_state; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth/oauth.py
git commit -m "feat: Google OAuth2 redirect + token exchange helpers"
```

---

## Task 6: Backend — Auth router (register, login, Google, refresh, logout, me)

**Files:**
- Create: `backend/app/auth/router.py`

- [ ] **Step 1: Create router.py**

```python
"""Auth endpoints: register, login, Google OAuth, refresh, logout, me."""
import enum
from datetime import datetime, timezone

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
    request.session["oauth_state"] = state  # requires SessionMiddleware
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

    # Try to find by google_id first, then by email
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
        # Link Google to existing email account
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

    # Rotate: revoke old, issue new
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
```

- [ ] **Step 2: Install starlette-session for OAuth state storage**

```bash
pip install itsdangerous
```

Then in `backend/requirements.txt`, append:

```
itsdangerous==2.2.0
```

- [ ] **Step 3: Add SessionMiddleware to main.py**

In `backend/app/main.py`, after the imports block add:

```python
from starlette.middleware.sessions import SessionMiddleware
```

Then after `app = FastAPI(title="Ask My Docs", lifespan=lifespan)`, add:

```python
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret_key, max_age=300)
```

Also add the auth router import and include it:

```python
from app.auth.router import router as auth_router
# ... (after app.add_middleware calls)
app.include_router(auth_router)
```

- [ ] **Step 4: Start the server and smoke-test register + login**

```bash
cd backend && uvicorn app.main:app --reload --port 8000 &
sleep 3

# Register
curl -s -c /tmp/cookies.txt -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | python -m json.tool

# Login
curl -s -c /tmp/cookies2.txt -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | python -m json.tool
```

Expected: both return `{"access_token": "...", "token_type": "bearer"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/router.py backend/app/main.py backend/requirements.txt
git commit -m "feat: auth router — register, login, Google OAuth, refresh, logout, me"
```

---

## Task 7: Backend — Protect existing endpoints + add user_id to document ops

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add get_current_user to upload endpoint**

In `backend/app/main.py`, update the imports to add:

```python
from app.auth.dependencies import get_current_user
from app.models import Chunk, Document, User
```

Then update `upload_document` signature to:

```python
@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
```

And pass `user_id=user.id` to `ingest_document`. First check how `ingest_document` is called — it currently returns `(doc_id, chunk_count)`. Update `ingestion.py` to accept `user_id`:

In `backend/app/ingestion.py`, find the `ingest_document` function signature and add `user_id: str | None = None`. Then when creating the `Document` ORM object, add `user_id=user_id`.

Then in `main.py` update the call:

```python
    doc_id, chunk_count = await ingest_document(
        db=db,
        filename=file.filename,
        filetype=suffix,
        file_bytes=file_bytes,
        user_id=user.id,
    )
```

- [ ] **Step 2: Filter list_documents by user**

Replace the `list_documents` endpoint body:

```python
@app.get("/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    result = await db.execute(
        select(
            Document.id,
            Document.filename,
            Document.status,
            func.count(Chunk.id),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.user_id == user.id)
        .group_by(Document.id)
        .order_by(Document.id)
    )
    rows = result.fetchall()
    return [
        {
            "document_id": row[0],
            "filename": row[1],
            "status": row[2].value if hasattr(row[2], "value") else row[2],
            "chunk_count": row[3],
        }
        for row in rows
    ]
```

- [ ] **Step 3: Guard delete_document with ownership check**

Replace `delete_document`:

```python
@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = await db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your document")

    await db.delete(doc)
    await db.commit()

    async with AsyncSessionLocal() as refresh_db:
        await _refresh_bm25_from_db(refresh_db)

    return {"document_id": document_id, "deleted": True}
```

- [ ] **Step 4: Scope query and retrieval-debug to current user**

Add `user: User = Depends(get_current_user)` to `query_documents` and `retrieval_debug`. Then in `hybrid_retrieve` we need to pass `user_id` so dense search and BM25 filter to that user's chunks.

In `query_documents`, after the `user` dependency is injected, pass `user_id=user.id` to `hybrid_retrieve`. Update `backend/app/retrieval.py` — in `hybrid_retrieve` add `user_id: str | None = None` parameter, and in `_dense_search_db` add a `.where(Document.user_id == user_id)` to the join query when `user_id` is set. Also update `_refresh_bm25_from_db` in `main.py` so BM25 is built per-user — actually, since BM25 is a global in-memory index, we filter post-retrieval: add `user_id` filtering to `_fetch_chunk_map` instead.

In `_fetch_chunk_map`, add an optional `user_id` filter:

```python
async def _fetch_chunk_map(db: AsyncSession, chunk_ids: list[int], user_id: str | None = None) -> dict[int, dict]:
    query = (
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.id.in_(chunk_ids))
    )
    if user_id is not None:
        query = query.where(Document.user_id == user_id)
    result = await db.execute(query)
    rows = result.fetchall()
    return {
        row[0].id: {
            "id": row[0].id,
            "text": row[0].text,
            "source": row[1],
            "page_number": row[0].page_number,
        }
        for row in rows
    }
```

Pass `user_id=user.id` when calling `_fetch_chunk_map` in both `query_documents` and `retrieval_debug`.

- [ ] **Step 5: Smoke-test that unauthenticated requests are rejected**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/documents
```
Expected: `401`

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer bad_token" http://localhost:8000/documents
```
Expected: `401`

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/app/ingestion.py backend/app/retrieval.py
git commit -m "feat: protect upload/documents/query/debug endpoints with per-user auth"
```

---

## Task 8: Backend — Conversations router + service

**Files:**
- Create: `backend/app/conversations/__init__.py`
- Create: `backend/app/conversations/schemas.py`
- Create: `backend/app/conversations/service.py`
- Create: `backend/app/conversations/router.py`

- [ ] **Step 1: Write failing tests for conversations**

Create `backend/tests/test_conversations.py`:

```python
"""Tests for conversation service ownership checks."""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models import Base, User, Conversation, Message, AuthProvider, MessageRole
from app.conversations.service import (
    create_conversation,
    list_conversations,
    get_conversation,
    rename_conversation,
    delete_conversation,
    add_message,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user_a(db):
    u = User(id="user-a", email="a@test.com", auth_provider=AuthProvider.email)
    db.add(u)
    await db.commit()
    return u


@pytest_asyncio.fixture
async def user_b(db):
    u = User(id="user-b", email="b@test.com", auth_provider=AuthProvider.email)
    db.add(u)
    await db.commit()
    return u


@pytest.mark.asyncio
async def test_create_and_list_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "My Chat")
    assert conv.title == "My Chat"
    convs = await list_conversations(db, user_a.id)
    assert len(convs) == 1


@pytest.mark.asyncio
async def test_user_b_cannot_access_user_a_conversation(db, user_a, user_b):
    conv = await create_conversation(db, user_a.id, "Private")
    result = await get_conversation(db, conv.id, user_b.id)
    assert result is None


@pytest.mark.asyncio
async def test_rename_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "Old Title")
    updated = await rename_conversation(db, conv.id, user_a.id, "New Title")
    assert updated.title == "New Title"


@pytest.mark.asyncio
async def test_delete_conversation(db, user_a):
    conv = await create_conversation(db, user_a.id, "To Delete")
    await delete_conversation(db, conv.id, user_a.id)
    assert await get_conversation(db, conv.id, user_a.id) is None


@pytest.mark.asyncio
async def test_add_message(db, user_a):
    conv = await create_conversation(db, user_a.id, "Chat")
    msg = await add_message(db, conv.id, MessageRole.user, "Hello", None)
    assert msg.content == "Hello"
    full = await get_conversation(db, conv.id, user_a.id)
    assert len(full.messages) == 1
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && python -m pytest tests/test_conversations.py -v 2>&1 | head -20
```
Expected: `ImportError` for `app.conversations.service`.

- [ ] **Step 3: Create conversations package and schemas**

```bash
mkdir -p backend/app/conversations && touch backend/app/conversations/__init__.py
```

Create `backend/app/conversations/schemas.py`:

```python
"""Pydantic schemas for conversation and message endpoints."""
from pydantic import BaseModel
from typing import Any


class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    citations: Any | None  # parsed JSON or None
    created_at: str

    model_config = {"from_attributes": True}


class ConversationWithMessages(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[MessageOut]

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str = "New Conversation"


class RenameConversationRequest(BaseModel):
    title: str


class AddMessageRequest(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    citations: Any | None = None
```

- [ ] **Step 4: Create conversations/service.py**

```python
"""Business logic for conversation and message CRUD."""
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, Message, MessageRole


async def create_conversation(db: AsyncSession, user_id: str, title: str = "New Conversation") -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def list_conversations(db: AsyncSession, user_id: str) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(db: AsyncSession, conversation_id: str, user_id: str) -> Conversation | None:
    result = await db.execute(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == conversation_id, Conversation.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def rename_conversation(db: AsyncSession, conversation_id: str, user_id: str, title: str) -> Conversation | None:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user_id:
        return None
    conv.title = title
    await db.commit()
    await db.refresh(conv)
    return conv


async def delete_conversation(db: AsyncSession, conversation_id: str, user_id: str) -> bool:
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user_id:
        return False
    await db.delete(conv)
    await db.commit()
    return True


async def add_message(
    db: AsyncSession,
    conversation_id: str,
    role: MessageRole,
    content: str,
    citations: list | None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        citations=json.dumps(citations) if citations else None,
    )
    db.add(msg)
    # Bump conversation updated_at
    conv = await db.get(Conversation, conversation_id)
    if conv:
        from datetime import datetime
        conv.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(msg)
    return msg
```

- [ ] **Step 5: Run conversation tests**

```bash
cd backend && python -m pytest tests/test_conversations.py -v
```
Expected: all tests **PASS**.

- [ ] **Step 6: Create conversations/router.py**

```python
"""CRUD endpoints for conversations and messages."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.conversations.schemas import (
    AddMessageRequest,
    ConversationOut,
    ConversationWithMessages,
    CreateConversationRequest,
    MessageOut,
    RenameConversationRequest,
)
from app.conversations.service import (
    add_message,
    create_conversation,
    delete_conversation,
    get_conversation,
    list_conversations,
    rename_conversation,
)
from app.database import get_db
from app.models import MessageRole, User

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _conv_out(conv) -> ConversationOut:
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


def _msg_out(msg) -> MessageOut:
    return MessageOut(
        id=msg.id,
        role=msg.role.value if hasattr(msg.role, "value") else msg.role,
        content=msg.content,
        citations=json.loads(msg.citations) if msg.citations else None,
        created_at=msg.created_at.isoformat(),
    )


@router.get("", response_model=list[ConversationOut])
async def list_convs(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    convs = await list_conversations(db, user.id)
    return [_conv_out(c) for c in convs]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conv(
    body: CreateConversationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await create_conversation(db, user.id, body.title)
    return _conv_out(conv)


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conv(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await get_conversation(db, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationWithMessages(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
        messages=[_msg_out(m) for m in conv.messages],
    )


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conv(
    conversation_id: str,
    body: RenameConversationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = await rename_conversation(db, conversation_id, user.id, body.title)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conv_out(conv)


@router.delete("/{conversation_id}", status_code=204)
async def delete_conv(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ok = await delete_conversation(db, conversation_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def post_message(
    conversation_id: str,
    body: AddMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify ownership
    conv = await get_conversation(db, conversation_id, user.id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        role = MessageRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="role must be 'user' or 'assistant'")
    msg = await add_message(db, conversation_id, role, body.content, body.citations)
    return _msg_out(msg)
```

- [ ] **Step 7: Register conversations router in main.py**

In `backend/app/main.py`, add:

```python
from app.conversations.router import router as conversations_router
# after include_router(auth_router):
app.include_router(conversations_router)
```

- [ ] **Step 8: Smoke-test conversation endpoints**

```bash
# Get access token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Create a conversation
curl -s -X POST http://localhost:8000/conversations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Chat"}' | python -m json.tool
```

Expected: `{"id": "...", "title": "My First Chat", ...}`

- [ ] **Step 9: Commit**

```bash
git add backend/app/conversations/ backend/app/main.py
git commit -m "feat: conversations + messages CRUD endpoints"
```

---

## Task 9: Frontend — Install deps + API layer

**Files:**
- Modify: `frontend/src/api/index.ts`

- [ ] **Step 1: Add in-memory token store + auth API functions**

Replace the entire `frontend/src/api/index.ts` with:

```typescript
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export const apiUrl = (path: string): string => `${API_BASE}${path}`

// --- In-memory token store (never persists to localStorage) ---
let _accessToken: string | null = null

export function setAccessToken(token: string | null) {
  _accessToken = token
}

export function getAccessToken(): string | null {
  return _accessToken
}

// --- Auth headers + 401 interceptor ---
let _isRefreshing = false
let _refreshPromise: Promise<string | null> | null = null

async function silentRefresh(): Promise<string | null> {
  if (_isRefreshing) return _refreshPromise!
  _isRefreshing = true
  _refreshPromise = (async () => {
    try {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) { setAccessToken(null); return null }
      const data: TokenResponse = await res.json()
      setAccessToken(data.access_token)
      return data.access_token
    } finally {
      _isRefreshing = false
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers, credentials: 'include' })
  if (res.status === 401) {
    const newToken = await silentRefresh()
    if (!newToken) return res  // caller handles 401
    headers.set('Authorization', `Bearer ${newToken}`)
    return fetch(input, { ...init, headers, credentials: 'include' })
  }
  return res
}

// --- Auth endpoints ---
export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UserInfo {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  auth_provider: string
  is_admin: boolean
}

export async function apiRegister(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiLogout(): Promise<void> {
  await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' })
  setAccessToken(null)
}

export async function apiMe(): Promise<UserInfo> {
  const res = await authFetch(apiUrl('/auth/me'))
  if (!res.ok) throw new Error('Not authenticated')
  return res.json()
}

export async function apiSilentRefresh(): Promise<string | null> {
  return silentRefresh()
}

// --- Conversation endpoints ---
export interface ConversationInfo {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageInfo {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  created_at: string
}

export interface ConversationWithMessages extends ConversationInfo {
  messages: MessageInfo[]
}

export async function listConversations(): Promise<ConversationInfo[]> {
  const res = await authFetch(apiUrl('/conversations'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function createConversation(title = 'New Conversation'): Promise<ConversationInfo> {
  const res = await authFetch(apiUrl('/conversations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const res = await authFetch(apiUrl(`/conversations/${id}`))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function renameConversation(id: string, title: string): Promise<ConversationInfo> {
  const res = await authFetch(apiUrl(`/conversations/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await authFetch(apiUrl(`/conversations/${id}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function postMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  citations: Citation[] | null,
): Promise<MessageInfo> {
  const res = await authFetch(apiUrl(`/conversations/${conversationId}/messages`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, citations }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// --- Document endpoints ---
export interface UploadResult { document_id: number; chunk_count: number }
export interface Citation { id: number; text: string; source: string; page: number | null }
export interface TokenEvent { type: 'token'; content: string }
export interface DoneEvent {
  type: 'done'
  citations: Citation[]
  citation_warning: boolean
  timings?: Record<string, number>
  prompt_tokens?: number
  completion_tokens?: number
  cost_usd?: number
  cached?: boolean
}
export type StreamEvent = TokenEvent | DoneEvent

export interface RetrievalDebugResult {
  bm25_candidates: Array<{ chunk_id: number; score: number }>
  dense_candidates: Array<{ chunk_id: number; score: number }>
  rrf_fused: Array<{ chunk_id: number; rrf_score: number }>
  reranked: Array<{
    chunk_id: number
    cross_encoder_score: number
    text: string
    source: string
    page_number: number | null
  }>
}

export interface DocumentInfo { document_id: number; filename: string; status: string; chunk_count: number }

export async function uploadDocument(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await authFetch(apiUrl('/upload'), { method: 'POST', body: form })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await authFetch(apiUrl('/documents'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function deleteDocument(documentId: number): Promise<void> {
  const res = await authFetch(apiUrl(`/documents/${documentId}`), { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export async function* streamQuery(question: string, conversationId?: string): AsyncGenerator<StreamEvent> {
  const res = await authFetch(apiUrl('/query'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, conversation_id: conversationId }),
  })
  if (!res.ok) throw new Error(await res.text())
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as StreamEvent
      }
    }
  }
}

export async function getRetrievalDebug(query: string): Promise<RetrievalDebugResult> {
  const res = await authFetch(apiUrl(`/retrieval-debug?query=${encodeURIComponent(query)}`))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface Stats {
  uptime_s: number
  requests: { total: number; by_status: Record<string, number>; rate_1m: number; in_flight: number; errors: number }
  latency_ms: { p50: number; p95: number; by_stage: Record<string, number> }
  tokens: { prompt_total: number; completion_total: number }
  cost_usd_total: number
  cache: Record<string, { hits: number; misses: number; hit_ratio: number }>
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(apiUrl('/stats'))
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/index.ts
git commit -m "feat: add auth/conversation API functions + authFetch with 401 retry"
```

---

## Task 10: Frontend — AuthContext + useAuth + ProtectedRoute

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create AuthContext.tsx**

Create `frontend/src/contexts/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  apiSilentRefresh,
  setAccessToken,
  type UserInfo,
} from '../api'

interface AuthState {
  user: UserInfo | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true })

  // Silent refresh on mount to restore session
  useEffect(() => {
    ;(async () => {
      try {
        const token = await apiSilentRefresh()
        if (token) {
          setAccessToken(token)
          const user = await apiMe()
          setState({ user, isLoading: false })
        } else {
          setState({ user: null, isLoading: false })
        }
      } catch {
        setState({ user: null, isLoading: false })
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiLogin(email, password)
    setAccessToken(access_token)
    const user = await apiMe()
    setState({ user, isLoading: false })
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const { access_token } = await apiRegister(email, password)
    setAccessToken(access_token)
    const user = await apiMe()
    setState({ user, isLoading: false })
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setState({ user: null, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Create hooks/useAuth.ts**

```typescript
export { useAuthContext as useAuth } from '../contexts/AuthContext'
```

- [ ] **Step 3: Create ProtectedRoute.tsx**

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Wrap App with AuthProvider in main.tsx**

Open `frontend/src/main.tsx`. Find the root render call and wrap `<App />` with `<AuthProvider>`:

```tsx
import { AuthProvider } from './contexts/AuthContext'
// ...
root.render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 5: Type-check**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/ frontend/src/hooks/useAuth.ts frontend/src/components/ProtectedRoute.tsx frontend/src/main.tsx
git commit -m "feat: AuthContext with silent refresh, useAuth hook, ProtectedRoute"
```

---

## Task 11: Frontend — Login and Register pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Create LoginPage.tsx**

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../hooks/useAuth'
import { apiUrl } from '../api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app', { replace: true })
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo size={40} />
          <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500">to Ask My Docs</p>
        </div>

        <a
          href={apiUrl('/auth/google')}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-gray-50 px-2">or</span>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="you@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account?{' '}
          <Link to="/register" className="text-primary-600 hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create RegisterPage.tsx**

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuth } from '../hooks/useAuth'
import { apiUrl } from '../api'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await register(email, password)
      navigate('/app', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('409') ? 'Email already registered.' : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-2">
          <Logo size={40} />
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500">Start asking your docs</p>
        </div>

        <a
          href={apiUrl('/auth/google')}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-6"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-400">
            <span className="bg-gray-50 px-2">or</span>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="you@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create OAuth callback page**

Create `frontend/src/pages/AuthCallbackPage.tsx`:

```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAccessToken, apiMe } from '../api'
import { useAuthContext } from '../contexts/AuthContext'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { } = useAuthContext()  // ensure context exists

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (token) {
      setAccessToken(token)
      apiMe().then(() => {
        // replace URL so token doesn't stay in history
        window.history.replaceState({}, '', '/app')
        navigate('/app', { replace: true })
      }).catch(() => navigate('/login', { replace: true }))
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
      Signing you in…
    </div>
  )
}
```

- [ ] **Step 4: Register all routes in App.tsx**

Replace `frontend/src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { FeaturesPage } from './pages/FeaturesPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { PricingPage } from './pages/PricingPage'
import { DocsPage } from './pages/DocsPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { StatusPage } from './pages/StatusPage'
import { AboutPage } from './pages/AboutPage'
import { BlogPage } from './pages/BlogPage'
import { CareersPage } from './pages/CareersPage'
import { ContactPage } from './pages/ContactPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { AppLayout } from './app/AppLayout'
import { ChatLayout } from './app/ChatLayout'
import { ProtectedRoute } from './components/ProtectedRoute'

const Dashboard = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard })),
)

const DashboardFallback = (
  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
    Loading dashboard…
  </div>
)

export default function App() {
  return (
    <Routes>
      {/* Marketing */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Protected app */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ChatLayout />} />
        <Route
          path="dashboard"
          element={<Suspense fallback={DashboardFallback}><Dashboard /></Suspense>}
        />
      </Route>

      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}
```

- [ ] **Step 5: Type-check**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/AuthCallbackPage.tsx frontend/src/App.tsx
git commit -m "feat: login, register, OAuth callback pages + protected app routes"
```

---

## Task 12: Frontend — UserMenu component

**Files:**
- Create: `frontend/src/components/UserMenu.tsx`
- Modify: `frontend/src/app/AppLayout.tsx`

- [ ] **Step 1: Create UserMenu.tsx**

```tsx
import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const initials = user.display_name
    ? user.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-[10px] font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm text-gray-700 max-w-[140px] truncate hidden sm:block">
          {user.display_name || user.email}
        </span>
        <ChevronDown className="h-3 w-3 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-900 truncate">{user.display_name || 'Account'}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-rose-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add UserMenu to AppLayout**

Replace `frontend/src/app/AppLayout.tsx`:

```tsx
import { NavLink, Outlet, Link } from 'react-router-dom'
import { MessageSquare, LayoutDashboard } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { UserMenu } from '../components/UserMenu'
import { cn } from '../components/ui/cn'

export function AppLayout() {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary-600 text-white shadow-soft'
        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
    )

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-5 h-14 border-b border-gray-100 bg-white/90 backdrop-blur sticky top-0 z-30 shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 text-gray-900 hover:opacity-80 transition-opacity"
        >
          <Logo size={28} />
          <span className="font-semibold tracking-tight text-sm">Ask My Docs</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/app" end className={navLinkClass}>
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </NavLink>
          <NavLink to="/app/dashboard" className={navLinkClass}>
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </NavLink>
        </nav>
        <UserMenu />
      </header>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UserMenu.tsx frontend/src/app/AppLayout.tsx
git commit -m "feat: UserMenu with avatar, email, logout"
```

---

## Task 13: Frontend — ConversationSidebar + ChatLayout wiring

**Files:**
- Create: `frontend/src/components/ConversationSidebar.tsx`
- Modify: `frontend/src/app/ChatLayout.tsx`
- Modify: `frontend/src/components/ChatWindow.tsx`
- Modify: `frontend/src/hooks/useStream.ts`

- [ ] **Step 1: Create ConversationSidebar.tsx**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { Plus, MessageSquare, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  type ConversationInfo,
} from '../api'
import { cn } from './ui/cn'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: (conv: ConversationInfo) => void
}

export function ConversationSidebar({ activeId, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<ConversationInfo[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const load = useCallback(async () => {
    try {
      const list = await listConversations()
      setConversations(list)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  const handleNew = async () => {
    const conv = await createConversation('New Conversation')
    setConversations((prev) => [conv, ...prev])
    onNew(conv)
  }

  const startEdit = (conv: ConversationInfo) => {
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  const commitRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return }
    const updated = await renameConversation(id, editTitle.trim())
    setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)))
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) onNew(conversations.find((c) => c.id !== id) || { id: '', title: '', created_at: '', updated_at: '' } as ConversationInfo)
  }

  return (
    <div className="w-60 shrink-0 flex flex-col border-r border-gray-100 bg-white h-full">
      <div className="px-3 py-3 border-b border-gray-100">
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
              activeId === conv.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700',
            )}
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(conv.id); if (e.key === 'Escape') setEditingId(null) }}
                  className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-400"
                />
                <button onClick={() => commitRename(conv.id)} className="text-primary-600 hover:text-primary-700"><Check className="h-3 w-3" /></button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => startEdit(conv)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(conv.id)} className="text-gray-400 hover:text-rose-500 p-0.5 rounded">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No conversations yet</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update ChatLayout.tsx to include sidebar**

Replace `frontend/src/app/ChatLayout.tsx`:

```tsx
import { useState } from 'react'
import { UploadPanel } from '../components/UploadPanel'
import { ChatWindow } from '../components/ChatWindow'
import { ConversationSidebar } from '../components/ConversationSidebar'
import type { ConversationInfo } from '../api'

export function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  const handleNew = (conv: ConversationInfo) => {
    if (conv.id) setActiveConversationId(conv.id)
  }

  return (
    <div className="flex flex-1 h-full min-h-0">
      <ConversationSidebar
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onNew={handleNew}
      />
      <div className="flex flex-1 min-h-0">
        <UploadPanel />
        <ChatWindow conversationId={activeConversationId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update useStream.ts to accept conversationId and persist messages**

Replace `frontend/src/hooks/useStream.ts`:

```typescript
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  streamQuery,
  postMessage,
  getConversation,
  renameConversation,
  type Citation,
} from '../api'

export interface UserMessage {
  role: 'user'
  id: string
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  id: string
  query: string
  tokens: string
  citations: Citation[]
  citationWarning: boolean
  isStreaming: boolean
  error: string | null
  timings?: Record<string, number>
  promptTokens?: number
  completionTokens?: number
  costUsd?: number
  cached?: boolean
}

export type ChatMessage = UserMessage | AssistantMessage

let _tempId = 0
const tempId = () => `temp-${_tempId++}`

export function useStream(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const abortRef = useRef(false)
  const isFirstMessage = useRef(true)

  // Load history when conversation changes
  useEffect(() => {
    if (!conversationId) { setMessages([]); return }
    isFirstMessage.current = false
    getConversation(conversationId).then((conv) => {
      isFirstMessage.current = conv.messages.length === 0
      setMessages(
        conv.messages.map((m) => {
          if (m.role === 'user') {
            return { role: 'user', id: m.id, content: m.content } satisfies UserMessage
          }
          return {
            role: 'assistant',
            id: m.id,
            query: '',
            tokens: m.content,
            citations: m.citations ?? [],
            citationWarning: false,
            isStreaming: false,
            error: null,
          } satisfies AssistantMessage
        }),
      )
    }).catch(() => setMessages([]))
  }, [conversationId])

  const patchAssistant = useCallback(
    (id: string, patch: Partial<AssistantMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.role === 'assistant' && m.id === id ? { ...m, ...patch } : m)),
      )
    },
    [],
  )

  const ask = useCallback(
    async (question: string) => {
      if (!conversationId) return
      abortRef.current = false

      // Persist user message
      const savedUser = await postMessage(conversationId, 'user', question, null)
      // Auto-title on first message
      if (isFirstMessage.current) {
        isFirstMessage.current = false
        renameConversation(conversationId, question.slice(0, 60)).catch(() => {})
      }

      const userMsg: UserMessage = { role: 'user', id: savedUser.id, content: question }
      const assistantTempId = tempId()
      const assistantMsg: AssistantMessage = {
        role: 'assistant', id: assistantTempId, query: question,
        tokens: '', citations: [], citationWarning: false, isStreaming: true, error: null,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])

      let finalTokens = ''
      let finalCitations: Citation[] = []

      try {
        for await (const event of streamQuery(question, conversationId)) {
          if (abortRef.current) break
          if (event.type === 'token') {
            finalTokens += event.content
            setMessages((prev) =>
              prev.map((m) =>
                m.role === 'assistant' && m.id === assistantTempId
                  ? { ...m, tokens: m.tokens + event.content }
                  : m,
              ),
            )
          } else if (event.type === 'done') {
            finalCitations = event.citations
            patchAssistant(assistantTempId, {
              citations: event.citations,
              citationWarning: event.citation_warning,
              isStreaming: false,
              timings: event.timings,
              promptTokens: event.prompt_tokens,
              completionTokens: event.completion_tokens,
              costUsd: event.cost_usd,
              cached: event.cached,
            })
          }
        }
        // Persist assistant message
        const savedAssistant = await postMessage(conversationId, 'assistant', finalTokens, finalCitations.length ? finalCitations : null)
        // Replace temp id with real id
        setMessages((prev) =>
          prev.map((m) => (m.role === 'assistant' && m.id === assistantTempId ? { ...m, id: savedAssistant.id } : m)),
        )
      } catch (err) {
        patchAssistant(assistantTempId, { isStreaming: false, error: String(err) })
      }
    },
    [conversationId, patchAssistant],
  )

  const isStreaming = messages.some((m) => m.role === 'assistant' && m.isStreaming)

  const reset = useCallback(() => {
    abortRef.current = true
    setMessages([])
  }, [])

  return { messages, isStreaming, ask, reset }
}
```

- [ ] **Step 4: Update ChatWindow to accept conversationId prop**

In `frontend/src/components/ChatWindow.tsx`, change the component signature from:

```tsx
export function ChatWindow() {
  const { messages, isStreaming, ask } = useStream()
```

to:

```tsx
export function ChatWindow({ conversationId }: { conversationId: string | null }) {
  const { messages, isStreaming, ask } = useStream(conversationId)
```

Also update the empty state to show a prompt when no conversation is selected:

After the `messages.length === 0` block, add a check for `!conversationId`:

Replace the empty state section:

```tsx
        {!conversationId ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center mt-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <p className="text-sm text-gray-400">Select a conversation or start a new one</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center mt-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Ask anything</p>
              <p className="text-sm text-gray-400 mt-1">
                Every answer cites the exact source passage.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500
                    hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}
```

Also disable the input when `!conversationId`:

```tsx
          disabled={isStreaming || !conversationId}
```

and the submit button:

```tsx
          disabled={isStreaming || !input.trim() || !conversationId}
```

- [ ] **Step 5: Type-check**

```bash
cd frontend && npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ConversationSidebar.tsx frontend/src/app/ChatLayout.tsx frontend/src/hooks/useStream.ts frontend/src/components/ChatWindow.tsx
git commit -m "feat: conversation sidebar, persistent chat history, auto-title on first message"
```

---

## Task 14: End-to-end smoke test

- [ ] **Step 1: Delete old DB and restart backend**

```bash
rm -f backend/data/askdocs.db
cd backend && uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Register two accounts and verify isolation**

1. Open `http://localhost:5173/register` — register `user_a@test.com`
2. Navigate to `/app`, create a conversation, upload a PDF, ask a question. Verify answer cites doc.
3. Open incognito window, register `user_b@test.com`
4. Navigate to `/app`, create a conversation. Verify NO documents are visible.
5. Ask a question. Verify the answer reflects no documents (says it cannot answer).

- [ ] **Step 4: Test session persistence**

1. Refresh the page while logged in as user_a.
2. Verify the conversation list and messages reload (silent refresh worked).
3. Verify no login redirect occurred.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend && python -m pytest tests/test_auth.py tests/test_conversations.py -v
```
Expected: all tests **PASS**.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete auth + user management + chat management implementation"
```

---

## Verification Checklist

- [ ] `POST /auth/register` returns 409 for duplicate email
- [ ] `POST /auth/login` returns 401 for wrong password (no email/password hint)
- [ ] `GET /documents` returns 401 without token
- [ ] User A cannot see User B's documents or conversations (403/404)
- [ ] Page refresh restores session silently
- [ ] Google OAuth redirect URL navigates to Google consent screen
- [ ] Conversation sidebar: create, rename, delete all work
- [ ] First message auto-titles the conversation
- [ ] Clicking an old conversation loads its messages
- [ ] All backend tests pass: `pytest tests/test_auth.py tests/test_conversations.py -v`
- [ ] Frontend type-checks clean: `npm run typecheck`
