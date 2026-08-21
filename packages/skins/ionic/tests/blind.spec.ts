// I3 — blind (Rollladen) tile + detail renderer tests against the contract fixtures.
// Verifies non-empty, correctly shaped VNode trees: structure, slots, data-action.

import { describe, expect, it } from "vitest";
import type { BlindDevice } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { blindTile } from "../src/tiles/BlindTile.js";
import { blindDetail } from "../src/details/BlindDetail.js";
import { actions, classOf, find, findAll, text, tokensStub, ctxStub } from "./_vnode.js";

type Fx = "open" | "half" | "locked";
const blindFx =
  (fixtures as unknown as Record<string, Record<string, Record<string, unknown>>>).blind ?? {};
const dev = (fx: Fx): BlindDevice =>
  ({ type: "blind", accent: "orange", ...(blindFx[fx] as object) }) as BlindDevice;

describe("blind tile", () => {
  it("renders a non-empty tile for every fixture", () => {
    for (const fx of ["open", "half", "locked"] as Fx[]) {
      const v = blindTile(dev(fx), tokensStub, ctxStub());
      expect(v.type).toBe("div");
      expect(classOf(v)).toContain("vz-tile");
      expect(classOf(v)).toContain("blind");
    }
  });

  it("shows room, label and position % in the foot", () => {
    const v = blindTile(dev("half"), tokensStub, ctxStub());
    expect(text(find(v, "div", "vz-eyebrow"))).toBe("EG Schlafz.");
    expect(text(find(v, "div", "vz-label"))).toContain("Rollladen Süd");
    expect(text(find(v, "div", "vz-tile-foot"))).toContain("62");
    expect(text(find(v, "div", "vz-tile-foot"))).toContain("Teil");
  });

  it("is a pure display tile (Vorlage): glyph + foot, opens the detail, no on-tile stepper", () => {
    const v = blindTile(dev("half"), tokensStub, ctxStub());
    // Design-System-Vorlage „Rollladen (Slider, Lock)": keine Chevron-Stepper auf
    // der Kachel — der Rollladen-Glyph zeigt die Position, Bedienung liegt im Detail.
    expect(findAll(v, "button", "vz-chev")).toHaveLength(0);
    expect(find(v, "svg", "vz-blind-svg")).toBeDefined();
    // Tap/Long-press öffnet das Detail; keine Ganzfahrt-/setPosition-Intents auf der Kachel.
    expect(v.props?.["data-action"]).toBe("openDetail");
    expect(actions(v)).not.toContain("setPosition");
  });

  it("open=Offen, locked=Zu in the foot label", () => {
    expect(
      text(find(blindTile(dev("open"), tokensStub, ctxStub()), "div", "vz-tile-foot")),
    ).toContain("Offen");
    expect(
      text(find(blindTile(dev("locked"), tokensStub, ctxStub()), "div", "vz-tile-foot")),
    ).toContain("Zu");
  });

  it("locked shows lock icon + veil but still opens the detail (where unlock lives)", () => {
    const v = blindTile(dev("locked"), tokensStub, ctxStub());
    expect(classOf(v)).toContain("locked");
    expect(find(v, "span", "vz-lockveil")).toBeDefined();
    expect(find(v, "span", "vz-lock")).toBeDefined();
    // openDetail bleibt erreichbar (Detail entsperrt), aber kein Bewegungs-Intent leakt.
    expect(actions(v)).toContain("openDetail");
    expect(actions(v)).not.toContain("setPosition");
  });

  it("uses the host translator for skin strings when present", () => {
    const v = blindTile(
      dev("open"),
      tokensStub,
      ctxStub({ t: (k) => (k === "skin.ionic.blind.posOpen" ? "Auf!" : k) }),
    );
    expect(text(find(v, "div", "vz-tile-foot"))).toContain("Auf!");
  });
});

describe("blind detail", () => {
  it("renders position slider, action grid, presets and lock toggle", () => {
    const v = blindDetail(dev("half"), tokensStub, ctxStub());
    expect(classOf(v)).toContain("vz-dialog");
    const range = find(v, "input", "vz-range");
    expect(range?.props?.["data-action"]).toBe("setPosition");
    expect(range?.props?.value).toBe(62);
    // action grid: open(0), close(100), stop, two relative steps
    const acts = actions(v);
    expect(acts).toContain("setPosition");
    expect(acts).toContain("stop");
    expect(acts).toContain("close");
    // presets
    expect(findAll(v, "button", "vz-preset")).toHaveLength(3);
  });

  it("unlocked detail offers lock; locked detail offers unlock", () => {
    expect(actions(blindDetail(dev("half"), tokensStub, ctxStub()))).toContain("lock");
    expect(actions(blindDetail(dev("locked"), tokensStub, ctxStub()))).toContain("unlock");
  });
});
