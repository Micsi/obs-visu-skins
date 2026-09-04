// Fixture-Wand — Vollständigkeits-Test für BEIDE Skins.
//
// Belegt: die Wand erzeugt für JEDEN Fixture-Zustand (Typ × Zustand) ein
// nicht-leeres VNode, und der Nicht-Typ-Schlüssel `contractVersion` wird nicht
// als Wand-Feld mitgezählt. ionic und terminal rendern alle neun Kern-Typen —
// die Wand muss für beide grün sein (#13: Definition of Done eines Skins).
// Fehlt ein Renderer, ist das Feld sichtbar `gap`; wirft er, ist es `broken`;
// ein bewusst abgewählter Typ ist `unsupported` und damit KEIN Fehler.

import { describe, expect, it } from "vitest";
import { isVNode } from "vue";
import * as ionic from "@obs-visu-skins/ionic";
import * as terminal from "@obs-visu-skins/terminal";
import * as edomi from "@obs-visu-skins/edomi";
import edomiManifest from "@obs-visu-skins/edomi/manifest.json" with { type: "json" };
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };

import { buildWall, type SkinTiles } from "../src/wall.js";
import { ionicTokens, terminalTokens, tokensStub, ctxStub } from "../src/stubs.js";

const ionicSkin: SkinTiles = { tiles: ionic.tiles, unsupported: [] };
const terminalSkin: SkinTiles = { tiles: terminal.tiles, unsupported: [] };
// edomi wird mit seinen ECHTEN Manifest-Aussagen gemessen, nicht mit leeren:
// die Wand soll denselben Lauf zeigen wie der Konformitätsreport (wall.ts).
const edomiSkin: SkinTiles = {
  tiles: edomi.tiles,
  unsupported: edomiManifest.unsupported,
  widgets: edomiManifest.widgets,
};

/** Erwartete Anzahl Wand-Felder = Summe aller Zustände über alle Typ-Schlüssel. */
function expectedCellCount(): number {
  const fx = fixtures as unknown as Record<string, Record<string, unknown>>;
  let n = 0;
  for (const key of Object.keys(fx)) {
    if (key === "contractVersion") continue;
    n += Object.keys(fx[key]!).length;
  }
  return n;
}

describe("fixture wall (ionic)", () => {
  const cells = buildWall(ionicSkin, tokensStub, ctxStub());

  it("covers every fixture state and skips contractVersion", () => {
    expect(cells.length).toBe(expectedCellCount());
    expect(cells.some((c) => (c.type as string) === "contractVersion")).toBe(false);
  });

  it("renders a non-empty VNode for every fixture state", () => {
    for (const c of cells) {
      expect(c.hasRenderer).toBe(true);
      expect(isVNode(c.vnode)).toBe(true);
    }
  });

  it("has no gaps — ionic renders all nine core types", () => {
    expect(cells.every((c) => c.status === "ok")).toBe(true);
    expect(cells.filter((c) => c.status !== "ok")).toHaveLength(0);
  });

  it("marks a declared-unsupported type as skipped, not as a gap", () => {
    const optedOut = buildWall(
      { tiles: { light: ionic.tiles.light }, unsupported: ["media"] },
      ionicTokens,
      ctxStub(),
    );
    expect(
      optedOut.filter((c) => c.type === "media").every((c) => c.status === "unsupported"),
    ).toBe(true);
    // Alles andere ohne Renderer bleibt eine echte gap.
    expect(optedOut.some((c) => c.status === "gap")).toBe(true);
  });

  it("marks a throwing renderer as broken", () => {
    const boom = buildWall(
      {
        tiles: {
          ...ionic.tiles,
          light: () => {
            throw new Error("boom");
          },
        },
      },
      ionicTokens,
      ctxStub(),
    );
    const lights = boom.filter((c) => c.type === "light");
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.every((c) => c.status === "broken")).toBe(true);
    expect(lights[0]?.error).toContain("boom");
  });

  it("marks a missing renderer as a visible gap (not silently skipped)", () => {
    const partial: SkinTiles = { tiles: { light: ionic.tiles.light } };
    const gapCells = buildWall(partial, tokensStub, ctxStub());
    expect(gapCells.length).toBe(expectedCellCount());
    // Nur light hat einen Renderer; alle anderen Typen sind sichtbare gaps.
    expect(gapCells.some((c) => !c.hasRenderer)).toBe(true);
    expect(gapCells.filter((c) => c.hasRenderer).every((c) => c.type === "light")).toBe(true);
    for (const c of gapCells.filter((c) => !c.hasRenderer)) {
      expect(c.vnode).toBeNull();
    }
  });
});

describe("fixture wall (terminal)", () => {
  const cells = buildWall(terminalSkin, terminalTokens, ctxStub());

  it("covers every fixture state", () => {
    expect(cells.length).toBe(expectedCellCount());
  });

  it("is green — terminal renders all nine core types without throwing", () => {
    for (const c of cells) {
      expect(c.status, `${c.type}.${c.state}`).toBe("ok");
      expect(isVNode(c.vnode)).toBe(true);
    }
  });
});

describe("fixture wall (edomi)", () => {
  const cells = buildWall(edomiSkin, ionicTokens, ctxStub());

  it("covers every fixture state", () => {
    expect(cells.length).toBe(expectedCellCount());
  });

  // edomi steht auf der Wand, weil ein Skin, der nicht auf ihr steht, nicht
  // gemessen wird. Seine Content-Renderer SIND die ionic-Renderer (kein
  // Datenfork, Renderer nach Typ adressiert) — die Wand belegt, dass das für
  // jeden im Manifest deklarierten Typ auch wirklich trägt.
  it("is green — every declared type renders without throwing", () => {
    for (const c of cells) {
      expect(c.status, `${c.type}.${c.state}`).toBe("ok");
      expect(isVNode(c.vnode)).toBe(true);
    }
  });
});
