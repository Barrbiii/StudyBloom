"""Server-timed, account-isolated focus sessions; no client-reported elapsed time."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from .auth import User, current_user
from .database import Base, get_db

router = APIRouter(prefix='/api/pomodoro', tags=['Pomodoro'])


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class FocusSession(Base):
    __tablename__ = 'focus_sessions'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    active_owner: Mapped[int | None] = mapped_column(ForeignKey('users.id'), unique=True, nullable=True)
    mode: Mapped[str] = mapped_column(String(12))
    state: Mapped[str] = mapped_column(String(12), default='running')
    duration_seconds: Mapped[int] = mapped_column(Integer)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    segment_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Start(BaseModel):
    mode: Literal['focus', 'break'] = 'focus'
    minutes: int = Field(default=25, ge=1, le=120, strict=True)


def elapsed(item, at=None):
    seconds = item.elapsed_seconds
    if item.state == 'running':
        seconds += max(0, int(((at or now()) - utc(item.segment_started_at)).total_seconds()))
    return min(item.duration_seconds, seconds)


def view(item):
    return {key: getattr(item, key) for key in ('id', 'mode', 'state', 'duration_seconds', 'created_at', 'finished_at')} | {'elapsed_seconds': elapsed(item)}


@router.get('/current')
def current(db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.scalar(select(FocusSession).where(FocusSession.active_owner == user.id))
    return view(item) if item else None


@router.post('/sessions', status_code=201)
def start(data: Start, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = FocusSession(owner_id=user.id, active_owner=user.id, mode=data.mode,
                        duration_seconds=data.minutes * 60, segment_started_at=now())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Сначала заверши или отмени текущую сессию')
    db.refresh(item)
    return view(item)


@router.post('/sessions/{session_id}/{action}')
def transition(session_id: int, action: Literal['pause', 'resume', 'finish', 'cancel'],
               db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.scalar(select(FocusSession).where(FocusSession.id == session_id,
                     FocusSession.owner_id == user.id).with_for_update())
    if item is None:
        raise HTTPException(404, 'Сессия не найдена')
    if item.state in ('completed', 'cancelled'):
        if (action == 'finish' and item.state == 'completed') or (action == 'cancel' and item.state == 'cancelled'):
            return view(item)
        raise HTTPException(409, 'Сессия уже завершена')
    at = now()
    spent = elapsed(item, at)
    if action == 'pause':
        if item.state != 'running':
            return view(item)
        item.state = 'paused'
    elif action == 'resume':
        if item.state != 'paused':
            return view(item)
        item.state = 'running'
        item.segment_started_at = at
    elif action == 'finish':
        if spent < item.duration_seconds:
            raise HTTPException(409, 'Время сессии ещё не истекло')
        item.state = 'completed'
    else:
        item.state = 'cancelled'
    item.elapsed_seconds = spent
    if item.state in ('completed', 'cancelled'):
        item.finished_at = at
        item.active_owner = None
    db.commit()
    db.refresh(item)
    return view(item)


@router.get('/history')
def history(db: Session = Depends(get_db), user: User = Depends(current_user)):
    items = db.scalars(select(FocusSession).where(FocusSession.owner_id == user.id,
        FocusSession.active_owner.is_(None)).order_by(FocusSession.id.desc()).limit(100)).all()
    return [view(item) for item in items]
