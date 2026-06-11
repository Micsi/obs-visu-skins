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
import type { SkinManifest } from "@obs/visu-contract";
import { generateSupport, type RendererMap } from "./index.js";

interface SkinModule {
  readonly tiles: RendererMap;
}

async function loadSkin(
  pkg: string,
): Promise<{ manifest: SkinManifest; tiles: RendererMap; manifestPath: string }> {
  const require = createRequire(import.meta.url);
  const mod = (await import(pkg)) as SkinModule;
  const manifestPath = require.resolve(`${pkg}/manifest.json`);
  const manifest = require(manifestPath) as SkinManifest;
  return { manifest, tiles: mod.tiles, manifestPath };
}

async function main(argv: readonly string[]): Promise<number> {
  const args = argv.filter((a) => a !== "--stdout");
  const toStdout = argv.includes("--stdout");
  const pkg = args[0];

  if (!pkg) {
    process.stderr.write(
      "usage: obs-visu-conformance <skin-package-name> [--stdout]\n",
    );
    return 2;
  }

  const { manifest, tiles, manifestPath } = await loadSkin(pkg);
  const { report, hasGap } = generateSupport({ manifest, tiles });
  const json = JSON.stringify(report, null, 2);

  if (toStdout) {
    process.stdout.write(`${json}\n`);
  } else {
    const out = join(dirname(manifestPath), "support.json");
    writeFileSync(out, `${json}\n`);
    process.stderr.write(`wrote ${out}\n`);
  }

  if (hasGap) {
    const gaps = Object.entries(report.widgets)
      .filter(([, e]) => e.level === "gap")
      .map(([t, e]) => `  ${t}: ${e.reason ?? "gap"}`)
      .join("\n");
    process.stderr.write(`conformance gap in ${report.skin}:\n${gaps}\n`);
    return 1;
  }
  return 0;
}

// Nur ausführen, wenn direkt als Skript gestartet (nicht beim Import in Tests).
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(1);
    });
}

export { main, loadSkin };
