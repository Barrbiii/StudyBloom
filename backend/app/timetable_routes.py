from .idempotency import RequestKey, save_created, invalidate_creation
from datetime import date, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import Date, ForeignKey, Integer, String, Time, select
from sqlalchemy.orm import Mapped, Session, mapped_column
from .database import Base, get_db
from .auth import User, current_user
from .study_models import Subject

router = APIRouter(prefix='/api/lessons', tags=['Расписание'])


class Lesson(Base):
    __tablename__ = 'lessons'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey('subjects.id'), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_at: Mapped[time] = mapped_column(Time, nullable=False)
    ends_at: Mapped[time] = mapped_column(Time, nullable=False)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    room: Mapped[str] = mapped_column(String(120), default='', nullable=False)
    teacher: Mapped[str] = mapped_column(String(120), default='', nullable=False)


class LessonWrite(BaseModel):
    subject_id: int
    weekday: int = Field(ge=0, le=6)
    starts_at: time
    ends_at: time
    starts_on: date
    ends_on: date
    room: str = Field(default='', max_length=120)
    teacher: str = Field(default='', max_length=120)

    @field_validator('starts_at', 'ends_at')
    @classmethod
    def wall_clock(cls, value):
        if value.tzinfo is not None:
            raise ValueError('Укажите местное время без часового пояса')
        return value

    @model_validator(mode='after')
    def interval(self):
        if self.ends_at <= self.starts_at or self.ends_on < self.starts_on:
            raise ValueError('Некорректный интервал занятия')
        return self


class LessonRead(LessonWrite):
    id: int
    model_config = {'from_attributes': True}


def owned(db, lesson_id, user):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None or lesson.owner_id != user.id:
        raise HTTPException(404, 'Занятие не найдено')
    return lesson


def apply(db, lesson, data, user):
    subject = db.get(Subject, data.subject_id)
    if subject is None or subject.owner_id != user.id:
        raise HTTPException(404, 'Предмет не найден')
    for key, value in data.model_dump().items():
        setattr(lesson, key, value.strip() if isinstance(value, str) else value)


@router.get('', response_model=list[LessonRead])
def listing(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Lesson).where(Lesson.owner_id == user.id).order_by(Lesson.weekday, Lesson.starts_at, Lesson.id)).all()


@router.post('', response_model=LessonRead, status_code=201)
def create(data: LessonWrite, db: Session = Depends(get_db), user: User = Depends(current_user), key: RequestKey = None):
    lesson = Lesson(owner_id=user.id)
    apply(db, lesson, data, user)
    lesson=save_created(db,lesson,user,key,'/api/lessons',data)
    return lesson


@router.put('/{lesson_id}', response_model=LessonRead)
def update(lesson_id: int, data: LessonWrite, db: Session = Depends(get_db), user: User = Depends(current_user)):
    lesson = owned(db, lesson_id, user)
    apply(db, lesson, data, user)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete('/{lesson_id}', status_code=204)
def delete(lesson_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    lesson=owned(db,lesson_id,user)
    invalidate_creation(db,'/api/lessons',lesson_id,user.id)
    db.delete(lesson)
    db.commit()
