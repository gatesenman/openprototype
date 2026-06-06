import { create } from "zustand";
import { AiSettings, loadAiSettings, saveAiSettings } from "@/ai/settings";

interface UiState {
  ai: AiSettings;
  setAi: (s: AiSettings) => void;
  toast: string | null;
  showToast: (msg: string, ms?: number) => void;
  /** "select" | "rect" | "text" | "frame" | "flow" */
  tool: string;
  setTool: (t: string) => void;
  /** Canvas view aids (P2). */
  showRulers: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  toggleRulers: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  /** Dev Mode: read-only inspector with measurements + code handoff. */
  devMode: boolean;
  toggleDevMode: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set) => ({
  ai: loadAiSettings(),
  setAi: (s) => {
    saveAiSettings(s);
    set({ ai: s });
  },
  toast: null,
  showToast: (msg, ms = 3200) => {
    set({ toast: msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), ms);
  },
  tool: "select",
  setTool: (t) => set({ tool: t }),
  showRulers: true,
  showGrid: false,
  snapEnabled: true,
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  devMode: false,
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
}));
