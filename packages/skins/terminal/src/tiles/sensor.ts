// Terminal-Skin · sensor — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Read-only: manifest.json → widgets.sensor.actions === [] — KEINE data-action,
// kein emit, nie d.x=… (Goldene Regeln 1/4). Aufbau: "Raum · Label   <wert> <einheit>
// [status]". Liegt der Messwert außerhalb des Komfortbereichs (ctx.warn), wird die
// Zeile als `is-warn` markiert und der Status betont. Wert via ctx.nf.

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SensorDevice, Tokens } from "@obs/visu-contract";
import { rowLabel } from "../row.js";

export const sensorTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SensorDevice;
  const warn = ctx.warn(dev);

  return h(
    "div",
    {
      class: ["t-row", "t-sensor", warn && "is-warn"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "sensor",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLabel(ctx, dev.room, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, ctx.nf(dev.value)),
        h("span", { class: "t-unit" }, ` ${dev.unit}`),
        dev.status
          ? h("span", { class: warn ? "t-status is-warn" : "t-status" }, ` · ${dev.status}`)
          : null,
      ]),
    ],
  );
};
