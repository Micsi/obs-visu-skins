// Terminal-Skin · light — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Zeile: "● Raum · Label   <Ein — 45 %> ████░░░░░░   [aus]".
// Verdrahtete Aktion laut manifest.json → widgets.light.actions: NUR `toggle`.
// `setDim` ist bewusst NICHT verdrahtet — die Helligkeit wird als Block-Bar
// ANGEZEIGT, aber nie als Bedienelement vorgetäuscht (Issue #11). Der Vertrag
// kennt für light zwei Aktionen, terminal deckt eine ab → Stufe `partial`.
//
// Goldene Regeln 1/4: kein State, nie d.x=…; der Host mappt die Geste.

import { h, type VNode } from "vue";
import type { Ctx, LightDevice, Renderer, Tokens } from "@obs/visu-contract";
import { blockBar, cmd, isWritable, rowLabel, rowLed, rowState } from "../row.js";
import { tt } from "../i18n.js";

export const lightTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as LightDevice;
  const writable = isWritable(dev);

  return h(
    "div",
    {
      class: ["t-row", dev.on && "is-on", !writable && "is-readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "light",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(dev.on ? "on" : "off"),
      rowLabel(ctx, dev, dev.label),
      rowState(dev, ctx, dev.dim === null ? [] : [blockBar(dev.dim)]),
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
