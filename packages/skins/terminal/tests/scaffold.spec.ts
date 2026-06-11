// TE1 Scaffold-Test: belegt, dass das Terminal-Skin-Skelett auflöst (Manifest +
// Vertrag + getypte Renderer-Maps), damit TE2 darauf TDD die Renderer fahren kann.

import { describe, expect, it } from "vitest";
import type { SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { details, tiles } from "../renderers.js";

const CORE_TYPES = ["blind", "jalousie", "light", "scene", "sensor", "switch"];

describe("terminal skin scaffold", () => {
  it("declares a contract-shaped manifest targeting v1.1 with a list layout", () => {
    const m = manifest as unknown as SkinManifest;
    expect(m.name).toBe("terminal");
    expect(m.targetsContract).toBe("1.1");
    // Terminal nutzt schlichte Listendarstellung, kein Grid.
    expect(m.layout.model).toBe("list");
    // `unsupported` ist Pflichtangabe (golden rule 3).
    expect(m.unsupported).toContain("camera");
    expect(m.unsupported).toContain("media");
    // Alle sechs Kern-Typen sind deklariert (sonst meldet der Generator gap).
    expect(Object.keys(m.widgets).sort()).toEqual([...CORE_TYPES].sort());
  });

  it("declares honestly partial actions (Terminal = reduzierte Bedienung)", () => {
    const m = manifest as unknown as SkinManifest;
    // Terminal lässt die Lamelle bewusst weg → jalousie ohne setSlat.
    expect(m.widgets.jalousie?.actions).not.toContain("setSlat");
    expect(m.widgets.jalousie?.actions).toEqual([
      "setPosition",
      "lock",
      "unlock",
    ]);
    expect(m.widgets.light?.actions).toEqual(["toggle"]);
    expect(m.widgets.switch?.actions).toEqual(["toggle"]);
    expect(m.widgets.blind?.actions).toEqual(["setPosition", "lock", "unlock"]);
    // Sensor ist read-only, Scene one-shot.
    expect(m.widgets.sensor?.actions).toEqual([]);
    expect(m.widgets.scene?.actions).toEqual(["activateScene"]);
  });

  it("exposes the typed renderer maps TE2 will fill", () => {
    expect(tiles).toBeTypeOf("object");
    expect(details).toBeTypeOf("object");
  });
});
