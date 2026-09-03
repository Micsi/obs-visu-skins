// CLI-Spec: belegt die aufrufbare Schnittstelle, die R4 (#3) später als CI-Gate verdrahtet.
// Läuft unter dem TS-Runner (vitest), der Skin-Pakete als `.ts` auflöst — derselbe Weg,
// auf dem die Skins selbst konsumiert werden.

import { afterEach, describe, expect, it, vi } from "vitest";
import { main, loadStyles } from "../cli.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SkinManifest } from "@obs/visu-contract";

describe("conformance CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("liefert Exit-Code 0 und den Report auf stdout für den vollständig grünen terminal-Skin", async () => {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => {
      chunks.push(String(c));
      return true;
    });

    // terminal, nicht ionic: seit Vertrag 1.13 zählt auch die Farb-Achse in den
    // Exit-Code, und terminal ist der Skin, dessen Palette GEMESSEN besteht.
    const code = await main(["@obs-visu-skins/terminal", "--stdout"]);

    expect(code).toBe(0);
    const report = JSON.parse(chunks.join("")) as {
      skin: string;
      summary: { gap: number };
      a11y: { status: string; combinations: number };
    };
    expect(report.skin).toBe("terminal");
    expect(report.summary.gap).toBe(0);
    expect(report.a11y.status).toBe("pass");
    // Ein Wächter, der nichts misst, fällt nie: die Zahl belegt, dass gerechnet wurde.
    expect(report.a11y.combinations).toBeGreaterThan(0);
  });

  it("lädt das deklarierte Stylesheet, statt die Farbe zu raten", async () => {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => {
      chunks.push(String(c));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // ionic deklariert eine Palette und ist damit GEMESSEN — nicht `undeclared`.
    // Ob die Messung besteht, ist die Sache des Skins; hier steht zur Debatte, dass
    // das CLI das Blatt überhaupt FINDET und daraus rechnet.
    await main(["@obs-visu-skins/ionic", "--stdout"]);
    const report = JSON.parse(chunks.join("")) as {
      a11y: {
        status: string;
        findings: { problem: string; detail: string }[];
        combinations: number;
      };
    };
    expect(report.a11y.status).not.toBe("undeclared");
    // Genau DAS ist die Aussage dieser Spec: kein ungelesenes Blatt.
    expect(report.a11y.findings.map((f) => f.problem)).not.toContain("stylesheet-unreadable");
    expect(report.a11y.combinations).toBeGreaterThan(0);
    // Bewusst NICHT mehr `findings == []`: seit Riegel 8 zählt auch Farbe, die an
    // den Token vorbei direkt in einer Regel steht, und ionic hat davon reichlich
    // (hartcodierte `color: #fff`, Verläufe, Schatten). Das ist ein Befund über den
    // SKIN, keiner über das CLI — ihn hier grün zu halten hiesse, den Riegel im
    // Nachbarspec wieder aufzumachen. ionics Palette hat ihre eigene Baustelle.
  });

  it("liefert Exit-Code 2 ohne Skin-Argument", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(2);
  });
});

describe("loadStyles — die drei Pfadformen aus manifest.a11y.stylesheet", () => {
  const dir = mkdtempSync(join(tmpdir(), "obs-visu-styles-"));
  const manifestPath = join(dir, "manifest.json");
  const relative = join(dir, "skin.css");
  const absolute = join(dir, "woanders.css");
  writeFileSync(relative, ".a{--x:#000000;}");
  writeFileSync(absolute, ".b{--y:#ffffff;}");

  const withSheet = (stylesheet: unknown): SkinManifest =>
    ({ a11y: { stylesheet } }) as unknown as SkinManifest;

  it("liest einen relativen Pfad neben dem Manifest", () => {
    const out = loadStyles(withSheet("./skin.css"), manifestPath, (id) => id);
    expect(out["./skin.css"]).toBe(".a{--x:#000000;}");
  });

  it("liest einen ABSOLUTEN Pfad, wie er dasteht", () => {
    // Der Zweig gab absolute Pfade an `join(dirname(manifestPath), entry)` — sie
    // landeten damit hinter dem Manifest-Verzeichnis, und die ausdrücklich
    // unterstützte absolute Form war IMMER `stylesheet-unreadable`.
    const out = loadStyles(withSheet(absolute), manifestPath, (id) => id);
    expect(out[absolute]).toBe(".b{--y:#ffffff;}");
  });

  it("lässt alles andere über die Paket-Auflösung laufen", () => {
    const out = loadStyles(withSheet("@fremd/skin/skin.css"), manifestPath, () => relative);
    expect(out["@fremd/skin/skin.css"]).toBe(".a{--x:#000000;}");
  });

  it("wirft nicht, wenn eine Datei fehlt — sie fehlt dann schlicht in `styles`", () => {
    const out = loadStyles(withSheet("./gibtsnicht.css"), manifestPath, (id) => id);
    expect(out).toEqual({});
  });
});
