// TDD-Spec für den Konformitäts-Generator (ARCHITECTURE.md §2).
//
// Positiv: der vollständige ionic-Skin (alle neun Kern-Typen inkl. climate supported,
// unsupported=[]) → kein gap. Die Stufe je Typ folgt der Aktions-Abdeckung gegen den
// Vertrag (§6): alle kanonischen Aktionen = "full", ein Teil = "partial", der Vertrag
// kennt keine Aktion (sensor) = "display".
// Negativ: ein konstruierter Skin-Stub mit deklariertem widget aber fehlendem Renderer
// → "gap"; ein werfender Renderer → "broken". Beides Exit != 0.

import { describe, expect, it } from "vitest";
import type { Renderer, SkinManifest } from "@obs/visu-contract";
import { tiles } from "@obs-visu-skins/ionic";
import ionicManifest from "@obs-visu-skins/ionic/manifest.json" with { type: "json" };
import { version as contractVersion } from "@obs/visu-contract";
import { CORE_WIDGET_TYPES, generateSupport, type RendererMap } from "../index.js";

const ionic = ionicManifest as unknown as SkinManifest;

describe("generateSupport — ionic (vollständig)", () => {
  it("meldet keine gap/broken und deckt alle neun Kern-Typen ab", () => {
    const { report, hasGap } = generateSupport({ manifest: ionic, tiles });

    expect(hasGap).toBe(false);
    expect(report.skin).toBe("ionic");

    // support.json deckt genau die neun Kern-Typen ab (v1.4: inkl. climate).
    expect(Object.keys(report.widgets).sort()).toEqual([...CORE_WIDGET_TYPES].sort());

    // Kein Typ ist offen oder kaputt; sensor ist "display" (der Vertrag kennt
    // dort keine Aktion), die übrigen acht sind vollständig verdrahtet.
    for (const type of CORE_WIDGET_TYPES) {
      expect(report.widgets[type]?.level).toBe(type === "sensor" ? "display" : "full");
    }
    expect(report.summary.full).toBe(8);
    expect(report.summary.display).toBe(1);
    expect(report.summary.gap).toBe(0);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.unsupported).toBe(0);
  });

  it("spiegelt nicht die eigene Zielversion, sondern den echten Vertragsstand", () => {
    const { report } = generateSupport({ manifest: ionic, tiles });
    expect(report.targetsContract).toBe(ionic.targetsContract);
    expect(report.contractLatest).toBe(contractVersion);
  });

  it("nennt je Typ die Aktions-Abdeckung und die geprüften Fixture-Zustände", () => {
    const { report } = generateSupport({ manifest: ionic, tiles });
    // camera kennt genau eine kanonische Aktion (refresh) und zwei Fixtures.
    expect(report.widgets.camera?.actions).toBe("1/1");
    expect(report.widgets.camera?.fixtures).toEqual(["online", "offline"]);
    expect(report.layout).toEqual({ model: "grid", honors: ["order", "grouping", "role"] });
  });

  it("schreibt einen deterministischen Zeitstempel über die injizierte now-Quelle", () => {
    const fixed = new Date("2026-06-11T00:00:00.000Z");
    const { report } = generateSupport({ manifest: ionic, tiles }, () => fixed);
    expect(report.generatedAt).toBe("2026-06-11T00:00:00.000Z");
  });
});

describe("generateSupport — gap-hart", () => {
  // Renderer-Stub: reine Funktion, gibt irgendein Markup zurück (Form egal für die Konformität).
  const stubRenderer: Renderer = () => ({ tag: "div" });

  it('meldet "gap" für ein deklariertes widget ohne passenden tiles-Renderer', () => {
    const brokenManifest: SkinManifest = {
      name: "broken",
      targetsContract: "1.1",
      unsupported: ["camera", "media", "climate"],
      widgets: {
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
        sensor: { actions: [] },
        scene: { actions: ["activateScene"] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    // light ist deklariert, aber es gibt KEINEN light-Renderer → gap.
    const partialTiles: RendererMap = {
      switch: stubRenderer,
      blind: stubRenderer,
      jalousie: stubRenderer,
      sensor: stubRenderer,
      scene: stubRenderer,
    };

    const { report, hasGap } = generateSupport({
      manifest: brokenManifest,
      tiles: partialTiles,
    });

    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("gap");
    expect(report.summary.gap).toBe(1);
  });

  it('meldet "gap" für einen Renderer ohne widgets-Deklaration', () => {
    const manifest: SkinManifest = {
      name: "undeclared",
      targetsContract: "1.1",
      unsupported: ["camera", "media", "climate"],
      widgets: {
        // scene fehlt in der Deklaration, hat aber unten einen Renderer.
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
        sensor: { actions: [] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    const tilesWithUndeclared: RendererMap = {
      light: stubRenderer,
      switch: stubRenderer,
      blind: stubRenderer,
      jalousie: stubRenderer,
      sensor: stubRenderer,
      scene: stubRenderer,
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: tilesWithUndeclared });

    expect(hasGap).toBe(true);
    expect(report.widgets.scene?.level).toBe("gap");
  });

  it('markiert in unsupported deklarierte Kern-Typen als "unsupported" (kein gap)', () => {
    const manifest: SkinManifest = {
      name: "minimal",
      targetsContract: "1.1",
      // sensor + scene bewusst als unsupported deklariert (climate ebenso, v1.4).
      unsupported: ["camera", "media", "sensor", "scene", "climate"],
      widgets: {
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    const partialTiles: RendererMap = {
      light: stubRenderer,
      switch: stubRenderer,
      blind: stubRenderer,
      jalousie: stubRenderer,
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: partialTiles });

    expect(hasGap).toBe(false);
    expect(report.widgets.sensor?.level).toBe("unsupported");
    expect(report.widgets.scene?.level).toBe("unsupported");
    // camera + media + sensor + scene + climate als unsupported deklariert (v1.4: 9 Kern-Typen).
    expect(report.summary.unsupported).toBe(5);
    // switch deckt seine einzige kanonische Aktion ab (full); light/blind/jalousie
    // verdrahten nur einen Teil → partial. Der Generator vergibt die Stufe, der Skin
    // behauptet sie nicht selbst.
    expect(report.widgets.switch?.level).toBe("full");
    expect(report.widgets.light?.level).toBe("partial");
    expect(report.widgets.light?.actions).toBe("1/2");
    expect(report.summary.full).toBe(1);
    expect(report.summary.partial).toBe(3);
  });

  it('meldet "broken" für einen Renderer, der an einer Vertrags-Fixture wirft', () => {
    const throwing: Renderer = () => {
      throw new Error("boom");
    };
    const manifest: SkinManifest = {
      name: "throwing",
      targetsContract: "1.10",
      unsupported: ["camera", "media", "climate", "sensor", "scene", "blind", "jalousie"],
      widgets: {
        light: { actions: ["toggle", "setDim"] },
        switch: { actions: ["toggle"] },
      },
      layout: { model: "list", honors: ["order"] },
    };

    const { report, hasGap } = generateSupport({
      manifest,
      tiles: { light: throwing, switch: stubRenderer },
    });

    // broken ist wie gap eine Fehlerstufe → Exit != 0.
    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("broken");
    expect(report.widgets.light?.reason).toContain("boom");
    expect(report.summary.broken).toBe(1);
  });
});
