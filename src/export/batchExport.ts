import JSZip from "jszip";
import { Frame } from "@/schema/types";
import { exportFramePng } from "./exportPng";

/** Sanitize a layer/frame name into a safe slice filename (kebab-ish). */
export function sliceName(name: string, scale: number, ext = "png"): string {
  const base =
    name
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "frame";
  return scale > 1 ? `${base}@${scale}x.${ext}` : `${base}.${ext}`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Batch-export every frame as a PNG at the given pixel scale, packaged in a
 * single zip. Returns the number of frames written (0 if the canvas stage is
 * unavailable). Frames are rasterized via the live Konva stage.
 */
export async function downloadFramesZip(
  frames: Frame[],
  pixelScale = 1,
  zipName = "slices.zip",
): Promise<number> {
  const zip = new JSZip();
  let count = 0;
  const used = new Map<string, number>();
  for (const frame of frames) {
    const url = exportFramePng(frame, pixelScale);
    if (!url) continue;
    let fname = sliceName(frame.name, pixelScale);
    const seen = used.get(fname) ?? 0;
    used.set(fname, seen + 1);
    if (seen > 0) fname = fname.replace(/\.png$/, `-${seen}.png`);
    zip.file(fname, dataUrlToBytes(url));
    count++;
  }
  if (count === 0) return 0;
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(a.href);
  return count;
}
