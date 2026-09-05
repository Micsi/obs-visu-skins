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
import {
  bearsColor,
  composite,
  contrast,
  declarations,
  measureA11y,
  parseRules,
  resolveColor,
  resolveNumber,
  THRESHOLDS,
} from "../a11y.js";

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

describe("Deckkraft-Achse — sie darf nicht wegmutierbar sein", () => {
  // Toter Winkel aus Runde 1: `composite()` konnte sein `alpha`-Argument ignorieren,
  // und ALLE 41 Kontrollen blieben grün — obwohl diese Achse bei ionic 710 der 1050
  // Verstösse erzeugt. Zwei Tests, die das jetzt unmöglich machen.

  it("mischt mit der Deckkraft, die man ihr gibt — von Hand nachgerechnet", () => {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    // Weiss zu 50 % über Schwarz = exakt die Hälfte jedes Kanals. Das ERGEBNIS ist
    // deckend (a: 1), denn der Grund war es — gemischt wird ein Pixel, kein Layer.
    expect(composite(white, black, 0.5)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(composite(white, black, 1)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    // Deckkraft 0: der Grund bleibt unverändert stehen.
    expect(composite(white, black, 0)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("dieselbe Farbe besteht bei voller Deckkraft und fällt bei gedimmter", () => {
    // Weiss auf Schwarz = 21:1. Dasselbe Weiss zu 30 % über Schwarz ergibt #4d4d4d
    // und damit 2.8:1 — unter der Text-Schwelle. Wer die Deckkraft ignoriert, sieht
    // hier zweimal 21:1 und dieser Test wird rot.
    const css = '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
    };

    const full = measure({ ...decl, alphas: [1] }, css);
    expect(full.status).toBe("pass");
    expect(full.worst.text?.ratio).toBe(21);

    const dimmed = measure({ ...decl, alphas: [1, 0.3] }, css);
    expect(dimmed.status).toBe("fail");
    expect(dimmed.violationCount).toBe(1);
    expect(dimmed.violations[0]!.alpha).toBe(0.3);
    expect(dimmed.violations[0]!.ratio).toBeLessThan(4.5);
    // Und die Aufteilung nennt die Teilmenge, statt sie in einer Gesamtzahl zu verstecken.
    expect(dimmed.violationBreakdown).toEqual({
      atDefault: 0,
      atTweakExtreme: 0,
      whenDimmed: 1,
    });
  });

  it("führt die Deckkraft je Token vor der des Skins", () => {
    const css = '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;--dot:#ffffff;}';
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: '.p[data-theme="dark"]' },
        grounds: [{ token: "--bg" }],
        alphas: [1],
        tokens: {
          "--bg": { role: "ground" },
          // Nur DIESER Token wird gedimmt — der Skin-Default bleibt 1.
          "--fg": { role: "text", alphas: [0.3] },
          "--dot": { role: "graphic" },
        },
      },
      css,
    );
    expect(r.violationCount).toBe(1);
    expect(r.violations[0]).toMatchObject({ token: "--fg", alpha: 0.3 });
  });
});

describe("Vollständigkeit über das GANZE Blatt (Riegel 1)", () => {
  // Zweiter toter Winkel aus Runde 1: der Scan sah nur `base` + Theme-Blöcke.
  // Beides wird jetzt einzeln scharf gestellt.

  const DECL = {
    stylesheet: SHEET,
    base: ":root",
    themes: { dark: '.p[data-theme="dark"]' },
    grounds: [{ token: "--bg" }],
    tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
  };
  const CSS = ':root{--brand:#123456;}.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}';

  it("fängt eine unklassifizierte Farbe im BASE-Block", () => {
    const r = measure(DECL, CSS);
    expect(r.findings.map((f) => f.problem)).toContain("unclassified");
    expect(r.findings.find((f) => f.problem === "unclassified")!.detail).toContain("--brand");
  });

  it("fängt eine unklassifizierte Farbe in einem GAR NICHT erklärten Block", () => {
    // Genau ionics `.visu-root { --ion-color-primary-contrast: #ffffff }` — der Textton
    // auf dem gefüllten Akzent-Button, den der frühere Scan nicht sehen konnte.
    const css = `${CSS}.irgendwo{--versteckt:#ffffff;}`;
    const r = measure(
      { ...DECL, tokens: { ...DECL.tokens, "--brand": { role: "ground", reason: "x" } } },
      css,
    );
    expect(r.findings.map((f) => f.problem)).toContain("unclassified");
    expect(r.findings.find((f) => f.problem === "unclassified")!.detail).toContain("--versteckt");
  });

  it("löst einen Token auf, der NUR ausserhalb der erklärten Blöcke steht", () => {
    // Klassifizieren allein reicht nicht: er muss auch messbar sein, sonst wäre
    // "steht in keinem erklärten Block" die nächste Hintertür.
    // `:root` statt eines beliebigen Selektors: der Token steht weiterhin in keinem
    // ERKLÄRTEN Block, kaskadiert aber wirklich in das gemessene Theme. Ein
    // unverwandter Selektor täte das nicht — dazu die Spec „borgt keinen Wert aus
    // einem Selektor, der gar nicht kaskadiert" weiter unten.
    const css = `${CSS}:root{--ink:#8a8a8a;}`;
    const r = measure(
      {
        ...DECL,
        tokens: {
          ...DECL.tokens,
          "--brand": { role: "exempt", reason: "Markenfarbe, nirgends gezeichnet" },
          "--ink": { role: "text", on: ["--bg"] },
        },
      },
      css,
    );
    // #8a8a8a auf Schwarz = 6.2:1 → bestanden, ABER es wurde wirklich gemessen:
    // zwei Paarungen (--fg und --ink, je gegen --bg), --brand ist exempt.
    expect(r.findings).toEqual([]);
    expect(r.combinations).toBe(2);
    expect(r.status).toBe("pass");
  });

  it("borgt keinen Wert aus einem Selektor, der gar nicht kaskadiert", () => {
    // `.unrelated-root { --fg }` kaskadiert nie in `.p[data-theme="dark"]`. Vorher
    // galt jeder Selektor, der bloss kein FREMDES Theme nennt — eine dunkle
    // Palette ohne eigenes `--fg` borgte sich den Wert und bestand.
    const css = `${CSS.replace("--fg:#ffffff;", "")}.unrelated-root{--fg:#ffffff;}`;
    const r = measure(DECL, css);
    // Scharf auf die MESSUNG: mit dem geborgten `--fg` (#ffffff auf #000000) waere
    // die Paarung sauber gemessen worden. Ohne ihn ist sie gar nicht auflösbar —
    // es gibt also einen Befund GENAU zu diesem Token.
    expect(r.findings.map((f) => f.detail).join(" ")).toContain("--fg");
  });

  it("hält einen var()-Alias auf eine Nicht-Farbe für keine Farbe", () => {
    // Ein Wächter mit falschem Alarm wird ignoriert: `--x: var(--schriftstapel)`
    // sieht aus wie eine Farbe und ist keine.
    const css = `:root{--stack:ui-sans-serif,system-ui;--font:var(--stack);}.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}`;
    const r = measure(DECL, css);
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });
});

describe("Die anderen drei Auswege (Riegel 2 · 3 · 4)", () => {
  it("Riegel 2 — `ground` deklarieren und aus `grounds` weglassen braucht eine Begründung", () => {
    const css = '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;--linie:#111111;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: {
        "--bg": { role: "ground" },
        "--fg": { role: "text", on: ["--bg"] },
        // Ohne Begründung: der stillste Ausweg — weder Vordergrund noch Grund.
        "--linie": { role: "ground" },
      },
    };
    const r = measure(decl, css);
    expect(r.status).toBe("fail");
    expect(r.findings.map((f) => f.problem)).toContain("ground-without-reason");

    const ok = measure(
      {
        ...decl,
        tokens: {
          ...decl.tokens,
          "--linie": { role: "ground", reason: "Trennlinie, kein Vordergrund" },
        },
      },
      css,
    );
    expect(ok.status).toBe("pass");
    // Und die Auslassung steht sichtbar im Artefakt, nicht nur im Manifest.
    expect(ok.unmeasuredGrounds).toEqual({ "--linie": "Trennlinie, kein Vordergrund" });
  });

  it("Riegel 3 — ein Theme auszunehmen verlangt dieselbe Begründung wie ein Token", () => {
    const css =
      '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}.p[data-theme="light"]{--bg:#ffffff;--fg:#eeeeee;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]', light: '.p[data-theme="light"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text", on: ["--bg"] } },
    };
    // Ohne Ausnahme fällt `light` (Fast-Weiss auf Weiss).
    expect(measure(decl, css).status).toBe("fail");

    // Leere Begründung: das ganze Theme wäre lautlos verschwunden.
    const sneaky = measure({ ...decl, exemptThemes: { light: "" } }, css);
    expect(sneaky.status).toBe("fail");
    expect(sneaky.findings.map((f) => f.problem)).toContain("exempt-without-reason");

    // Mit Begründung ist es eine Aussage — und sie steht im Report.
    const stated = measure(
      { ...decl, exemptThemes: { light: "nur ein Entwurf, nicht ausgeliefert" } },
      css,
    );
    expect(stated.status).toBe("pass");
    expect(stated.themes).toEqual(["dark"]);
    expect(stated.exemptThemes).toEqual({ light: "nur ein Entwurf, nicht ausgeliefert" });
  });

  it("Riegel 4 — ein nicht eingeordneter Tweak nimmt `checkedTweakExtremes` weg", () => {
    const css = '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text", on: ["--bg"] } },
    };
    const tweaks = { stil: { type: "select", options: ["a", "b"], default: "a" } };

    // Nicht eingeordnet: Befund UND die positive Behauptung fällt weg.
    const silent = measure(decl, css, tweaks);
    expect(silent.checkedTweakExtremes).toBe(false);
    expect(silent.findings.map((f) => f.problem)).toContain("undeclared-tweak");

    // Als farbneutral erklärt: die Aussage trägt wieder.
    const neutral = measure(
      { ...decl, neutralTweaks: { stil: "schaltet nur die Ecken um" } },
      css,
      tweaks,
    );
    expect(neutral.checkedTweakExtremes).toBe(true);
    expect(neutral.status).toBe("pass");

    // Als farbwirksam-aber-nicht-erfassbar erklärt: kein Befund, aber die
    // Behauptung bleibt unten — genau das ist der Unterschied zu Runde 1.
    const owned = measure(
      { ...decl, unmeasuredTweaks: { stil: "attributgeschaltet, keine Variable" } },
      css,
      tweaks,
    );
    expect(owned.findings).toEqual([]);
    expect(owned.checkedTweakExtremes).toBe(false);
    expect(owned.unmeasuredTweaks).toEqual({ stil: "attributgeschaltet, keine Variable" });
  });

  it("Riegel 4 — eine Einordnung ohne Begründung ist ebenfalls ein Vergessen", () => {
    const css = '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}';
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: '.p[data-theme="dark"]' },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text", on: ["--bg"] } },
        neutralTweaks: { stil: "" },
      },
      css,
      { stil: { type: "select", options: ["a", "b"], default: "a" } },
    );
    expect(r.findings.map((f) => f.problem)).toContain("exempt-without-reason");
  });
});

/* ====================================================================== */

describe("Riegel 5-8 — die vier Auswege der zweiten Review-Runde", () => {
  // Vier Löcher, durch die ein Skin `pass` bekommen konnte, ohne dass die Messung
  // ihn deckte. Jede Spec fährt den Fall an, in dem der Wächter fallen MUSS, und
  // daneben den Nachbarfall, in dem er still bleiben muss.

  it("Riegel 8 — eine Farbe direkt in einer Regel wird gesehen, nicht übersprungen", () => {
    // Der Scan erkannte ausschliesslich `--name`. `outline: 2px solid #d6a800`
    // (edomi) und hartcodierte `color: #fff` (ionic) wurden damit WEDER
    // klassifiziert NOCH gemessen: `status: "pass"` bei unzugänglichem Vordergrund.
    const css = `${PASSING_CSS}.knopf:focus-visible{outline:2px solid #d6a800;}`;
    const r = measure(PASSING_DECL, css);
    expect(r.status).toBe("fail");
    const hit = r.findings.find((f) => f.detail.includes("#d6a800"));
    expect(hit, "die Farbe an den Token vorbei muss auftauchen").toBeDefined();
    expect(hit!.problem).toBe("unclassified");
  });

  it("Riegel 8 — dieselbe Regel über einen deklarierten Token bleibt still", () => {
    // Der Nachbarfall: der Weg AUS dem Befund heraus ist ein Token mit Rolle,
    // nicht das Weglassen der Regel.
    const css =
      '.p[data-theme="dark"]{--bg:#ffffff;--fg:#000000;--dot:#767676;}' +
      ".knopf:focus-visible{outline:2px solid var(--dot);}";
    const r = measure(PASSING_DECL, css);
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });

  it("Riegel 8 — schlägt NICHT auf `url(#…)` oder auf Text in Anführungszeichen an", () => {
    // Ein Wächter mit falschem Alarm wird ignoriert.
    const css =
      `${PASSING_CSS}.g{fill:url(#verlauf);}` + '.h::after{content:"#1 von 3";border-radius:3px;}';
    const r = measure(PASSING_DECL, css);
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });

  it("Riegel 5 — ein Theme des Manifests, das a11y nicht kennt, ist ein Befund", () => {
    // `manifest.themes` bietet `light` an, die Palette deklariert nur `dark`: die
    // helle Palette wurde still übersprungen und der Report konnte `pass` sein.
    const manifest = {
      ...manifestWith(PASSING_DECL),
      themes: ["dark", "light"],
    } as unknown as SkinManifest;
    const r = measureA11y({ manifest, styles: { [SHEET]: PASSING_CSS } });
    expect(r.status).toBe("fail");
    expect(r.findings.some((f) => f.detail.includes("light"))).toBe(true);
  });

  it("Riegel 5 — mit Begründung ausgenommen ist es wieder eine Aussage", () => {
    const manifest = {
      ...manifestWith({
        ...PASSING_DECL,
        themes: { dark: '.p[data-theme="dark"]', light: '.p[data-theme="light"]' },
        exemptThemes: { light: "Nur ein Entwurf, im Produkt nicht wählbar." },
      }),
      themes: ["dark", "light"],
    } as unknown as SkinManifest;
    const r = measureA11y({ manifest, styles: { [SHEET]: PASSING_CSS } });
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });

  it("Riegel 6 — eine Rolle, die es nicht gibt, macht den Token unsichtbar", () => {
    // Manifeste kommen per Typ-Zusicherung aus JSON. `"role": "tetx"` fiel durch
    // JEDE Schleife, galt dem Vollständigkeits-Scan aber als klassifiziert.
    const decl = {
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--dot": { role: "tetx" } },
    };
    const r = measure(decl);
    expect(r.status).toBe("fail");
    const hit = r.findings.find((f) => f.detail.includes("--dot"));
    expect(hit!.detail).toContain("tetx");
  });

  it('Riegel 7 — `"on": []` misst nichts und wird gemeldet', () => {
    const decl = {
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--fg": { role: "text", on: [] } },
    };
    const r = measure(decl);
    expect(r.status).toBe("fail");
    expect(r.findings.some((f) => f.detail.includes('"on": []'))).toBe(true);
    // …und der Token fällt trotzdem nicht aus der Messung: die leere Angabe fällt
    // auf die strengere Lesart zurück (gegen alle Gründe).
    expect(r.combinations).toBe(2);
  });

  it("Riegel 7 — ein gefülltes `on` bleibt unangetastet", () => {
    const decl = {
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--fg": { role: "text", on: ["--bg"] } },
    };
    const r = measure(decl);
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });
});

describe("Der Rückfall-Boden borgt keine Farbe aus einem fremden Theme (F12)", () => {
  // Der Boden wurde aus JEDER Deklaration JEDES Selektors gefüllt. Fehlte ein
  // Token im dunklen Block, borgte die dunkle Messung ihn still aus dem hellen —
  // eine unvollständige dunkle Palette konnte `pass` bekommen, statt den Token als
  // fehlend zu melden. Der Mechanismus ist neu in dieser Welle; er hätte den
  // Riegel, den er stützen soll, von hinten geöffnet.
  const TWO_THEMES = {
    stylesheet: SHEET,
    themes: { dark: '.p[data-theme="dark"]', light: '.p[data-theme="light"]' },
    grounds: [{ token: "--bg" }],
    tokens: {
      "--bg": { role: "ground" },
      "--fg": { role: "text", on: ["--bg"] },
    },
  };

  it("meldet einen Token, den NUR das andere Theme definiert, als fehlend", () => {
    const css =
      '.p[data-theme="dark"]{--bg:#000000;}' + '.p[data-theme="light"]{--bg:#ffffff;--fg:#000000;}';
    const r = measure(TWO_THEMES, css);
    expect(r.status).toBe("fail");
    const hit = r.findings.find((f) => f.detail.includes("dark") && f.detail.includes("--fg"));
    expect(hit, "--fg fehlt im dunklen Theme und muss auffallen").toBeDefined();
    // Nur das helle Theme wurde wirklich gemessen.
    expect(r.combinations).toBe(1);
  });

  it("borgt auch aus einem NACHFAHREN-Selektor des fremden Themes nichts", () => {
    // `.p[data-theme="light"] .karte` gilt im dunklen Theme genauso wenig.
    const css =
      '.p[data-theme="dark"]{--bg:#000000;}' +
      '.p[data-theme="light"]{--bg:#ffffff;}' +
      '.p[data-theme="light"] .karte{--fg:#000000;}';
    const r = measure(TWO_THEMES, css);
    expect(r.status).toBe("fail");
    expect(r.findings.some((f) => f.detail.includes("dark") && f.detail.includes("--fg"))).toBe(
      true,
    );
  });

  it("nimmt einen GEMEINSAMEN Block weiterhin in beide Themes auf", () => {
    // Der Boden darf nicht zu eng werden: ionics `--ion-*`-Brücke unter
    // `.visu-root` und terminals `.t-root`-Vorgaben stehen ausserhalb der
    // Theme-Blöcke und gelten trotzdem in jedem Theme.
    const css =
      ".p{--fg:#000000;}" +
      '.p[data-theme="dark"]{--bg:#ffffff;}' +
      '.p[data-theme="light"]{--bg:#ffffff;}';
    const r = measure(TWO_THEMES, css);
    expect(r.findings).toEqual([]);
    expect(r.combinations).toBe(2);
    expect(r.status).toBe("pass");
  });
});

describe("Zugestandene und stille Lücken in der Deckung (F14 · F15)", () => {
  it("F14 — ein EINGERÄUMTER Tweak senkt die Deckung, nicht das Urteil", () => {
    // `unmeasuredTweaks` räumt einen farbwirksamen, von dieser Fläche nicht
    // erfassbaren Tweak ein. Das war zeitweise ein `fail` — und machte das Gate
    // für attributgeschaltete Skins strukturell unerreichbar: es gibt dort keinen
    // ehrlichen Weg zu voller Deckung, also bestrafte die Latte die Ehrlichkeit
    // (openbridgeserver#181). Der Vertrag hält beide Aussagen ohnehin getrennt.
    const decl = {
      ...PASSING_DECL,
      unmeasuredTweaks: {
        stil: "Schaltet ein anderes Regelwerk frei, keine Variablen-Achse — ungeprüft.",
      },
    };
    const r = measure(decl, PASSING_CSS, { stil: { type: "select", options: ["glass", "ios"] } });
    expect(r.violationCount).toBe(0);
    expect(r.findings).toEqual([]);
    // Das Urteil folgt dem Gemessenen …
    expect(r.status).toBe("pass");
    expect(r.aa).toBe(true);
    // … die Lücke bleibt trotzdem im Report stehen und verschwindet nicht.
    expect(r.checkedTweakExtremes).toBe(false);
    expect(r.unmeasuredTweaks).toHaveProperty("stil");
  });

  it("F14 — ein VERSCHWIEGENER Tweak fällt weiter durch", () => {
    // Die Gegenprobe zur Lockerung: derselbe farbwirksame Tweak, nur eben nirgends
    // eingeordnet. Hier behauptet der Report Deckung, die es nicht gibt — und das
    // bleibt ein Fehler, sonst wäre `unmeasuredTweaks` bloss die mühsamere Variante
    // desselben Schweigens.
    const r = measure(PASSING_DECL, PASSING_CSS, {
      stil: { type: "select", options: ["glass", "ios"] },
    });
    expect(r.checkedTweakExtremes).toBe(false);
    expect(r.status).toBe("fail");
    expect(r.aa).toBe(false);
    expect(r.findings.map((f) => f.problem)).toContain("undeclared-tweak");
  });

  it("F14 — eine Einräumung OHNE Begründung fällt durch", () => {
    // Die zweite Gegenprobe: die Einräumung trägt nur, weil sie eine Aussage ist.
    const decl = { ...PASSING_DECL, unmeasuredTweaks: { stil: "  " } };
    const r = measure(decl, PASSING_CSS, { stil: { type: "select", options: ["glass", "ios"] } });
    expect(r.status).toBe("fail");
    expect(r.findings.map((f) => f.problem)).toContain("exempt-without-reason");
  });

  it("F14 — derselbe Skin ohne das Zugeständnis besteht", () => {
    const decl = {
      ...PASSING_DECL,
      neutralTweaks: { stil: "Reine Geometrie, verschiebt keinen Farbwert." },
    };
    const r = measure(decl, PASSING_CSS, { stil: { type: "select", options: ["glass", "ios"] } });
    expect(r.checkedTweakExtremes).toBe(true);
    expect(r.status).toBe("pass");
  });

  it("F15 — ein Vordergrund, der erst am Extrem unauflösbar wird, wird gemeldet", () => {
    // Unauflösbare Vordergründe wurden NUR am Default-Stopp gemeldet: ein Tweak
    // lieferte am Default einen messbaren Hexwert und an jedem Extrem `null` — und
    // der Report sagte weiter `checkedTweakExtremes: true` und `pass`, obwohl dort
    // nichts gemessen wurde.
    //
    // Der Fall stand ursprünglich mit `red`, weil der frühere Farb-Parser benannte
    // Farben nicht kannte. culori kennt sie, und das ist die bessere Messung — der
    // Fall braucht deshalb einen Wert, der wirklich keine Farbe IST.
    const decl = {
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--dot": { role: "graphic", on: ["--bg"] } },
      tweakAxes: [{ tweak: "ton", cssVar: "--dot" }],
    };
    const r = measure(decl, PASSING_CSS, {
      ton: { type: "select", options: ["linear-gradient(red, blue)"] },
    });
    expect(r.tweakStops).toEqual(["default", "ton=linear-gradient(red, blue)"]);
    const hit = r.findings.find((f) => f.problem === "unresolvable");
    expect(hit, "der Stopp, an dem nichts mehr auflösbar ist, muss auftauchen").toBeDefined();
    expect(hit!.detail).toContain("ton=linear-gradient(red, blue)");
    expect(r.status).toBe("fail");
  });

  it("F15 — ein Extrem, das auflösbar bleibt, erzeugt keinen Befund", () => {
    const decl = {
      ...PASSING_DECL,
      tokens: { ...PASSING_DECL.tokens, "--dot": { role: "graphic", on: ["--bg"] } },
      tweakAxes: [{ tweak: "ton", cssVar: "--dot" }],
    };
    const r = measure(decl, PASSING_CSS, { ton: { type: "select", options: ["#595959"] } });
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });
});

describe("CSS-Parsen — der Waechter darf nicht an der Schreibweise scheitern", () => {
  it("streift `!important` ab, bevor er die Farbe aufloest", () => {
    // Der Marker entscheidet im Browser nur, WELCHE Deklaration gewinnt; der
    // berechnete Wert ist derselbe. Am Wert kleben liess er `resolveColor`
    // scheitern und einen sonst konformen Skin mit `unresolvable` durchfallen.
    const decls = declarations("--fg: #000 !important; --bg: #fff");
    expect(Object.fromEntries(decls)).toEqual({ "--fg": "#000", "--bg": "#fff" });
    expect(resolveColor("#000", new Map(decls))).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("haelt eine Custom-Property-Folge INNERHALB einer Zeichenkette fuer Text", () => {
    // `content: "--brand: #fff"` ist keine Deklaration. Der Regex auf den Rohtext
    // sah dort einen Token, und der Vollstaendigkeits-Scan meldete das Phantom als
    // `unclassified` — ein Befund ueber Text, den niemand als Farbe benutzt.
    const decls = declarations('content: "--brand: #fff"; --fg: #111');
    expect(decls.map(([n]) => n)).toEqual(["--fg"]);
  });

  it("erkennt Namen mit Nicht-ASCII-Zeichen", () => {
    // `\w` kennt nur ASCII. `--zustand-grün` fiel damit aus Umgebung UND Scan,
    // waehrend gewoehnliches CSS ihn ueber `var()` sehr wohl verbraucht.
    const decls = declarations("--zustand-grün: #0f0");
    expect(Object.fromEntries(decls)).toEqual({ "--zustand-grün": "#0f0" });
    const env = new Map(decls);
    expect(resolveColor("var(--zustand-grün)", env)).toEqual({ r: 0, g: 255, b: 0, a: 1 });
  });

  it("erkennt auch die Farbsyntaxen jenseits von Hex und rgb()", () => {
    // Fehlt eine Syntax im Praedikat, faellt die Deklaration stillschweigend aus
    // der Messung — `color: red` ist genauso an der Palette vorbei wie ein Hexwert.
    for (const v of [
      "red",
      "oklch(70% 0.1 200)",
      "lab(50% 20 -30)",
      "hwb(90 10% 10%)",
      "2px solid #d6a800",
      "linear-gradient(rebeccapurple, blue)",
      "color-mix(in oklab, red, blue)",
      "currentcolor",
    ]) {
      expect(bearsColor(v), v).toBe(true);
    }
    // Gegenprobe: kein Fehlalarm auf Woertern, die eine Farbe nur ENTHALTEN — und
    // vor allem nicht auf dem NAMEN einer Variablen. Die frühere Wortliste schlug in
    // `var(--red-thing)` an und meldete einen Phantom-Befund.
    for (const v of [
      "1px solid",
      "border-box",
      "inherit",
      "var(--red-thing)",
      "var(--tomato-border)",
      'content: "#1"'.slice(9),
      "url(#gradient)",
      // culori nimmt Hex auch OHNE Raute — CSS nicht. Ohne diesen Riegel waere jede
      // Gewichts- oder Zeitangabe im Blatt ein Phantom-Befund.
      "600",
      "700",
      // `transparent` ist eine gueltige Farbe, aber keine sichtbare: sie umgeht
      // keine Palette.
      "transparent",
    ]) {
      expect(bearsColor(v), v).toBe(false);
    }
    expect(resolveColor("600", new Map())).toBeNull();
    // Aber der RÜCKFALL eines var() zählt sehr wohl.
    expect(bearsColor("var(--x, #d6a800)")).toBe(true);
  });

  it("nimmt den `var()`-Rueckfall auch bei garantiert ungueltigem Wert", () => {
    // `--optional: initial; --fg: var(--optional, #fff)` ist gueltiges CSS und
    // berechnet `#fff`. Hier galt es als `unresolvable`, weil der Token ja
    // "existiert" — der Rueckfall wurde nie versucht.
    const env = new Map(declarations("--optional: initial"));
    expect(resolveColor("var(--optional, #fff)", env)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });
});

describe("bedingte Bloecke — was nur unter einer Bedingung gilt, misst nicht den Normalfall", () => {
  const DECL = {
    stylesheet: SHEET,
    base: ":root",
    themes: { dark: '.p[data-theme="dark"]' },
    grounds: [{ token: "--bg" }],
    tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
  };

  it("nimmt einen `@media`-Override NICHT in die Standard-Umgebung", () => {
    // Die Bedingung fiel beim Parsen weg, die Regel galt universell: ein spaeteres
    // `@media (forced-colors: active) { … --fg: #fff }` ueberschrieb waehrend der
    // Messung ein kontrastschwaches `--fg`, und die normale Darstellung bestand mit
    // einem Wert, den sie nie zeigt.
    const css =
      '.p[data-theme="dark"]{--bg:#000000;--fg:#111111;}' +
      '@media (forced-colors: active){.p[data-theme="dark"]{--fg:#ffffff;}}';
    const r = measure(DECL, css);
    // Scharf auf die MESSUNG, nicht auf den Status: der kann aus anderem Grund
    // fallen. Gemessen werden muss das schwache `--fg` des Normalfalls, also gibt
    // es einen Verstoss. Mit dem @media-Wert (#ffffff auf #000000) gaebe es keinen.
    expect(r.violationCount).toBeGreaterThan(0);
  });

  it("…sieht ihn aber weiterhin im Vollstaendigkeits-Scan", () => {
    // Sonst waere `@media` das neue Versteck: unklassifizierte Farbe einfach in
    // eine Bedingung schreiben.
    const css =
      '.p[data-theme="dark"]{--bg:#000000;--fg:#ffffff;}' +
      '@media (min-width: 40em){.p[data-theme="dark"]{--geheim:#abcdef;}}';
    const r = measure(DECL, css);
    expect(r.findings.map((f) => f.detail).join(" ")).toContain("--geheim");
  });
});

describe("Tweak-Stopps messen, was der Benutzer wirklich einstellen kann", () => {
  // Ein Blatt mit ZWEI farbwirksamen Achsen: der Vordergrund und der Grund lassen
  // sich unabhängig verschieben. Jede Achse für sich bleibt lesbar, zusammen nicht.
  const TWO_AXIS_CSS =
    '.p[data-theme="dark"]{--fg-lvl:#000000;--bg-lvl:#ffffff;--bg:var(--bg-lvl);--fg:var(--fg-lvl);}';
  const TWO_AXIS_DECL = {
    stylesheet: SHEET,
    themes: { dark: '.p[data-theme="dark"]' },
    grounds: [{ token: "--bg" }],
    tokens: {
      "--bg": { role: "ground" },
      "--fg": { role: "text" },
      // Die Reglerstufen selbst tragen Farbe und müssen deshalb eingeordnet sein
      // (Riegel 1); gemessen werden sie über --bg/--fg, nicht noch einmal selbst.
      "--fg-lvl": { role: "exempt", reason: "Reglerstufe hinter --fg, dort gemessen." },
      "--bg-lvl": { role: "exempt", reason: "Reglerstufe hinter --bg, dort gemessen." },
    },
    tweakAxes: [
      { tweak: "fg", cssVar: "--fg-lvl" },
      { tweak: "bg", cssVar: "--bg-lvl" },
    ],
  };
  const TWO_AXIS_TWEAKS = {
    fg: { type: "select", options: ["#000000", "#707070"] },
    bg: { type: "select", options: ["#ffffff", "#777777"] },
  };

  it("fährt das KARTESISCHE Produkt der Achsen an, nicht eine Achse je Stopp", () => {
    // Vorher überschrieb jeder Stopp genau eine Variable; die anderen Achsen blieben
    // auf ihrem Blatt-Wert. `#707070` auf Weiss besteht, Schwarz auf `#777777`
    // besteht — die gleichzeitige Stellung hat 1.09:1 und wurde nie gemessen.
    const r = measure(TWO_AXIS_DECL, TWO_AXIS_CSS, TWO_AXIS_TWEAKS);
    expect(r.tweakStops).toContain("fg=#707070 bg=#777777");
    const joint = r.violations.filter((v) => v.tweaks === "fg=#707070 bg=#777777");
    expect(joint.length).toBeGreaterThan(0);
    expect(r.status).toBe("fail");
  });

  it("die Einzelstellungen bleiben trotzdem erhalten", () => {
    // Die Gegenprobe zum Produkt: es ERSETZT die Einzelachsen nicht, es ergänzt sie.
    // Sonst verlöre der Report die Stellung, die ein Benutzer am ehesten wählt.
    const r = measure(TWO_AXIS_DECL, TWO_AXIS_CSS, TWO_AXIS_TWEAKS);
    expect(r.tweakStops).toContain("default");
    expect(r.tweakStops).toContain("fg=#707070");
    expect(r.tweakStops).toContain("bg=#777777");
  });

  it("der Manifest-`default` eines Reglers wird angefahren", () => {
    // Ein Regler liefert nur min und max. Steht der Default DAZWISCHEN, wurde er nie
    // gemessen — obwohl genau ihn der Host beim Start setzt. Hier liegt der Grund bei
    // 0.5 so nah am Vordergrund, dass nur der mittlere Stopp reisst.
    const css = '.p[data-theme="dark"]{--lvl:1;--bg:rgba(0,0,0,var(--lvl));--fg:#808080;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      tweakAxes: [{ tweak: "lvl", cssVar: "--lvl" }],
    };
    const r = measure(decl, css, { lvl: { type: "slider", min: 0, max: 1, default: 0.5 } });
    expect(r.tweakStops).toContain("lvl=0.5");
  });

  it("eine Achse, deren Variable im Blatt fehlt, ist ein BEFUND", () => {
    // Ein Tippfehler im `cssVar` erzeugte Stopps, die die Default-Palette
    // wiederholten — `stops.length > 1` machte `checkedTweakExtremes` wahr, und ein
    // Skin mit einem echten, unzugänglichen Tweak konnte bestehen.
    const decl = {
      ...PASSING_DECL,
      tweakAxes: [{ tweak: "veil", cssVar: "--aplha" }],
    };
    const r = measure(decl, PASSING_CSS, { veil: { type: "slider", min: 0, max: 1 } });
    expect(r.findings.map((f) => f.detail).join(" ")).toContain("--aplha");
    expect(r.status).toBe("fail");
  });

  it("dieselbe Achse mit richtig geschriebener Variable ist es nicht", () => {
    // Die Gegenprobe: der Riegel darf nicht jede Achse fangen, nur die inerte.
    const css = '.p[data-theme="dark"]{--alpha:1;--bg:#ffffff;--fg:rgba(0,0,0,var(--alpha));}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      tweakAxes: [{ tweak: "veil", cssVar: "--alpha" }],
    };
    const r = measure(decl, css, { veil: { type: "slider", min: 1, max: 1 } });
    expect(r.findings).toEqual([]);
    expect(r.checkedTweakExtremes).toBe(true);
  });
});

describe("Deckkraft und Präzision", () => {
  it("eine Deckkraft ausserhalb 0…1 wird gemeldet, nicht gerechnet", () => {
    // `composite` extrapoliert bei alpha > 1 die Kanäle, statt eine Deckkraft
    // anzuwenden, die es im Browser gar nicht gibt: `#777` auf Weiss rechnete sich
    // so zu einem hohen Verhältnis hoch, während der Schirm ~4.48:1 zeigt.
    const decl = { ...PASSING_DECL, alphas: [2] };
    const r = measure(decl);
    expect(r.findings.map((f) => f.detail).join(" ")).toContain("ausserhalb 0…1");
    expect(r.status).toBe("fail");
  });

  it("das Verhältnis steht mit voller Präzision im Report", () => {
    // Der Vergleich nahm das exakte Verhältnis, der Report den auf zwei Stellen
    // gerundeten: `#070707` auf `#777777` sind ~4.498:1 — korrekt ein Verstoss, und
    // im Report stand `4.5`, wo jeder Leser ein Bestehen sieht.
    const css = '.p[data-theme="dark"]{--bg:#777777;--fg:#070707;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
    };
    const r = measure(decl, css);
    const m = r.violations.find((v) => v.token === "--fg");
    expect(m).toBeDefined();
    expect(m!.ratio).toBeLessThan(4.5);
    expect(m!.ratio).not.toBe(4.5);
  });
});

describe("Gründe: Zyklen und das, was wirklich deckend ist", () => {
  it("ein Zyklus in der `over`-Kette wird nicht zu einem deckenden Grund gerechnet", () => {
    // `--a über --b` und `--b über --a` lief vorher in die Tiefengrenze, und beim
    // Zurückwickeln nahm jeder Aufrufer seine eigene transluzente Farbe als gültigen
    // Unterbau: die zyklischen Farben wurden so oft übereinandergelegt, bis das
    // Ergebnis deckend AUSSAH — und die Messung bestand ohne jeden deckenden Grund.
    const css = '.p[data-theme="dark"]{--a:rgba(255,255,255,0.5);--b:rgba(255,255,255,0.5);--fg:#000000;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [
        { token: "--a", over: "--b" },
        { token: "--b", over: "--a" },
      ],
      tokens: {
        "--a": { role: "ground" },
        "--b": { role: "ground" },
        "--fg": { role: "text", on: ["--a"] },
      },
    };
    const r = measure(decl, css);
    expect(r.status).toBe("fail");
    // Kein Fall darf gegen einen der beiden Zyklus-Gründe gemessen worden sein.
    expect(r.combinations).toBe(0);
  });

  it("dieselbe Kette mit deckendem Boden misst normal", () => {
    // Die Gegenprobe: der Riegel darf nur den Zyklus fangen, nicht jede Kette.
    const css = '.p[data-theme="dark"]{--a:rgba(255,255,255,0.5);--b:#ffffff;--fg:#000000;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--a", over: "--b" }, { token: "--b" }],
      tokens: {
        "--a": { role: "ground" },
        "--b": { role: "ground" },
        "--fg": { role: "text", on: ["--a"] },
      },
    };
    const r = measure(decl, css);
    expect(r.findings).toEqual([]);
    expect(r.combinations).toBeGreaterThan(0);
    expect(r.status).toBe("pass");
  });

  it("99.9 % Deckkraft ohne Unterbau ist nicht deckend", () => {
    // Die alte Schwelle liess alles ab 0.999 als deckend durchgehen. Gerechnet wurde
    // dann gegen reines Weiss, während der Browser weiter mit einem unbekannten Ton
    // darunter mischt — nah an der Grenze wird daraus ein `pass`, das nichts belegt.
    const css = '.p[data-theme="dark"]{--bg:rgba(255,255,255,0.999);--fg:#000000;}';
    const decl = {
      stylesheet: SHEET,
      themes: { dark: '.p[data-theme="dark"]' },
      grounds: [{ token: "--bg" }],
      tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
    };
    const r = measure(decl, css);
    expect(r.findings.map((f) => f.problem)).toContain("translucent-ground");
    expect(r.status).toBe("fail");
  });
});

describe("die CSS-Grammatik kommt von postcss, nicht aus einem Regex", () => {
  // Jeder Fall hier stand als eigener Review-Befund am früheren Eigenbau. Sie stehen
  // zusammen, weil sie EINE Ursache hatten: eine nachgebaute Grammatik. Wer den
  // Parser wieder von Hand schreibt, bricht diesen Block als Ganzes.

  it("ein Kommentar-Anfang IN einer Zeichenkette beendet nichts", () => {
    // `replace(/\/\*[\s\S]*?\*\//g, "")` frass ab dem `/*` in der Zeichenkette alles
    // bis zum nächsten echten `*/` — hier also `--fg`, den Blockschluss und den Kopf
    // von `.b`. Der Test braucht deshalb BEIDE Hälften, sonst greift die alte
    // Ersetzung mangels Gegenstück gar nicht und der Fall belegt nichts.
    const rules = parseRules('.a{content:"/*";--fg:#123456}\n.b{/* echt */--bg:#654321}');
    expect(rules.map((r) => r.selectors[0])).toEqual([".a", ".b"]);
    expect(rules[0]!.decls.find((d) => d.prop === "--fg")?.value).toBe("#123456");
    expect(rules[1]!.decls.find((d) => d.prop === "--bg")?.value).toBe("#654321");
  });

  it("eine geschweifte Klammer IN einer Zeichenkette teilt keinen Block", () => {
    const rules = parseRules('.a{content:"}";--fg:#123456}');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.selectors).toEqual([".a"]);
    expect(rules[0]!.decls.find((d) => d.prop === "--fg")?.value).toBe("#123456");
  });

  it("ein Semikolon IN einem Wert schneidet den Wert nicht ab", () => {
    const rules = parseRules('.a{--u:url("data:image/svg+xml;base64,AAA");--fg:#123456}');
    expect(rules[0]!.decls.find((d) => d.prop === "--u")?.value).toContain("base64,AAA");
    expect(rules[0]!.decls.find((d) => d.prop === "--fg")?.value).toBe("#123456");
  });

  it("ein Komma IN einem funktionalen Selektor teilt die Selektorliste nicht", () => {
    // `.split(",")` machte aus `:is(.a, .b) .c` zwei Selektoren, von denen keiner
    // gültig war — der ganze Block fiel aus der Messung.
    const rules = parseRules(":is(.a, .b) .c, .d{--fg:#123456}");
    expect(rules[0]!.selectors).toEqual([":is(.a, .b) .c", ".d"]);
  });

  it("die erste Regel nach einem `@import` bleibt sichtbar", () => {
    // Der At-Kopf klebte am folgenden Selektor; die Selektorliste begann mit `@` und
    // wurde weggefiltert. edomis erste Regel war so unsichtbar.
    const rules = parseRules('@import "./x.css";\n.edomi-root{--fg:#123456}');
    expect(rules.map((r) => r.selectors[0])).toContain(".edomi-root");
  });

  it("`!important` steht am Knoten, nicht im Wert", () => {
    const rules = parseRules(".a{--fg:#123456 !important;--bg:#ffffff}");
    const fg = rules[0]!.decls.find((d) => d.prop === "--fg")!;
    expect(fg.value).toBe("#123456"); // ohne Marker — der berechnete Wert ist derselbe
    expect(fg.important).toBe(true);
    expect(rules[0]!.decls.find((d) => d.prop === "--bg")!.important).toBe(false);
  });

  it("ein Name mit Nicht-ASCII-Zeichen zählt als Deklaration", () => {
    // `\w` kennt nur ASCII: `--zustand-grün` fiel weg, obwohl CSS ihn über `var()`
    // sehr wohl verbraucht.
    const rules = parseRules(".a{--zustand-grün:#123456}");
    expect(rules[0]!.decls.map((d) => d.prop)).toEqual(["--zustand-grün"]);
  });

  it("ein Block in `@media` ist markiert, nicht weggeworfen", () => {
    const rules = parseRules("@media (forced-colors:active){.a{--fg:#fff}}\n.b{--fg:#000}");
    const a = rules.find((r) => r.selectors.includes(".a"))!;
    const b = rules.find((r) => r.selectors.includes(".b"))!;
    expect(a.conditional).toBe(true);
    expect(b.conditional).toBe(false);
  });

  it("ein Block in `@layer` trägt seine Schicht mit", () => {
    const rules = parseRules("@layer base{.a{--fg:#111}}\n.b{--fg:#222}");
    expect(rules.find((r) => r.selectors.includes(".a"))!.layer).toBe("base");
    expect(rules.find((r) => r.selectors.includes(".b"))!.layer).toBe("");
  });

  it("ein unlesbares Blatt wirft nicht, es liefert nichts", () => {
    // Ein Ausnahmefehler hier würde den ganzen Lauf kippen statt den Skin zu melden.
    expect(() => parseRules(".a{")).not.toThrow();
  });
});

describe("Farbwerte liest culori, var() setzt der Browser-Ablauf ein", () => {
  const E = new Map<string, string>();

  it("kennt die Farbsyntaxen, die ein Blatt wirklich benutzt", () => {
    // Jede Zeile hier stand als eigener Befund am früheren Regex-Parser: fehlende
    // Syntaxen, kaputte Prozentkanäle, verschluckte Nachkommastellen, Tabulator
    // statt Leerzeichen, benannte Farben.
    expect(resolveColor("#abc", E)).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(resolveColor("#aabbccdd", E)?.a).toBeCloseTo(0.867, 2);
    expect(resolveColor("rgb(10, 20, 30)", E)).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(resolveColor("rgb(10 20 30 / 50%)", E)?.a).toBeCloseTo(0.5, 3);
    expect(resolveColor("rgb(50% 20% 10%)", E)).toEqual({ r: 128, g: 51, b: 26, a: 1 });
    expect(resolveColor("rgb(10\t20\t30)", E)).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(resolveColor("hsl(0 100% 50%)", E)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(resolveColor("hwb(0 0% 0%)", E)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(resolveColor("rebeccapurple", E)).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(resolveColor("oklch(0.7 0.15 250)", E)).not.toBeNull();
    expect(resolveColor("lab(50% 40 30)", E)).not.toBeNull();
    expect(resolveColor("color(srgb 1 0 0)", E)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("Nachkommastellen in Kanälen gehen nicht verloren", () => {
    // `rgb(0.5 0.5 0.5)` wurde zu ganzen Kanälen gerundet, bevor gerechnet wurde.
    const a = resolveColor("rgb(0.4 0.4 0.4)", E)!;
    const b = resolveColor("rgb(1.4 1.4 1.4)", E)!;
    expect(a.r).not.toBe(b.r);
  });

  it("Alpha wird auf 0…1 geklemmt, wie CSS es tut", () => {
    expect(resolveColor("rgb(0 0 0 / 200%)", E)?.a).toBe(1);
    expect(resolveColor("rgb(0 0 0 / -1)", E)?.a).toBe(0);
  });

  it("was keine Farbe IST, bleibt ein Befund", () => {
    expect(resolveColor("linear-gradient(red, blue)", E)).toBeNull();
    expect(resolveColor("20px", E)).toBeNull();
    expect(resolveColor("#12345", E)).toBeNull();
  });

  it("`var()` wird TEXTUELL eingesetzt, dann geparst", () => {
    const env = new Map([["--c", "10"], ["--fg", "rgb(var(--c) 20 30)"]]);
    expect(resolveColor("var(--fg)", env)).toEqual({ r: 10, g: 20, b: 30, a: 1 });
  });

  it("der Rückfall greift bei fehlender und bei garantiert ungültiger Bindung", () => {
    expect(resolveColor("var(--fehlt, #ffffff)", E)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    const env = new Map([["--leer", "initial"]]);
    expect(resolveColor("var(--leer, #ffffff)", env)).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("der Rückfall greift NICHT, wenn die Bindung einen gültigen, aber untauglichen Wert hat", () => {
    // Der entscheidende Fall: `--raw: 20px` ist für CSS eine völlig gültige Custom
    // Property. `color: var(--raw, #fff)` wird damit an der Eigenschaft ungültig und
    // ERBT — auf schwarzem Grund also Schwarz auf Schwarz. Der frühere Code nahm bei
    // jedem Parse-Fehlschlag den Rückfall und mass Weiss mit 21:1.
    const env = new Map([["--raw", "20px"]]);
    expect(resolveColor("var(--raw, #ffffff)", env)).toBeNull();
  });

  it("Kommas IM Rückfall bleiben Teil des Rückfalls", () => {
    // Der Rückfall darf eigene Kommas enthalten; ein naives `split(",")` machte
    // daraus drei Argumente und verlor den Wert.
    expect(resolveColor("var(--fehlt, rgb(10, 20, 30))", E)).toEqual({
      r: 10,
      g: 20,
      b: 30,
      a: 1,
    });
  });

  it("eine zyklische Bindung endet als Befund, nicht als Endlosschleife", () => {
    const env = new Map([["--a", "var(--b)"], ["--b", "var(--a)"]]);
    expect(resolveColor("var(--a)", env)).toBeNull();
  });

  it("`calc()` im Alpha wird ausgerechnet, bevor geparst wird", () => {
    // ionics `--vz-tile-bg` steht so im Blatt.
    const env = new Map([["--t", "0.5"]]);
    expect(resolveColor("rgba(35, 40, 48, calc(var(--t) * 0.7))", env)?.a).toBeCloseTo(0.35, 3);
  });
});

describe("die Kaskade entscheidet ein echtes Element, keine Zeichenkette", () => {
  it("`!important` schlägt eine spätere gewöhnliche Deklaration", () => {
    // Vorher gewann schlicht, was später im Quelltext stand: `!important` wurde vom
    // Wert abgeschnitten und danach nie wieder betrachtet.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: ".p" },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      ".p{--bg:#ffffff;--fg:#000000 !important}\n.p{--fg:#fefefe}",
    );
    // Gewinnt `!important` (schwarz), besteht die Messung; gewinnt das spätere
    // Fast-Weiss, reisst sie.
    expect(r.status).toBe("pass");
  });

  it("höhere Spezifität schlägt frühere Quellordnung nicht — aber spätere Quellordnung bei gleicher Spezifität", () => {
    // Der spezifischere Block steht ZUERST und muss trotzdem gewinnen.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: '.p[data-theme="dark"]' },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      '.p[data-theme="dark"]{--fg:#000000}\n.p{--bg:#ffffff;--fg:#fefefe}',
    );
    expect(r.status).toBe("pass");
  });

  it("unlayered schlägt jede `@layer`", () => {
    // CSS Cascade 5 §6.4.4: bei normalen Deklarationen gewinnt unlayered gegen jede
    // Schicht — unabhängig von der Quellordnung.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: ".p" },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      ".p{--bg:#ffffff;--fg:#000000}\n@layer spaet{.p{--fg:#fefefe}}",
    );
    expect(r.status).toBe("pass");
  });

  it("der Universalselektor gilt wie eine Wurzel", () => {
    // `*{--fg:…}` fiel durch die frühere Wurzel-Liste, wenn es nicht am Anfang stand.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: ".p" },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      ".p{--bg:#ffffff}\n*{--fg:#000000}",
    );
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("pass");
  });

  it("ein Block für NACHFAHREN des Themes gilt am Messpunkt nicht", () => {
    // `.p[data-theme="dark"] .foo` deklariert Token auf einem Nachfahren. Am
    // Messpunkt selbst gelten sie nicht — die frühere `includes()`-Regel nahm sie
    // trotzdem, weil der Theme-Selektor im String vorkommt.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: '.p[data-theme="dark"]' },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      '.p[data-theme="dark"]{--bg:#ffffff;--fg:#000000}\n.p[data-theme="dark"] .foo{--fg:#fefefe}',
    );
    expect(r.status).toBe("pass");
  });

  it("ein fremdes Theme wird nicht angeborgt", () => {
    // Fehlt `--fg` im dunklen Block, darf die dunkle Messung ihn NICHT aus dem
    // hellen holen — sonst besteht eine unvollständige Palette.
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: '.p[data-theme="dark"]', light: '.p[data-theme="light"]' },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      '.p[data-theme="dark"]{--bg:#ffffff}\n.p[data-theme="light"]{--bg:#ffffff;--fg:#000000}',
    );
    expect(r.findings.map((f) => f.problem)).toContain("unclassified");
  });

  it("`:is()` im Selektor wird als Selektor gelesen, nicht als Text", () => {
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: ".p" },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      ":is(.q, .p){--bg:#ffffff;--fg:#000000}",
    );
    expect(r.findings).toEqual([]);
    expect(r.combinations).toBeGreaterThan(0);
  });

  it("ein `@media`-Block bleibt aus der Standard-Umgebung heraus", () => {
    const r = measure(
      {
        stylesheet: SHEET,
        themes: { dark: ".p" },
        grounds: [{ token: "--bg" }],
        tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
      },
      ".p{--bg:#ffffff;--fg:#000000}\n@media (forced-colors:active){.p{--fg:#fefefe}}",
    );
    expect(r.status).toBe("pass");
  });
});
