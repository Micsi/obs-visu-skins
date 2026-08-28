// @obs-visu-skins/ionic — blind (Rollladen) tile renderer.
//
// Pure Renderer: (d, t, ctx) => VNode. Golden rules — the skin owns no state and
// never writes `d.x`; operation is offered exclusively via host intents carried on
// `data-action`. Quelle: Design-System-Vorlage (Widget-Bibliothek → „Rollladen
// (Slider, Lock)"): die Kachel ist rein anzeigend — eyebrow (room) · label · body =
// Rollladen-Glyph (Shade-Füllung ∝ position) · foot = position % und Offen/Zu/Teil.
// Alle Bedienelemente (Slider, Schritt/Öffnen/Schließen, Sperre) leben im Detail;
// die Kachel öffnet es via data-action="openDetail" (Long-press bzw. Tap). `locked`
// zeigt Schloss-Icon + Sperr-Schraffur; entsperrt wird nur auf der Detailfläche.

import { h, type VNode } from "vue";
import type { BlindDevice, Ctx, Device, Tokens } from "@obs/visu-contract";
import { blindGlyph } from "../glyphs/BlindGlyph.js";
import { eyebrowText, isWritable, lockOverlay } from "../parts.js";
import { tt } from "../i18n.js";

export function blindTile(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as BlindDevice;
  const locked = !!dev.locked;
  // writable === false (Host-Sperre) zeigt dasselbe Sperrmuster wie die Geräte-
  // Sperre `locked`; openDetail (nur Ansicht) bleibt in beiden Fällen erreichbar.
  const ro = !isWritable(dev);
  const showLock = locked || ro;
  const acc = t.accent(dev.accent);

  const children: VNode[] = showLock ? lockOverlay(ctx, dev) : [];

  children.push(
    h("div", { class: "vz-eyebrow" }, eyebrowText(ctx, dev)),
    h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
    h("div", { class: "vz-tile-body" }, [blindGlyph({ position: dev.position, w: 44, h: 34 })]),
    h("div", { class: "vz-tile-foot" }, [
      h("b", null, String(dev.position)),
      h("span", { class: "vz-unit" }, "%"),
      ` · ${posLabel(dev.position, ctx)}`,
    ]),
  );

  return h(
    "div",
    {
      class: ["vz-tile", "blind", locked && "locked", ro && "readonly"].filter(Boolean),
      style: { "--acc": acc, "--acc-bar": `var(--vz-acc-${dev.accent})` },
      // Anzeige-Kachel: Tap/Long-press öffnet das Detail (auch gesperrt — dort wird
      // entsperrt). Kein setPosition auf der Kachel (Ganzfahrt lebt im Detail).
      "data-action": "openDetail",
      role: "button",
      tabindex: 0,
      "aria-label": dev.label,
    },
    children,
  );
}

function posLabel(position: number, ctx: Ctx): string {
  if (position === 0) return tt(ctx, "skin.ionic.blind.posOpen", "Offen");
  if (position === 100) return tt(ctx, "skin.ionic.blind.posClosed", "Zu");
  return tt(ctx, "skin.ionic.blind.posPartial", "Teil");
}
