import { Frame, GpoDocument, Node, Page } from "@/schema/types";

/** A structural diff between two documents, summarised for the version timeline. */
export interface DocDiff {
  nameChanged: boolean;
  oldName: string;
  newName: string;
  pagesAdded: string[];
  pagesRemoved: string[];
  framesAdded: string[];
  framesRemoved: string[];
  framesChanged: string[];
  nodesAdded: number;
  nodesRemoved: number;
  nodesChanged: number;
  /** Total number of structural changes (used to show "N changes"). */
  total: number;
}

function flattenNodes(nodes: Node[], out: Map<string, Node> = new Map()): Map<string, Node> {
  for (const n of nodes) {
    out.set(n.id, n);
    if (n.children && n.children.length) flattenNodes(n.children, out);
  }
  return out;
}

function allFrames(doc: GpoDocument): Map<string, Frame> {
  const m = new Map<string, Frame>();
  for (const p of doc.pages) for (const f of p.frames) m.set(f.id, f);
  return m;
}

function pageById(doc: GpoDocument): Map<string, Page> {
  const m = new Map<string, Page>();
  for (const p of doc.pages) m.set(p.id, p);
  return m;
}

/** Compare a frame's own properties, ignoring its node list. */
function frameShell(f: Frame): string {
  const { nodes: _nodes, ...rest } = f;
  return JSON.stringify(rest);
}

/** Compare a node's own properties, ignoring nested children (diffed separately). */
function nodeShell(n: Node): string {
  const { children: _children, ...rest } = n;
  return JSON.stringify(rest);
}

/**
 * Compute a structural diff from `oldDoc` → `newDoc`.
 * Pure function: no side effects, safe to unit-test.
 */
export function diffDocuments(oldDoc: GpoDocument, newDoc: GpoDocument): DocDiff {
  const oldPages = pageById(oldDoc);
  const newPages = pageById(newDoc);
  const pagesAdded: string[] = [];
  const pagesRemoved: string[] = [];
  for (const [id, p] of newPages) if (!oldPages.has(id)) pagesAdded.push(p.name);
  for (const [id, p] of oldPages) if (!newPages.has(id)) pagesRemoved.push(p.name);

  const oldFrames = allFrames(oldDoc);
  const newFrames = allFrames(newDoc);
  const framesAdded: string[] = [];
  const framesRemoved: string[] = [];
  const framesChanged: string[] = [];

  let nodesAdded = 0;
  let nodesRemoved = 0;
  let nodesChanged = 0;

  for (const [id, nf] of newFrames) {
    const of = oldFrames.get(id);
    if (!of) {
      framesAdded.push(nf.name);
      nodesAdded += flattenNodes(nf.nodes).size;
      continue;
    }
    const oldNodes = flattenNodes(of.nodes);
    const newNodes = flattenNodes(nf.nodes);
    let changedHere = frameShell(of) !== frameShell(nf);
    for (const [nid, nn] of newNodes) {
      const onode = oldNodes.get(nid);
      if (!onode) {
        nodesAdded++;
        changedHere = true;
      } else if (nodeShell(onode) !== nodeShell(nn)) {
        nodesChanged++;
        changedHere = true;
      }
    }
    for (const [nid] of oldNodes) {
      if (!newNodes.has(nid)) {
        nodesRemoved++;
        changedHere = true;
      }
    }
    if (changedHere) framesChanged.push(nf.name);
  }
  for (const [id, of] of oldFrames) {
    if (!newFrames.has(id)) {
      framesRemoved.push(of.name);
      nodesRemoved += flattenNodes(of.nodes).size;
    }
  }

  const nameChanged = oldDoc.meta.name !== newDoc.meta.name;
  const total =
    (nameChanged ? 1 : 0) +
    pagesAdded.length +
    pagesRemoved.length +
    framesAdded.length +
    framesRemoved.length +
    framesChanged.length +
    nodesAdded +
    nodesRemoved +
    nodesChanged;

  return {
    nameChanged,
    oldName: oldDoc.meta.name,
    newName: newDoc.meta.name,
    pagesAdded,
    pagesRemoved,
    framesAdded,
    framesRemoved,
    framesChanged,
    nodesAdded,
    nodesRemoved,
    nodesChanged,
    total,
  };
}

/** Human-readable one-line summary of a diff, for the timeline. */
export function summarizeDiff(d: DocDiff): string {
  if (d.total === 0) return "无变化";
  const parts: string[] = [];
  if (d.nameChanged) parts.push("重命名文档");
  if (d.pagesAdded.length) parts.push(`+${d.pagesAdded.length} 页面`);
  if (d.pagesRemoved.length) parts.push(`-${d.pagesRemoved.length} 页面`);
  if (d.framesAdded.length) parts.push(`+${d.framesAdded.length} 画板`);
  if (d.framesRemoved.length) parts.push(`-${d.framesRemoved.length} 画板`);
  if (d.nodesAdded) parts.push(`+${d.nodesAdded} 图层`);
  if (d.nodesRemoved) parts.push(`-${d.nodesRemoved} 图层`);
  if (d.nodesChanged) parts.push(`~${d.nodesChanged} 图层`);
  return parts.join(" · ");
}
