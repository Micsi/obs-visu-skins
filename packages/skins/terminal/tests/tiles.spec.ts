// TE2 · #11 — die Terminal-Listen-Renderer (eine Zeile pro Gerät).
//
// Beleg gegen die Vertrags-Fixtures: jeder der neun Kern-Typen × jeder Zustand
// erzeugt ein nicht-leeres VNode; die markierten `data-action`s decken sich EXAKT
// mit dem, was manifest.json verdrahtet (nicht verdrahtete Aktionen werden nie
// vorgetäuscht); Sperre und `writable === false` nehmen den Knöpfen die Aktion.
// Reine Funktionen, kein State — geprüft wird Form, nicht Verhalten.

import { describe, expect, it } from "vitest";
import { isVNode } from "vue";
import type { Ctx, Device, SkinManifest, WidgetAction } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import manifest from "../manifest.json" with { type: "json" };

import { tiles } from "../renderers.js";
import { actions, args, find, findAll, text, tokensStub, ctxStub } from "./_vnode.js";

const m = manifest as unknown as SkinManifest;
const t = tokensStub;

/** Host-/UI-Aktionen brauchen laut Vertrag §6 keine Manifest-Deklaration. */
const HOST_ACTIONS = new Set(["openDetail", "close"]);

/**
 * Ctx-Stub mit echten Zustandstexten — der Host liefert sie im Betrieb zentral.
 * `stateParts` wird daraus abgeleitet (Wort + Rest), wie es v1.4 vorsieht.
 */
function ctxWithState(overrides: Partial<Ctx> = {}): Ctx {
  const stateText = (d: Device): string => {
    if (d.type === "light") return d.on ? (d.dim === null ? "Ein" : `Ein — ${d.dim} %`) : "Aus";
    if (d.type === "switch") return d.on ? "Ein" : "Aus";
    return "";
  };
  return ctxStub({
    stateText,
    stateParts: (d) => {
      const s = stateText(d);
      const cut = s.indexOf(" ");
      return cut === -1 ? { word: s, rest: "" } : { word: s.slice(0, cut), rest: s.slice(cut) };
    },
    ...overrides,
  });
}

const ctx = ctxWithState();

type FixtureMap = Record<string, Record<string, Record<string, unknown>>>;
const F = fixtures as unknown as FixtureMap;

const CORE_TYPES = Object.keys(m.widgets) as (keyof typeof tiles)[];

function dev(type: string, state: string): Device {
  return { ...F[type]![state], type, id: `${type}.${state}` } as unknown as Device;
}

function render(type: string, state: string, c: Ctx = ctx): unknown {
  const fn = tiles[type as keyof typeof tiles];
  expect(fn, `renderer for ${type}`).toBeTypeOf("function");
  return fn!(dev(type, state), t, c);
}

/* ------------------------------------------------------------------ generic */

describe("terminal tiles map", () => {
  it("verdrahtet einen Renderer für alle neun Kern-Typen", () => {
    expect(Object.keys(tiles).sort()).toEqual([
      "blind",
      "camera",
      "climate",
      "jalousie",
      "light",
      "media",
      "scene",
      "sensor",
      "switch",
    ]);
  });

  it("rendert für jeden Typ × Zustand eine nicht-leere Zeile mit Raum und Label", () => {
    for (const type of CORE_TYPES) {
      for (const state of Object.keys(F[type]!)) {
        const vnode = render(type, state);
        expect(isVNode(vnode)).toBe(true);
        const body = text(vnode);
        expect(body).toContain(F[type]![state]!.room);
        expect(body).toContain(F[type]![state]!.label);
      }
    }
  });
});

/* ------------------------------------- Goldene Regel 3 / Issue #11: Ehrlichkeit */

describe("nur verdrahtete Aktionen — nichts wird vorgetäuscht", () => {
  it("markiert nie eine Aktion, die das Manifest nicht deklariert", () => {
    for (const type of CORE_TYPES) {
      const declared = new Set<string>(m.widgets[type]?.actions ?? []);
      for (const state of Object.keys(F[type]!)) {
        for (const a of actions(render(type, state))) {
          if (HOST_ACTIONS.has(a)) continue;
          expect(declared, `${type}.${state} → ${a}`).toContain(a);
        }
      }
    }
  });

  it("belegt jede deklarierte Aktion mit mindestens einem Fixture-Zustand", () => {
    for (const type of CORE_TYPES) {
      const seen = new Set<string>();
      for (const state of Object.keys(F[type]!)) {
        for (const a of actions(render(type, state))) seen.add(a);
      }
      for (const a of (m.widgets[type]?.actions ?? []) as WidgetAction[]) {
        expect(seen, `${type} deklariert ${a}, markiert es aber nie`).toContain(a);
      }
    }
  });

  it("nimmt gesperrten Geräten das Verfahren und bietet unlock", () => {
    for (const type of ["blind", "jalousie"]) {
      const acts = actions(render(type, "locked"));
      expect(acts).not.toContain("setPosition");
      expect(acts).not.toContain("applyPreset");
      expect(acts).toEqual(["unlock"]);
    }
  });

  it("nimmt nicht schreibbaren Geräten (v1.5 writable=false) die Aktion", () => {
    // switch.off trägt writable: false in den Vertrags-Fixtures.
    expect(F["switch"]!["off"]!.writable).toBe(false);
    expect(actions(render("switch", "off"))).toEqual([]);
    expect(actions(render("switch", "on"))).toEqual(["toggle"]);
  });
});

/* ------------------------------------------------- typ-spezifische Zeilenform */

describe("light", () => {
  it("zeigt die Helligkeit als Block-Bar, bietet sie aber nicht an", () => {
    const vnode = render("light", "dimmed");
    expect(find(vnode, "span", "t-bar")).toBeDefined();
    expect(actions(vnode)).toEqual(["toggle"]);
    expect(actions(vnode)).not.toContain("setDim");
    expect(text(vnode)).toContain("Ein");
  });

  it("lässt die Bar weg, wenn das Licht nicht dimmbar ist", () => {
    expect(F["light"]!["on"]!.dim).toBeNull();
    expect(find(render("light", "on"), "span", "t-bar")).toBeUndefined();
  });
});

describe("blind / jalousie", () => {
  it("zeigt Position als Block-Bar und bietet auf/zu plus Presets (v1.6)", () => {
    const vnode = render("blind", "half");
    expect(find(vnode, "span", "t-bar")).toBeDefined();
    const acts = actions(vnode);
    expect(acts).toContain("setPosition");
    expect(acts).toContain("applyPreset");
    expect(acts).toContain("lock");
    // auf=0, zu=100 plus je ein Preset-Index
    expect(args(vnode)).toContain("0");
    expect(args(vnode)).toContain("100");
  });

  it("zeigt die Lamelle nur an — setSlat wird nie markiert", () => {
    for (const state of Object.keys(F["jalousie"]!)) {
      expect(actions(render("jalousie", state))).not.toContain("setSlat");
    }
    expect(text(render("jalousie", "tilted"))).toContain("Lamelle");
  });
});

describe("sensor", () => {
  it("bleibt read-only und zeigt Verlauf als Inline-Sparkline plus min/max (v1.4)", () => {
    for (const state of Object.keys(F["sensor"]!)) {
      expect(actions(render("sensor", state))).toEqual([]);
    }
    const warn = render("sensor", "warn");
    expect(find(warn, "span", "t-spark")).toBeDefined();
    expect(text(warn)).toContain("min");
    expect(text(warn)).toContain("max");
    // Fixture ohne series → keine Sparkline (additiv, ignorierbar).
    expect(find(render("sensor", "ok"), "span", "t-spark")).toBeUndefined();
  });

  it("markiert die Zeile als Warnung, wenn ctx.warn anschlägt", () => {
    const vnode = render("sensor", "warn", ctxWithState({ warn: () => true })) as {
      props: { class: unknown[] };
    };
    expect(vnode.props.class).toContain("is-warn");
  });
});

describe("media", () => {
  it("bietet den Transport, zeigt den Pegel aber nur an", () => {
    const vnode = render("media", "playing");
    expect(actions(vnode).sort()).toEqual(["next", "playPause", "previous", "stop"]);
    expect(actions(vnode)).not.toContain("setVolume");
    expect(find(vnode, "span", "t-bar")).toBeDefined();
    expect(text(vnode)).toContain("Sunset Drive");
  });

  it("kommt mit leerem Transport (stopped, title=null) zurecht", () => {
    expect(isVNode(render("media", "stopped"))).toBe(true);
  });
});

describe("camera", () => {
  it("zeigt Erreichbarkeit und Quelle als Text und bietet refresh", () => {
    const online = render("camera", "online");
    expect(actions(online)).toEqual(["refresh"]);
    expect(text(online)).toContain("online");
    expect(text(online)).toContain("cam.local");

    const offline = render("camera", "offline");
    expect(text(offline)).toContain("offline");
    expect(text(offline)).toContain("kein Bild");
    // refresh bleibt gerade offline sinnvoll bedienbar
    expect(actions(offline)).toEqual(["refresh"]);
  });
});

describe("climate", () => {
  it("zeigt Soll/Ist/Modus und schiebt den Sollwert in 0,5-Schritten", () => {
    const vnode = render("climate", "heat");
    expect(actions(vnode)).toEqual(["setSetpoint", "setSetpoint"]);
    expect(args(vnode)).toEqual(["21", "22"]);
    const body = text(vnode);
    expect(body).toContain("Soll");
    expect(body).toContain("Ist");
    expect(body).toContain("heat");
  });

  it("zeigt den Eyebrow mit Etagenkürzel, wenn der Host eines liefert (v1.8)", () => {
    const withFloor = ctxWithState({ floorShort: () => "EG" });
    expect(text(render("climate", "heat", withFloor))).toContain("EG Wohnz.");
  });
});

/* --------------------------------------------------- golden rule: Reinheit */

describe("Goldene Regel 1/4 — Renderer verändern das Gerät nie", () => {
  it("lässt jede Fixture unangetastet", () => {
    for (const type of CORE_TYPES) {
      for (const state of Object.keys(F[type]!)) {
        const d = dev(type, state);
        const snapshot = JSON.stringify(d);
        tiles[type as keyof typeof tiles]!(d, t, ctx);
        expect(JSON.stringify(d)).toBe(snapshot);
      }
    }
  });

  it("gibt jedem Befehlsknopf ein aria-label", () => {
    for (const type of CORE_TYPES) {
      for (const state of Object.keys(F[type]!)) {
        for (const btn of findAll(render(type, state), "button")) {
          expect(btn.props?.["aria-label"], `${type}.${state}`).toBeTruthy();
        }
      }
    }
  });
});
