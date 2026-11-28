from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Task
from .idempotency import RequestKey, save_created, invalidate_creation
from .export_routes import router as export_router
from .recurring_routes import Occurrence, router as recurring_router
from .subtask_routes import Subtask, router as subtask_router
from . import study_models  # noqa: F401 — регистрация таблиц
from .study_routes import router as study_router
from .event_routes import router as event_router
from .auth import router as auth_router, User, current_user
from .migrations import migrate_owners, migrate_task_priority
from .timetable_routes import router as timetable_router
from .pomodoro_routes import router as pomodoro_router
from .habit_routes import router as habit_router
from .dashboard_routes import router as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_owners(engine)
    migrate_task_priority(engine)
    yield


app = FastAPI(title="StudyBloom API", lifespan=lifespan)
app.include_router(export_router)
app.include_router(recurring_router)
app.include_router(subtask_router)
app.include_router(study_router)
app.include_router(event_router)
app.include_router(auth_router)
app.include_router(timetable_router)
app.include_router(pomodoro_router)
app.include_router(habit_router)
app.include_router(dashboard_router)
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


@app.get('/api/ready')
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text('SELECT 1'))
    except SQLAlchemyError:
        return JSONResponse({'status':'unavailable'},status_code=503,headers={'Cache-Control':'no-store'})
    return JSONResponse({'status':'ready'},headers={'Cache-Control':'no-store'})


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(db: Session = Depends(get_db), user: User = Depends(current_user),
               q: str = Query(default="", max_length=255), completed: bool | None = None,
               priority: Literal["low", "normal", "high"] | None = None):
    query = select(Task).where(Task.owner_id == user.id)
    if q.strip():
        escaped = q.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_")
        query = query.where(Task.title.ilike(f"%{escaped}%", escape="!"))
    if completed is not None:
        query = query.where(Task.completed == completed)
    if priority is not None:
        query = query.where(Task.priority == priority)
    return db.scalars(query.order_by(Task.id.desc())).all()


@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), user: User = Depends(current_user), key: RequestKey = None):
    task = Task(title=payload.title.strip(), owner_id=user.id, priority=payload.priority)
    if not task.title:
        raise HTTPException(status_code=422, detail="Название не может быть пустым")
    return save_created(db,task,user,key,'/api/tasks',payload)


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
    if db.scalar(select(Subtask.id).where(Subtask.task_id == task.id).limit(1)) is not None:
        raise HTTPException(409, 'Сначала удали шаги задачи: чек-лист будет сохранён')
    for occurrence in db.scalars(select(Occurrence).where(Occurrence.task_id == task.id)):
        occurrence.task_id = None
    db.flush()
    invalidate_creation(db,'/api/tasks',task.id,user.id)
    db.delete(task)
    db.commit()
