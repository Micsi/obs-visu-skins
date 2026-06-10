// @obs-visu-skins/ionic — icon helper.
//
// `ctx.icon(dev, slot)` returns the RAW inner SVG markup (a body string, e.g.
// "<polyline .../>") from the contract default set. A Vue render function must
// inject that as element innerHTML — passing it as a child renders it as TEXT
// (the "<polyline points=…" leak). This wraps the body in a proper <svg>.
//
// Mirrors reference/vue-ionic/store.js → VzIcon (stroke by default; SOLID slots
// are filled). The glyph never owns colour — it inherits currentColor / --acc.

import { h, type VNode } from "vue";
import type { Ctx, Device } from "@obs/visu-contract";

/** Slots drawn filled rather than stroked (store.js SOLID set). */
const SOLID = new Set(["stop", "play", "pause", "skip", "sparkle"]);

/** Wrap a contract icon body into an <svg> VNode (innerHTML, never a text child). */
export function svgIcon(ctx: Ctx, dev: Device, slot: string, size = 18): VNode {
  return h("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: SOLID.has(slot) ? "currentColor" : "none",
    stroke: "currentColor",
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    style: "display:block;flex-shrink:0",
    innerHTML: ctx.icon(dev, slot),
  });
}
