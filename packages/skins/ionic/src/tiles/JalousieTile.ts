// @obs-visu-skins/ionic — jalousie (Lamellen-Jalousie) tile renderer.
//
// Pure Renderer: (d, t, ctx) => VNode. Golden rules — no state, no `d.x` writes;
// every operation is a host intent on `data-action` (+ `data-arg`). Port of
// reference/vue-ionic jalousie.js → VzJalousie.
//
// Semantics (CONTRACT JalousieDevice):
//   • position 0 % = auf/oben, 100 % = zu/unten (vertical rail: top = auf)
//   • slat 0 % = offen/flach, 100 % = geschlossen/senkrecht ⇒ 0–90°
//   • drive up/down + stop are host intents; status dots show true=rot/false=grün/null=grau
//   • locked blocks operation in the widget; unlock happens only in the detail
//   • `invert` is applied by the host before rendering — the skin reads display space

import { h, type VNode } from "vue";
import type { Ctx, Device, JalousieDevice, JalousieStatus, Tokens } from "@obs/visu-contract";
import { jalousieGlyph, slatAngleDeg } from "../glyphs/JalousieGlyph.js";
import { svgIcon } from "../icon.js";
import { eyebrowText, isWritable } from "../parts.js";
import { tt } from "../i18n.js";

const SLAT_STEP = 10;

function dotClass(val: boolean | null): string {
  return val === true ? "is-true" : val === false ? "is-false" : "is-unknown";
}

function posLabel(position: number, ctx: Ctx): string {
  if (position === 0) return tt(ctx, "skin.ionic.jalousie.posOpen", "Offen");
  if (position === 100) return tt(ctx, "skin.ionic.jalousie.posClosed", "Geschlossen");
  return tt(ctx, "skin.ionic.jalousie.posPartial", "Teilweise");
}

export function jalousieTile(d: Device, t: Tokens, ctx: Ctx): VNode {
  const dev = d as JalousieDevice;
  const locked = !!dev.locked;
  // writable === false (Host-Sperre) blockiert die Bedienung genau wie die Geräte-
  // Sperre `locked`: Slider/Tasten werden inert; nur openDetail (Ansicht) bleibt.
  const ro = !isWritable(dev);
  const blocked = locked || ro;
  const interactive = !blocked;
  const acc = t.accent(dev.accent);
  const moving = dev.moving ?? null;
  const statuses: readonly JalousieStatus[] = dev.statuses ?? [];

  // ── header ──
  const headChildren: VNode[] = [
    h("div", { class: "jal-title" }, [
      h("span", { class: "jal-eyebrow" }, eyebrowText(ctx, dev)),
      h("span", { class: "jal-label" }, ctx.hyphenate(dev.label)),
    ]),
  ];
  if (statuses.length) {
    headChildren.push(
      h(
        "div",
        { class: "jal-statuses" },
        statuses.map((s) =>
          h("span", { key: s.label, class: ["jal-dot", dotClass(s.val)] }, [
            h("i"),
            h("em", null, s.label),
          ]),
        ),
      ),
    );
  }

  // ── body: live window glyph + vertical position rail ──
  const windowChildren: VNode[] = [jalousieGlyph({ position: dev.position, slat: dev.slat })];
  if (blocked) {
    windowChildren.push(h("span", { class: "jal-locktag" }, svgIcon(ctx, dev, "lock", 14)));
  }
  windowChildren.push(
    h("div", { class: "jal-readout" }, [
      h("span", { class: "jal-pct" }, [String(Math.round(dev.position)), h("small", null, "%")]),
      h("span", { class: "jal-sub" }, posLabel(dev.position, ctx)),
    ]),
  );
  if (moving) {
    windowChildren.push(
      h("div", { class: "jal-moving" }, [
        svgIcon(ctx, dev, moving === "up" ? "chev-up" : "chev-down"),
        ` ${tt(ctx, "skin.ionic.jalousie.moving", "fährt …")}`,
      ]),
    );
  }

  const body = h("div", { class: "jal-body" }, [
    // window opens the detail (Details · Sperre)
    h(
      "div",
      {
        class: ["jal-window", moving && "moving"].filter(Boolean),
        "data-action": "openDetail",
        // Tastatur-Erreichbarkeit des Details: fokussierbarer Button-Träger (Enter
        // öffnet). Nur dieser Träger, nicht die Wurzel (die Slider/Buttons enthält),
        // wird fokussierbar – verschachtelte Interaktive vermeiden.
        role: "button",
        tabindex: 0,
        "aria-label": tt(ctx, "skin.ionic.jalousie.detailHint", "Details"),
        title: tt(ctx, "skin.ionic.jalousie.detailHint", "Details · Sperre"),
      },
      windowChildren,
    ),
    // vertical position track (oben = auf/0 %, unten = zu/100 %)
    h("div", { class: "jal-posrail" }, [
      h("div", { class: "jal-rail-cap top" }, tt(ctx, "skin.ionic.jalousie.railTop", "auf")),
      h("input", {
        class: "jal-vtrack",
        type: "range",
        min: 0,
        max: 100,
        value: Math.round(dev.position),
        disabled: !interactive,
        "data-action": interactive ? "setPosition" : undefined,
        role: "slider",
        "aria-valuenow": Math.round(dev.position),
        "aria-label": tt(ctx, "skin.ionic.jalousie.position", "Position"),
      }),
      h("div", { class: "jal-rail-cap bot" }, tt(ctx, "skin.ionic.jalousie.railBot", "zu")),
    ]),
  ]);

  // ── lamella control (slider 0–100 ⇒ 0–90° + open/close step buttons) ──
  const slatCtl = h("div", { class: "jal-slatctl" }, [
    h(
      "button",
      {
        class: "jal-slatbtn",
        type: "button",
        disabled: !interactive,
        "data-action": interactive ? "setSlat" : undefined,
        "data-arg": interactive ? String(-SLAT_STEP) : undefined,
        "data-relative": "1",
        "aria-label": tt(ctx, "skin.ionic.jalousie.slatOpen", "Lamelle öffnen"),
      },
      [h("span", { class: "jal-slatglyph open" })],
    ),
    h("div", { class: "jal-slattrack" }, [
      h("input", {
        class: "jal-hslider",
        type: "range",
        min: 0,
        max: 100,
        value: dev.slat,
        disabled: !interactive,
        "data-action": interactive ? "setSlat" : undefined,
        "aria-label": tt(ctx, "skin.ionic.jalousie.slatAngle", "Lamellenwinkel"),
      }),
      h("span", { class: "jal-slatval" }, `${slatAngleDeg(dev.slat)}°`),
    ]),
    h(
      "button",
      {
        class: "jal-slatbtn",
        type: "button",
        disabled: !interactive,
        "data-action": interactive ? "setSlat" : undefined,
        "data-arg": interactive ? String(SLAT_STEP) : undefined,
        "data-relative": "1",
        "aria-label": tt(ctx, "skin.ionic.jalousie.slatClose", "Lamelle schließen"),
      },
      [h("span", { class: "jal-slatglyph close" })],
    ),
  ]);

  // ── drive buttons: up / stop / down (host maps press semantics) ──
  const driveBtns = h("div", { class: "jal-btns" }, [
    h(
      "button",
      {
        class: ["jal-btn", "up", moving === "up" && "active"].filter(Boolean),
        type: "button",
        disabled: !interactive,
        "data-action": interactive ? "setPosition" : undefined,
        "data-arg": interactive ? "0" : undefined,
        "aria-label": tt(ctx, "skin.ionic.jalousie.driveUp", "hoch (halten)"),
      },
      svgIcon(ctx, dev, "chev-up"),
    ),
    h(
      "button",
      {
        class: "jal-btn stop",
        type: "button",
        disabled: !interactive,
        "data-action": interactive ? "stop" : undefined,
        "aria-label": tt(ctx, "skin.ionic.jalousie.stop", "Stop"),
      },
      [h("span", { class: "jal-stopsq" })],
    ),
    h(
      "button",
      {
        class: ["jal-btn", "down", moving === "down" && "active"].filter(Boolean),
        type: "button",
        disabled: !interactive,
        "data-action": interactive ? "setPosition" : undefined,
        "data-arg": interactive ? "100" : undefined,
        "aria-label": tt(ctx, "skin.ionic.jalousie.driveDown", "runter (halten)"),
      },
      svgIcon(ctx, dev, "chev-down"),
    ),
  ]);

  return h(
    "div",
    {
      class: ["jal-tile", locked && "locked", ro && "readonly"].filter(Boolean),
      // Hülle: vivider Akzent läuft nur in die 4px-Deko-Topbar (--acc-bar), Text/
      // Icons behalten das AA-abgeleitete --acc — identische Akzent-Semantik wie die
      // vz-tile-Kacheln (Rolladen/Licht/…). Die reiche Bedienzone bleibt jal-eigen.
      style: { "--acc": acc, "--acc-bar": `var(--vz-acc-${dev.accent})` },
    },
    [h("div", { class: "jal-head" }, headChildren), body, slatCtl, driveBtns],
  );
}
