// Terminal-Skin · light — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Eine kompakte Zeile: "Raum · Label   <state>   [toggle]". Bedienung ausschließlich
// über Host-Intent: data-action="toggle" auf der Zeile (kanonische Aktion aus
// manifest.json → widgets.light.actions). Der Skin besitzt nie State, schreibt nie
// d.x=… (Goldene Regeln 1/4). Fußtext zentral über ctx.stateText.

import { h, type VNode } from "vue";
import type { Ctx, LightDevice, Renderer, Tokens } from "@obs/visu-contract";
import { rowLabel, rowState } from "../row.js";

export const lightTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as LightDevice;
  return h(
    "div",
    {
      class: ["t-row", dev.on && "is-on"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "light",
      "data-action": "toggle",
      role: "button",
      tabindex: "0",
      "aria-pressed": String(dev.on),
      "aria-label": dev.label,
    },
    [
      rowLabel(ctx, dev.room, dev.label),
      rowState(dev, ctx),
      h("span", { class: "t-cmd", "aria-hidden": "true" }, dev.on ? "[off]" : "[on]"),
    ],
  );
};
