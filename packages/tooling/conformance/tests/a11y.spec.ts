// Negativkontrollen für die Farb-Achse (Vertrag 1.13, Goldene Regel 6).
//
// Ein Wächter, der nie fällt, beweist nichts. Diese Spec fährt deshalb für JEDEN
// Befund und JEDE Schwelle den Fall an, in dem er fallen MUSS — und dazu den
// benachbarten Fall, in dem er still bleiben muss. Alles läuft gegen eine winzige,
// hier geschriebene Palette: kein echter Skin, damit keine fremde Farbwahl diese
// Spec kippt, und damit jede Zahl von Hand nachrechenbar bleibt.
//
// Die Rechnung selbst wird zusätzlich gegen von Hand geprüfte WCAG-Werte gestellt
// (Schwarz auf Weiss = 21:1), sonst prüfte diese Spec nur, dass eine Funktion mit
// sich selbst übereinstimmt.

import { describe, expect, it } from "vitest";
import type { SkinManifest } from "@obs/visu-contract";
import { contrast, measureA11y, resolveColor, resolveNumber, THRESHOLDS } from "../a11y.js";

const SHEET = "./probe.css";

/** Ein Manifest-Gerüst ohne Widgets — hier steht nur die Farb-Achse zur Debatte. */
function manifestWith(a11y: unknown, tweaks?: Record<string, unknown>): SkinManifest {
  return {
    name: "probe",
    targetsContract: "1.13",
    unsupported: [],
    widgets: {},
    layout: { model: "list", honors: ["order"] },
    ...(tweaks ? { tweaks } : {}),
    a11y,
  } as unknown as SkinManifest;
}

/** Die bestandene Ausgangslage: schwarzer Text auf weissem Grund. */
const PASSING_CSS = '.p[data-theme="dark"]{--bg:#ffffff;--fg:#000000;--dot:#767676;}';
const PASSING_DECL = {
  stylesheet: SHEET,
  themes: { dark: '.p[data-theme="dark"]' },
  grounds: [{ token: "--bg" }],
  tokens: {
    "--bg": { role: "ground" },
    "--fg": { role: "text" },
    "--dot": { role: "graphic" },
  },
};

function measure(decl: unknown, css = PASSING_CSS, tweaks?: Record<string, unknown>) {
  return measureA11y({ manifest: manifestWith(decl, tweaks), styles: { [SHEET]: css } });
}

describe("Rechenwerk gegen von Hand geprüfte WCAG-Werte", () => {
  it("liefert 21:1 für Schwarz auf Weiss und 1:1 für Gleiches auf Gleichem", () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrast(black, white)).toBeCloseTo(21, 5);
    expect(contrast(black, black)).toBeCloseTo(1, 5);
  });

  it("nimmt die Schwellen aus dem VERTRAG, nicht aus einem Literal hier", () => {
    expect(THRESHOLDS.text).toBe(4.5);
    expect(THRESHOLDS.graphic).toBe(3);
  });

  it("löst die Farbformen auf, die eine Skin-Palette wirklich benutzt", () => {
    const env = new Map([
      ["--a", "0.5"],
      ["--base", "#112233"],
    ]);
    expect(resolveColor("#123", env)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(resolveColor("#112233", env)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(resolveColor("var(--base)", env)).toEqual({ r: 17, g: 34, b: 51, a: 1 });
    expect(resolveColor("rgba(255, 255, 255, var(--a))", env)).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 0.5,
    });
    expect(resolveColor("rgb(1 2 3 / 0.25)", env)).toEqual({ r: 1, g: 2, b: 3, a: 0.25 });
    // Ein Ausdruck, den dieses Rechenwerk NICHT kann, gibt null — kein Raten.
    expect(resolveColor("color-mix(in oklab, red 50%, blue)", env)).toBeNull();
    expect(resolveNumber("calc(var(--a) * 0.34)", env)).toBeCloseTo(0.17, 6);
  });
});

describe("Negativkontrolle — der Wächter fällt, wo er fallen muss", () => {
  it("Ausgangslage: die korrekte Palette besteht", () => {
    const r = measure(PASSING_DECL);
    expect(r.status).toBe("pass");
    expect(r.violationCount).toBe(0);
    expect(r.findings).toEqual([]);
    // Schwarz auf Weiss = 21:1, der graue Punkt = 4.54:1 gegen Weiss.
    expect(r.worst.text?.ratio).toBe(21);
    expect(r.combinations).toBe(2);
  });

  it("FALSCH DEKLARIERTE PALETTE: ein zu blasser Text-Token wird rot", () => {
    // Einzige Änderung gegenüber der Ausgangslage: --fg von #000000 auf #999999.
    const css = PASSING_CSS.replace("--fg:#000000", "--fg:#999999");
    const r = measure(PASSING_DECL, css);
    expect(r.status).toBe("fail");
    expect(r.aa).toBe(false);
    expect(r.violationCount).toBe(1);
    expect(r.violations[0]).toMatchObject({ token: "--fg", role: "text", threshold: 4.5 });
    expect(r.violations[0]!.ratio).toBeLessThan(4.5);
  });

  it("ROLLENVERTAUSCHUNG: derselbe Wert besteht als Grafik und fällt als Text", () => {
    // #8a8a8a auf Weiss liegt bei 3.54:1: über der Grafik-Schwelle (3:1), unter der
    // Text-Schwelle (4.5:1). Derselbe Wert, nur eine andere Rolle — grün bzw. rot.
    // Damit ist belegt, dass die Rolle die Schwelle wirklich steuert.
    const css = PASSING_CSS.replace("--dot:#767676", "--dot:#8a8a8a");
    const asGraphic = measure(PASSING_DECL, css);
    expect(asGraphic.status).toBe("pass");

    const asText = measure(
      { ...PASSING_DECL, tokens: { ...PASSING_DECL.tokens, "--dot": { role: "text" } } },
      css,
    );
    expect(asText.status).toBe("fail");
    expect(asText.violations[0]).toMatchObject({ token: "--dot", threshold: 4.5 });
  });

  it("WEGGELASSENE FARBE: ein Token ohne Rolle ist ein Befund, kein Überspringen", () => {
    // Genau der Ausweg, den ein Skin sonst nähme: die unbequeme Farbe nicht
    // deklarieren. Das Weglassen selbst wird gemeldet.
    const css = PASSING_CSS.replace("}", "--sneaky:#999999;}");
    const r = measure(PASSING_DECL, css);
    expect(r.status).toBe("fail");
    expect(r.findings.map((f) => f.problem)).toContain("unclassified");
    expect(r.findings.find((f) => f.problem === "unclassified")!.detail).toContain("--sneaky");
  });

  it("VERSTECKTE FARBE: ein Verlauf ist keine flache Farbe und muss exempt sein", () => {
    const css = PASSING_CSS.replace("}", "--grad:linear-gradient(#000,#fff);}");
    const r = measure(PASSING_DECL, css);
    expect(r.findings.map((f) => f.problem)).toContain("unclassified");

    // Mit Begründung deklariert ist derselbe Verlauf in Ordnung — und die
    // Begründung steht im Report, ist also kritisierbar.
    const ok = measure(
      {
        ...PASSING_DECL,
        tokens: {
          ...PASSING_DECL.tokens,
          "--grad": { role: "exempt", reason: "Verlauf, kein flaches Pixel" },
        },
      },
      css,
    );
    expect(ok.status).toBe("pass");
    expect(ok.exempt).toEqual({ "--grad": "Verlauf, kein flaches Pixel" });
  });

  it("AUSNAHME OHNE BEGRÜNDUNG: `exempt` ohne `reason` ist ein Vergessen", () => {
    const css = PASSING_CSS.replace("}", "--grad:linear-gradient(#000,#fff);}");
    const r = measure(
      { ...PASSING_DECL, tokens: { ...PASSING_DECL.tokens, "--grad": { role: "exempt" } } },
      css,
    );
    expect(r.status).toBe("fail");
    expect(r.findings.map((f) => f.problem)).toContain("exempt-without-reason");
  });

  it("KEINE DEKLARATION: `undeclared` ist ausdrücklich nicht `pass` (Goldene Regel 3)", () => {
    const r = measureA11y({ manifest: manifestWith(undefined) });
    expect(r.status).toBe("undeclared");
    expect(r.aa).toBe(false);
    expect(r.combinations).toBe(0);
    expect(r.findings[0]?.problem).toBe("undeclared");
  });

  it("FEHLENDES BLATT: eine ungelesene Datei ist ein Befund, kein stiller Erfolg", () => {
    const r = measureA11y({ manifest: manifestWith(PASSING_DECL), styles: {} });
    expect(r.status).toBe("fail");
    expect(r.findings.map((f) => f.problem)).toContain("stylesheet-unreadable");
  });

  it("FALSCHER SELEKTOR: ein Theme-Block, den es nicht gibt, wird gemeldet", () => {
    const r = measure({ ...PASSING_DECL, themes: { dark: ".tippfehler" } });
    expect(r.findings.map((f) => f.problem)).toContain("selector-missing");
  });

  it("DURCHSCHEINENDER GRUND: ohne `over` ist der Grund kein Pixel", () => {
    const css = '.p[data-theme="dark"]{--bg:rgba(255,255,255,0.5);--fg:#000000;--dot:#767676;}';
    const r = measure(PASSING_DECL, css);
    expect(r.findings.map((f) => f.problem)).toContain("translucent-ground");
  });

  it("UNBEKANNTER GRUND: ein `on`, das auf nichts zeigt, wird gemeldet", () => {
    const r = measure({
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--fg": { role: "text", on: ["--gibtsnicht"] } },
    });
    expect(r.findings.map((f) => f.problem)).toContain("unknown-ground");
  });

  it("UNRECHENBARER WERT: eine Farbform, die das Rechenwerk nicht kann, schweigt nicht", () => {
    const css = PASSING_CSS.replace("--fg:#000000", "--fg:color-mix(in oklab, #000 50%, #fff)");
    const r = measure(PASSING_DECL, css);
    expect(r.findings.map((f) => f.problem)).toContain("unresolvable");
  });
});

describe("Tweak-Extreme (CO5-Garantie)", () => {
  // Der Kern von #12: ein Kontrast, der nur in der Werkseinstellung hält, ist kein
  // Bestehen. Die Palette unten ist beim Default sauber und kippt am Maximum.
  const TWEAK_CSS =
    '.p[data-theme="dark"]{--alpha:0.1;--bg:rgba(255,255,255,var(--alpha));--page:#000000;--fg:#ffffff;}';
  const TWEAK_DECL = {
    stylesheet: SHEET,
    themes: { dark: '.p[data-theme="dark"]' },
    grounds: [{ token: "--page" }, { token: "--bg", over: "--page" }],
    tokens: {
      "--page": { role: "ground" },
      "--bg": { role: "ground" },
      "--fg": { role: "text", on: ["--bg"] },
      "--alpha": { role: "exempt", reason: "Zahl, keine Farbe — die Deckkraft der Fläche" },
    },
    tweakAxes: [{ tweak: "veil", cssVar: "--alpha" }],
  };
  const TWEAKS = { veil: { type: "slider", min: 0.1, max: 0.9, step: 0.1, default: 0.1 } };

  it("fährt beide Extreme jeder Achse an und benennt sie im Report", () => {
    const r = measure(TWEAK_DECL, TWEAK_CSS, TWEAKS);
    expect(r.tweakStops).toEqual(["default", "veil=0.1", "veil=0.9"]);
    expect(r.checkedTweakExtremes).toBe(true);
  });

  it("findet den Bruch, den NUR das Extrem zeigt", () => {
    const r = measure(TWEAK_DECL, TWEAK_CSS, TWEAKS);
    expect(r.status).toBe("fail");
    // Beim Default (Fläche fast schwarz) trägt weisser Text; beim Maximum wird die
    // Fläche fast weiss und der Text verschwindet.
    const stops = new Set(r.violations.map((v) => v.tweaks));
    expect(stops.has("veil=0.9")).toBe(true);
    expect(stops.has("default")).toBe(false);
    expect(stops.has("veil=0.1")).toBe(false);
  });

  it("meldet eine Achse auf einen Tweak, den das Manifest gar nicht kennt", () => {
    const r = measure(TWEAK_DECL, TWEAK_CSS /* ohne tweaks */);
    expect(r.findings.map((f) => f.problem)).toContain("unknown-tweak");
    expect(r.checkedTweakExtremes).toBe(false);
  });

  it("ein Skin ohne farbwirksame Tweaks hat nichts anzufahren — und sagt das", () => {
    const r = measure(PASSING_DECL);
    expect(r.tweakStops).toEqual(["default"]);
    // Trivial wahr, aber im Report ablesbar: `tweakStops` nennt genau einen Stopp.
    expect(r.checkedTweakExtremes).toBe(true);
  });
});
