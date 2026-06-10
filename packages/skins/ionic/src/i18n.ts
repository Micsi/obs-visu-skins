// @obs-visu-skins/ionic — tiny i18n helper for renderers.
//
// CONTRACT-v1.md §5: `ctx.t` is an optional host-injected translator. When present
// renderers resolve skin-namespaced keys (`skin.ionic.*`) through it; when absent
// they fall back to the German literal. Skin locale keys live in locales/{de,en}.json.

import type { Ctx } from "@obs/visu-contract";

/** Resolve a skin string through the host translator, with a German fallback. */
export function tt(
  ctx: Ctx,
  key: string,
  fallback: string,
  params?: Record<string, unknown>,
): string {
  if (typeof ctx.t === "function") {
    const out = ctx.t(key, params);
    // A translator that echoes the key back (missing key) → use the fallback.
    if (typeof out === "string" && out.length > 0 && out !== key) return out;
  }
  return fallback;
}
