import pytest
from .test_tasks import client, raw_client


def payload(client):
    subject = client.post('/api/subjects', json={'name': 'Математика'}).json()
    return dict(subject_id=subject['id'], weekday=0, starts_at='09:00', ends_at='10:30', starts_on='2026-09-01', ends_on='2026-12-31', room=' 210 ', teacher=' Волков ')


def test_lesson_lifecycle_and_subject_protection(client):
    data = payload(client)
    response = client.post('/api/lessons', json=data)
    assert response.status_code == 201
    lesson = response.json()
    assert lesson['room'] == '210'
    assert lesson['teacher'] == 'Волков'
    assert client.get('/api/lessons').json() == [lesson]
    assert client.delete(f'/api/subjects/{data["subject_id"]}').status_code == 409
    path = f'/api/lessons/{lesson["id"]}'
    assert client.put(path, json=dict(data, weekday=2)).json()['weekday'] == 2
    assert client.delete(path).status_code == 204
    assert client.get('/api/lessons').json() == []
    assert client.delete(f'/api/subjects/{data["subject_id"]}').status_code == 204


@pytest.mark.parametrize('change', [{'weekday': 7}, {'ends_at': '08:00'}, {'ends_on': '2026-01-01'}, {'starts_at': '09:00+03:00'}, {'teacher': 'a'*121}])
def test_invalid_lesson_is_not_saved(client, change):
    data = payload(client)
    assert client.post('/api/lessons', json=dict(data, **change)).status_code == 422
    assert client.get('/api/lessons').json() == []


def test_lesson_ownership(client):
    data = payload(client)
    lesson = client.post('/api/lessons', json=data).json()
    client.post('/api/auth/logout')
    creds = {'username': 'other', 'password': 'another-long-password'}
    client.post('/api/auth/register', json=creds)
    client.post('/api/auth/login', json=creds)
    assert client.get('/api/lessons').json() == []
    assert client.post('/api/lessons', json=data).status_code == 404
    assert client.put(f'/api/lessons/{lesson["id"]}', json=data).status_code == 404
    assert client.delete(f'/api/lessons/{lesson["id"]}').status_code == 404


def test_anonymous_lessons(raw_client):
    assert raw_client.get('/api/lessons').status_code == 401
