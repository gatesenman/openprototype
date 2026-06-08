import { create } from "zustand";
import { temporal } from "zundo";
import {
  ComponentDef,
  DesignRule,
  Frame,
  FrameComment,
  GpoDocument,
  JourneyMap,
  JourneyStage,
  Node,
  Page,
  PrototypeVariable,
  RequirementDoc,
  VectorPath,
} from "@/schema/types";
import { emptyFrame, emptyPage, id, newDocument } from "@/schema/defaults";
import { emptyJourney, emptyStage } from "@/journey/journey";
import { applyConstraints } from "@/schema/constraints";
import { bbox, cloneNode, makeGroup, reorder, ungroup } from "@/schema/nodeOps";
import { AutoLayout } from "@/schema/types";
import { DEFAULT_AUTOLAYOUT, applyAutoLayout } from "@/schema/layout";
import {
  type BooleanOp,
  booleanPaths,
  ellipsePath,
  pathBounds,
  rectPath,
  strokeToOutline,
} from "@/vector/geometry";

export type ViewMode =
  | "home"
  | "requirements"
  | "design"
  | "flows"
  | "journey"
  | "preview"
  | "market";
export type AlignKind =
  | "left"
  | "right"
  | "hcenter"
  | "top"
  | "bottom"
  | "vcenter"
  | "hdist"
  | "vdist";

interface AppState {
  doc: GpoDocument;
  view: ViewMode;
  activePageId: string;
  activeFrameId: string | null;
  selectedNodeIds: string[];
  activeRequirementId: string | null;
  activeJourneyId: string | null;
  previewFrameId: string | null;
  clipboard: Node[];
  dirty: boolean;
  /** When true, clicking the canvas drops a review comment instead of editing. */
  commentMode: boolean;
  activeCommentId: string | null;

  setView: (v: ViewMode) => void;
  setDoc: (doc: GpoDocument) => void;
  setDocName: (name: string) => void;
  replaceDocument: (doc: GpoDocument) => void;

  setActivePage: (pageId: string) => void;
  setActiveFrame: (frameId: string | null) => void;
  selectNodes: (ids: string[]) => void;
  selectAll: () => void;
  toggleSelect: (nodeId: string) => void;
  setActiveRequirement: (reqId: string | null) => void;
  setPreviewFrame: (frameId: string | null) => void;

  addPage: () => void;
  addFrame: (name?: string) => Frame;
  addFrameWithNodes: (frame: Frame, requirementId?: string) => void;
  addFramesWithNodes: (frames: Frame[], requirementId?: string) => void;
  updateFrame: (frameId: string, patch: Partial<Frame>) => void;
  deleteFrame: (frameId: string) => void;

  addNode: (frameId: string, node: Node) => void;
  updateNode: (frameId: string, nodeId: string, patch: Partial<Node>) => void;
  deleteNode: (frameId: string, nodeId: string) => void;

  // multi-node ops on the active frame
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  paste: () => void;
  moveSelection: (dx: number, dy: number) => void;
  align: (kind: AlignKind) => void;
  reorderSelection: (dir: string) => void;
  /** Move a top-level node of the active frame to an absolute z-index (0 = bottom). */
  reorderNodeTo: (nodeId: string, toIndex: number) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  toggleLock: (nodeId: string) => void;
  toggleHidden: (nodeId: string) => void;
  /** Update a container node's auto-layout and re-flow its children. */
  setNodeLayout: (frameId: string, nodeId: string, patch: Partial<AutoLayout> | null) => void;

  // vector / path editing
  /** Replace a vector node's path, re-normalizing its bounds/origin. */
  setNodePath: (frameId: string, nodeId: string, path: VectorPath) => void;
  /** Boolean-combine the current multi-selection into a new vector node. */
  booleanSelection: (op: BooleanOp) => void;
  /** Convert a node's stroke into a filled vector outline. */
  outlineStroke: (nodeId: string) => void;

  // components
  addComponent: (comp: ComponentDef) => void;
  createComponentFromSelection: (name: string) => void;
  instantiateComponent: (componentId: string) => void;
  detachInstance: (nodeId: string) => void;
  /** Discard instance overrides: re-clone the master template (keeps position + ref). */
  resetInstance: (nodeId: string) => void;
  /** Publish an instance's current content as the master, syncing all other instances. */
  pushInstanceToComponent: (nodeId: string) => void;
  renameComponent: (componentId: string, name: string) => void;
  deleteComponent: (componentId: string) => void;

  // design-system rules
  addRule: () => void;
  updateRule: (ruleId: string, patch: Partial<DesignRule>) => void;
  deleteRule: (ruleId: string) => void;

  addRequirement: () => RequirementDoc;
  updateRequirement: (reqId: string, patch: Partial<RequirementDoc>) => void;
  deleteRequirement: (reqId: string) => void;

  updateDesignSystem: (patch: Partial<GpoDocument["designSystem"]>) => void;

  // comments / annotations
  setCommentMode: (on: boolean) => void;
  setActiveComment: (commentId: string | null) => void;
  addComment: (frameId: string, x: number, y: number, text: string) => void;
  replyComment: (commentId: string, text: string) => void;
  resolveComment: (commentId: string, resolved: boolean) => void;
  deleteComment: (commentId: string) => void;

  // user-journey maps
  setActiveJourney: (journeyId: string | null) => void;
  addJourney: (journey?: JourneyMap) => JourneyMap;
  updateJourney: (journeyId: string, patch: Partial<Omit<JourneyMap, "id" | "stages">>) => void;
  deleteJourney: (journeyId: string) => void;
  addStage: (journeyId: string, atIndex?: number) => void;
  updateStage: (journeyId: string, stageId: string, patch: Partial<Omit<JourneyStage, "id">>) => void;
  deleteStage: (journeyId: string, stageId: string) => void;
  moveStage: (journeyId: string, stageId: string, dir: "left" | "right") => void;

  // ---- prototype variables (interactions / conditions / forms) ----
  addPrototypeVariable: (v?: Partial<PrototypeVariable>) => PrototypeVariable;
  updatePrototypeVariable: (varId: string, patch: Partial<Omit<PrototypeVariable, "id">>) => void;
  deletePrototypeVariable: (varId: string) => void;
}

const COMMENT_AUTHOR = "我";

const initialDoc = newDocument();

function touch(doc: GpoDocument): GpoDocument {
  return { ...doc, meta: { ...doc.meta, updatedAt: Date.now() } };
}

function mapPages(doc: GpoDocument, pageId: string, fn: (p: Page) => Page): GpoDocument {
  return touch({
    ...doc,
    pages: doc.pages.map((p) => (p.id === pageId ? fn(p) : p)),
  });
}

/** A node's geometry as a vector path in node-local coordinates. */
function nodeToLocalPath(n: Node): VectorPath {
  if (n.type === "vector" && n.path) return n.path;
  if (n.type === "ellipse" || n.type === "icon") return ellipsePath(n.width, n.height);
  if (n.type === "line")
    return { anchors: [{ x: 0, y: n.height / 2 }, { x: n.width, y: n.height / 2 }], closed: false };
  // rect / button / input / image / text / group → bounding rectangle
  return rectPath(n.width, n.height);
}

/** A node's geometry as a vector path in frame coordinates. */
function nodeToFramePath(n: Node): VectorPath {
  const local = nodeToLocalPath(n);
  return {
    closed: local.closed,
    anchors: local.anchors.map((a) => ({
      ...a,
      x: a.x + n.x,
      y: a.y + n.y,
    })),
  };
}

function opLabel(op: BooleanOp): string {
  return op === "union"
    ? "联合"
    : op === "subtract"
      ? "减去顶层"
      : op === "intersect"
        ? "相交"
        : "排除";
}

export const useStore = create<AppState>()(
  temporal(
    (set, get) => {
      const mapActiveFrame = (fn: (f: Frame) => Frame) => {
        const { activePageId, activeFrameId } = get();
        if (!activeFrameId) return;
        set((s) => ({
          doc: mapPages(s.doc, activePageId, (p) => ({
            ...p,
            frames: p.frames.map((f) => (f.id === activeFrameId ? fn(f) : f)),
          })),
          dirty: true,
        }));
      };
      const activeFrame = (): Frame | undefined => {
        const { doc, activePageId, activeFrameId } = get();
        return doc.pages
          .find((p) => p.id === activePageId)
          ?.frames.find((f) => f.id === activeFrameId);
      };

      return {
        doc: initialDoc,
        view: "home",
        activePageId: initialDoc.pages[0].id,
        activeFrameId: null,
        selectedNodeIds: [],
        activeRequirementId: initialDoc.requirements[0]?.id ?? null,
        activeJourneyId: initialDoc.journeys[0]?.id ?? null,
        previewFrameId: null,
        clipboard: [],
        dirty: false,
        commentMode: false,
        activeCommentId: null,

        setView: (view) => set({ view }),
        setDoc: (doc) => set({ doc, dirty: true }),
        setDocName: (name) =>
          set((s) => ({
            doc: { ...s.doc, meta: { ...s.doc.meta, name, updatedAt: Date.now() } },
            dirty: true,
          })),
        replaceDocument: (doc) =>
          set({
            doc,
            dirty: false,
            activePageId: doc.pages[0]?.id ?? "",
            activeFrameId: doc.pages[0]?.frames[0]?.id ?? null,
            selectedNodeIds: [],
            activeRequirementId: doc.requirements[0]?.id ?? null,
            activeJourneyId: doc.journeys?.[0]?.id ?? null,
            previewFrameId: doc.pages[0]?.frames[0]?.id ?? null,
          }),

        setActivePage: (pageId) =>
          set({ activePageId: pageId, activeFrameId: null, selectedNodeIds: [] }),
        setActiveFrame: (frameId) =>
          set({ activeFrameId: frameId, selectedNodeIds: [] }),
        selectNodes: (ids) => set({ selectedNodeIds: ids }),
        selectAll: () => {
          const f = activeFrame();
          if (!f) return;
          set({ selectedNodeIds: f.nodes.filter((n) => !n.locked && !n.hidden).map((n) => n.id) });
        },
        toggleSelect: (nodeId) =>
          set((s) => ({
            selectedNodeIds: s.selectedNodeIds.includes(nodeId)
              ? s.selectedNodeIds.filter((x) => x !== nodeId)
              : [...s.selectedNodeIds, nodeId],
          })),
        setActiveRequirement: (reqId) => set({ activeRequirementId: reqId }),
        setPreviewFrame: (frameId) => set({ previewFrameId: frameId }),

        addPage: () => {
          const page = emptyPage(`Page ${get().doc.pages.length + 1}`);
          set((s) => ({
            doc: touch({ ...s.doc, pages: [...s.doc.pages, page] }),
            activePageId: page.id,
            dirty: true,
          }));
        },

        addFrame: (name) => {
          const { activePageId, doc } = get();
          const page = doc.pages.find((p) => p.id === activePageId)!;
          const offset = page.frames.length * 440;
          const frame = emptyFrame(name ?? `Frame ${page.frames.length + 1}`, offset, 0);
          set((s) => ({
            doc: mapPages(s.doc, activePageId, (p) => ({ ...p, frames: [...p.frames, frame] })),
            activeFrameId: frame.id,
            dirty: true,
          }));
          return frame;
        },

        addFrameWithNodes: (frame, requirementId) =>
          get().addFramesWithNodes([frame], requirementId),

        addFramesWithNodes: (frames, requirementId) => {
          const { activePageId, doc } = get();
          const page = doc.pages.find((p) => p.id === activePageId)!;
          const startX = page.frames.length * 440;
          const placed = frames.map((f, i) => ({ ...f, x: startX + i * 440, y: 0 }));
          set((s) => {
            let d = mapPages(s.doc, activePageId, (p) => ({
              ...p,
              frames: [...p.frames, ...placed],
            }));
            if (requirementId) {
              d = {
                ...d,
                requirements: d.requirements.map((r) =>
                  r.id === requirementId
                    ? {
                        ...r,
                        generatedFrameIds: [
                          ...r.generatedFrameIds,
                          ...placed.map((f) => f.id),
                        ],
                      }
                    : r,
                ),
              };
            }
            return { doc: d, activeFrameId: placed[0]?.id ?? s.activeFrameId, dirty: true };
          });
        },

        updateFrame: (frameId, patch) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.map((f) => {
                if (f.id !== frameId) return f;
                const next = { ...f, ...patch };
                // When the frame is resized, reflow children per their constraints.
                const resized =
                  (patch.width !== undefined && patch.width !== f.width) ||
                  (patch.height !== undefined && patch.height !== f.height);
                if (!resized) return next;
                const prev = { width: f.width, height: f.height };
                const size = { width: next.width, height: next.height };
                return {
                  ...next,
                  nodes: f.nodes.map((n) => ({ ...n, ...applyConstraints(n, prev, size) })),
                };
              }),
            })),
            dirty: true,
          })),

        deleteFrame: (frameId) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.filter((f) => f.id !== frameId),
            })),
            activeFrameId: s.activeFrameId === frameId ? null : s.activeFrameId,
            dirty: true,
          })),

        addNode: (frameId, node) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.map((f) =>
                f.id === frameId ? { ...f, nodes: [...f.nodes, node] } : f,
              ),
            })),
            selectedNodeIds: [node.id],
            dirty: true,
          })),

        updateNode: (frameId, nodeId, patch) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.map((f) =>
                f.id === frameId
                  ? { ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)) }
                  : f,
              ),
            })),
            dirty: true,
          })),

        setNodeLayout: (frameId, nodeId, patch) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.map((f) =>
                f.id === frameId
                  ? {
                      ...f,
                      nodes: f.nodes.map((n) => {
                        if (n.id !== nodeId) return n;
                        if (patch === null) {
                          const { layout: _drop, ...rest } = n;
                          void _drop;
                          return rest;
                        }
                        const layout: AutoLayout = {
                          ...DEFAULT_AUTOLAYOUT,
                          ...n.layout,
                          ...patch,
                          padding: {
                            ...DEFAULT_AUTOLAYOUT.padding,
                            ...n.layout?.padding,
                            ...patch.padding,
                          },
                        };
                        return applyAutoLayout({ ...n, layout });
                      }),
                    }
                  : f,
              ),
            })),
            dirty: true,
          })),

        deleteNode: (frameId, nodeId) =>
          set((s) => ({
            doc: mapPages(s.doc, s.activePageId, (p) => ({
              ...p,
              frames: p.frames.map((f) =>
                f.id === frameId ? { ...f, nodes: f.nodes.filter((n) => n.id !== nodeId) } : f,
              ),
            })),
            selectedNodeIds: s.selectedNodeIds.filter((x) => x !== nodeId),
            dirty: true,
          })),

        setNodePath: (frameId, nodeId, path) =>
          mapActiveFrame((f) =>
            f.id !== frameId
              ? f
              : {
                  ...f,
                  nodes: f.nodes.map((n) => {
                    if (n.id !== nodeId) return n;
                    const b = pathBounds(path);
                    const normalized: VectorPath = {
                      closed: path.closed,
                      anchors: path.anchors.map((a) => ({
                        ...a,
                        x: a.x - b.x,
                        y: a.y - b.y,
                      })),
                    };
                    return {
                      ...n,
                      x: n.x + b.x,
                      y: n.y + b.y,
                      width: Math.max(1, b.width),
                      height: Math.max(1, b.height),
                      path: normalized,
                    };
                  }),
                },
          ),

        booleanSelection: (op) => {
          const f = activeFrame();
          const ids = get().selectedNodeIds;
          if (!f || ids.length < 2) return;
          const sel = f.nodes.filter((n) => ids.includes(n.id));
          const subjects: VectorPath[] = sel.map((n) => nodeToFramePath(n));
          const results = booleanPaths(op, subjects);
          if (results.length === 0) return;
          const base = sel[0];
          const newNodes: Node[] = results.map((r, i) => ({
            id: id("vec"),
            type: "vector",
            name: i === 0 ? `${opLabel(op)}` : `${opLabel(op)} ${i + 1}`,
            x: r.bounds.x,
            y: r.bounds.y,
            width: Math.max(1, r.bounds.width),
            height: Math.max(1, r.bounds.height),
            style: { ...base.style },
            path: r.path,
          }));
          mapActiveFrame((fr) => ({
            ...fr,
            nodes: [...fr.nodes.filter((n) => !ids.includes(n.id)), ...newNodes],
          }));
          set({ selectedNodeIds: newNodes.map((n) => n.id) });
        },

        outlineStroke: (nodeId) => {
          const f = activeFrame();
          if (!f) return;
          const n = f.nodes.find((x) => x.id === nodeId);
          if (!n) return;
          const width = n.style.stroke?.width ?? 0;
          if (width <= 0) return;
          const src = nodeToLocalPath(n);
          const results = strokeToOutline(src, width);
          if (results.length === 0) return;
          const strokeColor = n.style.stroke?.color ?? "#000000";
          const newNodes: Node[] = results.map((r, i) => ({
            id: id("vec"),
            type: "vector",
            name: i === 0 ? `${n.name} 轮廓` : `${n.name} 轮廓 ${i + 1}`,
            x: n.x + r.bounds.x,
            y: n.y + r.bounds.y,
            width: Math.max(1, r.bounds.width),
            height: Math.max(1, r.bounds.height),
            style: { fill: { type: "solid", color: strokeColor } },
            path: r.path,
          }));
          mapActiveFrame((fr) => ({
            ...fr,
            nodes: [...fr.nodes.filter((x) => x.id !== nodeId), ...newNodes],
          }));
          set({ selectedNodeIds: newNodes.map((x) => x.id) });
        },

        deleteSelection: () => {
          const ids = get().selectedNodeIds;
          mapActiveFrame((f) => ({ ...f, nodes: f.nodes.filter((n) => !ids.includes(n.id)) }));
          set({ selectedNodeIds: [] });
        },

        duplicateSelection: () => {
          const f = activeFrame();
          const ids = get().selectedNodeIds;
          if (!f) return;
          const clones = f.nodes
            .filter((n) => ids.includes(n.id))
            .map((n) => ({ ...cloneNode(n), x: n.x + 16, y: n.y + 16 }));
          mapActiveFrame((fr) => ({ ...fr, nodes: [...fr.nodes, ...clones] }));
          set({ selectedNodeIds: clones.map((c) => c.id) });
        },

        copySelection: () => {
          const f = activeFrame();
          const ids = get().selectedNodeIds;
          if (!f) return;
          set({ clipboard: f.nodes.filter((n) => ids.includes(n.id)).map(cloneNode) });
        },

        paste: () => {
          const clip = get().clipboard;
          if (!clip.length) return;
          const clones = clip.map((n) => ({ ...cloneNode(n), x: n.x + 24, y: n.y + 24 }));
          mapActiveFrame((fr) => ({ ...fr, nodes: [...fr.nodes, ...clones] }));
          set({ selectedNodeIds: clones.map((c) => c.id) });
        },

        moveSelection: (dx, dy) => {
          const ids = get().selectedNodeIds;
          mapActiveFrame((f) => ({
            ...f,
            nodes: f.nodes.map((n) =>
              ids.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
            ),
          }));
        },

        align: (kind) => {
          const ids = get().selectedNodeIds;
          const f = activeFrame();
          if (!f || ids.length < 2) return;
          const sel = f.nodes.filter((n) => ids.includes(n.id));
          const box = bbox(sel);
          const updated = new Map<string, Partial<Node>>();
          if (kind === "left") sel.forEach((n) => updated.set(n.id, { x: box.x }));
          if (kind === "right") sel.forEach((n) => updated.set(n.id, { x: box.x + box.w - n.width }));
          if (kind === "hcenter") sel.forEach((n) => updated.set(n.id, { x: box.x + box.w / 2 - n.width / 2 }));
          if (kind === "top") sel.forEach((n) => updated.set(n.id, { y: box.y }));
          if (kind === "bottom") sel.forEach((n) => updated.set(n.id, { y: box.y + box.h - n.height }));
          if (kind === "vcenter") sel.forEach((n) => updated.set(n.id, { y: box.y + box.h / 2 - n.height / 2 }));
          if (kind === "hdist" && sel.length > 2) {
            const sorted = [...sel].sort((a, b) => a.x - b.x);
            const total = sorted.reduce((s, n) => s + n.width, 0);
            const gap = (box.w - total) / (sorted.length - 1);
            let cx = box.x;
            sorted.forEach((n) => {
              updated.set(n.id, { x: Math.round(cx) });
              cx += n.width + gap;
            });
          }
          if (kind === "vdist" && sel.length > 2) {
            const sorted = [...sel].sort((a, b) => a.y - b.y);
            const total = sorted.reduce((s, n) => s + n.height, 0);
            const gap = (box.h - total) / (sorted.length - 1);
            let cy = box.y;
            sorted.forEach((n) => {
              updated.set(n.id, { y: Math.round(cy) });
              cy += n.height + gap;
            });
          }
          mapActiveFrame((fr) => ({
            ...fr,
            nodes: fr.nodes.map((n) => (updated.has(n.id) ? { ...n, ...updated.get(n.id) } : n)),
          }));
        },

        reorderSelection: (dir) => {
          const ids = get().selectedNodeIds;
          if (ids.length !== 1) return;
          mapActiveFrame((f) => reorder(f, ids[0], dir));
        },

        reorderNodeTo: (nodeId, toIndex) => {
          mapActiveFrame((f) => {
            const from = f.nodes.findIndex((n) => n.id === nodeId);
            if (from === -1) return f;
            const nodes = [...f.nodes];
            const [moved] = nodes.splice(from, 1);
            const clamped = Math.max(0, Math.min(nodes.length, toIndex));
            nodes.splice(clamped, 0, moved);
            return { ...f, nodes };
          });
        },

        groupSelection: () => {
          const ids = get().selectedNodeIds;
          if (ids.length < 2) return;
          mapActiveFrame((f) => makeGroup(f, ids));
          const f = activeFrame();
          const grp = f?.nodes[f.nodes.length - 1];
          if (grp) set({ selectedNodeIds: [grp.id] });
        },

        ungroupSelection: () => {
          const ids = get().selectedNodeIds;
          if (ids.length !== 1) return;
          let childIds: string[] = [];
          mapActiveFrame((f) => {
            const res = ungroup(f, ids[0]);
            childIds = res.childIds;
            return res.frame;
          });
          if (childIds.length) set({ selectedNodeIds: childIds });
        },

        toggleLock: (nodeId) =>
          mapActiveFrame((f) => ({
            ...f,
            nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, locked: !n.locked } : n)),
          })),

        toggleHidden: (nodeId) =>
          mapActiveFrame((f) => ({
            ...f,
            nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, hidden: !n.hidden } : n)),
          })),

        addComponent: (comp) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                components: [...s.doc.designSystem.components, comp],
              },
            }),
            dirty: true,
          })),

        createComponentFromSelection: (name) => {
          const f = activeFrame();
          const ids = get().selectedNodeIds;
          if (!f || ids.length === 0) return;
          const sel = f.nodes.filter((n) => ids.includes(n.id));
          const box = bbox(sel);
          const template: Node =
            sel.length === 1
              ? cloneNode(sel[0])
              : {
                  id: id("grp"),
                  type: "group",
                  name,
                  x: 0,
                  y: 0,
                  width: box.w,
                  height: box.h,
                  style: {},
                  children: sel.map((n) => ({ ...cloneNode(n), x: n.x - box.x, y: n.y - box.y })),
                };
          template.x = 0;
          template.y = 0;
          const comp: ComponentDef = { id: id("comp"), name, template };
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                components: [...s.doc.designSystem.components, comp],
              },
            }),
            dirty: true,
          }));
        },

        instantiateComponent: (componentId) => {
          const { doc, activeFrameId } = get();
          const comp = doc.designSystem.components.find((c) => c.id === componentId);
          if (!comp || !activeFrameId) return;
          const inst = cloneNode(comp.template);
          inst.name = comp.name;
          inst.componentRef = comp.id;
          inst.x = 24;
          inst.y = 24;
          get().addNode(activeFrameId, inst);
        },

        detachInstance: (nodeId) => {
          const { activeFrameId } = get();
          if (!activeFrameId) return;
          get().updateNode(activeFrameId, nodeId, { componentRef: undefined });
        },

        resetInstance: (nodeId) => {
          const f = activeFrame();
          if (!f) return;
          const inst = f.nodes.find((n) => n.id === nodeId);
          if (!inst?.componentRef) return;
          const comp = get().doc.designSystem.components.find(
            (c) => c.id === inst.componentRef,
          );
          if (!comp) return;
          const fresh = cloneNode(comp.template);
          fresh.id = inst.id;
          fresh.x = inst.x;
          fresh.y = inst.y;
          fresh.name = inst.name;
          fresh.componentRef = comp.id;
          mapActiveFrame((fr) => ({
            ...fr,
            nodes: fr.nodes.map((n) => (n.id === nodeId ? fresh : n)),
          }));
        },

        pushInstanceToComponent: (nodeId) => {
          const f = activeFrame();
          if (!f) return;
          const inst = f.nodes.find((n) => n.id === nodeId);
          if (!inst?.componentRef) return;
          const compId = inst.componentRef;
          // The edited instance becomes the new master template.
          const template = cloneNode(inst);
          template.x = 0;
          template.y = 0;
          template.componentRef = undefined;
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                components: s.doc.designSystem.components.map((c) =>
                  c.id === compId ? { ...c, template } : c,
                ),
              },
              // Re-flow every *other* instance of this component to the new master.
              pages: s.doc.pages.map((p) => ({
                ...p,
                frames: p.frames.map((fr) => ({
                  ...fr,
                  nodes: fr.nodes.map((n) => {
                    if (n.componentRef !== compId || n.id === nodeId) return n;
                    const fresh = cloneNode(template);
                    fresh.id = n.id;
                    fresh.x = n.x;
                    fresh.y = n.y;
                    fresh.name = n.name;
                    fresh.componentRef = compId;
                    return fresh;
                  }),
                })),
              })),
            }),
            dirty: true,
          }));
        },

        renameComponent: (componentId, name) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                components: s.doc.designSystem.components.map((c) =>
                  c.id === componentId ? { ...c, name } : c,
                ),
              },
            }),
            dirty: true,
          })),

        deleteComponent: (componentId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                components: s.doc.designSystem.components.filter(
                  (c) => c.id !== componentId,
                ),
              },
            }),
            dirty: true,
          })),

        addRule: () =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                rules: [
                  ...s.doc.designSystem.rules,
                  {
                    id: id("rule"),
                    kind: "custom",
                    description: "新规则：描述一条设计规范",
                  },
                ],
              },
            }),
            dirty: true,
          })),

        updateRule: (ruleId, patch) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                rules: s.doc.designSystem.rules.map((r) =>
                  r.id === ruleId ? { ...r, ...patch } : r,
                ),
              },
            }),
            dirty: true,
          })),

        deleteRule: (ruleId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              designSystem: {
                ...s.doc.designSystem,
                rules: s.doc.designSystem.rules.filter((r) => r.id !== ruleId),
              },
            }),
            dirty: true,
          })),

        addRequirement: () => {
          const req: RequirementDoc = {
            id: id("req"),
            title: "新需求文档",
            markdown: "# 新需求\n\n描述你的页面需求……",
            updatedAt: Date.now(),
            generatedFrameIds: [],
          };
          set((s) => ({
            doc: touch({ ...s.doc, requirements: [...s.doc.requirements, req] }),
            activeRequirementId: req.id,
            dirty: true,
          }));
          return req;
        },

        updateRequirement: (reqId, patch) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              requirements: s.doc.requirements.map((r) =>
                r.id === reqId ? { ...r, ...patch, updatedAt: Date.now() } : r,
              ),
            }),
            dirty: true,
          })),

        deleteRequirement: (reqId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              requirements: s.doc.requirements.filter((r) => r.id !== reqId),
            }),
            activeRequirementId: s.activeRequirementId === reqId ? null : s.activeRequirementId,
            dirty: true,
          })),

        updateDesignSystem: (patch) =>
          set((s) => ({
            doc: touch({ ...s.doc, designSystem: { ...s.doc.designSystem, ...patch } }),
            dirty: true,
          })),

        setCommentMode: (on) => set({ commentMode: on }),
        setActiveComment: (commentId) => set({ activeCommentId: commentId }),

        addComment: (frameId, x, y, text) => {
          const comment: FrameComment = {
            id: id("cmt"),
            frameId,
            x: Math.round(x),
            y: Math.round(y),
            resolved: false,
            thread: [
              { id: id("msg"), author: COMMENT_AUTHOR, text, createdAt: Date.now() },
            ],
          };
          set((s) => ({
            doc: touch({ ...s.doc, comments: [...s.doc.comments, comment] }),
            activeCommentId: comment.id,
            dirty: true,
          }));
        },

        replyComment: (commentId, text) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              comments: s.doc.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      thread: [
                        ...c.thread,
                        { id: id("msg"), author: COMMENT_AUTHOR, text, createdAt: Date.now() },
                      ],
                    }
                  : c,
              ),
            }),
            dirty: true,
          })),

        resolveComment: (commentId, resolved) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              comments: s.doc.comments.map((c) =>
                c.id === commentId ? { ...c, resolved } : c,
              ),
            }),
            dirty: true,
          })),

        deleteComment: (commentId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              comments: s.doc.comments.filter((c) => c.id !== commentId),
            }),
            activeCommentId: s.activeCommentId === commentId ? null : s.activeCommentId,
            dirty: true,
          })),

        // ---- user-journey maps ----
        setActiveJourney: (journeyId) => set({ activeJourneyId: journeyId }),

        addJourney: (journey) => {
          const j = journey ?? emptyJourney(`旅程 ${get().doc.journeys.length + 1}`);
          set((s) => ({
            doc: touch({ ...s.doc, journeys: [...s.doc.journeys, j] }),
            activeJourneyId: j.id,
            dirty: true,
          }));
          return j;
        },

        updateJourney: (journeyId, patch) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              journeys: s.doc.journeys.map((j) =>
                j.id === journeyId ? { ...j, ...patch, updatedAt: Date.now() } : j,
              ),
            }),
            dirty: true,
          })),

        deleteJourney: (journeyId) =>
          set((s) => {
            const journeys = s.doc.journeys.filter((j) => j.id !== journeyId);
            return {
              doc: touch({ ...s.doc, journeys }),
              activeJourneyId:
                s.activeJourneyId === journeyId ? (journeys[0]?.id ?? null) : s.activeJourneyId,
              dirty: true,
            };
          }),

        addStage: (journeyId, atIndex) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              journeys: s.doc.journeys.map((j) => {
                if (j.id !== journeyId) return j;
                const stage = emptyStage(`阶段 ${j.stages.length + 1}`);
                const stages = [...j.stages];
                const i = atIndex === undefined ? stages.length : Math.max(0, Math.min(atIndex, stages.length));
                stages.splice(i, 0, stage);
                return { ...j, stages, updatedAt: Date.now() };
              }),
            }),
            dirty: true,
          })),

        updateStage: (journeyId, stageId, patch) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              journeys: s.doc.journeys.map((j) =>
                j.id === journeyId
                  ? {
                      ...j,
                      stages: j.stages.map((st) => (st.id === stageId ? { ...st, ...patch } : st)),
                      updatedAt: Date.now(),
                    }
                  : j,
              ),
            }),
            dirty: true,
          })),

        deleteStage: (journeyId, stageId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              journeys: s.doc.journeys.map((j) =>
                j.id === journeyId
                  ? { ...j, stages: j.stages.filter((st) => st.id !== stageId), updatedAt: Date.now() }
                  : j,
              ),
            }),
            dirty: true,
          })),

        moveStage: (journeyId, stageId, dir) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              journeys: s.doc.journeys.map((j) => {
                if (j.id !== journeyId) return j;
                const i = j.stages.findIndex((st) => st.id === stageId);
                if (i < 0) return j;
                const to = dir === "left" ? i - 1 : i + 1;
                if (to < 0 || to >= j.stages.length) return j;
                const stages = [...j.stages];
                [stages[i], stages[to]] = [stages[to], stages[i]];
                return { ...j, stages, updatedAt: Date.now() };
              }),
            }),
            dirty: true,
          })),

        addPrototypeVariable: (v) => {
          const variable: PrototypeVariable = {
            id: id("pvar"),
            name: v?.name ?? `变量${(get().doc.prototypeVariables?.length ?? 0) + 1}`,
            type: v?.type ?? "text",
            initial: v?.initial ?? "",
          };
          set((s) => ({
            doc: touch({ ...s.doc, prototypeVariables: [...(s.doc.prototypeVariables ?? []), variable] }),
            dirty: true,
          }));
          return variable;
        },
        updatePrototypeVariable: (varId, patch) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              prototypeVariables: (s.doc.prototypeVariables ?? []).map((v) =>
                v.id === varId ? { ...v, ...patch } : v,
              ),
            }),
            dirty: true,
          })),
        deletePrototypeVariable: (varId) =>
          set((s) => ({
            doc: touch({
              ...s.doc,
              prototypeVariables: (s.doc.prototypeVariables ?? []).filter((v) => v.id !== varId),
            }),
            dirty: true,
          })),
      };
    },
    {
      limit: 100,
      partialize: (s) => ({ doc: s.doc }) as Partial<AppState>,
      equality: (a, b) => JSON.stringify((a as any).doc) === JSON.stringify((b as any).doc),
    },
  ),
);
