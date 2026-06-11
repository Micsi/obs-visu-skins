// Minimaler Tokens-/Ctx-Stub, damit die reinen Skin-Renderer aufrufbar sind.
// Orientiert an packages/skins/ionic/tests/_vnode.ts (tokensStub/ctxStub).
//
// Goldene Regel 1/4: der Skin/das Tool besitzt NIE State. Diese Stubs liefern nur
// die Sandbox-Helfer aus dem Vertrag (Tokens/Ctx) — kein echter Core nötig, der
// lebt in der App, nicht hier. Die Wand ruft Renderer rein funktional auf.

import type { Ctx, Device, Tokens } from "@obs/visu-contract";

export const tokensStub: Tokens = {
  accent: (token) => `var(--acc-${token})`,
  accentInk: (token) => `var(--ink-${token})`,
  font: "Manrope",
  space: (step) => `${step * 4}px`,
};

export function ctxStub(overrides: Partial<Ctx> = {}): Ctx {
  return {
    stateText: () => "",
    hyphenate: (s) => s,
    icon: (_d: Device, slot: string) => `icon:${slot}`,
    nf: (v) => String(v),
    warn: () => false,
    ...overrides,
  };
}
