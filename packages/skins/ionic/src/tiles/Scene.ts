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
import { isWritable, lockedLabel, lockOverlay } from "../parts.js";

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

  // Akzent: aria-label muss die Szene benennen — sonst tragen mehrere Szenen-Kacheln
  // denselben Namen und assistive Technik kann sie nicht unterscheiden (das aria-label
  // überschreibt den sichtbaren Kindtext bei role="button").
  const sceneName = [dev.room, dev.label].filter(Boolean).join(" · ");
  // writable === false ⇒ gesperrt: keine activateScene-Schreibaktion, kein aktiver
  // Button, Schloss-Badge + Veil; aria kennzeichnet den Sperrzustand.
  const ro = !isWritable(dev);
  const ariaLabel = ro
    ? `${sceneName} – ${lockedLabel(ctx)}`
    : `${tr(ctx, "skin.ionic.scene.activate", "Szene aktivieren")}: ${sceneName}`;

  const children: (VNode | null)[] = ro ? [...lockOverlay(ctx, dev)] : [];
  children.push(
    h("div", { class: "vz-eyebrow" }, dev.room),
    h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
    h("div", { class: "vz-tile-body" }, [
      h(
        "span",
        { class: "vz-scene-icon", style: { color: "var(--acc)" } },
        svgIcon(ctx, dev, dev.icon, 28),
      ),
    ]),
    foot,
  );

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--scene", ro && "readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      role: ro ? undefined : "button",
      tabindex: ro ? undefined : "0",
      "data-action": ro ? undefined : "activateScene",
      "data-flash-ms": ro ? undefined : "600",
      "aria-disabled": ro ? "true" : undefined,
      "aria-label": ariaLabel,
    },
    children,
  );
};
