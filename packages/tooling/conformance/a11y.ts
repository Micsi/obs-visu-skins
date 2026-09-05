// Die Farb-Achse des Konformitäts-Generators (Goldene Regel 6, Vertrag 1.13).
//
// Render- und Aktions-Achse misst `index.ts` am erzeugten Markup. Farbe steht dort
// nicht: ein Renderer liefert Klassennamen, keine Pixel. Diese Datei schliesst die
// Lücke — sie liest das ECHTE Stylesheet des Skins und rechnet WCAG 2.1 darauf.
//
// Die Arbeitsteilung ist die ganze Idee der Vertrags-Fläche `manifest.a11y`:
//
//   • Der Skin DEKLARIERT die Semantik: welcher Token färbt Text, welcher Grafik,
//     welcher ist nur Grund, welcher ist bewusst ausgenommen (mit Begründung);
//     auf welchen Gründen ein Vordergrund real steht; welche Deckkräfte er auflegt;
//     welche Tweaks Farbe bewegen.
//   • Der Generator MISST die Werte: er löst die Token aus der CSS-Datei auf,
//     mischt durchscheinende Gründe zu dem Pixel zusammen, das real auf dem Schirm
//     steht, und rechnet das Verhältnis.
//
// Warum nicht einfach die Verhältnisse deklarieren lassen? Weil eine deklarierte
// Zahl beim nächsten Farbdreher stillschweigend falsch wird. Deklariert wird nur,
// was ein Mensch entscheidet (Rolle, Grund, Ausnahme) — gerechnet wird der Rest.
//
// ══ Was hier NICHT gemessen wird (ausdrücklich, damit es niemand für geprüft hält)
//
//  1. Ob ein Token wirklich dort steht, wo `on` behauptet. Die Zuordnung
//     Vordergrund-zu-Grund ist eine Deklaration. Nur ein echter Browser-Render
//     könnte sie beweisen; hier wird sie geglaubt — aber sie steht sichtbar im
//     Report, ist also kritisierbar. Fehlt `on`, gilt die STRENGERE Lesart
//     (gegen alle Gründe): einschränken muss man hinschreiben.
//  2. Deckkraft aus Regeln statt aus Token. `alphas` ist eine Deklaration. Ein
//     Skin, dessen Stylesheet klein genug für einen vollständigen `opacity`-Scan
//     ist, prüft das zusätzlich in seiner eigenen Spec (terminal tut das) — der
//     Vertrag verlangt es nicht, weil ein grosses Stylesheet dutzende rein
//     dekorativer Deckkräfte trägt und ein Pflicht-Scan dort nur Rauschen ergäbe.
//  3. Schriftgrösse. WCAG erlaubt "grossem Text" 3:1. Hier gilt für JEDEN
//     Text-Token 4.5:1 — die strengere Schwelle, ohne Ausnahme.
//  4. Gradient und Schatten. Sie sind keine flache Farbe. Ein Token, der eine
//     Farbe ENTHÄLT, ohne eine zu SEIN, muss deshalb `exempt` mit Begründung
//     sein — er verschwindet nicht lautlos aus der Messung.
//
// ══ Was den Skin daran hindert, sich grün zu deklarieren
//
// Jeder Weg AUS der Messung heraus muss eine begründete Aussage sein, nie ein
// Weglassen (Goldene Regel 3). Vier Riegel, jeder für einen Ausweg, den ein
// früherer Entwurf offen liess:
//
//  1. **Farbe weglassen.** JEDE Farb-Deklaration in JEDEM Block der deklarierten
//     Stylesheets muss in `tokens` stehen — nicht nur in `base` und den
//     Theme-Blöcken. Ein Skin, der seine unbequeme Farbe in einen dritten Block
//     schreibt (ionic tut das mit den `--ion-*`-Brückenvariablen), fiele sonst
//     lautlos aus der Prüfung.
//  2. **Grund weglassen.** Ein Token als `ground` zu deklarieren und dann NICHT in
//     `grounds` zu führen nahm es spurlos aus der Messung. Das braucht jetzt eine
//     Begründung und steht als `unmeasuredGrounds` im Report.
//  3. **Theme weglassen.** `exemptThemes` verlangt eine nicht-leere Begründung,
//     genau wie `exempt` bei einem Token.
//  4. **Tweak weglassen.** Jeder Tweak aus `manifest.tweaks` muss eingeordnet sein:
//     messbare Achse, farbneutral (mit Grund) oder farbwirksam-aber-nicht-erfassbar
//     (mit Grund, und dann ist `checkedTweakExtremes` FALSE). Ohne diesen Abgleich
//     behauptete der Report, die Extreme geprüft zu haben, während ein unbenannter
//     Tweak die Farbe verschiebt — eine ungedeckte positive Aussage.

import { JSDOM } from "jsdom";
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import selectorParser from "postcss-selector-parser";
import { selectorSpecificity as specificity } from "@csstools/selector-specificity";
import { converter as culoriConverter, parse as culoriParse } from "culori";
import {
  schema as contractSchema,
  type A11yGround,
  type A11yMeasurement,
  type A11yFinding,
  type SkinManifest,
  type SkinTweak,
  type SupportA11y,
} from "@obs/visu-contract";

/* ------------------------------------------------------- Vertrags-Schwellen */

interface SchemaA11y {
  readonly thresholds?: { readonly text?: number; readonly graphic?: number };
  readonly roles?: readonly string[];
}
const SCHEMA_A11Y = ((contractSchema as { a11y?: SchemaA11y }).a11y ?? {}) as SchemaA11y;

/**
 * Die WCAG-Schwellen kommen AUS dem Vertrag, nicht aus einem Literal hier —
 * dieselbe Regel wie bei `canonicalActions` und `LAYOUT_HONORS`. Der Fallback ist
 * bewusst der WCAG-Normwert, damit ein Vertrag ohne `a11y`-Block (bis 1.12) nicht
 * still auf 0 prüft und damit gar nichts mehr messen würde.
 */
export const THRESHOLDS = Object.freeze({
  text: SCHEMA_A11Y.thresholds?.text ?? 4.5,
  graphic: SCHEMA_A11Y.thresholds?.graphic ?? 3,
});

/** Das anerkannte Rollen-Vokabular — ebenfalls aus dem Vertrag. */
export const A11Y_ROLES: readonly string[] = Object.freeze([
  ...((SCHEMA_A11Y.roles ?? ["text", "graphic", "ground", "exempt"]) as string[]),
]);

/* ------------------------------------------------------------- CSS-Parsing */

/** Ein Regelblock: die (kommagetrennten) Selektoren plus der rohe Rumpf. */
interface Rule {
  readonly selectors: readonly string[];
  /** Die Deklarationen des Blocks, in Quelltextreihenfolge, mit `!important`. */
  readonly decls: readonly Decl[];
  /**
   * Steht der Block in einer At-Bedingung (`@media`/`@supports`/`@container`)?
   * Solche Blöcke bleiben aus der Standard-Umgebung heraus: sie gelten nur unter
   * ihrer Bedingung, und sie als immer aktiv zu behandeln liesse eine
   * kontrastschwache Standard-Darstellung mit einem Wert bestehen, den nur der
   * Sonderfall zeigt.
   */
  readonly conditional: boolean;
  /**
   * WOMIT der Block ausserhalb der gemessenen Standard-Umgebung steht — leer, wenn
   * er drin ist. Der Name wandert in den Befund, damit der Autor weiss, wo zu
   * suchen ist: `@media (…)`, `@keyframes puls`, `@scope (.preview)`.
   */
  readonly outside: string;
  /**
   * Die `@layer`, in der der Block steht — leer für unlayered. Die Kaskade wertet
   * Schichten VOR Spezifität, und unlayered gewinnt gegen jede Schicht.
   */
  readonly layer: string;
}

/** Eine einzelne Deklaration, so wie postcss sie sieht. */
export interface Decl {
  readonly prop: string;
  readonly value: string;
  readonly important: boolean;
}

/**
 * Die Regeln eines Stylesheets — geparst von **postcss**, nicht von Hand.
 *
 * ══ Warum eine Bibliothek und kein Regex mehr
 *
 * Der frühere Eigenbau las das Blatt mit `matchAll(/([^{}]+)\{([^{}]*)\}/g)` plus
 * einer Kommentar-Entfernung davor, und jede Review-Runde fand die nächste CSS-Regel,
 * die er anders sah als ein Browser: ein `/* … *\/` in einer Zeichenkette, eine
 * geschweifte Klammer in `content: "}"`, ein `;` in einem Data-URI, ein Komma in
 * `:is(a, b)`, die erste Regel nach einem `@import`. Das ist eine unbegrenzte
 * Fehlerfläche — die Menge der CSS-Regeln ist gross und wächst.
 *
 * postcss BENUTZT die Grammatik, statt sie nachzubilden: Kommentare, Zeichenketten,
 * Klammerungen, at-Regeln und `!important` sind dort eigene Knoten. Was hier bleibt,
 * ist nur noch die Frage, die diese Fläche wirklich stellt: welcher Block gilt unter
 * welcher Bedingung, in welcher Schicht.
 *
 * ══ Was weiterhin markiert statt übernommen wird
 *
 * Ein Block in einer At-BEDINGUNG (`@media`, `@supports`, `@container`) gilt nur unter
 * ihr. Als immer aktiv behandelt liesse er eine kontrastschwache Standard-Darstellung
 * mit einem Wert bestehen, den nur der Sonderfall zeigt — deshalb `conditional: true`
 * und aus der Standard-Umgebung heraus.
 *
 * Ein Block in einer `@layer` trägt seine Schicht mit (`layer`), weil die Kaskade
 * Schichten VOR Spezifität wertet: eine Deklaration in einer späteren Schicht schlägt
 * eine spezifischere aus einer früheren. Ohne Schicht ist `layer` leer — unlayered
 * gewinnt gegen jede Schicht (CSS Cascade 5 §6.4.4).
 */
export function parseRules(css: string): Rule[] {
  const out: Rule[] = [];
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: undefined });
  } catch {
    return out; // unlesbares Blatt -> die Messung meldet es als `stylesheet-unreadable`
  }
  const walk = (container: postcss.Container, outside: string, layer: string): void => {
    for (const node of container.nodes ?? []) {
      if (node.type === "rule") {
        // `list.comma` splittet klammer- UND zeichenkettenbewusst: `:is(a, b)` bleibt
        // ein Selektor, `[title="a,b"]` auch.
        const selectors = postcss.list
          .comma(node.selector)
          .map((sel) => sel.trim())
          .filter((sel) => sel.length > 0);
        if (selectors.length === 0) continue;
        out.push({
          selectors,
          decls: declarationsOf(node),
          conditional: outside.length > 0,
          outside,
          layer,
        });
        // Verschachtelte Regeln (CSS Nesting) sind eigene Blöcke.
        walk(node, outside, layer);
      } else if (node.type === "atrule") {
        const name = node.name.toLowerCase();
        const head = `@${node.name}${node.params ? ` ${node.params.trim()}` : ""}`;
        if (name === "layer") {
          // `@layer a, b;` ordnet nur an und hat keinen Rumpf.
          const inner = node.params.trim();
          walk(node, outside, layer.length > 0 ? `${layer}.${inner}` : inner);
        } else if (name === "media" || name === "supports" || name === "container") {
          walk(node, head, layer);
        } else if (/keyframes$/.test(name) || name === "scope" || name === "starting-style") {
          // Alle drei stehen ausserhalb der Standard-Umgebung, aber aus verschiedenen
          // Gründen: ein Keyframe-Stopp gilt nur während der Animation, ein `@scope`
          // nur innerhalb seiner Wurzel, `@starting-style` nur im ersten Bild. Ein
          // Block, der dort einen klassifizierten Token verschiebt, wird deshalb
          // gemeldet statt stillschweigend übernommen — oder stillschweigend
          // ignoriert, was er vorher wurde.
          walk(node, head, layer);
        } else if (node.nodes) {
          walk(node, outside, layer);
        }
      }
    }
  };
  walk(root, "", "");
  return out;
}

/** Die Deklarationen EINES postcss-Blocks, in Quelltextreihenfolge. */
function declarationsOf(rule: postcss.Container): Decl[] {
  const out: Decl[] = [];
  for (const node of rule.nodes ?? []) {
    if (node.type !== "decl") continue;
    const value = node.value.trim();
    if (value.length === 0) continue;
    out.push({ prop: node.prop.trim(), value, important: node.important === true });
  }
  return out;
}

/**
 * Alle `--name: wert`-Paare eines Rumpfes, in Quelltextreihenfolge.
 *
 * Über **postcss** statt über einen Regex auf den Rohtext, und das behebt drei
 * Fehlurteile auf einmal:
 *
 *  - **Zeichenketten** zählten mit. `content: "--brand: #fff"` — oder dieselbe
 *    Folge in einem Data-URI — galt als echte Deklaration, und der
 *    Vollständigkeits-Scan meldete den Phantom-Token als `unclassified`.
 *  - **`!important`** blieb am Wert kleben und liess `resolveColor` scheitern.
 *  - **Nicht-ASCII-Namen** fielen weg: `\w` kennt nur ASCII, `--zustand-grün`
 *    wurde also weder in die Umgebung aufgenommen noch klassifiziert — während
 *    gewöhnliches CSS ihn über `var()` sehr wohl verbraucht.
 */
export function declarations(body: string): [string, string][] {
  return declsOfBody(body)
    .filter((d) => d.prop.startsWith("--") && d.prop.length >= 3)
    .map((d) => [d.prop, d.value] as [string, string]);
}

/** Der Rumpf eines Blocks, geparst — postcss braucht dafür eine Hülle. */
function declsOfBody(body: string): Decl[] {
  const rules = parseRules(`x{${body}}`);
  return rules.length > 0 ? [...rules[0]!.decls] : [];
}

/**
 * Alle Custom-Property-Deklarationen JEDES Blocks, dessen Selektorliste `selector`
 * enthält — über alle Stylesheets, in Quelltextreihenfolge. Mehrere Blöcke werden
 * gemischt (der spätere gewinnt), genau wie die Kaskade es täte.
 */
export function tokensFor(sources: readonly string[], selector: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      // Bedingte Blöcke bleiben draussen: sie gelten nur unter ihrer Bedingung.
      // Der Vollständigkeits-Scan sieht sie weiterhin — sonst wäre `@media` das
      // neue Versteck für unklassifizierte Farbe.
      if (rule.conditional) continue;
      if (!rule.selectors.includes(selector)) continue;
      for (const d of rule.decls) {
        if (d.prop.startsWith("--") && d.prop.length >= 3) out.set(d.prop, d.value);
      }
    }
  }
  return out;
}

/**
 * JEDE Custom-Property-Deklaration ALLER Blöcke, mit dem Selektor, in dem sie steht.
 * Grundlage von Riegel 1: die Vollständigkeit wird über das ganze Blatt geprüft, nicht
 * nur über die erklärten Blöcke — sonst wäre ein dritter Block das Versteck.
 */
export function allDeclarations(sources: readonly string[]): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      for (const d of rule.decls) {
        if (!d.prop.startsWith("--") || d.prop.length < 3) continue;
        out.push([rule.selectors.join(", "), d.prop, d.value]);
      }
    }
  }
  return out;
}

/**
 * Der MESSPUNKT eines Themes: ein echtes Element, auf dem die Token gelten.
 *
 * ══ Warum überhaupt ein Element
 *
 * Die Frage „gilt dieser Block in diesem Theme" wurde vorher über Zeichenketten
 * beantwortet — `sel.includes(own)`, `own.startsWith(sel)`, eine Wurzel-Liste. Jede
 * Review-Runde fand die nächste Selektor-Form, die das anders sah als ein Browser:
 * der Universalselektor, `:is()`, ein Nachfahren-Block, der die Vorfahren-Kette
 * betrifft, die Frage, in welchem Geltungsbereich ein Alias überhaupt deklariert ist.
 *
 * Mit einem Element ist die Frage keine Zeichenkettenfrage mehr: `element.matches()`
 * kommt von jsdom und bringt die vollständige Selektor-Semantik mit. Was hier von
 * Hand bleibt, ist nur noch die Synthese des Elements aus dem deklarierten
 * Theme-Selektor — ein klar begrenztes Stück, das der Skin selbst vorgibt.
 *
 * Gebaut wird die Kette `html > body > <element>`, weil Custom Properties ERBEN:
 * ein Block auf `:root` oder `html` gilt am Messpunkt genauso wie einer auf dem
 * Element selbst.
 */
function synthesizeContext(selector: string, doc: Document): Element | null {
  let parsed: selectorParser.Selector | undefined;
  try {
    selectorParser((root) => {
      parsed = root.nodes[0];
    }).processSync(selector);
  } catch {
    return null;
  }
  if (parsed === undefined) return null;

  // In COMPOUNDS zerlegen, getrennt durch Kombinatoren. Vorher wurde nur das letzte
  // Compound gebaut und direkt an `body` gehängt: ein gültiger Nachfahren-Selektor
  // wie `.shell .p[data-theme="dark"]` traf sein eigenes Element dann nie, und die
  // Messung zertifizierte die `:root`-Palette, während das echte Element unter
  // `.shell` eine andere bekommt.
  const groups: { nodes: selectorParser.Node[]; combinator: string }[] = [];
  let current: selectorParser.Node[] = [];
  let pendingCombinator = " ";
  for (const node of parsed.nodes) {
    if (node.type === "combinator") {
      groups.push({ nodes: current, combinator: pendingCombinator });
      pendingCombinator = node.value.trim().length === 0 ? " " : node.value.trim();
      current = [];
      continue;
    }
    current.push(node);
  }
  groups.push({ nodes: current, combinator: pendingCombinator });
  if (groups.length === 0 || groups[groups.length - 1]!.nodes.length === 0) return null;

  let parent: Element = doc.body;
  let built: Element | null = null;
  for (const [index, group] of groups.entries()) {
    const el = elementFor(group.nodes, doc);
    if (el === null) {
      // `:root` im Compound: das IST das Wurzelelement, es lässt sich nicht als Kind
      // bauen. Alles ANDERE im selben Compound gilt trotzdem und wird auf das
      // Wurzelelement gelegt — `:root[data-theme="dark"]` ist ein gewöhnlicher
      // Theme-Selektor, und ihn auf ein nacktes `documentElement` abzubilden hiess,
      // die generische `:root`-Palette zu messen statt der themenspezifischen.
      if (group.nodes.some((n) => n.type === "pseudo" && a11yRootPseudo(n.value))) {
        const root = doc.documentElement;
        applyCompound(
          group.nodes.filter((n) => !(n.type === "pseudo" && a11yRootPseudo(n.value))),
          root,
        );
        if (index === groups.length - 1) return root;
        parent = root;
        continue;
      }
      return null; // nicht darstellbar — wird als Befund gemeldet
    }
    if (index > 0 && (group.combinator === "+" || group.combinator === "~")) {
      // Geschwister: neben den zuletzt gebauten Knoten, nicht hinein.
      (built?.parentElement ?? parent).appendChild(el);
    } else {
      parent.appendChild(el);
      parent = el;
    }
    built = el;
  }
  return built;
}

/** Ein Element aus EINEM Compound (Tag, Klassen, ID, Attribute). */
function elementFor(nodes: readonly selectorParser.Node[], doc: Document): Element | null {
  let tag = "div";
  for (const node of nodes) {
    if (node.type === "tag") tag = node.value;
    else if (node.type === "pseudo" && a11yRootPseudo(node.value)) {
      return null; // vom Aufrufer behandelt: `:root` ist ein bestehendes Element
    }
  }
  const el = doc.createElement(tag === "*" ? "div" : tag);
  applyCompound(nodes, el);
  return el;
}

/** Legt Klassen, ID und Attribute eines Compounds auf ein bestehendes Element. */
function applyCompound(nodes: readonly selectorParser.Node[], el: Element): void {
  for (const node of nodes) {
    if (node.type === "class") el.classList.add(node.value);
    else if (node.type === "id") el.id = node.value;
    else if (node.type === "attribute") {
      const a = node as selectorParser.Attribute;
      el.setAttribute(a.attribute, a.value ?? "");
    }
  }
}

function a11yRootPseudo(value: string): boolean {
  return value === ":root";
}

/**
 * Der Rang einer Deklaration in der Kaskade — je grösser, desto später gewinnt sie.
 *
 * CSS wertet in dieser Reihenfolge (Cascade 5 §6.4): Wichtigkeit, dann Schicht, dann
 * Spezifität, dann Quellordnung. Vorher wertete diese Fläche NICHTS davon: sie faltete
 * drei Karten in fester Reihenfolge übereinander (Theme-Boden, `base`, Theme-Token),
 * und was innerhalb einer Karte später im Quelltext stand, gewann — unabhängig davon,
 * wie spezifisch es war, ob es `!important` trug oder in welcher `@layer` es stand.
 *
 * Zur Schicht: bei NORMALEN Deklarationen gewinnt unlayered gegen jede Schicht, und
 * unter den Schichten die zuletzt deklarierte. Bei `!important` kehrt sich beides um.
 * Mehr als diese Umkehr braucht die Fläche nicht — Schichten kommen in Skin-Blättern
 * bisher nicht verschachtelt vor, und der Fall wird gemeldet, wenn doch.
 */
interface Ranked {
  readonly name: string;
  readonly value: string;
  readonly rank: readonly number[];
}

function compareRank(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Die Token-Umgebung EINES Messpunkts: jede Deklaration jedes Blocks, der auf den
 * Messpunkt oder einen seiner Vorfahren passt, nach echter Kaskade gefaltet.
 */
function cascadeEnv(
  sources: readonly string[],
  element: Element,
  layerOrder: readonly string[],
): Map<string, string> {
  // JE ELEMENT eine eigene Kaskade, dann die Vererbung von aussen nach innen.
  //
  // Das ist kein Detail: CSS kaskadiert PRO ELEMENT, und ein geerbter Wert nimmt an
  // der Kaskade des Kindes gar nicht teil. Wer beides zusammen ranked, lässt
  // `!important` und Spezifität über Elementgrenzen hinweg wirken, wo sie es nicht
  // tun — `:root { --fg: #000 !important }` gegen `.p { --fg: #777 }` misst dann
  // Schwarz, während der Browser am `.p`-Element das gewöhnliche `#777` malt.
  const chain: Element[] = [];
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    chain.unshift(node);
  }
  const out = new Map<string, string>();
  for (const node of chain) {
    for (const [name, value] of winningOn(sources, node, layerOrder)) out.set(name, value);
  }
  return out;
}

/** Die Deklarationen, die die Kaskade AUF DIESEM EINEN Element gewinnen lässt. */
function winningOn(
  sources: readonly string[],
  element: Element,
  layerOrder: readonly string[],
): Map<string, string> {
  const ranked = new Map<string, Ranked>();
  let order = 0;
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      // Bedingte Blöcke bleiben draussen: sie gelten nur unter ihrer Bedingung, und
      // sie als immer aktiv zu behandeln liesse eine kontrastschwache Darstellung
      // mit einem Wert bestehen, den nur der Sonderfall zeigt.
      if (rule.conditional) continue;
      const hit = matchesHere(rule.selectors, element);
      if (hit === null) continue;
      for (const d of rule.decls) {
        order += 1;
        if (!d.prop.startsWith("--") || d.prop.length < 3) continue;
        const layerIndex = layerOrder.indexOf(rule.layer);
        const rank = d.important
          ? [1, -layerIndex, hit[0], hit[1], hit[2], order]
          : [0, layerIndex, hit[0], hit[1], hit[2], order];
        const prev = ranked.get(d.prop);
        if (prev === undefined || compareRank(rank, prev.rank) > 0) {
          ranked.set(d.prop, { name: d.prop, value: d.value, rank });
        }
      }
    }
  }
  const out = new Map<string, string>();
  for (const [name, r] of ranked) out.set(name, r.value);
  return out;
}

/**
 * Die höchste Spezifität, mit der einer der Selektoren dieses Blocks GENAU DIESES
 * Element trifft — oder `null`, wenn keiner es trifft. Vorfahren zählen hier nicht:
 * sie führen ihre eigene Kaskade, und was von dort kommt, kommt über Vererbung
 * ({@link cascadeEnv}).
 */
function matchesHere(
  selectors: readonly string[],
  element: Element,
): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  for (const sel of selectors) {
    try {
      if (!element.matches(sel)) continue;
    } catch {
      // Ein Selektor, den die Laufzeit nicht kennt (neue Pseudoklasse), gilt als
      // nicht passend — raten wäre hier gefährlicher als übersehen.
      continue;
    }
    const s = specificity(selectorParser().astSync(sel));
    const here: [number, number, number] = [s.a, s.b, s.c];
    if (best === null || compareRank(here, best) > 0) best = here;
  }
  return best;
}

/** Trifft einer der Selektoren das Element ODER einen seiner Vorfahren? */
function matchesChain(selectors: readonly string[], element: Element): boolean {
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    if (matchesHere(selectors, node) !== null) return true;
  }
  return false;
}

/**
 * Die Schichtreihenfolge des Blattes, in Deklarationsreihenfolge. Unlayered steht
 * als leerer Name IMMER hinten — bei normalen Deklarationen gewinnt es damit gegen
 * jede Schicht, so wie CSS es vorsieht.
 */
function layerOrderOf(sources: readonly string[]): string[] {
  const seen: string[] = [];
  /**
   * ZUERST die ausdrücklichen Ordnungsanweisungen — `@layer overrides, base;` legt
   * die Reihenfolge fest, BEVOR irgendein Block auftaucht, und sie hat Vorrang vor
   * der Reihenfolge des ersten Vorkommens.
   *
   * Ohne das wurde die Ordnung aus den Blöcken abgeleitet: mit `@layer base { … }`
   * gefolgt von `@layer overrides { … }` galt hier `overrides` als später, während
   * der Browser der Anweisung folgt und `base` gewinnen lässt. Der Lauf mass dann
   * den falschen der beiden Werte.
   */
  for (const css of sources) {
    let root: postcss.Root;
    try {
      root = postcss.parse(css, { from: undefined });
    } catch {
      continue;
    }
    root.walkAtRules(/^layer$/i, (at) => {
      if (at.nodes !== undefined) return; // ein Block, keine Anweisung
      for (const name of postcss.list.comma(at.params)) {
        const trimmed = name.trim();
        if (trimmed.length > 0 && !seen.includes(trimmed)) seen.push(trimmed);
      }
    });
  }
  // Danach jede Schicht, die nur über einen Block bekannt wird.
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      if (rule.layer.length > 0 && !seen.includes(rule.layer)) seen.push(rule.layer);
    }
  }
  seen.push(""); // unlayered gewinnt bei normalen Deklarationen gegen jede Schicht
  return seen;
}

/**
 * Alle GEWÖHNLICHEN Deklarationen eines Rumpfes (`color: #fff`) — alles, was KEINE
 * Custom Property ist. Der Gegenpart zu {@link declarations}, und der Grund, warum
 * es ihn braucht: der Vollständigkeits-Scan erkannte ausschliesslich `--name` und
 * sah `outline: 2px solid #d6a800` oder `color: #fff` deshalb NIE — weder
 * klassifiziert noch gemessen. Ein Skin konnte damit `a11y.status: "pass"`
 * bekommen und trotzdem unzugängliche Vordergründe ausliefern.
 *
 * Getrennt am obersten Klammer-Level, damit ein `;` in `url(…)` oder in einer
 * `rgba(…)`-Liste nicht mitten in einem Wert schneidet.
 */
export function plainDeclarations(body: string): [string, string][] {
  return declsOfBody(body)
    .filter((d) => !d.prop.startsWith("--") && /^[a-z-]+$/i.test(d.prop))
    .map((d) => [d.prop, d.value] as [string, string]);
}

/** Wie {@link allDeclarations}, aber für die gewöhnlichen Deklarationen. */
export function allPlainDeclarations(sources: readonly string[]): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      for (const d of rule.decls) {
        if (d.prop.startsWith("--") || !/^[a-z-]+$/i.test(d.prop)) continue;
        out.push([rule.selectors.join(", "), d.prop, d.value]);
      }
    }
  }
  return out;
}

/**
 * Trägt irgendein Block des Blattes Token an einen Messpunkt heran, der diesem
 * Selektor entspricht?
 *
 * Die Frage klingt nach „steht der Selektor im Blatt", und genau so wurde sie
 * beantwortet: wörtlicher Vergleich der Selektorliste. Damit war ein Theme, dessen
 * Blöcke über `:is(.q, .p)` oder eine andere gleichwertige Schreibweise greifen,
 * fälschlich `selector-missing` — und ein Skin bekam einen Befund für etwas, das im
 * Browser einwandfrei funktioniert. Gefragt wird deshalb dasselbe wie überall sonst:
 * greift am Messpunkt etwas.
 */
export function hasSelector(sources: readonly string[], selector: string): boolean {
  const doc = new JSDOM("<!doctype html><html><body></body></html>").window.document;
  const point = synthesizeContext(selector, doc);
  if (point === null) return false;
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      if (rule.decls.length === 0) continue;
      if (matchesChain(rule.selectors, point)) return true;
    }
  }
  return false;
}

/* ---------------------------------------------------------- Farb-Auflösung */

/** Eine aufgelöste Farbe. `a` unter 1 heisst durchscheinend — sie braucht einen Grund. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Sieht der Wert nach Farbe aus? Bewusst weit: alles, was hier anschlägt, MUSS
 * auflösbar sein — sonst ist es ein Befund und kein stilles Überspringen.
 * `var(` ist dabei, weil ein Alias (`--vz-accent: var(--vz-acc-orange)`) sonst
 * unklassifiziert durchrutschte.
 */
export const COLOR_SHAPED =
  /^(#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\(|color-mix\(|light-dark\(|var\(|transparent\b|currentcolor\b)/i;

/**
 * Enthält der Wert eine Farbe, OHNE eine flache Farbe zu sein? Gradienten und
 * Schatten. Sie sind nicht wie ein Pixel messbar und müssen deshalb ausdrücklich
 * `exempt` sein — Goldene Regel 3, statt lautlos aus der Messung zu fallen.
 */
/**
 * Trägt dieser Wert eine Farbe DIREKT, also an den Token vorbei?
 *
 * Bewusst breit: der Scan entscheidet, ob eine gewöhnliche Deklaration überhaupt
 * betrachtet wird. Fehlt hier eine Syntax, fällt sie stillschweigend aus der
 * Messung — `color: red` und `background: oklch(…)` sind genauso an der Palette
 * vorbei wie ein Hexwert. Die benannten Farben stehen als Wortgrenze, damit
 * `border` (enthält „red") nicht anschlägt.
 */
/**
 * Die Eigenschaften, an denen CSS eine Farbe erwartet — der Ort, an dem gesucht wird.
 *
 * Eine Liste statt einer Werte-Heuristik, weil die Menge dieser Eigenschaften endlich
 * und bekannt ist, die Menge der Werte aber nicht: `red` ist an `color` eine Farbe und
 * an `animation` ein Bezeichner (`@keyframes red`), und kein Blick auf den Wert allein
 * kann die beiden auseinanderhalten.
 *
 * Die Grenze der Liste ist zugleich die Grenze des Scans: eine Farbe an einer hier
 * nicht genannten Eigenschaft bliebe ungesehen. Deshalb stehen auch die Kurzformen
 * (`border`, `outline`, `background`) und die Zeichen-Eigenschaften (`fill`, `stroke`)
 * drin, nicht nur die `-color`-Langformen.
 */
const COLOR_PROPERTIES = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-block",
  "border-block-color",
  "border-block-start",
  "border-block-start-color",
  "border-block-end",
  "border-block-end-color",
  "border-inline",
  "border-inline-color",
  "border-inline-start",
  "border-inline-start-color",
  "border-inline-end",
  "border-inline-end-color",
  "border-image",
  "border-image-source",
  "outline",
  "outline-color",
  "text-decoration",
  "text-decoration-color",
  "text-emphasis-color",
  "text-shadow",
  "box-shadow",
  "caret-color",
  "accent-color",
  "column-rule",
  "column-rule-color",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
  "scrollbar-color",
  "mask",
  "mask-image",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "-webkit-text-stroke",
]);

/**
 * Die Teilmenge, an der Farbe TEXT sichtbar macht. Nur dort ist `transparent` ein
 * Befund (unsichtbarer Text); an einem Hintergrund ist Farblosigkeit normal.
 */
const TEXT_COLOR_PROPERTIES = new Set([
  "color",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "-webkit-text-stroke",
]);

function colorProperty(prop: string): boolean {
  return COLOR_PROPERTIES.has(prop.toLowerCase());
}

/**
 * Die `var()`-Namen in diesem Wert, auf die sich die Deklaration WIRKLICH verlässt —
 * also die ohne Rückfall.
 *
 * Ein Verweis mit Rückfall ist gedeckt: `var(--acc-bar, var(--acc))` heisst "der Host
 * darf überschreiben, sonst gilt `--acc`", und was gemessen werden muss, ist `--acc`.
 * Genau dieses Muster steht in ionic, edomi und terminal, und es als Lücke zu melden
 * wäre falsch. Ohne Rückfall ist der Verweis dagegen im Browser ungültig, sobald der
 * Name fehlt — `color: var(--inkx)` ERBT dann, auf schwarzem Grund also Schwarz auf
 * Schwarz, während eine unbeteiligte, bestandene Palette den Lauf grün hält.
 *
 * (Dass ein Host-Override selbst ungemessen bleibt, ist eine eigene Frage und steht
 * als eigener Befund — sie gehört nicht hierher.)
 */
function varNamesIn(value: string): string[] {
  const names: string[] = [];
  let parsed;
  try {
    parsed = valueParser(value);
  } catch {
    return names;
  }
  parsed.walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "var") return undefined;
    const first = node.nodes[0];
    const divider = node.nodes.findIndex((n) => n.type === "div" && n.value === ",");
    if (divider < 0 && first?.type === "word" && first.value.startsWith("--")) {
      names.push(first.value);
    }
    return undefined; // in den Rückfall absteigen: dort gilt dieselbe Regel
  });
  return names;
}

/**
 * Trägt dieser Wert IRGENDWO eine Farbe?
 *
 * Die Frage ist eine andere als „ist das eine Farbe" ({@link resolveColor}): hier
 * geht es um Werte wie `2px solid #d6a800` oder `linear-gradient(…)`, die Farbe
 * enthalten, ohne selbst eine flache Farbe zu sein. Sie sind ein BEFUND — nicht
 * zwingend falsch, aber nicht messbar, und stilles Überspringen wäre wieder der
 * Ausweg, den diese Fläche sonst überall zumauert.
 *
 * Über den Wert-Parser statt über einen Regex auf dem Rohtext, und das behebt zwei
 * Fehlurteile: die frühere Wortliste schlug in JEDEM Vorkommen an, also auch im
 * NAMEN einer Variablen (`var(--red-thing)`, `--tomato-border`) — und sie war eine
 * Liste, blieb also zwangsläufig hinter der Menge der benannten Farben zurück.
 * Hier entscheidet culori, was ein Farbwort ist, und der Name einer Variablen wird
 * gar nicht erst angesehen.
 */
export function bearsColor(value: string): boolean {
  let found = false;
  let parsed;
  try {
    parsed = valueParser(value);
  } catch {
    return false;
  }
  parsed.walk((node) => {
    if (found) return false;
    if (node.type === "function") {
      const fn = node.value.toLowerCase();
      if (COLOR_FUNCTIONS.has(fn)) {
        found = true;
        return false;
      }
      if (fn === "var") {
        // Nur der RÜCKFALL trägt möglicherweise Farbe; der Name nie.
        const divider = node.nodes.findIndex((n) => n.type === "div" && n.value === ",");
        if (divider >= 0 && bearsColor(valueParser.stringify(node.nodes.slice(divider + 1)))) {
          found = true;
        }
        return false;
      }
      if (fn === "url") return false; // `url(#gradient)` ist kein Farbwert
      return undefined; // in gewöhnliche Funktionen absteigen (z. B. `linear-gradient`)
    }
    if (node.type === "string") return false; // `content: "#1"` ist Text
    if (node.type === "word") {
      const w = node.value;
      if (w.startsWith("--")) return false;
      if (/^currentcolor$/i.test(w)) {
        found = true;
        return false;
      }
      // `transparent` ist eine gültige Farbe, aber keine sichtbare: `background:
      // transparent` umgeht keine Palette und darf kein Befund sein.
      if (/^transparent$/i.test(w)) return false;
      if (isCssColorWord(w)) found = true;
    }
    return undefined;
  });
  return found;
}

/**
 * Ein einzelnes Wort, das für CSS eine Farbe IST: `#…` oder ein benannter Ton.
 *
 * Der Umweg über die Form ist nötig, weil culori kulanter ist als CSS und eine
 * Hexfolge auch OHNE Raute annimmt — `font-weight: 600` käme sonst als dunkles Rot
 * zurück und jede Gewichtsangabe im Blatt wäre ein Phantom-Befund.
 */
function isCssColorWord(word: string): boolean {
  if (!word.startsWith("#") && !/^[a-z]+$/i.test(word)) return false;
  return culoriParse(word) !== undefined;
}

const COLOR_FUNCTIONS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
]);

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Löst eine Zahl auf: nackt, `var(--x)` oder ein einstufiges `calc(A * B)`.
 * Mehr braucht kein Alpha-Ausdruck in einem Skin-Stylesheet — und mehr zu raten
 * wäre gefährlicher als der Befund `unresolvable`.
 */
export function resolveNumber(value: string, env: Map<string, string>, depth = 0): number | null {
  if (depth > 16) return null;
  const v = value.trim();

  const percent = /^([0-9.]+)%$/.exec(v);
  if (percent) return Number(percent[1]) / 100;
  if (/^[+-]?[0-9]*\.?[0-9]+$/.test(v)) return Number(v);

  const variable = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(v);
  if (variable) {
    const bound = env.get(variable[1]!);
    if (bound !== undefined) return resolveNumber(bound, env, depth + 1);
    return variable[2] !== undefined ? resolveNumber(variable[2], env, depth + 1) : null;
  }

  const calc = /^calc\(([\s\S]*)\)$/.exec(v);
  if (calc) {
    const parts = splitTop(calc[1]!, "*");
    if (parts.length < 2) return null;
    let product = 1;
    for (const part of parts) {
      const n = resolveNumber(part, env, depth + 1);
      if (n === null) return null;
      product *= n;
    }
    return product;
  }
  return null;
}

/** Zerlegt an `sep`, aber nur auf oberster Klammerebene. */
function splitTop(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    // Zeichenketten sind für die Struktur BLIND: was zwischen Anführungszeichen
    // steht, ist Inhalt. Ohne diesen Zweig zählte `content: "a;b(c"` Trenner und
    // Klammern mit und zerlegte die Deklaration an der falschen Stelle.
    if (quote) {
      current += ch;
      if (ch === "\\") {
        // Maskiertes Zeichen komplett übernehmen, damit `"\""` die Kette nicht schliesst.
        const next = input[i + 1];
        if (next !== undefined) {
          current += next;
          i += 1;
        }
      } else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

// `!important` trennt postcss selbst vom Wert ab (`Declaration.important`) — die
// Handarbeit dafür ist entfallen. Was der Marker in der KASKADE bedeutet, steht bei
// `cascadeValue`: er entscheidet, welche Deklaration gewinnt, nicht welchen Wert sie hat.

/**
 * Löst einen CSS-Farbwert zu {@link Rgba} auf — in denselben zwei Schritten, in
 * denen ein Browser es tut.
 *
 * ══ Schritt 1: SUBSTITUTION
 *
 * `var()` wird TEXTUELL ersetzt, bevor überhaupt jemand weiss, ob ein Farbwert
 * herauskommt. Der Rückfall greift genau dann, wenn die Bindung fehlt oder
 * *garantiert ungültig* ist (leer, `initial`) — NICHT, wenn sie einen Wert hat, der
 * an der verbrauchenden Eigenschaft nichts taugt. Der frühere Code nahm den Rückfall
 * bei jedem Parse-Fehlschlag, und das war messbar falsch: `--raw: 20px;
 * --fg: var(--raw, #fff)` ist für CSS eine gültige Custom Property, `color` wird
 * damit ungültig und ERBT — auf schwarzem Grund also Schwarz auf Schwarz, während
 * hier Weiss mit 21:1 gemessen wurde und der Skin `pass` bekam.
 *
 * ══ Schritt 2: PARSEN, von **culori**
 *
 * Erst der substituierte Text wird als Farbe gelesen, und dafür steht eine
 * Bibliothek statt eines Regex: `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`, `rgb()`/`rgba()`
 * in Komma-, Leerzeichen- und Slash-Syntax, Prozent- und Bruchkanäle, `hsl()`,
 * `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()` und die benannten
 * Farben. Jede dieser Formen war einmal ein eigener Review-Befund am Eigenbau
 * (fehlende Syntaxen, kaputte Prozentkanäle, verschluckte Nachkommastellen,
 * Tabulator statt Leerzeichen, fehlendes Clamping des Alphas).
 *
 * Was culori nicht kann, macht Schritt 1 vorher: `calc()` wird über
 * {@link resolveNumber} zu einer Zahl ausgerechnet — ionics `--vz-tile-bg` steht als
 * `rgba(35, 40, 48, calc(var(--vz-tile-alpha) * 0.7))` im Blatt.
 *
 * `null` heisst weiterhin: BEFUND, kein stilles Überspringen.
 */
export function resolveColor(value: string, env: Map<string, string>, depth = 0): Rgba | null {
  const substituted = substituteVars(value, env, depth);
  if (substituted === null) return null;
  return parseColor(substituted);
}

/** Ist diese Bindung *garantiert ungültig* — der einzige Fall, der den Rückfall zieht? */
function guaranteedInvalid(bound: string | undefined): boolean {
  if (bound === undefined) return true;
  const t = bound.trim();
  return t.length === 0 || /^initial$/i.test(t);
}

/**
 * Ersetzt jedes `var()` durch seinen Text, rekursiv. Liefert `null` bei einem Zyklus
 * oder wenn eine Bindung fehlt UND kein Rückfall dasteht — dann hat der Browser
 * nichts zu berechnen, und wir haben nichts zu messen.
 */
function substituteVars(value: string, env: Map<string, string>, depth = 0): string | null {
  if (depth > 16) return null;
  const parsed = valueParser(value);
  let failed = false;

  parsed.walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "var") return undefined;
    // `var(--name, rest…)`: der erste Knoten ist der Name, alles nach dem ersten
    // Trenner ist der Rückfall — samt eigener Kommas, die dort erlaubt sind.
    const nodes = node.nodes;
    const name = nodes[0]?.type === "word" ? nodes[0].value : "";
    if (!name.startsWith("--")) {
      failed = true;
      return false;
    }
    const divider = nodes.findIndex((n) => n.type === "div" && n.value === ",");
    const fallback = divider >= 0 ? valueParser.stringify(nodes.slice(divider + 1)).trim() : undefined;
    const bound = env.get(name);
    const chosen = guaranteedInvalid(bound) ? fallback : bound;
    if (chosen === undefined) {
      failed = true;
      return false;
    }
    const inner = substituteVars(chosen, env, depth + 1);
    if (inner === null) {
      failed = true;
      return false;
    }
    // Den Funktionsknoten durch den eingesetzten Text ersetzen.
    const replacement = valueParser(inner).nodes;
    Object.assign(node, {
      type: "word",
      value: valueParser.stringify(replacement),
      nodes: undefined,
    });
    return false; // nicht in den ersetzten Text absteigen
  });

  if (failed) return null;
  return resolveCalcs(parsed.toString(), env, depth);
}

/**
 * Rechnet `calc()`-Ausdrücke zu Zahlen aus, damit der Farb-Parser einen Wert sieht.
 * Bleibt bewusst auf das beschränkt, was eine Palette braucht (Produkte von Zahlen
 * und Prozenten); alles andere bleibt stehen und scheitert dann sichtbar am Parsen.
 */
function resolveCalcs(text: string, env: Map<string, string>, depth: number): string {
  if (!/calc\(/i.test(text)) return text;
  const parsed = valueParser(text);
  parsed.walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "calc") return undefined;
    const n = resolveNumber(valueParser.stringify(node), env, depth + 1);
    if (n === null) return false;
    Object.assign(node, { type: "word", value: String(n), nodes: undefined });
    return false;
  });
  return parsed.toString();
}

const toRgb = culoriConverter("rgb");

/** Der reine Farb-Parser: substituierter Text rein, {@link Rgba} raus. */
function parseColor(text: string): Rgba | null {
  const t = text.trim();
  if (t.length === 0) return null;
  // Derselbe Riegel wie in `isCssColorWord`: ohne ihn wäre `--fg: 600` ein gültiger
  // Farbwert, weil culori Hex auch ohne Raute annimmt. CSS tut das nicht.
  if (/^[0-9a-f]+$/i.test(t) && !t.startsWith("#")) return null;
  const parsed = culoriParse(t);
  if (parsed === undefined) return null;
  const rgb = toRgb(parsed);
  if (rgb === undefined) return null;
  // Ausserhalb von sRGB (weite `oklch`-Werte) wird geklemmt: WCAG rechnet auf sRGB,
  // und ein Kanal jenseits der Grenze ist auf dem Schirm auch nicht darstellbar.
  const to255 = (c: number): number => clamp255(Math.round(c * 255));
  const alpha = rgb.alpha ?? 1;
  return {
    r: to255(rgb.r),
    g: to255(rgb.g),
    b: to255(rgb.b),
    // CSS klemmt Alpha auf 0…1; ohne das rechnete `composite` mit einem Wert, den
    // der Browser nie anwendet.
    a: Math.min(1, Math.max(0, alpha)),
  };
}

/* --------------------------------------------------------------- WCAG 2.1 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative Leuchtdichte einer DECKENDEN Farbe (WCAG 2.1). */
export function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG-2.1-Kontrastverhältnis zweier deckender Farben. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Vordergrund über Grund gemischt — das reale Pixel. `alpha` skaliert zusätzlich. */
/**
 * DECKEND heisst alpha 1 — nicht "fast 1".
 *
 * Vorher galt alles ab 0.999 als deckend. `rgb(255 255 255 / 99.9%)` ohne erklärten
 * Unterbau rutschte damit durch beide Riegel: gerechnet wurde gegen reines Weiss,
 * während der Browser weiter mit einem unbekannten Ton darunter mischt — nah an der
 * Schwelle wird daraus ein `pass`, das nichts belegt.
 *
 * Die Toleranz hier ist deshalb kein Spielraum für Deklarationen, sondern nur für
 * Gleitkomma-Reste: `composite` mit deckendem Grund rechnet `a + 1 * (1 - a)`, und
 * das trifft die 1 nicht immer exakt.
 */
function isOpaque(alpha: number): boolean {
  return alpha >= 1 - 1e-9;
}

/**
 * Vordergrund über Grund, mit zusätzlicher Deckkraft auf dem Vordergrund.
 *
 * ══ Was `alpha` hier BEDEUTET, und was nicht
 *
 * Es ist **Vordergrund-Alpha**: die Farbe des Vordergrunds wird durchsichtiger, der
 * Grund darunter bleibt, wie er ist. Genau so wirkt eine `opacity` auf einem
 * Element, dessen Grund AUSSERHALB der gedämpften Gruppe liegt — etwa
 * `.vz-tile.locked .vz-tile-body { opacity: 0.7 }`, wo die Kachelfläche an
 * `.vz-tile` hängt und nicht mitgedämpft wird.
 *
 * Es ist NICHT die Gruppen-Opazität, bei der ein Element seinen eigenen Grund
 * mitbringt: dort dämpft der Browser das FERTIGE Element gegen den Vorfahren, und
 * beide Seiten des Verhältnisses bewegen sich. Weisser Text auf schwarzem Bedienteil
 * über weissem Vorfahren steht bei 50 % real bei ~3.98:1; diese Rechnung käme auf
 * ~5.28:1 und würde einen unzugänglichen Zustand bescheinigen.
 *
 * Die Fläche modelliert diesen zweiten Fall NICHT (obs-visu-skins#47). Ein Skin darf
 * deshalb nur solche Dämpfungen als `alphas` deklarieren, deren Grund ausserhalb der
 * Gruppe liegt — und dass das stimmt, prüft die Ratsche
 * `packages/skins/ionic/tests/dimming.spec.ts` am echten gerenderten Baum, weil
 * dieser Messpfad es aus eigener Kraft nicht sehen kann.
 */
export function composite(fg: Rgba, bg: Rgba, alpha = 1): Rgba {
  const a = fg.a * alpha;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: a + bg.a * (1 - a),
  };
}

function hex(c: Rgba): string {
  return `#${[c.r, c.g, c.b].map((n) => clamp255(n).toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------ Tweak-Stopps */

/** Eine angefahrene Tweak-Stellung: ein Name plus die gesetzten CSS-Variablen. */
interface TweakStop {
  readonly label: string;
  readonly overrides: ReadonlyMap<string, string>;
}

/**
 * Die WERKSEINSTELLUNGEN unter den Stopps — die Zustände, die ein Benutzer sieht,
 * ohne einen Regler angefasst zu haben. Das sind zwei: der Blatt-Rückfall (gar kein
 * Override) und die Stellung, die der Host aus `manifest.tweaks[*].default` setzt.
 *
 * Die Unterscheidung zählt für `violationBreakdown`: ein Verstoss an der echten
 * Startstellung wurde als `atTweakExtreme` ausgewiesen — als beträfe er nur den
 * Regler-Anschlag —, während der Blatt-Rückfall als `atDefault` galt, obwohl der Host
 * ihn beim Start gar nicht zeigt. Wer die Zahl zitiert (die Anleitung sagt: zitiere
 * `atDefault`), zitierte damit die falsche.
 */
function factoryLabels(
  axisValues: readonly { readonly axis: { readonly tweak: string }; readonly values: readonly string[] }[],
  tweaks: Readonly<Record<string, SkinTweak>>,
): Set<string> {
  const labels = new Set<string>(["default"]);
  const parts: string[] = [];
  for (const { axis } of axisValues) {
    const value = tweaks[axis.tweak]?.default;
    if (value === undefined || value === null) return labels; // keine volle Startstellung
    parts.push(`${axis.tweak}=${String(value)}`);
  }
  if (parts.length > 0) labels.add(parts.join(" "));
  return labels;
}

/**
 * Die Extreme einer Tweak-Achse: bei `slider` `min` und `max`, bei `select` jede
 * Option. Der Default wird NICHT mitgezählt — er ist der eigene Stopp `default`.
 */
function extremesOf(tweak: SkinTweak): string[] {
  if (tweak.type === "slider") {
    const values: string[] = [];
    if (typeof tweak.min === "number") values.push(String(tweak.min));
    if (typeof tweak.max === "number") values.push(String(tweak.max));
    return values;
  }
  return [...(tweak.options ?? [])];
}

/* ---------------------------------------------------------------- Messung */

/** Eingabe der Farb-Achse: die Deklaration plus die GELESENEN Stylesheet-Quellen. */
export interface A11yInput {
  readonly manifest: SkinManifest;
  /**
   * Quelltext je deklariertem Stylesheet-Eintrag. Das Lesen macht der Aufrufer
   * (CLI/Test) — diese Messung bleibt rein, damit sie ohne Dateisystem testbar ist
   * und ein fehlendes Stylesheet ein BEFUND wird statt einer Ausnahme.
   */
  readonly styles?: Readonly<Record<string, string>>;
  /**
   * INLINE-Deklarationen aus den gerenderten Bäumen (`prop: value`), eingesammelt vom
   * Render-Durchgang. Sie stehen in keinem Blatt und wären sonst unsichtbar: ein
   * Renderer mit `style: { color: "#777" }` über einer hellen Fläche konnte eine
   * unbeteiligte, bestandene Palette deklarieren und trotzdem `pass` bekommen.
   */
  readonly inlineStyles?: readonly string[];
}

const UNDECLARED: SupportA11y = {
  status: "undeclared",
  aa: false,
  checkedTweakExtremes: false,
  thresholds: THRESHOLDS,
  themes: [],
  tweakStops: [],
  combinations: 0,
  worst: {},
  violationCount: 0,
  violationBreakdown: { atDefault: 0, atTweakExtreme: 0, whenDimmed: 0 },
  violations: [],
  findingCount: 1,
  findings: [
    {
      problem: "undeclared",
      detail:
        "manifest.a11y fehlt — die Palette ist nicht deklariert, AA ist damit UNGEMESSEN, nicht bestanden (Goldene Regeln 3 + 6)",
    },
  ],
};

/**
 * Misst die Farb-Achse eines Skins und liefert den `a11y`-Block für support.json.
 *
 * Fehlt `manifest.a11y`, ist das Ergebnis `undeclared` — ausdrücklich NICHT `pass`
 * und ausdrücklich nicht dasselbe wie ein Skin, der deklariert und besteht.
 */
export function measureA11y(input: A11yInput): SupportA11y {
  const decl = input.manifest.a11y;
  if (!decl) return UNDECLARED;

  const findings: A11yFinding[] = [];
  const sheets = typeof decl.stylesheet === "string" ? [decl.stylesheet] : [...decl.stylesheet];
  const sources: string[] = [];
  for (const path of sheets) {
    /**
     * Die gemessenen Quellen sind das deklarierte Blatt UND alles, was es per
     * `@import` hereinholt — der Lader legt sie unter Schlüsseln wie
     * `./entry.css → ./components.css` ab, und zwar bereits in Kaskadenreihenfolge
     * (das Importierte VOR dem Importierenden, wie CSS es anwendet).
     *
     * Ohne diese Zeilen wäre der Lader wirkungslos gewesen: die Schleife las nur die
     * Schlüssel, die wörtlich im Manifest stehen, und ein Einstiegsblatt mit
     * bestandener Palette hätte Komponenten-CSS mit unklassifizierten oder
     * kontrastschwachen Farben importieren können, während das Gate `pass` meldet.
     */
    const own = Object.entries(input.styles ?? {}).filter(
      ([key]) => key === path || key.startsWith(`${path} → `),
    );
    if (own.length === 0) {
      findings.push({
        problem: "stylesheet-unreadable",
        detail: `${path} wurde nicht geladen — ohne Quelltext ist die Palette nicht messbar`,
      });
      continue;
    }
    for (const [key, src] of own) {
      if (src.length === 0 && key !== path) {
        findings.push({
          problem: "stylesheet-unreadable",
          detail: `${key} liess sich nicht auflösen — der Browser wendet es an, gemessen ist es nicht`,
        });
        continue;
      }
      sources.push(src);
    }
  }

  const exemptThemes = decl.exemptThemes ?? {};
  const measuredThemes = Object.entries(decl.themes).filter(([name]) => !(name in exemptThemes));

  // Riegel 3: ein ganzes Theme auszunehmen ist die grösste Auslassung überhaupt —
  // sie braucht dieselbe Begründungspflicht wie ein einzelner Token. Ohne diese
  // Prüfung hätte `exemptThemes: { light: "" }` den halben Farbraum stillgelegt.
  for (const [theme, reason] of Object.entries(exemptThemes)) {
    if (!reason || reason.trim().length === 0) {
      findings.push({
        problem: "exempt-without-reason",
        detail: `Theme ${theme} ist ausgenommen, ohne Begründung — das ist ein Vergessen, keine Aussage`,
      });
    }
    // Ein ausgenommenes Theme braucht KEINEN Selektor — genau das ist der Sinn der
    // Ausnahme, und der Authoring-Guide nennt `a11y.themes` oder `exemptThemes`
    // ausdrücklich als Alternative. Gemeldet wird nur ein Eintrag, den weder die
    // Deklaration noch das Manifest kennt: ein Phantom, das nichts stilllegt.
    if (!(theme in decl.themes) && !(input.manifest.themes ?? []).includes(theme)) {
      findings.push({
        problem: "selector-missing",
        detail: `exemptThemes nennt ${theme} — weder in a11y.themes noch in manifest.themes`,
      });
    }
  }

  // Riegel 5: die a11y-Themes gegen die ECHTEN Themes des Manifests. Ohne diesen
  // Abgleich war "ein Theme gar nicht erst nennen" der stillste Ausweg von allen:
  // ein Skin, der `light` und `dark` anbietet, aber nur `dark` deklariert, liess
  // die halbe Palette ungemessen — und der Report konnte `pass` sein. Ein Theme
  // wegzulassen muss dieselbe begründete Aussage sein wie es auszunehmen.
  for (const theme of input.manifest.themes ?? []) {
    if (theme in decl.themes || theme in exemptThemes) continue;
    findings.push({
      problem: "selector-missing",
      detail: `manifest.themes bietet ${theme} an, a11y.themes kennt es nicht — diese Palette ist ungemessen. Nenne ihren Selektor oder nimm sie mit Begründung in exemptThemes auf.`,
    });
  }

  for (const selector of [
    ...(decl.base ? [decl.base] : []),
    ...measuredThemes.map(([, sel]) => sel),
  ]) {
    if (sources.length > 0 && !hasSelector(sources, selector)) {
      findings.push({
        problem: "selector-missing",
        detail: `${selector} steht in keinem der deklarierten Stylesheets`,
      });
    }
  }

  // Riegel 6: die ROLLE selbst prüfen. Manifeste kommen per Typ-Zusicherung aus
  // JSON, ohne Schema-Validierung — ein Tippfehler (`"role": "tetx"`) fiel damit
  // durch JEDE Schleife hier (weder exempt noch ground noch text/graphic), während
  // der Vollständigkeits-Scan den Token als klassifiziert ansah, weil sein Name in
  // `tokens` steht. Lieferte irgendein anderer Token eine Messung, konnte der
  // Report `pass` sein: der Token war unsichtbar, nicht ausgenommen.
  for (const [token, entry] of Object.entries(decl.tokens)) {
    const role = (entry as { role?: unknown }).role;
    if (typeof role === "string" && A11Y_ROLES.includes(role)) continue;
    findings.push({
      problem: "unclassified",
      detail: `${token} trägt die Rolle ${JSON.stringify(role)}, die es im Vertrags-Vokabular nicht gibt (${A11Y_ROLES.join(" · ")}) — der Token ist damit weder gemessen noch ausgenommen`,
    });
  }

  // Ausnahmen ohne Begründung: eine Auslassung MUSS eine Aussage sein (Regel 3).
  const exemptTokens: Record<string, string> = {};
  for (const [token, entry] of Object.entries(decl.tokens)) {
    if (entry.role !== "exempt") continue;
    if (!entry.reason || entry.reason.trim().length === 0) {
      findings.push({
        problem: "exempt-without-reason",
        detail: `${token} ist exempt ohne reason — eine Ausnahme ohne Begründung ist ein Vergessen`,
      });
    } else exemptTokens[token] = entry.reason;
  }

  const groundNames = new Set(decl.grounds.map((g) => g.token));

  // Riegel 2: `role: "ground"` heisst "wird nicht als Vordergrund gemessen". Steht der
  // Token dann auch in keinem `grounds`-Eintrag, ist er ÜBERHAUPT nicht gemessen — der
  // stillste aller Auswege. Er ist erlaubt (eine Trennlinie ist wirklich kein
  // Vordergrund), aber nur als begründete Aussage, und er steht im Report.
  const unmeasuredGrounds: Record<string, string> = {};
  for (const [token, entry] of Object.entries(decl.tokens)) {
    if (entry.role !== "ground" || groundNames.has(token)) continue;
    if (!entry.reason || entry.reason.trim().length === 0) {
      findings.push({
        problem: "ground-without-reason",
        detail: `${token} ist ground, steht aber in keinem grounds-Eintrag — damit ist er ungemessen. Das braucht eine Begründung.`,
      });
    } else unmeasuredGrounds[token] = entry.reason;
  }

  for (const [token, entry] of Object.entries(decl.tokens)) {
    // Riegel 7: `"on": []` war ein stiller Ausweg. Nullish-Coalescing erhält ein
    // ausdrücklich leeres Array, also erzeugte ein Text- oder Grafik-Token damit
    // NULL Paarungen und keinen Befund; solange irgendein anderer Token gemessen
    // wurde, blieb `measurements.length` ungleich null und der Report konnte
    // `pass` sein. Leer ist keine Aussage — es wird gemeldet UND auf die strenge
    // Lesart zurückgefallen (gegen alle Gründe), genau wie ein fehlendes `on`.
    if (entry.on !== undefined && entry.on.length === 0) {
      findings.push({
        problem: "unclassified",
        detail: `${token} nennt "on": [] — ein leerer Grund-Satz misst nichts. Nenne die Gründe, lass "on" ganz weg (dann gilt die strengere Lesart gegen alle), oder führe den Token als exempt mit Begründung.`,
      });
    }
    for (const on of entry.on ?? []) {
      if (!groundNames.has(on)) {
        findings.push({
          problem: "unknown-ground",
          detail: `${token} nennt den Grund ${on}, der nicht in grounds steht`,
        });
      }
    }
  }
  for (const ground of decl.grounds) {
    if (ground.over !== undefined && !groundNames.has(ground.over)) {
      findings.push({
        problem: "unknown-ground",
        detail: `Grund ${ground.token} liegt über ${ground.over}, das nicht in grounds steht`,
      });
    }
  }

  // Tweak-Achsen gegen die echten Tweaks des Manifests — eine Achse auf einen
  // Tweak, den es nicht gibt, fährt Extreme an, die niemand einstellen kann.
  const tweaks = input.manifest.tweaks ?? {};
  const axes = decl.tweakAxes ?? [];

  /**
   * Die Namen, die im Blatt überhaupt vorkommen — als deklarierte Eigenschaft ODER
   * als `var()`-Bezug. Eine Achse, deren `cssVar` hier fehlt, bewegt nichts: ihre
   * Stopps wiederholen die Default-Palette, und `stops.length > 1` hätte trotzdem
   * volle Deckung behauptet (`tweakAxes: [{ tweak: "veil", cssVar: "--aplha" }]`
   * gegen ein Blatt, das `--alpha` liest). Ein Tippfehler ist damit ein BEFUND
   * statt einer stillen Nullmessung.
   */
  const namesInSheet = new Set<string>();
  for (const [, name, value] of allDeclarations(sources)) {
    namesInSheet.add(name);
    for (const ref of value.matchAll(/var\(\s*(--[^\s,)]+)/g)) namesInSheet.add(ref[1]!);
  }

  /** Je Achse: die anzufahrenden Werte, inklusive des Manifest-Defaults. */
  const axisValues: { readonly axis: (typeof axes)[number]; readonly values: string[] }[] = [];
  for (const axis of axes) {
    const tweak = tweaks[axis.tweak];
    if (!tweak) {
      findings.push({
        problem: "unknown-tweak",
        detail: `a11y.tweakAxes nennt den Tweak ${axis.tweak}, den manifest.tweaks nicht kennt`,
      });
      continue;
    }
    const values = extremesOf(tweak);
    if (values.length === 0) {
      findings.push({
        problem: "unknown-tweak",
        detail: `Tweak ${axis.tweak} hat keine Extreme (weder min/max noch options) — die Achse misst nichts`,
      });
      continue;
    }
    if (!namesInSheet.has(axis.cssVar)) {
      findings.push({
        problem: "unknown-tweak",
        detail: `Achse ${axis.tweak} schreibt ${axis.cssVar}, das in KEINEM Stylesheet vorkommt — weder deklariert noch per var() gelesen. Ihre Stopps wiederholen die Default-Palette`,
      });
      continue;
    }
    // Der Manifest-`default` gehört dazu: bei einem Regler stehen sonst nur min und
    // max, und ein Default DAZWISCHEN wird nie angefahren — obwohl genau ihn der
    // Host beim Start setzt. Liegt er auf einem Extrem, fällt er durch das Set weg.
    if (tweak.default !== undefined && tweak.default !== null) {
      values.push(String(tweak.default));
    }
    axisValues.push({ axis, values: [...new Set(values)] });
  }

  /**
   * Das KARTESISCHE PRODUKT der Achsen, nicht eine Achse je Stopp.
   *
   * Vorher überschrieb jeder Stopp genau eine Variable, alle anderen Achsen blieben
   * auf ihrem Blatt-Wert — Wechselwirkungen wurden also nie gemessen. Schwarz auf
   * Weiss besteht, wenn nur der Vordergrund nach `#707070` wandert, und besteht,
   * wenn nur der Grund nach `#777777` wandert; die GLEICHZEITIGE Stellung hat fast
   * keinen Kontrast — und der Report sagte `checkedTweakExtremes: true` und `pass`.
   *
   * Das Produkt wächst multiplikativ, deshalb eine Obergrenze: darüber wird die
   * Vollständigkeit nicht behauptet, sondern als Befund gemeldet. Lieber eine
   * benannte Grenze als eine Messung, die nie fertig wird.
   */
  // Über dieser Grenze wird die Vollständigkeit NICHT behauptet: `silentGap` unten
  // greift, das Urteil fällt durch, und `tweakStops` im Report zeigt, dass nur die
  // Einzelachsen angefahren wurden. Kein realer Skin kommt bisher in die Nähe (ionic
  // hat eine Achse); die Grenze ist da, damit eine Deklaration mit sechs Achsen nicht
  // in eine Messung läuft, die nie fertig wird.
  const MAX_STOPS = 64;
  // Je Achse gibt es ihre Werte PLUS "unverstellt" — daher (k+1), nicht k. Der
  // Aufbau unten erzeugt genau diese Menge: jede Teilstellung und jede Kombination.
  const productSize = axisValues.reduce((n, a) => n * (a.values.length + 1), 1);
  let stops: TweakStop[] = [{ label: "default", overrides: new Map() }];
  const stopsTruncated = productSize > MAX_STOPS;
  if (stopsTruncated) {
    // Wenigstens die einzelnen Achsen anfahren, statt gar nichts zu messen.
    for (const { axis, values } of axisValues) {
      for (const value of values) {
        stops.push({ label: `${axis.tweak}=${value}`, overrides: new Map([[axis.cssVar, value]]) });
      }
    }
  } else {
    for (const { axis, values } of axisValues) {
      const grown: TweakStop[] = [];
      for (const base of stops) {
        for (const value of values) {
          const overrides = new Map(base.overrides);
          overrides.set(axis.cssVar, value);
          const label = base.label === "default" ? "" : `${base.label} `;
          grown.push({ label: `${label}${axis.tweak}=${value}`, overrides });
        }
      }
      // Der reine Default-Stopp bleibt erhalten — er ist der Zustand ohne Zutun.
      stops = [...stops, ...grown];
    }
  }
  const uniqueStops = new Map(stops.map((s) => [s.label, s]));
  stops = [...uniqueStops.values()];
  const factoryStops = factoryLabels(axisValues, tweaks);
  // Riegel 4: JEDER Tweak des Manifests muss eingeordnet sein. Ohne diesen Abgleich
  // stand `checkedTweakExtremes: true` im Report, während ein unbenannter Tweak die
  // Farbe verschob — eine ungedeckte positive Aussage, und damit genau der Fehler,
  // den diese Fläche sonst überall verbietet.
  const neutralTweaks = decl.neutralTweaks ?? {};
  const unmeasuredTweaks = decl.unmeasuredTweaks ?? {};
  const named = new Set([
    ...axes.map((a) => a.tweak),
    ...Object.keys(neutralTweaks),
    ...Object.keys(unmeasuredTweaks),
  ]);
  let unclassifiedTweak = false;
  for (const name of Object.keys(tweaks)) {
    if (named.has(name)) continue;
    unclassifiedTweak = true;
    findings.push({
      problem: "undeclared-tweak",
      detail: `Tweak ${name} ist in a11y weder als Achse noch als neutralTweaks noch als unmeasuredTweaks eingeordnet — die Extreme sind damit NICHT vollständig geprüft`,
    });
  }
  for (const [group, entries] of [
    ["neutralTweaks", neutralTweaks],
    ["unmeasuredTweaks", unmeasuredTweaks],
  ] as const) {
    for (const [name, reason] of Object.entries(entries)) {
      if (!(name in tweaks)) {
        findings.push({
          problem: "unknown-tweak",
          detail: `${group} nennt ${name}, den manifest.tweaks nicht kennt`,
        });
      }
      if (!reason || reason.trim().length === 0) {
        findings.push({
          problem: "exempt-without-reason",
          detail: `${group}.${name} ohne Begründung — eine Auslassung muss eine Aussage sein`,
        });
      }
    }
  }

  // Zwei Arten von Loch in der Deckung, und sie wiegen NICHT gleich schwer.
  //
  // STILL: eine deklarierte Achse, die keinen Stopp erzeugt hat (Tippfehler im
  // `values`, leere Liste), oder ein Tweak, den das Manifest gar nicht einordnet.
  // Beides behauptet Deckung, die es nicht gibt — der Report würde lügen, also
  // fällt der Skin durch. `unclassifiedTweak` erzeugt zusätzlich ein `finding`,
  // die Ratsche liegt damit doppelt.
  //
  // EINGERÄUMT: `unmeasuredTweaks` — farbwirksam, aber von dieser Fläche nicht
  // erfassbar, MIT Begründung (eine leere Begründung ist ein `finding`, also
  // wieder fail). Das ist eine wahre Aussage über eine echte Grenze des
  // Messwerkzeugs, kein Mangel des Skins: ionic schaltet `stil`/`accentStyle`
  // über data-Attribute ein anderes Regelwerk frei, nicht über eine Variable.
  // Solange diese Fläche nur Variablen-Achsen modelliert, ist dort KEIN
  // ehrlicher Weg zu voller Deckung — ein Gate, das darauf besteht, ist
  // strukturell unerreichbar und bestraft die Ehrlichkeit (openbridgeserver#181).
  //
  // Der Vertrag hält beide Aussagen schon getrennt: `aa` sagt "über alles
  // Gemessene bestanden", `checkedTweakExtremes` sagt "es war alles Messbare".
  // Nur die erste ist das Urteil; die zweite bleibt im Report sichtbar, damit
  // die eingeräumte Lücke nicht verschwindet.
  const silentGap =
    !(axes.length === 0 || stops.length > 1) || unclassifiedTweak || stopsTruncated;
  const checkedTweakExtremes = !silentGap && Object.keys(unmeasuredTweaks).length === 0;

  const measurements: A11yMeasurement[] = [];
  const violations: A11yMeasurement[] = [];
  /**
   * Der Klassifikations-Boden: JEDE Deklaration aller Blätter. Er beantwortet nur
   * die Frage "zeigt dieser Alias überhaupt auf eine Farbe?" (Riegel 1) und darf
   * dafür themeübergreifend sein — MESSEN tut er nichts.
   */
  const envAll = new Map<string, string>();
  for (const [, name, value] of allDeclarations(sources)) envAll.set(name, value);

  // Die Selektoren ALLER deklarierten Themes (auch der ausgenommenen): sie sind
  // der Massstab dafür, welcher Block in ein gemessenes Theme kaskadiert und
  // welcher zu einem fremden gehört.
  /**
   * Je gemessenem Theme ein MESSPUNKT: ein echtes Element in einem eigenen Dokument,
   * gegen das die Kaskade entscheidet. Eigenes Dokument statt des globalen, damit die
   * Messung nicht davon abhängt, in welcher Umgebung sie läuft.
   *
   * `decl.base` (typisch `:root`) braucht hier keinen Sonderweg mehr: der Block liegt
   * auf dem Wurzelelement, ist damit ein Vorfahr jedes Messpunkts, und die Kaskade
   * ordnet ihn von selbst unter die spezifischeren Theme-Blöcke.
   */
  const doc = new JSDOM("<!doctype html><html><body></body></html>").window.document;
  const context = new Map<string, Element>();
  for (const [theme, selector] of measuredThemes) {
    const el = synthesizeContext(selector, doc);
    if (el !== null) context.set(theme, el);
  }
  const alphas = decl.alphas && decl.alphas.length > 0 ? decl.alphas : [1];
  /**
   * Deckkräfte kommen aus dem Manifest und werden beim Laden nur TYP-geprüft. Ein
   * Eintrag ausserhalb 0…1 extrapoliert in `composite` die Kanäle, statt die
   * Deckkraft anzuwenden, die der Browser kennt: mit `alphas: [2]` rechnet `#777`
   * auf Weiss zu einem hohen Verhältnis hoch, während auf dem Schirm die gewöhnlichen
   * ~4.48:1 stehen. Eine unbrauchbare Zahl wird deshalb GEMELDET statt gemessen.
   */
  function usableAlphas(list: readonly number[], where: string): number[] {
    const good: number[] = [];
    for (const a of list) {
      if (typeof a !== "number" || !Number.isFinite(a) || a < 0 || a > 1) {
        findings.push({
          // `unresolvable`, weil der Vertrag keinen eigenen Namen dafür führt und
          // die Sache dieselbe ist: aus dieser Angabe lässt sich keine Messung
          // gewinnen. Ein eigener Problem-Name wäre ein Vertrags-Minor.
          problem: "unresolvable",
          detail: `${where}: Deckkraft ${String(a)} liegt ausserhalb 0…1 — CSS kennt dort keinen Wert, die Messung waere erfunden`,
        });
        continue;
      }
      good.push(a);
    }
    return good;
  }

  const layerOrder = layerOrderOf(sources);
  for (const [theme, selector] of measuredThemes) {
    if (sources.length === 0) break;
    /**
     * Die Umgebung DIESES Themes — aus der echten Kaskade, nicht mehr aus drei fest
     * übereinandergelegten Karten.
     *
     * Vorher stand hier `envTheme` (jeder Block, der über eine Zeichenketten-Regel
     * "in dieses Theme kaskadiert"), darüber `base` (`:root`), darüber die
     * Theme-Token — und innerhalb jeder Karte gewann schlicht, was später im
     * Quelltext stand. Spezifität, `!important` und `@layer` kamen nirgends vor,
     * und ob ein Block wirklich auf den Messpunkt passt, entschied ein
     * `startsWith`. Jetzt fragt {@link cascadeEnv} ein echtes Element, und
     * `base`/`themeTokens` fallen als Sonderfälle weg: sie sind gewöhnliche Blöcke,
     * die die Kaskade von selbst richtig einordnet.
     *
     * Ein Theme, dessen Selektor sich nicht zu einem Element bauen lässt, wird
     * gemeldet statt still übersprungen.
     */
    const point = context.get(theme);
    if (point === undefined) {
      findings.push({
        problem: "selector-missing",
        detail: `${theme}: aus dem Selektor "${selector}" liess sich kein Messpunkt bauen`,
      });
      continue;
    }
    const envTheme = cascadeEnv(sources, point, layerOrder);

    for (const stop of stops) {
      const env = new Map<string, string>([...envTheme, ...stop.overrides]);

      // 1) Gründe auflösen und die Kette zusammenmischen.
      const ground = new Map<string, Rgba>();
      for (const g of decl.grounds) {
        const resolved = resolveGround(g, decl.grounds, env);
        if (resolved === null) {
          // An JEDEM Stopp, nicht nur am Default (siehe unten beim Vordergrund):
          // ein Tweak kann einen Grund unauflösbar machen, den die Werkseinstellung
          // noch auflöst.
          findings.push({
            problem: "unresolvable",
            detail: `${theme}/${stop.label}: Grund ${g.token} = "${env.get(g.token) ?? "(fehlt)"}" ist nicht auflösbar`,
          });
          continue;
        }
        if (!isOpaque(resolved.a)) {
          findings.push({
            problem: "translucent-ground",
            detail: `${theme}/${stop.label}: Grund ${g.token} bleibt nach dem Mischen durchscheinend (a=${resolved.a.toFixed(2)}) — nenne einen over-Grund`,
          });
          continue;
        }
        ground.set(g.token, resolved);
      }

      // 2) Jeden Vordergrund gegen jeden erklärten Grund, bei jeder Deckkraft.
      for (const [token, entry] of Object.entries(decl.tokens)) {
        if (entry.role !== "text" && entry.role !== "graphic") continue;
        const raw = env.get(token);
        if (raw === undefined) {
          if (stop.label === "default") {
            findings.push({
              problem: "unclassified",
              detail: `${theme}: ${token} ist deklariert, steht aber in keinem der erklärten Blöcke`,
            });
          }
          continue;
        }
        const color = resolveColor(raw, env);
        if (color === null) {
          // An JEDEM Stopp, nicht nur am Default. Vorher wurden unauflösbare
          // Vordergründe an einem Tweak-Extrem still übersprungen: ein Tweak, der
          // auf eine benannte CSS-Farbe abbildet (`red`), lieferte am Default einen
          // messbaren Hexwert und an jedem Extrem `null` — und der Report sagte
          // weiter `checkedTweakExtremes: true` und `pass`, obwohl an den Extremen
          // gar nichts gemessen wurde.
          findings.push({
            problem: "unresolvable",
            detail: `${theme}/${stop.label}: ${token} = "${raw}" ist nicht auflösbar — umschreiben oder exempt mit Begründung`,
          });
          continue;
        }
        const threshold = entry.role === "text" ? THRESHOLDS.text : THRESHOLDS.graphic;
        // Ein leeres `on` fällt auf die strenge Lesart zurück (gegen alle Gründe) —
        // gemeldet wird es oben, gemessen wird es hier trotzdem.
        const targets =
          entry.on && entry.on.length > 0 ? entry.on : decl.grounds.map((g) => g.token);
        // Deckkraft je Token vor Deckkraft des Skins: ein Skin dimmt seine gesperrte
        // Kachel und seine Seitenüberschrift nicht — eine globale Liste erzeugte
        // Paarungen, die es auf dem Schirm nie gibt.
        const tokenAlphas = usableAlphas(
          entry.alphas && entry.alphas.length > 0 ? entry.alphas : alphas,
          `${token}`,
        );
        for (const target of targets) {
          const bg = ground.get(target);
          if (bg === undefined) continue; // schon als Befund vermerkt
          for (const alpha of tokenAlphas) {
            const effective = composite(color, bg, alpha);
            const ratio = contrast(effective, bg);
            const m: A11yMeasurement = {
              theme,
              token,
              role: entry.role,
              ground: `${target} ${hex(bg)}`,
              alpha,
              tweaks: stop.label,
              // Volle Präzision, nicht auf zwei Stellen gerundet: der Vergleich
              // unten nimmt das exakte Verhältnis, der Report nahm den gerundeten
              // Wert — `#070707` auf `#777777` sind ~4.498:1, landeten korrekt in
              // `violations` und standen dann als `ratio: 4.5` im Report, wo jeder
              // Leser ein Bestehen sieht. Und bei Gleichstand wählte `worst` die
              // falsche Paarung. Gerundet wird erst beim Ausgeben (`toFixed(2)`).
              ratio,
              threshold,
            };
            measurements.push(m);
            if (ratio < threshold) violations.push(m);
          }
        }
      }
    }
  }

  // 3) Riegel 1 — Vollständigkeit über das GANZE Blatt, nicht nur über die
  //    erklärten Blöcke. Ein Skin, der seine unbequeme Farbe in einen dritten Block
  //    schreibt, fiele sonst lautlos aus der Prüfung; ionics `--ion-*`-Brücke unter
  //    `.visu-root` ist genau so ein Block, und er trägt echte Textfarben.
  //    Ein Token, das hier nur eine ROLLE braucht (keine Messung), kann `exempt`
  //    mit Begründung sein — die Auslassung bleibt lesbar.
  if (sources.length > 0) {
    // Ein `var()`-Alias ist nur dann eine Farbe, wenn er AUF eine Farbe zeigt.
    // `--ion-font-family: var(--vz-font)` sieht sonst wie eine aus, und ein
    // Wächter mit falschem Alarm wird ignoriert — dieselbe Regel wie bei `alphas`.
    const isColor = (value: string): boolean =>
      /^var\(/i.test(value) ? resolveColor(value, envAll) !== null : COLOR_SHAPED.test(value);

    const seen = new Set<string>();
    for (const [selector, name, value] of allDeclarations(sources)) {
      if (name in decl.tokens || seen.has(name)) continue;
      if (isColor(value)) {
        seen.add(name);
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${name} = "${value}" ist eine Farbe ohne Rolle in a11y.tokens`,
        });
      } else if (bearsColor(value)) {
        seen.add(name);
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${name} = "${value}" trägt Farbe, ist aber keine flache Farbe — als exempt mit Begründung führen`,
        });
      }
    }

    // Riegel 10 — Farbe aus dem RENDERER, nicht aus dem Blatt.
    //
    // Dieselbe Regel wie oben, nur für die Inline-Stile der gerenderten Bäume: eine
    // Farbe muss über einen deklarierten Token laufen. Ein Renderer, der
    // `style: { color: "#777" }` über eine helle Fläche legt, kam der Farb-Achse
    // sonst gar nicht unter — sie sieht Stylesheets, und dort steht diese Farbe nie.
    for (const declaration of input.inlineStyles ?? []) {
      const cut = declaration.indexOf(":");
      if (cut <= 0) continue;
      const prop = declaration.slice(0, cut).trim();
      const value = declaration.slice(cut + 1).trim();
      if (value.length === 0 || !colorProperty(prop)) continue;
      if (TEXT_COLOR_PROPERTIES.has(prop.toLowerCase()) && /\btransparent\b/i.test(value)) {
        findings.push({
          problem: "unclassified",
          detail: `Renderer-Inline-Stil ${prop}: ${value} — unsichtbarer Text.`,
        });
        continue;
      }
      if (bearsColor(value)) {
        findings.push({
          problem: "unclassified",
          detail: `Renderer-Inline-Stil ${prop}: ${value} — eine Farbe aus dem Renderer, an a11y.tokens vorbei. Führe sie über einen deklarierten Token (var(--…)).`,
        });
        continue;
      }
      for (const name of varNamesIn(value)) {
        if (name in decl.tokens) continue;
        findings.push({
          problem: "unclassified",
          detail: `Renderer-Inline-Stil ${prop}: ${value} — ${name} steht nicht in a11y.tokens, ist also ungemessen`,
        });
      }
    }

    // Riegel 9 — ein klassifizierter Token, der AUSSERHALB der gemessenen Umgebung
    // verschoben wird.
    //
    // `@media`, `@supports`, `@container`, `@keyframes`, `@scope` und
    // `@starting-style` gelten nur unter ihrer jeweiligen Bedingung. Diese Fläche
    // misst sie nicht — und der Vollständigkeits-Scan schwieg dazu, weil er nur
    // fragt, ob der NAME klassifiziert ist. Ein Token konnte damit im Normalfall
    // bestehen und unter der Bedingung kontrastschwach werden, während der Report
    // `pass` sagt: `@media (forced-colors: active) { --fg: #777 }`, ein Keyframe, das
    // `--fg` auf halbem Weg umsetzt, oder ein `@scope (.preview)`, das die halbe
    // Palette austauscht.
    //
    // Gemeldet wird nur, was WIRKLICH abweicht: derselbe Wert unter einer Bedingung
    // ist eine Wiederholung, keine Lücke. Was gemeldet wird, ist kein Vorwurf, sondern
    // eine Aussage über die Grenze dieser Messung — der Autor kann den Zustand
    // auflösen oder den Token mit Begründung ausnehmen.
    for (const css of sources) {
      for (const rule of parseRules(css)) {
        if (rule.outside.length === 0) continue;
        for (const d of rule.decls) {
          if (!(d.prop in decl.tokens)) continue;
          const entry = decl.tokens[d.prop]!;
          if (entry.role === "exempt") continue;
          // Gegen JEDE gemessene Umgebung: weicht der bedingte Wert überall ab, ist
          // er ein Zustand, den niemand gemessen hat.
          const differsEverywhere = [...context.values()].every((point) => {
            const env = cascadeEnv(sources, point, layerOrder);
            return env.get(d.prop) !== d.value;
          });
          if (!differsEverywhere) continue;
          findings.push({
            problem: "unresolvable",
            detail: `${rule.outside}: ${d.prop} wird auf "${d.value}" gesetzt — dieser Zustand wird NICHT gemessen. Löse ihn auf (eigener Token, gemessene Achse) oder nimm ihn mit Begründung aus.`,
          });
        }
      }
    }

    // Riegel 8 — Farbe an den Token VORBEI. Der Scan oben erkennt ausschliesslich
    // `--name`; `outline: 2px solid #d6a800` und ein hartcodiertes `color: #fff`
    // wurden deshalb WEDER klassifiziert NOCH gemessen. Ein Skin konnte
    // `a11y.status: "pass"` bekommen und trotzdem unzugängliche Vordergründe
    // ausliefern — die grösste Lücke, die diese Fläche je hatte.
    //
    // Die Regel ist deshalb: in einem deklarierten Blatt kommt jede Farbe aus
    // einem Token (`var(--…)`), der eine Rolle trägt. Eine Farbe direkt in einer
    // gewöhnlichen Deklaration ist ein Befund — nicht, weil sie zwingend falsch
    // wäre, sondern weil sie NICHT MESSBAR ist: sie hat keinen Namen, keine Rolle
    // und keinen erklärten Grund, und ein stilles Überspringen wäre wieder genau
    // der Ausweg, den diese Datei sonst überall zumauert.
    for (const [selector, prop, value] of allPlainDeclarations(sources)) {
      // Der Scan ist EIGENSCHAFTSBEWUSST, nicht wertratend. Vorher lief jeder Wert
      // durch `bearsColor`, und das erzeugte Fehlalarm in beide Richtungen:
      //  - `animation: red 1s` mit `@keyframes red` ist ein Bezeichner, keine Farbe,
      //    wurde aber als `unclassified` gemeldet und kippte den Lauf;
      //  - `color: var(--inkx)` enthielt gar kein Farbwort, wurde deshalb
      //    übersprungen — und ein fehlender oder unklassifizierter Token blieb
      //    unbemerkt, obwohl `color` dann erbt (Schwarz auf Schwarz).
      // Wo Farbe stehen KANN, sagt die Eigenschaft; was dort steht, sagt der Wert.
      if (!colorProperty(prop)) continue;

      // 1a) `transparent` ist keine Farbe im Sinne von `bearsColor` (an einem Grund
      //     ist Farblosigkeit normal und harmlos) — an einer TEXT-Eigenschaft ist sie
      //     unsichtbarer Text und damit sehr wohl ein Befund.
      if (TEXT_COLOR_PROPERTIES.has(prop.toLowerCase()) && /\btransparent\b/i.test(value)) {
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${prop}: ${value} — unsichtbarer Text. Ein Vordergrund ohne Deckkraft ist nicht messbar und für den Leser nicht da.`,
        });
        continue;
      }

      // 1b) Eine Farbe direkt im Wert: nicht messbar, weil ohne Namen, Rolle und
      //     erklärten Grund.
      if (bearsColor(value)) {
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${prop}: ${value} — eine Farbe an a11y.tokens vorbei. Führe sie über einen deklarierten Token (var(--…)), sonst ist sie ungemessen.`,
        });
        continue;
      }

      // 2) Ein Verweis auf einen Token, den die Deklaration nicht kennt: `color:
      //    var(--inkx)` mit unbekanntem `--inkx` ist im Browser ungültig und ERBT.
      for (const name of varNamesIn(value)) {
        if (name in decl.tokens) continue;
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${prop}: ${value} — ${name} steht nicht in a11y.tokens, ist also ungemessen`,
        });
      }
    }
  }

  const worst: Record<string, A11yMeasurement> = {};
  for (const m of measurements) {
    const current = worst[m.role];
    if (!current || m.ratio < current.ratio) worst[m.role] = m;
  }

  if (measurements.length === 0 && findings.length === 0) {
    findings.push({
      problem: "undeclared",
      detail:
        "die Deklaration erzeugte KEINE einzige Messung — ein Wächter, der nie fällt, beweist nichts",
    });
  }
  // Ins Urteil geht das STILLE Loch (siehe oben), nicht das eingeräumte.
  const ok =
    violations.length === 0 && findings.length === 0 && measurements.length > 0 && !silentGap;

  const deduped = dedupe(findings);
  return {
    status: ok ? "pass" : "fail",
    aa: ok,
    checkedTweakExtremes,
    thresholds: THRESHOLDS,
    themes: measuredThemes.map(([name]) => name),
    ...(Object.keys(exemptThemes).length > 0 ? { exemptThemes } : {}),
    tweakStops: stops.map((s) => s.label),
    combinations: measurements.length,
    worst,
    violationCount: violations.length,
    violationBreakdown: {
      // `atDefault` meint die WERKSEINSTELLUNG, nicht bloss den Stopp namens
      // "default": auch die Stellung, die der Host aus den Manifest-Defaults setzt,
      // gehört dazu (siehe `factoryLabels`).
      atDefault: violations.filter((v) => v.alpha === 1 && factoryStops.has(v.tweaks)).length,
      atTweakExtreme: violations.filter((v) => v.alpha === 1 && !factoryStops.has(v.tweaks)).length,
      whenDimmed: violations.filter((v) => v.alpha < 1).length,
    },
    violations: violations.sort((a, b) => a.ratio - b.ratio).slice(0, 40),
    ...(Object.keys(exemptTokens).length > 0 ? { exempt: exemptTokens } : {}),
    ...(Object.keys(unmeasuredGrounds).length > 0 ? { unmeasuredGrounds } : {}),
    ...(Object.keys(unmeasuredTweaks).length > 0 ? { unmeasuredTweaks } : {}),
    findingCount: deduped.length,
    findings: deduped.slice(0, 40),
  };
}

/** Mischt einen Grund über seine `over`-Kette zusammen, bis er deckend ist. */
function resolveGround(
  ground: A11yGround,
  all: readonly A11yGround[],
  env: Map<string, string>,
  seen: ReadonlySet<string> = new Set(),
): Rgba | null {
  // ZYKLUS: `--a über --b` und `--b über --a` lief vorher nur in die Tiefengrenze,
  // und beim Zurückwickeln behandelte JEDER Aufrufer das Scheitern so, als sei seine
  // eigene transluzente Farbe ein gültiger Unterbau — die zyklischen Farben wurden
  // wieder und wieder übereinandergelegt, bis das Ergebnis deckend AUSSAH und die
  // Messung bestand, obwohl es gar keinen deckenden Grund gibt. Jetzt bricht der
  // Zyklus die Auflösung ab, statt sie zu erfinden.
  if (seen.has(ground.token)) return null;
  const raw = env.get(ground.token);
  if (raw === undefined) return null;
  const color = resolveColor(raw, env);
  if (color === null) return null;
  // DECKEND heisst alpha === 1, nicht "fast". `rgb(255 255 255 / 99.9%)` ohne `over`
  // nahm diesen Weg und bestand auch die spätere Transluzenz-Prüfung: gerechnet
  // wurde gegen reines Weiss, während der Browser weiter mit einem unbekannten Ton
  // darunter mischt. Nah an der Schwelle wird daraus ein `pass`, das nichts belegt.
  if (isOpaque(color.a)) return color;
  // Transluzent OHNE erklärten Unterbau: die Farbe kommt so zurück, wie sie ist —
  // der `translucent-ground`-Riegel weiter oben ist der genauere Befund dafür als
  // ein pauschales „unauflösbar".
  if (ground.over === undefined) return color;
  const under = all.find((g) => g.token === ground.over);
  if (!under) return color; // als `unknown-ground` bereits gemeldet
  const beneath = resolveGround(under, all, env, new Set([...seen, ground.token]));
  return beneath === null ? null : composite(color, beneath);
}

function dedupe(findings: readonly A11yFinding[]): A11yFinding[] {
  const seen = new Set<string>();
  const out: A11yFinding[] = [];
  for (const f of findings) {
    const key = `${f.problem} ${f.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
