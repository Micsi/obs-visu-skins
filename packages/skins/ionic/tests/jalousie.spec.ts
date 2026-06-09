// I3 — jalousie tile + detail renderer tests against the contract fixtures.
// Verifies exact jalousie semantics: position/slat sliders, drive + stop intents,
// status traffic-light dots (true=rot/false=grün/null=grau), lock blocking.

import { describe, expect, it } from "vitest";
import type { JalousieDevice } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { jalousieTile } from "../src/tiles/JalousieTile.js";
import { jalousieDetail } from "../src/details/JalousieDetail.js";
import { slatAngleDeg, slatCountFor, louverAngleFor } from "../src/glyphs/JalousieGlyph.js";
import { actions, classOf, find, findAll, text, tokensStub, ctxStub } from "./_vnode.js";

type Fx = "open" | "tilted" | "locked";
const jalFx =
  (fixtures as unknown as Record<string, Record<string, Record<string, unknown>>>).jalousie ?? {};
const dev = (fx: Fx): JalousieDevice =>
  ({ type: "jalousie", ...(jalFx[fx] as object) }) as JalousieDevice;

describe("jalousie glyph math", () => {
  it("maps slat 0–100 to 0–90°", () => {
    expect(slatAngleDeg(0)).toBe(0);
    expect(slatAngleDeg(50)).toBe(45);
    expect(slatAngleDeg(100)).toBe(90);
  });
  it("slat count grows with position (0 at auf, 9 at zu)", () => {
    expect(slatCountFor(0)).toBe(0);
    expect(slatCountFor(100)).toBe(9);
  });
  it("louver tilt flat(open)≈74°, vertical(closed)=0°", () => {
    expect(louverAngleFor(0)).toBe(74);
    expect(louverAngleFor(100)).toBe(0);
  });
});

describe("jalousie tile", () => {
  it("renders a non-empty tile for every fixture", () => {
    for (const fx of ["open", "tilted", "locked"] as Fx[]) {
      const v = jalousieTile(dev(fx), tokensStub, ctxStub());
      expect(v.type).toBe("div");
      expect(classOf(v)).toContain("jal-tile");
      expect(find(v, "div", "jal-window")).toBeDefined();
    }
  });

  it("has BOTH a position slider and a slat slider", () => {
    const v = jalousieTile(dev("tilted"), tokensStub, ctxStub());
    const pos = find(v, "input", "jal-vtrack");
    const slat = find(v, "input", "jal-hslider");
    expect(pos?.props?.["data-action"]).toBe("setPosition");
    expect(pos?.props?.value).toBe(62);
    expect(slat?.props?.["data-action"]).toBe("setSlat");
    expect(slat?.props?.value).toBe(35);
    expect(text(find(v, "span", "jal-slatval"))).toBe("31°"); // round(35/100*90), fp ⇒ 31
  });

  it("renders rail caps auf/zu and the position readout", () => {
    const v = jalousieTile(dev("open"), tokensStub, ctxStub());
    expect(text(find(v, "div", "jal-rail-cap top"))).toBe("auf");
    expect(text(find(v, "div", "jal-rail-cap bot"))).toBe("zu");
    expect(text(find(v, "span", "jal-pct"))).toContain("0");
    expect(text(find(v, "span", "jal-sub"))).toBe("Offen");
  });

  it("offers open/stop/down drive intents and a detail-opening window", () => {
    const v = jalousieTile(dev("open"), tokensStub, ctxStub());
    const acts = actions(v);
    expect(acts).toContain("setPosition");
    expect(acts).toContain("setSlat");
    expect(acts).toContain("stop");
    expect(acts).toContain("openDetail");
  });

  it("status dots reflect true=rot / false=grün / null=grau", () => {
    const v = jalousieTile(dev("tilted"), tokensStub, ctxStub());
    const dots = findAll(v, "span", "jal-dot");
    expect(dots).toHaveLength(3);
    const cls = dots.map((dt) => classOf(dt));
    // fixture: Sturm=false, Sonne=true, Sperre=null
    expect(cls.some((c) => c.includes("is-false"))).toBe(true);
    expect(cls.some((c) => c.includes("is-true"))).toBe(true);
    expect(cls.some((c) => c.includes("is-unknown"))).toBe(true);
  });

  it("locked blocks every control and shows the lock tag; no operating intent leaks", () => {
    const v = jalousieTile(dev("locked"), tokensStub, ctxStub());
    expect(classOf(v)).toContain("locked");
    expect(find(v, "span", "jal-locktag")).toBeDefined();
    const inputs = findAll(v, "input");
    expect(inputs.every((i) => i.props?.disabled === true)).toBe(true);
    const acts = actions(v);
    // unlock is NOT offered on the tile — only the detail can unlock
    expect(acts).not.toContain("setPosition");
    expect(acts).not.toContain("setSlat");
    expect(acts).not.toContain("stop");
    expect(acts).not.toContain("unlock");
    // the window still opens the detail (where unlock lives)
    expect(acts).toContain("openDetail");
  });
});

describe("jalousie detail", () => {
  it("renders position slider, slat slider, open/close, status and lock", () => {
    const v = jalousieDetail(dev("tilted"), tokensStub, ctxStub());
    expect(classOf(v)).toContain("vz-dialog");
    const ranges = findAll(v, "input", "vz-range");
    const acts = ranges.map((r) => r.props?.["data-action"]);
    expect(acts).toContain("setPosition");
    expect(acts).toContain("setSlat");
    expect(findAll(v, "span", "vz-status-item")).toHaveLength(3);
    expect(text(find(v, "div", "vz-dialog-val"))).toBe("62 % · 31°");
  });

  it("unlocked detail offers lock; locked detail offers unlock", () => {
    expect(actions(jalousieDetail(dev("tilted"), tokensStub, ctxStub()))).toContain("lock");
    expect(actions(jalousieDetail(dev("locked"), tokensStub, ctxStub()))).toContain("unlock");
  });

  it("open fixture has no slat slider hidden away — slat control present for jalousie mode", () => {
    const v = jalousieDetail(dev("open"), tokensStub, ctxStub());
    const acts = findAll(v, "input", "vz-range").map((r) => r.props?.["data-action"]);
    expect(acts).toContain("setSlat");
  });
});
