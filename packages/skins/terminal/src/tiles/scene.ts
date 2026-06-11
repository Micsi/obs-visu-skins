// Terminal-Skin · scene — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// One-shot: manifest.json → widgets.scene.actions === ["activateScene"]. Der Renderer
// markiert nur die kanonische Aktion via data-action; der Host übersetzt die Geste und
// besitzt den State (Goldene Regeln 1/4 — nie d.x=…). Aufbau: "Raum · Label   <sub>
// [run]".

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SceneDevice, Tokens } from "@obs/visu-contract";
import { rowLabel } from "../row.js";

export const sceneTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SceneDevice;
  return h(
    "div",
    {
      class: ["t-row", "t-scene"],
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "scene",
      "data-action": "activateScene",
      role: "button",
      tabindex: "0",
      "aria-label": dev.label,
    },
    [
      rowLabel(ctx, dev.room, dev.label),
      dev.sub ? h("span", { class: "t-state t-sub" }, dev.sub) : h("span", { class: "t-state" }, ""),
      h("span", { class: "t-cmd", "aria-hidden": "true" }, "[run]"),
    ],
  );
};
