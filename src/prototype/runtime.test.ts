import { describe, expect, it } from "vitest";
import {
  applySetVariable,
  conditionMet,
  describeTransition,
  initVars,
  resolveTemplate,
} from "./runtime";
import { Interaction, PrototypeVariable } from "@/schema/types";

const vars: PrototypeVariable[] = [
  { id: "v1", name: "loggedIn", type: "boolean", initial: "false" },
  { id: "v2", name: "username", type: "text", initial: "" },
];

function nav(extra: Partial<Interaction>): Interaction {
  return { id: "a", trigger: "click", targetFrameId: "", ...extra };
}

describe("prototype runtime", () => {
  it("initializes variable state from initial values", () => {
    expect(initVars(vars)).toEqual({ v1: "false", v2: "" });
    expect(initVars()).toEqual({});
  });

  it("evaluates conditions against current state", () => {
    const state = { v1: "true", v2: "" };
    expect(conditionMet(nav({ condition: { variableId: "v1", equals: "true" } }), state)).toBe(true);
    expect(conditionMet(nav({ condition: { variableId: "v1", equals: "false" } }), state)).toBe(false);
    expect(conditionMet(nav({}), state)).toBe(true); // no condition => always
  });

  it("sets and toggles variables", () => {
    const it = nav({ action: "set-variable", variableId: "v2", variableValue: "hi" });
    expect(applySetVariable(it, { v2: "" }).v2).toBe("hi");
    const toggle = nav({ action: "set-variable", variableId: "v1", variableValue: "!toggle" });
    expect(applySetVariable(toggle, { v1: "false" }).v1).toBe("true");
    expect(applySetVariable(toggle, { v1: "true" }).v1).toBe("false");
  });

  it("does not mutate state when action is not set-variable", () => {
    const it = nav({ action: "navigate" });
    const state = { v1: "false" };
    expect(applySetVariable(it, state)).toBe(state);
  });

  it("resolves {{variable}} templates by variable name", () => {
    const state = { v1: "true", v2: "Charles" };
    expect(resolveTemplate("你好 {{username}}!", state, vars)).toBe("你好 Charles!");
    expect(resolveTemplate("no tokens", state, vars)).toBe("no tokens");
    expect(resolveTemplate("{{missing}}", state, vars)).toBe("{{missing}}");
  });

  it("describes transitions with defaults and dual-frame push", () => {
    const fade = describeTransition("fade");
    expect(fade.enter).toBe("gpo-fade-in");
    expect(fade.durationMs).toBe(300);
    expect(fade.dual).toBe(false);

    const push = describeTransition("push-left", 500, "ease-in-out");
    expect(push.exit).toBe("gpo-push-out-left");
    expect(push.dual).toBe(true);
    expect(push.durationMs).toBe(500);
    expect(push.easing).toBe("ease-in-out");

    expect(describeTransition("none").enter).toBe("");
  });
});
