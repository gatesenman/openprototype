# OpenPrototype Cloud (SaaS backend)

FastAPI + PostgreSQL + SQLAlchemy + JWT backend that powers OpenPrototype's
accounts, cloud project storage, document version history and team
collaboration (owner / editor / viewer roles).

## Stack
- **FastAPI** — HTTP API
- **PostgreSQL** (JSONB document storage) via **SQLAlchemy 2.0**
- **JWT** (PyJWT) + **bcrypt** password hashing
- **pytest** — runs on SQLite (no external DB needed for CI)

## Quick start

```bash
cd server
# 1. dev Postgres (maps to localhost:5433)
docker compose up -d db
# 2. python env
uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
# 3. config
cp .env.example .env
# 4. run
uvicorn app.main:app --reload --port 8008
```

API docs at http://localhost:8008/docs

## Run tests

```bash
source .venv/bin/activate
python -m pytest            # uses an in-memory SQLite DB
```

## Endpoints

| Method | Path | Min role | Purpose |
|---|---|---|---|
| GET  | `/api/health` | — | liveness |
| POST | `/api/auth/register` | — | create account → JWT |
| POST | `/api/auth/login` | — | login → JWT |
| GET  | `/api/auth/me` | auth | current user |
| GET  | `/api/projects` | auth | list owned + shared projects |
| POST | `/api/projects` | auth | create project |
| GET  | `/api/projects/{id}` | viewer | project + current document |
| PATCH| `/api/projects/{id}` | editor | rename |
| DELETE | `/api/projects/{id}` | owner | delete |
| PUT  | `/api/projects/{id}/document` | editor | save `.gpo` document (new version) |
| GET  | `/api/projects/{id}/versions` | viewer | version history |
| POST | `/api/projects/{id}/versions/{vid}/restore` | editor | restore a version |
| GET  | `/api/projects/{id}/members` | viewer | list members |
| POST | `/api/projects/{id}/members` | owner | invite member (editor/viewer) |
| DELETE | `/api/projects/{id}/members/{uid}` | owner | remove member |

Auth uses a `Authorization: Bearer <token>` header. Documents are stored as
the full `.gpo` JSON document (JSONB on Postgres); every save appends a
`DocumentVersion` snapshot so history/restore work without server-side undo.
