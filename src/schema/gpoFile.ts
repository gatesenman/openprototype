import JSZip from "jszip";
import { GPO_SCHEMA_VERSION, GpoDocument } from "./types";
import { normalizeDoc } from "./defaults";

/**
 * `.gpo` file format (GPO = "Generative Prototype Object").
 *
 * A `.gpo` file is a ZIP container — the same proven approach used by `.sketch`
 * and Office formats — chosen so the format is inspectable, diff-friendly at the
 * asset level, and trivially interoperable with other tools.
 *
 * Container layout:
 *   /manifest.json      -> { format, schemaVersion, generator }
 *   /document.json      -> the full GpoDocument tree
 *   /thumbnail.txt      -> optional preview (data URL)
 *   /assets/*           -> embedded images/fonts (referenced by node.src)
 *   /INTEROP.md         -> the open interop spec (so any tool can read it)
 *
 * Interop: document.json is a documented, open JSON schema. The interop layer
 * (src/interop) maps to/from Figma & Sketch node models against this schema.
 */

export const GPO_FORMAT = "gpo-container";

const INTEROP_SPEC = `# .gpo 互通规范 (开放)

.gpo 是一个 ZIP 容器，主体为 document.json（开放 JSON Schema，见 schemaVersion ${GPO_SCHEMA_VERSION}）。

## 节点模型与主流设计软件的字段映射

| GPO              | Figma            | Sketch            |
|------------------|------------------|-------------------|
| Frame            | FRAME            | artboard          |
| Node.type=rect   | RECTANGLE        | rectangle         |
| Node.type=text   | TEXT             | text              |
| Node.type=group  | GROUP            | group             |
| Node.type=image  | RECTANGLE+image  | bitmap            |
| x,y,width,height | absoluteBoundingBox | frame          |
| style.fill       | fills[0]         | style.fills[0]    |
| style.radius     | cornerRadius     | fixedRadius       |
| layout (auto)    | layoutMode       | (group + plugin)  |
| componentRef     | COMPONENT/INSTANCE | symbolMaster    |
| interactions     | reactions/prototype | flow           |

任何第三方工具只要按本表读取 document.json 即可与 .gpo 互通。
导入器/导出器位于 src/interop，将上述模型双向转换。
`;

export async function serializeGpo(
  doc: GpoDocument,
  thumbnail?: string,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify(
      { format: GPO_FORMAT, schemaVersion: GPO_SCHEMA_VERSION, generator: "gpo-studio" },
      null,
      2,
    ),
  );
  zip.file("document.json", JSON.stringify(doc, null, 2));
  zip.file("INTEROP.md", INTEROP_SPEC);
  if (thumbnail) zip.file("thumbnail.txt", thumbnail);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function deserializeGpo(data: Blob | ArrayBuffer): Promise<GpoDocument> {
  const zip = await JSZip.loadAsync(data);
  const docFile = zip.file("document.json");
  if (!docFile) throw new Error("无效的 .gpo 文件：缺少 document.json");
  const text = await docFile.async("string");
  const doc = JSON.parse(text) as GpoDocument;
  if (!doc.meta || doc.meta.app !== "gpo-studio") {
    throw new Error("无效的 .gpo 文件：document.json 格式不匹配");
  }
  return normalizeDoc(doc);
}
