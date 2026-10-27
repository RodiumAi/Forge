# Écrire le Dockerfile

```dockerfile title="Dockerfile" {3-4,6}
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 1000
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

:::tip Ordre des couches
Copier `requirements.txt` avant le code permet à Docker de réutiliser la couche des dépendances tant qu'elles ne changent pas.
:::

:::danger
Ne copiez jamais un fichier `.env` dans l'image : ajoutez-le à `.dockerignore`.
:::

```terminal
$ docker build -t api:dev .
$ docker run --rm -p 8000:8000 api:dev
INFO:     Uvicorn running on http://0.0.0.0:8000
```
