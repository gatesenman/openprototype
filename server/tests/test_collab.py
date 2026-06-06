from tests.conftest import auth_header, register


def test_invite_roles_and_permissions(client):
    owner = auth_header(register(client, "owner3@example.com"))
    register(client, "editor@example.com")
    register(client, "viewer@example.com")

    pid = client.post("/api/projects", json={"name": "团队项目"}, headers=owner).json()["id"]

    # invite an editor and a viewer
    r1 = client.post(
        f"/api/projects/{pid}/members",
        json={"email": "editor@example.com", "role": "editor"},
        headers=owner,
    )
    assert r1.status_code == 201, r1.text
    client.post(
        f"/api/projects/{pid}/members",
        json={"email": "viewer@example.com", "role": "viewer"},
        headers=owner,
    )

    members = client.get(f"/api/projects/{pid}/members", headers=owner).json()
    roles = {m["email"]: m["role"] for m in members}
    assert roles == {
        "owner3@example.com": "owner",
        "editor@example.com": "editor",
        "viewer@example.com": "viewer",
    }

    # the shared project shows up in members' lists with their role
    editor = auth_header(
        client.post(
            "/api/auth/login", json={"email": "editor@example.com", "password": "secret123"}
        ).json()["access_token"]
    )
    viewer = auth_header(
        client.post(
            "/api/auth/login", json={"email": "viewer@example.com", "password": "secret123"}
        ).json()["access_token"]
    )
    editor_list = client.get("/api/projects", headers=editor).json()
    assert editor_list[0]["role"] == "editor"

    # editor can save the document; viewer cannot
    assert (
        client.put(
            f"/api/projects/{pid}/document",
            json={"document": {"v": 9}, "message": "edit"},
            headers=editor,
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/api/projects/{pid}/document",
            json={"document": {"v": 10}},
            headers=viewer,
        ).status_code
        == 403
    )
    # viewer can still read
    assert client.get(f"/api/projects/{pid}", headers=viewer).status_code == 200

    # only the owner can invite / delete; editor cannot invite
    assert (
        client.post(
            f"/api/projects/{pid}/members",
            json={"email": "viewer@example.com", "role": "editor"},
            headers=editor,
        ).status_code
        == 403
    )
    # owner removes the viewer
    viewer_id = next(m["user_id"] for m in members if m["email"] == "viewer@example.com")
    assert (
        client.delete(f"/api/projects/{pid}/members/{viewer_id}", headers=owner).status_code == 204
    )
    assert client.get(f"/api/projects/{pid}", headers=viewer).status_code == 403


def test_invite_unregistered_user_404(client):
    owner = auth_header(register(client, "owner4@example.com"))
    pid = client.post("/api/projects", json={"name": "P"}, headers=owner).json()["id"]
    resp = client.post(
        f"/api/projects/{pid}/members",
        json={"email": "ghost@example.com", "role": "viewer"},
        headers=owner,
    )
    assert resp.status_code == 404
