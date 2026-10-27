from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_create_and_read_a_task():
    created = client.post("/tasks", json={"title": "Écrire le codelab"})
    assert created.status_code == 201
    task_id = created.json()["id"]
    assert client.get(f"/tasks/{task_id}").json()["title"] == "Écrire le codelab"


def test_unknown_task_is_404():
    assert client.get("/tasks/999").status_code == 404
