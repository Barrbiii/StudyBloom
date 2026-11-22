"""Основа аккаунтов. Подключение защиты учебных маршрутов — отдельный этап."""
import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base, get_db

COOKIE = "studybloom_session"
TTL = 60 * 60 * 24
router = APIRouter(prefix="/api/auth", tags=["Аккаунты"])


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(derived).decode()


def password_matches(password: str, encoded: str) -> bool:
    try:
        kind, salt, _ = encoded.split("$")
        return kind == "scrypt" and hmac.compare_digest(password_hash(password, base64.b64decode(salt)), encoded)
    except (ValueError, TypeError):
        return False


DUMMY_HASH = password_hash("not-a-real-user-password")


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=12, max_length=128, repr=False)


class UserRead(BaseModel):
    id: int
    username: str
    model_config = {"from_attributes": True}


def same_origin(request: Request):
    origin = request.headers.get("origin")
    if origin and origin != f"{request.url.scheme}://{request.url.netloc}":
        raise HTTPException(403, "Недопустимый источник запроса")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        same_origin(request)
    token = request.cookies.get(COOKIE, "")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if session is None:
        raise HTTPException(401, "Необходим вход")
    expiry = session.expires_at
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    user = db.get(User, session.user_id)
    if expiry <= datetime.now(timezone.utc) or user is None:
        raise HTTPException(401, "Сессия истекла")
    return user


@router.post("/register", response_model=UserRead, status_code=201, dependencies=[Depends(same_origin)])
def register(data: Credentials, db: Session = Depends(get_db)):
    user = User(username=data.username.lower(), password_hash=password_hash(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Логин уже занят")
    db.refresh(user)
    return user


@router.post("/login", response_model=UserRead, dependencies=[Depends(same_origin)])
def login(data: Credentials, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username.lower()))
    valid = password_matches(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Неверный логин или пароль")
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=TTL)))
    db.commit()
    response.set_cookie(COOKIE, token, max_age=TTL, httponly=True, samesite="strict",
        secure=os.getenv("AUTH_COOKIE_SECURE", "true").lower() != "false", path="/api")
    response.headers["Cache-Control"] = "no-store"
    return user


@router.get("/me", response_model=UserRead)
def me(response: Response, user: User = Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/logout", status_code=204, dependencies=[Depends(same_origin)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE, "")
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest()) if token else None
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(COOKIE, path="/api", httponly=True, samesite="strict")
