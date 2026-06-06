# 2.3 File Persistence & .gpo Format

# File Persistence & .gpo Format

<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

- [src/__tests__/core.test.ts](src/__tests__/core.test.ts)
- [src/file/fileIo.ts](src/file/fileIo.ts)
- [src/file/library.ts](src/file/library.ts)
- [src/file/persist.ts](src/file/persist.ts)
- [src/interop/importDesign.ts](src/interop/importDesign.ts)
- [src/schema/gpoFile.ts](src/schema/gpoFile.ts)
- [src/schema/layout.ts](src/schema/layout.ts)

</details>



OpenPrototype utilizes a structured ZIP container format for project storage, ensuring that generative design data remains portable, inspectable, and interoperable with industry-standard tools. The persistence layer abstracts platform-specific I/O to provide a seamless experience across web browsers and the Tauri-powered desktop application.

## The .gpo Container Format

The `.gpo` (Generative Prototype Object) format is a ZIP-compressed archive [src/schema/gpoFile.ts:6-10](). This approach provides a "diff-friendly" structure where assets and document state are decoupled, mirroring the architecture used by modern design tools like Sketch.

### Container Layout
A valid `.gpo` file contains the following internal structure:

| File | Description |
| :--- | :--- |
| `manifest.json` | Metadata including `format` (`gpo-container`), `schemaVersion`, and `generator` [src/schema/gpoFile.ts:54-61](). |
| `document.json` | The serialized `GpoDocument` tree, containing all pages, frames, nodes, and design system tokens [src/schema/gpoFile.ts:62-62](). |
| `INTEROP.md` | An embedded markdown specification detailing field mappings for third-party tool developers [src/schema/gpoFile.ts:25-47](). |
| `thumbnail.txt` | (Optional) A base64-encoded data URL of the document preview [src/schema/gpoFile.ts:64-64](). |
| `assets/` | (Planned) Directory for binary blobs such as images and custom fonts. |

### Interoperability Mapping
The `INTEROP.md` file defines how `GpoDocument` entities map to Figma and Sketch models to facilitate cross-tool workflows [src/schema/gpoFile.ts:31-43]().

**Sources:** [src/schema/gpoFile.ts:1-79]()

---

## Serialization Pipeline

The serialization process transforms the in-memory Zustand store state into the compressed `.gpo` blob. Deserialization performs the inverse, including a critical **normalization** step to ensure backward compatibility with older schema versions.

### Data Flow: Serialization & Deserialization

Title: Serialization and Deserialization Pipeline
```mermaid
graph TD
  subgraph "Memory Space"
    "useStore[Zustand Store]" --> |"GpoDocument"| "serializeGpo[serializeGpo]"
  end

  subgraph "Serialization (JSZip)"
    "serializeGpo[serializeGpo]" --> "Manifest[manifest.json]"
    "serializeGpo[serializeGpo]" --> "DocJSON[document.json]"
    "serializeGpo[serializeGpo]" --> "InteropMD[INTEROP.md]"
    "Manifest[Manifest]" & "DocJSON[DocJSON]" & "InteropMD[InteropMD]" --> "ZipBlob[.gpo Blob]"
  end

  subgraph "Deserialization"
    "ZipBlob[.gpo Blob]" --> "deserializeGpo[deserializeGpo]"
    "deserializeGpo[deserializeGpo]" --> "JSONParse[JSON.parse]"
    "JSONParse[JSON.parse]" --> "normalizeDoc[normalizeDoc]"
    "normalizeDoc[normalizeDoc]" --> |"Backfilled GpoDocument"| "useStore[Zustand Store]"
  end
```
**Sources:** [src/schema/gpoFile.ts:49-79](), [src/schema/defaults.ts:1-10]() (referenced via `normalizeDoc`)

---

## Platform-Adaptive I/O

The application detects its environment via `window.__TAURI__` to determine whether to use native OS file system APIs or browser-based downloads [src/file/fileIo.ts:10-10]().

### I/O Implementation Details
*   **Tauri Desktop**: Uses `@tauri-apps/plugin-dialog` for native "Save As" and "Open" dialogs and `@tauri-apps/plugin-fs` for direct disk access [src/file/fileIo.ts:22-32]().
*   **Web Browser**: Uses `URL.createObjectURL` and a hidden `<a>` element for downloads; uses a hidden `<input type="file">` for opening files [src/file/fileIo.ts:35-41](), [src/file/fileIo.ts:57-72]().

### Code Entity Association: File I/O

Title: Platform-Adaptive I/O Routing
```mermaid
graph LR
  "UI_Trigger[User Click Save]" --> "saveGpo[saveGpo (fileIo.ts)]"
  
  "saveGpo[saveGpo]" --> "isTauri[isTauri Check]"
  
  "isTauri[isTauri Check]" -- "True" --> "TauriFS[Tauri Native API]"
  "isTauri[isTauri Check]" -- "False" --> "BrowserDL[Browser Download Blob]"

  "TauriFS[Tauri Native API]" --> "TauriDialog[plugin-dialog: save]"
  "TauriFS[Tauri Native API]" --> "TauriWrite[plugin-fs: writeFile]"

  "BrowserDL[Browser Download Blob]" --> "CreateURL[URL.createObjectURL]"
  "CreateURL[URL.createObjectURL]" --> "AnchorClick[HTMLAnchorElement.click]"
```
**Sources:** [src/file/fileIo.ts:1-74]()

---

## Local Library & Persistence

Beyond explicit file exports, OpenPrototype maintains a local persistence layer in `localStorage` to prevent data loss and provide a "Project Home" experience.

### Local Library (`LibraryMap`)
The library acts as a local database for projects. Every document is keyed by its `meta.id` [src/file/library.ts:7-9]().
*   **`saveToLibrary(doc)`**: Upserts the full document into the `gpo.library.v1` key [src/file/library.ts:53-57]().
*   **`listLibrary()`**: Returns a `LibrarySummary` array (ID, name, counts) sorted by `updatedAt` for the Home screen [src/file/library.ts:60-64]().

### Autosave Mechanism
The `saveAuto(doc)` function persists the current working document to a dedicated `gpo.autosave.v1` slot [src/file/persist.ts:12-18](). This is triggered by the application lifecycle (managed in `App.tsx`) to ensure that even if the tab is closed, the state is recoverable via `loadAuto()` [src/file/persist.ts:20-28]().

### Recent Files
The system tracks the 10 most recently modified filenames in `gpo.recents.v1` to populate "Recent" lists in the UI [src/file/persist.ts:38-46]().

| Feature | Key | Function |
| :--- | :--- | :--- |
| **Full Library** | `gpo.library.v1` | `saveToLibrary`, `loadFromLibrary` |
| **Autosave** | `gpo.autosave.v1` | `saveAuto`, `loadAuto` |
| **Recents** | `gpo.recents.v1` | `pushRecent`, `getRecents` |

**Sources:** [src/file/library.ts:1-84](), [src/file/persist.ts:1-55]()

---

## Interop Import Layer

The interop layer (located in `src/interop/importDesign.ts`) is responsible for parsing external formats into the GPO model.

### Token Parsing Pipeline
The `parseTokens` function recursively walks design token trees (supporting W3C, Tokens Studio, and Figma formats) and buckets them into GPO categories [src/interop/importDesign.ts:101-191]().

1.  **Category Detection**: Uses `categoryFromType` (e.g., "color", "spacing") or `categoryFromPath` (regex matching on keys like "radius" or "gap") [src/interop/importDesign.ts:64-82]().
2.  **Unit Conversion**: The `toPx` utility normalizes `rem`, `em`, and `pt` units into pixels (using a 16px base) [src/interop/importDesign.ts:51-62]().
3.  **Color Normalization**: `figmaColorToHex` converts 0..1 RGB(A) objects into standard hex strings [src/interop/importDesign.ts:41-48]().

**Sources:** [src/interop/importDesign.ts:1-191]()

---
