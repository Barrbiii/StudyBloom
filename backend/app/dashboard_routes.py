"""Personal overview: daily local schedule and seven calendar days of focus."""
from datetime import date, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from .auth import User, current_user
from .database import get_db
from .models import Task
from .study_models import Deadline, Subject
from .timetable_routes import Lesson
from .habit_routes import Habit, HabitDay, today
from .pomodoro_routes import FocusSession, utc

router = APIRouter(prefix='/api/dashboard', tags=['Обзор'])


@router.get('')
def overview(tz: str = Query(default='Europe/Moscow', max_length=100),
             db: Session = Depends(get_db), user: User = Depends(current_user),
             from_day: date | None = None, through: date | None = None):
    day = today(tz)
    zone = ZoneInfo(tz)
    total = db.scalar(select(func.count(Task.id)).where(Task.owner_id == user.id))
    completed = db.scalar(select(func.count(Task.id)).where(Task.owner_id == user.id, Task.completed.is_(True)))
    overdue = db.scalar(select(func.count(Deadline.id)).where(Deadline.owner_id == user.id, Deadline.due_date < day))
    deadlines = db.scalars(select(Deadline).where(Deadline.owner_id == user.id,
        Deadline.due_date >= day).order_by(Deadline.due_date, Deadline.id).limit(5)).all()
    lessons = db.execute(select(Lesson, Subject.name).join(Subject).where(
        Lesson.owner_id == user.id, Subject.owner_id == user.id,
        Lesson.weekday == day.weekday(), Lesson.starts_on <= day, Lesson.ends_on >= day
    ).order_by(Lesson.starts_at, Lesson.id)).all()
    habits_total = db.scalar(select(func.count(Habit.id)).where(Habit.owner_id == user.id, Habit.archived.is_(False)))
    habits_done = db.scalar(select(func.count(HabitDay.id)).join(Habit).where(
        Habit.owner_id == user.id, Habit.archived.is_(False), HabitDay.day == day,
        HabitDay.value >= HabitDay.target))
    last = through or day
    first = from_day or last - timedelta(days=6)
    if last > day or not 0 <= (last-first).days <= 89:
        raise HTTPException(422, 'Выбери от1 до90 дней без будущих дат')
    # Restrict candidates by UTC: final grouping uses the requested local calendar date.
    from datetime import datetime, time
    lower = datetime.combine(first, time.min, tzinfo=zone).astimezone(timezone.utc)
    upper = datetime.combine(last + timedelta(days=1), time.min, tzinfo=zone).astimezone(timezone.utc)
    sessions = db.scalars(select(FocusSession).where(FocusSession.owner_id == user.id,
        FocusSession.mode == 'focus', FocusSession.state == 'completed',
        FocusSession.finished_at >= lower, FocusSession.finished_at < upper)).all()
    buckets = {first + timedelta(days=n): {'seconds': 0, 'sessions': 0} for n in range((last-first).days+1)}
    for item in sessions:
        local_day = utc(item.finished_at).astimezone(zone).date()
        if local_day in buckets:
            buckets[local_day]['seconds'] += item.duration_seconds
            buckets[local_day]['sessions'] += 1
    return {'day': day, 'timezone': tz, 'focus_period': {'from_day': first, 'through': last, 'days': (last-first).days+1}, 'tasks': {'total': total, 'completed': completed},
        'overdue_deadlines': overdue,
        'upcoming_deadlines': [{'id': d.id, 'title': d.title, 'due_date': d.due_date} for d in deadlines],
        'lessons_today': [{'id': l.id, 'subject': name, 'starts_at': l.starts_at,
                          'ends_at': l.ends_at, 'room': l.room, 'teacher': l.teacher} for l, name in lessons],
        'habits_today': {'total': habits_total, 'completed': habits_done},
        'focus_week': [{'day': d, **values} for d, values in buckets.items()]}
