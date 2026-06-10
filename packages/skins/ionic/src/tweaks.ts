// @obs-visu-skins/ionic — Tweak-Anwendung (I5 #8).
//
// Goldene Regel 4: ein Skin besitzt nie State. Diese Datei berechnet aus den vom
// Host gehaltenen Tweak-Werten REIN (pure) die Wurzel-Attribute (`data-stil` /
// `data-theme` / `data-acc-style`) und CSS-Custom-Properties, die `ionic.css`
// dann auswertet. Der Host setzt das Resultat auf das Skin-Wurzelelement; der Skin
// mutiert nichts selbst und liest keinen Core-Internals.
//
// Goldene Regel 7: Daten=JSON, Verhalten=Code. Die Defaults hier sind der
// Code-Spiegel von manifest.json → `tweaks`; sie sind die einzige Quelle der
// Tweak-Bodenwerte und werden vom Generator gegen das Manifest geprüft.
//
// Quelle der Token-/Attribut-Verdrahtung: reference/vue-ionic/{app.js,store.js,
// visu-ionic.css} — `data-*` auf `.visu-root` + `--vz-*` rootStyle.

/** Optik der Kacheln — glass (Default) · ios · md. */
export type IonicStil = "glass" | "ios" | "md";

/** Akzent-Darstellung — bar (Balken) · glow (Leuchten, Default) · ring (Rahmen). */
export type AccentStyle = "bar" | "glow" | "ring";

/** Theme-Boden — light · dark · image (Tokens je Theme in ionic.css). */
export type IonicTheme = "light" | "dark" | "image";

/** Raumtrennung auf der Übersicht — off · gap (Abstand) · labels (Default). */
export type RoomGroup = "off" | "gap" | "labels";

/**
 * Die vom Host gehaltenen Tweak-Werte des Ionic-Skins. Alle Felder optional —
 * fehlt einer, greift der saubere Default aus {@link TWEAK_DEFAULTS}.
 */
export interface IonicTweaks {
  /** Kachel-Optik. */
  stil?: IonicStil;
  /** Akzent-Darstellung. */
  accentStyle?: AccentStyle;
  /** Aktives Theme. */
  theme?: IonicTheme;
  /** Glas-Unschärfe in px (0–40). */
  glassBlur?: number;
  /** Kachel-Deckkraft (0.3–0.9). */
  tileAlpha?: number;
  /** Raster-Dichte als Faktor (0.8–1.4) — skaliert die Zellhöhe. */
  cellScale?: number;
  /** Außenabstand des Rasters zum Bildschirmrand in px (0–24). */
  edge?: number;
  /** Leuchtkraft-Multiplikator für accentStyle=glow (0–1.6). */
  glow?: number;
  /** Raumtrennung auf der Übersicht. */
  roomGroup?: RoomGroup;
  /** Höhe des Raumabstands in px. */
  roomGap?: number;
  /** Titelleiste (Logo + Uhr) zeigen. */
  showTitlebar?: boolean;
  /** Akzentfarbe als CSS-Farbe (Palette-Token-Wert; vom Host aufgelöst). */
  accent?: string;
  /** Hintergrundbild-URL für theme=image. */
  photo?: string;
}

/**
 * Saubere Defaults je Tweak — Code-Spiegel von manifest.json → `tweaks` plus die
 * im Manifest nicht als Slider/Select geführten Bodenwerte (theme/roomGroup/
 * roomGap/showTitlebar). Jeder Wert ist ein für sich sinnvoller Default.
 */
export const TWEAK_DEFAULTS = {
  stil: "glass",
  accentStyle: "glow",
  theme: "image",
  glassBlur: 22,
  tileAlpha: 0.55,
  cellScale: 1,
  edge: 12,
  glow: 1,
  roomGroup: "labels",
  roomGap: 22,
  showTitlebar: false,
} as const satisfies Required<
  Pick<
    IonicTweaks,
    | "stil"
    | "accentStyle"
    | "theme"
    | "glassBlur"
    | "tileAlpha"
    | "cellScale"
    | "edge"
    | "glow"
    | "roomGroup"
    | "roomGap"
    | "showTitlebar"
  >
>;

/** Basis-Zellhöhe in px (visu-ionic.css → `--vz-cell`); cellScale skaliert sie. */
const BASE_CELL_PX = 112;

/** Grenzen aus manifest.json → `tweaks` — Schutz gegen Out-of-range vom Host. */
const RANGES = {
  glassBlur: { min: 0, max: 40 },
  tileAlpha: { min: 0.3, max: 0.9 },
  cellScale: { min: 0.8, max: 1.4 },
  edge: { min: 0, max: 24 },
  glow: { min: 0, max: 1.6 },
} as const;

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Wurzel-Datenattribute, die `ionic.css` als Selektoren auswertet. */
export interface RootAttrs {
  "data-stil": IonicStil;
  "data-theme": IonicTheme;
  "data-acc-style": AccentStyle;
  /** Raumtrennungs-Modus für übersichtsseitige Layout-Regeln. */
  "data-room-group": RoomGroup;
  /** Titelleiste sichtbar — "1" | "0". */
  "data-titlebar": "1" | "0";
}

/** Berechnetes Resultat: Attribute + CSS-Custom-Properties fürs Skin-Wurzelelement. */
export interface RootTweakStyle {
  /** Auf das Wurzelelement zu setzende `data-*`-Attribute. */
  attrs: RootAttrs;
  /** Auf das Wurzelelement zu setzende CSS-Custom-Properties (style). */
  style: Record<string, string>;
}

/**
 * Reine Abbildung der Tweak-Werte auf Wurzel-Attribute + CSS-Variablen.
 *
 * Spiegelt `reference/vue-ionic/app.js` (rootStyle) und die `data-*`-Attribute auf
 * `.visu-root` wider; numerische Slider werden auf ihren Manifest-Bereich geklemmt,
 * damit AA-Tokens auch an den Extremen tragen. Der Host setzt `attrs`/`style` aufs
 * Wurzelelement — der Skin hält keinen State und mutiert nichts.
 */
export function applyTweaks(tweaks: IonicTweaks = {}): RootTweakStyle {
  const t = { ...TWEAK_DEFAULTS, ...stripUndefined(tweaks) };

  const glassBlur = clamp(t.glassBlur, RANGES.glassBlur.min, RANGES.glassBlur.max);
  const tileAlpha = clamp(t.tileAlpha, RANGES.tileAlpha.min, RANGES.tileAlpha.max);
  const cellScale = clamp(t.cellScale, RANGES.cellScale.min, RANGES.cellScale.max);
  const edge = clamp(t.edge, RANGES.edge.min, RANGES.edge.max);
  const glow = clamp(t.glow, RANGES.glow.min, RANGES.glow.max);

  const style: Record<string, string> = {
    "--vz-blur": `${glassBlur}px`,
    "--vz-tile-alpha": `${tileAlpha}`,
    "--vz-cell": `${Math.round(BASE_CELL_PX * cellScale)}px`,
    "--vz-edge": `${edge}px`,
    "--vz-glow": `${glow}`,
    "--vz-room-gap": `${t.roomGroup === "off" ? 0 : t.roomGap}px`,
  };
  // Akzentfarbe und Hintergrundbild sind optional — nur setzen, wenn der Host sie
  // liefert, sonst greifen die Boden-Tokens aus ionic.css (--vz-accent / --vz-photo).
  if (tweaks.accent !== undefined) style["--vz-accent"] = tweaks.accent;
  if (tweaks.photo !== undefined) style["--vz-photo"] = `url('${tweaks.photo}')`;

  return {
    attrs: {
      "data-stil": t.stil,
      "data-theme": t.theme,
      "data-acc-style": t.accentStyle,
      "data-room-group": t.roomGroup,
      "data-titlebar": t.showTitlebar ? "1" : "0",
    },
    style,
  };
}

/** Entfernt `undefined`-Felder, damit `...spread` die Defaults nicht überschreibt. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
