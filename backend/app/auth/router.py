import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_koch_or_above
from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.password import hash_password, verify_password
from app.auth.schemas import (
    ForgotPasswordRequest,
    InviteRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.database import get_db
from app.email_service import (
    send_invitation_email,
    send_password_reset_email,
    send_pending_registration_email,
    send_verification_email,
    send_welcome_email,
)
from app.models import User
from app.models.tokens import InvitationToken, PasswordResetToken
from app.models.user import UserRole
from app.rate_limiter import check_rate_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])

_PASSWORD_RE = re.compile(r".*\d.*")


def _validate_password(pw: str) -> None:
    if len(pw) < 8 or not _PASSWORD_RE.match(pw):
        raise HTTPException(
            status_code=400,
            detail="Passwort muss mind. 8 Zeichen und eine Zahl enthalten",
        )


def _is_disposable(email: str, db: Session) -> bool:
    from app.models.access import DisposableEmailDomain

    domain = email.lower().split("@")[-1] if "@" in email else email
    return (
        db.query(DisposableEmailDomain)
        .filter(DisposableEmailDomain.domain == domain)
        .first()
        is not None
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    # Stateless JWTs: the client discards both tokens on logout.
    return


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", status_code=status.HTTP_200_OK)
def register(
    body: RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Validate inputs
    if len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name muss mind. 2 Zeichen haben")
    _validate_password(body.password)
    email = body.email.lower().strip()
    if _is_disposable(email, db):
        raise HTTPException(status_code=400, detail="Wegwerf-Email-Adressen sind nicht erlaubt")
    if db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first():
        raise HTTPException(status_code=409, detail="Email bereits registriert")

    was_invited = False
    inv = None
    if body.token:
        inv = (
            db.query(InvitationToken)
            .filter(
                InvitationToken.token == body.token,
                InvitationToken.used_at.is_(None),
                InvitationToken.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )
        if not inv:
            raise HTTPException(status_code=400, detail="Einladungslink ungültig oder abgelaufen")
        was_invited = True
        inv.used_at = datetime.now(timezone.utc)

    role = (
        UserRole(inv.role)
        if inv and inv.role in UserRole._value2member_map_
        else UserRole.kuechenhilfe
    )
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=role,
        is_active=False,
        status="pending",
        email_verified=False,
    )
    db.add(user)
    db.flush()

    # Handle recipe access for invited users
    if inv and inv.recipe_id:
        from app.models.access import RecipeAccess

        db.add(RecipeAccess(
            recipe_id=inv.recipe_id,
            access_type="individual",
            email=email,
            created_by=inv.invited_by or user.id,
        ))

    # Create email verification token
    from app.models.tokens import EmailVerificationToken

    ev_token_str = secrets.token_urlsafe(32)
    ev_token = EmailVerificationToken(
        token=ev_token_str,
        user_id=user.id,
        was_invited=was_invited,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(ev_token)
    db.commit()

    background_tasks.add_task(send_verification_email, email, user.name, ev_token_str)

    # Also notify admins if not invited
    if not was_invited:
        admins = (
            db.query(User)
            .filter(
                User.role.in_([UserRole.chefkoch, UserRole.admin]),
                User.is_active.is_(True),
            )
            .all()
        )
        for admin in admins:
            background_tasks.add_task(send_pending_registration_email, admin.email, user.name, email)

    return {"message": "Bestätigungs-Email gesendet", "status": "pending"}


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    from app.models.tokens import EmailVerificationToken

    ev = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.token == token,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not ev:
        raise HTTPException(status_code=400, detail="Token ungültig oder abgelaufen")

    user = db.query(User).filter(User.id == ev.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Benutzer nicht gefunden")

    user.email_verified = True
    ev.used_at = datetime.now(timezone.utc)

    result_status = "pending"
    if ev.was_invited:
        user.is_active = True
        user.status = "active"
        result_status = "active"

    db.commit()
    return {"status": result_status}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    email = body.email.lower().strip()
    check_rate_limit(f"pwd_reset:{email}", max_calls=3, window_seconds=3600)

    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if user:
        token_str = secrets.token_urlsafe(32)
        prt = PasswordResetToken(
            token=token_str,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(prt)
        db.commit()
        background_tasks.add_task(send_password_reset_email, email, token_str)

    return {"detail": "Falls die Email existiert, wurde eine Email versendet"}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    _validate_password(body.new_password)
    prt = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not prt:
        raise HTTPException(status_code=400, detail="Token ungültig oder abgelaufen")

    user = db.query(User).filter(User.id == prt.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Benutzer nicht gefunden")

    user.password_hash = hash_password(body.new_password)
    prt.used_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "Passwort erfolgreich zurückgesetzt"}


@router.post("/invite", status_code=status.HTTP_200_OK)
def invite(
    body: InviteRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_koch_or_above),
    db: Session = Depends(get_db),
):
    # Self-invite check
    if body.email.lower().strip() == current_user.email:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst einladen")

    # Kochs can only invite kuechenhilfe
    if current_user.role == UserRole.koch and body.role != "kuechenhilfe":
        raise HTTPException(status_code=403, detail="Köche können nur Küchenhilfen einladen")

    if current_user.role not in (UserRole.chefkoch, UserRole.admin):
        check_rate_limit(f"invite:{current_user.id}", max_calls=3, window_seconds=3600)

    email = body.email.lower().strip()
    if _is_disposable(email, db):
        raise HTTPException(status_code=400, detail="Wegwerf-Email-Adressen sind nicht erlaubt")

    token_str = secrets.token_urlsafe(32)
    inv = InvitationToken(
        token=token_str,
        email=email,
        invited_by=current_user.id,
        role=body.role,
        recipe_id=body.recipe_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(inv)
    db.commit()

    recipe_title = None
    if body.recipe_id:
        from app.models import Recipe

        r = db.query(Recipe).filter(Recipe.id == body.recipe_id).first()
        recipe_title = r.title if r else None

    background_tasks.add_task(
        send_invitation_email, email, token_str, current_user.name, recipe_title
    )
    return {"detail": "Einladung versendet"}


# ── Change password ───────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Aktuelles Passwort ist falsch")
    _validate_password(body.new_password)
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Passwort geändert"}
