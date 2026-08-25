// v1.4 · Unit-Tests für die geteilten Fuß-/Crumb-Bausteine (src/parts.ts).
// Belegt die Invariante des „fetten Fußes" (word+rest === stateText, Wort im <b>)
// sowie beide Zweige des Crumb-Pfads (mit/ohne DeviceBase.floor).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { ClimateDevice, Ctx, Device, LightDevice } from "@obs/visu-contract";
import { stateFoot, crumbPath } from "../src/parts.js";
import { ctxStub } from "./_vnode.js";

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
