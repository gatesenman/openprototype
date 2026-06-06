import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useUi } from "@/store/useUi";
import { redo, undo } from "@/store/history";

const TOOL_KEYS: Record<string, string> = {
  v: "select",
  r: "rect",
  o: "ellipse",
  l: "line",
  t: "text",
  b: "button",
  i: "input",
};

/** Global editor keyboard shortcuts. Active only while the design view is open. */
export function useShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (typing) return;

      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        s.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        s.copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        s.paste();
        return;
      }
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) s.ungroupSelection();
        else s.groupSelection();
        return;
      }
      // Z-order (Figma-style): Cmd/Ctrl + ] / [ ; add Shift to jump to front/back.
      // Match on e.code so Shift (which turns "]" into "}") still works.
      if (mod && (e.code === "BracketRight" || e.key === "]" || e.key === "}")) {
        e.preventDefault();
        s.reorderSelection(e.shiftKey ? "front" : "forward");
        return;
      }
      if (mod && (e.code === "BracketLeft" || e.key === "[" || e.key === "{")) {
        e.preventDefault();
        s.reorderSelection(e.shiftKey ? "back" : "backward");
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedNodeIds.length) {
          e.preventDefault();
          s.deleteSelection();
        }
        return;
      }
      if (e.key === "Escape") {
        if (s.commentMode) {
          s.setCommentMode(false);
          s.setActiveComment(null);
        }
        s.selectNodes([]);
        return;
      }
      // Toggle comment/annotation mode (Figma-style "C").
      if (!mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const next = !s.commentMode;
        s.setCommentMode(next);
        if (!next) s.setActiveComment(null);
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") return e.preventDefault(), s.moveSelection(-step, 0);
      if (e.key === "ArrowRight") return e.preventDefault(), s.moveSelection(step, 0);
      if (e.key === "ArrowUp") return e.preventDefault(), s.moveSelection(0, -step);
      if (e.key === "ArrowDown") return e.preventDefault(), s.moveSelection(0, step);

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !mod) useUi.getState().setTool(tool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
