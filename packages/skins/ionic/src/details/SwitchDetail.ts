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
import { tt } from "../i18n.js";
import { dialogHead, isWritable } from "../parts.js";

export const SwitchDetail: Renderer = (d: Readonly<unknown>, t: Tokens, ctx: Ctx): unknown => {
  const dev = d as SwitchDevice;
  // writable === false ⇒ gesperrt: das toggle trägt keine Schreibaktion mehr.
  const interactive = isWritable(dev);

  return h(
    "div",
    { class: "vz-dialog", style: { "--acc": t.accent(dev.accent) }, "data-type": "switch" },
    [
      h("div", { class: "vz-dialog-bar" }),
      // Geteilter 3-Spalten-Kopf ohne Wert-Zeile (SwitchDevice trägt keinen Kopf-Wert).
      dialogHead(ctx, dev),
      h("div", { class: "vz-dialog-body" }, [
        // Lüfter-Toggle
        h("div", { style: "display:flex;align-items:center;gap:12px" }, [
          h("ion-toggle", {
            checked: dev.on,
            disabled: interactive ? undefined : true,
            "data-action": interactive ? "toggle" : undefined,
            "aria-disabled": interactive ? undefined : "true",
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
    ],
  );
};
