import { deserializeGpo, serializeGpo } from "@/schema/gpoFile";
import { GpoDocument } from "@/schema/types";

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

const isTauri = () => typeof window !== "undefined" && !!window.__TAURI__;

// Import Tauri plugins by variable name so the web build/typecheck doesn't
// require the (desktop-only) packages to be installed.
const dynImport = (m: string): Promise<any> =>
  import(/* @vite-ignore */ m);

/** Save the document as a `.gpo` file. Uses Tauri dialog on desktop, download in browser. */
export async function saveGpo(doc: GpoDocument): Promise<void> {
  const blob = await serializeGpo(doc);
  const filename = `${doc.meta.name || "untitled"}.gpo`;

  if (isTauri()) {
    const { save } = await dynImport("@tauri-apps/plugin-dialog");
    const { writeFile } = await dynImport("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "OpenPrototype", extensions: ["gpo"] }],
    });
    if (!path) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    await writeFile(path, buf);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open a `.gpo` file and return the parsed document. */
export async function openGpo(): Promise<GpoDocument | null> {
  if (isTauri()) {
    const { open } = await dynImport("@tauri-apps/plugin-dialog");
    const { readFile } = await dynImport("@tauri-apps/plugin-fs");
    const path = await open({
      filters: [{ name: "OpenPrototype", extensions: ["gpo"] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return null;
    const data = await readFile(path);
    return deserializeGpo(data.buffer as ArrayBuffer);
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".gpo";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await deserializeGpo(await file.arrayBuffer()));
      } catch (e) {
        alert((e as Error).message);
        resolve(null);
      }
    };
    input.click();
  });
}
