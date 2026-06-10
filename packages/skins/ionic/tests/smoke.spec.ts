// M2-Foundation Smoke-Test: belegt, dass das Skin-Skelett auflöst (Manifest + Vertrag
// + Renderer-Stubs), damit die nachfolgenden Renderer-Wellen darauf TDD fahren können.

import { describe, expect, it } from "vitest";
import type { SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { details, tiles } from "../renderers.js";

describe("ionic skin scaffold", () => {
  it("declares a contract-shaped manifest targeting v1.1", () => {
    const m = manifest as unknown as SkinManifest;
    expect(m.name).toBe("ionic");
    expect(m.targetsContract).toBe("1.1");
    expect(m.layout.model).toBe("grid");
    expect(m.unsupported).toContain("camera");
    expect(m.unsupported).toContain("media");
    // Kern-Typen sind im Manifest deklariert (sonst meldet der Generator gap).
    expect(Object.keys(m.widgets).sort()).toEqual(
      ["blind", "jalousie", "light", "scene", "sensor", "switch"].sort(),
    );
  });

  it("exposes typed renderer maps wired by the M2 renderer waves", () => {
    expect(tiles).toBeTypeOf("object");
    expect(details).toBeTypeOf("object");
    // Alle sechs v1-Kern-Typen haben einen Kachel-Renderer.
    expect(Object.keys(tiles).sort()).toEqual(
      ["blind", "jalousie", "light", "scene", "sensor", "switch"].sort(),
    );
    // Detail-Flächen für die bedienbaren Typen (sensor read-only, scene one-shot).
    expect(Object.keys(details).sort()).toEqual(
      ["blind", "jalousie", "light", "switch"].sort(),
    );
    for (const fn of Object.values(tiles)) expect(fn).toBeTypeOf("function");
    for (const fn of Object.values(details)) expect(fn).toBeTypeOf("function");
  });
});
