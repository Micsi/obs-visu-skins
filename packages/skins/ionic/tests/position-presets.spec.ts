// v1.6 – position presets renderer tests against the contract fixtures.
// Verifies the generic preset row/popover: one button per configured preset, raw
// fixture labels, applyPreset carrying the INDEX, and locked/non-writable gating
// (no intent leak). blind and jalousie render identically here – only the index counts.

import { describe, expect, it } from "vitest";
import type { BlindDevice, JalousieDevice } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { presetRow, positionPresets } from "../src/presets/PositionPresets.js";
import { actions, classOf, find, findAll, text, tokensStub, ctxStub } from "./_vnode.js";

const fx = fixtures as unknown as Record<string, Record<string, Record<string, unknown>>>;
const blindFx = fx.blind ?? {};
const jalFx = fx.jalousie ?? {};
const blindHalf = (): BlindDevice =>
  ({ type: "blind", accent: "orange", ...(blindFx.half as object) }) as BlindDevice;
const jalTilted = (): JalousieDevice =>
  ({ type: "jalousie", ...(jalFx.tilted as object) }) as JalousieDevice;

describe("presetRow", () => {
  it("renders one button per fixture preset with raw label + index-carrying applyPreset (blind)", () => {
    const v = presetRow(blindHalf(), ctxStub());
    expect(v).not.toBeNull();
    const btns = findAll(v, "button", "vz-preset");
    expect(btns).toHaveLength(3);
    // Button text is the raw fixture label (no i18n key).
    expect(btns.map((b) => text(b))).toEqual(["Guten Morgen", "Spalt offen", "Schlitze"]);
    // applyPreset carries the INDEX in presets, not a position.
    expect(actions(v)).toEqual(["applyPreset", "applyPreset", "applyPreset"]);
    expect(btns.map((b) => b.props?.["data-arg"])).toEqual(["0", "1", "2"]);
  });

  it("renders one button per fixture preset with raw label + index (jalousie)", () => {
    const v = presetRow(jalTilted(), ctxStub());
    expect(v).not.toBeNull();
    const btns = findAll(v, "button", "vz-preset");
    // jalousie.tilted.presets: Beschattung / Lüften / Offen
    expect(btns.map((b) => text(b))).toEqual(["Beschattung", "Lüften", "Offen"]);
    expect(btns.map((b) => b.props?.["data-arg"])).toEqual(["0", "1", "2"]);
    expect(actions(v)).toEqual(["applyPreset", "applyPreset", "applyPreset"]);
  });

  it("locked device: buttons inert, NO applyPreset leak", () => {
    const v = presetRow({ ...blindHalf(), locked: true } as BlindDevice, ctxStub());
    const btns = findAll(v, "button", "vz-preset");
    expect(btns).toHaveLength(3);
    expect(actions(v)).not.toContain("applyPreset");
    expect(btns.every((b) => b.props?.disabled === true)).toBe(true);
    expect(btns.every((b) => b.props?.["aria-disabled"] === "true")).toBe(true);
    expect(btns.every((b) => b.props?.["data-action"] === undefined)).toBe(true);
  });

  it("non-writable device (writable=false): buttons inert, NO applyPreset leak", () => {
    const v = presetRow({ ...jalTilted(), writable: false } as JalousieDevice, ctxStub());
    const btns = findAll(v, "button", "vz-preset");
    expect(btns).toHaveLength(3);
    expect(actions(v)).not.toContain("applyPreset");
    expect(btns.every((b) => b.props?.disabled === true)).toBe(true);
  });

  it("returns null when presets are empty or missing", () => {
    expect(presetRow({ ...blindHalf(), presets: [] } as BlindDevice, ctxStub())).toBeNull();
    const noPresets = { ...blindHalf() } as BlindDevice & { presets?: unknown };
    delete noPresets.presets;
    expect(presetRow(noPresets as BlindDevice, ctxStub())).toBeNull();
  });
});

describe("positionPresets popover", () => {
  it("wraps the preset row under a translated heading", () => {
    const v = positionPresets(
      blindHalf(),
      tokensStub,
      ctxStub({ t: (k) => (k === "skin.ionic.common.positions" ? "Positionen!" : k) }),
    );
    expect(classOf(v)).toContain("vz-popover");
    expect(text(find(v, "div", "vz-popover-h"))).toBe("Positionen!");
    expect(findAll(v, "button", "vz-preset")).toHaveLength(3);
    expect(actions(v)).toContain("applyPreset");
  });

  it("shows the empty hint when no presets are configured", () => {
    const noPresets = { ...blindHalf() } as BlindDevice & { presets?: unknown };
    delete noPresets.presets;
    const v = positionPresets(noPresets as BlindDevice, tokensStub, ctxStub());
    expect(find(v, "div", "vz-popover-empty")).toBeDefined();
    expect(text(find(v, "div", "vz-popover-empty"))).toBe("Keine Vorgaben");
    expect(findAll(v, "button", "vz-preset")).toHaveLength(0);
  });
});
