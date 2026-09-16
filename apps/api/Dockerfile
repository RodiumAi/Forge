# Build from repository root (Forge monorepo):
#   docker build --platform linux/amd64 -f apps/api/Dockerfile -t forge-api .
#
# docker-compose.yml uses the same root context + this Dockerfile.

FROM python:3.12-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg git \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --require-hashes -r requirements.txt \
  && playwright install --with-deps chromium \
  && groupadd --gid 1000 forge \
  && useradd --uid 1000 --gid 1000 --create-home --shell /usr/sbin/nologin forge \
  && mkdir -p /data/projects \
  && chown forge:forge /data/projects \
  && chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}"

COPY apps/api/app ./app
COPY apps/api/runtime ./runtime
COPY data/templates ./data/templates

WORKDIR /app/runtime
# Preview iframe loads /runner/babel.min.js — vendor file is not committed
# (~3MB). Copy from the already-pinned @babel/standalone install instead.
RUN npm ci --omit=dev \
  && cp node_modules/@babel/standalone/babel.min.js public/babel.min.js \
  && test -s public/babel.min.js \
  && rm -rf /usr/lib/node_modules/npm /usr/lib/node_modules/corepack \
  && rm -f /usr/bin/npm /usr/bin/npx /usr/bin/corepack
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    HOME=/home/forge \
    TEMPLATES_ROOT=/app/data/templates \
    PROJECTS_ROOT=/data/projects

EXPOSE 8000

USER forge:forge

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
