# Valider les données

Une tâche a un titre obligatoire et un état. Décrivez-la avec Pydantic : FastAPI refusera toute requête qui ne respecte pas ce modèle.

```py title="main.py" diff
 from fastapi import FastAPI
+from pydantic import BaseModel, Field

 app = FastAPI(title="Tâches")
+
+
+class TaskIn(BaseModel):
+    title: str = Field(min_length=1, max_length=120)
+    done: bool = False
+
+
+class Task(TaskIn):
+    id: int
+
+
+tasks: dict[int, Task] = {}
```

:::warning Stockage en mémoire
Le dictionnaire `tasks` est vidé à chaque redémarrage. C'est parfait pour apprendre ; une vraie application utiliserait une base de données.
:::
