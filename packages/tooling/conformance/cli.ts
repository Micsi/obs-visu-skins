#!/usr/bin/env node
// CLI für den Konformitäts-Generator. Lädt einen Skin über seinen Workspace-Paketnamen
// (dynamischer Import von `tiles` + dem `./manifest.json`-Export) und schreibt support.json
// neben den Skin — oder nach stdout mit `--stdout`. Bei undeklarierter `gap` Exit != 0.
//
// Aufruf (R4 #3 verdrahtet dies später als CI-Gate):
//   obs-visu-conformance <skin-package-name> [--stdout]
//   obs-visu-conformance @obs-visu-skins/ionic
//   obs-visu-conformance @obs-visu-skins/ionic --stdout

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { PageRenderer, SkinManifest } from "@obs/visu-contract";
import { generateSupport, type RendererMap, type SkinInput } from "./index.js";

interface SkinModule {
  readonly tiles: RendererMap;
  /** Optionale Detail-/Preset-Flächen — die Aktions-Achse misst über alle. */
  readonly details?: RendererMap;
  readonly presets?: RendererMap;
  /** Optionaler Ganzseiten-Renderer — die `honors`-Achse misst über ihn. */
  readonly page?: PageRenderer;
}

async function loadSkin(pkg: string): Promise<{ skin: SkinInput; manifestPath: string }> {
  const require = createRequire(import.meta.url);
  const mod = (await import(pkg)) as SkinModule;
  const manifestPath = require.resolve(`${pkg}/manifest.json`);
  const manifest = require(manifestPath) as SkinManifest;
  return {
    skin: {
      manifest,
      tiles: mod.tiles,
      details: mod.details,
      presets: mod.presets,
      page: mod.page,
    },
    manifestPath,
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const args = argv.filter((a) => a !== "--stdout");
  const toStdout = argv.includes("--stdout");
  const pkg = args[0];

  if (!pkg) {
    process.stderr.write("usage: obs-visu-conformance <skin-package-name> [--stdout]\n");
    return 2;
  }

  const { skin, manifestPath } = await loadSkin(pkg);
  const { report, hasGap, honors } = await generateSupport(skin);
  const json = JSON.stringify(report, null, 2);

  if (toStdout) {
    process.stdout.write(`${json}\n`);
  } else {
    const out = join(dirname(manifestPath), "support.json");
    writeFileSync(out, `${json}\n`);
    process.stderr.write(`wrote ${out}\n`);
  }

  if (hasGap) {
    // gap UND broken sind Fehlerstufen (ARCHITECTURE.md §2) — beide werden benannt,
    // und seit Vertrag 1.12 auch die `honors`-Achse (der Deklarations-Slot, auf den
    // sich das Host-Verhalten stützt).
    const failures = Object.entries(report.widgets)
      .filter(([, e]) => e.level === "gap" || e.level === "broken")
      .map(([t, e]) => `  ${t} [${e.level}]: ${e.reason ?? e.level}`)
      .concat(honors.map((f) => `  honors:${f.token} [${f.problem}]: ${f.detail}`))
      .join("\n");
    process.stderr.write(`conformance failure in ${report.skin}:\n${failures}\n`);
    return 1;
  }
  return 0;
}

// Nur ausführen, wenn direkt als Skript gestartet (nicht beim Import in Tests).
const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(1);
    });
}

export { main, loadSkin };
