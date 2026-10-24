from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Tâches")


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    done: bool = False


class Task(TaskIn):
    id: int


tasks: dict[int, Task] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


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
