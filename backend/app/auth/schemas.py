from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    status: str = "active"
    created_at: datetime | None = None
    email_notifications: bool = True
    dark_mode_preference: str | None = None

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
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
