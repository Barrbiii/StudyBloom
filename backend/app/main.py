from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, case
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Task
from . import study_models  # noqa: F401 — регистрация таблиц
from .study_routes import router as study_router
from .event_routes import router as event_router
from .auth import router as auth_router, User, current_user
from .migrations import migrate_owners, migrate_task_priority
from .timetable_routes import router as timetable_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_owners(engine)
    migrate_task_priority(engine)
    yield


app = FastAPI(title="StudyBloom API", lifespan=lifespan)
app.include_router(study_router)
app.include_router(event_router)
app.include_router(auth_router)
app.include_router(timetable_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskCreate(BaseModel):
    priority: Literal["low", "normal", "high"] = "normal"
    title: str = Field(min_length=1, max_length=255)


class TaskUpdate(BaseModel):
    priority: Literal["low", "normal", "high"] | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    completed: bool | None = None


class TaskResponse(BaseModel):
    priority: str
    id: int
    title: str
    completed: bool

    model_config = {"from_attributes": True}


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "StudyBloom"}


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return db.scalars(select(Task).where(Task.owner_id == user.id).order_by(Task.id.desc())).all()


@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = Task(title=payload.title.strip(), owner_id=user.id, priority=payload.priority)
    if not task.title:
        raise HTTPException(status_code=422, detail="Название не может быть пустым")
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = db.get(Task, task_id)
    if task is None or task.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if payload.title is not None:
        task.title = payload.title.strip()
        if not task.title:
            raise HTTPException(status_code=422, detail="Название не может быть пустым")
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.completed is not None:
        task.completed = payload.completed
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    task = db.get(Task, task_id)
    if task is None or task.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    db.delete(task)
    db.commit()
