// @obs-visu-skins/ionic — BlindGlyph (Rollladen window glyph).
//
// Pure VNode factory (no SFC, no state): a window frame with a slatted accent
// shade + bottom rail. Port of reference/vue-ionic widgets.js → VzBlindGlyph.
//   position 0   = auf (Shade leer/oben)
//   position 100 = zu  (Shade voll)
// The shade fill grows with `position`; slat lines are drawn inside the fill,
// a bottom rail sits at the shade's lower edge. Colour comes from the accent
// CSS var (`--acc`) the host sets on the tile — the glyph never owns colour.

import { h, type VNode } from "vue";

export interface BlindGlyphProps {
  /** 0 = open (empty), 100 = closed (full shade). */
  readonly position: number;
  readonly w?: number;
  readonly h?: number;
}

/** Build the SVG VNode for the blind glyph. */
export function blindGlyph(props: BlindGlyphProps): VNode {
  const w = props.w ?? 46;
  const ht = props.h ?? 34;
  const pos = Math.max(0, Math.min(100, props.position));

  const shadeTop = 5;
  const shadeMax = ht - 4 - shadeTop;
  const fill = shadeMax * (pos / 100);
  const railY = shadeTop + fill;

  const slats: number[] = [];
  for (let y = shadeTop + 3.5; y < railY - 1.5; y += 4) slats.push(y);

  const children: VNode[] = [
    h("rect", {
      x: 1,
      y: 1,
      width: w - 2,
      height: ht - 2,
      rx: 4.5,
      stroke: "currentColor",
      "stroke-width": 1.1,
      opacity: 0.4,
    }),
    h("rect", {
      x: 2.5,
      y: 2,
      width: w - 5,
      height: 3.4,
      rx: 1.6,
      fill: "currentColor",
      opacity: 0.8,
    }),
  ];

  if (fill > 0.5) {
    children.push(
      h("rect", {
        x: 3,
        y: shadeTop,
        width: w - 6,
        height: fill,
        rx: 1.5,
        fill: "var(--acc)",
        opacity: 0.2,
      }),
    );
  }

  slats.forEach((y, i) =>
    children.push(
      h("line", {
        key: `slat-${i}`,
        x1: 4,
        x2: w - 4,
        y1: y,
        y2: y,
        stroke: "var(--acc)",
        "stroke-width": 1,
        opacity: 0.45,
      }),
    ),
  );

  if (fill > 2) {
    children.push(
      h("rect", {
        x: 2.5,
        y: railY - 1,
        width: w - 5,
        height: 2.6,
        rx: 1.3,
        fill: "var(--acc)",
        opacity: 0.85,
      }),
    );
  }

  return h(
    "svg",
    {
      class: "vz-blind-svg",
      width: w,
      height: ht,
      viewBox: `0 0 ${w} ${ht}`,
      fill: "none",
    },
    children,
  );
}
