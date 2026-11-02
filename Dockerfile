# One container: FastAPI serves the API and the built frontend.

FROM node:22-slim AS frontend
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY brand/theme /repo/brand/theme
COPY brand/fonts /repo/brand/fonts
COPY contracts /repo/contracts
RUN npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 ROOMSET_ENV=prod FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY backend/requirements.lock backend/pyproject.toml backend/alembic.ini ./
RUN pip install -r requirements.lock
COPY backend/app ./app
COPY --from=frontend /repo/frontend/dist /app/frontend/dist
RUN useradd --create-home roomset && mkdir -p data && chown -R roomset /app/backend/data
USER roomset
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=4s --start-period=30s CMD \
  python -c "import os,urllib.request as u; u.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/healthz', timeout=3)"
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --workers 1"]
