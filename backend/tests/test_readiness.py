from sqlalchemy.exc import OperationalError
from .test_tasks import client
from app.database import get_db
from app.main import app

def test_ready_is_fresh_and_does_not_require_login(client):
    client.post('/api/auth/logout')
    result=client.get('/api/ready');assert result.status_code==200
    assert result.json()=={'status':'ready'} and result.headers['cache-control']=='no-store'
    assert client.get('/api/health').json()['status']=='ok'


def test_database_failure_is_unavailable_without_credentials(client):
    original=app.dependency_overrides[get_db]
    class Unavailable:
        def execute(self,statement):raise OperationalError('postgresql://private-password',{},Exception('private-password'))
    def failed():yield Unavailable()
    app.dependency_overrides[get_db]=failed
    try:
        response=client.get('/api/ready')
        assert response.status_code==503 and response.json()=={'status':'unavailable'}
        assert 'private-password' not in response.text
        assert client.get('/api/health').status_code==200
    finally:app.dependency_overrides[get_db]=original
