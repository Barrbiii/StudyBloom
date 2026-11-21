import hashlib
from datetime import datetime, timedelta, timezone

from .test_tasks import client
from app.auth import COOKIE, LoginSession, password_hash, password_matches
from app.main import app
from app.database import get_db

CREDS = {"username": "Varvara", "password": "long-enough-password"}


def test_password_hashes_are_salted():
    first = password_hash(CREDS["password"])
    assert first != password_hash(CREDS["password"])
    assert password_matches(CREDS["password"], first)
    assert not password_matches("wrong", first)
    assert not password_matches("wrong", "malformed")


def test_register_login_logout(client, monkeypatch):
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    response = client.post("/api/auth/register", json=CREDS)
    assert response.status_code == 201
    assert set(response.json()) == {"id", "username"}
    assert response.json()["username"] == "varvara"
    assert client.post("/api/auth/register", json=dict(CREDS, username="VARVARA")).status_code == 409
    assert client.get("/api/auth/me").status_code == 401
    response = client.post("/api/auth/login", json=CREDS)
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    token = client.cookies.get(COOKIE)
    assert len(token) >= 40
    assert client.get("/api/auth/me").json()["username"] == "varvara"
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set(COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401


def test_reject_cross_origin_and_bad_password(client):
    assert client.post("/api/auth/register", json=CREDS, headers={"Origin": "https://evil.invalid"}).status_code == 403
    assert client.post("/api/auth/register", json=dict(CREDS, password="short")).status_code == 422
    assert client.post("/api/auth/register", json=dict(CREDS, username="bad name")).status_code == 422
    client.post("/api/auth/register", json=CREDS)
    assert client.post("/api/auth/login", json=dict(CREDS, password="wrong-but-long-enough")).status_code == 401
    assert client.post("/api/auth/login", json=dict(CREDS, username="unknown")).status_code == 401
    assert client.post("/api/auth/logout", headers={"Origin": "https://evil.invalid"}).status_code == 403


def test_secure_cookie_by_default(client, monkeypatch):
    monkeypatch.delenv("AUTH_COOKIE_SECURE", raising=False)
    client.post("/api/auth/register", json=CREDS)
    response = client.post("/api/auth/login", json=CREDS)
    assert "Secure" in response.headers["set-cookie"]
    assert response.headers["cache-control"] == "no-store"


def test_session_expiry_and_hashed_storage(client, monkeypatch):
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    client.post("/api/auth/register", json=CREDS)
    client.post("/api/auth/login", json=CREDS)
    token = client.cookies.get(COOKIE)
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        assert db.get(LoginSession, token) is None
        session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
        assert session is not None
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    finally:
        generator.close()
    assert client.get("/api/auth/me").status_code == 401
