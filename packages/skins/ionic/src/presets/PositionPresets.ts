// @obs-visu-skins/ionic – position presets (Positions-Presets) renderer.
//
// Pure Renderer building block: no state, no `d.x` writes; a preset button marks
// only the INDEX it targets via `data-arg`. The host reads `dev.presets[index]` and
// drives position (+ optional slat). blind and jalousie render IDENTICALLY here –
// only the index matters – so a single generic renderer serves both types.
//
// applyPreset semantics: `data-action="applyPreset"`, `data-arg="<index>"` (index into
// `dev.presets`). Gesperrt (`locked`) oder nicht schreibbar (`writable === false`) ⇒
// Buttons inert (disabled + aria-disabled) und OHNE `data-action` (kein Intent-Leak).

import { h, type VNode } from "vue";
import type { Ctx, Device, PositionPreset, Tokens } from "@obs/visu-contract";
import { tt } from "../i18n.js";
import { isWritable } from "../parts.js";

/** Schmale Sicht auf die v1.6-Preset-Felder (typ-übergreifend blind/jalousie). */
type PresetDevice = Device & {
  readonly presets?: readonly PositionPreset[];
  readonly locked?: boolean;
};

/**
 * Preset-Zeile: je ein Button pro `dev.presets`-Eintrag. Button-Text = `preset.label`
 * roh aus den Daten (kein i18n-Key, wie `dev.label`/`dev.room`). Gesperrt oder nicht
 * schreibbar ⇒ Button inert (disabled + aria-disabled) und OHNE `data-action` (kein
 * Intent-Leak). Ohne Presets ⇒ null (der Aufrufer lässt die Section dann weg).
 */
export function presetRow(d: Device, ctx: Ctx): VNode | null {
  const dev = d as PresetDevice;
  const presets = dev.presets;
  if (!presets || presets.length === 0) return null;
  const blocked = !!dev.locked || !isWritable(dev);
  // `ctx` gehört zur Renderer-Bausteinsignatur, wird hier aber nicht gebraucht: die
  // Labels kommen roh aus den Daten (kein i18n-Key), genau wie `dev.label`/`dev.room`.
  void ctx;
  return h(
    "div",
    { class: "vz-preset-row" },
    presets.map((p, i) =>
      h(
        "button",
        {
          key: `${i}:${p.label}`,
          class: "vz-preset",
          type: "button",
          disabled: blocked ? true : undefined,
          "aria-disabled": blocked ? "true" : undefined,
          "data-action": blocked ? undefined : "applyPreset",
          "data-arg": blocked ? undefined : String(i),
        },
        p.label,
      ),
    ),
  );
}

/**
 * Popover-Inhalt für den Preset-Schnellzugriff: Kopf (Titel „Positionen") plus die
 * {@link presetRow}. Ohne Presets zeigt das Popover einen gemuteten Leer-Hinweis.
 */
export function positionPresets(d: Device, _t: Tokens, ctx: Ctx): VNode {
  const row = presetRow(d, ctx);
  return h("div", { class: "vz-popover" }, [
    h("div", { class: "vz-popover-h" }, tt(ctx, "skin.ionic.common.positions", "Positionen")),
    row ??
      h(
        "div",
        { class: "vz-popover-empty" },
        tt(ctx, "skin.ionic.common.noPresets", "Keine Vorgaben"),
      ),
  ]);
}
