#!/usr/bin/env node
// Bin-Wrapper für create-obs-skin. Die CLI-Logik liegt in cli.ts (TypeScript, mit den
// Skin-Paketen konsistent). Node führt `.ts` nicht nativ aus, daher registrieren wir
// den tsx-ESM-Loader und importieren dann cli.ts — dessen `main` läuft beim Direkt-
// Aufruf selbst (invokedDirectly). So funktioniert `pnpm new-skin <name>` ohne
// Build-Schritt, identisch zur Test-Auflösung unter vitest.

import { register } from "tsx/esm/api";
import { fileURLToPath } from "node:url";

register();
const { run } = await import(fileURLToPath(new URL("./cli.ts", import.meta.url)));
process.exit(run(process.argv.slice(2)));
