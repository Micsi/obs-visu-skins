// End-to-End-Test des Scaffolds: lässt das CLI gegen ein TEMPORÄRES Ziel laufen und
// validiert, dass das erzeugte Skin (a) die erwarteten Dateien hat, (b) ein Manifest
// mit allen neun Kern-Typen + dem gewählten Layout deklariert, (c) typecheckt und
// (d) vom Konformitäts-Generator OHNE `gap` bewertet wird.
//
// Aufräumen ist Pflicht — kein Workspace-Müll wird eingecheckt. Der Typecheck braucht
// die Workspace-Module-Resolution (@obs/visu-contract, vue, vitest), die erst nach
// einem Install greift; dieser Test scaffoldet daher ein temporäres Paket unter
// packages/skins/, installiert/baut es und entfernt Paket + Lockfile-Eintrag restlos.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { generateSupport } from "@obs-visu-skins/conformance";
import { version as contractVersion, type SkinManifest } from "@obs/visu-contract";
import { scaffoldSkin, scaffoldFiles } from "../index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", ".."); // tooling/create-skin/tests → repo
const skinsRoot = join(repoRoot, "packages", "skins");

const created: string[] = [];
afterAll(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

describe("scaffoldSkin (end-to-end against a temporary target)", () => {
  it("writes the expected files into a tmp dir", () => {
    const tmp = mkdtempSync(join(tmpdir(), "obs-skin-"));
    created.push(tmp);
    const result = scaffoldSkin({ name: "tmpgrid", layout: "grid" }, tmp);

    expect(existsSync(join(result.skinDir, "package.json"))).toBe(true);
    expect(existsSync(join(result.skinDir, "manifest.json"))).toBe(true);
    expect(existsSync(join(result.skinDir, "renderers.ts"))).toBe(true);
    expect(existsSync(join(result.skinDir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(result.skinDir, "tests", "scaffold.spec.ts"))).toBe(true);

    const pkg = JSON.parse(readFileSync(join(result.skinDir, "package.json"), "utf8")) as {
      name: string;
    };
    expect(pkg.name).toBe("@obs-visu-skins/tmpgrid");
  });

  it("declares all six core types and honours the chosen layout", () => {
    const gridFiles = scaffoldFiles({ name: "x", layout: "grid" });
    const listFiles = scaffoldFiles({ name: "x", layout: "list" });

    const gridManifest = JSON.parse(
      gridFiles.find((f) => f.path === "manifest.json")!.contents,
    ) as SkinManifest;
    const listManifest = JSON.parse(
      listFiles.find((f) => f.path === "manifest.json")!.contents,
    ) as SkinManifest;

    expect(gridManifest.layout.model).toBe("grid");
    expect(listManifest.layout.model).toBe("list");
    for (const m of [gridManifest, listManifest]) {
      expect(Object.keys(m.widgets).sort()).toEqual(
        [
          "blind",
          "camera",
          "climate",
          "jalousie",
          "light",
          "media",
          "scene",
          "sensor",
          "switch",
        ].sort(),
      );
      // Das Scaffold zielt auf den aktuellen Vertrag und wählt nichts pauschal ab.
      expect(m.targetsContract).toBe(contractVersion);
      expect(m.unsupported).toEqual([]);
      expect(m.layout.honors).toEqual(["order", "grouping"]);
    }
  });

  it("produces a manifest+tiles map the conformance generator accepts WITHOUT a gap", async () => {
    // Scaffold into the workspace so the tiles module + contract resolve at import.
    // Removed inline (not deferred to afterAll) so the dir is gone before the typecheck
    // test's install — otherwise it would leak a workspace importer into pnpm-lock.yaml.
    const name = "scaffoldtestconf";
    const dir = join(skinsRoot, name);
    rmSync(dir, { recursive: true, force: true });
    scaffoldSkin({ name, layout: "grid" }, skinsRoot);

    try {
      const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as SkinManifest;
      const mod = (await import(/* @vite-ignore */ join(dir, "renderers.ts"))) as {
        tiles: Record<string, unknown>;
      };

      const { hasGap, report } = generateSupport({ manifest, tiles: mod.tiles });
      expect(hasGap).toBe(false);
      expect(report.summary.gap).toBe(0);
      expect(report.summary.broken).toBe(0);
      // Acht Typen mit vollständigem Aktionssatz; sensor kennt im Vertrag keine
      // Aktion und ist damit "display" — nicht "full" (der Generator vergibt die Stufe).
      expect(report.summary.full).toBe(8);
      expect(report.summary.display).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("type-checks the generated skin under workspace module resolution", () => {
    const name = "scaffoldtesttsc";
    const dir = join(skinsRoot, name);
    created.push(dir);
    rmSync(dir, { recursive: true, force: true });
    scaffoldSkin({ name, layout: "grid" }, skinsRoot);

    // The scaffolded skin resolves its deps (vue, @obs/visu-contract, vitest) via pnpm
    // workspace links — those exist only after an install. Snapshot the lockfile, run a
    // scoped install so the new skin's node_modules links materialise, build it, then
    // restore the lockfile + reinstall so the committed lockfile is never mutated by the
    // test. This mirrors the documented workflow: scaffold → pnpm install → typecheck.
    const lockPath = join(repoRoot, "pnpm-lock.yaml");
    const lockBackup = readFileSync(lockPath, "utf8");
    try {
      execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
        cwd: repoRoot,
        stdio: "pipe",
      });

      // Build the skin through a throwaway ROOT-level solution tsconfig that references
      // it — mirrors how `pnpm typecheck` builds every skin. Written/removed in repo
      // root so node_modules + the base tsconfig resolve; the real tsconfig.json is
      // never touched.
      const throwaway = join(repoRoot, `tsconfig.scaffoldtest.${process.pid}.json`);
      created.push(throwaway);
      writeFileSync(
        throwaway,
        JSON.stringify(
          {
            extends: "./tsconfig.base.json",
            compilerOptions: { composite: true, noEmit: false },
            files: [],
            references: [{ path: `./packages/skins/${name}` }],
          },
          null,
          2,
        ),
      );

      execFileSync(
        "node",
        [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "--build", throwaway],
        { cwd: repoRoot, stdio: "pipe" },
      );
    } finally {
      // Remove the temp skin + restore the lockfile, then reinstall to drop the temp
      // package's links — leaves the workspace exactly as it was.
      rmSync(dir, { recursive: true, force: true });
      writeFileSync(lockPath, lockBackup);
      execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
        cwd: repoRoot,
        stdio: "pipe",
      });
    }
  }, 180_000);
});
