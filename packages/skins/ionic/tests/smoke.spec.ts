// M2-Foundation Smoke-Test: belegt, dass das Skin-Skelett auflöst (Manifest + Vertrag
// + Renderer-Stubs), damit die nachfolgenden Renderer-Wellen darauf TDD fahren können.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { version as contractVersion, type SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { details, tiles } from "../renderers.js";

const skinDir = fileURLToPath(new URL("..", import.meta.url));
const cssText = readFileSync(`${skinDir}ionic.css`, "utf8");

/** WCAG relative-luminance contrast ratio between two #rrggbb colours. */
function contrast(aHex: string, bHex: string): number {
  const lin = (n: number): number => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (hex: string): number =>
    0.2126 * lin(parseInt(hex.slice(1, 3), 16)) +
    0.7152 * lin(parseInt(hex.slice(3, 5), 16)) +
    0.0722 * lin(parseInt(hex.slice(5, 7), 16));
  const la = lum(aHex);
  const lb = lum(bHex);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

describe("ionic skin scaffold", () => {
  it("declares a contract-shaped manifest targeting the current contract", () => {
    const m = manifest as unknown as SkinManifest;
    expect(m.name).toBe("ionic");
    // Measured against the contract, not a literal: a literal stays green while the
    // skin lags behind the contract. This line goes red the moment it does.
    expect(m.targetsContract).toBe(contractVersion);
    expect(m.layout.model).toBe("grid");
    // v1.2: media + camera sind jetzt unterstützt — nichts mehr unsupported.
    expect(m.unsupported).not.toContain("camera");
    expect(m.unsupported).not.toContain("media");
    // Kern-Typen sind im Manifest deklariert (sonst meldet der Generator gap);
    // v1.4 ergänzt climate.
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
  });

  it("declares the v1.7 skin-driven gesture model (tap/longPress/doubleTap)", () => {
    const m = manifest as unknown as SkinManifest;
    // Daten=JSON, Verhalten=Code: the manifest maps each gesture to a target; the
    // host owns the mapping and applies it (the skin owns no state).
    expect(m.gestures).toEqual({
      tap: "action",
      longPress: "presets",
      doubleTap: "openDetail",
    });
  });

  it("exposes typed renderer maps wired by the renderer waves", () => {
    expect(tiles).toBeTypeOf("object");
    expect(details).toBeTypeOf("object");
    // Alle neun v1.4-Kern-Typen (v1.2 + climate) haben einen Kachel-Renderer.
    expect(Object.keys(tiles).sort()).toEqual(
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
    // Detail-Flächen für die bedienbaren Typen (sensor read-only, scene one-shot);
    // v1.4 ergänzt climate (Sollwert-Steuerung).
    expect(Object.keys(details).sort()).toEqual(
      ["blind", "climate", "jalousie", "light", "switch"].sort(),
    );
    for (const fn of Object.values(tiles)) expect(fn).toBeTypeOf("function");
    for (const fn of Object.values(details)) expect(fn).toBeTypeOf("function");
  });

  it("manifest is honest: font.src points at the shipped woff2, no dead icons key (#15)", () => {
    const m = manifest as unknown as SkinManifest;
    expect(m.font?.src).toBe("./fonts/Manrope.woff2");
    // Icons kommen aus Inline-Glyphen + Contract-Default-Set; kein manifest.icons-File.
    expect((m as { icons?: string }).icons).toBeUndefined();
  });

  it("ships an @font-face for Manrope wired to the bundled woff2 (#15)", () => {
    expect(cssText).toMatch(/@font-face\s*\{[^}]*font-family:\s*"Manrope"[^}]*\}/s);
    expect(cssText).toMatch(/src:\s*url\("\.\/fonts\/Manrope\.woff2"\)\s*format\("woff2"\)/);
    expect(cssText).toMatch(/font-weight:\s*200 800/);
    expect(cssText).toMatch(/font-display:\s*swap/);
  });
});

describe("ionic accent ink is AA-safe (#19)", () => {
  const accents: Record<string, string> = {
    orange: "#ec8b3a",
    teal: "#45b1ae",
    violet: "#a489d9",
    green: "#6fbf6a",
    blue: "#5a93dd",
    rose: "#d97a8d",
    amber: "#e8b441",
    slate: "#7e8696",
  };

  it("defines a per-accent --ink-<token> and an --vz-accent-ink default", () => {
    for (const token of Object.keys(accents)) {
      expect(cssText).toMatch(new RegExp(`--ink-${token}:\\s*#[0-9a-fA-F]{6}`));
    }
    expect(cssText).toMatch(/--vz-accent-ink:\s*var\(--ink-orange\)/);
  });

  it("legt auch den Ionic-Komponentenpfad auf die Ink-Achse, nicht auf hartes Weiss", () => {
    // Die RATSCHE zu dieser Farbklasse. Weiss erreicht gegen die acht Akzente nur
    // 1.90 (amber) bis 3.66 (slate) — keiner schafft die 4.5 fuer Text. Der Skin
    // hatte die Loesung laengst (`--vz-accent-ink`, seit #19), nur der
    // Ionic-Brueckenblock stand noch auf `#ffffff`.
    //
    // Warum ein eigener Spec und nicht das Konformitaets-Gate: solange ein Skin
    // insgesamt `fail` ist, veraendert ein Rueckfall auf Weiss den Exit-Code NICHT.
    // Es gaebe also keinen Waechter — genau die Luecke, die diese Zeile schliesst.
    expect(cssText).toMatch(/--ion-color-primary-contrast:\s*var\(--vz-accent-ink\)/);
    // Das `-rgb`-Pendant muss mitziehen: Ionic mischt daraus seine Ripple- und
    // Fokus-Schleier. Bliebe es auf `255, 255, 255`, laege ein heller Schleier
    // ueber dunkler Schrift.
    expect(cssText).toMatch(/--ion-color-primary-contrast-rgb:\s*16,\s*19,\s*26/);
  });

  it("every built-in accent reaches WCAG AA (>= 4.5:1) with its default ink", () => {
    for (const [token, accent] of Object.entries(accents)) {
      const ink = cssText.match(new RegExp(`--ink-${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      expect(ink, `--ink-${token}`).toBeDefined();
      expect(contrast(accent, ink as string), `${token} ink ${ink}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
