// Terminal-Skin · jalousie (Lamellen-Jalousie) — Listen-Zeilen-Renderer (reine Funktion).
//
// Wie blind, plus die Lamellenstellung — aber BEWUSST nur als ANZEIGE:
// manifest.json → widgets.jalousie.actions verdrahtet setPosition, applyPreset,
// lock, unlock, jedoch NICHT `setSlat`. Eine Lamellen-Feinsteuerung gehört nicht in
// eine Konsolenzeile; der Wert wird gezeigt, nie als Bedienelement vorgetäuscht
// (Issue #11). 4 von 5 kanonischen Aktionen → Stufe `partial` (ehrlich, kein Vergessen).
//
// Goldene Regeln 1/4: kein State, nie d.x=…

import { h, type VNode } from "vue";
import type { Ctx, JalousieDevice, Renderer, Tokens } from "@obs/visu-contract";
import { blockBar, cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { posWord, presetCmds } from "./blind.js";
import { tt } from "../i18n.js";

export const jalousieTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as JalousieDevice;
  const locked = !!dev.locked;
  const movable = !locked && isWritable(dev);

  return h(
    "div",
    {
      class: [
        "t-row",
        "t-jalousie",
        locked && "is-locked",
        !isWritable(dev) && "is-readonly",
      ].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "jalousie",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(locked ? "dead" : dev.position > 0 ? "on" : "off"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, String(Math.round(dev.position))),
        h("span", { class: "t-unit" }, "%"),
        blockBar(dev.position),
        ` · ${posWord(ctx, dev.position)}`,
        // Lamelle: reine Anzeige (setSlat ist nicht verdrahtet).
        h(
          "span",
          { class: "t-status" },
          ` · ${tt(ctx, "skin.terminal.state.slat", "Lamelle")} ${Math.round(dev.slat)} %`,
        ),
        locked
          ? h(
              "span",
              { class: "t-locktag" },
              ` · ${tt(ctx, "skin.terminal.state.locked", "gesperrt")}`,
            )
          : null,
      ]),
      h("span", { class: "t-cmds" }, [
        cmd(`[${tt(ctx, "skin.terminal.cmd.open", "auf")}]`, "setPosition", {
          arg: "0",
          enabled: movable,
        }),
        cmd(`[${tt(ctx, "skin.terminal.cmd.close", "zu")}]`, "setPosition", {
          arg: "100",
          enabled: movable,
        }),
        ...presetCmds(dev.presets, movable),
        locked
          ? cmd(`[${tt(ctx, "skin.terminal.cmd.unlock", "öffnen")}]`, "unlock", {
              enabled: isWritable(dev),
            })
          : cmd(`[${tt(ctx, "skin.terminal.cmd.lock", "sperren")}]`, "lock", {
              enabled: isWritable(dev),
            }),
      ]),
    ],
  );
};
