// CLI-Spec: belegt die aufrufbare Schnittstelle, die R4 (#3) später als CI-Gate verdrahtet.
// Läuft unter dem TS-Runner (vitest), der Skin-Pakete als `.ts` auflöst — derselbe Weg,
// auf dem die Skins selbst konsumiert werden.

import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../cli.js";

describe("conformance CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("liefert Exit-Code 0 und den Report auf stdout für den vollständigen ionic-Skin", async () => {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => {
      chunks.push(String(c));
      return true;
    });

    const code = await main(["@obs-visu-skins/ionic", "--stdout"]);

    expect(code).toBe(0);
    const report = JSON.parse(chunks.join("")) as { skin: string; summary: { gap: number } };
    expect(report.skin).toBe("ionic");
    expect(report.summary.gap).toBe(0);
  });

  it("liefert Exit-Code 2 ohne Skin-Argument", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(2);
  });
});
