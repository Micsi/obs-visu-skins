// Fixture-Wand — reine Iterations-/Dispatch-Logik (kein DOM, kein State).
//
// Baut aus @obs/visu-contract/fixtures.json die vollständige Liste aller
// Typ × Zustand-Paare und ruft je Paar den Kachel-Renderer des gewählten Skins
// rein funktional auf (renderers.tiles[type]). Dispatch ausschließlich über den
// Typ-Schlüssel — niemals ein switch mit stillem Default.
//
// Jedes Feld bekommt denselben Status, den auch der Konformitäts-Generator vergibt
// (ARCHITECTURE.md §2), damit Wand und support.json dieselbe Sprache sprechen:
//   • ok           — Renderer vorhanden, Fixture gerendert
//   • unsupported  — der Skin hat den Typ bewusst abgewählt (Goldene Regel 3)
//   • gap          — kein Renderer und keine Deklaration → rote Zelle = To-do
//   • broken       — der Renderer wirft an dieser Fixture → rote Zelle = To-do
// Ein fehlender Renderer wird also nie still übersprungen.

import type { CoreWidgetType, Ctx, Device, Renderer, Tokens } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };

/** Was die Wand vom Skin braucht: Kacheln je Typ + die Manifest-Aussagen dazu. */
export interface SkinTiles {
  readonly tiles: Partial<Record<CoreWidgetType, Renderer>>;
  /** `manifest.unsupported` — bewusst nicht unterstützte Typen (kein gap). */
  readonly unsupported?: readonly string[];
  /**
   * `manifest.widgets` — die Deklaration je Typ. Ohne sie klassifiziert die Wand
   * allein nach "existiert ein Renderer" und widerspricht dem Report: ein Typ mit
   * Renderer, aber ohne Deklaration ist dort `gap`, hier waere er `ok`; ein Typ,
   * der `unsupported` deklariert ist und trotzdem einen Renderer hat, ist dort
   * `unsupported`, hier waere er `ok`. Die Wand ist die menschliche Sicht auf
   * DENSELBEN Lauf — sie darf ihn nicht anders lesen.
   */
  readonly widgets?: Readonly<Record<string, unknown>>;
}

/** Status eines Wand-Feldes — dieselben Stufen wie im Konformitäts-Report. */
export type CellStatus = "ok" | "unsupported" | "gap" | "broken";

/** Ein Wand-Feld: Typ × Zustand, plus VNode oder Fehlermarkierung. */
export interface WallCell {
  readonly type: CoreWidgetType;
  readonly state: string;
  readonly device: Device;
  /** VNode-Ergebnis des Renderers, oder `null` wenn nichts gerendert wurde. */
  readonly vnode: unknown;
  readonly hasRenderer: boolean;
  readonly status: CellStatus;
  /** Fehlermeldung bei `broken`. */
  readonly error?: string;
}

/** Schlüssel in fixtures.json, die KEIN Widget-Typ sind und übersprungen werden. */
const NON_TYPE_KEYS = new Set(["contractVersion"]);

type FixtureMap = Record<string, Record<string, Record<string, unknown>>>;

/**
 * Baut die vollständige Wand: jeder Typ × jeder Zustand aus den Fixtures, durch
 * die Renderer des übergebenen Skins gejagt. Reine Funktion über Daten + Stubs.
 */
export function buildWall(skin: SkinTiles, tokens: Tokens, ctx: Ctx): WallCell[] {
  const cells: WallCell[] = [];
  const fx = fixtures as unknown as FixtureMap;
  const unsupported = new Set(skin.unsupported ?? []);
  const declared = skin.widgets;

  for (const type of Object.keys(fx)) {
    if (NON_TYPE_KEYS.has(type)) continue;
    const wtype = type as CoreWidgetType;
    const states = fx[type];
    if (!states) continue;

    for (const state of Object.keys(states)) {
      // Vertrags-Fixtures tragen den Typ implizit über den Top-Level-Schlüssel und
      // haben keine id — beides für die Renderer injizieren (Device bleibt read-only).
      const device = {
        type: wtype,
        id: `${type}.${state}`,
        ...states[state],
      } as unknown as Device;

      const render = skin.tiles[wtype];
      if (typeof render !== "function") {
        cells.push({
          type: wtype,
          state,
          device,
          vnode: null,
          hasRenderer: false,
          status: unsupported.has(type) ? "unsupported" : "gap",
        });
        continue;
      }

      // Reihenfolge wie in `classify`: bewusste Abwahl schlaegt den Renderer, und
      // ein undeklarierter Typ ist eine Luecke — auch wenn er rendert.
      const declaredHere = declared === undefined || Object.hasOwn(declared, type);
      const status: CellStatus = unsupported.has(type) ? "unsupported" : declaredHere ? "ok" : "gap";

      try {
        cells.push({
          type: wtype,
          state,
          device,
          vnode: render(device, tokens, ctx),
          hasRenderer: true,
          status,
        });
      } catch (err: unknown) {
        cells.push({
          type: wtype,
          state,
          device,
          vnode: null,
          hasRenderer: true,
          status: "broken",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return cells;
}
