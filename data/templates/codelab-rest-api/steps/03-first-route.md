# Première route

Ouvrez `main.py` et ajoutez une route de santé, utile pour vérifier que l'API répond.

```py title="main.py" {6-8}
from fastapi import FastAPI

app = FastAPI(title="Tâches")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Lancez le serveur en mode développement :

```terminal
$ fastapi dev main.py
INFO     Uvicorn running on http://127.0.0.1:8000
```

Ouvrez `http://127.0.0.1:8000/docs` : la documentation interactive liste déjà la route `/health`.
