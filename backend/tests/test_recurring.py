from .test_tasks import client

def test_generation_is_idempotent_and_deleted_tasks_stay_deleted(client):
    template = client.post('/api/recurring-tasks', json={'title': ' Читать ', 'cadence': 'daily', 'starts_on': '2026-11-26', 'ends_on': '2026-11-28', 'priority': 'high'}).json()
    path = f"/api/recurring-tasks/{template['id']}"
    window = {'from_day': '2026-11-25', 'through': '2026-11-30'}
    result = client.post(path+'/generate', json=window).json()
    assert result['created'] == 3
    tasks = client.get('/api/tasks').json()
    assert all(t['priority'] == 'high' and not t['completed'] for t in tasks)
    assert '26.11.2026' in tasks[-1]['title']
    assert client.post(path+'/generate', json=window).json()['created'] == 0
    assert client.delete(f"/api/tasks/{tasks[0]['id']}").status_code == 204
    assert client.post(path+'/generate', json=window).json()['created'] == 0
    assert len(client.get('/api/tasks').json()) == 2


def test_pause_and_window_validation(client):
    item = client.post('/api/recurring-tasks', json={'title':'Доклад','cadence':'weekly','starts_on':'2026-11-26'}).json()
    path=f"/api/recurring-tasks/{item['id']}"
    window={'from_day':'2026-11-26','through':'2026-12-10'}
    assert client.patch(path,json={'paused':True}).json()['paused']
    assert client.post(path+'/generate',json=window).status_code == 409
    client.patch(path,json={'paused':False})
    assert client.post(path+'/generate',json=window).json()['created'] == 3
    assert client.post(path+'/generate',json={'from_day':'2026-01-01','through':'2026-12-31'}).status_code == 422
    for data in [{'title':' ','cadence':'daily','starts_on':'2026-01-01'}, {'title':'A','cadence':'bad','starts_on':'2026-01-01'}, {'title':'A','cadence':'daily','starts_on':'2026-02-01','ends_on':'2026-01-01'}]:
        assert client.post('/api/recurring-tasks',json=data).status_code == 422


def test_recurring_account_isolation(client):
    item=client.post('/api/recurring-tasks',json={'title':'Личное','cadence':'monthly','starts_on':'2026-11-26'}).json()
    client.post('/api/auth/logout')
    assert client.get('/api/recurring-tasks').status_code == 401
    auth={'username':'repeatsecond','password':'very-long-password'}
    client.post('/api/auth/register',json=auth);client.post('/api/auth/login',json=auth)
    assert client.get('/api/recurring-tasks').json() == []
    path=f"/api/recurring-tasks/{item['id']}"
    assert client.patch(path,json={'paused':True}).status_code == 404
    assert client.post(path+'/generate',json={'from_day':'2026-11-26','through':'2026-11-30'}).status_code == 404
