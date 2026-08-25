// @obs-visu-skins/ionic — jalousie detail surface renderer.
//
// Pure Renderer: (d, t, ctx) => VNode. No state, no `d.x` writes; every control
// emits a host intent via `data-action` (+ `data-arg`). Port of
// reference/vue-ionic dialogs.js → jalousie arm.
//
// Sections: hero glyph · Position-Slider (0 %=auf, 100 %=zu) · Lamellenwinkel-Slider
// (0–100 ⇒ 0–90°) · Öffnen/Schließen · Status-Ampel (true=rot/false=grün/null=grau)
// · Sperre (lock/unlock toggle — Entsperren passiert hier, nicht im Widget).

import { h, type VNode } from "vue";
import type { Ctx, Device, JalousieDevice, JalousieStatus, Tokens } from "@obs/visu-contract";
import { jalousieGlyph, slatAngleDeg } from "../glyphs/JalousieGlyph.js";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";
import { crumbPath } from "../parts.js";

function dotClass(val: boolean | null): string {
  return val === true ? "is-true" : val === false ? "is-false" : "is-unknown";
}

function statusWord(val: boolean | null, ctx: Ctx): string {
  if (val === true) return tt(ctx, "skin.ionic.jalousie.statusActive", "aktiv");
  if (val === false) return tt(ctx, "skin.ionic.jalousie.statusOk", "ok");
  return tt(ctx, "skin.ionic.jalousie.statusUnknown", "unbek.");
}

function section(title: VNode | string, body: VNode | VNode[]): VNode {
  return h("div", null, [
    typeof title === "string" ? h("div", { class: "vz-section-h" }, title) : title,
    ...(Array.isArray(body) ? body : [body]),
  ]);
}

export function jalousieDetail(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as JalousieDevice;
  const acc = t.accent(dev.accent);
  const locked = !!dev.locked;
  // Gesperrt = nur Entsperren ist erlaubt; Bewegungs-Intents (setPosition/setSlat)
  // dürfen die Sperre nicht umgehen — die Detailfläche enforced dieselbe Sperre wie
  // das Widget. Steuerelemente werden disabled und tragen kein data-action.
  const interactive = !locked;
  const statuses: readonly JalousieStatus[] = dev.statuses ?? [];

  const body: VNode[] = [
    h("div", { class: "vz-hero" }, [jalousieGlyph({ position: dev.position, slat: dev.slat })]),
    // Position
    section(
      h("div", { class: "vz-section-h" }, [
        tt(ctx, "skin.ionic.jalousie.position", "Position"),
        h(
          "span",
          { class: "vz-section-note" },
          tt(ctx, "skin.ionic.jalousie.posHint", "· 0 %=auf, 100 %=zu"),
        ),
      ]),
      h("input", {
        class: "vz-range",
        type: "range",
        min: 0,
        max: 100,
        value: dev.position,
        disabled: !interactive,
        "data-action": interactive ? "setPosition" : undefined,
        "aria-label": tt(ctx, "skin.ionic.jalousie.position", "Position"),
      }),
    ),
  ];

  // Lamella slider — only for true jalousie mode
  if (dev.mode === "jalousie") {
    body.push(
      section(
        h("div", { class: "vz-section-h" }, [
          tt(ctx, "skin.ionic.jalousie.slatAngle", "Lamellenwinkel"),
          h("span", { class: "vz-section-note" }, `· ${slatAngleDeg(dev.slat)}°`),
        ]),
        h("input", {
          class: "vz-range",
          type: "range",
          min: 0,
          max: 100,
          value: dev.slat,
          disabled: !interactive,
          "data-action": interactive ? "setSlat" : undefined,
          "aria-label": tt(ctx, "skin.ionic.jalousie.slatAngle", "Lamellenwinkel"),
        }),
      ),
    );
  }

  // Öffnen / Schließen — Icon + Label wie im Rollladen-Detail (Design-System-Parität).
  body.push(
    h("div", { class: "vz-action-grid" }, [
      h(
        "button",
        {
          class: "vz-action",
          type: "button",
          disabled: !interactive,
          "data-action": interactive ? "setPosition" : undefined,
          "data-arg": interactive ? "0" : undefined,
        },
        [svgIcon(ctx, dev, "chev-uu", 18), tt(ctx, "skin.ionic.jalousie.open", "Öffnen")],
      ),
      h(
        "button",
        {
          class: "vz-action",
          type: "button",
          disabled: !interactive,
          "data-action": interactive ? "setPosition" : undefined,
          "data-arg": interactive ? "100" : undefined,
        },
        [svgIcon(ctx, dev, "chev-dd", 18), tt(ctx, "skin.ionic.jalousie.close", "Schließen")],
      ),
    ]),
  );

  // Status list
  if (statuses.length) {
    body.push(
      section(
        tt(ctx, "skin.ionic.jalousie.status", "Status"),
        h(
          "div",
          { class: "vz-status-list" },
          statuses.map((s) =>
            h("span", { key: s.label, class: "vz-status-item" }, [
              h("span", { class: ["jal-dot", dotClass(s.val)] }, [h("i")]),
              s.label,
              h("small", null, statusWord(s.val, ctx)),
            ]),
          ),
        ),
      ),
    );
  }

  // Sperre
  body.push(
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
  );

  return h("div", { class: "vz-dialog", style: { "--acc": acc } }, [
    h("div", { class: "vz-dialog-bar" }),
    h("div", { class: "vz-dialog-head" }, [
      h("div", null, [
        h("div", { class: "vz-dialog-crumb" }, crumbPath(dev)),
        h("h2", { class: "vz-dialog-title" }, dev.label),
        h("div", { class: "vz-dialog-val" }, `${dev.position} % · ${slatAngleDeg(dev.slat)}°`),
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
    h("div", { class: "vz-dialog-body" }, body),
  ]);
}
