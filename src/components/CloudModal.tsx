import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { clearHistory } from "@/store/history";
import { normalizeDoc } from "@/schema/defaults";
import {
  cloudApi,
  cloudToken,
  CloudUser,
  Member,
  ProjectSummary,
  Role,
} from "@/cloud/api";

const ROLE_LABEL: Record<Role, string> = { owner: "所有者", editor: "可编辑", viewer: "只读" };

export default function CloudModal({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const showToast = useUi((s) => s.showToast);

  const [user, setUser] = useState<CloudUser | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersProjectId, setMembersProjectId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");

  const refreshProjects = async () => {
    setProjects(await cloudApi.listProjects());
  };

  useEffect(() => {
    if (!cloudToken.get()) return;
    (async () => {
      try {
        setUser(await cloudApi.me());
        await refreshProjects();
      } catch {
        cloudToken.clear();
      }
    })();
  }, []);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showToast((e as Error).message, 5000);
    } finally {
      setBusy(false);
    }
  };

  const onAuth = () =>
    guard(async () => {
      const res =
        mode === "login"
          ? await cloudApi.login(email, password)
          : await cloudApi.register(email, password, name);
      cloudToken.set(res.access_token);
      setUser(await cloudApi.me());
      await refreshProjects();
      setPassword("");
      showToast(mode === "login" ? "已登录云端" : "注册成功，已登录");
    });

  const logout = () => {
    cloudToken.clear();
    setUser(null);
    setProjects([]);
    setCurrentId(null);
    setMembers([]);
    showToast("已退出云端登录");
  };

  const saveToCloud = () =>
    guard(async () => {
      if (currentId != null) {
        await cloudApi.saveDocument(currentId, doc, "更新文档");
        showToast("已保存到云端项目");
      } else {
        const created = await cloudApi.createProject(doc.meta.name || "未命名原型", doc);
        setCurrentId(created.id);
        showToast(`已在云端创建「${created.name}」`);
      }
      await refreshProjects();
    });

  const openProject = (id: number) =>
    guard(async () => {
      const p = await cloudApi.getProject(id);
      replaceDocument(normalizeDoc(p.document));
      clearHistory();
      setCurrentId(id);
      showToast(`已打开云端项目「${p.name}」`);
    });

  const remove = (id: number) =>
    guard(async () => {
      if (!confirm("确定从云端删除该项目？此操作不可撤销。")) return;
      await cloudApi.deleteProject(id);
      if (currentId === id) setCurrentId(null);
      await refreshProjects();
      showToast("已删除云端项目");
    });

  const loadMembers = (id: number) =>
    guard(async () => {
      setMembersProjectId((cur) => (cur === id ? null : id));
      setMembers(await cloudApi.listMembers(id));
    });

  const invite = (id: number) =>
    guard(async () => {
      if (!inviteEmail.trim()) return;
      setMembers(await cloudApi.inviteMember(id, inviteEmail.trim(), inviteRole));
      setInviteEmail("");
      showToast("已邀请协作者");
    });

  const kick = (id: number, userId: number) =>
    guard(async () => {
      await cloudApi.removeMember(id, userId);
      setMembers(await cloudApi.listMembers(id));
      showToast("已移除协作者");
    });

  const current = projects.find((p) => p.id === currentId) ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2>云端协作</h2>

        {!user ? (
          <>
            <div className="tabs" style={{ marginBottom: 12 }}>
              <button
                className={`tab ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
              >
                登录
              </button>
              <button
                className={`tab ${mode === "register" ? "active" : ""}`}
                onClick={() => setMode("register")}
              >
                注册
              </button>
            </div>
            <div className="field">
              <label>邮箱</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {mode === "register" && (
              <div className="field">
                <label>昵称（可选）</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>密码（至少 6 位）</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAuth()}
              />
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              云端服务地址：{cloudApi.base}
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                取消
              </button>
              <button className="btn primary" disabled={busy} onClick={onAuth}>
                {mode === "login" ? "登录" : "注册并登录"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                已登录：{user.name || user.email}
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              <button className="btn" onClick={logout}>
                退出登录
              </button>
            </div>

            <div className="modal-actions" style={{ justifyContent: "flex-start", marginTop: 0 }}>
              <button className="btn primary" disabled={busy} onClick={saveToCloud}>
                {currentId != null ? "保存当前到云端项目" : "另存为新的云端项目"}
              </button>
              {currentId != null && (
                <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>
                  当前关联：{current?.name ?? `#${currentId}`}
                </span>
              )}
            </div>

            <h3 style={{ margin: "16px 0 8px" }}>我的云端项目</h3>
            {projects.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>暂无项目，点上方按钮把当前文档保存到云端。</p>
            )}
            <div style={{ maxHeight: 240, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {projects.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: p.id === currentId ? "var(--surface)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{p.name}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "1px 8px",
                      }}
                    >
                      {ROLE_LABEL[p.role]}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button className="btn" disabled={busy} onClick={() => openProject(p.id)}>
                      打开
                    </button>
                    {p.role === "owner" && (
                      <>
                        <button className="btn" disabled={busy} onClick={() => loadMembers(p.id)}>
                          成员
                        </button>
                        <button className="btn" disabled={busy} onClick={() => remove(p.id)}>
                          删除
                        </button>
                      </>
                    )}
                  </div>

                  {p.role === "owner" && membersProjectId === p.id && (
                    <div style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
                      {members.map((m) => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 4 }}>
                          <span>{m.name || m.email}</span>
                          <span style={{ color: "var(--muted)" }}>· {ROLE_LABEL[m.role]}</span>
                          <div style={{ flex: 1 }} />
                          {m.role !== "owner" && (
                            <button className="btn" disabled={busy} onClick={() => kick(p.id, m.user_id)}>
                              移除
                            </button>
                          )}
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input
                          style={{ flex: 1 }}
                          placeholder="协作者邮箱"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                          <option value="editor">可编辑</option>
                          <option value="viewer">只读</option>
                        </select>
                        <button className="btn primary" disabled={busy} onClick={() => invite(p.id)}>
                          邀请
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
