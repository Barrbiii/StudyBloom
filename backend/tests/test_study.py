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


def test_edit_deadline_preserves_id_and_moves_date(client):
    subject = client.post("/api/subjects", json={"name": "Физика"}).json()
    payload = {"title": "Экзамен", "due_date": "2026-12-05", "subject_id": subject["id"]}
    deadline = client.post("/api/deadlines", json=payload).json()
    payload.update(title="  Зачёт  ", due_date="2027-01-01")
    response = client.put(f"/api/deadlines/{deadline['id']}", json=payload)
    assert response.status_code == 200
    assert response.json() == dict(payload, title="Зачёт", id=deadline["id"])
    assert client.get("/api/deadlines").json() == [response.json()]


def test_edit_deadline_invalid_data_does_not_change_record(client):
    subject = client.post("/api/subjects", json={"name": "Физика"}).json()
    payload = {"title": "Экзамен", "due_date": "2026-12-05", "subject_id": subject["id"]}
    deadline = client.post("/api/deadlines", json=payload).json()
    path = f"/api/deadlines/{deadline['id']}"
    for change, status in [({"title": "   "}, 422), ({"due_date": "2026-02-30"}, 422), ({"subject_id": 999}, 404)]:
        assert client.put(path, json=dict(payload, **change)).status_code == status
        assert client.get("/api/deadlines").json() == [deadline]
    assert client.put("/api/deadlines/999", json=payload).status_code == 404


def test_subject_deletion_does_not_destroy_deadlines(client):
    subject = client.post("/api/subjects", json={"name": "История"}).json()
    deadline = client.post("/api/deadlines", json={
        "title": "Доклад", "due_date": "2026-12-01", "subject_id": subject["id"]
    }).json()
    path = f"/api/subjects/{subject['id']}"
    assert client.delete(path).status_code == 409
    assert client.get("/api/deadlines").json() == [deadline]
    assert client.get("/api/subjects").json() == [subject]
    assert client.delete(f"/api/deadlines/{deadline['id']}").status_code == 204
    assert client.delete(path).status_code == 204
