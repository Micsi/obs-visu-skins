// I6 — Layout-Profil des Ionic-Skins: grid 3–6 (default 3, configurable), Zelle 1/1·112px,
// Gutter 7, Flow row, roleMap deckt alle Vertrags-Rollen ab, honors [order, grouping, role].
// Belegt zugleich, dass der reine Layout-Helfer (src/layout.ts) jede Rolle in eine Fläche
// übersetzt und für fehlende Rollen deterministisch auf 1×1 degradiert (graceful degradation).

import { describe, expect, it } from "vitest";
import type { Role, SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { ROLES, clampColumns, columns, flow, gutter, resolveSpan } from "../src/layout.js";

const ALL_ROLES: readonly Role[] = [
  "compact",
  "default",
  "wide",
  "tall",
  "feature",
  "banner",
];

describe("ionic layout profile (manifest)", () => {
  const m = manifest as unknown as SkinManifest;
  const layout = m.layout;
  const grid = layout.grid as Record<string, unknown>;

  it("declares a grid model honoring order, grouping and role", () => {
    expect(layout.model).toBe("grid");
    expect(layout.honors).toEqual(["order", "grouping", "role"]);
  });

  it("declares columns 3–6, default 3, configurable", () => {
    expect(grid.columns).toEqual({ min: 3, max: 6, default: 3, configurable: true });
  });

  it("declares a 1/1 · 112px cell, gutter 7, row flow", () => {
    expect(grid.cell).toEqual({ aspect: "1/1", minPx: 112 });
    expect(grid.gutter).toBe(7);
    expect(grid.flow).toBe("row");
  });

  it("roleMap covers every contract role exactly", () => {
    const roleMap = layout.roleMap as Record<string, unknown>;
    expect(Object.keys(roleMap).sort()).toEqual([...ALL_ROLES].sort());
  });

  it("maps roles to the contracted grid spans", () => {
    const roleMap = layout.roleMap as Record<string, { c: number; r: number }>;
    expect(roleMap.feature).toEqual({ c: 2, r: 2 });
    expect(roleMap.wide).toEqual({ c: 2, r: 1 });
    expect(roleMap.tall).toEqual({ c: 1, r: 2 });
    expect(roleMap.banner).toEqual({ c: 3, r: 1 });
    expect(roleMap.default).toEqual({ c: 1, r: 1 });
    expect(roleMap.compact).toEqual({ c: 1, r: 1 });
  });
});

describe("ionic layout helper (src/layout.ts)", () => {
  it("exports the full contract role set", () => {
    expect([...ROLES].sort()).toEqual([...ALL_ROLES].sort());
  });

  it("exposes the grid profile values", () => {
    expect(columns).toEqual({ min: 3, max: 6, default: 3, configurable: true });
    expect(gutter).toBe(7);
    expect(flow).toBe("row");
  });

  it("resolveSpan returns a non-trivial span for every role", () => {
    for (const role of ROLES) {
      const span = resolveSpan(role);
      expect(span.c).toBeGreaterThanOrEqual(1);
      expect(span.r).toBeGreaterThanOrEqual(1);
    }
  });

  it("resolveSpan matches the manifest roleMap entries", () => {
    expect(resolveSpan("feature")).toEqual({ c: 2, r: 2 });
    expect(resolveSpan("wide")).toEqual({ c: 2, r: 1 });
    expect(resolveSpan("tall")).toEqual({ c: 1, r: 2 });
    expect(resolveSpan("banner")).toEqual({ c: 3, r: 1 });
    expect(resolveSpan("default")).toEqual({ c: 1, r: 1 });
    expect(resolveSpan("compact")).toEqual({ c: 1, r: 1 });
  });

  it("resolveSpan degrades unknown/missing roles to a 1×1 cell", () => {
    expect(resolveSpan("nope")).toEqual({ c: 1, r: 1 });
    expect(resolveSpan(undefined)).toEqual({ c: 1, r: 1 });
  });

  it("clampColumns keeps requests inside the declared min/max window", () => {
    expect(clampColumns(1)).toBe(3); // below min → min
    expect(clampColumns(4)).toBe(4); // inside → unchanged
    expect(clampColumns(9)).toBe(6); // above max → max
    expect(clampColumns(Number.NaN)).toBe(3); // not finite → default
  });
});
