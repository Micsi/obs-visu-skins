// Ionic-Skin · sensor — Kachel-Renderer (reine Funktion, VNode via Vue h()).
//
// Quelle: reference/vue-ionic/widgets.js (SENSOR-Zweig + Fuß).
// Goldene Regeln: ein Skin besitzt nie State (1/4); der sensor ist reine Anzeige
// (manifest.widgets.sensor.actions === []) — keine data-action, kein emit, kein d.x=…
// Schreibgeschützt über `d`; Wert/Einheit via ctx.nf; ctx.warn markiert „erhöht“.
// User-Strings über ctx.t(key) mit Fallback; Akzent über t.accent(d.accent).

import { h, type VNode } from "vue";
import type { Ctx, Device, Renderer, SensorDevice, Tokens } from "@obs/visu-contract";

/** Übersetzt einen Skin-Locale-Key mit Fallback (ctx.t ist optional, v1.1). */
const tr = (ctx: Ctx, key: string, fallback: string): string =>
  (ctx.t ? ctx.t(key) : fallback) || fallback;

/**
 * sensor-Kachel: Wert + Einheit (ctx.nf), darunter ein Status-Fuß.
 * Liegt der Messwert außerhalb des Komfortbereichs (ctx.warn), wird die Kachel
 * als `is-warn` markiert und der Status-Fuß betont — reine Anzeige, keine Bedienung.
 */
export const SensorTile: Renderer = (d: Device, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SensorDevice;
  const warn = ctx.warn(dev);

  const body = h("div", { class: "vz-val", "data-fit": "" }, [
    h("span", { class: "vz-num l" }, ctx.nf(dev.value)),
    h("span", { class: "vz-unit lg" }, dev.unit),
  ]);

  const foot = dev.status
    ? h("div", { class: "vz-tile-foot" }, [
        h("span", { class: warn ? "vz-status is-warn" : "vz-status" }, dev.status),
      ])
    : null;

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--sensor", warn && "is-warn"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      role: "group",
      "aria-label": tr(ctx, "skin.ionic.sensor.aria", "Sensor"),
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [body]),
      foot,
    ],
  );
};
