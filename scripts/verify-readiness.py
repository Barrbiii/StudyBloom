"""Temporarily stop only the disposable test DB; always start it again."""
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
if os.getenv('STUDYBLOOM_TEST_READINESS')!='1':
    raise SystemExit('Только одноразовый стек: STUDYBLOOM_TEST_READINESS=1 python scripts/verify-readiness.py')

def probe(path):
    try:
        with urllib.request.urlopen('http://localhost:5173/api/'+path,timeout=15) as response:
            return response.status,json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code,json.loads(error.read())

def count():
    return subprocess.check_output(['docker','compose','exec','-T','db','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "SELECT count(*) FROM tasks"'],text=True).strip()

assert probe('ready')==(200,{'status':'ready'})
before=count()
try:
    subprocess.run(['docker','compose','stop','db'],check=True)
    assert probe('health')[0]==200
    assert probe('ready')==(503,{'status':'unavailable'})
finally:
    subprocess.run(['docker','compose','up','-d','--wait','db'],check=True)
for attempt in range(30):
    if probe('ready')==(200,{'status':'ready'}):break
    time.sleep(1)
else:raise RuntimeError('Готовность не восстановилась')
assert count()==before
print('Readiness check: DB stop -> 503, recovery -> 200, задачи сохранены — OK')
