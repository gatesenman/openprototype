import { GpoDocument } from "@/schema/types";
import { normalizeDoc } from "@/schema/defaults";

const AUTOSAVE_KEY = "gpo.autosave.v1";
const RECENTS_KEY = "gpo.recents.v1";

export interface RecentEntry {
  name: string;
  savedAt: number;
}

export function saveAuto(doc: GpoDocument): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

export function loadAuto(): GpoDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return normalizeDoc(JSON.parse(raw) as GpoDocument);
  } catch {
    return null;
  }
}

export function clearAuto(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function pushRecent(name: string): void {
  try {
    const list = getRecents().filter((r) => r.name !== name);
    list.unshift({ name, savedAt: Date.now() });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
}

export function getRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]") as RecentEntry[];
  } catch {
    return [];
  }
}
