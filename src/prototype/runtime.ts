/**
 * Prototype runtime — the engine behind the interactive Preview.
 *
 * Pure, framework-agnostic helpers so the behavior is unit-testable:
 *  - variable state (init / read / write / toggle)
 *  - condition evaluation (gated interactions)
 *  - {{variable}} text templating (dynamic text / form echo)
 *  - transition descriptors (animation + duration + easing)
 */
import { Easing, Interaction, PrototypeVariable, TransitionAnimation } from "@/schema/types";

export type VarState = Record<string, string>;

/** Build the initial variable state from a document's prototype variables. */
export function initVars(vars: PrototypeVariable[] = []): VarState {
  const s: VarState = {};
  for (const v of vars) s[v.id] = v.initial ?? "";
  return s;
}

/** Whether an interaction's optional condition is currently satisfied. */
export function conditionMet(it: Interaction, state: VarState): boolean {
  if (!it.condition) return true;
  return (state[it.condition.variableId] ?? "") === it.condition.equals;
}

/**
 * Apply a "set-variable" interaction to the state and return the next state.
 * A magic value of "!toggle" flips a boolean ("true"<->"false").
 */
export function applySetVariable(it: Interaction, state: VarState): VarState {
  if (it.action !== "set-variable" || !it.variableId) return state;
  let value = it.variableValue ?? "";
  if (value === "!toggle") {
    value = state[it.variableId] === "true" ? "false" : "true";
  }
  return { ...state, [it.variableId]: value };
}

/** Replace {{varName}} tokens in a string with the current variable values. */
export function resolveTemplate(raw: string, state: VarState, vars: PrototypeVariable[]): string {
  if (!raw || raw.indexOf("{{") === -1) return raw;
  return raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, name: string) => {
    const v = vars.find((x) => x.name === name.trim());
    if (!v) return `{{${name}}}`;
    const val = state[v.id] ?? "";
    return val;
  });
}

/** The default duration (ms) used when an interaction omits one. */
export const DEFAULT_DURATION = 300;

export interface TransitionDescriptor {
  /** CSS animation keyframe name for the incoming frame. */
  enter: string;
  /** CSS animation keyframe name for the outgoing frame (empty = no exit anim). */
  exit: string;
  durationMs: number;
  easing: Easing;
  /** Whether both frames are shown simultaneously during the transition. */
  dual: boolean;
}

const ENTER_MAP: Record<TransitionAnimation, string> = {
  none: "",
  fade: "gpo-fade-in",
  dissolve: "gpo-fade-in",
  smart: "gpo-fade-in",
  "slide-left": "gpo-slide-in-left",
  "slide-right": "gpo-slide-in-right",
  "slide-up": "gpo-slide-in-up",
  "slide-down": "gpo-slide-in-down",
  "push-left": "gpo-slide-in-left",
  "push-right": "gpo-slide-in-right",
  cover: "gpo-cover-in",
};

const EXIT_MAP: Partial<Record<TransitionAnimation, string>> = {
  "push-left": "gpo-push-out-left",
  "push-right": "gpo-push-out-right",
};

/** Describe how to animate a transition for the given interaction. */
export function describeTransition(anim: TransitionAnimation | undefined, durationMs?: number, easing?: Easing): TransitionDescriptor {
  const a = anim ?? "none";
  const exit = EXIT_MAP[a] ?? "";
  return {
    enter: ENTER_MAP[a] ?? "",
    exit,
    durationMs: durationMs ?? DEFAULT_DURATION,
    easing: easing ?? "ease-out",
    dual: exit !== "",
  };
}

/** The CSS keyframes the runtime relies on (injected once into preview). */
export const TRANSITION_KEYFRAMES = `
@keyframes gpo-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes gpo-slide-in-left { from { transform: translateX(100%) } to { transform: translateX(0) } }
@keyframes gpo-slide-in-right { from { transform: translateX(-100%) } to { transform: translateX(0) } }
@keyframes gpo-slide-in-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes gpo-slide-in-down { from { transform: translateY(-100%) } to { transform: translateY(0) } }
@keyframes gpo-cover-in { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes gpo-push-out-left { from { transform: translateX(0) } to { transform: translateX(-100%) } }
@keyframes gpo-push-out-right { from { transform: translateX(0) } to { transform: translateX(100%) } }
`;

/** Human-readable label for an interaction action (used in panels). */
export function actionLabel(action: Interaction["action"]): string {
  switch (action ?? "navigate") {
    case "navigate":
      return "跳转页面";
    case "overlay":
      return "打开浮层";
    case "close-overlay":
      return "关闭浮层";
    case "back":
      return "返回上一页";
    case "scroll-to":
      return "滚动到";
    case "external":
      return "外部链接";
    case "set-variable":
      return "设置变量";
    default:
      return "跳转页面";
  }
}

/** Human-readable label for a trigger. */
export function triggerLabel(trigger: Interaction["trigger"]): string {
  switch (trigger) {
    case "click":
      return "点击";
    case "hover":
      return "悬停";
    case "drag":
      return "拖拽";
    case "key":
      return "按键";
    case "delay":
      return "定时";
    default:
      return "点击";
  }
}
