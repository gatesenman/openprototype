import { GpoDocument } from "@/schema/types";
import { id, normalizeDoc } from "@/schema/defaults";

/** A point-in-time snapshot of a document on a given branch. */
export interface Snapshot {
  id: string;
  name: string;
  note: string;
  createdAt: number;
  branch: string;
  document: GpoDocument;
}

export interface VersionStore {
  branches: string[];
  currentBranch: string;
  snapshots: Snapshot[];
}

export const MAIN_BRANCH = "main";

const KEY = (docId: string) => `gpo.versions.${docId}`;

function empty(): VersionStore {
  return { branches: [MAIN_BRANCH], currentBranch: MAIN_BRANCH, snapshots: [] };
}

export function loadHistory(docId: string): VersionStore {
  try {
    const raw = localStorage.getItem(KEY(docId));
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as VersionStore;
    if (!parsed.branches?.length) parsed.branches = [MAIN_BRANCH];
    if (!parsed.currentBranch) parsed.currentBranch = parsed.branches[0];
    if (!Array.isArray(parsed.snapshots)) parsed.snapshots = [];
    return parsed;
  } catch {
    return empty();
  }
}

function persist(docId: string, store: VersionStore): void {
  try {
    localStorage.setItem(KEY(docId), JSON.stringify(store));
  } catch {
    /* quota / disabled — ignore */
  }
}

/** Capture the current document as a new snapshot on the current branch. */
export function captureSnapshot(
  docId: string,
  document: GpoDocument,
  opts: { name?: string; note?: string } = {}
): VersionStore {
  const store = loadHistory(docId);
  const snap: Snapshot = {
    id: id("ver"),
    name: opts.name?.trim() || new Date().toLocaleString(),
    note: opts.note?.trim() || "",
    createdAt: Date.now(),
    branch: store.currentBranch,
    // Deep clone so later edits don't mutate the stored snapshot.
    document: JSON.parse(JSON.stringify(document)) as GpoDocument,
  };
  store.snapshots.push(snap);
  persist(docId, store);
  return store;
}

/** Snapshots for a branch (defaults to current), newest first. */
export function listSnapshots(docId: string, branch?: string): Snapshot[] {
  const store = loadHistory(docId);
  const b = branch ?? store.currentBranch;
  return store.snapshots
    .filter((s) => s.branch === b)
    .sort((a, c) => c.createdAt - a.createdAt);
}

export function getSnapshot(docId: string, snapId: string): Snapshot | null {
  const snap = loadHistory(docId).snapshots.find((s) => s.id === snapId);
  if (!snap) return null;
  return { ...snap, document: normalizeDoc(snap.document) };
}

export function renameSnapshot(
  docId: string,
  snapId: string,
  name: string,
  note: string
): VersionStore {
  const store = loadHistory(docId);
  const snap = store.snapshots.find((s) => s.id === snapId);
  if (snap) {
    snap.name = name.trim() || snap.name;
    snap.note = note;
    persist(docId, store);
  }
  return store;
}

export function deleteSnapshot(docId: string, snapId: string): VersionStore {
  const store = loadHistory(docId);
  store.snapshots = store.snapshots.filter((s) => s.id !== snapId);
  persist(docId, store);
  return store;
}

/**
 * Create a new branch (forked from the current branch's latest state) and
 * switch to it. Optionally seed it with an initial snapshot of `document`.
 */
export function createBranch(
  docId: string,
  branch: string,
  document?: GpoDocument
): VersionStore {
  const store = loadHistory(docId);
  const name = branch.trim();
  if (!name) return store;
  if (!store.branches.includes(name)) store.branches.push(name);
  store.currentBranch = name;
  if (document) {
    store.snapshots.push({
      id: id("ver"),
      name: `分支起点 · ${name}`,
      note: "从当前状态创建分支",
      createdAt: Date.now(),
      branch: name,
      document: JSON.parse(JSON.stringify(document)) as GpoDocument,
    });
  }
  persist(docId, store);
  return store;
}

export function switchBranch(docId: string, branch: string): VersionStore {
  const store = loadHistory(docId);
  if (store.branches.includes(branch)) {
    store.currentBranch = branch;
    persist(docId, store);
  }
  return store;
}

export function deleteBranch(docId: string, branch: string): VersionStore {
  const store = loadHistory(docId);
  if (branch === MAIN_BRANCH) return store;
  store.branches = store.branches.filter((b) => b !== branch);
  store.snapshots = store.snapshots.filter((s) => s.branch !== branch);
  if (store.currentBranch === branch) store.currentBranch = MAIN_BRANCH;
  persist(docId, store);
  return store;
}
