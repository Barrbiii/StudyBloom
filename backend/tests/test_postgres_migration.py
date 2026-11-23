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
