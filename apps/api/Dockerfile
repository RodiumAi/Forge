# Build from repository root (Forge monorepo):
#   docker build --platform linux/amd64 -f apps/api/Dockerfile -t forge-api .
#
# Local compose still uses context apps/api — see docker-compose.yml.

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg git \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
  && playwright install --with-deps chromium

COPY apps/api/app ./app
COPY apps/api/runtime ./runtime
COPY data/templates ./data/templates

WORKDIR /app/runtime
RUN npm ci --omit=dev
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    TEMPLATES_ROOT=/app/data/templates \
    PROJECTS_ROOT=/data/projects

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
