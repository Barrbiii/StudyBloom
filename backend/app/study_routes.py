from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .auth import User, current_user
from .timetable_routes import Lesson
from .study_models import Deadline, Subject

router = APIRouter(prefix="/api", tags=["Учёба"])


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = Field(default="#d986a7", pattern=r"^#[0-9a-fA-F]{6}$")


class SubjectRead(SubjectCreate):
    id: int
    model_config = {"from_attributes": True}


class DeadlineCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    due_date: date
    subject_id: int


class DeadlineRead(DeadlineCreate):
    id: int
    model_config = {"from_attributes": True}


@router.get("/subjects", response_model=list[SubjectRead])
def list_subjects(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Subject).where(Subject.owner_id == user.id).order_by(Subject.name)).all()


@router.post("/subjects", response_model=SubjectRead, status_code=201)
def add_subject(data: SubjectCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    subject = Subject(name=data.name.strip(), color=data.color, owner_id=user.id)
    if not subject.name:
        raise HTTPException(422, "Название не может быть пустым")
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=204)
def remove_subject(subject_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    subject = db.get(Subject, subject_id)
    if subject is None or subject.owner_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    if db.scalar(select(Deadline.id).where(Deadline.subject_id == subject_id).limit(1)) is not None:
        raise HTTPException(409, "Сначала удалите или перенесите дедлайны этого предмета")
    if db.scalar(select(Lesson.id).where(Lesson.subject_id == subject_id).limit(1)) is not None:
        raise HTTPException(409, "Сначала удалите занятия этого предмета")
    db.delete(subject)
    db.commit()


@router.get("/deadlines", response_model=list[DeadlineRead])
def list_deadlines(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Deadline).where(Deadline.owner_id == user.id).order_by(Deadline.due_date, Deadline.id)).all()


@router.post("/deadlines", response_model=DeadlineRead, status_code=201)
def add_deadline(data: DeadlineCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    subject = db.get(Subject, data.subject_id)
    if subject is None or subject.owner_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    deadline = Deadline(owner_id=user.id, title=data.title.strip(), due_date=data.due_date, subject_id=data.subject_id)
    if not deadline.title:
        raise HTTPException(422, "Название не может быть пустым")
    db.add(deadline)
    db.commit()
    db.refresh(deadline)
    return deadline


@router.delete("/deadlines/{deadline_id}", status_code=204)
def remove_deadline(deadline_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    deadline = db.get(Deadline, deadline_id)
    if deadline is None or deadline.owner_id != user.id:
        raise HTTPException(404, "Дедлайн не найден")
    db.delete(deadline)
    db.commit()


@router.put("/deadlines/{deadline_id}", response_model=DeadlineRead)
def update_deadline(deadline_id: int, data: DeadlineCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    deadline = db.get(Deadline, deadline_id)
    if deadline is None or deadline.owner_id != user.id:
        raise HTTPException(404, "Дедлайн не найден")
    title = data.title.strip()
    if not title:
        raise HTTPException(422, "Название не может быть пустым")
    subject = db.get(Subject, data.subject_id)
    if subject is None or subject.owner_id != user.id:
        raise HTTPException(404, "Предмет не найден")
    deadline.title = title
    deadline.due_date = data.due_date
    deadline.subject_id = data.subject_id
    db.commit()
    db.refresh(deadline)
    return deadline
