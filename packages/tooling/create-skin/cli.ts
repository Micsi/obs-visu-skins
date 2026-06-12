// create-obs-skin — Scaffold-CLI (Logik). Der ausführbare Einstieg ist bin.mjs, das
// den tsx-Loader registriert und `run` aufruft.
//
// Erzeugt ein konformitäts-grünes Skin-Skelett unter
// packages/skins/<name> und pflegt die Root-tsconfig.references idempotent.
//
// Aufruf (i. d. R. über das Root-Skript `pnpm new-skin`):
//   create-obs-skin <name> [--layout grid|list]
//   pnpm new-skin bento
//   pnpm new-skin tactile --layout list

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { scaffoldSkin, type LayoutModel } from "./index.js";

/** Findet die Workspace-Wurzel: ab `start` aufwärts bis pnpm-workspace.yaml. */
function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        "could not locate workspace root (no pnpm-workspace.yaml found upwards from cwd)",
      );
    }
    dir = parent;
  }
}

interface ParsedArgs {
  readonly name: string;
  readonly layout: LayoutModel;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let name: string | undefined;
  let layout: LayoutModel = "grid";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--layout") {
      const value = argv[++i];
      if (value !== "grid" && value !== "list") {
        throw new Error(`--layout must be "grid" or "list" (got "${value ?? ""}")`);
      }
      layout = value;
    } else if (arg !== undefined && arg.startsWith("--layout=")) {
      const value = arg.slice("--layout=".length);
      if (value !== "grid" && value !== "list") {
        throw new Error(`--layout must be "grid" or "list" (got "${value}")`);
      }
      layout = value;
    } else if (arg !== undefined && !arg.startsWith("-") && name === undefined) {
      name = arg;
    }
  }

  if (name === undefined) {
    throw new Error("usage: create-obs-skin <name> [--layout grid|list]");
  }
  return { name, layout };
}

function main(argv: readonly string[]): number {
  const { name, layout } = parseArgs(argv);
  const root = findRepoRoot(process.cwd());
  const skinsRoot = join(root, "packages", "skins");
  const rootTsconfig = join(root, "tsconfig.json");

  const result = scaffoldSkin(
    { name, layout },
    skinsRoot,
    existsSync(rootTsconfig) ? rootTsconfig : undefined,
  );

  process.stdout.write(
    `scaffolded @obs-visu-skins/${result.name} (${layout}) at ${result.skinDir}\n` +
      `  files: ${result.files.join(", ")}\n` +
      `next:\n` +
      `  pnpm install\n` +
      `  pnpm --filter @obs-visu-skins/${result.name} test   # vitest --typecheck\n` +
      `  pnpm typecheck                                       # tsc --build\n` +
      `  see docs/authoring-skins.md (conformance + fixture-wand + app registration)\n`,
  );
  return 0;
}

/** Process-Entry: führt {@link main} aus und übersetzt Fehler in einen Exit-Code. */
function run(argv: readonly string[]): number {
  try {
    return main(argv);
  } catch (err: unknown) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

export { main, run, parseArgs, findRepoRoot };
