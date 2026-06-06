from tests.conftest import auth_header, register


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_me(client):
    token = register(client, "a@example.com", name="Alice")
    me = client.get("/api/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "a@example.com"
    assert me.json()["name"] == "Alice"

    # login returns a working token too
    login = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "secret123"}
    )
    assert login.status_code == 200
    token2 = login.json()["access_token"]
    assert client.get("/api/auth/me", headers=auth_header(token2)).status_code == 200


def test_duplicate_email_rejected(client):
    register(client, "dup@example.com")
    resp = client.post(
        "/api/auth/register", json={"email": "dup@example.com", "password": "secret123"}
    )
    assert resp.status_code == 409


def test_wrong_password_and_missing_token(client):
    register(client, "b@example.com")
    bad = client.post("/api/auth/login", json={"email": "b@example.com", "password": "nope"})
    assert bad.status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header("garbage")).status_code == 401
