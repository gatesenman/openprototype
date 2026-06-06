from tests.conftest import auth_header, register


def test_project_crud_and_document_versions(client):
    token = register(client, "owner@example.com")
    h = auth_header(token)

    # create
    created = client.post(
        "/api/projects", json={"name": "我的原型", "document": {"v": 1}}, headers=h
    )
    assert created.status_code == 201, created.text
    pid = created.json()["id"]
    assert created.json()["role"] == "owner"

    # list
    listed = client.get("/api/projects", headers=h)
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    # rename
    patched = client.patch(f"/api/projects/{pid}", json={"name": "改名了"}, headers=h)
    assert patched.status_code == 200
    assert patched.json()["name"] == "改名了"

    # save document -> creates a version
    saved = client.put(
        f"/api/projects/{pid}/document",
        json={"document": {"v": 2, "pages": []}, "message": "第二版"},
        headers=h,
    )
    assert saved.status_code == 200
    assert saved.json()["document"]["v"] == 2

    # get detail reflects saved doc
    detail = client.get(f"/api/projects/{pid}", headers=h)
    assert detail.json()["document"]["v"] == 2

    # versions list
    versions = client.get(f"/api/projects/{pid}/versions", headers=h)
    assert versions.status_code == 200
    assert len(versions.json()) == 1
    vid = versions.json()[0]["id"]

    # save again then restore the older version
    client.put(
        f"/api/projects/{pid}/document",
        json={"document": {"v": 3}, "message": "第三版"},
        headers=h,
    )
    restored = client.post(f"/api/projects/{pid}/versions/{vid}/restore", headers=h)
    assert restored.status_code == 200
    assert restored.json()["document"]["v"] == 2


def test_delete_project(client):
    token = register(client, "del@example.com")
    h = auth_header(token)
    pid = client.post("/api/projects", json={"name": "X"}, headers=h).json()["id"]
    assert client.delete(f"/api/projects/{pid}", headers=h).status_code == 204
    assert client.get(f"/api/projects/{pid}", headers=h).status_code == 404


def test_cannot_access_others_project(client):
    a = auth_header(register(client, "a2@example.com"))
    b = auth_header(register(client, "b2@example.com"))
    pid = client.post("/api/projects", json={"name": "secret"}, headers=a).json()["id"]
    # B is not a member
    assert client.get(f"/api/projects/{pid}", headers=b).status_code == 403
    assert client.get("/api/projects", headers=b).json() == []
