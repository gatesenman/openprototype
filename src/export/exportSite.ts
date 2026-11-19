import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GpoDocument } from "@/schema/types";
import { normalizeDoc } from "@/schema/defaults";
import { exportToHtml } from "./exportHtml";

export interface SiteExportResult {
  outputDir: string;
  files: string[];
  frameIds: string[];
  title: string;
}

export function listFrameIds(doc: GpoDocument): string[] {
  return normalizeDoc(doc).pages.flatMap((page) => page.frames.map((frame) => frame.id));
}

/** Write a self-contained static site (index.html) that can be opened without the app. */
export function exportSite(doc: GpoDocument, outputDir: string): SiteExportResult {
  const normalized = normalizeDoc(doc);
  mkdirSync(outputDir, { recursive: true });
  const html = exportToHtml(normalized);
  const indexPath = join(outputDir, "index.html");
  writeFileSync(indexPath, html, "utf8");
  const manifest = {
    title: normalized.meta.name,
    app: "openprototype",
    frames: listFrameIds(normalized),
  };
  const manifestPath = join(outputDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return {
    outputDir,
    files: ["index.html", "manifest.json"],
    frameIds: manifest.frames,
    title: normalized.meta.name,
  };
}
