// Ionic-Skin · Detail-Renderer für `light` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: reference/vue-ionic/dialogs.js
// (kind === 'light'). Kopf (Raum · Titel · Wert · Schließen) + Helligkeits-Slider
// (ion-range) + Schnellaktionen (Aus/Voll) + Szenen-Presets (Gemütlich/Lesen/Arbeit).
// Kein State im Skin: der Slider trägt data-action="setDim" und die Buttons
// data-action="setDim"/"close" mit data-arg; der Host übersetzt das auf die
// kanonischen Aktionen und besitzt den State (Goldene Regel 4 — niemals `d.x = …`).
// User-Strings über `ctx.t` mit deutschem Fallback (skin.ionic.light.*).

import { h, type VNode } from "vue";
import type { Ctx, LightDevice, Renderer, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";

function preset(ctx: Ctx, key: string, fallback: string, value: number): VNode {
  return h(
    "button",
    {
      class: "vz-preset",
      type: "button",
      "data-action": "setDim",
      "data-arg": String(value),
    },
    tt(ctx, key, fallback),
  );
}

export const LightDetail: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as LightDevice;
  const dim = dev.dim ?? (dev.on ? 100 : 0);
  const val =
    dev.dim != null
      ? `${dev.dim} %`
      : tt(ctx, dev.on ? "skin.ionic.light.on" : "skin.ionic.light.off", dev.on ? "Ein" : "Aus");
  return h(
    "div",
    { class: "vz-dialog", style: { "--acc": t.accent(dev.accent) }, "data-type": "light" },
    [
      h("div", { class: "vz-dialog-bar" }),
      // Kopf 1:1 aus der Vorlage: Breadcrumb links · zentrierter Titel + Wert ·
      // Schließen rechts (Layout via `.vz-dialog[data-type="light"]`-Regeln, light-scoped).
      h("div", { class: "vz-dialog-head" }, [
        h("div", { class: "vz-dialog-crumb" }, dev.room),
        h("div", { class: "vz-light-titlewrap" }, [
          h("h2", { class: "vz-dialog-title" }, dev.label),
          h("div", { class: "vz-dialog-val" }, val),
        ]),
        h(
          "button",
          {
            class: "vz-iconbtn",
            type: "button",
            "data-action": "close",
            "aria-label": tt(ctx, "skin.ionic.common.close", "schließen"),
          },
          svgIcon(ctx, dev, "x", 20),
        ),
      ]),
      h("div", { class: "vz-dialog-body" }, [
        // Hero-Glühbirne — Geometrie 1:1 aus der Vorlage (drei Pfade, 64×64).
        // Farbe/Glow folgen der Helligkeit: leuchtet ab dim > 0 im Akzent.
        h("div", { class: "vz-hero" }, [
          h(
            "svg",
            {
              width: 64,
              height: 64,
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": 1.6,
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "aria-hidden": "true",
              style:
                dim > 0
                  ? "color:var(--acc);filter:drop-shadow(0 0 16px var(--acc))"
                  : "color:var(--vz-fg-mute)",
            },
            [
              h("path", { d: "M9 18h6" }),
              h("path", { d: "M10 21h4" }),
              h("path", {
                d: "M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.5 1.5 2.5v.6h4v-.6c0-1 .7-1.9 1.5-2.5A6 6 0 0 0 12 3z",
              }),
            ],
          ),
        ]),
        // Helligkeit
        h("div", {}, [
          h("div", { class: "vz-section-h" }, tt(ctx, "skin.ionic.light.brightness", "Helligkeit")),
          h("ion-range", {
            value: dim,
            min: 0,
            max: 100,
            pin: true,
            "data-action": "setDim",
            "aria-label": tt(ctx, "skin.ionic.light.brightness", "Helligkeit"),
          }),
        ]),
        // Aus / Voll
        h("div", { class: "vz-action-grid" }, [
          h(
            "button",
            { class: "vz-action", type: "button", "data-action": "setDim", "data-arg": "0" },
            tt(ctx, "skin.ionic.light.off", "Aus"),
          ),
          h(
            "button",
            { class: "vz-action", type: "button", "data-action": "setDim", "data-arg": "100" },
            tt(ctx, "skin.ionic.light.full", "Voll"),
          ),
        ]),
        // Szenen-Presets
        h("div", {}, [
          h("div", { class: "vz-section-h" }, tt(ctx, "skin.ionic.light.scenes", "Szenen")),
          h("div", { class: "vz-preset-row" }, [
            preset(ctx, "skin.ionic.light.cozy", "Gemütlich", 20),
            preset(ctx, "skin.ionic.light.read", "Lesen", 60),
            preset(ctx, "skin.ionic.light.work", "Arbeit", 100),
          ]),
        ]),
      ]),
    ],
  );
};
