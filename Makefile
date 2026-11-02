.PHONY: setup dev backend frontend test lint build image

setup:
	cd backend && uv venv --python 3.11 .venv && uv pip install -e ".[dev]"
	cd frontend && npm ci

dev:
	@echo "Open http://localhost:5173"
	$(MAKE) -j2 backend frontend

backend:
	cd backend && .venv/bin/alembic upgrade head && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/python -m pytest -q
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run typecheck

build:
	cd frontend && npm run build

image:
	docker build -t roomset .
