// Ionic-Skin · Kachel-Renderer für `light` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode` — kein State, kein Datenfork (Goldene Regeln 1/4).
// Quelle: reference/vue-ionic/widgets.js (LIGHT-Zweig). Die Kachel zeigt eine
// Glühbirne; der Fuß kommt zentral aus `ctx.stateText(d)` (z. B. "Ein — 45 %").
// Bedienung ausschließlich über Host-Intent: data-action="toggle" am Tile-Wrapper
// (kanonische Aktion aus manifest.json → widgets.light.actions). Der Skin schreibt
// niemals `d.x = …`.

import { h, type VNode } from "vue";
import type { Ctx, LightDevice, Renderer, Tokens } from "@obs/visu-contract";

/**
 * Glühbirnen-Glyph (bulb) — Größe/Geometrie 1:1 aus der Design-System-Vorlage
 * (24×24, drei Pfade). Farbe/Glow steuert allein die CSS (`.vz-bulb` bzw.
 * `.vz-tile.is-on .vz-bulb`); der Renderer setzt kein Inline-Styling — der
 * `is-on`-Zustand kommt über die Kachel-Klasse (Goldene Regel: kein State im Skin).
 */
function bulbGlyph(): VNode {
  return h(
    "svg",
    {
      class: "vz-bulb",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.6,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    },
    [
      h("path", { d: "M9 18h6" }),
      h("path", { d: "M10 21h4" }),
      h("path", {
        d: "M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.5 1.5 2.5v.6h4v-.6c0-1 .7-1.9 1.5-2.5A6 6 0 0 0 12 3z",
      }),
    ],
  );
}

export const LightTile: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as LightDevice;
  return h(
    "div",
    {
      class: ["vz-tile", dev.on && "is-on"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      "data-type": "light",
      "data-action": "toggle",
      role: "button",
      tabindex: 0,
      "aria-pressed": String(dev.on),
      "aria-label": dev.label,
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [bulbGlyph()]),
      h("div", { class: "vz-tile-foot" }, ctx.stateText(dev)),
    ],
  );
};
