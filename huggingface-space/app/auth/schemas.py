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
