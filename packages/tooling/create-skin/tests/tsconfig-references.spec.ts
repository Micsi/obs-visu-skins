// Unit-Test der Root-tsconfig-Pflege: reine String-Transformation, damit die echte
// Root-tsconfig.json nicht verschmutzt wird. Prüft idempotentes + sortiertes Einfügen.

import { describe, expect, it } from "vitest";
import { addSkinReference } from "../index.js";

const BASE = `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "composite": true, "noEmit": false },
  "files": [],
  "references": [
    { "path": "./packages/tooling/contract-ref" },
    { "path": "./packages/skins/ionic" },
    { "path": "./packages/skins/terminal" }
  ]
}
`;

describe("addSkinReference", () => {
  it("inserts the skin path and re-sorts the references", () => {
    const out = addSkinReference(BASE, "bento");
    expect(out).toContain('{ "path": "./packages/skins/bento" }');

    const paths = [...out.matchAll(/"path"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toContain("./packages/skins/bento");
    // Sortiert: bento steht vor ionic vor terminal vor contract-ref? localeCompare-Reihenfolge:
    expect([...paths]).toEqual([...paths].sort((a, b) => a!.localeCompare(b!)));
  });

  it("is idempotent — a second insert leaves the string unchanged", () => {
    const once = addSkinReference(BASE, "bento");
    const twice = addSkinReference(once, "bento");
    expect(twice).toBe(once);
  });

  it("does not touch other references", () => {
    const out = addSkinReference(BASE, "bento");
    expect(out).toContain('{ "path": "./packages/skins/ionic" }');
    expect(out).toContain('{ "path": "./packages/skins/terminal" }');
    expect(out).toContain('{ "path": "./packages/tooling/contract-ref" }');
  });

  it("rejects an invalid skin name", () => {
    expect(() => addSkinReference(BASE, "Bad Name")).toThrow(/invalid skin name/);
  });

  it("throws when the tsconfig has no references array", () => {
    expect(() => addSkinReference("{}", "bento")).toThrow(/no "references"/);
  });
});
