import Konva from "konva";
import { Frame, Node } from "@/schema/types";

interface StageCtx {
  stage: Konva.Stage;
  scale: number;
  pos: { x: number; y: number };
}

let provider: () => StageCtx | null = () => null;

/** CanvasStage registers a way to reach the live Konva stage + current view transform. */
export function registerStage(p: () => StageCtx | null): void {
  provider = p;
}

/**
 * Rasterize a single frame region to a PNG/JPEG data URL.
 * `pixelScale` selects the output multiplier (1x/2x/3x); default 1x.
 */
export function exportFramePng(
  frame: Frame,
  pixelScale = 1,
  mimeType: "image/png" | "image/jpeg" = "image/png",
): string | null {
  const ctx = provider();
  if (!ctx) return null;
  const { stage, scale, pos } = ctx;
  return stage.toDataURL({
    x: pos.x + frame.x * scale,
    y: pos.y + frame.y * scale,
    width: frame.width * scale,
    height: frame.height * scale,
    pixelRatio: pixelScale / scale,
    mimeType,
  });
}

export function downloadFramePng(frame: Frame, name: string): boolean {
  const url = exportFramePng(frame);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "frame"}.png`;
  a.click();
  return true;
}

/**
 * Rasterize a single node (within a frame) to a PNG/JPEG data URL at the given
 * pixel scale (1x/2x/3x). The node's position is relative to its frame.
 */
export function exportNodePng(
  frame: Frame,
  node: Node,
  pixelScale = 1,
  mimeType: "image/png" | "image/jpeg" = "image/png",
): string | null {
  const ctx = provider();
  if (!ctx) return null;
  const { stage, scale, pos } = ctx;
  return stage.toDataURL({
    x: pos.x + (frame.x + node.x) * scale,
    y: pos.y + (frame.y + node.y) * scale,
    width: node.width * scale,
    height: node.height * scale,
    pixelRatio: pixelScale / scale,
    mimeType,
  });
}

export function downloadNodePng(
  frame: Frame,
  node: Node,
  pixelScale = 1,
  format: "png" | "jpg" = "png",
): boolean {
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const url = exportNodePng(frame, node, pixelScale, mime);
  if (!url) return false;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${node.name || "node"}@${pixelScale}x.${format}`;
  a.click();
  return true;
}
