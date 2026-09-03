// @obs-visu-skins/conformance — Konformitäts-Generator (ARCHITECTURE.md §2, CONTRACT-v1.md §8).
//
// Prüft einen Skin (manifest.json + Renderer-Maps) gegen die Vertrags-Kern-Typen und
// erzeugt einen `SupportReport` (support.json). Der Generator asseriert NIE selbst —
// und er glaubt dem Manifest nicht: die Stufe wird an dem gemessen, was die Renderer
// beim headless-Lauf über den Vertrags-Fixtures TATSÄCHLICH tun.
//
// Zwei Achsen, beide gemessen:
//   • Render-Achse — jede Fixture jedes Typs wird durch jede vorhandene Renderer-
//     Fläche (tile · detail · preset) gejagt. Wirft eine, ist der Typ `broken`.
//   • Aktions-Achse — der zurückgegebene Baum wird nach `data-action` abgelaufen.
//     Gezählt wird, was der Renderer MARKIERT, nicht was das Manifest behauptet.
//     Ein Manifest-Eintrag ohne markierende Fixture hebt die Stufe daher nicht.
//
// Für jeden CoreWidgetType …
//   • in manifest.unsupported                                       → "unsupported"
//   • in widgets deklariert, aber KEIN tiles-Renderer               → "gap"
//   • tiles-Renderer vorhanden, aber NICHT in widgets deklariert    → "gap"
//   • beides vorhanden →
//       – ein Renderer wirft                                        → "broken"
//       – markiert eine Aktion, die das Manifest nicht deklariert   → "broken"
//         (Goldene Regel 3: nicht verdrahtet darf nie vorgetäuscht werden)
//       – der Vertrag kennt keine Aktion (sensor), oder es wird
//         keine markiert                                            → "display"
//       – alle kanonischen Aktionen markiert                        → "full"
//       – ein Teil markiert                                         → "partial"
// `gap` und `broken` sind Fehler: hasGap === true → CLI Exit-Code != 0.
//
// Die kanonischen Aktionen je Typ kommen aus contract.schema.json (§6) — nicht aus
// einer Kopie im Tooling. Bumpt der Vertrag einen Typ oder eine Aktion, verschiebt
// sich die Stufe hier automatisch mit.
//
// Der `render`-Eintrag nennt Fläche UND Funktionsnamen (`tile:lightTile`). Zwei Skins,
// die dieselbe Implementierung teilen (edomi re-exportiert ionics Renderer), sind damit
// im Report erkennbar — ein doppelter `broken` ist dann sichtbar EIN Befund, nicht zwei.

import {
  fixtures as contractFixtures,
  schema as contractSchema,
  version as contractVersion,
  type CoreWidgetType,
  type Renderer,
  type PageRenderer,
  type SkinManifest,
  type SupportReport,
  type SupportWidgetEntry,
} from "@obs/visu-contract";
import { ctxStub, pageHostProbe, tokensStub } from "./stubs.js";

// Die Fixture-Wand nutzt denselben Ctx-/Tokens-Stub wie dieser Lauf — Wand und
// support.json sollen dieselbe Prüfung zeigen, nicht zwei Nachbildungen.
export { ctxStub, tokensStub, pageHostProbe } from "./stubs.js";

/**
 * Die stabilen Kern-Typen — **aus dem Vertragsschema abgeleitet**, nicht getippt:
 * alles unter `widgets`, was nicht `reserved` ist. Befoerdert ein kuenftiger Vertrag
 * einen reservierten Typ (weather/energy/chart/alarm), erscheint er hier automatisch
 * und damit als `gap`, bis ein Skin ihn rendert oder bewusst abwaehlt. Eine getippte
 * Liste haette genau das verschluckt — dieselbe Blindheit, die `targetsContract` als
 * Literal neun Minor-Versionen lang verdeckt hat.
 */
export const CORE_WIDGET_TYPES: readonly CoreWidgetType[] = Object.freeze(
  Object.entries(
    (contractSchema as { widgets?: Record<string, { reserved?: boolean }> }).widgets ?? {},
  )
    .filter(([, def]) => def?.reserved !== true)
    .map(([type]) => type as CoreWidgetType),
);

/** Eine partielle Map über Kern-Typen auf reine Renderer-Funktionen (Spiegel von `tiles`). */
export type RendererMap = Partial<Record<CoreWidgetType, Renderer>>;

/**
 * Eingabe des Generators: das Manifest plus die tatsächlich verdrahteten Renderer-Maps.
 * `details`/`presets` sind optional — ein Skin ohne sie bedient alles in der Kachel.
 * Gemessen wird über ALLE vorhandenen Flächen: eine Aktion, die ein Skin nur in seiner
 * Detailfläche anbietet (ionic: `setDim`, `setSetpoint`), zählt als angeboten.
 */
export interface SkinInput {
  readonly manifest: SkinManifest;
  readonly tiles: RendererMap;
  readonly details?: RendererMap;
  readonly presets?: RendererMap;
  /** Der optionale Ganzseiten-Renderer (Vertrag 1.10) - gebraucht, um die
   *  `honors`-Achse zu MESSEN statt zu glauben. */
  readonly page?: PageRenderer;
}

/**
 * Ein Befund auf der `honors`-Achse - der Deklarations-Slot des Layouts.
 *
 * `layout.honors` wird verbatim nach support.json durchgereicht und der HOST
 * richtet sein Verhalten danach (bei `'link'` tritt er mit seiner eigenen
 * Sprung-Affordanz zurück). Ein Slot, auf den sich Verhalten stützt, muss
 * geprüft sein, sonst ist er wieder nur eine Behauptung:
 *
 *  - `unknown`      - der String steht nicht im Vertrags-Vokabular
 *                     (`contract.schema.json -> layoutHonors`). Ein Tippfehler
 *                     wäre sonst eine stumme Nicht-Deklaration.
 *  - `undelivered`  - der Skin deklariert `'link'`, sein Page-Renderer fragt den
 *                     Host beim Probelauf aber nach KEINEM Link-Dienst. Dann
 *                     zeichnet er den Sprung nicht - und weil der Host wegen der
 *                     Deklaration zurückgetreten ist, gäbe es gar keine
 *                     Affordanz mehr.
 *  - `unrenderable` - `'link'` ohne jeden Page-Renderer: nichts kann den Sprung
 *                     zeichnen, denn nur der Page-Renderer sieht `LayerItem`.
 */
export interface HonorsFinding {
  readonly token: string;
  readonly problem: "unknown" | "undelivered" | "unrenderable";
  readonly detail: string;
}

/** Ergebnis des Generators: der Report plus ein hartes Fehler-Flag (gap ODER broken). */
export interface ConformanceResult {
  readonly report: SupportReport;
  readonly hasGap: boolean;
  /** Befunde der `honors`-Achse; nicht leer => harter Fehler wie `gap`. */
  readonly honors: readonly HonorsFinding[];
}

/** Das anerkannte `honors`-Vokabular - AUS dem Vertrag, nie aus einer Kopie hier. */
export const LAYOUT_HONORS: readonly string[] = Object.freeze([
  ...(((contractSchema as { layoutHonors?: readonly string[] }).layoutHonors ?? []) as string[]),
]);

/**
 * Misst die `honors`-Achse. Kein I/O; der Page-Renderer wird einmal über einen
 * neutralen, protokollierenden {@link pageHostProbe} gefahren. Wirft er, zeichnet
 * er nichts - derselbe Befund.
 */
export function checkHonors(skin: SkinInput): HonorsFinding[] {
  const declared = skin.manifest.layout.honors ?? [];
  const findings: HonorsFinding[] = [];

  for (const token of declared) {
    if (LAYOUT_HONORS.length > 0 && !LAYOUT_HONORS.includes(token)) {
      findings.push({
        token,
        problem: "unknown",
        detail: `nicht im Vertrags-Vokabular (${LAYOUT_HONORS.join(" · ")})`,
      });
    }
  }

  if (declared.includes("link")) {
    if (!skin.page) {
      findings.push({
        token: "link",
        problem: "unrenderable",
        detail: "kein Page-Renderer - nur er sieht LayerItem.link",
      });
    } else {
      const probe = pageHostProbe();
      let tree: unknown = null;
      try {
        tree = skin.page(probe.host);
      } catch {
        /* wie "zeichnet nichts": es entsteht keine Affordanz */
      }
      // Gemessen wird genau EINES: IRGENDEIN Klick-Handler im gerenderten Baum
      // ruft `host.followLink`. Nicht mehr — nicht, dass die Affordanz sichtbar,
      // fokussierbar, aktivierbar oder überhaupt an DIESEM Item hängt. Ein
      // Reviewer hat drei Renderer gebaut, die das hier grün passieren und
      // trotzdem unbedienbar sind (`disabled`+`display:none`; ein nacktes,
      // nicht fokussierbares `<div>`; ein Handler ohne Bezug zum Item).
      //
      // Diese schmale Messung ist trotzdem die richtige: sie trennt sicher
      // "zeichnet den Sprung" von "hat den Host nur gefragt" — und genau daran
      // scheiterte die erste Fassung, durch die ein Skin schlüpfte, der
      // `isLinkActive` fürs Markup ruft und den Sprung weglässt. Der Rest
      // (bedienbar, fokussierbar) ist Sache der Specs des Skins; hier wird
      // NICHT behauptet, er sei geprüft.
      for (const fire of clickHandlers(tree)) {
        try {
          fire();
        } catch {
          /* ein werfender Handler liefert keine Affordanz - zählt als nichts */
        }
      }
      if (!probe.linkCalls.includes("followLink")) {
        findings.push({
          token: "link",
          problem: "undelivered",
          detail:
            "der Page-Renderer zeichnet keine aktivierbare Sprung-Affordanz (kein Klick-Handler ruft host.followLink)",
        });
      }
    }
  }

  return findings;
}

/**
 * Alle Klick-Handler eines gerenderten Baums (Vue-VNode-artig: `props` +
 * `children`). Tiefenbegrenzt und zyklensicher genug für einen headless Probelauf.
 */
function clickHandlers(node: unknown, out: (() => void)[] = [], depth = 0): (() => void)[] {
  if (depth > 64 || node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) clickHandlers(child, out, depth + 1);
    return out;
  }
  const vnode = node as { props?: Record<string, unknown> | null; children?: unknown };
  for (const [key, value] of Object.entries(vnode.props ?? {})) {
    if (/^on(Click|click)$/.test(key) && typeof value === "function") {
      out.push(value as () => void);
    }
  }
  clickHandlers(vnode.children, out, depth + 1);
  return out;
}

type Summary = {
  full: number;
  partial: number;
  display: number;
  unsupported: number;
  gap: number;
  broken: number;
};

/* ------------------------------------------------------ Vertrags-Auswertung */

interface SchemaWidget {
  readonly actions?: Readonly<Record<string, unknown>>;
}

const SCHEMA_WIDGETS = ((contractSchema as { widgets?: Readonly<Record<string, SchemaWidget>> })
  .widgets ?? {}) as Readonly<Record<string, SchemaWidget>>;

type FixtureMap = Readonly<Record<string, Readonly<Record<string, Record<string, unknown>>>>>;
const FIXTURES = contractFixtures as unknown as FixtureMap;

/** Die kanonischen Aktionen, die der Vertrag für einen Typ kennt (§6). */
export function canonicalActions(type: CoreWidgetType): readonly string[] {
  return Object.keys(SCHEMA_WIDGETS[type]?.actions ?? {});
}

/** Die Fixture-Zustände, die der Vertrag für einen Typ mitbringt (§8, Prüfgrundlage). */
export function fixtureStates(type: CoreWidgetType): readonly string[] {
  const states = FIXTURES[type];
  return states ? Object.keys(states) : [];
}

/**
 * Universelle Host-/UI-Aktionen: sie brauchen laut Vertrag §6 KEINE Deklaration je
 * Widget, dürfen also markiert werden, ohne im Manifest zu stehen. `stop` ist
 * doppelnatürig — kanonische Media-Aktion, für die Bewegungs-Widgets aber ein
 * UI-only Momentary ohne Core-Write.
 */
function toleratedActions(type: CoreWidgetType): ReadonlySet<string> {
  const base = ["openDetail", "close"];
  return new Set(type === "blind" || type === "jalousie" ? [...base, "stop"] : base);
}

/**
 * Läuft einen Renderer-Rückgabewert ab und sammelt jede markierte `data-action`.
 * Verträgt beide Formen, die {@link Renderer} zurückgeben darf: einen Framework-Knoten
 * (Vue-VNode: `props` + `children`) und rohes Markup (String). Tiefe begrenzt, damit ein
 * zyklischer Baum den Lauf nicht aufhängt.
 */
export function collectActions(
  node: unknown,
  out: Set<string> = new Set(),
  depth = 0,
): Set<string> {
  if (depth > 64 || node === null || node === undefined) return out;

  if (typeof node === "string") {
    // HTML-Attributregeln statt "nur direkt anliegend und gequotet": Leerraum um
    // das `=`, einfache/doppelte Quotes und der unquotierte Fall sind alle gueltig.
    // Ein Renderer, der `<button data-action=toggle>` liefert, wurde sonst still
    // als display/partial abgewertet — der Waechter haette geschwiegen.
    const ATTR = /data-action\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
    for (const m of node.matchAll(ATTR)) {
      const action = m[1] ?? m[2] ?? m[3];
      if (action && action.length > 0) out.add(action);
    }
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectActions(child, out, depth + 1);
    return out;
  }
  if (typeof node !== "object") return out;

  const vnode = node as {
    type?: unknown;
    props?: Record<string, unknown> | null;
    children?: unknown;
  };
  const marked = vnode.props?.["data-action"];
  if (typeof marked === "string" && marked.length > 0) out.add(marked);

  // Komponenten-VNodes aufloesen: Ein Renderer darf seine Bedienelemente durch eine
  // Komponente ziehen (`h(ActionButton)`), deren Render-Funktion erst das Element mit
  // `data-action` erzeugt. Wer nur props/children des aeusseren VNode liest, sieht die
  // Aktion nie und stuft einen voll bedienbaren Skin auf display/partial herunter.
  const type = vnode.type;
  const render =
    typeof type === "function"
      ? (type as (props?: unknown, ctx?: unknown) => unknown)
      : type && typeof type === "object" && typeof (type as { render?: unknown }).render === "function"
        ? ((type as { render: (props?: unknown, ctx?: unknown) => unknown }).render)
        : undefined;
  if (render) {
    try {
      const slots = vnode.children;
      collectActions(render(vnode.props ?? {}, { slots, attrs: vnode.props ?? {} }), out, depth + 1);
    } catch {
      // Eine Komponente, die ohne echte Laufzeit nicht rendert, darf den Lauf nicht
      // kippen — sie bleibt schlicht ungemessen. `broken` ist dem Renderer selbst
      // vorbehalten, nicht unserer Unfaehigkeit, ihn zu instanziieren.
    }
  }

  if (vnode.children !== undefined) collectActions(vnode.children, out, depth + 1);
  return out;
}

/** Name einer Renderer-Funktion für die Herkunftsangabe im Report. */
function implName(render: Renderer): string {
  const name = (render as { name?: string }).name;
  return name && name.length > 0 ? name : "anonymous";
}

interface SurfaceRun {
  /** "tile:lightTile detail:LightDetail" — Fläche plus Implementierung. */
  readonly render: string;
  /** Die Fixture-Zustände, die durchliefen. */
  readonly states: string[];
  /** Jede über alle Flächen markierte `data-action`. */
  readonly marked: ReadonlySet<string>;
  readonly error?: string;
}

/**
 * Rendert jede Vertrags-Fixture des Typs headless durch jede vorhandene Renderer-Fläche.
 * Reine Funktionsaufrufe — Vue-`h()` braucht kein DOM. Wirft ein Renderer, ist der Typ
 * `broken` (Fehler, kein stilles Überspringen).
 */
function renderAll(type: CoreWidgetType, surfaces: readonly [string, Renderer][]): SurfaceRun {
  const states = FIXTURES[type] ?? {};
  const ctx = ctxStub();
  const marked = new Set<string>();
  const done = new Set<string>();
  const render = surfaces.map(([surface, fn]) => `${surface}:${implName(fn)}`).join(" ");

  for (const [surface, fn] of surfaces) {
    for (const state of Object.keys(states)) {
      const device = { type, id: `${type}.${state}`, ...states[state] } as never;
      try {
        collectActions(fn(device, tokensStub, ctx), marked);
        done.add(state);
      } catch (err: unknown) {
        return {
          render,
          states: [...done],
          marked,
          error: `${surface}/${state}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }
  return { render, states: Object.keys(states).filter((s) => done.has(s)), marked };
}

/* ------------------------------------------------------------ Klassifikation */

function classify(
  type: CoreWidgetType,
  manifest: SkinManifest,
  skin: SkinInput,
): SupportWidgetEntry {
  const declaredUnsupported = manifest.unsupported.includes(type);
  const entry = manifest.widgets[type];
  const tile = skin.tiles[type];
  const hasRenderer = typeof tile === "function";

  if (declaredUnsupported) {
    return { level: "unsupported", reason: "declared in manifest.unsupported" };
  }
  if (entry !== undefined && !hasRenderer) {
    return { level: "gap", reason: "declared in widgets but no tiles renderer" };
  }
  if (entry === undefined) {
    return hasRenderer
      ? { level: "gap", reason: "tiles renderer present but not declared in widgets" }
      : { level: "gap", reason: "neither rendered nor declared unsupported" };
  }

  // Jede Fläche, die dieser Skin für den Typ mitbringt — die Aktions-Achse misst über
  // alle: was ionic nur im Detail anbietet, ist trotzdem angeboten.
  const surfaces: [string, Renderer][] = [["tile", tile as Renderer]];
  const detail = skin.details?.[type];
  if (typeof detail === "function") surfaces.push(["detail", detail]);
  const preset = skin.presets?.[type];
  if (typeof preset === "function") surfaces.push(["preset", preset]);

  const run = renderAll(type, surfaces);
  const canonical = canonicalActions(type);
  const declared = new Set<string>(entry.actions);
  const tolerated = toleratedActions(type);

  if (run.error) {
    return { level: "broken", render: run.render, fixtures: run.states, reason: run.error };
  }

  // Tote Aktion (Goldene Regel 3): Was ein Skin deklariert UND markiert, der Vertrag
  // aber nicht kennt, kann der Host nicht dispatchen. Ein Tippfehler, den Manifest und
  // Renderer teilen (`toggel`), rutschte vorher durch — er galt als "deklariert", der
  // Typ wurde still auf display/partial gestuft und `hasGap` blieb false.
  const nonCanonical = [...declared].filter((a) => !canonical.includes(a) && !tolerated.has(a));
  if (nonCanonical.length > 0) {
    return {
      level: "broken",
      render: run.render,
      fixtures: run.states,
      reason: `declares action(s) the contract does not define: ${nonCanonical.sort().join(", ")}`,
    };
  }

  // Vortäuschungs-Prüfung (Goldene Regel 3): markiert der Renderer etwas, das weder
  // deklariert noch eine universelle Host-Aktion ist, ist der Skin in sich unstimmig.
  const undeclared = [...run.marked].filter((a) => !declared.has(a) && !tolerated.has(a));
  if (undeclared.length > 0) {
    return {
      level: "broken",
      render: run.render,
      fixtures: run.states,
      reason: `marks undeclared action(s): ${undeclared.sort().join(", ")}`,
    };
  }

  // Gemessen, nicht behauptet: nur was tatsächlich markiert wurde, zählt.
  const offered = canonical.filter((a) => run.marked.has(a));
  const actions = `${offered.length}/${canonical.length}`;

  const level =
    canonical.length === 0 || offered.length === 0
      ? "display"
      : offered.length === canonical.length
        ? "full"
        : "partial";

  const missing = canonical.filter((a) => !run.marked.has(a));
  const unbacked = [...declared].filter((a) => !run.marked.has(a)).sort();
  const notes = [
    missing.length > 0 ? `not offered: ${missing.join(", ")}` : "",
    // Ein Manifest-Eintrag, den keine Fixture markiert: hebt die Stufe nicht, wird
    // aber benannt — sonst bliebe die unbelegte Behauptung unsichtbar.
    unbacked.length > 0 ? `declared but never marked: ${unbacked.join(", ")}` : "",
  ].filter(Boolean);

  return {
    level,
    render: run.render,
    actions,
    fixtures: run.states,
    ...(notes.length > 0 ? { reason: notes.join("; ") } : {}),
  };
}

/**
 * Erzeugt den Konformitäts-Report für einen Skin. Kein I/O, kein State — die
 * Renderer werden rein funktional über die Vertrags-Fixtures aufgerufen.
 *
 * @param skin manifest.json + tiles-Renderer-Map des Skins
 * @param now  Zeitstempel-Quelle (injizierbar für deterministische Tests)
 */
export function generateSupport(
  skin: SkinInput,
  now: () => Date = () => new Date(),
): ConformanceResult {
  const { manifest } = skin;

  const widgets: Record<string, SupportWidgetEntry> = {};
  const summary: Summary = {
    full: 0,
    partial: 0,
    display: 0,
    unsupported: 0,
    gap: 0,
    broken: 0,
  };

  for (const type of CORE_WIDGET_TYPES) {
    const entry = classify(type, manifest, skin);
    widgets[type] = entry;
    summary[entry.level] += 1;
  }

  const report: SupportReport = {
    skin: manifest.name,
    targetsContract: manifest.targetsContract,
    // Nicht die eigene Zielversion zurückspiegeln: der Vertrag sagt, wo er steht.
    // So wird ein hinterherhinkender Skin im Artefakt selbst sichtbar.
    contractLatest: contractVersion,
    generatedAt: now().toISOString(),
    summary,
    widgets,
    layout: {
      model: manifest.layout.model,
      honors: manifest.layout.honors ?? [],
    },
  };

  const honors = checkHonors(skin);
  return { report, hasGap: summary.gap > 0 || summary.broken > 0 || honors.length > 0, honors };
}
