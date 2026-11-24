from datetime import datetime, timedelta, timezone
import pytest
from app import pomodoro_routes as focus
from .test_tasks import client

@pytest.fixture
def clock(monkeypatch):
    times = [datetime(2026, 11, 24, 12, tzinfo=timezone.utc)]
    monkeypatch.setattr(focus, 'now', lambda: times[0])
    return lambda seconds: times.__setitem__(0, times[0] + timedelta(seconds=seconds))

def test_pause_resume_and_finish(client, clock):
    assert client.get('/api/pomodoro/current').json() is None
    item = client.post('/api/pomodoro/sessions', json={'minutes': 1}).json()
    url = f"/api/pomodoro/sessions/{item['id']}"
    assert client.post(url + '/finish').status_code == 409
    clock(20)
    assert client.post(url + '/pause').json()['elapsed_seconds'] == 20
    clock(100)
    assert client.get('/api/pomodoro/current').json()['elapsed_seconds'] == 20
    assert client.post(url + '/resume').json()['state'] == 'running'
    clock(40)
    assert client.post(url + '/finish').json()['state'] == 'completed'
    assert client.post(url + '/finish').status_code == 200
    assert client.get('/api/pomodoro/current').json() is None
    history = client.get('/api/pomodoro/history').json()
    assert len(history) == 1 and history[0]['elapsed_seconds'] == 60

def test_unique_active_and_cancellation(client, clock):
    item = client.post('/api/pomodoro/sessions', json={'minutes': 25}).json()
    assert client.post('/api/pomodoro/sessions', json={'minutes': 5}).status_code == 409
    clock(12)
    url = f"/api/pomodoro/sessions/{item['id']}"
    result = client.post(url + '/cancel').json()
    assert result['state'] == 'cancelled' and result['elapsed_seconds'] == 12
    assert client.post(url + '/cancel').status_code == 200
    assert client.post(url + '/resume').status_code == 409
    assert client.post('/api/pomodoro/sessions', json={'mode': 'break', 'minutes': 5}).status_code == 201

def test_session_validation(client):
    for value in [0, -1, 121, 1.5, '5', True]:
        assert client.post('/api/pomodoro/sessions', json={'minutes': value}).status_code == 422
    assert client.post('/api/pomodoro/sessions', json={'mode': 'fake'}).status_code == 422
    assert client.post('/api/pomodoro/sessions/999/finish').status_code == 404

def test_focus_isolation(client, monkeypatch):
    item = client.post('/api/pomodoro/sessions', json={}).json()
    client.post('/api/auth/logout')
    assert client.get('/api/pomodoro/current').status_code == 401
    monkeypatch.setenv('AUTH_COOKIE_SECURE', 'false')
    data = {'username': 'second', 'password': 'long-password-test'}
    assert client.post('/api/auth/register', json=data).status_code == 201
    assert client.post('/api/auth/login', json=data).status_code == 200
    assert client.get('/api/pomodoro/current').json() is None
    assert client.get('/api/pomodoro/history').json() == []
    assert client.post(f"/api/pomodoro/sessions/{item['id']}/cancel").status_code == 404
    assert client.post('/api/pomodoro/sessions', json={}).status_code == 201


def test_statistics_exclude_breaks_cancellations_and_active(client, clock):
    for mode, action in [('focus', 'finish'), ('break', 'finish'), ('focus', 'cancel')]:
        item = client.post('/api/pomodoro/sessions', json={'mode': mode, 'minutes': 1}).json()
        clock(65)
        assert client.post(f"/api/pomodoro/sessions/{item['id']}/{action}").status_code == 200
    client.post('/api/pomodoro/sessions', json={'minutes': 1})
    assert client.get('/api/pomodoro/stats').json() == {'completed_sessions': 1, 'focus_seconds': 60}
