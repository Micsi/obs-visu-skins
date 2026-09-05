// @vitest-environment node
//
// BEWUSST unter `node`, nicht unter der jsdom-Umgebung der uebrigen Specs: `cli.ts`
// traegt eine Shebang, ueber die der Transform-Pfad der Browser-Umgebung stolpert.
// Das ist hier kein Ausweichen, sondern der schaerfere Test — so laeuft das CLI
// genau so, wie ein direkter Aufruf es faehrt, und belegt, dass `ensureDom()` die
// DOM-Laufzeit selbst hochzieht, bevor der Skin (und mit ihm Vue) geladen wird.
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

describe("loadStyles folgt dem, was der Browser auch anwendet", () => {
  /** Ein Manifest-Gerüst, das nur ein Stylesheet nennt. */
  function manifestNaming(sheet: string): SkinManifest {
    return {
      name: "probe",
      targetsContract: "1.13",
      unsupported: [],
      widgets: {},
      layout: { model: "list", honors: ["order"] },
      a11y: { stylesheet: sheet, themes: {}, grounds: [], tokens: {} },
    } as unknown as SkinManifest;
  }

  it("lädt `@import`-Ketten mit, in Kaskadenreihenfolge", () => {
    // Ohne das sah die Messung nur den Einstieg: ein Skin konnte ein paar bestandene
    // Token oben halten, seine echten Farben importieren — und `pass` bekommen,
    // obwohl der Browser beide Dateien anwendet. `parseRules` sieht den Import auch
    // nicht, er hat keinen Regelrumpf.
    const dir = mkdtempSync(join(tmpdir(), "obs-import-"));
    writeFileSync(join(dir, "deep.css"), ".d{color:#111}");
    writeFileSync(join(dir, "mid.css"), '@import "./deep.css";\n.m{color:#222}');
    writeFileSync(join(dir, "entry.css"), '@import url("./mid.css");\n.e{color:#333}');
    const manifestPath = join(dir, "manifest.json");

    const out = loadStyles(manifestNaming("./entry.css"), manifestPath, (id) => id);
    const keys = Object.keys(out);

    // Alle drei Dateien sind da …
    expect(keys).toHaveLength(3);
    expect(Object.values(out).join("\n")).toContain(".d{color:#111}");
    // … und die importierten stehen VOR der importierenden, wie CSS sie anwendet.
    expect(keys.indexOf("./entry.css → ./mid.css → ./deep.css")).toBeLessThan(
      keys.indexOf("./entry.css → ./mid.css"),
    );
    expect(keys.indexOf("./entry.css → ./mid.css")).toBeLessThan(keys.indexOf("./entry.css"));
  });

  it("ein unauflösbarer Import wird vermerkt, nicht verschwiegen", () => {
    const dir = mkdtempSync(join(tmpdir(), "obs-import-"));
    writeFileSync(join(dir, "entry.css"), '@import "./fehlt.css";\n.e{color:#333}');
    const out = loadStyles(manifestNaming("./entry.css"), join(dir, "manifest.json"), (id) => id);
    // Als leerer Eintrag: die Messung meldet ihn dann als `stylesheet-unreadable`.
    expect(out["./entry.css → ./fehlt.css"]).toBe("");
    expect(out["./entry.css"]).toContain(".e{color:#333}");
  });

  it("ein zyklischer Import läuft nicht endlos", () => {
    const dir = mkdtempSync(join(tmpdir(), "obs-import-"));
    writeFileSync(join(dir, "a.css"), '@import "./b.css";\n.a{color:#111}');
    writeFileSync(join(dir, "b.css"), '@import "./a.css";\n.b{color:#222}');
    const out = loadStyles(manifestNaming("./a.css"), join(dir, "manifest.json"), (id) => id);
    expect(Object.values(out).join("\n")).toContain(".b{color:#222}");
  });

  it("ein Paket-Export wird über den übergebenen Resolver gesucht", () => {
    // Der Resolver kommt aus `createRequire(manifestPath)` — er sieht die
    // Abhängigkeiten des SKINS, nicht die dieser Datei. Unter pnpms isoliertem
    // node_modules war ein gültiger Export sonst `stylesheet-unreadable`.
    const dir = mkdtempSync(join(tmpdir(), "obs-pkg-"));
    const real = join(dir, "fremd.css");
    writeFileSync(real, ".x{color:#444}");
    const seen: string[] = [];
    const out = loadStyles(
      manifestNaming("@fremd/skin/fremd.css"),
      join(dir, "manifest.json"),
      (id) => {
        seen.push(id);
        return real;
      },
    );
    expect(seen).toEqual(["@fremd/skin/fremd.css"]);
    expect(out["@fremd/skin/fremd.css"]).toBe(".x{color:#444}");
  });
});
