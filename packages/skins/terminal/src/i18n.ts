// @obs-visu-skins/terminal — kleiner i18n-Helfer für die Renderer.
//
// CONTRACT-v1.md §5: `ctx.t` ist ein optionaler, vom Host injizierter Übersetzer
// (v1.1). Ist er da, lösen die Renderer skin-eigene Schlüssel (`skin.terminal.*`)
// darüber auf; fehlt er, greift das deutsche Literal. Kern-Zustandstexte kommen
// weiterhin aus `ctx.stateText`/`ctx.stateParts` — hier stehen nur die
// terminal-eigenen Befehls-/Statuswörter. Spiegel von ionic/src/i18n.ts.

import type { Ctx } from "@obs/visu-contract";

/** Skin-String über den Host-Übersetzer auflösen, mit deutschem Fallback. */
export function tt(ctx: Ctx, key: string, fallback: string): string {
  if (typeof ctx.t === "function") {
    const out = ctx.t(key);
    // Ein Übersetzer, der den Schlüssel zurückgibt (fehlender Key) → Fallback.
    if (typeof out === "string" && out.length > 0 && out !== key) return out;
  }
  return fallback;
}
