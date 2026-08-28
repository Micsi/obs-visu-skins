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
  // Host-Zerlegung nachgebildet: Zustandswort (fett) + gemuteter Rest. Trennung am
  // " — " (z. B. "Ein — 45 %"); ohne Rest ist das ganze stateText das Wort ("An").
  stateParts: (d) => {
    const full = ctx.stateText(d);
    const at = full.indexOf(" — ");
    return at >= 0 ? { word: full.slice(0, at), rest: full.slice(at) } : { word: full, rest: "" };
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

/**
 * Konkatenierter Textinhalt unter einer Klasse — sammelt auch den Text in
 * Kindelementen (z. B. `<b>` im „fetten Fuß"), damit die Invariante `word+rest ===
 * stateText` unabhängig von der DOM-Struktur geprüft wird.
 */
function textOfClass(root: unknown, cls: string): string | undefined {
  const hit = flatten(root).find((n) => {
    const c = n.props?.class;
    return Array.isArray(c) ? c.includes(cls) : c === cls;
  });
  if (!hit) return undefined;
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") parts.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (isVNode(n)) walk((n as VNode).children as unknown);
  };
  walk(hit.children as unknown);
  return parts.join("");
}

/** Der `<b>`-Zustandswort-Knoten im „fetten Fuß" (Vorlage: `<b>Ein</b> — 45 %`). */
function footWord(root: unknown, cls: string): VNode | undefined {
  const foot = flatten(root).find((n) => {
    const c = n.props?.class;
    return Array.isArray(c) ? c.includes(cls) : c === cls;
  });
  return foot ? flatten(foot.children).find((n) => n.type === "b") : undefined;
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
      // Fuß kommt zentral aus ctx.stateParts: fettes Wort + gemuteter Rest, dessen
      // sichtbarer Gesamttext weiterhin ctx.stateText entspricht (Invariante).
      expect(textOfClass(root, "vz-tile-foot")).toBe(ctx.stateText(light(name)));
      const b = footWord(root, "vz-tile-foot");
      expect(b).toBeDefined();
      expect(b?.children).toBe(ctx.stateParts(light(name)).word);
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

/** Klassen-Tokens eines VNode (Vue normalisiert Klassen-Arrays zu Strings). */
function classTokens(n: VNode | undefined): string[] {
  const c = n?.props?.class;
  if (typeof c === "string") return c.split(/\s+/).filter(Boolean);
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === "string");
  return [];
}
/** Erster VNode, dessen Klassen-Tokens `cls` enthalten. */
function nodeOfClass(root: unknown, cls: string): VNode | undefined {
  return flatten(root).find((n) => classTokens(n).includes(cls));
}

describe("SwitchTile", () => {
  it("renders a CSS vz-toggle stellelement (no ion-toggle) for every switch fixture", () => {
    for (const name of Object.keys(F.switch) as (keyof typeof F.switch)[]) {
      const vnode = SwitchTile(sw(name), tokens, ctx);
      expect(isVNode(vnode)).toBe(true);
      // Design-System-Vorlage nutzt das CSS-gezeichnete .vz-toggle, nicht ion-toggle.
      expect(nodeOfClass(vnode, "vz-toggle")).toBeDefined();
      expect(hasTag(vnode, "ion-toggle")).toBe(false);
      expect(textOfClass(vnode, "vz-tile-foot")).toBe(ctx.stateText(sw(name)));
      const b = footWord(vnode, "vz-tile-foot");
      expect(b).toBeDefined();
      expect(b?.children).toBe(ctx.stateParts(sw(name)).word);
    }
  });

  it("toggle reflects on-state and the tile carries the canonical action", () => {
    const onTile = SwitchTile(sw("on"), tokens, ctx) as VNode;
    const onToggle = nodeOfClass(onTile, "vz-toggle");
    expect(classTokens(onToggle)).toContain("on");
    expect(onToggle?.props?.["aria-checked"]).toBe("true");
    expect(classTokens(onTile)).toContain("is-on");
    expect(onTile.props?.["aria-pressed"]).toBe("true");
    // Kanonische Aktion sitzt am Kachel-Wrapper (Button), Toggle ist dekorativ.
    expect(actions(onTile)).toContain("toggle");

    const offTile = SwitchTile(sw("off"), tokens, ctx) as VNode;
    const offToggle = nodeOfClass(offTile, "vz-toggle");
    expect(classTokens(offToggle)).not.toContain("on");
    // Der dekorative Toggle spiegelt den Aus-Zustand weiterhin (aria-checked).
    expect(offToggle?.props?.["aria-checked"]).toBe("false");
    // Die `off`-Fixture ist writable:false (Host-Sperre): keine aktive Button-
    // Semantik (kein aria-pressed) und kein toggle-Intent; sichtbar gesperrt.
    expect(offTile.props?.["aria-pressed"]).toBeUndefined();
    expect(offTile.props?.["aria-disabled"]).toBe("true");
    expect(classTokens(offTile)).toContain("readonly");
    expect(actions(offTile)).not.toContain("toggle");
  });
});

/* ============================= SWITCH DETAIL ============================= */

describe("SwitchDetail", () => {
  it("renders a fan toggle for every switch fixture (no fabricated telemetry)", () => {
    for (const name of Object.keys(F.switch) as (keyof typeof F.switch)[]) {
      const dev = sw(name);
      const root = SwitchDetail(dev, tokens, ctx);
      expect(isVNode(root)).toBe(true);
      expect(hasTag(root, "ion-toggle")).toBe(true);
      // toggle-Intent nur bei bedienbarem Gerät; writable:false (Host-Sperre) rendert
      // das Toggle inert (kein data-action).
      if (dev.writable === false) expect(actions(root)).not.toContain("toggle");
      else expect(actions(root)).toContain("toggle");
      // SwitchDevice carries no VOC/history in the contract — the detail must not
      // synthesize a chart from hard-coded demo data (the close-button icon svg is
      // fine; the fabricated VOC chart container must be absent).
      expect(hasClass(root, "vz-chart-box")).toBe(false);
    }
  });

  it("nutzt den vereinheitlichten 3-Spalten-Kopf (Titel in titlewrap, keine Wert-Zeile)", () => {
    const root = SwitchDetail(sw("off"), tokens, ctx);
    expect(hasClass(root, "vz-dialog-titlewrap")).toBe(true);
    expect(hasClass(root, "vz-dialog-title")).toBe(true);
    // SwitchDevice trägt keinen Wert ⇒ die Wert-Zeile entfällt.
    expect(hasClass(root, "vz-dialog-val")).toBe(false);
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
