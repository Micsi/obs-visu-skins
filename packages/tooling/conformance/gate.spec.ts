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

import { describe, expect, it } from "vitest";
import { main } from "./cli.js";

// Jeder Skin im Workspace. Neue Skins hier ergänzen (+ devDependency in package.json),
// damit das Gate sie mitprüft.
const SKINS = ["@obs-visu-skins/ionic", "@obs-visu-skins/terminal"] as const;

describe("Konformitäts-Gate (alle Skins)", () => {
  for (const pkg of SKINS) {
    it(`${pkg}: support.json vollständig, keine gap`, async () => {
      // main() schreibt support.json neben den Skin und meldet gaps auf stderr.
      const code = await main([pkg]);
      // eslint-disable-next-line no-console
      console.log(`conformance gate: ${pkg} → exit ${code}`);
      expect(code).toBe(0);
    });
  }
});
