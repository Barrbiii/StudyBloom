"""Disposable CI only: restore into a newly-created random database, never the app DB."""
import os
from pathlib import Path
import secrets
import subprocess

if os.getenv('STUDYBLOOM_TEST_RESTORE') != '1':
    raise SystemExit('Только одноразовый тестовый стек: STUDYBLOOM_TEST_RESTORE=1 python scripts/verify-restore.py')


def container(command, *args, **kwargs):
    return subprocess.run(['docker','compose','exec','-T','db','sh','-c',command,'sh',*args],check=True,**kwargs)


def sql(database, query):
    result=container('exec psql -U "$POSTGRES_USER" -d "$1" -At -v ON_ERROR_STOP=1 -c "$2"',database,query,capture_output=True,text=True)
    return result.stdout.strip()

source=container('printf "%s" "$POSTGRES_DB"',capture_output=True,text=True).stdout.strip()
backup=Path(subprocess.run(['bash','scripts/backup.sh'],check=True,capture_output=True,text=True).stdout.strip())
assert backup.is_file() and backup.stat().st_mode & 0o077 == 0
name='studybloom_restore_'+secrets.token_hex(8)
created=False
try:
    container('exec createdb -U "$POSTGRES_USER" "$1"',name)
    created=True
    with backup.open('rb') as stream:
        container('exec pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-acl',name,stdin=stream)
    for table in ['users','login_sessions','tasks','subtasks','subjects','deadlines','calendar_events','lessons','habits','habit_days','focus_sessions','task_templates','task_occurrences','creation_receipts']:
        assert sql(source,f'SELECT count(*) FROM {table}') == sql(name,f'SELECT count(*) FROM {table}'), table
    previous=int(sql(name,'SELECT coalesce(max(id),0) FROM tasks'))
    added=sql(name,"INSERT INTO tasks(owner_id,title,priority,completed,created_at) SELECT min(id),'Restore check','normal',false,now() FROM users RETURNING id")
    assert int(added.splitlines()[0]) > previous
    print('Restore check: все таблицы, связи и последовательность новых задач — OK; рабочая БД не изменялась')
finally:
    if created:
        assert name.startswith('studybloom_restore_') and name != source
        container('exec dropdb -U "$POSTGRES_USER" "$1"',name)
    backup.unlink(missing_ok=True)
