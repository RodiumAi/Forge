.DEFAULT_GOAL := help
COMPOSE := docker compose

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Démarre la stack complète
	$(COMPOSE) up -d --build
	$(MAKE) migrate
	@echo "Gateway     http://localhost:8100/docs"
	@echo "UI          http://localhost:3100"
	@echo "Sites       http://<slug>.lvh.me:8080"
	@echo "Mailpit     http://localhost:18025"
	@echo "MinIO       http://localhost:9001"

down: ## Arrête la stack
	$(COMPOSE) down

reset: ## Détruit les volumes et repart de zéro
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build
	$(MAKE) migrate seed

logs: ## Suit les logs API
	$(COMPOSE) logs -f api

migrate: ## Applique le schéma SQLAlchemy
	$(COMPOSE) exec -T api python -c "from app.db import init_db; init_db()"

seed: ## Affiche le bandeau d'environnement local
	$(COMPOSE) exec -T api python /srv/infra/seed.py

shell: ## Shell Python dans l'API
	$(COMPOSE) exec api python

psql: ## Console PostgreSQL
	$(COMPOSE) exec postgres psql -U forge -d forge_web

redis: ## Console Valkey
	$(COMPOSE) exec valkey valkey-cli

test: ## Tests API (si pytest est installé)
	$(COMPOSE) exec -T api python -c "from app.config import get_settings; print(get_settings().environment)"

.PHONY: help up down reset logs migrate seed shell psql redis test
