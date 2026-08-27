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
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";
import { crumbPath, isWritable } from "../parts.js";
import { presetRow } from "../presets/PositionPresets.js";

const STEP = 10;

function section(title: string, body: VNode | VNode[]): VNode {
  return h("div", null, [
    h("div", { class: "vz-section-h" }, title),
    ...(Array.isArray(body) ? body : [body]),
  ]);
}

function actionBtn(
  ctx: Ctx,
  dev: Device,
  icon: string,
  label: string,
  attrs: Record<string, unknown>,
  interactive: boolean,
  extraClass?: string,
): VNode {
  // Gesperrt (writable === false): keine Schreib-`data-action`, Button inert.
  const gated = interactive
    ? attrs
    : { ...attrs, "data-action": undefined, disabled: true, "aria-disabled": "true" };
  return h(
    "button",
    { class: ["vz-action", extraClass].filter(Boolean), type: "button", ...gated },
    [svgIcon(ctx, dev, icon, 18), label],
  );
}

export function blindDetail(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as BlindDevice;
  const acc = t.accent(dev.accent);
  const locked = !!dev.locked;
  // writable === false ⇒ gesperrt: Position/Schrittaktionen/Presets UND die
  // Sperre-Umschaltung (unlock/lock sind Schreibaktionen) sind inert. Der
  // Schließen-Button (Navigation) bleibt bedienbar.
  const interactive = isWritable(dev);
  // Vorgabepositionen datengetrieben (v1.6): der generische Preset-Renderer trägt die
  // Sperr-/Schreib-Semantik selbst; fehlen Presets, entfällt die Section ganz.
  const presetR = presetRow(dev, ctx);

  return h("div", { class: "vz-dialog", style: { "--acc": acc } }, [
    h("div", { class: "vz-dialog-bar" }),
    h("div", { class: "vz-dialog-head" }, [
      h("div", null, [
        h("div", { class: "vz-dialog-crumb" }, crumbPath(dev)),
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
        svgIcon(ctx, dev, "x", 20),
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
          disabled: interactive ? undefined : true,
          "data-action": interactive ? "setPosition" : undefined,
          "aria-disabled": interactive ? undefined : "true",
          "aria-label": tt(ctx, "skin.ionic.blind.position", "Position"),
        }),
      ),
      // Action grid — Icon + Label je Button (1:1 der Vorlage „Rollladen Ost").
      h("div", { class: "vz-action-grid" }, [
        actionBtn(
          ctx,
          dev,
          "chev-up",
          tt(ctx, "skin.ionic.blind.stepOpen", "Schritt auf"),
          {
            "data-action": "setPosition",
            "data-arg": String(-STEP),
            "data-relative": "1",
          },
          interactive,
        ),
        actionBtn(
          ctx,
          dev,
          "chev-uu",
          tt(ctx, "skin.ionic.blind.open", "Öffnen"),
          {
            "data-action": "setPosition",
            "data-arg": "0",
          },
          interactive,
        ),
        actionBtn(
          ctx,
          dev,
          "stop",
          tt(ctx, "skin.ionic.blind.stop", "Stopp"),
          { "data-action": "stop" },
          interactive,
          "full",
        ),
        actionBtn(
          ctx,
          dev,
          "chev-down",
          tt(ctx, "skin.ionic.blind.stepClose", "Schritt zu"),
          {
            "data-action": "setPosition",
            "data-arg": String(STEP),
            "data-relative": "1",
          },
          interactive,
        ),
        actionBtn(
          ctx,
          dev,
          "chev-dd",
          tt(ctx, "skin.ionic.blind.close", "Schließen"),
          {
            "data-action": "setPosition",
            "data-arg": "100",
          },
          interactive,
        ),
      ]),
      // Vorgabepositionen (v1.6, datengetrieben – nur wenn Presets vorliegen)
      ...(presetR
        ? [section(tt(ctx, "skin.ionic.blind.presets", "Vorgabepositionen"), presetR)]
        : []),
      // Sperre
      section(
        tt(ctx, "skin.ionic.common.lock", "Sperre"),
        h("div", { class: "vz-lockrow" }, [
          h("button", {
            class: ["vz-lock-toggle", locked && "is-on"].filter(Boolean),
            type: "button",
            role: "switch",
            "aria-checked": String(locked),
            disabled: interactive ? undefined : true,
            "data-action": interactive ? (locked ? "unlock" : "lock") : undefined,
            "aria-disabled": interactive ? undefined : "true",
            "aria-label": tt(ctx, "skin.ionic.common.lock", "Sperre"),
          }),
          h(
            "span",
            null,
            !interactive
              ? tt(ctx, "skin.ionic.common.readonlyHint", "Nicht schreibbar – Bedienung gesperrt")
              : locked
                ? tt(
                    ctx,
                    "skin.ionic.common.lockedHint",
                    "Gesperrt – Bedienung im Widget blockiert",
                  )
                : tt(ctx, "skin.ionic.common.unlocked", "Entsperrt"),
          ),
        ]),
      ),
    ]),
  ]);
}
