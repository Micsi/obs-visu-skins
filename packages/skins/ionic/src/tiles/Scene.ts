// Ionic-Skin · scene — Kachel-Renderer (reine Funktion, VNode via Vue h()).
//
// Quelle: reference/vue-ionic/widgets.js (SCENE-Zweig: Icon-Slot + Untertitel,
// sceneFlash 600 ms). Goldene Regeln: ein Skin besitzt nie State (1/4) — der
// Renderer markiert nur die kanonische Aktion `activateScene` via data-action;
// der Host übersetzt die Geste, besitzt den State und steuert den 600-ms-Flash.
// Schreibgeschützt über `d` (nie d.x=…). User-Strings über ctx.t(key) mit Fallback.

import { h, type VNode } from "vue";
import type { Ctx, Device, Renderer, SceneDevice, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";

/** Übersetzt einen Skin-Locale-Key mit Fallback (ctx.t ist optional, v1.1). */
const tr = (ctx: Ctx, key: string, fallback: string): string =>
  (ctx.t ? ctx.t(key) : fallback) || fallback;

/**
 * scene-Kachel: Icon-Slot (ctx.icon) + optionaler Untertitel.
 * `data-action="activateScene"` signalisiert dem Host die kanonische Aktion;
 * der Host setzt nach dem Auslösen für 600 ms `is-flashing` (CSS-Aufblitzen).
 * `data-flash-ms` deklariert die gewünschte Flash-Dauer — der Skin timt nichts selbst.
 */
export const SceneTile: Renderer = (d: Device, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as SceneDevice;

  const foot = dev.sub
    ? h("div", { class: "vz-tile-foot" }, [h("span", { class: "vz-sub" }, dev.sub)])
    : null;

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--scene"],
      style: { "--acc": t.accent(dev.accent) },
      role: "button",
      tabindex: "0",
      "data-action": "activateScene",
      "data-flash-ms": "600",
      "aria-label": tr(ctx, "skin.ionic.scene.activate", "Szene aktivieren"),
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [
        h("span", { class: "vz-scene-icon", style: { color: "var(--acc)" } }, svgIcon(ctx, dev, dev.icon, 28)),
      ]),
      foot,
    ],
  );
};
