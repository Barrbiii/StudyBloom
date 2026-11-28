import pytest
from .test_tasks import client

KEY={'Idempotency-Key':'abcdef0123456789abcdef0123456789'}

@pytest.mark.parametrize('kind',['tasks','events','subjects','deadlines','lessons','habits','recurring-tasks','subtasks'])
def test_repeated_creation_has_one_resource(client,kind):
    path='/api/'+kind
    data={'title':'Один запрос'}
    if kind=='events':data|={'starts_at':'2026-12-01T10:00:00Z','ends_at':'2026-12-01T11:00:00Z'}
    if kind=='subjects':data={'name':'Алгебра'}
    if kind in ['lessons','deadlines']:
        subject=client.post('/api/subjects',json={'name':'Предмет'}).json()['id']
        data|={'subject_id':subject}
        if kind=='deadlines':data|={'due_date':'2026-12-01'}
        else:data={'subject_id':subject,'weekday':0,'starts_at':'09:00','ends_at':'10:00','starts_on':'2026-01-01','ends_on':'2026-12-31'}
    if kind=='habits':data={'name':'Читать'}
    if kind=='recurring-tasks':data|={'cadence':'daily','starts_on':'2026-11-28'}
    if kind=='subtasks':
        task=client.post('/api/tasks',json={'title':'Родитель'}).json()['id'];path=f'/api/tasks/{task}/subtasks'
    first=client.post(path,json=data,headers=KEY);second=client.post(path,json=data,headers=KEY)
    assert first.status_code==second.status_code==201
    assert first.json()['id']==second.json()['id']
    assert len(client.get(path).json())==1


def test_conflicts_deleted_receipt_and_reused_integer_id(client):
    one=client.post('/api/tasks',json={'title':'Первая'},headers=KEY).json()
    assert client.post('/api/tasks',json={'title':'Другая'},headers=KEY).status_code==409
    assert client.post('/api/subjects',json={'name':'Иное назначение'},headers=KEY).status_code==409
    assert client.delete(f"/api/tasks/{one['id']}").status_code==204
    client.post('/api/tasks',json={'title':'Новая запись'})
    assert client.post('/api/tasks',json={'title':'Первая'},headers=KEY).status_code==410
    assert client.get('/api/tasks').json()[0]['title']=='Новая запись'


def test_key_validation_failed_payload_and_user_isolation(client):
    for key in ['short','a'*129,'invalid.key.with.dots']:
        assert client.post('/api/tasks',json={'title':'A'},headers={'Idempotency-Key':key}).status_code==422
    assert client.post('/api/tasks',json={'title':' '},headers=KEY).status_code==422
    first=client.post('/api/tasks',json={'title':'A'},headers=KEY).json()['id']
    client.post('/api/auth/logout')
    credentials={'username':'keysecond','password':'very-long-password'}
    client.post('/api/auth/register',json=credentials);client.post('/api/auth/login',json=credentials)
    second=client.post('/api/tasks',json={'title':'A'},headers=KEY)
    assert second.status_code==201 and second.json()['id']!=first
    assert len(client.get('/api/tasks').json())==1
