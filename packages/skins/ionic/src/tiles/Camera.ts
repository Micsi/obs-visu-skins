// Ionic-Skin · camera — Kachel-Renderer (reine Funktion, VNode via Vue h()).
//
// Vertrag v1.2: CameraDevice { online, snapshotUrl, streamUrl? }.
// Goldene Regeln: ein Skin besitzt nie State (1/4) — der Renderer markiert nur die
// kanonische Aktion refresh über data-action; der Host übersetzt die Geste, holt
// ein frisches Standbild und besitzt den State. Schreibgeschützt über `d` (nie
// d.x=…). Fallback/Platzhalter, wenn offline oder snapshotUrl null ist.

import { h, type VNode } from "vue";
import type { CameraDevice, Ctx, Device, Renderer, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";

/** Standbild bei online + snapshotUrl, sonst Platzhalter mit Kamera-Glyph. */
function feed(dev: CameraDevice, ctx: Ctx): VNode {
  if (dev.online && dev.snapshotUrl) {
    return h("img", {
      class: "vz-cam-feed",
      src: dev.snapshotUrl,
      alt: "",
      "aria-hidden": "true",
      loading: "lazy",
    });
  }
  return h(
    "div",
    { class: "vz-cam-placeholder", "aria-hidden": "true" },
    svgIcon(ctx, dev, "cam", 24),
  );
}

export const CameraTile: Renderer = (d: Device, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as CameraDevice;
  const acc = t.accent(dev.accent);
  const stateText = dev.online
    ? tt(ctx, "skin.ionic.camera.online", "Live")
    : tt(ctx, "skin.ionic.camera.offline", "Offline");

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--camera", dev.online && "is-online"].filter(Boolean),
      style: { "--acc": acc },
      role: "group",
      "aria-label": `${tt(ctx, "skin.ionic.camera.aria", "Kamera")}: ${[dev.room, dev.label].filter(Boolean).join(" · ")}`,
    },
    [
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-cam-view" }, [
        feed(dev, ctx),
        h(
          "button",
          {
            class: "vz-cam-refresh",
            type: "button",
            "data-action": "refresh",
            "aria-label": tt(ctx, "skin.ionic.camera.refresh", "Aktualisieren"),
          },
          svgIcon(ctx, dev, "refresh", 16),
        ),
      ]),
      h("div", { class: "vz-tile-foot" }, [
        h("span", { class: dev.online ? "vz-cam-dot is-online" : "vz-cam-dot" }),
        ` ${stateText}`,
      ]),
    ],
  );
};
