from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, ForeignKey, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column
from .auth import User, current_user
from .database import Base, get_db
from .models import Task

router = APIRouter(prefix='/api/tasks/{task_id}/subtasks', tags=['Подзадачи'])

class Subtask(Base):
    __tablename__ = 'subtasks'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey('tasks.id'), index=True)
    title: Mapped[str] = mapped_column(String(255))
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

class Create(BaseModel):
    title: str = Field(min_length=1, max_length=255)

    @field_validator('title')
    @classmethod
    def clean(cls, value):
        if not value.strip():
            raise ValueError('Название шага не может быть пустым')
        return value.strip()

class Update(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    completed: bool | None = None

    @field_validator('title')
    @classmethod
    def clean(cls, value):
        return Create.clean(value) if value is not None else value

class Read(Create):
    id: int
    completed: bool
    model_config = {'from_attributes': True}


def parent(db, task_id, user):
    task = db.scalar(select(Task).where(Task.id == task_id, Task.owner_id == user.id).with_for_update())
    if task is None:
        raise HTTPException(404, 'Задача не найдена')
    return task


def owned(db, task_id, subtask_id, user):
    parent(db, task_id, user)
    item = db.get(Subtask, subtask_id)
    if item is None or item.task_id != task_id:
        raise HTTPException(404, 'Шаг не найден')
    return item

@router.get('', response_model=list[Read])
def listing(task_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    parent(db, task_id, user)
    return db.scalars(select(Subtask).where(Subtask.task_id == task_id).order_by(Subtask.id)).all()

@router.post('', response_model=Read, status_code=201)
def create(task_id: int, data: Create, db: Session = Depends(get_db), user: User = Depends(current_user)):
    parent(db, task_id, user)
    item = Subtask(task_id=task_id, title=data.title)
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.patch('/{subtask_id}', response_model=Read)
def update(task_id: int, subtask_id: int, data: Update, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = owned(db, task_id, subtask_id, user)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item

@router.delete('/{subtask_id}', status_code=204)
def delete(task_id: int, subtask_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(owned(db, task_id, subtask_id, user)); db.commit()
