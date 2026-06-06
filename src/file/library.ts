import { GpoDocument } from "@/schema/types";
import { normalizeDoc } from "@/schema/defaults";

/**
 * Local file library — the app-level "file management" layer.
 *
 * Every document the user works on is upserted here (keyed by `meta.id`), so the
 * Home screen can list, reopen, rename and delete files like a normal design app
 * instead of relying on a single hidden autosave slot.
 */
const LIBRARY_KEY = "gpo.library.v1";

export interface LibrarySummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  frameCount: number;
}

type LibraryMap = Record<string, GpoDocument>;

function readMap(): LibraryMap {
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "{}") as LibraryMap;
  } catch {
    return {};
  }
}

function writeMap(map: LibraryMap): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(map));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

function summarize(doc: GpoDocument): LibrarySummary {
  const frameCount = doc.pages.reduce((n, p) => n + p.frames.length, 0);
  return {
    id: doc.meta.id,
    name: doc.meta.name,
    createdAt: doc.meta.createdAt,
    updatedAt: doc.meta.updatedAt,
    pageCount: doc.pages.length,
    frameCount,
  };
}

/** Insert or update a document in the library. */
export function saveToLibrary(doc: GpoDocument): void {
  const map = readMap();
  map[doc.meta.id] = doc;
  writeMap(map);
}

/** All documents, newest first. */
export function listLibrary(): LibrarySummary[] {
  return Object.values(readMap())
    .map(summarize)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadFromLibrary(docId: string): GpoDocument | null {
  const doc = readMap()[docId];
  return doc ? normalizeDoc(doc) : null;
}

export function deleteFromLibrary(docId: string): void {
  const map = readMap();
  delete map[docId];
  writeMap(map);
}

export function renameInLibrary(docId: string, name: string): void {
  const map = readMap();
  const doc = map[docId];
  if (!doc) return;
  doc.meta = { ...doc.meta, name, updatedAt: Date.now() };
  writeMap(map);
}
