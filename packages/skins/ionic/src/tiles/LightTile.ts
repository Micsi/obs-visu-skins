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

/** Glühbirnen-Glyph (bulb) — color/Glow folgen dem Akzent, wenn die Lampe „an" ist. */
function bulbGlyph(on: boolean): VNode {
  return h(
    "svg",
    {
      class: "vz-bulb",
      width: 26,
      height: 26,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
    },
    [
      h("path", {
        d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1 1.15 1.1 1.9l.1.8h4.8l.1-.8c.1-.75.5-1.45 1.1-1.9A6 6 0 0 0 12 3Z",
        stroke: "currentColor",
        "stroke-width": 1.6,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        style: on
          ? "color:var(--acc);filter:drop-shadow(0 0 10px var(--acc))"
          : "color:var(--vz-fg-mute)",
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
      style: { "--acc": t.accent(dev.accent) },
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
      h("div", { class: "vz-tile-body" }, [bulbGlyph(dev.on)]),
      h("div", { class: "vz-tile-foot" }, ctx.stateText(dev)),
    ],
  );
};
