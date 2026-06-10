// @obs-visu-skins/ionic — JalousieGlyph (live blind window for the jalousie tile).
//
// Pure VNode factory (no SFC, no state). Port of reference/vue-ionic jalousie.js
// → `.jal-window` visual: a sky + headrail with a stack of slats whose count
// follows the position and whose louvers tilt with the slat angle. Position and
// slat angle are simultaneously readable (Fenster-Visual), per CONTRACT semantics:
//   position 0 % = auf/oben   → no slats
//   position 100 % = zu/unten → full stack (MAX_SLATS)
//   slat 0 % = offen/flach (louver edge-on)  → ~74° rotateX
//   slat 100 % = geschlossen/senkrecht (full face) → 0° rotateX
// Display-space values only — the host applies `invert` before calling.

import { h, type VNode } from "vue";

const MAX_SLATS = 9;

export interface JalousieGlyphProps {
  /** Display-space position 0..100 (0 = open/top, 100 = closed/bottom). */
  readonly position: number;
  /** Display-space slat 0..100 (0 = flat/open, 100 = vertical/closed). */
  readonly slat: number;
}

/** slat count derived from position (0 at open, MAX_SLATS at closed). */
export function slatCountFor(position: number): number {
  const p = Math.max(0, Math.min(100, position));
  return Math.max(0, Math.round((p / 100) * MAX_SLATS));
}

/** louver rotateX angle in degrees (flat/open ≈ 74°, closed = 0°). */
export function louverAngleFor(slat: number): number {
  const s = Math.max(0, Math.min(100, slat));
  return Math.round(74 * (1 - s / 100));
}

/** human-readable slat angle 0..90° (0 % = 0°, 100 % = 90°). */
export function slatAngleDeg(slat: number): number {
  const s = Math.max(0, Math.min(100, slat));
  return Math.round((s / 100) * 90);
}

/** Build the live jalousie window VNode. */
export function jalousieGlyph(props: JalousieGlyphProps): VNode {
  const pos = Math.max(0, Math.min(100, props.position));
  const count = slatCountFor(pos);
  const louverStyle = { transform: `rotateX(${louverAngleFor(props.slat)}deg)` };

  const slatNodes: VNode[] = [];
  for (let i = 0; i < count; i++) {
    slatNodes.push(
      h("div", { key: `slat-${i}`, class: "jal-slat" }, [
        h("div", { class: "jal-louver", style: louverStyle }),
      ]),
    );
  }

  return h("div", { class: "jal-window-glyph" }, [
    h("div", { class: "jal-sky" }),
    h("div", { class: "jal-headrail" }),
    h("div", { class: "jal-blind", style: { height: `${pos}%` } }, slatNodes),
  ]);
}
