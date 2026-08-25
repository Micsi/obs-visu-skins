// Ionic-Skin · sensor — Kachel-Renderer (reine Funktion, VNode via Vue h()).
//
// Quelle: reference/vue-ionic/widgets.js (SENSOR-Zweig + Fuß) sowie Design-System-
// Vorlage (v1.4: „VOC Verlauf" Sparkline + Wetter/Strom-Akzent-Icon).
// Goldene Regeln: ein Skin besitzt nie State (1/4); der sensor ist reine Anzeige
// (manifest.widgets.sensor.actions === []) — keine data-action, kein emit, kein d.x=…
// Schreibgeschützt über `d`; Wert/Einheit via ctx.nf; ctx.warn markiert „erhöht“.
//
// Drei Ausprägungen (additiv, abwärtskompatibel):
//  1. `series` gesetzt → Verlauf/Chart (2×2): Wert + SVG-Sparkline + Fuß „min … · max …“.
//  2. sonst `icon` gesetzt → Akzent-Icon neben dem Wert (Vorlage: Wetter=Wolke, Strom=Blitz).
//  3. sonst → der bestehende 1×1-Sensor (zentrierter Wert), unverändert.

import { h, type VNode } from "vue";
import type { Ctx, Device, Renderer, SensorDevice, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";

/** Sparkline-Geometrie (nicht-uniformer viewBox, füllt die Kachelbreite). */
const CHART_W = 200;
const CHART_H = 70;
/** Vertikaler Rand, damit die Linie nicht am Rahmen klebt. */
const CHART_PAD = 4;

/** Wert + Einheit (ctx.nf) — geteilt von allen Ausprägungen. */
function valueGroup(dev: SensorDevice, ctx: Ctx, extraClass?: string): VNode {
  return h("div", { class: ["vz-val", extraClass].filter(Boolean), "data-fit": "" }, [
    h("span", { class: "vz-num l" }, ctx.nf(dev.value)),
    h("span", { class: "vz-unit lg" }, dev.unit),
  ]);
}

/**
 * Baut die beiden Sparkline-Pfade (Linie + gefüllte Fläche) aus der Zeitreihe.
 * X gleichverteilt über die Breite; Y linear aus [lo..hi] (min/max der Reihe bzw.
 * dev.min/dev.max) — hoher Wert oben. Flache Reihe (hi===lo) läuft auf Mittelhöhe.
 */
function sparklinePaths(
  series: readonly number[],
  lo: number,
  hi: number,
): {
  line: string;
  area: string;
} {
  const n = series.length;
  const span = hi - lo;
  const usable = CHART_H - 2 * CHART_PAD;
  const pt = (v: number, i: number): [number, number] => {
    const x = n === 1 ? 0 : (i / (n - 1)) * CHART_W;
    const frac = span === 0 ? 0.5 : (v - lo) / span;
    const y = CHART_PAD + (1 - frac) * usable;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  };
  const pts = series.map(pt);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const first = pts[0] ?? [0, CHART_H];
  const last = pts[pts.length - 1] ?? [CHART_W, CHART_H];
  const area = `${line} L${last[0]},${CHART_H} L${first[0]},${CHART_H} Z`;
  return { line, area };
}

/** Verlauf/Chart-Ausprägung (2×2): Wert oben links, Sparkline, min/max-Fuß. */
function chartTile(dev: SensorDevice, t: Tokens, ctx: Ctx, warn: boolean): VNode {
  const series = dev.series ?? [];
  const lo = dev.min ?? Math.min(...series);
  const hi = dev.max ?? Math.max(...series);
  const { line, area } = sparklinePaths(series, lo, hi);

  const spark = h(
    "svg",
    {
      class: "vz-spark",
      viewBox: `0 0 ${CHART_W} ${CHART_H}`,
      width: "100%",
      height: CHART_H,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
    },
    [
      h("path", { class: "vz-spark-area", d: area }),
      h("path", { class: "vz-spark-line", d: line }),
    ],
  );

  // Fuß „min 46 · max 288 ppm“ — die Kurzwörter min/max sind lokalisierbar, die
  // Zahlen kommen aus ctx.nf, damit sich kein untersetzter Platzhalter einschleicht.
  const minWord = tt(ctx, "skin.ionic.sensor.min", "min");
  const maxWord = tt(ctx, "skin.ionic.sensor.max", "max");
  const footText = `${minWord} ${ctx.nf(lo)} · ${maxWord} ${ctx.nf(hi)} ${dev.unit}`;

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--sensor", "vz-tile--chart", warn && "is-warn"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      role: "group",
      "aria-label": tt(ctx, "skin.ionic.sensor.aria", "Sensor"),
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body vz-chart-body" }, [
        valueGroup(dev, ctx, "vz-val--lead"),
        spark,
      ]),
      h("div", { class: "vz-tile-foot" }, [h("span", null, footText)]),
    ],
  );
}

/** Icon-Ausprägung: Akzent-Icon (ctx.icon) neben dem Wert; Fuß = Status. */
function iconTile(dev: SensorDevice, t: Tokens, ctx: Ctx, warn: boolean): VNode {
  const foot = dev.status
    ? h("div", { class: "vz-tile-foot" }, [
        h("span", { class: warn ? "vz-status is-warn" : "vz-status" }, dev.status),
      ])
    : null;

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--sensor", "vz-tile--sensor-icon", warn && "is-warn"].filter(
        Boolean,
      ),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      role: "group",
      "aria-label": tt(ctx, "skin.ionic.sensor.aria", "Sensor"),
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [
        h("div", { class: "vz-sensor-row" }, [
          h("span", { class: "vz-sensor-icon" }, svgIcon(ctx, dev, dev.icon as string, 34)),
          valueGroup(dev, ctx),
        ]),
      ]),
      foot,
    ],
  );
}

/**
 * sensor-Kachel: Wert + Einheit (ctx.nf), darunter ein Status-Fuß.
 * Liegt der Messwert außerhalb des Komfortbereichs (ctx.warn), wird die Kachel
 * als `is-warn` markiert und der Status-Fuß betont — reine Anzeige, keine Bedienung.
 * `series` schaltet auf den Verlauf/Chart, sonst `icon` auf die Icon-Ausprägung.
 */
export const SensorTile: Renderer = (d: Device, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SensorDevice;
  const warn = ctx.warn(dev);

  if (dev.series && dev.series.length > 1) return chartTile(dev, t, ctx, warn);
  if (dev.icon) return iconTile(dev, t, ctx, warn);

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
      "aria-label": tt(ctx, "skin.ionic.sensor.aria", "Sensor"),
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [valueGroup(dev, ctx)]),
      foot,
    ],
  );
};
