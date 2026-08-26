// Ionic-Skin · geteilte Fuß-/Crumb-Bausteine (v1.4).
//
// Goldene Regeln 1/4: reine Funktionen, kein State, kein `d.x = …`. Beide Helfer
// lesen ausschließlich `d` bzw. den Host-`ctx` und geben VNode-/Text-Bausteine
// zurück, damit alle Renderer denselben „fetten Fuß" und Crumb-Pfad teilen.

import { h, type VNode } from "vue";
import type { Ctx, Device } from "@obs/visu-contract";
import { svgIcon } from "./icon.js";
import { tt } from "./i18n.js";

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

/**
 * Geräte-Bedienbarkeit (Contract v1.5, {@link DeviceBase.writable}): `undefined`
 * bzw. `true` = bedienbar (Default, rückwärtskompatibel), `false` = vom Host als
 * nicht-schreibbar markiert (readonly-Seite ODER fehlendes Write-Recht). Ein
 * nicht-schreibbares Gerät darf keine Schreibaktion auslösen — die Renderer machen
 * ihre Bedien-Controls dann inert und markieren die Kachel sichtbar gesperrt.
 */
export function isWritable(d: Device): boolean {
  return d.writable !== false;
}

/**
 * Gesperrt-Overlay der `vz-tile`-Familie: Schloss-Badge + 45°-Schraffur-Veil,
 * identisch zum bestehenden Blind-Tile-Sperrmuster. Wird vorangestellt, wenn ein
 * Gerät gerätegesperrt (`locked`) oder nicht-schreibbar (`writable === false`) ist.
 * Rein dekorativ (Badge `aria-hidden` über {@link svgIcon}); die a11y-Semantik
 * tragen die Controls (`aria-disabled`/`disabled`) bzw. das Tile-`aria-label`.
 */
export function lockOverlay(ctx: Ctx, d: Device): VNode[] {
  return [
    h("span", { class: "vz-lock" }, svgIcon(ctx, d, "lock", 14)),
    h("span", { class: "vz-lockveil" }),
  ];
}

/** Lokalisiertes „gesperrt"-Wort für aria-Anreicherung nicht-bedienbarer Kacheln. */
export function lockedLabel(ctx: Ctx): string {
  return tt(ctx, "skin.ionic.common.readonly", "Gesperrt");
}
