"""Google OAuth2 flow helpers."""
import hashlib
import hmac
import secrets
import time
import httpx

from app.config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

_STATE_TTL = 600  # 10 minutes


def generate_oauth_state() -> str:
    """Generate a self-contained HMAC-signed state — no server session needed."""
    nonce = secrets.token_urlsafe(16)
    ts = str(int(time.time()))
    payload = f"{nonce}.{ts}"
    sig = hmac.new(settings.jwt_secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_oauth_state(state: str) -> bool:
    """Verify the HMAC signature and TTL of the state parameter."""
    try:
        parts = state.rsplit(".", 1)
        if len(parts) != 2:
            return False
        payload, sig = parts
        expected = hmac.new(settings.jwt_secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return False
        ts = int(payload.split(".")[1])
        if time.time() - ts > _STATE_TTL:
            return False
        return True
    except Exception:
        return False


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
