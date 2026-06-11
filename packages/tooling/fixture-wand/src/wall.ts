// Fixture-Wand — reine Iterations-/Dispatch-Logik (kein DOM, kein State).
//
// Baut aus @obs/visu-contract/fixtures.json die vollständige Liste aller
// Typ × Zustand-Paare und ruft je Paar den Kachel-Renderer des gewählten Skins
// rein funktional auf (renderers.tiles[type]). Dispatch ausschließlich über den
// Typ-Schlüssel — niemals ein switch mit stillem Default. Fehlt ein Renderer für
// einen Typ, wird das als sichtbarer `gap` markiert (renderer === null), nicht
// still übersprungen (Goldene Regel 3: Lücken ehrlich zeigen).

import type { CoreWidgetType, Ctx, Device, Renderer, Tokens } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };

/** Die einzige Renderer-Fläche, die die Wand vom Skin braucht: Kacheln je Typ. */
export interface SkinTiles {
  readonly tiles: Partial<Record<CoreWidgetType, Renderer>>;
}

/** Ein gerendertes Wand-Feld: Typ × Zustand, plus VNode oder gap-Markierung. */
export interface WallCell {
  readonly type: CoreWidgetType;
  readonly state: string;
  readonly device: Device;
  /** VNode-Ergebnis des Renderers, oder `null` wenn der Skin den Typ nicht rendert (gap). */
  readonly vnode: unknown;
  readonly hasRenderer: boolean;
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
      cells.push({
        type: wtype,
        state,
        device,
        vnode: render ? render(device, tokens, ctx) : null,
        hasRenderer: typeof render === "function",
      });
    }
  }

  return cells;
}
