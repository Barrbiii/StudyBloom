import json
from .test_tasks import client

def test_personal_archive_contains_related_data_and_no_credentials(client):
    task=client.post('/api/tasks',json={'title':'Доклад'}).json()
    client.post(f"/api/tasks/{task['id']}/subtasks",json={'title':'Источники'})
    subject=client.post('/api/subjects',json={'name':'Алгебра'}).json()
    client.post('/api/deadlines',json={'title':'Сдать','subject_id':subject['id'],'due_date':'2026-12-01'})
    client.post('/api/events',json={'title':'Событие','starts_at':'2026-12-01T10:00:00Z','ends_at':'2026-12-01T11:00:00Z','location':'Аудитория'})
    client.post('/api/lessons',json={'subject_id':subject['id'],'weekday':0,'starts_at':'09:00','ends_at':'10:00','starts_on':'2026-01-01','ends_on':'2026-12-31'})
    client.post('/api/habits',json={'name':'Читать'})
    client.post('/api/pomodoro/sessions',json={'minutes':25})
    template=client.post('/api/recurring-tasks',json={'title':'Повторение','cadence':'daily','starts_on':'2026-11-27'}).json()
    client.post(f"/api/recurring-tasks/{template['id']}/generate",json={'from_day':'2026-11-27','through':'2026-11-27'})
    response=client.get('/api/export/study');assert response.status_code==200
    assert response.headers['cache-control']=='no-store'
    assert 'attachment' in response.headers['content-disposition']
    archive=response.json();assert archive['version']==1
    data=archive['data'];assert len(data['tasks'])==2 and data['subtasks'][0]['task_id']==task['id']
    for name in ['subjects','deadlines','events','lessons','habits','focus_sessions','templates','occurrences']:
        assert len(data[name])==1
    text=json.dumps(archive)
    for forbidden in ['password_hash','token_hash','owner_id','active_owner','login_sessions']:
        assert forbidden not in text
    assert data['focus_sessions'][0]['state']=='running'
    assert len(client.get('/api/tasks').json())==2


def test_archive_requires_login_and_excludes_other_users(client):
    client.post('/api/tasks',json={'title':'Скрытое'})
    client.post('/api/auth/logout')
    assert client.get('/api/export/study').status_code==401
    auth={'username':'exportsecond','password':'very-long-password'}
    client.post('/api/auth/register',json=auth);client.post('/api/auth/login',json=auth)
    data=client.get('/api/export/study').json()['data']
    assert all(rows==[] for rows in data.values())


def test_ownerless_rows_stay_private_in_archive(client):
    from app.database import get_db
    from app.main import app
    from app.models import Task
    generator=app.dependency_overrides[get_db]();db=next(generator)
    try:
        db.add(Task(title='Прежние данные',owner_id=None));db.commit()
        assert client.get('/api/export/study').json()['data']['tasks']==[]
        assert db.query(Task).count()==1
    finally:generator.close()
