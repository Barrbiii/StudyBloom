from sqlalchemy import create_engine, text
from app.migrations import migrate_owners
from .test_tasks import client, raw_client


def test_two_users_cannot_access_each_others_data(client):
    task = client.post('/api/tasks', json={'title': 'Личная задача'}).json()
    subject = client.post('/api/subjects', json={'name': 'Физика'}).json()
    payload = {'title': 'Зачёт', 'due_date': '2026-12-01', 'subject_id': subject['id']}
    deadline = client.post('/api/deadlines', json=payload).json()
    event_data = {'title': 'Встреча', 'starts_at': '2026-12-01T10:00:00Z', 'ends_at': '2026-12-01T11:00:00Z'}
    event = client.post('/api/events', json=event_data).json()
    client.post('/api/auth/logout')
    creds = {'username': 'second', 'password': 'another-password-long'}
    client.post('/api/auth/register', json=creds)
    assert client.post('/api/auth/login', json=creds).status_code == 200
    for resource in ['tasks', 'subjects', 'deadlines', 'events']:
        assert client.get('/api/' + resource).json() == []
    for resource, record in [('tasks', task), ('subjects', subject), ('deadlines', deadline), ('events', event)]:
        assert client.delete(f'/api/{resource}/{record["id"]}').status_code == 404
    assert client.patch(f'/api/tasks/{task["id"]}', json={'completed': True}).status_code == 404
    assert client.put(f'/api/deadlines/{deadline["id"]}', json=payload).status_code == 404
    assert client.post('/api/deadlines', json=payload).status_code == 404
    assert client.get(f'/api/events/{event["id"]}').status_code == 404
    assert client.put(f'/api/events/{event["id"]}', json=event_data).status_code == 404


def test_anonymous_cannot_read_or_create(raw_client):
    for resource in ['tasks', 'subjects', 'deadlines', 'events']:
        assert raw_client.get('/api/' + resource).status_code == 401
    assert raw_client.post('/api/tasks', json={'title': 'test'}).status_code == 401


def test_owner_migration_preserves_legacy_rows_and_is_repeatable():
    engine = create_engine('sqlite://')
    with engine.begin() as db:
        db.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        db.execute(text('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)'))
        db.execute(text("INSERT INTO tasks VALUES (1, 'Старые данные')"))
    migrate_owners(engine)
    migrate_owners(engine)
    with engine.connect() as db:
        assert db.execute(text('SELECT id, title, owner_id FROM tasks')).one() == (1, 'Старые данные', None)
    engine.dispose()


def test_priority_migration_preserves_old_tasks():
    from app.migrations import migrate_task_priority
    engine = create_engine('sqlite://')
    with engine.begin() as db:
        db.execute(text('CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)'))
        db.execute(text("INSERT INTO tasks VALUES (1, 'Старая задача')"))
    migrate_task_priority(engine)
    migrate_task_priority(engine)
    with engine.connect() as db:
        assert db.execute(text('SELECT title, priority FROM tasks')).one() == ('Старая задача', 'normal')
    engine.dispose()
