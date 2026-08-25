// Ionic-Skin · geteilte Fuß-/Crumb-Bausteine (v1.4).
//
// Goldene Regeln 1/4: reine Funktionen, kein State, kein `d.x = …`. Beide Helfer
// lesen ausschließlich `d` bzw. den Host-`ctx` und geben VNode-/Text-Bausteine
// zurück, damit alle Renderer denselben „fetten Fuß" und Crumb-Pfad teilen.

import { h, type VNode } from "vue";
import type { Ctx, Device } from "@obs/visu-contract";

/**
 * Fuß-Inhalt „fettes Zustandswort + gemuteter Rest" (Vorlage: `<b>Ein</b> — 45 %`).
 * Quelle ist zentral {@link Ctx.stateParts}; der sichtbare Text bleibt identisch zu
 * {@link Ctx.stateText} (Invariante: `word + rest === stateText`), nur die Struktur
 * trennt das fette Zustandswort vom gemuteten Rest. Leere Teile werden ausgelassen.
 */
export function stateFoot(ctx: Ctx, d: Device): (VNode | string)[] {
  const { word, rest } = ctx.stateParts(d);
  const out: (VNode | string)[] = [];
  if (word) out.push(h("b", null, word));
  if (rest) out.push(rest);
  return out;
}

/**
 * Crumb-Pfad des Detail-Kopfs (Vorlage: „Erdgeschoss / Bad"). Mit optionalem
 * {@link DeviceBase.floor} (v1.4) wird „<floor> / <room>" gezeigt, sonst nur der
 * Raum — kein Fork, reine Anzeige der Vertragsfelder.
 */
export function crumbPath(d: Device): string {
  return d.floor ? `${d.floor} / ${d.room}` : d.room;
}
