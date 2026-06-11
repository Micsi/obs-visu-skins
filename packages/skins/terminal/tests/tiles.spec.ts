// TE2 · #11 — TDD für die Terminal-Listen-Renderer (eine Zeile pro Gerät).
//
// Beleg gegen die Vertrags-Fixtures: jeder Typ × Zustand erzeugt ein nicht-leeres
// VNode; bedienbare Typen tragen die korrekten partiellen `data-action`s; sensor ist
// read-only (keine Aktion); locked blind/jalousie blockiert das Verfahren. Reine
// Funktionen, kein State — geprüft wird Form, nicht Verhalten.

import { describe, expect, it } from "vitest";
import { isVNode } from "vue";
import type {
  BlindDevice,
  Ctx,
  Device,
  JalousieDevice,
  LightDevice,
  SceneDevice,
  SensorDevice,
  SwitchDevice,
} from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };

import { tiles } from "../renderers.js";
import { actions, args, find, text, tokensStub, ctxStub } from "./_vnode.js";

const t = tokensStub;
const ctx: Ctx = ctxStub({
  stateText: (d: Device) => {
    if (d.type === "light") return d.on ? (d.dim != null ? `Ein — ${d.dim} %` : "Ein") : "Aus";
    if (d.type === "switch") return d.on ? "An" : "Aus";
    return "";
  },
});

const F = fixtures as unknown as {
  light: Record<string, Omit<LightDevice, "type">>;
  switch: Record<string, Omit<SwitchDevice, "type">>;
  blind: Record<string, Omit<BlindDevice, "type">>;
  jalousie: Record<string, Omit<JalousieDevice, "type">>;
  sensor: Record<string, Omit<SensorDevice, "type">>;
  scene: Record<string, Omit<SceneDevice, "type">>;
};

const CORE_TYPES = ["light", "switch", "blind", "jalousie", "sensor", "scene"] as const;

function dev<K extends keyof typeof F>(type: K, name: string): Device {
  return { ...(F[type] as Record<string, object>)[name], type } as unknown as Device;
}

/* ------------------------------------------------------------------ generic */

describe("terminal tiles map", () => {
  it("wires a renderer for all six core types", () => {
    expect(Object.keys(tiles).sort()).toEqual(
      ["blind", "jalousie", "light", "scene", "sensor", "switch"].sort(),
    );
  });

  it("renders a non-empty t-row VNode for every type × fixture", () => {
    for (const type of CORE_TYPES) {
      for (const name of Object.keys(F[type])) {
        const render = tiles[type as keyof typeof tiles];
        expect(render).toBeTypeOf("function");
        const vnode = render!(dev(type, name), t, ctx);
        expect(isVNode(vnode)).toBe(true);
        // jede Zeile trägt Raum und Label (nicht-leer)
        expect(text(vnode)).toContain(F[type][name]!.room);
        expect(text(vnode)).toContain(F[type][name]!.label);
      }
    }
  });
});

/* -------------------------------------------------------------- light/switch */

describe("light tile", () => {
  it("offers only the canonical toggle action and reflects on-state", () => {
    for (const name of Object.keys(F.light)) {
      const acts = actions(tiles.light!(dev("light", name), t, ctx));
      expect(acts).toEqual(["toggle"]);
    }
    const on = tiles.light!(dev("light", "on"), t, ctx) as { props: Record<string, unknown> };
    expect(on.props["aria-pressed"]).toBe("true");
    const off = tiles.light!(dev("light", "off"), t, ctx) as { props: Record<string, unknown> };
    expect(off.props["aria-pressed"]).toBe("false");
  });

  it("shows the centralised state text", () => {
    const vnode = tiles.light!(dev("light", "dimmed"), t, ctx);
    expect(text(vnode)).toContain("Ein — 45 %");
  });
});

describe("switch tile", () => {
  it("offers only the canonical toggle action", () => {
    for (const name of Object.keys(F.switch)) {
      expect(actions(tiles.switch!(dev("switch", name), t, ctx))).toEqual(["toggle"]);
    }
  });
});

/* ----------------------------------------------------------------- blind */

describe("blind tile", () => {
  it("offers the partial setPosition open/close on unlocked blinds", () => {
    const vnode = tiles.blind!(dev("blind", "open"), t, ctx);
    const acts = actions(vnode);
    expect(acts).toContain("setPosition");
    expect(args(vnode).sort()).toEqual(["0", "100"]);
    // unlocked → bietet `lock`, nie `unlock`
    expect(acts).toContain("lock");
    expect(acts).not.toContain("unlock");
  });

  it("blocks operation when locked and offers unlock instead", () => {
    const vnode = tiles.blind!(dev("blind", "locked"), t, ctx);
    const acts = actions(vnode);
    // gesperrt: kein Verfahren
    expect(acts).not.toContain("setPosition");
    // stattdessen die kanonische unlock-Aktion
    expect(acts).toEqual(["unlock"]);
  });

  it("never offers setSlat (not in manifest)", () => {
    for (const name of Object.keys(F.blind)) {
      expect(actions(tiles.blind!(dev("blind", name), t, ctx))).not.toContain("setSlat");
    }
  });
});

/* -------------------------------------------------------------- jalousie */

describe("jalousie tile", () => {
  it("offers setPosition open/close but NEVER setSlat (honestly partial)", () => {
    const vnode = tiles.jalousie!(dev("jalousie", "open"), t, ctx);
    const acts = actions(vnode);
    expect(acts).toContain("setPosition");
    expect(acts).not.toContain("setSlat");
    expect(args(vnode).sort()).toEqual(["0", "100"]);
    expect(acts).toContain("lock");
  });

  it("blocks operation when locked and offers unlock instead", () => {
    const vnode = tiles.jalousie!(dev("jalousie", "locked"), t, ctx);
    expect(actions(vnode)).toEqual(["unlock"]);
  });

  it("never offers setSlat in any state", () => {
    for (const name of Object.keys(F.jalousie)) {
      expect(actions(tiles.jalousie!(dev("jalousie", name), t, ctx))).not.toContain("setSlat");
    }
  });
});

/* ---------------------------------------------------------------- sensor */

describe("sensor tile", () => {
  it("is read-only — carries no action at all", () => {
    for (const name of Object.keys(F.sensor)) {
      expect(actions(tiles.sensor!(dev("sensor", name), t, ctx))).toEqual([]);
    }
  });

  it("marks is-warn when ctx.warn flags the reading", () => {
    const warnCtx = ctxStub({ warn: () => true });
    const vnode = tiles.sensor!(dev("sensor", "warn"), t, warnCtx) as {
      props: { class: unknown[] };
    };
    expect(vnode.props.class).toContain("is-warn");
    // Statusbadge ebenfalls als Warnung
    expect(find(vnode, "span", "is-warn")).toBeDefined();
  });
});

/* ----------------------------------------------------------------- scene */

describe("scene tile", () => {
  it("offers only the canonical activateScene action", () => {
    for (const name of Object.keys(F.scene)) {
      expect(actions(tiles.scene!(dev("scene", name), t, ctx))).toEqual(["activateScene"]);
    }
  });
});

/* --------------------------------------------------- golden rule: purity */

describe("golden rule — renderers never mutate the device", () => {
  it("leaves every fixture untouched", () => {
    for (const type of CORE_TYPES) {
      for (const name of Object.keys(F[type])) {
        const d = dev(type, name);
        const snapshot = JSON.stringify(d);
        tiles[type as keyof typeof tiles]!(d, t, ctx);
        expect(JSON.stringify(d)).toBe(snapshot);
      }
    }
  });
});
