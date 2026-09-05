// R4 (#3) — Konformitäts-Gate für die CI.
//
// Fährt den echten Generator (CLI `main`) über JEDEN Skin im Repo. `main` schreibt
// support.json neben den Skin und liefert Exit-Code != 0, sobald ein Kern-Typ eine
// undeklarierte `gap` hat (golden rule 3). Dieses Spec macht daraus ein hartes
// CI-Gate: jede gap → roter Lauf. Läuft unter vitest, demselben TS-Runner, über den
// die Skins auch sonst konsumiert werden (CLI ist `.ts` mit `.js`-internen Imports).
//
// Bewusst NICHT unter tests/**, damit `pnpm test` (Generator-Specs) und das Gate
// getrennt bleiben; CI ruft es explizit über `pnpm --filter … gate`.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "./cli.js";

// Jeder Skin im Workspace. Neue Skins hier ergänzen (+ devDependency in package.json),
// damit das Gate sie mitprüft.
const SKINS = ["@obs-visu-skins/ionic", "@obs-visu-skins/terminal", "@obs-visu-skins/edomi"] as const;

// Die RATSCHE zur eingeräumten Tweak-Lücke.
//
// Seit dem Gate-Zuschnitt (openbridgeserver#181) fällt ein Skin nicht mehr durch,
// nur weil er einen farbwirksamen Tweak als "von dieser Fläche nicht erfassbar"
// einräumt — sonst wäre das Gate für attributgeschaltete Skins strukturell
// unerreichbar. Damit `unmeasuredTweaks` nicht der bequeme Ausweg aus einem echten
// Kontrastproblem wird, steht hier fest, WER was einräumen darf. Ein neuer Eintrag
// bricht dieses Spec und muss hier begründet nachgetragen werden — die Lockerung
// bleibt dadurch eine bewusste Entscheidung pro Fall, keine offene Tür.
const ADMITTED_UNMEASURED: Readonly<Record<string, readonly string[]>> = {
  "@obs-visu-skins/ionic": ["accentStyle", "glow", "stil"],
  "@obs-visu-skins/terminal": [],
  "@obs-visu-skins/edomi": [],
};

const require_ = createRequire(import.meta.url);

function supportOf(pkg: string): { a11y?: { checkedTweakExtremes: boolean; unmeasuredTweaks?: Record<string, string> } } {
  const manifest = require_.resolve(`${pkg}/manifest.json`);
  return JSON.parse(readFileSync(join(dirname(manifest), "support.json"), "utf8"));
}

describe("Konformitäts-Gate (alle Skins)", () => {
  for (const pkg of SKINS) {
    it(`${pkg}: support.json vollständig, keine gap`, async () => {
      // main() schreibt support.json neben den Skin und meldet gaps auf stderr.
      const code = await main([pkg]);
      console.log(`conformance gate: ${pkg} → exit ${code}`);
      expect(code).toBe(0);

      // Und: genau die hier festgeschriebenen Tweaks sind eingeräumt, keiner mehr.
      const a11y = supportOf(pkg).a11y;
      expect(a11y).toBeDefined();
      expect(Object.keys(a11y?.unmeasuredTweaks ?? {}).sort()).toEqual([...ADMITTED_UNMEASURED[pkg]]);
      // Gegenprobe zur Ratsche: ohne Einräumung MUSS die Deckung vollständig sein.
      expect(a11y?.checkedTweakExtremes).toBe(ADMITTED_UNMEASURED[pkg].length === 0);
    });
  }
});
