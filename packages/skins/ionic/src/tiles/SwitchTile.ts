// Ionic-Skin · Kachel-Renderer für `switch` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: Design-System-Vorlage
// (Widget-Bibliothek → „Schalter & Toggle"): ein CSS-gezeichnetes `.vz-toggle`
// als Stellelement (kein ion-toggle), damit die Kachel 1:1 der Vorlage folgt.
// Bedienung über Host-Intent am Kachel-Wrapper: data-action="toggle" (kanonische
// Aktion aus manifest.json → widgets.switch.actions). Das Toggle spiegelt nur
// `dev.on` und ist rein dekorativ (aria-hidden); der Host fängt die Geste ab und
// besitzt den State (Goldene Regel 4 — niemals `d.x = …`). A11y wie beim Licht:
// der Wrapper ist der Button (role/tabindex/aria-pressed). Fußtext zentral über
// `ctx.stateText(d)`.

import { h } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";
import { stateFoot } from "../parts.js";

export const SwitchTile: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as SwitchDevice;
  return h(
    "div",
    {
      class: ["vz-tile", dev.on && "is-on"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      "data-type": "switch",
      "data-action": "toggle",
      role: "button",
      tabindex: 0,
      "aria-pressed": String(dev.on),
      "aria-label": dev.label,
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [
        h(
          "span",
          {
            class: ["vz-toggle", dev.on && "on"].filter(Boolean),
            role: "switch",
            "aria-checked": String(dev.on),
            "aria-hidden": "true",
          },
          [h("i")],
        ),
      ]),
      h("div", { class: "vz-tile-foot" }, stateFoot(ctx, dev)),
    ],
  );
};
