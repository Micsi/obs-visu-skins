// Ionic-Skin · Kachel-Renderer für `switch` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: reference/vue-ionic/widgets.js
// (SWITCH-Zweig) — ein echtes ion-toggle als Stellelement. Bedienung über
// Host-Intent: data-action="toggle" (kanonische Aktion aus manifest.json →
// widgets.switch.actions). Das Toggle spiegelt nur `dev.on`; der Host fängt die
// Geste ab und besitzt den State (Goldene Regel 4 — niemals `d.x = …`). Fußtext
// zentral über `ctx.stateText(d)`.

import { h } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";

export const SwitchTile: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as SwitchDevice;
  return h(
    "div",
    {
      class: ["vz-tile", dev.on && "is-on"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "switch",
      "data-action": "toggle",
      "aria-label": dev.label,
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [
        h("ion-toggle", {
          checked: dev.on,
          "data-action": "toggle",
          "aria-label": dev.label,
        }),
      ]),
      h("div", { class: "vz-tile-foot" }, ctx.stateText(dev)),
    ],
  );
};
