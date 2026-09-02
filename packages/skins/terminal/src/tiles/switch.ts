// Terminal-Skin · switch — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Wie light eine kompakte Zeile, aber ohne Dim-Bar. Verdrahtet ist die einzige
// kanonische switch-Aktion `toggle` (manifest.json → widgets.switch.actions) →
// Stufe `full`. `writable === false` (Vertrag v1.5) sperrt den Knopf und nimmt
// ihm die data-action — die Zeile behauptet dann keine Bedienbarkeit.

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";
import { cmd, isWritable, rowLabel, rowLed, rowState } from "../row.js";
import { tt } from "../i18n.js";

export const switchTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SwitchDevice;
  const writable = isWritable(dev);

  return h(
    "div",
    {
      class: ["t-row", dev.on && "is-on", !writable && "is-readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "switch",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(dev.on ? "on" : "off"),
      rowLabel(ctx, dev, dev.label),
      rowState(
        dev,
        ctx,
        writable
          ? []
          : [
              h(
                "span",
                { class: "t-status" },
                ` · ${tt(ctx, "skin.terminal.state.readonly", "nicht schreibbar")}`,
              ),
            ],
      ),
      h("span", { class: "t-cmds" }, [
        cmd(
          dev.on
            ? `[${tt(ctx, "skin.terminal.cmd.off", "aus")}]`
            : `[${tt(ctx, "skin.terminal.cmd.on", "an")}]`,
          "toggle",
          { enabled: writable },
        ),
      ]),
    ],
  );
};
