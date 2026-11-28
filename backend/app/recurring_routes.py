from .idempotency import RequestKey, save_created, invalidate_creation
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column
from .auth import User, current_user
from .database import Base, get_db
from .models import Task
from .recurrence_dates import occurrences

router = APIRouter(prefix='/api/recurring-tasks', tags=['Повторения задач'])

class Template(Base):
    __tablename__ = 'task_templates'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    title: Mapped[str] = mapped_column(String(230))
    priority: Mapped[str] = mapped_column(String(16))
    cadence: Mapped[str] = mapped_column(String(16))
    starts_on: Mapped[date] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)

class Occurrence(Base):
    __tablename__ = 'task_occurrences'
    __table_args__ = (UniqueConstraint('template_id', 'day'),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey('task_templates.id'), index=True)
    day: Mapped[date] = mapped_column(Date)
    task_id: Mapped[int | None] = mapped_column(ForeignKey('tasks.id', ondelete='SET NULL'), nullable=True, unique=True)

class Write(BaseModel):
    title: str = Field(min_length=1, max_length=230)
    priority: Literal['low','normal','high'] = 'normal'
    cadence: Literal['daily','weekly','monthly']
    starts_on: date
    ends_on: date | None = None

    @field_validator('title')
    @classmethod
    def clean(cls, value):
        if not value.strip(): raise ValueError('Название не может быть пустым')
        return value.strip()

    @model_validator(mode='after')
    def dates(self):
        if self.ends_on and self.ends_on < self.starts_on: raise ValueError('Конец раньше начала')
        return self

class Patch(BaseModel):
    paused: bool

class Window(BaseModel):
    from_day: date
    through: date

    @model_validator(mode='after')
    def dates(self):
        if not 0 <= (self.through-self.from_day).days <= 92:
            raise ValueError('Выбери период от1 до93 дней')
        return self


def view(item):
    return {key: getattr(item,key) for key in ('id','title','priority','cadence','starts_on','ends_on','paused')}


def owned(db, template_id, user):
    item = db.scalar(select(Template).where(Template.id == template_id, Template.owner_id == user.id).with_for_update())
    if item is None: raise HTTPException(404,'Шаблон не найден')
    return item

@router.get('')
def listing(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [view(item) for item in db.scalars(select(Template).where(Template.owner_id == user.id).order_by(Template.id))]

@router.post('', status_code=201)
def create(data: Write, db: Session = Depends(get_db), user: User = Depends(current_user), key: RequestKey = None):
    item = Template(owner_id=user.id, **data.model_dump())
    item=save_created(db,item,user,key,'/api/recurring-tasks',data)
    return view(item)

@router.patch('/{template_id}')
def pause(template_id: int, data: Patch, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = owned(db, template_id, user); item.paused = data.paused
    db.commit(); db.refresh(item)
    return view(item)

@router.post('/{template_id}/generate')
def generate(template_id: int, data: Window, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = owned(db, template_id, user)
    if item.paused: raise HTTPException(409,'Шаблон на паузе')
    days = occurrences(item.starts_on,item.ends_on,item.cadence,data.from_day,data.through)
    existing = set(db.scalars(select(Occurrence.day).where(Occurrence.template_id == item.id,
        Occurrence.day >= data.from_day, Occurrence.day <= data.through)))
    created = []
    for day in days:
        if day in existing: continue
        task = Task(owner_id=user.id,title=f'{item.title} · {day:%d.%m.%Y}',priority=item.priority)
        db.add(task); db.flush()
        db.add(Occurrence(template_id=item.id,day=day,task_id=task.id))
        created.append(task.id)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(409,'Период уже создаётся. Повтори запрос')
    return {'created': len(created), 'task_ids': created, 'already_generated': len(days)-len(created)}
