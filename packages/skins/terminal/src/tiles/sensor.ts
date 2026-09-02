// Terminal-Skin · sensor — Listen-Zeilen-Renderer (reine Funktion, VNode via Vue h()).
//
// Read-only: manifest.json → widgets.sensor.actions === []; der Vertrag kennt für
// sensor ebenfalls keine Aktion → Stufe `display` (Anzeige vollständig, nichts zu
// bedienen). KEINE data-action, kein emit, nie d.x=… (Goldene Regeln 1/4).
//
// Zeile: "● Raum · Label   <287> ppm ▁▄█▆▅ · erhöht   min 46 · max 288".
// Die Zeitreihe (Vertrag v1.4 `series`) wird als Inline-Sparkline gezeigt, `min`/`max`
// als Fuß — beides additiv: fehlen sie, bleibt die schlichte Wert-Zeile.

import { h, type VNode } from "vue";
import type { Ctx, Renderer, SensorDevice, Tokens } from "@obs/visu-contract";
import { rowLabel, rowLed, sparkline } from "../row.js";

export const sensorTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SensorDevice;
  const warn = ctx.warn(dev);
  const spark = dev.series ? sparkline(dev.series) : null;
  const hasRange = typeof dev.min === "number" && typeof dev.max === "number";

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
      rowLed(warn ? "warn" : "off"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, ctx.nf(dev.value)),
        h("span", { class: "t-unit" }, ` ${dev.unit}`),
        spark,
        dev.status
          ? h("span", { class: warn ? "t-status is-warn" : "t-status" }, ` · ${dev.status}`)
          : null,
      ]),
      hasRange
        ? h(
            "span",
            { class: "t-minmax" },
            `min ${ctx.nf(dev.min as number)} · max ${ctx.nf(dev.max as number)}`,
          )
        : null,
    ],
  );
};
