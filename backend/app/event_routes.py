from .idempotency import RequestKey, save_created, invalidate_creation
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AwareDatetime, BaseModel, Field, field_validator, model_validator
from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base, get_db
from .auth import User, current_user

router = APIRouter(prefix="/api/events", tags=["События"])


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, default="")


class EventWrite(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location: str = Field(default="", max_length=255)

    @field_validator("title", "location")
    @classmethod
    def clean_text(cls, value: str, info):
        value = value.strip()
        if info.field_name == "title" and not value:
            raise ValueError("Название не может быть пустым")
        return value

    @model_validator(mode="after")
    def check_interval(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("Окончание должно быть позже начала")
        return self


class EventRead(BaseModel):
    id: int
    title: str
    starts_at: datetime
    ends_at: datetime
    location: str
    model_config = {"from_attributes": True}

    @field_validator("starts_at", "ends_at")
    @classmethod
    def utc_response(cls, value: datetime):
        # SQLite теряет tzinfo; в БД всегда записываем UTC.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def find_event(db: Session, event_id: int, user: User):
    event = db.get(CalendarEvent, event_id)
    if event is None or event.owner_id != user.id:
        raise HTTPException(404, "Событие не найдено")
    return event


def apply_data(event: CalendarEvent, data: EventWrite):
    event.title = data.title
    event.location = data.location
    event.starts_at = data.starts_at.astimezone(timezone.utc)
    event.ends_at = data.ends_at.astimezone(timezone.utc)


@router.get("", response_model=list[EventRead])
def list_events(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(CalendarEvent).where(CalendarEvent.owner_id == user.id).order_by(CalendarEvent.starts_at, CalendarEvent.id)).all()


@router.post("", response_model=EventRead, status_code=201)
def create_event(data: EventWrite, db: Session = Depends(get_db), user: User = Depends(current_user), key: RequestKey = None):
    event = CalendarEvent(owner_id=user.id)
    apply_data(event, data)
    return save_created(db,event,user,key,'/api/events',data)


@router.get("/{event_id}", response_model=EventRead)
def read_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return find_event(db, event_id, user)


@router.put("/{event_id}", response_model=EventRead)
def update_event(event_id: int, data: EventWrite, db: Session = Depends(get_db), user: User = Depends(current_user)):
    event = find_event(db, event_id, user)
    apply_data(event, data)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    event=find_event(db,event_id,user)
    invalidate_creation(db,'/api/events',event_id,user.id)
    db.delete(event)
    db.commit()
