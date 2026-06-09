// @obs-visu-skins/ionic — blind (Rollladen) detail surface renderer.
//
// Pure Renderer: (d, t, ctx) => VNode. No state, no `d.x` writes; every control
// emits a host intent via `data-action` (+ `data-arg`). Port of
// reference/vue-ionic dialogs.js → blind arm.
//
// Sections: hero glyph · Position-Slider · Aktionen (Schritt auf/Öffnen/Stopp/
// Schritt zu/Schließen) · Vorgabepositionen (presets) · Sperre (lock/unlock toggle).
// Position 0 % = auf, 100 % = zu.

import { h, type VNode } from "vue";
import type { BlindDevice, Ctx, Device, Tokens } from "@obs/visu-contract";
import { blindGlyph } from "../glyphs/BlindGlyph.js";
import { tt } from "../i18n.js";

const STEP = 10;

interface Preset {
  readonly key: string;
  readonly fallback: string;
  readonly pos: number;
}

const PRESETS: readonly Preset[] = [
  { key: "skin.ionic.blind.presetMorning", fallback: "Guten Morgen!", pos: 0 },
  { key: "skin.ionic.blind.presetSlit", fallback: "Spalt offen", pos: 85 },
  { key: "skin.ionic.blind.presetSlats", fallback: "Schlitze", pos: 70 },
];

function section(title: string, body: VNode | VNode[]): VNode {
  return h("div", null, [
    h("div", { class: "vz-section-h" }, title),
    ...(Array.isArray(body) ? body : [body]),
  ]);
}

function actionBtn(label: string, attrs: Record<string, unknown>, extraClass?: string): VNode {
  return h(
    "button",
    { class: ["vz-action", extraClass].filter(Boolean), type: "button", ...attrs },
    label,
  );
}

export function blindDetail(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as BlindDevice;
  const acc = t.accent(dev.accent);
  const locked = !!dev.locked;

  return h("div", { class: "vz-dialog", style: { "--acc": acc } }, [
    h("div", { class: "vz-dialog-bar" }),
    h("div", { class: "vz-dialog-head" }, [
      h("div", null, [
        h("div", { class: "vz-dialog-crumb" }, dev.room),
        h("h2", { class: "vz-dialog-title" }, dev.label),
        h("div", { class: "vz-dialog-val" }, `${dev.position} %`),
      ]),
      h(
        "button",
        {
          class: "vz-iconbtn",
          type: "button",
          "data-action": "close",
          "aria-label": tt(ctx, "skin.ionic.common.close", "schließen"),
        },
        ctx.icon(dev, "x"),
      ),
    ]),
    h("div", { class: "vz-dialog-body" }, [
      h("div", { class: "vz-hero" }, [blindGlyph({ position: dev.position, w: 60, h: 50 })]),
      // Position slider
      section(
        tt(ctx, "skin.ionic.blind.position", "Position"),
        h("input", {
          class: "vz-range",
          type: "range",
          min: 0,
          max: 100,
          value: dev.position,
          "data-action": "setPosition",
          "aria-label": tt(ctx, "skin.ionic.blind.position", "Position"),
        }),
      ),
      // Action grid
      h("div", { class: "vz-action-grid" }, [
        actionBtn(tt(ctx, "skin.ionic.blind.stepOpen", "Schritt auf"), {
          "data-action": "setPosition",
          "data-arg": String(-STEP),
          "data-relative": "1",
        }),
        actionBtn(tt(ctx, "skin.ionic.blind.open", "Öffnen"), {
          "data-action": "setPosition",
          "data-arg": "0",
        }),
        actionBtn(tt(ctx, "skin.ionic.blind.stop", "Stopp"), { "data-action": "stop" }, "full"),
        actionBtn(tt(ctx, "skin.ionic.blind.stepClose", "Schritt zu"), {
          "data-action": "setPosition",
          "data-arg": String(STEP),
          "data-relative": "1",
        }),
        actionBtn(tt(ctx, "skin.ionic.blind.close", "Schließen"), {
          "data-action": "setPosition",
          "data-arg": "100",
        }),
      ]),
      // Vorgabepositionen
      section(
        tt(ctx, "skin.ionic.blind.presets", "Vorgabepositionen"),
        h(
          "div",
          { class: "vz-preset-row" },
          PRESETS.map((p) =>
            h(
              "button",
              {
                key: p.key,
                class: "vz-preset",
                type: "button",
                "data-action": "setPosition",
                "data-arg": String(p.pos),
              },
              tt(ctx, p.key, p.fallback),
            ),
          ),
        ),
      ),
      // Sperre
      section(
        tt(ctx, "skin.ionic.common.lock", "Sperre"),
        h("div", { class: "vz-lockrow" }, [
          h("button", {
            class: ["vz-lock-toggle", locked && "is-on"].filter(Boolean),
            type: "button",
            role: "switch",
            "aria-checked": String(locked),
            "data-action": locked ? "unlock" : "lock",
            "aria-label": tt(ctx, "skin.ionic.common.lock", "Sperre"),
          }),
          h(
            "span",
            null,
            locked
              ? tt(ctx, "skin.ionic.common.lockedHint", "Gesperrt – Bedienung im Widget blockiert")
              : tt(ctx, "skin.ionic.common.unlocked", "Entsperrt"),
          ),
        ]),
      ),
    ]),
  ]);
}
