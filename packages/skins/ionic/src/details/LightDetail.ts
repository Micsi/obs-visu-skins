// Ionic-Skin · Detail-Renderer für `light` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: reference/vue-ionic/dialogs.js
// (kind === 'light'). Helligkeits-Slider (ion-range) + Schnellaktionen (Aus/Voll)
// + Szenen-Presets (Gemütlich/Lesen/Arbeit). Kein State im Skin: der Slider trägt
// data-action="setDim" und die Buttons data-action="setDim"/"toggle" mit
// data-value; der Host übersetzt das auf die kanonischen Aktionen und besitzt den
// State (Goldene Regel 4 — niemals `d.x = …`). User-Strings über `ctx.t` mit
// deutschem Fallback (skin.ionic.light.*).

import { h, type VNode } from "vue";
import type { Ctx, LightDevice, Renderer, Tokens } from "@obs/visu-contract";

/** ctx.t mit Fallback — wenn kein Übersetzer injiziert ist, gilt der deutsche Literal. */
function tr(ctx: Ctx, key: string, fallback: string): string {
  return ctx.t ? ctx.t(key) : fallback;
}

function preset(ctx: Ctx, key: string, fallback: string, value: number): VNode {
  return h(
    "button",
    {
      class: "vz-preset",
      type: "button",
      "data-action": "setDim",
      "data-value": String(value),
    },
    tr(ctx, key, fallback),
  );
}

export const LightDetail: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as LightDevice;
  const dim = dev.dim ?? (dev.on ? 100 : 0);
  return h(
    "div",
    { class: "vz-dialog", style: { "--acc": t.accent(dev.accent) }, "data-type": "light" },
    [
      // Hero-Glühbirne
      h("div", { class: "vz-hero" }, [
        h(
          "svg",
          { width: 64, height: 64, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
          [
            h("path", {
              d: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1 1.15 1.1 1.9l.1.8h4.8l.1-.8c.1-.75.5-1.45 1.1-1.9A6 6 0 0 0 12 3Z",
              stroke: "currentColor",
              "stroke-width": 1.6,
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              style:
                dim > 0
                  ? "color:var(--acc);filter:drop-shadow(0 0 18px var(--acc))"
                  : "color:var(--vz-fg-mute)",
            }),
          ],
        ),
      ]),
      // Helligkeit
      h("div", {}, [
        h("div", { class: "vz-section-h" }, tr(ctx, "skin.ionic.light.brightness", "Helligkeit")),
        h("ion-range", {
          value: dim,
          min: 0,
          max: 100,
          pin: true,
          "data-action": "setDim",
          "aria-label": tr(ctx, "skin.ionic.light.brightness", "Helligkeit"),
        }),
      ]),
      // Aus / Voll
      h("div", { class: "vz-action-grid" }, [
        h(
          "button",
          { class: "vz-action", type: "button", "data-action": "setDim", "data-value": "0" },
          tr(ctx, "skin.ionic.light.off", "Aus"),
        ),
        h(
          "button",
          { class: "vz-action", type: "button", "data-action": "setDim", "data-value": "100" },
          tr(ctx, "skin.ionic.light.full", "Voll"),
        ),
      ]),
      // Szenen-Presets
      h("div", {}, [
        h("div", { class: "vz-section-h" }, tr(ctx, "skin.ionic.light.scenes", "Szenen")),
        h("div", { class: "vz-preset-row" }, [
          preset(ctx, "skin.ionic.light.cozy", "Gemütlich", 20),
          preset(ctx, "skin.ionic.light.read", "Lesen", 60),
          preset(ctx, "skin.ionic.light.work", "Arbeit", 100),
        ]),
      ]),
    ],
  );
};
