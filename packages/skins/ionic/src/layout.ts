// @obs-visu-skins/ionic — Layout-Profil (I6, CONTRACT-v1.md §7, ARCHITECTURE.md §4).
//
// Golden rule 7: data + types. Das Skin deklariert sein *eigenes Raster* (Spalten,
// Zellgröße/-verhältnis, Gutter, Fluss) und eine `roleMap`, die *semantische* Rollen
// (Prominenz, nicht Pixel) auf Rasterfläche {c, r} übersetzt. Das Skin besitzt nie State
// (golden rule 1/4): diese Funktionen sind rein und lesen ausschließlich das Manifest.
//
// Boden / graceful degradation (ARCHITECTURE.md §4): `honors` = ["order", "grouping",
// "role"] — Reihenfolge und Gruppierung sind Pflicht, die räumliche Rolle ist additiv.
// `resolveSpan` gibt darum für jede Rolle eine Fläche; fehlt eine Rolle in der Map,
// degradiert sie deterministisch auf 1×1 (eine geordnete, flache Zelle — nie „kaputt").

import type { Role, SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };

/** Eine Rasterfläche: c = Spalten-Span, r = Reihen-Span (≥ 1). */
export interface GridSpan {
  readonly c: number;
  readonly r: number;
}

/** Spalten-Profil des Rasters — min/max/default + ob der Host einen Regler zeigt. */
export interface GridColumns {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly configurable: boolean;
}

const layout = (manifest as unknown as SkinManifest).layout;
const grid = (layout.grid ?? {}) as Record<string, unknown>;
const rawRoleMap = (layout.roleMap ?? {}) as Record<string, Partial<GridSpan>>;

/** Letzter Boden, wenn eine Rolle nicht in der Map steht: eine geordnete 1×1-Zelle. */
const FALLBACK_SPAN: GridSpan = { c: 1, r: 1 };

/** Alle semantischen Rollen des Vertrags (CONTRACT-v1.md §4) — Single Source. */
export const ROLES: readonly Role[] = [
  "compact",
  "default",
  "wide",
  "tall",
  "feature",
  "banner",
];

/** Spalten-Profil (für den generischen Spaltenregler des Hosts). */
export const columns: GridColumns = (grid.columns as GridColumns) ?? {
  min: 3,
  max: 6,
  default: 3,
  configurable: true,
};

/** Gutter in px zwischen den Zellen. */
export const gutter: number = typeof grid.gutter === "number" ? grid.gutter : 7;

/** Fluss-Richtung des Rasters ("row" | "dense" | …). */
export const flow: string = typeof grid.flow === "string" ? grid.flow : "row";

/**
 * Übersetzt eine semantische Rolle in ihre Rasterfläche {c, r}.
 * Rein und total: jede Rolle liefert eine Fläche; unbekannte/fehlende Rollen
 * degradieren deterministisch auf {@link FALLBACK_SPAN} (graceful degradation).
 */
export function resolveSpan(role: Role | string | undefined): GridSpan {
  const m = role != null ? rawRoleMap[role] : undefined;
  if (!m || typeof m.c !== "number" || typeof m.r !== "number") {
    return FALLBACK_SPAN;
  }
  return { c: m.c, r: m.r };
}

/**
 * Klemmt eine angeforderte Spaltenzahl in das deklarierte min/max-Fenster.
 * Der Host darf zwischen `columns.min` und `columns.max` regeln; alles außerhalb
 * wird auf den nächsten gültigen Wert gezogen (kein Fehler — der Regler ist additiv).
 */
export function clampColumns(requested: number): number {
  if (!Number.isFinite(requested)) return columns.default;
  return Math.min(columns.max, Math.max(columns.min, Math.round(requested)));
}
