// Ionic-Skin · Detail-Renderer für `switch` (I2 · #5).
//
// Reine Funktion `(d, t, ctx) => VNode`. Quelle: reference/vue-ionic/dialogs.js
// (kind === 'fan'): Kopf (Raum · Titel · Schließen) + Lüftersteuerung als
// ion-toggle. Kein State im Skin: das Toggle trägt data-action="toggle", der
// Schließen-Button data-action="close"; der Host besitzt den State (Goldene
// Regel 4). User-Strings über `ctx.t` mit deutschem Fallback (skin.ionic.fan.*).
//
// Kein Verlaufschart: `SwitchDevice` liefert laut Vertrag nur `on` — eine
// VOC/ppm-Historie gibt es im Kontrakt nicht. Ein hartkodierter Demo-Verlauf wäre
// erfundene Telemetrie (Verstoss gegen „kein Datenfork je Skin"), darum wird hier
// nur gerendert, was aus den Vertragsdaten stammt.

import { h } from "vue";
import type { Ctx, Renderer, SwitchDevice, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";

export const SwitchDetail: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as SwitchDevice;

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
          "aria-label": tt(ctx, "skin.ionic.common.close", "schließen"),
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
          "aria-label": tt(ctx, "skin.ionic.fan.label", "Lüfter"),
        }),
        h(
          "span",
          { style: "font-weight:700;font-size:15px" },
          dev.on
            ? tt(ctx, "skin.ionic.fan.active", "Lüftersteuerung aktiv")
            : tt(ctx, "skin.ionic.fan.inactive", "Lüftersteuerung aus"),
        ),
      ]),
    ]),
  ]);
};
