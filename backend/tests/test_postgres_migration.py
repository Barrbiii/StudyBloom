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
            assert summary['tasks']['total'] == 0
            assert summary['habits_today'] == {'total': 1, 'completed': 1}
            assert len(summary['focus_week']) == 7
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f'DROP SCHEMA {schema} CASCADE'))
        admin.dispose()
