import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { clearHistory } from "@/store/history";
import Icon from "@/components/Icon";
import {
  MAIN_BRANCH,
  Snapshot,
  captureSnapshot,
  createBranch,
  deleteBranch,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  loadHistory,
  renameSnapshot,
  switchBranch,
} from "@/version/history";
import { diffDocuments, summarizeDiff } from "@/version/diff";

export default function VersionHistoryModal({ onClose }: { onClose: () => void }) {
  const doc = useStore((s) => s.doc);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const showToast = useUi((s) => s.showToast);
  const docId = doc.meta.id;

  // Bump to force a re-read of the localStorage-backed history after mutations.
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const store = loadHistory(docId);
  const branch = store.currentBranch;
  const snapshots = listSnapshots(docId, branch);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [diffFor, setDiffFor] = useState<string | null>(null);
  const [branchInput, setBranchInput] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");

  const capture = () => {
    captureSnapshot(docId, doc, { name, note });
    setName("");
    setNote("");
    refresh();
    showToast("已保存当前版本快照");
  };

  const restore = (snap: Snapshot) => {
    const full = getSnapshot(docId, snap.id);
    if (!full) return;
    replaceDocument(full.document);
    clearHistory();
    showToast(`已恢复到「${snap.name}」`);
    onClose();
  };

  const remove = (snap: Snapshot) => {
    deleteSnapshot(docId, snap.id);
    if (diffFor === snap.id) setDiffFor(null);
    refresh();
  };

  const startEdit = (snap: Snapshot) => {
    setEditing(snap.id);
    setEditName(snap.name);
    setEditNote(snap.note);
  };
  const saveEdit = (snapId: string) => {
    renameSnapshot(docId, snapId, editName, editNote);
    setEditing(null);
    refresh();
  };

  const onBranchChange = (b: string) => {
    switchBranch(docId, b);
    setDiffFor(null);
    refresh();
  };
  const confirmBranch = () => {
    const b = (branchInput ?? "").trim();
    if (!b) return;
    createBranch(docId, b, doc);
    setBranchInput(null);
    setDiffFor(null);
    showToast(`已创建并切换到分支「${b}」`);
    refresh();
  };
  const removeBranch = () => {
    if (branch === MAIN_BRANCH) return;
    deleteBranch(docId, branch);
    showToast(`已删除分支「${branch}」`);
    refresh();
  };

  const diffSnap = diffFor ? getSnapshot(docId, diffFor) : null;
  const diff = diffSnap ? diffDocuments(diffSnap.document, doc) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <h2>版本历史 / 分支</h2>

        <div className="ver-branchbar">
          <Icon name="flow" size={14} />
          <span className="muted-sm">分支</span>
          <select value={branch} onChange={(e) => onBranchChange(e.target.value)}>
            {store.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {branchInput === null ? (
            <button className="btn sm" onClick={() => setBranchInput("")}>
              <Icon name="plus" size={13} /> 新建分支
            </button>
          ) : (
            <>
              <input
                autoFocus
                className="ver-branch-input"
                placeholder="分支名"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmBranch()}
              />
              <button className="btn sm primary" onClick={confirmBranch}>
                创建
              </button>
              <button className="btn sm" onClick={() => setBranchInput(null)}>
                取消
              </button>
            </>
          )}
          {branch !== MAIN_BRANCH && branchInput === null && (
            <button className="btn sm" onClick={removeBranch} title="删除当前分支">
              <Icon name="trash" size={13} /> 删除分支
            </button>
          )}
        </div>

        <div className="ver-capture">
          <input
            placeholder="版本名称（如：完成登录页）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn primary sm" onClick={capture}>
            <Icon name="download" size={13} /> 保存当前为版本
          </button>
        </div>

        <div className="ver-timeline">
          {snapshots.length === 0 && (
            <p className="muted-sm" style={{ padding: "12px 4px" }}>
              本分支暂无版本。编辑后点「保存当前为版本」即可在此留存可恢复的时间点。
            </p>
          )}
          {snapshots.map((snap, i) => (
            <div className="ver-item" key={snap.id}>
              <div className="ver-rail">
                <span className="ver-dot" />
                {i < snapshots.length - 1 && <span className="ver-line" />}
              </div>
              <div className="ver-body">
                {editing === snap.id ? (
                  <div className="ver-capture">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                    <button className="btn sm primary" onClick={() => saveEdit(snap.id)}>
                      保存
                    </button>
                    <button className="btn sm" onClick={() => setEditing(null)}>
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="ver-head">
                      <strong>{snap.name}</strong>
                      <span className="muted-sm">
                        {new Date(snap.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {snap.note && <div className="muted-sm">{snap.note}</div>}
                    <div className="ver-actions">
                      <button className="btn sm" onClick={() => restore(snap)}>
                        恢复
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => setDiffFor(diffFor === snap.id ? null : snap.id)}
                      >
                        {diffFor === snap.id ? "收起对比" : "对比当前"}
                      </button>
                      <button className="btn sm" onClick={() => startEdit(snap)}>
                        重命名
                      </button>
                      <button className="btn sm" onClick={() => remove(snap)}>
                        删除
                      </button>
                    </div>
                    {diffFor === snap.id && diff && (
                      <div className="ver-diff">
                        <div className="ver-diff-sum">
                          与当前相比：{summarizeDiff(diff)}（共 {diff.total} 处变化）
                        </div>
                        {diff.framesAdded.map((f) => (
                          <div key={`fa-${f}`} className="ver-diff-line add">
                            + 新增画板 {f}
                          </div>
                        ))}
                        {diff.framesRemoved.map((f) => (
                          <div key={`fr-${f}`} className="ver-diff-line del">
                            - 删除画板 {f}
                          </div>
                        ))}
                        {diff.framesChanged.map((f) => (
                          <div key={`fc-${f}`} className="ver-diff-line chg">
                            ~ 修改画板 {f}
                          </div>
                        ))}
                        {(diff.nodesAdded > 0 ||
                          diff.nodesRemoved > 0 ||
                          diff.nodesChanged > 0) && (
                          <div className="ver-diff-line chg">
                            图层：+{diff.nodesAdded} / -{diff.nodesRemoved} / ~
                            {diff.nodesChanged}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
