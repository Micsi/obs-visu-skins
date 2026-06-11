// Fixture-Wand — Vollständigkeits-Test für den ionic-Skin.
//
// Belegt: die Wand erzeugt für JEDEN Fixture-Zustand (Typ × Zustand) ein
// nicht-leeres VNode, und der Nicht-Typ-Schlüssel `contractVersion` wird nicht
// als Wand-Feld mitgezählt. Da ionic alle sechs Kern-Typen rendert, darf es
// keine gap-Felder geben (sonst wäre die Vollständigkeitswand löchrig).

import { describe, expect, it } from "vitest";
import { isVNode } from "vue";
import * as ionic from "@obs-visu-skins/ionic";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };

import { buildWall, type SkinTiles } from "../src/wall.js";
import { tokensStub, ctxStub } from "../src/stubs.js";

const ionicSkin: SkinTiles = { tiles: ionic.tiles };

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

  it("has no gaps — ionic renders all six core types", () => {
    expect(cells.every((c) => c.hasRenderer)).toBe(true);
    expect(cells.filter((c) => !c.hasRenderer)).toHaveLength(0);
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
