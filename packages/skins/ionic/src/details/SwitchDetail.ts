// Ionic-Skin · Detail-Renderer für `switch` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: reference/vue-ionic/dialogs.js
// (kind === 'fan'): Kopf (Raum · Titel · Schließen) + Lüftersteuerung als
// ion-toggle + VOC-Verlaufschart (SVG-Sparkline mit Grid + ppm-Achse). Kein State
// im Skin: das Toggle trägt data-action="toggle", der Schließen-Button
// data-action="close"; der Host besitzt den State (Goldene Regel 4). User-Strings
// über `ctx.t` mit deutschem Fallback (skin.ionic.fan.*).

import { h } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";

/** VOC-Messreihe (ppm) — Demo-Verlauf aus der Referenz (dialogs.js → FAN_POINTS). */
const FAN_POINTS = [
  55, 54, 53, 55, 54, 53, 52, 51, 52, 51, 50, 49, 48, 49, 47, 46, 46, 48, 80, 180, 260, 288, 287,
];

const W = 460;
const H = 200;
const PAD = 28;

function tr(ctx: Ctx, key: string, fallback: string): string {
  return ctx.t ? ctx.t(key) : fallback;
}

/** Verlaufslinie als SVG-Pfad über die Chart-Geometrie. */
function fanPath(): string {
  const mn = Math.min(...FAN_POINTS);
  const mx = Math.max(...FAN_POINTS);
  return FAN_POINTS.map((v, i) => {
    const x = PAD + (i / (FAN_POINTS.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (v - mn) / (mx - mn)) * (H - PAD * 2);
    return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
}

export const SwitchDetail: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as SwitchDevice;
  const mn = Math.min(...FAN_POINTS);
  const mx = Math.max(...FAN_POINTS);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => PAD + f * (H - PAD * 2));
  const axis = [0, 1, 2, 3, 4].map((i) => ({
    y: PAD + (i * (H - PAD * 2)) / 4 + 3,
    v: Math.round(mn + (1 - i / 4) * (mx - mn)),
  }));

  return h("div", { class: "vz-dialog", style: { "--acc": t.accent(dev.accent) }, "data-type": "switch" }, [
    h("div", { class: "vz-dialog-bar" }),
    h("div", { class: "vz-dialog-head" }, [
      h("div", null, [
        h("div", { class: "vz-dialog-crumb" }, dev.room),
        h("h2", { class: "vz-dialog-title" }, dev.label),
      ]),
      h(
        "button",
        {
          class: "vz-iconbtn",
          type: "button",
          "data-action": "close",
          "aria-label": tr(ctx, "skin.ionic.common.close", "schließen"),
        },
        svgIcon(ctx, dev, "x", 20),
      ),
    ]),
    h("div", { class: "vz-dialog-body" }, [
      // Lüfter-Toggle
      h("div", { style: "display:flex;align-items:center;gap:12px" }, [
        h("ion-toggle", {
          checked: dev.on,
          "data-action": "toggle",
          "aria-label": tr(ctx, "skin.ionic.fan.label", "Lüfter"),
        }),
        h(
          "span",
          { style: "font-weight:700;font-size:15px" },
          dev.on
            ? tr(ctx, "skin.ionic.fan.active", "Lüftersteuerung aktiv")
            : tr(ctx, "skin.ionic.fan.inactive", "Lüftersteuerung aus"),
        ),
      ]),
      // VOC-Chart
      h("div", { class: "vz-chart-box" }, [
        h("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, "aria-hidden": "true" }, [
          ...gridLines.map((y, i) =>
            h("line", {
              key: `g${i}`,
              x1: PAD,
              x2: W - PAD,
              y1: y,
              y2: y,
              stroke: "var(--vz-divider)",
              "stroke-width": 1,
            }),
          ),
          h("path", {
            d: fanPath(),
            fill: "none",
            stroke: "var(--acc)",
            "stroke-width": 2.2,
            "stroke-linejoin": "round",
            "stroke-linecap": "round",
          }),
          h("circle", { cx: W - PAD, cy: PAD, r: 4, fill: "var(--acc)" }),
          ...axis.map((a, i) =>
            h(
              "text",
              {
                key: `a${i}`,
                x: 2,
                y: a.y,
                "font-size": 10,
                fill: "var(--vz-fg-mute)",
              },
              `${a.v} ppm`,
            ),
          ),
        ]),
        h("div", { class: "vz-legend" }, [
          h("span", {}, tr(ctx, "skin.ionic.fan.voc", "● VOC")),
          h(
            "span",
            { style: "color:var(--vz-acc-rose)" },
            tr(ctx, "skin.ionic.fan.control", "● Lüftersteuerung"),
          ),
        ]),
      ]),
    ]),
  ]);
};
