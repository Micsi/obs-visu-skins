// Contract v1.5 — `Device.writable === false` (Host-Sperre: readonly-Seite ODER
// fehlendes Write-Recht) muss in jedem BEDIENBAREN Renderer (Tile UND Detail) die
// Schreibaktion unterbinden und den Zustand sichtbar/gebarrierefrei als gesperrt
// markieren. `writable: true`/`undefined` bleibt das heutige Verhalten (Default).

import { describe, expect, it } from "vitest";
import type {
  BlindDevice,
  ClimateDevice,
  JalousieDevice,
  LightDevice,
  MediaDevice,
  SceneDevice,
  SwitchDevice,
} from "@obs/visu-contract";

import { LightTile } from "../src/tiles/LightTile.js";
import { SwitchTile } from "../src/tiles/SwitchTile.js";
import { blindTile } from "../src/tiles/BlindTile.js";
import { jalousieTile } from "../src/tiles/JalousieTile.js";
import { climateTile } from "../src/tiles/ClimateTile.js";
import { SceneTile } from "../src/tiles/Scene.js";
import { MediaTile } from "../src/tiles/Media.js";

import { LightDetail } from "../src/details/LightDetail.js";
import { SwitchDetail } from "../src/details/SwitchDetail.js";
import { blindDetail } from "../src/details/BlindDetail.js";
import { jalousieDetail } from "../src/details/JalousieDetail.js";
import { climateDetail } from "../src/details/ClimateDetail.js";

import { actions, classOf, find, findAll, flatten, tokensStub, ctxStub } from "./_vnode.js";

type Writable = boolean | undefined;

/* device factories — minimal but contract-shaped; `writable` injected per case. */
const light = (w: Writable): LightDevice =>
  ({
    type: "light",
    room: "EG",
    label: "Licht",
    accent: "orange",
    on: true,
    dim: 50,
    writable: w,
  }) as LightDevice;
const sw = (w: Writable): SwitchDevice =>
  ({
    type: "switch",
    room: "EG",
    label: "Lüfter",
    accent: "blue",
    on: true,
    writable: w,
  }) as SwitchDevice;
const blind = (w: Writable): BlindDevice =>
  ({
    type: "blind",
    room: "EG",
    label: "Rollladen",
    accent: "orange",
    position: 40,
    locked: false,
    writable: w,
  }) as BlindDevice;
const jalousie = (w: Writable): JalousieDevice =>
  ({
    type: "jalousie",
    mode: "jalousie",
    room: "EG",
    label: "Jalousie",
    accent: "orange",
    position: 40,
    slat: 30,
    locked: false,
    statuses: [],
    writable: w,
  }) as JalousieDevice;
const climate = (w: Writable): ClimateDevice =>
  ({
    type: "climate",
    room: "EG",
    label: "Heizung",
    accent: "rose",
    setpoint: 21,
    unit: "°C",
    current: 20,
    mode: "heat",
    writable: w,
  }) as ClimateDevice;
const scene = (w: Writable): SceneDevice =>
  ({
    type: "scene",
    room: "EG",
    label: "Kino",
    accent: "violet",
    icon: "sparkle",
    writable: w,
  }) as SceneDevice;
const media = (w: Writable): MediaDevice =>
  ({
    type: "media",
    room: "EG",
    label: "Sonos",
    accent: "blue",
    playState: "playing",
    title: "Song",
    subtitle: "Artist",
    volume: 30,
    writable: w,
  }) as MediaDevice;

/** Every write-intent this skin can emit (openDetail/close are NOT writes). */
const WRITE_ACTIONS = [
  "toggle",
  "setDim",
  "setPosition",
  "setSlat",
  "stop",
  "setSetpoint",
  "activateScene",
  "playPause",
  "setVolume",
  "next",
  "previous",
  "lock",
  "unlock",
];

function writeActions(node: unknown): string[] {
  return actions(node).filter((a) => WRITE_ACTIONS.includes(a));
}

/** Any control carrying disabled===true or aria-disabled==="true". */
function hasInertControl(node: unknown): boolean {
  return flatten(node).some(
    (v) => v.props?.disabled === true || v.props?.["aria-disabled"] === "true",
  );
}

const ctx = ctxStub();

describe("writable === false locks every operable TILE (no write intent, visibly locked)", () => {
  it("light tile: no toggle, aria-disabled, lock badge + readonly class", () => {
    const v = LightTile(light(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(classOf(v as never)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
    expect(find(v, "span", "vz-lockveil")).toBeDefined();
    expect((v as { props?: Record<string, unknown> }).props?.["aria-disabled"]).toBe("true");
    expect((v as { props?: Record<string, unknown> }).props?.role).toBeUndefined();
  });

  it("switch tile: no toggle, aria-disabled, lock badge + readonly class", () => {
    const v = SwitchTile(sw(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(classOf(v as never)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
    expect((v as { props?: Record<string, unknown> }).props?.["aria-disabled"]).toBe("true");
  });

  it("scene tile: no activateScene, aria-disabled, lock badge + readonly class", () => {
    const v = SceneTile(scene(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(classOf(v as never)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
    expect((v as { props?: Record<string, unknown> }).props?.["aria-disabled"]).toBe("true");
  });

  it("media tile: no transport/volume write, inert controls, lock badge + readonly class", () => {
    const v = MediaTile(media(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(classOf(v as never)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
    // all transport buttons + volume slider disabled
    expect(findAll(v, "button", "vz-media-btn").every((b) => b.props?.disabled === true)).toBe(
      true,
    );
    expect(find(v, "input", "vz-media-vol")?.props?.disabled).toBe(true);
  });

  it("blind tile: openDetail stays (view), no write intent, lock badge + readonly class", () => {
    const v = blindTile(blind(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("openDetail");
    expect(classOf(v)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
  });

  it("climate tile: openDetail stays (view), no write intent, lock badge + readonly class", () => {
    const v = climateTile(climate(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("openDetail");
    expect(classOf(v)).toContain("readonly");
    expect(find(v, "span", "vz-lock")).toBeDefined();
  });

  it("jalousie tile: openDetail stays, controls inert, lock tag + readonly class", () => {
    const v = jalousieTile(jalousie(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("openDetail");
    expect(classOf(v)).toContain("readonly");
    expect(find(v, "span", "jal-locktag")).toBeDefined();
    expect(findAll(v, "input").every((i) => i.props?.disabled === true)).toBe(true);
  });
});

describe("writable === false locks every DETAIL (write controls inert, close stays)", () => {
  it("light detail: no setDim, controls inert, close preserved", () => {
    const v = LightDetail(light(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("close");
    expect(hasInertControl(v)).toBe(true);
  });

  it("switch detail: no toggle, toggle inert, close preserved", () => {
    const v = SwitchDetail(sw(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("close");
    expect(hasInertControl(v)).toBe(true);
  });

  it("blind detail: no setPosition/stop AND no lock/unlock (unlock is a write), close preserved", () => {
    const v = blindDetail(blind(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("close");
    expect(hasInertControl(v)).toBe(true);
  });

  it("jalousie detail: no movement AND no unlock, close preserved", () => {
    const v = jalousieDetail(jalousie(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("close");
    expect(hasInertControl(v)).toBe(true);
  });

  it("climate detail: no setSetpoint, stepper + slider inert, close preserved", () => {
    const v = climateDetail(climate(false), tokensStub, ctx);
    expect(writeActions(v)).toEqual([]);
    expect(actions(v)).toContain("close");
    expect(hasInertControl(v)).toBe(true);
  });
});

describe("writable true/undefined is unchanged (Default, backward compatible)", () => {
  for (const w of [true, undefined] as Writable[]) {
    const tag = w === undefined ? "undefined" : "true";

    it(`light tile stays operable (writable=${tag})`, () => {
      const v = LightTile(light(w), tokensStub, ctx);
      expect(actions(v)).toContain("toggle");
      expect(classOf(v as never)).not.toContain("readonly");
      expect(find(v, "span", "vz-lock")).toBeUndefined();
    });

    it(`switch tile stays operable (writable=${tag})`, () => {
      const v = SwitchTile(sw(w), tokensStub, ctx);
      expect(actions(v)).toContain("toggle");
      expect(classOf(v as never)).not.toContain("readonly");
    });

    it(`scene tile stays operable (writable=${tag})`, () => {
      const v = SceneTile(scene(w), tokensStub, ctx);
      expect(actions(v)).toContain("activateScene");
      expect(classOf(v as never)).not.toContain("readonly");
    });

    it(`media tile stays operable (writable=${tag})`, () => {
      const v = MediaTile(media(w), tokensStub, ctx);
      const acts = actions(v);
      expect(acts).toContain("playPause");
      expect(acts).toContain("setVolume");
      expect(classOf(v as never)).not.toContain("readonly");
    });

    it(`blind tile + detail stay operable (writable=${tag})`, () => {
      expect(actions(blindTile(blind(w), tokensStub, ctx))).toContain("openDetail");
      expect(actions(blindDetail(blind(w), tokensStub, ctx))).toContain("setPosition");
    });

    it(`jalousie tile + detail stay operable (writable=${tag})`, () => {
      const tile = jalousieTile(jalousie(w), tokensStub, ctx);
      expect(actions(tile)).toContain("setPosition");
      expect(classOf(tile)).not.toContain("readonly");
      expect(actions(jalousieDetail(jalousie(w), tokensStub, ctx))).toContain("setPosition");
    });

    it(`climate tile + detail stay operable (writable=${tag})`, () => {
      expect(actions(climateTile(climate(w), tokensStub, ctx))).toContain("openDetail");
      expect(actions(climateDetail(climate(w), tokensStub, ctx))).toContain("setSetpoint");
    });

    it(`light + switch detail stay operable (writable=${tag})`, () => {
      expect(actions(LightDetail(light(w), tokensStub, ctx))).toContain("setDim");
      expect(actions(SwitchDetail(sw(w), tokensStub, ctx))).toContain("toggle");
    });
  }
});
