"""Smoke test for a disposable Compose deployment; creates its own isolated account."""
import http.cookiejar
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request

if os.getenv('STUDYBLOOM_SMOKE') != '1':
    raise SystemExit('Только тестовое окружение: STUDYBLOOM_SMOKE=1 python scripts/verify-compose.py')

base = 'http://localhost:5173'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, data=None, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(base + '/api' + path, data=body, method=method,
        headers={'Content-Type': 'application/json', 'Origin': base})
    with client.open(req, timeout=15) as response:
        value = response.read()
        return json.loads(value) if value else None


def healthy():
    for attempt in range(30):
        try:
            if request('/health')['status'] == 'ok':
                return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(1)
    raise RuntimeError('Сервис не запустился за 30 секунд')


healthy()
credentials = {'username': 'smoke_' + secrets.token_hex(8), 'password': secrets.token_urlsafe(24)}
request('/auth/register', credentials)
request('/auth/login', credentials)
task = request('/tasks', {'title': 'Docker: сохранить данные', 'priority': 'high'})
step = request(f"/tasks/{task['id']}/subtasks", {'title': 'Docker: маленький шаг'})
request(f"/tasks/{task['id']}/subtasks/{step['id']}", {'completed': True}, 'PATCH')
subject = request('/subjects', {'name': 'Docker: учебный предмет'})
request('/lessons', {'subject_id': subject['id'], 'weekday': 0, 'starts_at': '09:00',
    'ends_at': '10:00', 'starts_on': '2026-01-01', 'ends_on': '2030-12-31', 'room': '210', 'teacher': 'Тест'})
habit = request('/habits', {'name': 'Docker: читать', 'target': 10, 'unit': 'страниц'})
summary = request('/dashboard?tz=Europe/Moscow')
request(f"/habits/{habit['id']}/days/{summary['day']}?tz=Europe/Moscow", {'value': 10}, 'PUT')
repeat = request('/recurring-tasks', {'title':'Docker: повторение','cadence':'daily','starts_on':summary['day']})
window = {'from_day':summary['day'],'through':summary['day']}
assert request(f"/recurring-tasks/{repeat['id']}/generate",window)['created'] == 1
assert request(f"/recurring-tasks/{repeat['id']}/generate",window)['created'] == 0
focus = request('/pomodoro/sessions', {'minutes': 1})
request(f"/pomodoro/sessions/{focus['id']}/pause", {})
assert request('/dashboard?tz=Europe/Moscow')['habits_today']['completed'] == 1
assert request('/dashboard?tz=America/New_York')['tasks']['total'] == 2
subprocess.run(['docker', 'compose', 'restart', 'backend'], check=True)
healthy()
assert task['id'] in [row['id'] for row in request('/tasks')]
assert request(f"/recurring-tasks/{repeat['id']}/generate",window)['created'] == 0
assert request(f"/tasks/{task['id']}/subtasks")[0]['completed'] is True
assert len(request('/lessons')) == 1
assert request('/habits?tz=Europe/Moscow')[0]['completed'] is True
assert request('/pomodoro/current')['state'] == 'paused'
request(f"/pomodoro/sessions/{focus['id']}/cancel", {})
assert len(request('/pomodoro/history')) == 1
request('/auth/logout', {})
print('Docker smoke: аккаунт, задачи, занятия, привычки, Pomodoro и данные после restart — OK')
