// v1.4 · Unit-Tests für die geteilten Fuß-/Crumb-Bausteine (src/parts.ts).
// Belegt die Invariante des „fetten Fußes" (word+rest === stateText, Wort im <b>)
// sowie beide Zweige des Crumb-Pfads (mit/ohne DeviceBase.floor).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { ClimateDevice, Ctx, Device, LightDevice } from "@obs/visu-contract";
import { stateFoot, crumbPath, dialogHead, eyebrowText } from "../src/parts.js";
import { classOf, ctxStub, find, text } from "./_vnode.js";

const light = (dim: number | null, on: boolean): LightDevice =>
  ({ type: "light", room: "Bad", label: "Spot", accent: "orange", on, dim }) as LightDevice;

/** Konkatenierter Text eines VNode-/String-Baums. */
function textOf(nodes: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === "string") parts.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (isVNode(n)) walk((n as VNode).children as unknown);
  };
  walk(nodes);
  return parts.join("");
}

describe("stateFoot — fetter Fuß", () => {
  const ctx: Ctx = ctxStub({
    stateText: () => "Ein — 45 %",
    stateParts: () => ({ word: "Ein", rest: " — 45 %" }),
  });

  it("rendert das Zustandswort im <b> und den Rest als Textknoten", () => {
    const out = stateFoot(ctx, light(45, true));
    const b = out.find((n) => isVNode(n) && (n as VNode).type === "b") as VNode | undefined;
    expect(b).toBeDefined();
    expect(b?.children).toBe("Ein");
    // Invariante: sichtbarer Gesamttext == stateText
    expect(textOf(out)).toBe(ctx.stateText(light(45, true)));
  });

  it("lässt einen leeren Rest weg (nur fettes Wort)", () => {
    const plain: Ctx = ctxStub({
      stateText: () => "Aus",
      stateParts: () => ({ word: "Aus", rest: "" }),
    });
    const out = stateFoot(plain, light(null, false));
    expect(out).toHaveLength(1);
    expect(textOf(out)).toBe("Aus");
  });
});

describe("crumbPath — Detail-Kopf-Breadcrumb", () => {
  it("zeigt floor / room, wenn DeviceBase.floor gesetzt ist", () => {
    const dev = {
      type: "climate",
      floor: "Erdgeschoss",
      room: "Wohnz.",
      label: "Heizung",
      accent: "orange",
      setpoint: 21.5,
      current: 20.4,
      mode: "heat",
      unit: "°C",
    } as ClimateDevice;
    expect(crumbPath(dev)).toBe("Erdgeschoss / Wohnz.");
  });

  it("degradiert ohne floor auf den reinen Raum", () => {
    const dev = light(null, false) as Device;
    expect(crumbPath(dev)).toBe("Bad");
  });
});

describe("eyebrowText — Etagenkürzel + Raum (Vorlage: „EG KÜCHE“)", () => {
  it("stellt das Host-Kürzel (ctx.floorShort) dem Raum voran, space-getrennt", () => {
    // Uppercase kommt aus dem CSS (text-transform), nicht aus dem Renderer.
    const ctx: Ctx = ctxStub({ floorShort: () => "EG" });
    expect(eyebrowText(ctx, light(null, false))).toBe("EG Bad");
  });

  it("degradiert ohne Kürzel auf den reinen Raum – kein führendes Leerzeichen", () => {
    const ctx: Ctx = ctxStub({ floorShort: () => "" });
    expect(eyebrowText(ctx, light(null, false))).toBe("Bad");
  });
});

describe("dialogHead — geteilter Detail-Kopf (3-Spalten-Grid)", () => {
  const dev = light(45, true) as Device;

  it("baut Crumb-Zelle, zentrierte Titel-Zelle (Titel+Wert im titlewrap) und Schließen-Button", () => {
    const head = dialogHead(ctxStub(), dev, "45 %");
    expect(classOf(find(head, "div", "vz-dialog-head"))).toContain("vz-dialog-head");
    // Crumb-Zelle
    expect(text(find(head, "div", "vz-dialog-crumb"))).toBe("Bad");
    // Titel und Wert liegen gemeinsam in der zentrierten titlewrap-Zelle
    const wrap = find(head, "div", "vz-dialog-titlewrap");
    expect(wrap).toBeDefined();
    expect(text(find(wrap, "h2", "vz-dialog-title"))).toBe("Spot");
    expect(text(find(wrap, "div", "vz-dialog-val"))).toBe("45 %");
    // Schließen-Button rechts (Navigation, kein Core-Write)
    const close = find(head, "button", "vz-iconbtn");
    expect(close?.props?.["data-action"]).toBe("close");
  });

  it("lässt die Wert-Zeile weg, wenn kein Wert übergeben wird (z. B. Switch)", () => {
    const head = dialogHead(ctxStub(), dev);
    expect(find(head, "div", "vz-dialog-titlewrap")).toBeDefined();
    expect(find(head, "div", "vz-dialog-val")).toBeUndefined();
  });
});
