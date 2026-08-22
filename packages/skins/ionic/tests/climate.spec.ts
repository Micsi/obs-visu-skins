// v1.4 · TDD für die climate-Renderer (Kachel + Detail) des Ionic-Skins.
// Belegt: reine Renderer-Funktionen liefern für die Vertrags-Fixtures eine
// korrekt geformte VNode-Struktur (SOLL-Zahl, Caption, Fuß=stateText) und halten
// die Goldenen Regeln ein (Kachel = openDetail ohne Core-Write; das Detail markiert
// die kanonische Aktion setSetpoint; kein State/keine Mutation im Skin).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { ClimateDevice, Ctx, Tokens } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { climateTile } from "../src/tiles/ClimateTile.js";
import { climateDetail } from "../src/details/ClimateDetail.js";

const tokens: Tokens = {
  accent: (token) => `var(--acc-${token})`,
  accentInk: (token) => `var(--ink-${token})`,
  font: "Manrope",
  space: (step) => `${step * 4}px`,
};

const MODE_DE: Record<ClimateDevice["mode"], string> = {
  heat: "Heizen",
  cool: "Kühlen",
  off: "Aus",
  auto: "Auto",
};

const ctx: Ctx = {
  stateText: (d) => (d.type === "climate" ? `${MODE_DE[d.mode]} — ${d.current}°` : ""),
  stateParts: (d) => ({ word: ctx.stateText(d), rest: "" }),
  hyphenate: (s) => s,
  icon: (_d, slot) => `body:${slot}`,
  nf: (v) => String(v),
  warn: () => false,
};

const F = fixtures as unknown as { climate: Record<string, Omit<ClimateDevice, "type">> };
const climate = (name: keyof typeof F.climate): ClimateDevice =>
  ({ ...F.climate[name], type: "climate" }) as ClimateDevice;

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
function actions(root: unknown): string[] {
  return flatten(root)
    .map((n) => (n.props ? (n.props["data-action"] as string | undefined) : undefined))
    .filter((a): a is string => typeof a === "string");
}
function classTokens(n: VNode | undefined): string[] {
  const c = n?.props?.class;
  if (typeof c === "string") return c.split(/\s+/).filter(Boolean);
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === "string");
  return [];
}
function nodeOfClass(root: unknown, cls: string): VNode | undefined {
  return flatten(root).find((n) => classTokens(n).includes(cls));
}
function textOfClass(root: unknown, cls: string): string | undefined {
  const hit = nodeOfClass(root, cls);
  return hit && typeof hit.children === "string" ? hit.children : undefined;
}
function textUnder(root: unknown, cls: string): string {
  const hit = nodeOfClass(root, cls);
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") parts.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (isVNode(n)) walk(n.children);
  };
  if (hit) walk(hit.children);
  return parts.join("");
}

/* ============================== CLIMATE TILE ============================== */

describe("climateTile (v1.4)", () => {
  it("renders a non-empty vz-tile--climate VNode for every climate fixture", () => {
    for (const name of Object.keys(F.climate) as (keyof typeof F.climate)[]) {
      const vnode = climateTile(climate(name), tokens, ctx);
      expect(isVNode(vnode)).toBe(true);
      const root = vnode as VNode;
      expect(root.type).toBe("div");
      expect(classTokens(root)).toContain("vz-tile");
      expect(classTokens(root)).toContain("vz-tile--climate");
    }
  });

  it("shows the setpoint (ctx.nf) + unit big, with the accent SOLL caption", () => {
    const root = climateTile(climate("heat"), tokens, ctx);
    expect(textOfClass(root, "vz-climate-num")).toBe("21.5"); // ctx.nf stub is identity
    expect(textOfClass(root, "vz-climate-unit")).toBe("°C");
    // fallback (no ctx.t) → "Soll" rendered uppercase via CSS
    expect(textOfClass(root, "vz-climate-soll")).toBe("Soll");
  });

  it("puts the centralised state text in the foot (mode + current temp)", () => {
    const dev = climate("heat");
    const root = climateTile(dev, tokens, ctx);
    expect(textOfClass(root, "vz-tile-foot")).toBe(ctx.stateText(dev));
  });

  it("is display-only: opens the detail, never writes state on the tile", () => {
    const acts = actions(climateTile(climate("heat"), tokens, ctx));
    expect(acts).toContain("openDetail");
    expect(acts).not.toContain("setSetpoint");
    const root = climateTile(climate("heat"), tokens, ctx) as VNode;
    expect(root.props?.role).toBe("button");
  });

  it("resolves the SOLL caption via ctx.t when a translator is present", () => {
    const withT: Ctx = { ...ctx, t: (k) => `T:${k}` };
    const root = climateTile(climate("heat"), tokens, withT);
    expect(textOfClass(root, "vz-climate-soll")).toBe("T:skin.ionic.climate.setpointShort");
  });
});

/* ============================= CLIMATE DETAIL ============================ */

describe("climateDetail (v1.4)", () => {
  it("renders a vz-dialog[data-type=climate] with a setpoint stepper + slider", () => {
    const root = climateDetail(climate("heat"), tokens, ctx) as VNode;
    expect(isVNode(root)).toBe(true);
    expect(classTokens(root)).toContain("vz-dialog");
    expect(root.props?.["data-type"]).toBe("climate");
    // range slider present
    const range = flatten(root).find((n) => n.type === "input");
    expect(range?.props?.type).toBe("range");
    expect(range?.props?.value).toBe(21.5);
  });

  it("dispatches the canonical setSetpoint action (relative steps + slider)", () => {
    const root = climateDetail(climate("heat"), tokens, ctx);
    const acts = actions(root);
    // two stepper buttons + the slider ⇒ at least three setSetpoint markers
    expect(acts.filter((a) => a === "setSetpoint").length).toBeGreaterThanOrEqual(3);
    expect(acts).toContain("close");
    // the − / + steppers are relative deltas
    const steppers = flatten(root).filter(
      (n) => n.props?.["data-action"] === "setSetpoint" && n.props?.["data-relative"] === "1",
    );
    expect(steppers.length).toBe(2);
    const args = steppers.map((n) => Number(n.props?.["data-arg"])).sort((a, b) => a - b);
    expect(args).toEqual([-0.5, 0.5]);
  });

  it("shows the current temperature and the operating mode label", () => {
    const dev = climate("heat");
    const root = climateDetail(dev, tokens, ctx);
    expect(textUnder(root, "vz-climate-info")).toContain("20.4"); // current via ctx.nf stub
    expect(textOfClass(root, "vz-climate-mode")).toBe("Heizen");
  });

  it("does not glow the hero thermometer when the mode is off", () => {
    const root = climateDetail(climate("off"), tokens, ctx);
    const hero = nodeOfClass(root, "vz-hero");
    const svg = flatten(hero).find((n) => n.type === "svg");
    expect(String(svg?.props?.style)).toContain("--vz-fg-mute");
    expect(String(svg?.props?.style)).not.toContain("drop-shadow");
  });

  it("does not mutate the input device (golden rule 4)", () => {
    const dev = climate("heat");
    const snapshot = JSON.stringify(dev);
    climateDetail(dev, tokens, ctx);
    climateTile(dev, tokens, ctx);
    expect(JSON.stringify(dev)).toBe(snapshot);
  });
});
