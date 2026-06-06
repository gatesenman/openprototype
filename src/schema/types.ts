/**
 * GPO document schema.
 *
 * Everything in the product — manual editing and AI generation alike — operates
 * on this structured tree. AI emits this schema (not images), so generated output
 * stays fully editable on the canvas.
 *
 * File format: `.gpo` (a zip container; see gpoFile.ts).
 */

export const GPO_SCHEMA_VERSION = "1.0.0";

/** One color stop on a gradient (offset in 0..1). */
export interface GradientStop {
  offset: number;
  color: string;
}

export type Fill =
  | { type: "solid"; color: string; opacity?: number }
  | { type: "linear"; angle: number; stops: GradientStop[] } // angle in degrees, 0 = left→right
  | { type: "radial"; stops: GradientStop[] }
  | { type: "image"; src: string; mode?: "fill" | "fit" | "tile"; opacity?: number }
  | { type: "token"; token: string } // references a design-system color token
  | { type: "variable"; variableId: string }; // references a design-system variable

/**
 * Blend mode for compositing a node over what's beneath it. Values map directly
 * to Canvas `globalCompositeOperation` (Figma-style names); "normal" = source-over.
 */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export interface Stroke {
  color: string;
  width: number;
  /** Stroke alignment relative to the shape edge (Figma-style). Defaults to "center". */
  position?: "inside" | "center" | "outside";
}

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

export interface TextStyle {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
  align: "left" | "center" | "right";
}

export type NodeType =
  | "frame" // a screen / artboard root or nested container
  | "group"
  | "rect"
  | "ellipse"
  | "line"
  | "text"
  | "image"
  | "button"
  | "input"
  | "icon"
  | "vector"; // freeform vector path (pen tool / boolean result)

/** A single anchor point on a vector path. Coordinates are node-local. */
export interface VectorAnchor {
  x: number;
  y: number;
  /** Incoming bezier handle offset relative to the anchor (towards previous segment). */
  hIn?: { x: number; y: number };
  /** Outgoing bezier handle offset relative to the anchor (towards next segment). */
  hOut?: { x: number; y: number };
}

/** A vector path: an ordered list of anchors, optionally closed. */
export interface VectorPath {
  anchors: VectorAnchor[];
  closed: boolean;
}

/** Layout engine for auto-layout containers. */
export interface AutoLayout {
  mode: "none" | "vertical" | "horizontal";
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  align: "start" | "center" | "end" | "stretch";
}

export type InteractionTrigger = "click" | "hover";

/** A node-level interaction that drives prototype navigation (flows). */
export interface Interaction {
  id: string;
  trigger: InteractionTrigger;
  /** Target frame id to navigate to. */
  targetFrameId: string;
  animation?: "none" | "fade" | "slide-left" | "slide-right";
}

export interface NodeStyle {
  fill?: Fill;
  stroke?: Stroke;
  radius?: number;
  opacity?: number;
  shadow?: Shadow;
  /** Layer blur radius in px (blurs the node's own pixels). */
  blur?: number;
  /** Compositing blend mode against layers beneath. Defaults to "normal". */
  blendMode?: BlendMode;
}

/** Horizontal resize behavior of a node relative to its parent frame. */
export type HConstraint = "left" | "right" | "left-right" | "center" | "scale";
/** Vertical resize behavior of a node relative to its parent frame. */
export type VConstraint = "top" | "bottom" | "top-bottom" | "center" | "scale";

/** Figma-style resize constraints applied when the parent frame is resized. */
export interface Constraints {
  h: HConstraint;
  v: VConstraint;
}

export interface Node {
  id: string;
  type: NodeType;
  name: string;
  /** Position relative to parent (frame for top-level nodes). */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  style: NodeStyle;
  text?: TextStyle;
  /** Image source (data URL or asset path inside the .gpo container). */
  src?: string;
  layout?: AutoLayout;
  /** Freeform vector geometry (for type === "vector"). Anchors are node-local. */
  path?: VectorPath;
  /** Resize behavior relative to parent frame (Figma constraints). */
  constraints?: Constraints;
  /** Reference to a design-system component definition. */
  componentRef?: string;
  interactions?: Interaction[];
  children?: Node[];
  locked?: boolean;
  hidden?: boolean;
  /** Provenance: was this produced by AI, and from what prompt. */
  meta?: { aiGenerated?: boolean; prompt?: string };
}

/** A Frame is a top-level screen on the canvas. */
export interface Frame {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  /** Fidelity this frame was authored/generated at. */
  fidelity: "wireframe" | "hifi";
  /** When true, children overflowing the frame bounds are clipped (Figma "Clip content"). */
  clipContent?: boolean;
  nodes: Node[];
}

export interface Page {
  id: string;
  name: string;
  frames: Frame[];
}

/** A requirement document (markdown). Product entry point: requirements drive prototypes. */
export interface RequirementDoc {
  id: string;
  title: string;
  markdown: string;
  updatedAt: number;
  /** Frames that were generated from this requirement doc. */
  generatedFrameIds: string[];
}

/** Design tokens — the foundation of a design system. */
export interface DesignTokens {
  colors: Record<string, string>;
  fonts: { family: string; sizes: Record<string, number> };
  radii: Record<string, number>;
  spacing: Record<string, number>;
  /** Elevation / shadow scale (standard design-system primitive). */
  elevation?: Record<string, Shadow>;
}

/** A reusable component definition in the design system. */
export interface ComponentDef {
  id: string;
  name: string;
  /** A node subtree acting as the component template. */
  template: Node;
}

/** A design rule the AI must respect and that we validate generated output against. */
export interface DesignRule {
  id: string;
  description: string;
  /** Machine-checkable rule kind. */
  kind: "primary-button-token" | "card-radius" | "min-tap-target" | "custom";
  value?: number | string;
}

/**
 * A design variable (à la Figma Variables): a named, reusable value that can be
 * bound to node properties. Color variables can drive fills; number variables
 * are available for spacing / sizing semantics.
 */
export interface Variable {
  id: string;
  name: string;
  type: "color" | "number";
  value: string | number;
  /** Optional grouping (Figma "collection"), e.g. "Brand" / "Spacing". */
  collection?: string;
}

export interface DesignSystem {
  name: string;
  tokens: DesignTokens;
  components: ComponentDef[];
  rules: DesignRule[];
  /** Reusable design variables, bindable to node fills. */
  variables?: Variable[];
  /** System-level prompt injected into every AI generation. */
  systemPrompt: string;
}

/** A single message inside a comment thread (collaboration-lite). */
export interface CommentEntry {
  id: string;
  author: string;
  text: string;
  createdAt: number;
}

/** A comment pin anchored to a frame at a frame-relative position. */
export interface FrameComment {
  id: string;
  frameId: string;
  /** Position relative to the frame's top-left. */
  x: number;
  y: number;
  resolved: boolean;
  thread: CommentEntry[];
}

/** The persona a user-journey map is told from the perspective of. */
export interface JourneyPersona {
  /** Persona name, e.g. "新用户 · 小王". */
  name: string;
  /** Short role / description, e.g. "首次购物的上班族". */
  role?: string;
  /** The persona's overarching goal across the journey. */
  goal?: string;
  /** A single emoji or initial used as the avatar. */
  avatar?: string;
}

/**
 * Emotion score for a journey stage, on a -2..2 scale
 * (-2 极度沮丧 … 0 中性 … 2 非常满意). Drives the emotion curve.
 */
export type JourneyEmotion = -2 | -1 | 0 | 1 | 2;

/** One stage (column) of a user-journey map. */
export interface JourneyStage {
  id: string;
  /** Stage name, e.g. "认知" / "考虑" / "购买". */
  name: string;
  /** What the user is doing in this stage. */
  actions: string[];
  /** Channels / touchpoints used (App、客服、邮件…). */
  touchpoints: string[];
  /** The user's thoughts / quotes in this stage. */
  thoughts: string[];
  /** Emotion at this stage; drives the curve. */
  emotion: JourneyEmotion;
  /** Pain points encountered. */
  pains: string[];
  /** Opportunities / improvement ideas. */
  opportunities: string[];
  /** Optional link to a prototype frame illustrating this stage. */
  frameId?: string;
}

/** A complete user-journey map (persona + ordered stages). */
export interface JourneyMap {
  id: string;
  title: string;
  persona: JourneyPersona;
  /** Scenario / context this journey plays out in. */
  scenario?: string;
  stages: JourneyStage[];
  updatedAt: number;
}

export interface DocumentMeta {
  id: string;
  name: string;
  schemaVersion: string;
  createdAt: number;
  updatedAt: number;
  app: "gpo-studio";
}

export interface GpoDocument {
  meta: DocumentMeta;
  designSystem: DesignSystem;
  requirements: RequirementDoc[];
  pages: Page[];
  /** Collaboration-lite review comments pinned to frames. */
  comments: FrameComment[];
  /** User-journey maps (persona × stages with emotion curve). */
  journeys: JourneyMap[];
}
