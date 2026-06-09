// @obs-visu-skins/ionic — blind (Rollladen) tile renderer.
//
// Pure Renderer: (d, t, ctx) => VNode. Golden rules — the skin owns no state and
// never writes `d.x`; operation is offered exclusively via host intents carried on
// `data-action` (+ `data-arg`). Port of reference/vue-ionic widgets.js (blind arm).
//
// Layout: eyebrow (room) · label · body = chevron stepper ±20 around the blind
// glyph (chev-down = schließen/+20, chev-up = öffnen/−20) · foot = position % and
// Offen/Zu/Teil. `locked` blocks operation in the widget (buttons disabled + lock
// veil); unlock happens only on the detail surface.

import { h, type VNode } from "vue";
import type { BlindDevice, Ctx, Device, Tokens } from "@obs/visu-contract";
import { blindGlyph } from "../glyphs/BlindGlyph.js";
import { tt } from "../i18n.js";

const STEP = 20;

export function blindTile(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as BlindDevice;
  const locked = !!dev.locked;
  const acc = t.accent(dev.accent);

  const children: VNode[] = [];

  if (locked) {
    children.push(
      h("span", { class: "vz-lock" }, ctx.icon(dev, "lock")),
      h("span", { class: "vz-lockveil" }),
    );
  }

  children.push(
    h("div", { class: "vz-eyebrow" }, dev.room),
    h("div", { class: "vz-label chip" }, ctx.hyphenate(dev.label)),
    h("div", { class: "vz-tile-body" }, [
      h("div", { class: "vz-blind-ctl" }, [
        // chev-down = schließen (+STEP toward 100/zu)
        h(
          "button",
          {
            class: "vz-chev",
            type: "button",
            disabled: locked,
            "data-action": locked ? undefined : "setPosition",
            "data-arg": locked ? undefined : String(STEP),
            "data-relative": "1",
            "aria-label": tt(ctx, "skin.ionic.blind.close", "schließen"),
          },
          ctx.icon(dev, "chev-down"),
        ),
        blindGlyph({ position: dev.position, w: 44, h: 34 }),
        // chev-up = öffnen (−STEP toward 0/auf)
        h(
          "button",
          {
            class: "vz-chev",
            type: "button",
            disabled: locked,
            "data-action": locked ? undefined : "setPosition",
            "data-arg": locked ? undefined : String(-STEP),
            "data-relative": "1",
            "aria-label": tt(ctx, "skin.ionic.blind.open", "öffnen"),
          },
          ctx.icon(dev, "chev-up"),
        ),
      ]),
    ]),
    h("div", { class: "vz-tile-foot" }, [
      h("b", null, String(dev.position)),
      h("span", { class: "vz-unit" }, "%"),
      ` · ${posLabel(dev.position, ctx)}`,
    ]),
  );

  return h(
    "div",
    {
      class: ["vz-tile", "blind", locked && "locked"].filter(Boolean),
      style: { "--acc": acc },
    },
    children,
  );
}

function posLabel(position: number, ctx: Ctx): string {
  if (position === 0) return tt(ctx, "skin.ionic.blind.posOpen", "Offen");
  if (position === 100) return tt(ctx, "skin.ionic.blind.posClosed", "Zu");
  return tt(ctx, "skin.ionic.blind.posPartial", "Teil");
}
