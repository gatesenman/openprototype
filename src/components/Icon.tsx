/**
 * Minimal stroke-based SVG icon set (Lucide-style, 24x24, currentColor).
 * Replaces the cheap Unicode glyphs that previously littered the toolbar,
 * layer tree and menus. Add new icons by extending PATHS below.
 */
export type IconName =
  | "cursor"
  | "square"
  | "circle"
  | "line"
  | "text"
  | "button"
  | "input"
  | "image"
  | "group"
  | "frame"
  | "star"
  | "undo"
  | "redo"
  | "duplicate"
  | "copy"
  | "paste"
  | "trash"
  | "ungroup"
  | "component"
  | "plus"
  | "minus"
  | "eye"
  | "eyeOff"
  | "lock"
  | "unlock"
  | "chevronRight"
  | "chevronDown"
  | "bringFront"
  | "sendBack"
  | "moveUp"
  | "moveDown"
  | "fit"
  | "ruler"
  | "grid"
  | "magnet"
  | "assets"
  | "comment"
  | "list"
  | "sparkles"
  | "edit"
  | "search"
  | "cloud"
  | "settings"
  | "folder"
  | "home"
  | "download"
  | "import"
  | "play"
  | "flow"
  | "palette"
  | "alignLeft"
  | "alignHCenter"
  | "alignRight"
  | "alignTop"
  | "alignVCenter"
  | "alignBottom"
  | "rotate"
  | "corner"
  | "opacity"
  | "visible"
  | "pen"
  | "boolUnion"
  | "boolSubtract"
  | "boolIntersect"
  | "boolExclude"
  | "outline"
  | "code"
  | "close"
  | "more";

/** Each entry is the inner SVG markup for a 24x24 viewBox. */
const PATHS: Record<IconName, JSX.Element> = {
  cursor: <path d="M5 3l6 16 2.5-6.5L20 10z" />,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  circle: <circle cx="12" cy="12" r="8" />,
  line: <path d="M5 12h14" />,
  text: (
    <>
      <path d="M5 6h14" />
      <path d="M12 6v13" />
    </>
  ),
  button: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="5" />
      <path d="M9 12h6" />
    </>
  ),
  input: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 12h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M21 16l-5-5L5 20" />
    </>
  ),
  group: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </>
  ),
  frame: (
    <>
      <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
    </>
  ),
  star: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />,
  undo: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 5 5v0" />
    </>
  ),
  redo: (
    <>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0-5 5v0" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  paste: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  ungroup: (
    <>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="13" width="7" height="7" rx="1" />
    </>
  ),
  component: (
    <path d="M12 2l3 3-2 2 2 2-3 3-2-2-2 2-3-3 2-2-2-2 3-3 2 2z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.3M6.1 6.1A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 3.4-.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  bringFront: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 14V6a2 2 0 0 1 2-2h8" />
    </>
  ),
  sendBack: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M20 10v8a2 2 0 0 1-2 2h-8" />
    </>
  ),
  moveUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  moveDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  ruler: (
    <>
      <path d="M3 8l13 13 5-5L8 3z" />
      <path d="M8 8l2 2M12 7l2 2M16 11l2 2" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 10h16M4 14h16M10 4v16M14 4v16" />
    </>
  ),
  magnet: (
    <>
      <path d="M6 4v7a6 6 0 0 0 12 0V4" />
      <path d="M6 9h4M14 9h4" />
    </>
  ),
  assets: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </>
  ),
  fit: (
    <>
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </>
  ),
  comment: <path d="M21 11.5a8.4 8.4 0 0 1-9 8 9.6 9.6 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 9-8 8.4 8.4 0 0 1 8.5 7.5z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  sparkles: <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 1117 18z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  import: (
    <>
      <path d="M12 15V3" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  play: <path d="M7 4l12 8-12 8z" />,
  flow: (
    <>
      <rect x="3" y="4" width="7" height="6" rx="1" />
      <rect x="14" y="14" width="7" height="6" rx="1" />
      <path d="M10 7h4a3 3 0 013 3v4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-.5-.3-.8-.3-1.2 0-.5.4-.8.9-.8H16a5 5 0 005-5c0-5-4-9-9-9z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  alignLeft: (
    <>
      <path d="M4 4v16" />
      <rect x="7" y="7" width="11" height="4" rx="1" />
      <rect x="7" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alignHCenter: (
    <>
      <path d="M12 4v16" />
      <rect x="6" y="7" width="12" height="4" rx="1" />
      <rect x="8" y="14" width="8" height="4" rx="1" />
    </>
  ),
  alignRight: (
    <>
      <path d="M20 4v16" />
      <rect x="6" y="7" width="11" height="4" rx="1" />
      <rect x="10" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alignTop: (
    <>
      <path d="M4 4h16" />
      <rect x="7" y="7" width="4" height="11" rx="1" />
      <rect x="14" y="7" width="4" height="7" rx="1" />
    </>
  ),
  alignVCenter: (
    <>
      <path d="M4 12h16" />
      <rect x="7" y="6" width="4" height="12" rx="1" />
      <rect x="14" y="8" width="4" height="8" rx="1" />
    </>
  ),
  alignBottom: (
    <>
      <path d="M4 20h16" />
      <rect x="7" y="6" width="4" height="11" rx="1" />
      <rect x="14" y="10" width="4" height="7" rx="1" />
    </>
  ),
  rotate: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  corner: <path d="M5 19V9a4 4 0 0 1 4-4h10" />,
  opacity: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  visible: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  pen: (
    <>
      <path d="M12 19l7-7-4-4-7 7-1 5z" />
      <path d="M8 15l-3 3" />
    </>
  ),
  boolUnion: (
    <>
      <rect x="4" y="4" width="11" height="11" rx="1" />
      <rect x="9" y="9" width="11" height="11" rx="1" />
    </>
  ),
  boolSubtract: (
    <>
      <rect x="4" y="4" width="11" height="11" rx="1" />
      <rect x="9" y="9" width="11" height="11" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  boolIntersect: (
    <>
      <rect x="4" y="4" width="11" height="11" rx="1" opacity="0.5" />
      <rect x="9" y="9" width="11" height="11" rx="1" opacity="0.5" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
    </>
  ),
  boolExclude: (
    <>
      <rect x="4" y="4" width="11" height="11" rx="1" />
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
    </>
  ),
  outline: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
  code: (
    <>
      <path d="M9 8l-5 4 5 4" />
      <path d="M15 8l5 4-5 4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
};

export default function Icon({
  name,
  size = 16,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Map a node type to its layer-tree icon. */
export function nodeTypeIcon(type: string): IconName {
  switch (type) {
    case "text":
      return "text";
    case "rect":
      return "square";
    case "ellipse":
      return "circle";
    case "line":
      return "line";
    case "button":
      return "button";
    case "input":
      return "input";
    case "image":
      return "image";
    case "group":
      return "group";
    case "frame":
      return "frame";
    case "icon":
      return "star";
    case "vector":
      return "pen";
    default:
      return "square";
  }
}
