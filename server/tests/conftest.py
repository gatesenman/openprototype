import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # Use an in-memory SQLite DB shared across connections for each test.
    import app.database as database

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", TestingSessionLocal)

    database.Base.metadata.create_all(bind=engine)

    from app.main import app

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client, email, password="secret123", name=""):
    resp = client.post(
        "/api/auth/register", json={"email": email, "password": password, "name": name}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}
