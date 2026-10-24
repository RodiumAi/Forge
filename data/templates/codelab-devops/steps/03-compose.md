# Lancer avec Compose

```yaml title="compose.yaml"
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      LOG_LEVEL: info
    restart: unless-stopped
```

```terminal
$ docker compose up --build -d
$ docker compose ps
NAME      SERVICE   STATUS
api-1     api       running
$ docker compose logs -f api
```
