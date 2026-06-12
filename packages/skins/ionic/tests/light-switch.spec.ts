// I2 · #5 — TDD für die light/switch-Renderer (Kachel + Detail).
// Beleg: jeder Renderer liefert für die Vertrags-Fixtures eine nicht-leere,
// korrekt geformte VNode-Struktur (Tag/Klassen/Slots/data-action). Reine
// Funktionen, kein State — geprüft wird Form, nicht Verhalten.

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { Ctx, Device, LightDevice, SwitchDevice, Tokens } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { LightTile } from "../src/tiles/LightTile.js";
import { SwitchTile } from "../src/tiles/SwitchTile.js";
import { LightDetail } from "../src/details/LightDetail.js";
import { SwitchDetail } from "../src/details/SwitchDetail.js";

/* ---- Test-Harness: minimaler Tokens-/Ctx-Stub (kein Host nötig) ----------- */

const tokens: Tokens = {
  accent: (token) => `var(--acc-${token})`,
  accentInk: (token) => `var(--ink-${token})`,
  font: "Manrope",
  space: (step) => `${step * 4}px`,
};

const ctx: Ctx = {
  stateText: (d) => {
    if (d.type === "light") return d.on ? (d.dim != null ? `Ein — ${d.dim} %` : "Ein") : "Aus";
    if (d.type === "switch") return d.on ? "An" : "Aus";
    return "";
  },
  hyphenate: (s) => s,
  icon: (_d, slot) => slot,
  nf: (v) => String(v),
  warn: () => false,
};

const F = fixtures as unknown as {
  light: Record<string, Omit<LightDevice, "type">>;
  switch: Record<string, Omit<SwitchDevice, "type">>;
};

function light(name: keyof typeof F.light): LightDevice {
  return { ...F.light[name], type: "light" } as LightDevice;
}
function sw(name: keyof typeof F.switch): SwitchDevice {
  return { ...F.switch[name], type: "switch" } as SwitchDevice;
}

/* ---- VNode-Traversal-Helfer ---------------------------------------------- */

function flatten(node: unknown, acc: VNode[] = []): VNode[] {
  if (Array.isArray(node)) {
    for (const n of node) flatten(n, acc);
    return acc;
  }
  if (isVNode(node)) {
    acc.push(node);
    flatten(node.children as unknown, acc);
  }
  return acc;
}

/** Sammelt alle data-action-Werte im VNode-Baum. */
function actions(root: unknown): string[] {
  return flatten(root)
    .map((n) => (n.props ? (n.props["data-action"] as string | undefined) : undefined))
    .filter((a): a is string => typeof a === "string");
}

/** Existiert irgendwo im Baum ein VNode mit diesem Tag? */
function hasTag(root: unknown, tag: string): boolean {
  return flatten(root).some((n) => n.type === tag);
}

/** Existiert irgendwo im Baum ein VNode mit dieser Klasse? */
function hasClass(root: unknown, cls: string): boolean {
  return flatten(root).some((n) => {
    const c = n.props?.class;
    return Array.isArray(c) ? c.includes(cls) : c === cls;
  });
}

/** Erster Textinhalt unter einer Klasse. */
function textOfClass(root: unknown, cls: string): string | undefined {
  const hit = flatten(root).find((n) => {
    const c = n.props?.class;
    return Array.isArray(c) ? c.includes(cls) : c === cls;
  });
  if (!hit) return undefined;
  return typeof hit.children === "string" ? hit.children : undefined;
}

/* ============================== LIGHT TILE ================================ */

describe("LightTile", () => {
  it("renders a non-empty vz-tile VNode for every light fixture", () => {
    for (const name of Object.keys(F.light) as (keyof typeof F.light)[]) {
      const vnode = LightTile(light(name), tokens, ctx);
      expect(isVNode(vnode)).toBe(true);
      const root = vnode as VNode;
      expect(root.type).toBe("div");
      const cls = root.props?.class as unknown[];
      expect(cls).toContain("vz-tile");
      // Fuß kommt zentral aus ctx.stateText
      expect(textOfClass(root, "vz-tile-foot")).toBe(ctx.stateText(light(name)));
    }
  });

  it("marks the canonical toggle action and reflects on-state", () => {
    expect(actions(LightTile(light("on"), tokens, ctx))).toContain("toggle");
    const onTile = LightTile(light("on"), tokens, ctx) as VNode;
    expect(onTile.props?.class as unknown[]).toContain("is-on");
    const offTile = LightTile(light("off"), tokens, ctx) as VNode;
    expect(offTile.props?.class as unknown[]).not.toContain("is-on");
    expect(offTile.props?.["aria-pressed"]).toBe("false");
  });
});

/* ============================= LIGHT DETAIL ============================== */

describe("LightDetail", () => {
  it("renders an ion-range brightness slider + setDim presets", () => {
    const root = LightDetail(light("dimmed"), tokens, ctx);
    expect(isVNode(root)).toBe(true);
    expect(hasTag(root, "ion-range")).toBe(true);
    // Slider + zwei Schnellaktionen + drei Presets ⇒ mehrfach setDim
    const acts = actions(root);
    expect(acts.filter((a) => a === "setDim").length).toBeGreaterThanOrEqual(5);
  });

  it("derives the slider value from dim (fallback for non-dimmable)", () => {
    const range = flatten(LightDetail(light("on"), tokens, ctx)).find(
      (n) => n.type === "ion-range",
    );
    // light.on hat dim=null → Fallback auf 100 (an)
    expect(range?.props?.value).toBe(100);
    const rangeOff = flatten(LightDetail(light("off"), tokens, ctx)).find(
      (n) => n.type === "ion-range",
    );
    expect(rangeOff?.props?.value).toBe(0);
  });
});

/* ============================== SWITCH TILE =============================== */

describe("SwitchTile", () => {
  it("renders a real ion-toggle for every switch fixture", () => {
    for (const name of Object.keys(F.switch) as (keyof typeof F.switch)[]) {
      const vnode = SwitchTile(sw(name), tokens, ctx);
      expect(isVNode(vnode)).toBe(true);
      expect(hasTag(vnode, "ion-toggle")).toBe(true);
      expect(textOfClass(vnode, "vz-tile-foot")).toBe(ctx.stateText(sw(name)));
    }
  });

  it("toggle reflects on-state and carries the canonical action", () => {
    const onTile = SwitchTile(sw("on"), tokens, ctx);
    const toggle = flatten(onTile).find((n) => n.type === "ion-toggle");
    expect(toggle?.props?.checked).toBe(true);
    expect(toggle?.props?.["data-action"]).toBe("toggle");
    expect(actions(onTile)).toContain("toggle");
  });
});

/* ============================= SWITCH DETAIL ============================= */

describe("SwitchDetail", () => {
  it("renders a fan toggle for every switch fixture (no fabricated telemetry)", () => {
    for (const name of Object.keys(F.switch) as (keyof typeof F.switch)[]) {
      const root = SwitchDetail(sw(name), tokens, ctx);
      expect(isVNode(root)).toBe(true);
      expect(hasTag(root, "ion-toggle")).toBe(true);
      expect(actions(root)).toContain("toggle");
      // SwitchDevice carries no VOC/history in the contract — the detail must not
      // synthesize a chart from hard-coded demo data (the close-button icon svg is
      // fine; the fabricated VOC chart container must be absent).
      expect(hasClass(root, "vz-chart-box")).toBe(false);
    }
  });

  it("does not mutate the input device (golden rule 4)", () => {
    const dev = sw("off");
    const snapshot = JSON.stringify(dev);
    SwitchDetail(dev, tokens, ctx);
    expect(JSON.stringify(dev)).toBe(snapshot);
  });
});

/* generic contract check: renderers accept a Device union without narrowing */
describe("renderer signature conformance", () => {
  it("accepts Device-typed input (pure (d,t,ctx)=>VNode)", () => {
    const d: Device = light("off");
    expect(isVNode(LightTile(d, tokens, ctx))).toBe(true);
  });
});
