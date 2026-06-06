import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";

type Filter = "all" | "open" | "resolved";

/** A global, searchable list of every review comment in the document.
 *  Clicking an entry jumps to its frame and opens the thread on the canvas. */
export default function CommentsPanel({ onClose }: { onClose: () => void }) {
  const comments = useStore((s) => s.doc.comments);
  const pages = useStore((s) => s.doc.pages);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const setActiveComment = useStore((s) => s.setActiveComment);
  const resolveComment = useStore((s) => s.resolveComment);
  const deleteComment = useStore((s) => s.deleteComment);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const frameName = useMemo(() => {
    const map = new Map<string, string>();
    pages.forEach((p) => p.frames.forEach((f) => map.set(f.id, f.name)));
    return map;
  }, [pages]);

  const open = comments.filter((c) => !c.resolved).length;

  const shown = comments.filter((c) => {
    if (filter === "open" && c.resolved) return false;
    if (filter === "resolved" && !c.resolved) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hit =
        c.thread.some((m) => m.text.toLowerCase().includes(q) || m.author.toLowerCase().includes(q)) ||
        (frameName.get(c.frameId) ?? "").toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const jump = (frameId: string, commentId: string) => {
    setActiveFrame(frameId);
    setActiveComment(commentId);
  };

  const filters: [Filter, string][] = [
    ["all", `全部 ${comments.length}`],
    ["open", `未解决 ${open}`],
    ["resolved", `已解决 ${comments.length - open}`],
  ];

  return (
    <div className="comments-panel">
      <div className="comments-panel-head">
        <strong>评论 / 批注</strong>
        <button className="btn" style={{ marginLeft: "auto", padding: "2px 8px" }} onClick={onClose}>
          ✕
        </button>
      </div>
      <input
        className="comments-search"
        placeholder="搜索评论内容、作者或框架…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="comments-filters">
        {filters.map(([k, label]) => (
          <button
            key={k}
            className={`chip ${filter === k ? "active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="comments-list">
        {shown.length === 0 ? (
          <div className="comments-empty">
            {comments.length === 0
              ? "还没有评论。开启「批注」模式后点击画板即可添加。"
              : "没有匹配的评论。"}
          </div>
        ) : (
          shown.map((c) => {
            const first = c.thread[0];
            return (
              <div
                key={c.id}
                className={`comment-item ${c.resolved ? "resolved" : ""}`}
                onClick={() => jump(c.frameId, c.id)}
              >
                <div className="comment-item-top">
                  <span className="comment-item-frame">{frameName.get(c.frameId) ?? "（已删除框架）"}</span>
                  {c.resolved && <span className="badge ok">已解决</span>}
                  {c.thread.length > 1 && (
                    <span className="comment-item-count">{c.thread.length} 条</span>
                  )}
                </div>
                <div className="comment-item-text">{first?.text ?? ""}</div>
                <div className="comment-item-actions">
                  <span className="comment-item-author">{first?.author}</span>
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveComment(c.id, !c.resolved);
                    }}
                  >
                    {c.resolved ? "重新打开" : "标记解决"}
                  </button>
                  <button
                    className="link danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteComment(c.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
