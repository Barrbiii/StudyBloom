"""Read-only personal study archive; credentials and legacy ownerless rows are excluded."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from .auth import User, current_user
from .database import get_db
from .models import Task
from .subtask_routes import Subtask
from .study_models import Subject, Deadline
from .event_routes import CalendarEvent
from .timetable_routes import Lesson
from .habit_routes import Habit, HabitDay
from .pomodoro_routes import FocusSession, utc, elapsed
from .recurring_routes import Template, Occurrence

router=APIRouter(prefix='/api/export',tags=['Экспорт'])


def fields(item,names):
    result={}
    for key in names.split():
        value=getattr(item,key)
        result[key]=utc(value) if isinstance(value,datetime) else value
    return result


def build_archive(db,owner_id,at):
    def owned(model,names):
        return [fields(item,names) for item in db.scalars(select(model).where(model.owner_id==owner_id).order_by(model.id))]
    data={
      'tasks':owned(Task,'id title priority completed created_at'),
      'subjects':owned(Subject,'id name color'),
      'deadlines':owned(Deadline,'id title due_date subject_id created_at'),
      'events':owned(CalendarEvent,'id title starts_at ends_at location'),
      'lessons':owned(Lesson,'id subject_id weekday starts_at ends_at starts_on ends_on room teacher'),
      'habits':owned(Habit,'id name target unit archived'),
      'templates':owned(Template,'id title priority cadence starts_on ends_on paused'),
    }
    for name,model,parent,names in [
        ('subtasks',Subtask,Task,'id task_id title completed'),
        ('habit_days',HabitDay,Habit,'id habit_id day value target'),
        ('occurrences',Occurrence,Template,'id template_id day task_id')]:
        data[name]=[fields(item,names) for item in db.scalars(select(model).join(parent).where(parent.owner_id==owner_id).order_by(model.id))]
    data['focus_sessions']=[]
    for item in db.scalars(select(FocusSession).where(FocusSession.owner_id==owner_id).order_by(FocusSession.id)):
        data['focus_sessions'].append(fields(item,'id mode state duration_seconds created_at finished_at')|{'elapsed_seconds':elapsed(item,at)})
    return {'format':'studybloom-personal','version':1,'generated_at':at,'data':data}


@router.get('/study')
def personal(db: Session=Depends(get_db),user: User=Depends(current_user)):
    at=datetime.now(timezone.utc)
    bind=db.get_bind()
    if bind.dialect.name=='postgresql':
        bind=bind.execution_options(isolation_level='REPEATABLE READ')
    with Session(bind) as snapshot:
        if bind.dialect.name=='postgresql':
            snapshot.execute(text('SET TRANSACTION READ ONLY'))
        archive=build_archive(snapshot,user.id,at)
    return JSONResponse(jsonable_encoder(archive),headers={
        'Cache-Control':'no-store',
        'Content-Disposition':f'attachment; filename="studybloom-personal-{at:%Y-%m-%d}.json"',
        'X-Content-Type-Options':'nosniff',
    })
