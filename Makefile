# Nexivo - Local Development Makefile
# ====================================

.PHONY: help install dev migrate seed stop clean dump restore

PYTHON = python
PIP = pip
NPM = npm
MANAGE = $(PYTHON) backend/manage.py

# Local database lives in the nexivo_db container (host port 5544)
DB_CONTAINER = nexivo_db
DB_NAME = nexivo
DB_USER = nexivo_user
BACKUP_DIR = backups

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	cd backend && $(PIP) install -r requirements.txt
	cd frontend && $(NPM) install

setup: install ## First-time setup: install deps, copy .env, migrate, seed
	@if [ ! -f backend/.env ]; then cp .env.example backend/.env && echo "Created backend/.env from .env.example"; else echo "backend/.env already exists, skipping"; fi
	$(MAKE) migrate
	$(MAKE) seed
	@echo "\nSetup complete! Run 'make backend' and 'make frontend' in separate terminals."

migrate: ## Run database migrations
	cd backend && $(MANAGE) migrate

seed: ## Create dev superuser + sample users (idempotent)
	cd backend && $(MANAGE) create_dev_data

start-db: ## Start PostgreSQL on host port 5544 (requires Docker)
	docker start nexivo_db 2>/dev/null || docker run -d --name nexivo_db \
		-e POSTGRES_DB=nexivo \
		-e POSTGRES_USER=nexivo_user \
		-e POSTGRES_PASSWORD=nexivo_pass \
		-p 5544:5432 \
		postgres:15

start-redis: ## Start Redis (requires Docker)
	docker start nexivo_redis 2>/dev/null || docker run -d --name nexivo_redis \
		-p 6379:6379 \
		redis:7-alpine

start-services: start-db start-redis ## Start all required services (Postgres + Redis)
	@echo "Waiting for PostgreSQL..."
	@sleep 3
	@echo "Services started!"

dump: ## Snapshot the local database to backups/nexivo_<timestamp>.sql
	@mkdir -p $(BACKUP_DIR)
	@file="$(BACKUP_DIR)/nexivo_$$(date +%Y%m%d_%H%M%S).sql"; \
	docker exec $(DB_CONTAINER) pg_dump -U $(DB_USER) -d $(DB_NAME) \
		--clean --if-exists --no-owner > "$$file" \
		&& echo "Wrote $$file" \
		|| { echo "Backup FAILED"; rm -f "$$file"; exit 1; }

restore: ## Restore a snapshot (FILE=backups/x.sql, default: newest)
	@file="$(FILE)"; \
	if [ -z "$$file" ]; then file=$$(ls -1t $(BACKUP_DIR)/*.sql 2>/dev/null | head -1); fi; \
	if [ ! -f "$$file" ]; then \
		echo "No backup found. Run 'make dump' first, or pass FILE=backups/<file>.sql"; exit 1; \
	fi; \
	echo "Restoring $$file into $(DB_NAME) on $(DB_CONTAINER)..."; \
	docker exec -i $(DB_CONTAINER) psql -v ON_ERROR_STOP=1 -U $(DB_USER) -d $(DB_NAME) < "$$file" \
		&& echo "Restore complete." \
		|| { echo "Restore FAILED"; exit 1; }

backend: ## Start the Django backend (http://localhost:8000)
	cd backend && $(MANAGE) runserver 0.0.0.0:8000

frontend: ## Start the Vite frontend (http://localhost:3000)
	cd frontend && $(NPM) run dev

dev: migrate seed ## Full local dev setup: migrate, seed, then start backend + frontend
	@echo ""
	@echo "==========================================="
	@echo "  Nexivo - Starting Local Development"
	@echo "==========================================="
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Admin:    admin / admin12345"
	@echo "==========================================="
	@echo ""
	@echo "Start the backend and frontend in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"

dev-all: migrate seed ## Start backend and frontend (run in background)
	cd backend && $(MANAGE) runserver 0.0.0.0:8000 &
	cd frontend && $(NPM) run dev &
	@echo "Backend: http://localhost:8000 | Frontend: http://localhost:3000"

stop: ## Stop Docker containers (data is kept)
	docker stop nexivo_db nexivo_redis 2>/dev/null || true

clean: stop ## Remove all containers, volumes, and __pycache__
	docker rm nexivo_db nexivo_redis 2>/dev/null || true
	docker volume rm nexivo_db_data 2>/dev/null || true
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

test-backend: ## Run Django checks
	cd backend && $(MANAGE) check

test-frontend: ## Run TypeScript typecheck
	cd frontend && npx tsc --noEmit
