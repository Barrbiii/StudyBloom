from .idempotency import RequestKey, save_created, invalidate_creation
"""Daily goals keep their historical target when a habit's future goal changes."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column
from .auth import User, current_user
from .habit_streaks import streaks
from .database import Base, get_db

router = APIRouter(prefix='/api/habits', tags=['Привычки'])


class Habit(Base):
    __tablename__ = 'habits'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(24))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class HabitDay(Base):
    __tablename__ = 'habit_days'
    __table_args__ = (UniqueConstraint('habit_id', 'day'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey('habits.id'), index=True)
    day: Mapped[date] = mapped_column(Date)
    value: Mapped[int] = mapped_column(Integer)
    target: Mapped[int] = mapped_column(Integer)


class HabitWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target: int = Field(default=1, ge=1, le=10000, strict=True)
    unit: str = Field(default='раз', min_length=1, max_length=24)
    archived: bool = False

    @field_validator('name', 'unit')
    @classmethod
    def clean(cls, value):
        if not value.strip():
            raise ValueError('Заполните название и единицу')
        return value.strip()


class DayWrite(BaseModel):
    value: int = Field(ge=0, le=100000, strict=True)


def today(tz):
    try:
        return datetime.now(ZoneInfo(tz)).date()
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, 'Неизвестный часовой пояс')


def valid_day(day, tz):
    current = today(tz)
    if day > current or day < current - timedelta(days=366):
        raise HTTPException(422, 'Отметки доступны за сегодня и предыдущие 366 дней')
    return current


def owned(db, habit_id, user):
    item = db.scalar(select(Habit).where(Habit.id == habit_id, Habit.owner_id == user.id).with_for_update())
    if item is None:
        raise HTTPException(404, 'Привычка не найдена')
    return item


def base(item):
    return {key: getattr(item, key) for key in ('id', 'name', 'target', 'unit', 'archived')}


@router.post('', status_code=201)
def create(data: HabitWrite, db: Session = Depends(get_db), user: User = Depends(current_user), key: RequestKey = None):
    item = Habit(owner_id=user.id, **data.model_dump())
    item=save_created(db,item,user,key,'/api/habits',data)
    return base(item)


@router.put('/{habit_id}')
def update(habit_id: int, data: HabitWrite, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = owned(db, habit_id, user)
    if data.unit != item.unit and db.scalar(select(HabitDay.id).where(HabitDay.habit_id == item.id).limit(1)) is not None:
        raise HTTPException(409, 'Для новой единицы измерения создай отдельную привычку: история уже сохранена')
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return base(item)


@router.put('/{habit_id}/days/{day}')
def record(habit_id: int, day: date, data: DayWrite, tz: str = Query(default='Europe/Moscow', max_length=100),
           db: Session = Depends(get_db), user: User = Depends(current_user)):
    valid_day(day, tz)
    item = owned(db, habit_id, user)
    if item.archived:
        raise HTTPException(409, 'Сначала верни привычку из архива')
    row = db.scalar(select(HabitDay).where(HabitDay.habit_id == item.id, HabitDay.day == day))
    if row is None:
        row = HabitDay(habit_id=item.id, day=day, target=item.target)
        db.add(row)
    row.value = data.value
    db.commit()
    return {'day': day, 'value': row.value, 'target': row.target, 'completed': row.value >= row.target}


@router.get('')
def listing(day: date | None = None, tz: str = Query(default='Europe/Moscow', max_length=100),
            db: Session = Depends(get_db), user: User = Depends(current_user)):
    selected = day or today(tz)
    valid_day(selected, tz)
    habits = db.scalars(select(Habit).where(Habit.owner_id == user.id).order_by(Habit.id)).all()
    records = db.scalars(select(HabitDay).join(Habit).where(Habit.owner_id == user.id)).all()
    result = []
    for item in habits:
        days = [row for row in records if row.habit_id == item.id]
        row = next((row for row in days if row.day == selected), None)
        result.append(base(item) | streaks([r.day for r in days if r.value >= r.target], today(tz)) | {'day': selected, 'value': row.value if row else 0,
            'day_target': row.target if row else item.target,
            'completed': bool(row and row.value >= row.target)})
    return result


@router.get('/{habit_id}/history')
def history(habit_id: int, days: int = Query(default=30, ge=1, le=366),
            tz: str = Query(default='Europe/Moscow', max_length=100),
            db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = owned(db, habit_id, user)
    current = today(tz)
    rows = db.scalars(select(HabitDay).where(HabitDay.habit_id == item.id,
        HabitDay.day >= current - timedelta(days=days-1), HabitDay.day <= current).order_by(HabitDay.day.desc())).all()
    return [{'day': r.day, 'value': r.value, 'target': r.target, 'completed': r.value >= r.target} for r in rows]
