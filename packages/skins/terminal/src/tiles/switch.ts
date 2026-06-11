// Terminal-Skin · switch — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Wie light eine kompakte Zeile mit der kanonischen Aktion toggle
// (manifest.json → widgets.switch.actions). Kein State, kein d.x=… (Goldene Regeln 1/4).

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";
import { rowLabel, rowState } from "../row.js";

export const switchTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SwitchDevice;
  return h(
    "div",
    {
      class: ["t-row", dev.on && "is-on"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "switch",
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
