// Terminal-Skin · climate (Klima/Heizung/RTR) — Listen-Zeilen-Renderer (reine Funktion).
//
// Kern-Typ seit Vertrag v1.4. Terminal RENDERT ihn (statt ihn als `unsupported`
// wegzudeklarieren): Soll-/Ist-Temperatur und Modus sind Zahlen und ein Wort —
// genau das Material, das eine Konsolenzeile gut trägt.
//
// Zeile: "● EG Wohnz. · Heizung   <21,5> °C Soll · Ist 20,4 °C · heat   [kälter][wärmer]".
// Verdrahtet: `setSetpoint` — die einzige kanonische climate-Aktion → Stufe `full`.
// Der neue Sollwert wird als data-arg mitgegeben (Schrittweite 0,5); ausgeführt und
// verrechnet wird er im Host (Goldene Regeln 1/4: kein State, nie d.x=…).
// `mode` wird roh aus dem Vertrag gezeigt — der Skin hält kein eigenes Mapping
// (Goldene Regel 1: kein Datenfork).

import { h, type VNode } from "vue";
import type { ClimateDevice, Ctx, Renderer, Tokens } from "@obs/visu-contract";
import { cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { tt } from "../i18n.js";

/** Schrittweite eines Terminal-Tastendrucks auf den Sollwert. */
const STEP = 0.5;

export const climateTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as ClimateDevice;
  const writable = isWritable(dev);
  const active = dev.mode !== "off";

  return h(
    "div",
    {
      class: ["t-row", "t-climate", active && "is-on", !writable && "is-readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "climate",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(active ? "on" : "dead"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, ctx.nf(dev.setpoint, 1)),
        h(
          "span",
          { class: "t-unit" },
          ` ${dev.unit} ${tt(ctx, "skin.terminal.state.setpoint", "Soll")}`,
        ),
        h(
          "span",
          { class: "t-status" },
          ` · ${tt(ctx, "skin.terminal.state.current", "Ist")} ${ctx.nf(dev.current, 1)} ${dev.unit} · ${dev.mode}`,
        ),
      ]),
      h("span", { class: "t-cmds" }, [
        cmd(`[−]`, "setSetpoint", {
          arg: String(dev.setpoint - STEP),
          enabled: writable,
          ariaLabel: tt(ctx, "skin.terminal.cmd.cooler", "kälter"),
        }),
        cmd(`[+]`, "setSetpoint", {
          arg: String(dev.setpoint + STEP),
          enabled: writable,
          ariaLabel: tt(ctx, "skin.terminal.cmd.warmer", "wärmer"),
        }),
      ]),
    ],
  );
};
