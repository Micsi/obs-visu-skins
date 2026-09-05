// @obs-visu-skins/create-skin — Scaffold-Logik (Dev-Kit für Skin-Autoren).
//
// Erzeugt ein konformitäts-grünes Skin-Skelett unter packages/skins/<name>: ein
// Verzeichnis mit package.json, manifest.json (ALLE Kern-Typen des aktuellen Vertrags
// deklariert, `unsupported` als leere Pflichtangabe), renderers.ts (Platzhalter-Renderer
// je Typ, damit der Konformitäts-Generator keine `gap` meldet), tsconfig.json und einem
// Scaffold-Test.
//
// Vertragsstand: `targetsContract` kommt aus @obs/visu-contract selbst — ein Scaffold
// kann so nicht hinter dem Vertrag zurückbleiben (genau das war bei terminal passiert:
// Manifest auf 1.1 eingefroren). Aktionen bleiben leer, bis der Autor sie wirklich
// markiert: das Scaffold soll nichts behaupten, was seine Platzhalter nicht tun.
//
// Designentscheidung (Onboarding): das frische Skin rendert SOFORT — jede Kachel ist
// ein schlichter Platzhalter (Label · Typ · Zustand). Der Autor ersetzt die Platzhalter
// Stück für Stück. Die `details`-Map bleibt leer (Host-Default).
//
// Reine Funktionen + ein dünner I/O-Wrapper: die Datei-Inhalte und die Root-tsconfig-
// Transformation sind pure (unit-testbar ohne Workspace zu verschmutzen); nur
// `scaffoldSkin` schreibt tatsächlich auf die Platte.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { version as CONTRACT_VERSION, schema as contractSchema } from "@obs/visu-contract";

/**
 * Die stabilen Kern-Typen — **aus dem Vertragsschema abgeleitet**, an dieselbe
 * Quelle gebunden wie `CONTRACT_VERSION`. Sonst laufen beide auseinander: die
 * Version zieht automatisch mit, die getippte Liste nicht, und ein frisches
 * Scaffold behauptete Kompatibilitaet mit einem Vertrag, dessen neuen Typ es
 * weder deklariert noch rendert — der versprochene `gap` bliebe aus, weil auch
 * sein generierter Test dieselbe statische Liste benutzt.
 */
export const CORE_WIDGET_TYPES: readonly string[] = Object.freeze(
  Object.entries(
    (contractSchema as { widgets?: Record<string, { reserved?: boolean }> }).widgets ?? {},
  )
    .filter(([, def]) => def?.reserved !== true)
    .map(([type]) => type),
);

/**
 * Die Akzent-Palette — AUS DEM VERTRAG gelesen, nicht hier hingeschrieben.
 *
 * Das Scaffold bringt sie vollstaendig mit, weil `t.accent(d.accent)` genau diese
 * Schluessel aufloest; ein Skin mit nur einem Akzent-Token faellt in der Fixture-Wand
 * auf den Rueckfall zurueck und zeigt nicht seine eigene Optik.
 *
 * Eine feste Liste hier wuerde vom Vertrag wegdriften: kaeme ein Akzent dazu, riefe
 * ein frisch erzeugter Skin `t.accent(d.accent)` fuer Geraete auf, die ihn benutzen,
 * ohne die zugehoerige `--s-acc-*`-Variable oder eine a11y-Deklaration zu schreiben —
 * und die mitgenerierten Tests wiederholten dieselbe feste Liste, wuerden es also
 * nicht zeigen.
 *
 * Der Vertrag fuehrt das Vokabular (Stand 1.13) nur als Prosa im Beschreibungstext
 * von `widgets.light.data.accent`. Es wird deshalb dort ausgelesen — und wenn dieses
 * Muster eines Tages nicht mehr passt, WIRFT das hier, statt still auf eine veraltete
 * Liste zurueckzufallen.
 */
const ACCENT_TOKENS = accentVocabulary();

function accentVocabulary(): readonly string[] {
  const described = (
    contractSchema as { widgets?: Record<string, { data?: Record<string, unknown> }> }
  ).widgets?.["light"]?.data?.["accent"];
  const list =
    typeof described === "string"
      ? /Palette-Schl(?:ü|ue)ssel:\s*([a-z|]+)/i.exec(described)?.[1]
      : undefined;
  const tokens = list?.split("|").filter((t) => t.length > 0) ?? [];
  if (tokens.length < 2) {
    throw new Error(
      "create-skin: das Akzent-Vokabular liess sich nicht aus dem Vertrag lesen " +
        "(widgets.light.data.accent). Der Vertrag hat sein Format geaendert — " +
        "hier nachziehen, statt eine feste Liste zu benutzen.",
    );
  }
  return tokens;
}

/** Layout-Modell des Scaffolds — `grid` (Default) oder `list`. */
export type LayoutModel = "grid" | "list";

/** Eingaben des Scaffolds. */
export interface ScaffoldOptions {
  /** Skin-Name (Verzeichnis + Manifest-Name), z. B. "bento". */
  readonly name: string;
  /** Layout-Modell, Default "grid". */
  readonly layout?: LayoutModel;
}

/** Eine zu schreibende Datei: relativer Pfad unter packages/skins/<name> + Inhalt. */
export interface ScaffoldFile {
  readonly path: string;
  readonly contents: string;
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Validiert + normalisiert einen Skin-Namen (Workspace-Konvention: kebab-case). */
export function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!NAME_RE.test(name)) {
    throw new Error(
      `invalid skin name "${raw}": use lowercase letters, digits and dashes (must start with a letter)`,
    );
  }
  return name;
}

/* ----------------------------------------------------- file generators ----- */

function packageJson(name: string): string {
  const pkg = {
    name: `@obs-visu-skins/${name}`,
    version: "0.0.0",
    private: true,
    description: `${name}-Skin für obs Visu — Renderer pro Kern-Typ (light · switch · blind · jalousie · sensor · scene) auf dem v1-Kern. Kein State, kein Datenfork. Scaffold-Platzhalter; vom Autor zu verschönern.`,
    type: "module",
    main: "renderers.ts",
    types: "renderers.ts",
    exports: {
      ".": "./renderers.ts",
      "./manifest.json": "./manifest.json",
      // Das Stylesheet ist ein Export, weil `manifest.a11y.stylesheet` darauf zeigt
      // und ein anderer Skin es mitmessen koennen muss (edomi tut das mit ionic.css).
      [`./${name}.css`]: `./${name}.css`,
    },
    scripts: {
      test: "vitest run --typecheck",
    },
    dependencies: {
      "@obs/visu-contract":
        "link:/Volumes/Daten/Projekte/openbridge/openbridgeserver-visu-integrate/packages/contract",
    },
    peerDependencies: {
      vue: "^3.5.0",
    },
    devDependencies: {
      vitest: "^2.1.8",
      vue: "^3.5.0",
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

/**
 * Aktionen eines frischen Scaffolds: KEINE.
 *
 * Die Platzhalter-Kachel zeigt nur an und markiert keine einzige `data-action` — ein
 * Manifest, das trotzdem den vollen kanonischen Satz deklariert, wäre exakt die
 * Pauschal-Behauptung, die dieses Tooling aufdecken soll (Goldene Regel 3). Der
 * Generator misst die Aktions-Achse am gerenderten Baum; ein frisches Skin ist damit
 * ehrlich `display` und wächst auf `partial`/`full`, sobald der Autor Aktionen
 * markiert UND deklariert. Welche Aktionen ein Typ kennt, steht im Vertrag
 * (contract.schema.json §6) und im Authoring-Guide.
 */
function scaffoldActions(): string[] {
  return [];
}

function manifestJson(name: string, layout: LayoutModel): string {
  const widgets: Record<string, { actions: string[] }> = {};
  for (const type of CORE_WIDGET_TYPES) {
    widgets[type] = { actions: scaffoldActions() };
  }

  const layoutBlock =
    layout === "grid"
      ? {
          model: "grid",
          grid: {
            columns: { min: 2, max: 6, default: 3, configurable: true },
            cell: { aspect: "1/1", minPx: 112 },
            gutter: 8,
            flow: "row",
          },
          // Boden (Goldene Regel 5). `role` wird bewusst NICHT beansprucht: das
          // Scaffold bringt keine roleMap mit — deklariere es, sobald du eine hast.
          honors: ["order", "grouping"],
        }
      : {
          model: "list",
          list: {
            row: { minPx: 44 },
            gutter: 0,
            flow: "column",
          },
          honors: ["order", "grouping"],
        };

  const manifest = {
    name,
    targetsContract: CONTRACT_VERSION,
    renderers: "./renderers.ts",
    // Pflichtangabe (Goldene Regel 3) — leer, weil das Scaffold alle Kern-Typen
    // rendert. Leer heißt nicht „vergessen": ein künftiger neuer Kern-Typ fällt so
    // als `gap` auf, statt still abgewählt zu sein.
    unsupported: [],
    widgets,
    layout: layoutBlock,
    // Palette-Deklaration (Vertrag 1.13, Goldene Regel 6). Ohne sie meldet der
    // Konformitaetslauf `a11y: undeclared` und wird rot — AA ist Pflicht, nicht Kuer.
    // Deklariert wird nur die SEMANTIK; die Farbwerte liest der Generator aus der
    // erzeugten <name>.css. Wer die Palette dreht, wird dort gemessen, nicht hier.
    a11y: a11yBlock(name),
    themes: ["light", "dark"],
  };
  return JSON.stringify(manifest, null, 2) + "\n";
}

/**
 * Die Palette-Deklaration des Scaffolds. Sie ist bewusst klein: zwei Gruende
 * (Flaeche + Karte), zwei Themes, keine Deckkraft und keine farbwirksame
 * Tweak-Achse — genau das, was `<name>.css` mitbringt. Waechst der Skin, waechst
 * diese Deklaration mit ihm; eine Farbe im erklaerten Block OHNE Rolle hier ist ein
 * Befund (`unclassified`) und macht den Lauf rot.
 */
function a11yBlock(name: string): Record<string, unknown> {
  const root = `.${name}-root`;
  return {
    stylesheet: `./${name}.css`,
    themes: {
      dark: `${root}[data-theme="dark"]`,
      light: `${root}[data-theme="light"]`,
    },
    grounds: [
      { token: "--s-bg" },
      { token: "--s-surface" },
      // Die Akzente sind zugleich GRUND: --s-accent-ink steht auf ihnen.
      ...ACCENT_TOKENS.map((t) => ({ token: `--s-acc-${t}` })),
    ],
    alphas: [1],
    tokens: {
      "--s-bg": { role: "ground", reason: "Seitenflaeche" },
      "--s-surface": { role: "ground", reason: "Kachelflaeche" },
      "--s-line": {
        role: "ground",
        reason: "Kachelrand — gliedert den Grund, traegt keine Zustandsinformation",
      },
      // `on` steht ausdruecklich da: fehlt es, misst der Generator gegen JEDEN
      // Grund — auch gegen die Akzente, auf denen diese beiden nie stehen. Der
      // strengere Default ist Absicht; einschraenken muss man hinschreiben.
      "--s-fg": { role: "text", on: ["--s-bg", "--s-surface"] },
      "--s-dim": {
        role: "text",
        on: ["--s-bg", "--s-surface"],
        reason: "Typzeile und Nebenangaben — Flieasstext",
      },
      "--s-accent-ink": {
        role: "text",
        reason: "Text AUF einem akzentgefuellten Element; gemessen gegen die Akzente",
        on: ACCENT_TOKENS.map((t) => `--s-acc-${t}`),
      },
      ...Object.fromEntries(
        ACCENT_TOKENS.map((t) => [
          `--s-acc-${t}`,
          {
            role: "graphic",
            reason: "Akzentstreifen der Kachel — Nicht-Text (WCAG 1.4.11)",
            on: ["--s-bg", "--s-surface"],
          },
        ]),
      ),
    },
  };
}

/**
 * Stylesheet des Scaffolds: eine AA-sichere Startpalette in beiden Themes plus die
 * paar Regeln, die die Platzhalter-Kachel sichtbar machen.
 *
 * Die Werte sind nicht geraten — sie sind die des terminal-Skins, dessen Palette
 * gemessen ueber 4.5:1 (Text) bzw. 3:1 (Grafik) liegt. Ein frisches Skin startet
 * damit GRUEN und nicht "noch ungemessen": der Autor faengt bei bestandenem AA an
 * und sieht sofort, wenn seine eigene Farbwahl darunter faellt.
 */
function stylesheetCss(name: string): string {
  const root = `.${name}-root`;
  return `/* @obs-visu-skins/${name} — Skin-Stylesheet (Scaffold).
 *
 * Alles ist unter ${root}[data-theme] gescoped, damit dieses Stylesheet neben
 * anderen Skins im selben Dokument leben kann.
 *
 * AA (Goldene Regel 6): Welcher Token welche Rolle traegt, steht in
 * manifest.json -> a11y.tokens; die WERTE misst der Konformitaetslauf aus GENAU
 * dieser Datei. Drehst du eine Farbe unter 4.5:1 (Text) bzw. 3:1 (Grafik), wird
 * der Lauf rot — probier es aus, bevor du dich darauf verlaesst.
 */

${root} {
  --s-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --s-radius: 10px;
  --s-gap: 8px;

  font-family: var(--s-font);
  background: var(--s-bg);
  color: var(--s-fg);
}

/* Dark ist die Vorgabe: greift auch ohne data-theme. */
${root},
${root}[data-theme="dark"] {
  --s-bg: #0b0e14;
  --s-surface: #151a22;
  --s-line: #222a35;
  --s-fg: #e6edf3;
  --s-dim: #9aa7b4;
  --s-accent-ink: #0b0e14;

  --s-acc-orange: #ffa657;
  --s-acc-teal: #56d4c4;
  --s-acc-violet: #c0a8ff;
  --s-acc-green: #7ee787;
  --s-acc-blue: #79c0ff;
  --s-acc-rose: #ff9fb2;
  --s-acc-amber: #ffd166;
  --s-acc-slate: #a9b4c4;
}

${root}[data-theme="light"] {
  --s-bg: #f6f7f9;
  --s-surface: #ffffff;
  --s-line: #d8dce3;
  --s-fg: #11151b;
  --s-dim: #4c5663;
  --s-accent-ink: #ffffff;

  --s-acc-orange: #9a4b00;
  --s-acc-teal: #00625b;
  --s-acc-violet: #5b3fbf;
  --s-acc-green: #1f6b2e;
  --s-acc-blue: #0b5cad;
  --s-acc-rose: #a32447;
  --s-acc-amber: #7a5300;
  --s-acc-slate: #4a5461;
}

${root} .skin-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--s-line);
  border-left: 3px solid var(--acc, var(--s-acc-slate));
  border-radius: var(--s-radius);
  background: var(--s-surface);
}

${root} .skin-tile__label {
  font-weight: 600;
  color: var(--s-fg);
}

${root} .skin-tile__type,
${root} .skin-tile__state {
  font-size: 12px;
  color: var(--s-dim);
}
`;
}

function renderersTs(name: string): string {
  return `// @obs-visu-skins/${name} — Renderer-Map (CONTRACT-v1.md §3, ARCHITECTURE.md §3/§6).
//
// Golden rules: ein Skin besitzt nie State; je Typ EINE reine Renderer-Funktion,
// adressiert über den Typ-Schlüssel (tiles[type]) — niemals ein switch mit stillem
// Default. Der Renderer gibt Markup zurück und markiert nur data-action; der Host
// übersetzt Gesten auf die kanonischen Aktionen und besitzt allein den State.
//
// SCAFFOLD-PLATZHALTER: Jeder Kern-Typ hat eine schlichte Platzhalter-Kachel
// (Label · Typ · Zustand), damit das frische Skin SOFORT konformitäts-grün ist
// und in der Fixture-Wand sichtbar wird. Ersetze die Platzhalter Stück für Stück
// durch deine echte Optik. Die details-Map bleibt leer → Host-Default-Detail.

import { h, type VNode } from "vue";
import type { Ctx, CoreWidgetType, Device, Renderer, Tokens } from "@obs/visu-contract";

/** Welche Kern-Typen dieses Skin rendert (Spiegel von manifest.json → widgets). */
export type ${pascal(name)}WidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<${pascal(name)}WidgetType, Renderer>>;

/**
 * Platzhalter-Kachel: eine reine \`Renderer\`-Funktion über schreibgeschützte Daten.
 * Zeigt Label, Typ und den zentral aufbereiteten Zustandstext (ctx.stateText) an.
 * Kein State, keine Mutation (Goldene Regeln 1/4). Ersetze pro Typ durch deine Optik.
 */
function placeholderTile(d: Device, t: Tokens, ctx: Ctx): VNode {
  return h(
    "div",
    {
      class: "skin-tile",
      style: { "--acc": t.accent(d.accent), font: t.font },
      "data-type": d.type,
      role: "group",
      "aria-label": d.label,
    },
    [
      h("span", { class: "skin-tile__label" }, ctx.hyphenate(d.label)),
      h("span", { class: "skin-tile__type" }, d.type),
      h("span", { class: "skin-tile__state" }, ctx.stateText(d)),
    ],
  );
}

/**
 * Kachel-Renderer je Kern-Typ. Vollständig für alle neun Kern-Typen
 * (light · switch · blind · jalousie · sensor · scene · media · camera · climate),
 * adressiert über den
 * Typ-Schlüssel (tiles[type]); spiegelt manifest.json → widgets, damit der
 * Konformitäts-Generator keine \`gap\` meldet.
 */
export const tiles: RendererMap = {
  light: placeholderTile,
  switch: placeholderTile,
  blind: placeholderTile,
  jalousie: placeholderTile,
  sensor: placeholderTile,
  scene: placeholderTile,
  media: placeholderTile,
  camera: placeholderTile,
  climate: placeholderTile,
};

/**
 * Detail-Flächen-Renderer je Kern-Typ. Leer im Scaffold: der Host reicht ein
 * generisches Default-Detail nach (ARCHITECTURE.md §6). Fülle gezielt, wo dein
 * Skin eine eigene Detailfläche braucht.
 */
export const details: RendererMap = {};
`;
}

function tsconfigJson(): string {
  return (
    JSON.stringify(
      {
        extends: "../../../tsconfig.base.json",
        compilerOptions: {
          composite: true,
          rootDir: ".",
          outDir: "dist",
          noEmit: false,
          types: ["node"],
        },
        include: ["renderers.ts", "src/**/*.ts", "manifest.json", "tests/**/*.ts"],
      },
      null,
      2,
    ) + "\n"
  );
}

function scaffoldSpecTs(name: string, layout: LayoutModel): string {
  return `// Scaffold-Test: belegt, dass das frische ${name}-Skin auflöst (Manifest + Vertrag
// + getypte Renderer-Maps) und konformitäts-grün ist. Ersetze/erweitere beim
// Verschönern der Renderer durch echte Form-/Verhaltens-Tests (vgl. ionic/terminal).

import { describe, expect, it } from "vitest";
import { version as contractVersion, type SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { details, tiles } from "../renderers.js";

const CORE_TYPES = [
  "blind",
  "camera",
  "climate",
  "jalousie",
  "light",
  "media",
  "scene",
  "sensor",
  "switch",
];

describe("${name} skin scaffold", () => {
  it("declares a contract-shaped manifest with a ${layout} layout and all core types", () => {
    const m = manifest as unknown as SkinManifest;
    expect(m.name).toBe("${name}");
    // Das Scaffold zielt auf den aktuellen Vertrag — nie auf eine eingefrorene Zahl.
    expect(m.targetsContract).toBe(contractVersion);
    expect(m.layout.model).toBe("${layout}");
    // \`unsupported\` ist Pflichtangabe (golden rule 3) — hier leer, weil alle
    // Kern-Typen gerendert werden. Ein neuer Vertrags-Typ fällt so als gap auf.
    expect(m.unsupported).toEqual([]);
    expect(Object.keys(m.widgets).sort()).toEqual([...CORE_TYPES].sort());
  });

  it("wires a tile renderer for every declared core type (no conformance gap)", () => {
    for (const type of CORE_TYPES) {
      expect(tiles[type as keyof typeof tiles]).toBeTypeOf("function");
    }
    // details darf leer bleiben (Host-Default).
    expect(details).toBeTypeOf("object");
  });

  it("declares its palette, so AA is measured and not merely hoped for", () => {
    // Vertrag 1.13 / Goldene Regel 6: ohne diesen Block meldet der Konformitaetslauf
    // \`a11y: undeclared\` — ausdruecklich NICHT dasselbe wie bestanden.
    const a11y = (manifest as unknown as SkinManifest).a11y;
    expect(a11y, "manifest.a11y").toBeDefined();
    expect(a11y!.stylesheet).toBe("./${name}.css");
    // Jede Farbe der erklaerten Bloecke braucht eine Rolle; fehlt eine, ist das im
    // Lauf ein Befund (\`unclassified\`) und kein stilles Ueberspringen.
    // Jede Farbe der erklaerten Bloecke ist gefuehrt: die acht Akzente, die drei
    // Gruende/Linien, die zwei Textfarben und die Ink auf dem Akzent.
    expect(Object.keys(a11y!.tokens).sort()).toEqual([
      "--s-acc-amber",
      "--s-acc-blue",
      "--s-acc-green",
      "--s-acc-orange",
      "--s-acc-rose",
      "--s-acc-slate",
      "--s-acc-teal",
      "--s-acc-violet",
      "--s-accent-ink",
      "--s-bg",
      "--s-dim",
      "--s-fg",
      "--s-line",
      "--s-surface",
    ]);
    expect(Object.keys(a11y!.themes).sort()).toEqual(["dark", "light"]);
  });
});
`;
}

/** PascalCase aus einem kebab-case-Namen (für den Typ-Alias im renderers.ts). */
function pascal(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/* --------------------------------------------- pure file-set generation ---- */

/** Berechnet die zu schreibenden Dateien für ein Skin — reine Funktion, kein I/O. */
export function scaffoldFiles(options: ScaffoldOptions): ScaffoldFile[] {
  const name = normalizeName(options.name);
  const layout: LayoutModel = options.layout ?? "grid";
  return [
    { path: "package.json", contents: packageJson(name) },
    { path: "manifest.json", contents: manifestJson(name, layout) },
    { path: "renderers.ts", contents: renderersTs(name) },
    { path: `${name}.css`, contents: stylesheetCss(name) },
    { path: "tsconfig.json", contents: tsconfigJson() },
    { path: "tests/scaffold.spec.ts", contents: scaffoldSpecTs(name, layout) },
  ];
}

/* ------------------------------- root tsconfig references maintenance ------ */

const REF_BLOCK_RE = /"references"\s*:\s*\[([\s\S]*?)\]/;
const REF_PATH_RE = /"path"\s*:\s*"([^"]+)"/g;

/**
 * Fügt den Skin-Pfad idempotent + sortiert in die `references` einer Root-tsconfig
 * (als String) ein und gibt den neuen String zurück. Reine Transformation — kein I/O,
 * damit Tests die echte Root-Datei nicht verschmutzen. Ist der Pfad bereits enthalten,
 * bleibt der String unverändert.
 *
 * @param tsconfig Inhalt der Root-tsconfig.json
 * @param skinName Skin-Name; eingefügt wird `./packages/skins/<name>`
 */
export function addSkinReference(tsconfig: string, skinName: string): string {
  const name = normalizeName(skinName);
  const newPath = `./packages/skins/${name}`;

  const block = REF_BLOCK_RE.exec(tsconfig);
  if (!block) {
    throw new Error('root tsconfig has no "references" array to maintain');
  }

  const inner = block[1] ?? "";
  const paths = new Set<string>();
  let m: RegExpExecArray | null;
  REF_PATH_RE.lastIndex = 0;
  while ((m = REF_PATH_RE.exec(inner)) !== null) {
    if (m[1] !== undefined) paths.add(m[1]);
  }

  if (paths.has(newPath)) {
    return tsconfig; // idempotent: nichts zu tun
  }
  paths.add(newPath);

  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  const rendered = sorted.map((p) => `    { "path": "${p}" }`).join(",\n");
  const replacement = `"references": [\n${rendered}\n  ]`;

  return tsconfig.replace(REF_BLOCK_RE, replacement);
}

/* ----------------------------------------------------------- I/O wrapper --- */

/** Ergebnis von {@link scaffoldSkin}: wohin geschrieben wurde. */
export interface ScaffoldResult {
  readonly name: string;
  readonly skinDir: string;
  readonly files: readonly string[];
}

/**
 * Schreibt das Skin-Skelett nach `<skinsRoot>/<name>` und pflegt — sofern ein
 * `rootTsconfigPath` übergeben wird — die Root-tsconfig.references. Bricht ab, wenn
 * das Zielverzeichnis bereits existiert (kein versehentliches Überschreiben).
 *
 * @param options   Skin-Name + Layout
 * @param skinsRoot Wurzel für Skin-Pakete (i. d. R. <repo>/packages/skins)
 * @param rootTsconfigPath optional: Pfad der Root-tsconfig.json, die gepflegt wird
 */
export function scaffoldSkin(
  options: ScaffoldOptions,
  skinsRoot: string,
  rootTsconfigPath?: string,
): ScaffoldResult {
  const name = normalizeName(options.name);
  const skinDir = join(skinsRoot, name);

  if (existsSync(skinDir)) {
    throw new Error(`target already exists: ${skinDir}`);
  }

  const files = scaffoldFiles({ name, layout: options.layout });
  for (const file of files) {
    const dest = join(skinDir, file.path);
    mkdirSync(join(dest, ".."), { recursive: true });
    writeFileSync(dest, file.contents);
  }

  if (rootTsconfigPath !== undefined) {
    const current = readFileSync(rootTsconfigPath, "utf8");
    const next = addSkinReference(current, name);
    if (next !== current) writeFileSync(rootTsconfigPath, next);
  }

  return {
    name,
    skinDir,
    files: files.map((f) => f.path),
  };
}
