"""Интеграционная миграция в одноразовой схеме PostgreSQL из CI."""
import os
import uuid
import pytest
from sqlalchemy import create_engine, text
from app.migrations import migrate_owners, migrate_task_priority


@pytest.mark.skipif(not os.getenv('POSTGRES_TEST_URL'), reason='Требуется тестовый PostgreSQL')
def test_postgres_legacy_migration():
    url = os.environ['POSTGRES_TEST_URL']
    schema = 'test_' + uuid.uuid4().hex
    admin = create_engine(url)
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA {schema}'))
    engine = create_engine(url, connect_args={'options': f'-csearch_path={schema}'})
    try:
        with engine.begin() as conn:
            conn.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
            for table in ('tasks', 'subjects', 'deadlines', 'calendar_events'):
                conn.execute(text(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY, title TEXT)'))
                conn.execute(text(f"INSERT INTO {table} VALUES (1, 'Старые данные')"))
        migrate_owners(engine)
        migrate_owners(engine)
        migrate_task_priority(engine)
        migrate_task_priority(engine)
        with engine.connect() as conn:
            assert conn.execute(text('SELECT priority FROM tasks')).scalar_one() == 'normal'
            for table in ('tasks', 'subjects', 'deadlines', 'calendar_events'):
                assert conn.execute(text(f'SELECT id, title, owner_id FROM {table}')).one() == (1, 'Старые данные', None)
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        admin.dispose()


@pytest.mark.skipif(not os.getenv('POSTGRES_TEST_URL'), reason='Требуется тестовый PostgreSQL')
def test_postgres_personal_tools(monkeypatch):
    from datetime import datetime, timedelta, timezone
    from types import SimpleNamespace
    from sqlalchemy.orm import Session
    from fastapi import HTTPException
    from app import pomodoro_routes as focus
    from app import habit_routes as habits
    from app import dashboard_routes as dashboard
    from app.database import Base
    from app import subtask_routes as steps
    from app import recurring_routes as repeats
    from app import export_routes as archive
    from app.idempotency import save_created
    from app.main import TaskCreate
    from concurrent.futures import ThreadPoolExecutor
    import json
    from app.models import Task
    schema = 'focus_' + uuid.uuid4().hex
    admin = create_engine(os.environ['POSTGRES_TEST_URL'])
    with admin.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA {schema}'))
    engine = create_engine(os.environ['POSTGRES_TEST_URL'], connect_args={'options': f'-csearch_path={schema}'})
    try:
        with engine.begin() as conn:
            conn.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
            conn.execute(text('INSERT INTO users VALUES (1)'))
        Base.metadata.create_all(engine)
        at = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
        monkeypatch.setattr(focus, 'now', lambda: at)
        user = SimpleNamespace(id=1)
        with Session(engine) as db:
            item = focus.start(focus.Start(minutes=1), db, user)
            with pytest.raises(HTTPException) as error:
                focus.start(focus.Start(minutes=1), db, user)
            assert error.value.status_code == 409
            at += timedelta(seconds=60)
            assert focus.transition(item['id'], 'finish', db, user)['state'] == 'completed'
            assert focus.stats(db, user)['focus_seconds'] == 60
            assert focus.start(focus.Start(minutes=5), db, user)['state'] == 'running'
            habit = habits.create(habits.HabitWrite(name='Читать', target=10), db, user)
            day = habits.today('Europe/Moscow')
            assert habits.record(habit['id'], day, habits.DayWrite(value=10), 'Europe/Moscow', db, user)['completed']
            habits.record(habit['id'], day, habits.DayWrite(value=12), 'Europe/Moscow', db, user)
            habits.update(habit['id'], habits.HabitWrite(name='Читать', target=20), db, user)
            result = habits.listing(day, 'Europe/Moscow', db, user)[0]
            assert result['day_target'] == 10 and result['value'] == 12 and result['current_streak'] == 1
            assert len(habits.history(habit['id'], 30, 'Europe/Moscow', db, user)) == 1
            summary = dashboard.overview('Europe/Moscow', db, user)
            selected=dashboard.overview('Europe/Moscow',db,user,day,day)
            assert selected['focus_period']['days'] == 1
            assert len(selected['focus_week']) == 1
            assert summary['tasks']['total'] == 0
            assert summary['habits_today'] == {'total': 1, 'completed': 1}
            assert len(summary['focus_week']) == 7
            task = Task(owner_id=1, title='Доклад'); db.add(task); db.commit(); db.refresh(task)
            step = steps.create(task.id, steps.Create(title='Источники'), db, user)
            assert steps.update(task.id, step.id, steps.Update(completed=True), db, user).completed
            assert len(steps.listing(task.id, db, user)) == 1
            template = repeats.create(repeats.Write(title='Повторение',cadence='daily',starts_on=day),db,user)
            window = repeats.Window(from_day=day,through=day)
            assert repeats.generate(template['id'],window,db,user)['created'] == 1
            assert repeats.generate(template['id'],window,db,user)['created'] == 0
            original=archive.build_archive
            def snapshot_check(snapshot,owner_id,at):
                assert snapshot.connection().get_isolation_level() == 'REPEATABLE READ'
                assert snapshot.execute(text('SHOW transaction_read_only')).scalar_one() == 'on'
                snapshot.execute(select(Task.id)).all()
                with Session(engine) as writer:
                    writer.add(habits.Habit(owner_id=1,name='Поздняя запись',target=1,unit='раз'))
                    writer.commit()
                result=original(snapshot,owner_id,at)
                assert len(result['data']['habits']) == 1
                return result
            from sqlalchemy import select
            monkeypatch.setattr(archive,'build_archive',snapshot_check)
            exported=json.loads(archive.personal(db,user).body)
            assert exported['format'] == 'studybloom-personal'
            assert len(exported['data']['subtasks']) == 1
            def concurrent_create():
                with Session(engine) as attempt:
                    payload=TaskCreate(title='Одновременно')
                    return save_created(attempt,Task(owner_id=1,title=payload.title),user,'concurrent00000000000000000001','/api/tasks',payload).id
            with ThreadPoolExecutor(max_workers=2) as executor:
                ids=list(executor.map(lambda _:concurrent_create(),range(2)))
            assert ids[0]==ids[1]
            assert db.execute(select(Task.id).where(Task.title=='Одновременно')).all()==[(ids[0],)]
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        admin.dispose()
