from .test_tasks import client

def test_subtask_lifecycle_and_parent_protection(client):
    task = client.post('/api/tasks', json={'title': 'Доклад'}).json()
    path = f"/api/tasks/{task['id']}/subtasks"
    item = client.post(path, json={'title': ' Найти источники '}).json()
    assert item['title'] == 'Найти источники' and not item['completed']
    assert client.patch(path+f"/{item['id']}", json={'completed': True, 'title': 'Проверить источники'}).json()['completed']
    assert client.get('/api/tasks').json()[0]['completed'] is False
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 409
    assert len(client.get(path).json()) == 1
    assert client.delete(path+f"/{item['id']}").status_code == 204
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204

def test_subtask_validation_and_parent_scope(client):
    a = client.post('/api/tasks', json={'title': 'A'}).json()['id']
    b = client.post('/api/tasks', json={'title': 'B'}).json()['id']
    path = f'/api/tasks/{a}/subtasks'
    for title in ['', '   ', 'a'*256]:
        assert client.post(path, json={'title': title}).status_code == 422
    item = client.post(path, json={'title': 'Шаг'}).json()
    assert client.patch(path+f"/{item['id']}", json={'title': ' '}).status_code == 422
    assert client.patch(f"/api/tasks/{b}/subtasks/{item['id']}", json={'completed': True}).status_code == 404
    assert client.delete(f"/api/tasks/{b}/subtasks/{item['id']}").status_code == 404
    assert client.get('/api/tasks/999/subtasks').status_code == 404

def test_subtask_account_isolation(client):
    task = client.post('/api/tasks', json={'title': 'Личное'}).json()['id']
    path = f'/api/tasks/{task}/subtasks'
    item = client.post(path, json={'title': 'Шаг'}).json()
    client.post('/api/auth/logout')
    assert client.get(path).status_code == 401
    data = {'username': 'subtasksecond', 'password': 'very-long-password'}
    client.post('/api/auth/register', json=data); client.post('/api/auth/login', json=data)
    assert client.get(path).status_code == 404
    assert client.post(path, json={'title': 'Чужой'}).status_code == 404
    assert client.patch(path+f"/{item['id']}", json={'completed': True}).status_code == 404
    assert client.delete(path+f"/{item['id']}").status_code == 404
