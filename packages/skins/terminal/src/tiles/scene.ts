// Terminal-Skin · scene — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// One-shot: manifest.json → widgets.scene.actions === ["activateScene"] — das ist
// zugleich die einzige kanonische scene-Aktion des Vertrags → Stufe `full`. Der
// Renderer markiert nur die Aktion; der Host übersetzt die Geste und besitzt den
// State (Goldene Regeln 1/4 — nie d.x=…).
//
// Zeile: "● Raum · Label   <Untertitel>   [start]".

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SceneDevice, Tokens } from "@obs/visu-contract";
import { cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { tt } from "../i18n.js";

export const sceneTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SceneDevice;
  const writable = isWritable(dev);

  return h(
    "div",
    {
      class: ["t-row", "t-scene", !writable && "is-readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "scene",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed("on"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [dev.sub ? h("span", { class: "t-sub" }, dev.sub) : null]),
      h("span", { class: "t-cmds" }, [
        cmd(`[${tt(ctx, "skin.terminal.cmd.run", "start")}]`, "activateScene", {
          enabled: writable,
        }),
      ]),
    ],
  );
};
