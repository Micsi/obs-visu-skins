// I4 (#7) — TDD für die sensor- + scene-Kacheln des Ionic-Skins.
// Belegt: reine Renderer-Funktionen liefern für die Vertrags-Fixtures eine
// nicht-leere, korrekte VNode-Struktur (Form/Slots/data-action) und halten die
// Goldenen Regeln ein (sensor = reine Anzeige ⇒ keine data-action; scene emittiert
// nur die kanonische Aktion activateScene über data-action, kein eigener State).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { Ctx, Device, SceneDevice, SensorDevice, Tokens } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { SensorTile } from "../src/tiles/Sensor.js";
import { SceneTile } from "../src/tiles/Scene.js";

/** Minimaler Tokens-Stub — deterministische, prüfbare Rückgaben. */
const tokens: Tokens = {
  accent: (token) => `--acc-${token}`,
  accentInk: (token) => `--ink-${token}`,
  font: "Manrope",
  space: (step) => `${step * 4}px`,
};

/** Minimaler Ctx-Stub — nf/warn/icon/hyphenate; ctx.t optional (hier weggelassen ⇒ Fallback). */
const makeCtx = (over: Partial<Ctx> = {}): Ctx => ({
  stateText: () => "",
  hyphenate: (s) => s,
  icon: (_d, slot) => slot,
  nf: (v) => String(v),
  warn: () => false,
  ...over,
});

/** Rekursiv alle Kinder-VNodes einsammeln (children kann String | Array | VNode sein). */
function flatten(node: unknown, acc: VNode[] = []): VNode[] {
  if (isVNode(node)) {
    acc.push(node);
    const kids = (node as VNode).children;
    if (Array.isArray(kids)) kids.forEach((k) => flatten(k, acc));
  }
  return acc;
}

/** Sucht den ersten VNode, dessen props ein bestimmtes Attribut tragen. */
function findByProp(root: unknown, key: string, value?: string): VNode | undefined {
  return flatten(root).find((n) => {
    const p = (n.props ?? {}) as Record<string, unknown>;
    return key in p && (value === undefined || p[key] === value);
  });
}

const sensorFx = fixtures.sensor as Record<"ok" | "warn", Omit<SensorDevice, "type">>;
const sceneFx = fixtures.scene as Record<"film" | "morgen", Omit<SceneDevice, "type">>;

const asSensor = (raw: Omit<SensorDevice, "type">): Device => ({ type: "sensor", ...raw }) as Device;
const asScene = (raw: Omit<SceneDevice, "type">): Device => ({ type: "scene", ...raw }) as Device;

describe("ionic sensor tile (I4 #7) — reine Anzeige", () => {
  it("rendert für die ok-Fixture eine nicht-leere VNode-Kachel mit Wert + Einheit", () => {
    const ctx = makeCtx();
    const vnode = SensorTile(asSensor(sensorFx.ok), tokens, ctx) as VNode;
    expect(isVNode(vnode)).toBe(true);
    expect(vnode.type).toBe("div");

    const all = flatten(vnode);
    expect(all.length).toBeGreaterThan(1);

    const num = all.find((n) => (n.props as Record<string, unknown>)?.class === "vz-num l");
    expect(num?.children).toBe("20.4");

    const unit = all.find((n) => (n.props as Record<string, unknown>)?.class === "vz-unit");
    expect(unit?.children).toBe("°C");
  });

  it("formatiert den Wert über ctx.nf", () => {
    const nf = (v: number | string) => `NF(${v})`;
    const vnode = SensorTile(asSensor(sensorFx.warn), tokens, makeCtx({ nf })) as VNode;
    const num = flatten(vnode).find((n) => (n.props as Record<string, unknown>)?.class === "vz-num l");
    expect(num?.children).toBe("NF(287)");
  });

  it("zeigt den Status-Fuß und markiert erhöhte Werte über ctx.warn (is-warn)", () => {
    const vnode = SensorTile(asSensor(sensorFx.warn), tokens, makeCtx({ warn: () => true })) as VNode;
    const cls = vnode.props?.class as unknown[];
    expect(cls).toContain("is-warn");

    const status = flatten(vnode).find((n) => {
      const c = (n.props as Record<string, unknown>)?.class;
      return typeof c === "string" && c.includes("vz-status");
    });
    expect(status).toBeDefined();
    expect(status?.children).toBe("erhöht");
    expect((status?.props as Record<string, unknown>).class).toContain("is-warn");
  });

  it("ist reine Anzeige: KEINE data-action irgendwo (Goldene Regel — actions [])", () => {
    const vnode = SensorTile(asSensor(sensorFx.ok), tokens, makeCtx()) as VNode;
    expect(findByProp(vnode, "data-action")).toBeUndefined();
  });
});

describe("ionic scene tile (I4 #7) — Icon-Slot + activateScene", () => {
  it("rendert eine nicht-leere VNode-Kachel mit Icon-Slot + Untertitel", () => {
    const vnode = SceneTile(asScene(sceneFx.film), tokens, makeCtx()) as VNode;
    expect(isVNode(vnode)).toBe(true);

    const icon = flatten(vnode).find((n) => (n.props as Record<string, unknown>)?.class === "vz-scene-icon");
    expect(icon).toBeDefined();
    // The icon body is injected as <svg> innerHTML (not a raw text child — that
    // was the "<polyline …" leak). The ctx.icon stub returns the slot; the film
    // fixture uses 'sparkle'.
    const svg = flatten(vnode).find((n) => n.type === "svg");
    expect((svg?.props as Record<string, unknown>)?.innerHTML).toBe("sparkle");

    const sub = flatten(vnode).find((n) => (n.props as Record<string, unknown>)?.class === "vz-sub");
    expect(sub?.children).toBe("Licht · Rollladen · TV");
  });

  it("emittiert die kanonische Aktion über data-action=activateScene und deklariert den 600-ms-Flash", () => {
    const vnode = SceneTile(asScene(sceneFx.morgen), tokens, makeCtx()) as VNode;
    const action = findByProp(vnode, "data-action", "activateScene");
    expect(action).toBeDefined();
    expect((action?.props as Record<string, unknown>)["data-flash-ms"]).toBe("600");
    expect((action?.props as Record<string, unknown>).role).toBe("button");
  });

  it("löst Locale-Keys über ctx.t auf, mit Fallback wenn ctx.t fehlt", () => {
    // The accessible name names the scene (room · label) so multiple scene tiles do
    // not collapse to the same a11y label; the action verb still comes from ctx.t.
    const withT = SceneTile(asScene(sceneFx.film), tokens, makeCtx({ t: (k) => `T:${k}` })) as VNode;
    expect((withT.props as Record<string, unknown>)["aria-label"]).toBe(
      "T:skin.ionic.scene.activate: Szenen · Filmabend",
    );

    const noT = SceneTile(asScene(sceneFx.film), tokens, makeCtx()) as VNode;
    expect((noT.props as Record<string, unknown>)["aria-label"]).toBe(
      "Szene aktivieren: Szenen · Filmabend",
    );
  });
});
