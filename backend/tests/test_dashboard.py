from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest
from app import dashboard_routes as dashboard, pomodoro_routes as focus
from .test_tasks import client

@pytest.fixture
def fixed(monkeypatch):
    anchor = datetime(2026, 11, 24, 12, tzinfo=timezone.utc)
    monkeypatch.setattr(dashboard, 'today', lambda tz: anchor.astimezone(ZoneInfo(tz)).date())
    return anchor


def test_empty_overview_uses_real_zeros(client, fixed):
    result = client.get('/api/dashboard').json()
    assert result['day'] == '2026-11-24'
    assert result['tasks'] == {'total': 0, 'completed': 0}
    assert result['habits_today'] == {'total': 0, 'completed': 0}
    assert len(result['focus_week']) == 7
    assert sum(row['seconds'] for row in result['focus_week']) == 0
    client.post('/api/auth/logout')
    assert client.get('/api/dashboard').status_code == 401


def test_daily_overview_aggregates_own_data(client, fixed):
    task = client.post('/api/tasks', json={'title': 'Первая'}).json()
    client.patch(f"/api/tasks/{task['id']}", json={'completed': True})
    client.post('/api/tasks', json={'title': 'Вторая'})
    subject = client.post('/api/subjects', json={'name': 'Алгебра'}).json()
    for day in ['2026-11-23', '2026-11-24', '2026-11-25']:
        client.post('/api/deadlines', json={'title': day, 'subject_id': subject['id'], 'due_date': day})
    lesson = {'subject_id': subject['id'], 'weekday': 1, 'starts_at': '09:00', 'ends_at': '10:00', 'starts_on': '2026-11-01', 'ends_on': '2026-12-01', 'room': '210', 'teacher': 'Волков'}
    assert client.post('/api/lessons', json=lesson).status_code == 201
    assert client.post('/api/lessons', json={**lesson, 'weekday': 2}).status_code == 201
    habit = client.post('/api/habits', json={'name': 'Читать'}).json()
    client.put(f"/api/habits/{habit['id']}/days/2026-11-24", json={'value': 1})
    result = client.get('/api/dashboard').json()
    assert result['tasks'] == {'total': 2, 'completed': 1}
    assert result['overdue_deadlines'] == 1
    assert len(result['upcoming_deadlines']) == 2
    assert result['upcoming_deadlines'][0]['due_date'] == '2026-11-24'
    assert len(result['lessons_today']) == 1 and result['lessons_today'][0]['subject'] == 'Алгебра'
    assert result['habits_today'] == {'total': 1, 'completed': 1}
    client.post('/api/auth/logout')
    credentials = {'username': 'dashboardsecond', 'password': 'very-long-password'}
    client.post('/api/auth/register', json=credentials)
    client.post('/api/auth/login', json=credentials)
    other = client.get('/api/dashboard').json()
    assert other['tasks']['total'] == 0 and not other['lessons_today'] and not other['upcoming_deadlines']


def test_focus_buckets_follow_timezone_including_first_day(client, monkeypatch):
    anchor = datetime(2026, 11, 24, 22, 30, tzinfo=timezone.utc)
    monkeypatch.setattr(dashboard, 'today', lambda tz: anchor.astimezone(ZoneInfo(tz)).date())
    at = datetime(2026, 11, 18, 22, 0, tzinfo=timezone.utc)
    monkeypatch.setattr(focus, 'now', lambda: at)
    for instant, mode in [(at, 'focus'), (anchor, 'focus'), (anchor, 'break')]:
        at = instant
        item = client.post('/api/pomodoro/sessions', json={'minutes': 1, 'mode': mode}).json()
        at += timedelta(seconds=60)
        assert client.post(f"/api/pomodoro/sessions/{item['id']}/finish").status_code == 200
    moscow = client.get('/api/dashboard?tz=Europe/Moscow').json()
    new_york = client.get('/api/dashboard?tz=America/New_York').json()
    assert moscow['day'] == '2026-11-25' and new_york['day'] == '2026-11-24'
    assert moscow['focus_week'][0] == {'day': '2026-11-19', 'seconds': 60, 'sessions': 1}
    assert new_york['focus_week'][0] == {'day': '2026-11-18', 'seconds': 60, 'sessions': 1}
    assert sum(row['seconds'] for row in moscow['focus_week']) == 120


def test_custom_period_and_daily_overview_are_independent(client, fixed):
    result=client.get('/api/dashboard?from_day=2026-10-01&through=2026-10-31').json()
    assert result['day'] == '2026-11-24'
    assert result['focus_period'] == {'from_day':'2026-10-01','through':'2026-10-31','days':31}
    assert len(result['focus_week']) == 31
    assert result['focus_week'][0]['day'] == '2026-10-01'
    assert result['focus_week'][-1]['day'] == '2026-10-31'
    one=client.get('/api/dashboard?from_day=2026-11-24&through=2026-11-24').json()
    assert len(one['focus_week']) == 1


def test_period_rejects_future_reverse_and_large_ranges(client, fixed):
    for query in ['from_day=2026-11-25','from_day=2026-11-26&through=2026-11-25','from_day=2026-01-01&through=2026-11-24','from_day=invalid','through=2026-11-25']:
        assert client.get('/api/dashboard?'+query).status_code == 422
    assert client.get('/api/dashboard?from_day=2026-08-27&through=2026-11-24').status_code == 200


def test_custom_focus_range_uses_inclusive_local_days(client, monkeypatch, fixed):
    at=datetime(2026,10,31,22,30,tzinfo=timezone.utc)
    monkeypatch.setattr(focus,'now',lambda:at)
    item=client.post('/api/pomodoro/sessions',json={'minutes':1}).json()
    at+=timedelta(seconds=60)
    client.post(f"/api/pomodoro/sessions/{item['id']}/finish")
    moscow=client.get('/api/dashboard?tz=Europe/Moscow&from_day=2026-11-01&through=2026-11-01').json()
    york=client.get('/api/dashboard?tz=America/New_York&from_day=2026-10-31&through=2026-10-31').json()
    assert moscow['focus_week'][0]['seconds'] == york['focus_week'][0]['seconds'] == 60
    excluded=client.get('/api/dashboard?tz=Europe/Moscow&from_day=2026-10-31&through=2026-10-31').json()
    assert excluded['focus_week'][0]['seconds'] == 0
