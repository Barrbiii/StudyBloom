import pytest

from .test_tasks import client

PAYLOAD = {
    "title": "  Консультация  ",
    "starts_at": "2026-12-01T10:00:00+03:00",
    "ends_at": "2026-12-01T11:00:00+03:00",
    "location": "  Аудитория 210  ",
}


def test_event_lifecycle_and_utc(client):
    created = client.post("/api/events", json=PAYLOAD)
    assert created.status_code == 201
    event = created.json()
    path = f"/api/events/{event['id']}"
    assert event["title"] == "Консультация"
    assert event["location"] == "Аудитория 210"
    assert event["starts_at"] == "2026-12-01T07:00:00Z"
    assert client.get(path).json() == event
    assert client.get("/api/events").json() == [event]
    changed = client.put(path, json=dict(PAYLOAD, title="Встреча", location=""))
    assert changed.status_code == 200
    assert changed.json()["id"] == event["id"]
    assert changed.json()["title"] == "Встреча"
    assert client.delete(path).status_code == 204
    assert client.get(path).status_code == 404
    assert client.get("/api/events").json() == []


@pytest.mark.parametrize("changes", [
    {"title": "   "},
    {"starts_at": "2026-12-01T10:00:00"},
    {"ends_at": "2026-12-01T09:00:00+03:00"},
    {"ends_at": "2026-12-01T10:00:00+03:00"},
    {"ends_at": "2026-02-30T10:00:00+03:00"},
    {"location": "a" * 256},
])
def test_invalid_event_does_not_mutate_data(client, changes):
    event = client.post("/api/events", json=PAYLOAD).json()
    invalid = dict(PAYLOAD, **changes)
    assert client.post("/api/events", json=invalid).status_code == 422
    assert client.put(f"/api/events/{event['id']}", json=invalid).status_code == 422
    assert client.get("/api/events").json() == [event]


def test_event_missing_and_sorting(client):
    assert client.get("/api/events/999").status_code == 404
    assert client.put("/api/events/999", json=PAYLOAD).status_code == 404
    assert client.delete("/api/events/999").status_code == 404
    later = client.post("/api/events", json=PAYLOAD).json()
    earlier = client.post("/api/events", json=dict(PAYLOAD,
        starts_at="2026-11-30T23:30:00Z", ends_at="2026-12-01T00:30:00Z")).json()
    assert [e["id"] for e in client.get("/api/events").json()] == [earlier["id"], later["id"]]
