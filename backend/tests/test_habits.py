from datetime import date, timedelta
import pytest
from app import habit_routes as habits
from .test_tasks import client

@pytest.fixture
def day(monkeypatch):
    value = date(2026, 11, 24)
    original = habits.today
    def today(tz):
        original(tz)  # validate the actual IANA zone as in production
        return value
    monkeypatch.setattr(habits, 'today', today)
    return value


def test_daily_goal_snapshot_and_idempotence(client, day):
    item = client.post('/api/habits', json={'name': ' Читать ', 'target': 10, 'unit': 'страниц'}).json()
    assert item['name'] == 'Читать'
    path = f"/api/habits/{item['id']}/days/{day}"
    assert client.put(path, json={'value': 7}).json()['completed'] is False
    assert client.put(path, json={'value': 10}).json()['completed'] is True
    assert client.put(path, json={'value': 10}).status_code == 200
    assert client.put(f"/api/habits/{item['id']}", json={'name': 'Читать', 'target': 20, 'unit': 'страниц'}).status_code == 200
    listed = client.get('/api/habits').json()[0]
    assert listed['value'] == 10 and listed['day_target'] == 10 and listed['target'] == 20
    assert listed['completed'] is True
    assert client.put(path, json={'value': 0}).json()['completed'] is False


def test_archive_keeps_records(client, day):
    item = client.post('/api/habits', json={'name': 'Вода'}).json()
    path = f"/api/habits/{item['id']}"
    client.put(path + f'/days/{day}', json={'value': 1})
    client.put(path, json={'name': 'Вода', 'archived': True})
    assert client.put(path + f'/days/{day}', json={'value': 2}).status_code == 409
    row = client.get('/api/habits').json()[0]
    assert row['archived'] and row['completed']
    client.put(path, json={'name': 'Вода', 'archived': False})
    assert client.get('/api/habits').json()[0]['value'] == 1


def test_habit_validation_dates_and_zone(client, day):
    for data in [{'name': ' '}, {'name': 'Читать', 'target': 0}, {'name': 'Читать', 'target': True}, {'name': 'Читать', 'unit': ' '}]:
        assert client.post('/api/habits', json=data).status_code == 422
    item = client.post('/api/habits', json={'name': 'Читать'}).json()
    for bad in [day + timedelta(days=1), day - timedelta(days=367)]:
        assert client.put(f"/api/habits/{item['id']}/days/{bad}", json={'value': 1}).status_code == 422
    assert client.get('/api/habits?tz=No/SuchZone').status_code == 422
    assert client.put(f"/api/habits/{item['id']}/days/{day}", json={'value': -1}).status_code == 422
    assert client.get('/api/habits?tz=Asia/Tokyo').status_code == 200


def test_habit_account_isolation(client, day, monkeypatch):
    item = client.post('/api/habits', json={'name': 'Личная привычка'}).json()
    client.post('/api/auth/logout')
    assert client.get('/api/habits').status_code == 401
    monkeypatch.setenv('AUTH_COOKIE_SECURE', 'false')
    auth = {'username': 'otherhabit', 'password': 'very-long-password'}
    client.post('/api/auth/register', json=auth)
    client.post('/api/auth/login', json=auth)
    assert client.get('/api/habits').json() == []
    assert client.put(f"/api/habits/{item['id']}", json={'name': 'Чужая'}).status_code == 404
    assert client.put(f"/api/habits/{item['id']}/days/{day}", json={'value': 1}).status_code == 404


def test_history_limits_and_streaks(client, day):
    item = client.post('/api/habits', json={'name': 'Конспект'}).json()
    for n in [1, 2, 3, 6, 7]:
        assert client.put(f"/api/habits/{item['id']}/days/{day-timedelta(days=n)}", json={'value': 1}).status_code == 200
    listed = client.get('/api/habits').json()[0]
    assert listed['current_streak'] == 3 and listed['best_streak'] == 3
    history = client.get(f"/api/habits/{item['id']}/history?days=3").json()
    assert len(history) == 2 and history[0]['day'] == str(day-timedelta(days=1))
    assert client.get(f"/api/habits/{item['id']}/history?days=0").status_code == 422
    assert client.get('/api/habits/999/history').status_code == 404


def test_unit_change_preserves_history_semantics(client, day):
    item = client.post('/api/habits', json={'name': 'Чтение', 'unit': 'страниц'}).json()
    path = f"/api/habits/{item['id']}"
    assert client.put(path + f'/days/{day}', json={'value': 3}).status_code == 200
    assert client.put(path, json={'name': 'Чтение', 'unit': 'минут'}).status_code == 409
    assert client.get('/api/habits').json()[0]['unit'] == 'страниц'
