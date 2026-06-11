// @obs-visu-skins/terminal — gemeinsame Zeilen-Bausteine für die Listen-Renderer.
//
// Terminal ist KEINE Glass-Kachel-Optik, sondern eine schlichte, kompakte
// Konsolen-/Listendarstellung: eine Zeile pro Gerät, monospace-orientiert,
// Aufbau "label · state · [aktion]". Diese Datei kapselt nur die wiederkehrende
// Zeilen-Struktur (Label-Spalte + State-Spalte); jeder Renderer bleibt eine
// reine Funktion und markiert seine Aktionen selbst via data-action/data-arg.

import { h, type VNode } from "vue";
import type { Ctx, Device } from "@obs/visu-contract";

/** Linke Spalte einer Zeile: Raum (eyebrow) + Label, weich getrennt. */
export function rowLabel(ctx: Ctx, room: string, label: string): VNode {
  return h("span", { class: "t-label" }, [
    h("span", { class: "t-room" }, room),
    h("span", { class: "t-sep" }, " · "),
    h("span", { class: "t-name" }, ctx.hyphenate(label)),
  ]);
}

/** Mittlere Spalte: aktueller Zustandstext (zentral aus ctx.stateText). */
export function rowState(d: Device, ctx: Ctx): VNode {
  return h("span", { class: "t-state" }, ctx.stateText(d));
}
