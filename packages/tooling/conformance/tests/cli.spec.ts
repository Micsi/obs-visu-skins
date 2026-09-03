// CLI-Spec: belegt die aufrufbare Schnittstelle, die R4 (#3) später als CI-Gate verdrahtet.
// Läuft unter dem TS-Runner (vitest), der Skin-Pakete als `.ts` auflöst — derselbe Weg,
// auf dem die Skins selbst konsumiert werden.

import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../cli.js";

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
    // das CLI das Blatt überhaupt findet und keine Deklarations-Befunde übrigbleiben.
    await main(["@obs-visu-skins/ionic", "--stdout"]);
    const report = JSON.parse(chunks.join("")) as {
      a11y: { status: string; findings: unknown[]; combinations: number };
    };
    expect(report.a11y.status).not.toBe("undeclared");
    expect(report.a11y.findings).toEqual([]);
    expect(report.a11y.combinations).toBeGreaterThan(0);
  });

  it("liefert Exit-Code 2 ohne Skin-Argument", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(2);
  });
});
