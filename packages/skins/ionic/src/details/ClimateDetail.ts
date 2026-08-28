// Ionic-Skin · Detail-Renderer für `climate` (Klima/Heizung/RTR, v1.4).
//
// Reine Funktion `(d, t, ctx) => VNode`. Kein State im Skin (Goldene Regel 1/4):
// jede Bedienung markiert nur einen Host-Intent via `data-action` (+ `data-arg`),
// der Host übersetzt die Geste auf die kanonische Aktion `setSetpoint` und besitzt
// allein den State — der Skin schreibt niemals `d.x = …`.
//
// Aufbau (an LightDetail/BlindDetail angelehnt): Kopf (Crumb · Titel · SOLL-Wert ·
// Schließen) · Hero-Thermometer (Akzent bei heat/cool) · Sollwert-Stepper
// (−/+ als relative Schritte) + Sollwert-Slider (absolut) · Ist/Modus-Infozeile.

import { h, type VNode } from "vue";
import type { ClimateDevice, Ctx, Device, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";
import { dialogHead, isWritable } from "../parts.js";

/** Sollwert-Schrittweite eines −/+ Tipps sowie des Slider-Rasters (°). */
const STEP = 0.5;
/** Slider-Fenster für den Sollwert (°) — konservativer Komfortbereich. */
const MIN = 5;
const MAX = 30;

/** Deutsche Modus-Fallbacks (ohne Host-Translator); Reihenfolge = ClimateDevice.mode. */
const MODE_FALLBACK: Readonly<Record<ClimateDevice["mode"], string>> = {
  heat: "Heizen",
  cool: "Kühlen",
  off: "Aus",
  auto: "Auto",
};

function modeLabel(ctx: Ctx, mode: ClimateDevice["mode"]): string {
  return tt(ctx, `skin.ionic.climate.mode.${mode}`, MODE_FALLBACK[mode]);
}

function stepBtn(
  ctx: Ctx,
  dev: Device,
  icon: string,
  delta: number,
  label: string,
  interactive: boolean,
): VNode {
  return h(
    "button",
    {
      class: "vz-step-btn",
      type: "button",
      disabled: interactive ? undefined : true,
      "data-action": interactive ? "setSetpoint" : undefined,
      "data-arg": String(delta),
      "data-relative": "1",
      "aria-disabled": interactive ? undefined : "true",
      "aria-label": label,
    },
    svgIcon(ctx, dev, icon, 20),
  );
}

export function climateDetail(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as ClimateDevice;
  const acc = t.accent(dev.accent);
  // writable === false ⇒ gesperrt: Sollwert-Stepper und -Slider tragen keine
  // setSetpoint-Schreibaktion mehr; Schließen (Navigation) bleibt bedienbar.
  const interactive = isWritable(dev);
  // Das Thermometer glüht nur, wenn aktiv temperiert wird (heat/cool), nicht bei off.
  const active = dev.mode === "heat" || dev.mode === "cool";

  return h("div", { class: "vz-dialog", style: { "--acc": acc }, "data-type": "climate" }, [
    h("div", { class: "vz-dialog-bar" }),
    // Geteilter 3-Spalten-Kopf (Breadcrumb · zentrierter Titel+SOLL-Wert · Schließen).
    dialogHead(ctx, dev, `${ctx.nf(dev.setpoint)} ${dev.unit}`),
    h("div", { class: "vz-dialog-body" }, [
      h("div", { class: "vz-hero" }, [
        h("svg", {
          width: 64,
          height: 64,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 1.6,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "aria-hidden": "true",
          style: active
            ? "color:var(--acc);filter:drop-shadow(0 0 16px var(--acc))"
            : "color:var(--vz-fg-mute)",
          innerHTML: ctx.icon(dev, "thermo"),
        }),
      ]),
      // Sollwert-Stepper: −  große SOLL-Zahl  + (relative Schritte à STEP °).
      h("div", null, [
        h(
          "div",
          { class: "vz-section-h" },
          tt(ctx, "skin.ionic.climate.setpoint", "Solltemperatur"),
        ),
        h("div", { class: "vz-stepper" }, [
          stepBtn(
            ctx,
            dev,
            "minus",
            -STEP,
            tt(ctx, "skin.ionic.climate.lower", "kälter"),
            interactive,
          ),
          h("div", { class: "vz-stepper-val" }, [
            h("span", { class: "vz-stepper-num" }, ctx.nf(dev.setpoint)),
            h("span", { class: "vz-stepper-unit" }, dev.unit),
          ]),
          stepBtn(
            ctx,
            dev,
            "plus",
            STEP,
            tt(ctx, "skin.ionic.climate.raise", "wärmer"),
            interactive,
          ),
        ]),
        h("input", {
          class: "vz-range",
          type: "range",
          min: MIN,
          max: MAX,
          step: STEP,
          value: dev.setpoint,
          disabled: interactive ? undefined : true,
          "data-action": interactive ? "setSetpoint" : undefined,
          "aria-disabled": interactive ? undefined : "true",
          "aria-label": tt(ctx, "skin.ionic.climate.setpoint", "Solltemperatur"),
        }),
      ]),
      // Ist-Temperatur + Betriebsmodus (reine Anzeige).
      h("div", { class: "vz-climate-info" }, [
        h("span", null, [
          `${tt(ctx, "skin.ionic.climate.current", "Ist")} `,
          h("b", null, `${ctx.nf(dev.current)} ${dev.unit}`),
        ]),
        h("span", { class: "vz-climate-mode" }, modeLabel(ctx, dev.mode)),
      ]),
    ]),
  ]);
}
