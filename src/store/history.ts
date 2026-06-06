import { useStore } from "./useStore";

export const undo = () => useStore.temporal.getState().undo();
export const redo = () => useStore.temporal.getState().redo();
export const clearHistory = () => useStore.temporal.getState().clear();
