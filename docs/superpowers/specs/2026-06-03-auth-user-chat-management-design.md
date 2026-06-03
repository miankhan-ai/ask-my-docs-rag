# Auth, User Management & Chat Management Design

**Date:** 2026-06-03  
**Status:** Draft  
**Scope:** Add JWT-based authentication, per-user document isolation, and named conversation management to the Ask My Docs RAG application.

---

## Context

The current app is a single-tenant, stateless RAG system — all documents are shared globally, there are no user accounts, and chat messages exist only in-memory (lost on page refresh). We need to evolve it into a public SaaS with open signup, full per-user data isolation, and persistent named chat sessions modeled after the ChatGPT UX.

---

## Architecture

### Backend

**New modules:**

| Module | Responsibility |
|--------|---------------|
| `app/auth/router.py` | Register, login, Google OAuth, refresh, logout, me endpoints |
| `app/auth/service.py` | Password hashing, JWT issue/verify, token rotation, OAuth account linking |
| `app/auth/dependencies.py` | `get_current_user` FastAPI dependency (inject into protected routes) |
| `app/auth/schemas.py` | Pydantic request/response schemas for auth |
| `app/auth/oauth.py` | Google OAuth2 flow: redirect, callback, token exchange, profile fetch |
| `app/conversations/router.py` | CRUD for conversations + message history |
| `app/conversations/service.py` | Business logic for conversation/message management |

**New database models (added to `models.py`):**

```
User
├── id (UUID, PK)
├── email (varchar 255, unique, indexed)
├── password_hash (varchar 255, nullable) — null for Google-only accounts
├── google_id (varchar 255, unique, nullable) — Google sub claim
├── avatar_url (varchar 512, nullable) — from Google profile
├── display_name (varchar 255, nullable) — from Google profile
├── auth_provider (enum: email | google | both)
├── is_active (bool, default True)
├── is_admin (bool, default False)
├── created_at (datetime, utcnow)
└── updated_at (datetime, onupdate=utcnow)

Conversation
├── id (UUID, PK)
├── user_id (FK → users.id, cascade delete)
├── title (varchar 255)
├── created_at (datetime)
└── updated_at (datetime)

Message
├── id (UUID, PK)
├── conversation_id (FK → conversations.id, cascade delete)
├── role (enum: user | assistant)
├── content (TEXT)
├── citations (JSON, nullable) — list of {chunk_id, source, passage}
└── created_at (datetime)
```

**Modified existing models:**

- `Document`: add `user_id (FK → users.id)` — all document queries filter by current user
- `Chunk`: no change needed (cascades from Document)

**New endpoints:**

```
POST   /auth/register           → Create account, return tokens
POST   /auth/login              → Verify credentials, return tokens
GET    /auth/google             → Redirect to Google consent screen
GET    /auth/google/callback    → Exchange code for tokens, upsert user, return tokens
POST   /auth/refresh            → Rotate access token via httpOnly cookie
POST   /auth/logout             → Revoke refresh token
GET    /auth/me                 → Current user profile

GET    /conversations           → List user's conversations (paginated)
POST   /conversations           → Create new conversation
GET    /conversations/{id}      → Get conversation + messages
PATCH  /conversations/{id}      → Rename conversation
DELETE /conversations/{id}      → Delete conversation + messages

POST   /conversations/{id}/messages  → Save a user message
```

**Modified existing endpoints** (add `user: User = Depends(get_current_user)`):

- `POST /upload` — stores `document.user_id = user.id`
- `GET /documents` — filters by `user_id`
- `DELETE /documents/{id}` — checks ownership before delete
- `POST /query` — filters retrieval to `user_id` chunks
- `GET /retrieval-debug` — filters to `user_id`

**Token strategy:**

- **Access token**: JWT, 15-minute TTL, stored in-memory on frontend (never localStorage)
- **Refresh token**: opaque UUID stored in DB + sent as `httpOnly; SameSite=Strict` cookie, 7-day TTL
- On refresh: old token invalidated (rotation), new pair issued
- Logout: deletes refresh token from DB

**Dependencies to add to `requirements.txt`:**

```
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
httpx>=0.27          # Google token exchange & userinfo fetch
authlib>=1.3         # OAuth2 state/PKCE helpers (optional but recommended)
```

**New env vars:**

```
JWT_SECRET_KEY=<random 256-bit hex>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

---

### Frontend

**New pages/components:**

| Path | Purpose |
|------|---------|
| `pages/LoginPage.tsx` | Email + password form + "Continue with Google" button |
| `pages/RegisterPage.tsx` | Email + password + confirm form + "Continue with Google" button |
| `contexts/AuthContext.tsx` | Access token, user info, login/logout actions, auto-refresh |
| `hooks/useAuth.ts` | Convenience hook wrapping AuthContext |
| `components/ProtectedRoute.tsx` | HOC — redirects to /login if not authenticated |
| `components/ConversationSidebar.tsx` | Named chat list with create/rename/delete |
| `components/UserMenu.tsx` | Avatar chip in header, shows email, logout button |

**Modified existing files:**

- `App.tsx`: Wrap `/app/*` routes in `<ProtectedRoute>`. Add `/login` and `/register` routes.
- `AppLayout.tsx`: Add `<UserMenu>` to header. Add `<ConversationSidebar>` to left rail.
- `ChatWindow.tsx`: On conversation select, load messages from API. On submit, save user message + assistant response to API.
- `api/index.ts`: Add `Authorization: Bearer <token>` header to every request. Add 401 interceptor — silently refresh token then retry original request once.
- `useStream.ts` / `useDocuments.ts`: No structural change, but data is now user-scoped by the backend.

**Auth flow (email/password):**

1. User visits `/app` → `ProtectedRoute` checks `AuthContext.user` → if null, redirect to `/login`
2. Login: POST `/auth/login` → store access token in memory, refresh token arrives as httpOnly cookie
3. On page reload: attempt silent refresh via POST `/auth/refresh` (cookie sent automatically) → if succeeds, restore session; if fails, redirect to `/login`
4. On any 401: interceptor calls refresh → retry → if still 401, logout and redirect

**Auth flow (Google OAuth):**

1. User clicks "Continue with Google" → frontend calls `GET /auth/google` → backend redirects to Google with `state` nonce stored in session
2. Google redirects to `GET /auth/google/callback?code=...&state=...` → backend validates state, exchanges code for Google tokens via HTTPS, fetches userinfo
3. Backend upserts user: if `google_id` already exists → link/return existing account; if email matches existing email/password account → link Google to it; otherwise create new user
4. Backend issues own access + refresh tokens, redirects frontend to `/app` with access token as a short-lived query param (consumed once and moved to memory) or via a one-time code
5. Same silent refresh / 401 handling as email flow

**Conversation sidebar UX:**

- On load: fetch `GET /conversations`, render list sorted by `updated_at` desc
- "New chat" button: POST `/conversations` with default title "New Conversation", auto-navigate to it
- Active conversation title: auto-updated to first user message (PATCH after first message submitted)
- Click conversation: load `GET /conversations/{id}` messages into `ChatWindow`
- Right-click / kebab menu on each item: Rename, Delete

---

## Data Flow: Authenticated Query

```
User submits message
  → POST /conversations/{id}/messages (save user message)
  → POST /query (with conversation_id, filters chunks to user_id)
    → SSE stream → ChatWindow updates
  → On stream complete: POST /conversations/{id}/messages (save assistant message + citations)
  → PATCH /conversations/{id} (update title if first message)
```

---

## Error Handling

- Registration with duplicate email → `409 Conflict` with clear message
- Wrong password → `401 Unauthorized` (no hint whether email or password is wrong)
- Expired access token → frontend auto-refreshes silently
- Expired refresh token → logout, redirect to `/login` with "Session expired" toast
- Accessing another user's conversation or document → `403 Forbidden`
- Deleted conversation still in URL → `404`, redirect to empty state

---

## Testing

**Backend unit tests:**
- `test_auth.py`: register, login, refresh, logout, duplicate email, wrong password, expired token
- `test_conversations.py`: CRUD, ownership checks (user A cannot access user B's conversations)
- `test_documents.py`: upload + query isolation (user A's query only returns user A's chunks)

**Frontend:**
- Auth context: mock API, verify token refresh logic, verify 401 retry
- Protected route: verify redirect behavior when unauthenticated

**Manual verification:**
1. Register two accounts, upload different docs to each, verify queries return only own docs
2. Refresh page while logged in — session should restore silently
3. Let access token expire (reduce to 1 min for test) — verify auto-refresh with no UX disruption
4. Login from two browser tabs simultaneously — verify both stay authenticated

---

## Out of Scope (this iteration)

- Email verification
- GitHub/other OAuth providers
- Admin user management panel
- Document sharing between users
- Password reset / forgot password flow
