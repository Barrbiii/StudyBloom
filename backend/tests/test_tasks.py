import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./studybloom-test.db")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def raw_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    def override_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(raw_client, monkeypatch):
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    credentials = {"username": "tester", "password": "test-password-long"}
    assert raw_client.post("/api/auth/register", json=credentials).status_code == 201
    assert raw_client.post("/api/auth/login", json=credentials).status_code == 200
    yield raw_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_task_lifecycle(client):
    created = client.post("/api/tasks", json={"title": "  Подготовить конспект  "})
    assert created.status_code == 201
    task = created.json()
    assert task["title"] == "Подготовить конспект"
    assert task["completed"] is False

    listed = client.get("/api/tasks")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [task["id"]]

    updated = client.patch(
        f"/api/tasks/{task['id']}",
        json={"completed": True, "title": "Повторить материал"},
    )
    assert updated.status_code == 200
    assert updated.json()["completed"] is True
    assert updated.json()["title"] == "Повторить материал"

    deleted = client.delete(f"/api/tasks/{task['id']}")
    assert deleted.status_code == 204
    assert client.get("/api/tasks").json() == []


def test_missing_task(client):
    assert client.patch("/api/tasks/999", json={"completed": True}).status_code == 404
    assert client.delete("/api/tasks/999").status_code == 404


def test_empty_title(client):
    assert client.post("/api/tasks", json={"title": ""}).status_code == 422
    assert client.post("/api/tasks", json={"title": "   "}).status_code == 422


def test_task_priority_lifecycle(client):
    normal = client.post('/api/tasks', json={'title': 'Обычная'}).json()
    assert normal['priority'] == 'normal'
    high = client.post('/api/tasks', json={'title': 'Важная', 'priority': 'high'}).json()
    assert high['priority'] == 'high'
    assert client.patch(f'/api/tasks/{high["id"]}', json={'priority': 'low'}).json()['priority'] == 'low'
    assert client.post('/api/tasks', json={'title': 'Неверная', 'priority': 'urgent'}).status_code == 422
    assert client.patch(f'/api/tasks/{normal["id"]}', json={'priority': 'urgent'}).status_code == 422
