// Ionic-Skin · Kachel-Renderer für `climate` (Klima/Heizung/RTR, v1.4).
//
// Reine Funktion `(d, t, ctx) => VNode` — kein State, kein Datenfork (Goldene
// Regeln 1/4). Quelle: Design-System-Vorlage („KLIMA → Heizung"): eyebrow (room) ·
// label · body = große SOLL-Zahl (setpoint + Einheit) über der Akzent-Caption
// „SOLL" · foot = zentraler Zustandstext (ctx.stateText → „Heizen — 20,8°").
// Bedienung (Sollwert stellen) lebt im Detail; die Kachel öffnet es via
// data-action="openDetail". Der Skin schreibt niemals `d.x = …`.

import { h, type VNode } from "vue";
import type { ClimateDevice, Ctx, Device, Tokens } from "@obs/visu-contract";
import { tt } from "../i18n.js";
import { eyebrowText, isWritable, lockOverlay, stateFoot } from "../parts.js";

/**
 * climate-Kachel (2×2): SOLL-Temperatur groß, darunter die Akzent-Caption „SOLL";
 * der Fuß nennt zentral Modus + Ist-Temperatur (ctx.stateText). Reine Anzeige —
 * die kanonische Aktion `setSetpoint` lebt ausschließlich auf der Detailfläche;
 * die Kachel trägt nur `openDetail` (Host-Shell-Navigation, kein Core-Write).
 */
export function climateTile(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as ClimateDevice;
  // writable === false ⇒ gesperrt: die Sollwert-Bedienung im Detail ist blockiert;
  // die Kachel bleibt via openDetail nur ansehbar und trägt das Schloss-Badge + Veil.
  const ro = !isWritable(dev);
  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--climate", ro && "readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent), "--acc-bar": `var(--vz-acc-${dev.accent})` },
      "data-type": "climate",
      "data-action": "openDetail",
      role: "button",
      tabindex: 0,
      "aria-label": dev.label,
    },
    [
      ...(ro ? lockOverlay(ctx, dev) : []),
      h("div", { class: "vz-eyebrow" }, eyebrowText(ctx, dev)),
      h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
      h("div", { class: "vz-tile-body" }, [
        h("div", { class: "vz-climate-set" }, [
          h("span", { class: "vz-climate-num" }, ctx.nf(dev.setpoint)),
          h("span", { class: "vz-climate-unit" }, dev.unit),
        ]),
        h("div", { class: "vz-climate-soll" }, tt(ctx, "skin.ionic.climate.setpointShort", "Soll")),
      ]),
      h("div", { class: "vz-tile-foot" }, stateFoot(ctx, dev)),
    ],
  );
}
