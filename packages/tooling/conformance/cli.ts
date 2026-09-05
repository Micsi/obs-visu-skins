#!/usr/bin/env node
// CLI für den Konformitäts-Generator. Lädt einen Skin über seinen Workspace-Paketnamen
// (dynamischer Import von `tiles` + dem `./manifest.json`-Export) und schreibt support.json
// neben den Skin — oder nach stdout mit `--stdout`. Bei undeklarierter `gap` Exit != 0.
//
// Aufruf (R4 #3 verdrahtet dies später als CI-Gate):
//   obs-visu-conformance <skin-package-name> [--stdout]
//   obs-visu-conformance @obs-visu-skins/ionic
//   obs-visu-conformance @obs-visu-skins/ionic --stdout

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { PageRenderer, SkinManifest } from "@obs/visu-contract";
import { ensureDom, generateSupport, type RendererMap, type SkinInput } from "./index.js";

interface SkinModule {
  readonly tiles: RendererMap;
  /** Optionale Detail-/Preset-Flächen — die Aktions-Achse misst über alle. */
  readonly details?: RendererMap;
  readonly presets?: RendererMap;
  /** Optionaler Ganzseiten-Renderer — die `honors`-Achse misst über ihn. */
  readonly page?: PageRenderer;
}

/**
 * Liest die in `manifest.a11y.stylesheet` deklarierten Dateien. Ein Pfad mit `.`
 * gilt relativ zum Manifest, ein absoluter Pfad gilt wie er dasteht, alles andere
 * wird als Paket-Export aufgelöst — so kann edomi ionics Stylesheet mitmessen,
 * ohne einen Pfad quer durch den Workspace zu raten. Eine unlesbare Datei wird NICHT geworfen: sie fehlt schlicht in `styles`,
 * und die Messung meldet sie als `stylesheet-unreadable` statt den Lauf zu kippen.
 */
function loadStyles(
  manifest: SkinManifest,
  manifestPath: string,
  resolve: (id: string) => string,
): Record<string, string> {
  const declared = manifest.a11y?.stylesheet;
  if (declared === undefined) return {};
  const paths = typeof declared === "string" ? [declared] : [...declared];
  const out: Record<string, string> = {};
  for (const entry of paths) {
    try {
      // Ein ABSOLUTER Pfad wird unverändert genommen. Vorher lief er durch
      // `join(dirname(manifestPath), entry)` und wurde damit hinter das
      // Manifest-Verzeichnis gehängt — die ausdrücklich unterstützte absolute Form
      // war deshalb IMMER `stylesheet-unreadable`, also nie benutzbar.
      const file = isAbsolute(entry)
        ? entry
        : entry.startsWith(".")
          ? join(dirname(manifestPath), entry)
          : resolve(entry);
      readInto(out, entry, file, resolve);
    } catch {
      /* bleibt ungelesen -> a11y meldet `stylesheet-unreadable` */
    }
  }
  return out;
}

/**
 * Liest eine Datei und FOLGT ihren `@import`s — rekursiv, in Kaskadenreihenfolge.
 *
 * Ohne das sah die Messung nur den Einstieg: ein Skin konnte ein paar bestandene
 * Paletten-Token im Einstiegsblatt halten, seine Komponenten-CSS mit kontrastarmen
 * oder gar nicht deklarierten Farben importieren — und `a11y.status: "pass"`
 * bekommen, obwohl der Browser beide Dateien anwendet. `parseRules` kann den Import
 * auch nicht sehen: er hat keinen Regelrumpf.
 *
 * Reihenfolge: CSS wendet einen `@import` VOR den Regeln der importierenden Datei
 * an, deshalb landet die importierte Quelle zuerst in `out`. Ein Import, der sich
 * nicht auflösen lässt, wird als eigener, leerer Eintrag vermerkt — dann meldet die
 * Messung ihn als `stylesheet-unreadable`, statt ihn zu verschweigen.
 */
function readInto(
  out: Record<string, string>,
  key: string,
  file: string,
  resolve: (id: string) => string,
  seen: Set<string> = new Set(),
): void {
  if (seen.has(file)) return; // zyklische Importe: einmal reicht
  seen.add(file);
  const css = readFileSync(file, "utf8");
  // Beide gültigen Formen des Ziels: `"…"`/`'…'` und `url(…)` MIT oder OHNE Quotes.
  // Der frühere Ausdruck verlangte ein Anführungszeichen direkt nach dem `url(` und
  // übersah `@import url(./components.css)` — das importierte Blatt fehlte dann in
  // `styles`, ohne dass ein Befund entstand.
  const IMPORT =
    /@import\s+(?:url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)|"([^"]*)"|'([^']*)')([^;]*)/g;
  for (const m of css.matchAll(IMPORT)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
    if (spec === undefined || spec.length === 0) continue;
    // Alles nach dem Ziel bis zum `;` ist die Bedingung: Layer, `supports()` und die
    // Medienabfrage (`@import "./print.css" print`).
    const condition = (m[6] ?? "").trim();
    const importKey = `${key} → ${spec}${condition.length > 0 ? ` ${condition}` : ""}`;
    try {
      const target = spec.startsWith(".")
        ? join(dirname(file), spec)
        : isAbsolute(spec)
          ? spec
          : resolve(spec);
      const before = new Set(Object.keys(out));
      readInto(out, importKey, target, resolve, seen);
      /**
       * Eine BEDINGUNG am Import gilt für das ganze importierte Blatt, und sie darf
       * nicht verlorengehen: `@import "./print.css" print` wurde als unbedingte
       * Quelle eingelesen, und ein `!important`-Vordergrund aus dem Druck-Blatt
       * konnte einen kontrastschwachen Bildschirm-Vordergrund überschreiben — der
       * Lauf mass dann eine Darstellung, die kein Bildschirm zeigt.
       *
       * Statt die Bedingung durch die ganze Kette zu reichen, wird der Inhalt in
       * genau die At-Regel eingewickelt, die er im Browser bekäme. `parseRules`
       * markiert ihn dann von selbst als `conditional`, und er bleibt aus der
       * Standard-Umgebung heraus.
       */
      if (condition.length > 0 && !/^layer\b/i.test(condition)) {
        for (const k of Object.keys(out)) {
          if (before.has(k) || out[k] === undefined || out[k]!.length === 0) continue;
          out[k] = `@media ${condition} {\n${out[k]}\n}`;
        }
      }
    } catch {
      out[importKey] = ""; // unauflösbar -> `stylesheet-unreadable`
    }
  }
  out[key] = css;
}

async function loadSkin(pkg: string): Promise<{ skin: SkinInput; manifestPath: string }> {
  // VOR dem Skin-Import: der zieht Vue nach, und `@vue/runtime-dom` greift
  // `document` beim Modul-Laden ab. Steht das DOM erst danach, mountet der
  // honors-Probelauf in eine Laufzeit ohne Dokument. Unter vitest ist die
  // Umgebung schon `jsdom`; dieser Aufruf trägt den Fall, dass jemand das CLI
  // direkt fährt.
  await ensureDom();
  const require = createRequire(import.meta.url);
  const mod = (await import(pkg)) as SkinModule;
  const manifestPath = require.resolve(`${pkg}/manifest.json`);
  const manifest = require(manifestPath) as SkinManifest;
  /**
   * Paket-Exporte werden aus Sicht des SKINS aufgelöst, nicht aus Sicht dieser
   * Datei. Unter pnpms isoliertem `node_modules` sieht ein `require` an `cli.ts`
   * nur die eigenen Abhängigkeiten des conformance-Pakets: nennt ein Skin ein
   * Stylesheet aus einer seiner eigenen Abhängigkeiten, kam ein gültiger Export als
   * `stylesheet-unreadable` zurück. Dass edomi ionics Blatt heute findet, liegt nur
   * daran, dass ionic zufällig auch hier als devDependency steht.
   */
  const fromSkin = createRequire(manifestPath);
  return {
    skin: {
      manifest,
      tiles: mod.tiles,
      details: mod.details,
      presets: mod.presets,
      page: mod.page,
      styles: loadStyles(manifest, manifestPath, (id) => fromSkin.resolve(id)),
    },
    manifestPath,
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const args = argv.filter((a) => a !== "--stdout");
  const toStdout = argv.includes("--stdout");
  const pkg = args[0];

  if (!pkg) {
    process.stderr.write("usage: obs-visu-conformance <skin-package-name> [--stdout]\n");
    return 2;
  }

  const { skin, manifestPath } = await loadSkin(pkg);
  const { report, hasGap, honors } = await generateSupport(skin);
  const json = JSON.stringify(report, null, 2);

  if (toStdout) {
    process.stdout.write(`${json}\n`);
  } else {
    const out = join(dirname(manifestPath), "support.json");
    writeFileSync(out, `${json}\n`);
    process.stderr.write(`wrote ${out}\n`);
  }

  if (hasGap) {
    // gap UND broken sind Fehlerstufen (ARCHITECTURE.md §2) — beide werden benannt,
    // und seit Vertrag 1.12 auch die `honors`-Achse (der Deklarations-Slot, auf den
    // sich das Host-Verhalten stützt).
    const a11y = report.a11y;
    const failures = Object.entries(report.widgets)
      .filter(([, e]) => e.level === "gap" || e.level === "broken")
      .map(([t, e]) => `  ${t} [${e.level}]: ${e.reason ?? e.level}`)
      .concat(honors.map((f) => `  honors:${f.token} [${f.problem}]: ${f.detail}`))
      // Die Farb-Achse (Vertrag 1.13): AA ist Pflicht, also ist alles ausser `pass`
      // ein Fehler — und `undeclared` wird ausdruecklich anders benannt als `fail`.
      .concat(
        a11y && a11y.status !== "pass"
          ? [
              `  a11y [${a11y.status}]: ${a11y.violationCount} Paarung(en) unter der Schwelle ` +
                `(${a11y.violationBreakdown.atDefault} bei voller Deckkraft + Werkseinstellung, ` +
                `${a11y.violationBreakdown.atTweakExtreme} nur am Tweak-Extrem, ` +
                `${a11y.violationBreakdown.whenDimmed} nur gedimmt), ` +
                `${a11y.findingCount} Befund(e) an der Deklaration` +
                (a11y.checkedTweakExtremes ? "" : " - Tweak-Extreme NICHT vollstaendig geprueft"),
              ...a11y.violations.map(
                (v) =>
                  `    ${v.theme}/${v.tweaks} ${v.token} @${v.alpha} auf ${v.ground}: ${v.ratio.toFixed(2)}:1 < ${v.threshold} (${v.role})`,
              ),
              ...a11y.findings.map((f) => `    [${f.problem}] ${f.detail}`),
            ]
          : [],
      )
      .join("\n");
    process.stderr.write(`conformance failure in ${report.skin}:\n${failures}\n`);
    return 1;
  }
  // Bestanden — aber eine eingeräumte Lücke in der Deckung darf nicht lautlos
  // durchgehen. Sie steht im Report (`checkedTweakExtremes: false`); hier steht sie
  // zusätzlich im CI-Log, damit sie beim Lesen des grünen Laufs auffällt.
  if (report.a11y && !report.a11y.checkedTweakExtremes) {
    process.stderr.write(
      `conformance note in ${report.skin}: a11y bestanden ueber ${report.a11y.combinations} Paarung(en), ` +
        `aber die Tweak-Deckung ist eingeraeumt unvollstaendig (checkedTweakExtremes: false)\n`,
    );
  }
  return 0;
}

// Nur ausführen, wenn direkt als Skript gestartet (nicht beim Import in Tests).
const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(1);
    });
}

export { main, loadSkin, loadStyles };
