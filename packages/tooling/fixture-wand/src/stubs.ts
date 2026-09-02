// Tokens-/Ctx-Stubs für die Wand.
//
// Der Ctx-Stub ist DERSELBE wie im Konformitäts-Generator (@obs-visu-skins/conformance):
// Wand und support.json sollen denselben Lauf zeigen, nicht zwei Nachbildungen mit
// unterschiedlichen Zustandstexten. Skin-spezifisch bleiben nur die Tokens — jeder Skin
// benennt seine Akzent-Variablen selbst (ionic: --vz-acc-*, terminal: --t-acc-*), und
// die Wand muss die echten Variablen setzen, sonst zeigt sie Fallback statt Skin.
//
// Goldene Regel 1/4: das Tool besitzt keinen State; die Renderer werden rein
// funktional aufgerufen.

import type { Tokens } from "@obs/visu-contract";

export { ctxStub } from "@obs-visu-skins/conformance";

/** Tokens, die auf die CSS-Variablen eines konkreten Skins zeigen. */
export function tokensFor(accentPrefix: string, inkVar: string, font: string): Tokens {
  return {
    accent: (token) => `var(${accentPrefix}${token})`,
    accentInk: () => `var(${inkVar})`,
    font,
    space: (step) => `${step * 4}px`,
  };
}

/** Ionic-Palette: ionic.css definiert --vz-acc-<token> / --vz-accent-ink. */
export const ionicTokens: Tokens = tokensFor(
  "--vz-acc-",
  "--vz-accent-ink, var(--vz-fg)",
  "Manrope",
);

/** Terminal-Palette: terminal.css definiert --t-acc-<token> auf .t-root. */
export const terminalTokens: Tokens = tokensFor("--t-acc-", "--t-fg", "monospace");

/** Rückwärtskompatibler Name für die bestehenden Wand-Tests (= ionic). */
export const tokensStub: Tokens = ionicTokens;
