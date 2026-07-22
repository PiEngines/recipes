from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class DeclinedShare(BaseModel):
    recipe_id: int
    recipe_title: str
    declined_by_name: str


class Notification(BaseModel):
    type: str   # share_declined | share_approved | recipe_review_result
    data: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    declined_shares: list[DeclinedShare] | None = None  # kept for backward compat
    notifications: list[Notification] | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    username: str | None = None
    role: str
    is_active: bool
    status: str = "active"
    created_at: datetime | None = None
    email_notifications: bool = True
    dark_mode_preference: str | None = None
    email_verified: bool = False

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    username: str | None = None
    token: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class InviteRequest(BaseModel):
    email: str
    role: str = "kuechenhilfe"
    recipe_id: int | None = None


class ResendVerificationRequest(BaseModel):
    email: str


class SetUsernameRequest(BaseModel):
    username: str
