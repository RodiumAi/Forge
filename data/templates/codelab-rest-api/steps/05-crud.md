# Lister, créer et lire

Ajoutez les trois routes de la ressource `tasks`.

```py title="main.py" {1,4-6,9-13,16-20}
from fastapi import FastAPI, HTTPException


@app.get("/tasks")
def list_tasks() -> list[Task]:
    return list(tasks.values())


@app.post("/tasks", status_code=201)
def create_task(body: TaskIn) -> Task:
    task = Task(id=len(tasks) + 1, **body.model_dump())
    tasks[task.id] = task
    return task


@app.get("/tasks/{task_id}")
def get_task(task_id: int) -> Task:
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    return tasks[task_id]
```

Essayez depuis le terminal :

```terminal
$ curl -X POST http://127.0.0.1:8000/tasks -H "Content-Type: application/json" -d '{"title": "Lire la doc"}'
{"title":"Lire la doc","done":false,"id":1}
$ curl -i http://127.0.0.1:8000/tasks/42
HTTP/1.1 404 Not Found
```

:::danger
Un titre vide renvoie `422`. Ne contournez pas la validation : elle protège vos données.
:::
