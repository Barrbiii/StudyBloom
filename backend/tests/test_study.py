from .test_tasks import client


def test_subject_and_deadline_lifecycle(client):
    subject = client.post("/api/subjects", json={"name": "Математика"})
    assert subject.status_code == 201
    subject_id = subject.json()["id"]

    assert any(item["id"] == subject_id for item in client.get("/api/subjects").json())

    deadline = client.post(
        "/api/deadlines",
        json={"title": "Контрольная", "due_date": "2026-12-05", "subject_id": subject_id},
    )
    assert deadline.status_code == 201
    deadline_id = deadline.json()["id"]

    assert any(item["id"] == deadline_id for item in client.get("/api/deadlines").json())
    assert client.delete(f"/api/deadlines/{deadline_id}").status_code == 204
    assert client.delete(f"/api/subjects/{subject_id}").status_code == 204


def test_deadline_requires_subject(client):
    response = client.post(
        "/api/deadlines",
        json={"title": "Реферат", "due_date": "2026-12-05", "subject_id": 999},
    )
    assert response.status_code == 404
