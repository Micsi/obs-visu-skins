// @obs-visu-skins/conformance — Konformitäts-Generator (ARCHITECTURE.md §2, CONTRACT-v1.md §8).
//
// Prüft einen Skin (manifest.json + Renderer-Maps) gegen die Vertrags-Kern-Typen und
// erzeugt einen `SupportReport` (support.json). Der Generator asseriert NIE selbst —
// und er glaubt dem Manifest nicht: die Stufe wird an dem gemessen, was die Renderer
// beim headless-Lauf über den Vertrags-Fixtures TATSÄCHLICH tun.
//
// Drei Achsen, alle gemessen:
//   • Render-Achse — jede Fixture jedes Typs wird durch jede vorhandene Renderer-
//     Fläche (tile · detail · preset) gejagt. Wirft eine, ist der Typ `broken`.
//   • Aktions-Achse — der zurückgegebene Baum wird nach `data-action` abgelaufen.
//     Gezählt wird, was der Renderer MARKIERT, nicht was das Manifest behauptet.
//     Ein Manifest-Eintrag ohne markierende Fixture hebt die Stufe daher nicht.
//   • Farb-Achse (Vertrag 1.13, `a11y.ts`) — das echte Stylesheet des Skins wird
//     gelesen, die Token werden aufgelöst und WCAG 2.1 darauf gerechnet, für jedes
//     Theme UND an den Extremen jeder farbwirksamen Tweak-Achse. Der Skin
//     deklariert nur die Semantik (Rolle · Grund · Ausnahme), die Werte misst der
//     Generator. Ohne Deklaration: `undeclared` — nicht `pass` (Goldene Regel 3).
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
import { measureA11y } from "./a11y.js";

// Die Fixture-Wand nutzt denselben Ctx-/Tokens-Stub wie dieser Lauf — Wand und
// support.json sollen dieselbe Prüfung zeigen, nicht zwei Nachbildungen.
export { ctxStub, tokensStub, pageHostProbe } from "./stubs.js";
// Die Farb-Achse liegt in a11y.ts, wird aber von hier mit-exportiert: wer den
// Generator benutzt, soll nicht wissen muessen, dass sie in einer zweiten Datei steht.
export {
  measureA11y,
  THRESHOLDS,
  A11Y_ROLES,
  contrast,
  composite,
  luminance,
  resolveColor,
  resolveNumber,
  tokensFor,
  parseRules,
  declarations,
  plainDeclarations,
  allPlainDeclarations,
  type A11yInput,
  type Rgba,
} from "./a11y.js";

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
  /**
   * Der Quelltext jedes in `manifest.a11y.stylesheet` genannten Stylesheets,
   * nach dem deklarierten Pfad geschluesselt (Vertrag 1.13). Das Lesen macht der
   * Aufrufer — `generateSupport` bleibt damit rein und ohne Dateisystem testbar.
   * Fehlt eine Quelle, ist das ein BEFUND in `a11y.findings`, kein stiller Erfolg.
   */
  readonly styles?: Readonly<Record<string, string>>;
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
 *  - `unmeasured`   - der Lauf konnte die Achse NICHT messen (keine DOM-fähige
 *                     Vue-Laufzeit). Bewusst ein Befund und kein stilles Bestehen:
 *                     sonst genügte es, den Generator falsch aufzurufen, um eine
 *                     Deklaration ungeprüft durchzubringen.
 *  - `broken`       - der Page-Renderer WIRFT. Das fällt sonst nirgends auf: die
 *                     Render-Achse fährt `tiles`/`details`/`presets`, aber nie
 *                     `skin.page`. Ein Skin mit kaputtem Ganzseiten-Renderer bekam
 *                     einen sauberen Report, solange er `link` nicht deklarierte.
 *  - `undeclared`   - die GEGENRICHTUNG: der Page-Renderer zeichnet den Sprung,
 *                     das Manifest deklariert ihn aber nicht. Der Host tritt nur
 *                     bei deklariertem Token zurueck, also liegen dann ZWEI
 *                     Affordanzen uebereinander - zwei Klickflaechen, zwei
 *                     Fokusstopps, und die eine sagt womoeglich etwas anderes als
 *                     die andere. Ein vergessenes Token ist damit kein
 *                     Schoenheitsfehler, sondern doppelte Bedienung.
 */
export interface HonorsFinding {
  readonly token: string;
  readonly problem:
    | "unknown"
    | "undelivered"
    | "unrenderable"
    | "undeclared"
    | "unmeasured"
    | "broken";
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
 *
 * `async`, und das ist keine Kosmetik: ein Klick-Handler darf `followLink` hinter
 * einem `await` rufen (erst fragen, dann springen). Ein synchroner Probelauf sah
 * davon nichts und meldete `undelivered` - er hätte einen konformen Skin
 * abgelehnt. Der Lauf wartet deshalb auf das, was ein Handler zurückgibt, bevor
 * er urteilt.
 */
export async function checkHonors(skin: SkinInput): Promise<HonorsFinding[]> {
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
      const outcome = await probeLinkDelivery(skin.page, probe);
      if (outcome === "threw") {
        findings.push({
          token: "link",
          problem: "broken",
          detail: "der Page-Renderer wirft beim Zeichnen - er kann gar keine Affordanz liefern",
        });
      } else if (outcome === "unmeasured") {
        // NICHT stillschweigend bestehen lassen. Ein Lauf ohne DOM-fähige
        // Vue-Laufzeit misst nichts; das als Erfolg zu werten hiesse, dass ein
        // falscher Aufruf des Generators jede Deklaration ungeprüft durchbringt.
        findings.push({
          token: "link",
          problem: "unmeasured",
          detail:
            "keine DOM-faehige Vue-Laufzeit - die Achse wurde NICHT geprueft (ensureDom() vor dem Skin-Import aufrufen)",
        });
      } else if (outcome === "absent") {
        findings.push({
          token: "link",
          problem: "undelivered",
          detail:
            "der Page-Renderer zeichnet keine aktivierbare Sprung-Affordanz (kein Klick im gerenderten DOM ruft host.followLink)",
        });
      }
    }
  } else if (skin.page) {
    // Die GEGENRICHTUNG, und sie ist genauso teuer wie die andere: der Host tritt
    // mit seiner eigenen Sprung-Affordanz nur zurueck, wenn das Token deklariert
    // ist. Zeichnet der Skin den Sprung trotzdem, liegen zwei Klickflaechen und
    // zwei Fokusstopps uebereinander. Ein vergessenes Token faellt sonst nirgends
    // auf - der Lauf blieb sauber, gerade WEIL nicht gemessen wurde.
    const probe = pageHostProbe();
    const outcome = await probeLinkDelivery(skin.page, probe, "any");
    if (outcome === "delivered") {
      findings.push({
        token: "link",
        problem: "undeclared",
        detail:
          "der Page-Renderer zeichnet einen Sprung (ein Klick ruft host.followLink), aber layout.honors nennt 'link' nicht - der Host tritt nicht zurueck und beide Affordanzen liegen uebereinander",
      });
    } else if (outcome === "threw") {
      // Auch OHNE Deklaration ein Befund: die Render-Achse fährt `skin.page` nie,
      // ein kaputter Ganzseiten-Renderer bliebe sonst unentdeckt.
      findings.push({
        token: "link",
        problem: "broken",
        detail: "der Page-Renderer wirft beim Zeichnen",
      });
    }
    // `unmeasured` ist hier KEIN Befund: ohne Deklaration ist nichts versprochen,
    // was ungeprüft bliebe.
  }

  return findings;
}

/**
 * Der `honors: link`-Probelauf: die Seite wird ECHT gerendert und ECHT geklickt.
 *
 * Die Vorgängerfassung baute Vues Verhalten nach — sie lief den VNode-Baum ab,
 * sammelte `onClick`-Props und rief sie selbst auf. Das war eine Nachbildung, und
 * jede Review-Runde fand die nächste Stelle, an der sie vom Original abwich:
 * Ereignis-Modifikatoren im Prop-Namen, Listener-Arrays aus `mergeProps` und ihre
 * `stopImmediatePropagation`-Semantik, `setup()`-Komponenten ohne `render`,
 * Komponenten-Emits gegenüber Attribut-Fallthrough, `inheritAttrs: false`,
 * Slot-Kinder, die der Renderer gar nicht einsetzt, das Ereignis-Ziel mit seinem
 * `dataset`. Jede dieser Regeln ist Vue-Wissen, und die Liste hat kein Ende.
 *
 * Deshalb übernimmt Vue sie wieder selbst: `createApp(...).mount()` in ein echtes
 * Dokument, dann ein echtes `MouseEvent` auf jedes Element. Damit stimmen alle
 * genannten Punkte per Konstruktion — und ein paar Fälle, die die Nachbildung
 * gar nicht sehen konnte, kommen gratis dazu: ein `disabled` Button verschluckt
 * seinen Klick genau wie im Browser, und Bubbling erreicht die Handler der
 * Vorfahren in der richtigen Reihenfolge.
 *
 * Gemessen wird: ein Klick auf ein für einen NUTZER erreichbares Element führt zu
 * `host.followLink` MIT dem Ziel des gestellten Items. Beide Verschärfungen sind
 * nachgetragen — der blosse Aufruf nahm auch einen festverdrahteten Fremdlink ab,
 * und `dispatchEvent` umging die Unterdrückung des Browsers und aktivierte auch
 * ein `disabled` Steuerelement.
 *
 * NICHT geprüft (und nicht behauptet) ist, ob die Affordanz sichtbar oder
 * fokussierbar ist — das bleibt Sache der Specs des Skins.
 *
 * PROGRAMMATISCHE NUTZUNG: wer `generateSupport` direkt aufruft, muss
 * {@link ensureDom} ausführen, BEVOR ein Vue-Skin importiert wird — `cli.ts` tut
 * genau das. Sonst hat `@vue/runtime-dom` sich bereits `document: null` gemerkt.
 * Der Fall wird erkannt (siehe den Kanarienvogel in `domRuntime`) und als
 * `unmeasured` gemeldet, nicht als Mangel des Skins.
 */
async function probeLinkDelivery(
  page: NonNullable<SkinInput["page"]>,
  probe: ReturnType<typeof pageHostProbe>,
  /**
   * Wie viel gezeichnet sein muss, damit der Lauf `delivered` meldet.
   *
   * `"all"` fuer die DEKLARIERTE Richtung: wer `honors: link` sagt, laesst den Host
   * bei JEDEM verlinkten Element zurueckreten, also muss auch jedes eine Affordanz
   * bekommen. `"any"` fuer die GEGENRICHTUNG: dort ist schon EIN gezeichneter
   * Sprung der Befund — er ueberlagert die Affordanz, die der Host mangels
   * Deklaration weiterhin selbst zeichnet. Mit demselben strengen Praedikat blieb
   * genau dieser Fall stumm.
   */
  need: "all" | "any" = "all",
): Promise<"delivered" | "absent" | "threw" | "unmeasured"> {
  const vue = await domRuntime();
  // Ohne DOM-Laufzeit wird NICHT gemessen — und damit auch nichts behauptet.
  // Bewusst ein EIGENER Zustand statt eines gutmütigen `true`: seit auch die
  // Gegenrichtung geprüft wird, wäre jede der beiden Antworten in einer Richtung
  // ein Fehlurteil — "geliefert" erfände ein `undeclared`, "nicht geliefert" ein
  // `undelivered`. Nicht messen heisst: nichts behaupten.
  if (!vue) return "unmeasured";

  // Der Stand des Bodys VOR dem Mount. Alles, was danach dazukommt, gehört zu
  // diesem Lauf — und nur das wird geklickt und am Ende wieder abgeräumt.
  const container = document.createElement("div");
  const before = new Set<Element>(Array.from(document.body.children));
  document.body.appendChild(container);
  const app = vue.createApp({ render: () => page(probe.host) });
  const cleanup = () => {
    try {
      app.unmount();
    } catch {
      /* der Abbau gehört nicht zur Messung */
    }
    container.remove();
    // Was der Lauf ausserhalb des Containers hinterlassen hat, geht mit. Vue
    // räumt Teleport-Ziele beim `unmount` heute selbst ab — die Specs unten
    // bestehen auch ohne diese Schleife, das ist nachgefahren. Sie bleibt als
    // Zusicherung dieses Laufs stehen, nicht als Reparatur: dass das Dokument
    // unverändert zurückbleibt, ist die Bedingung dafür, dass das Gate drei Skins
    // nacheinander im selben Dokument messen kann.
    for (const el of Array.from(document.body.children)) {
      if (!before.has(el)) el.remove();
    }
  };
  try {
    app.mount(container);
  } catch {
    // Ein Wurf ist NICHT dasselbe wie "zeichnet nichts": der Renderer ist kaputt,
    // und das gehört gemeldet, auch wenn der Skin `link` gar nicht deklariert —
    // die Render-Achse fährt `skin.page` nie, es fiele sonst nirgends auf.
    // Aufgeräumt wird trotzdem: ein Wurf MITTEN im Mounten lässt eine halb
    // gemountete Anwendung zurück, deren Knoten sonst im Dokument stehen bleiben.
    cleanup();
    return "threw";
  }

  // ZWEI PHASEN: was der Renderer beim ZEICHNEN am Host fragt, wird verworfen;
  // gezählt wird nur, was ein KLICK auslöst. Ohne diesen Schnitt bestünde ein
  // Renderer, der `followLink` schon beim Rendern ruft und nichts zeichnet — im
  // Browser wäre er kaputt: er navigierte beim blossen Anzeigen der Seite.
  //
  // Der Schnitt kommt NACH der aufgeschobenen Mount-Arbeit, und das ist der
  // Unterschied zwischen einer Trennung und ihrem Anschein: `app.mount()` kehrt
  // zurück, bevor ein `onMounted(async () => { await …; host.followLink(l) })`
  // fortsetzt. Lag `reset()` davor, landete genau dieser Aufruf im Protokoll und
  // wurde später als Klick-Beleg gelesen — der Renderer bestand also mit exakt
  // dem Verhalten, das der Schnitt ausschliessen soll.
  await drain(probe);
  probe.reset();

  const deadline = Date.now() + PROBE_BUDGET_MS;

  // Was der Probelauf als GELIEFERT anerkennt: `followLink` mit dem Ziel JEDES
  // gestellten Items. Zwei Verschärfungen stecken darin:
  //
  //  - Der blosse Aufruf genügt nicht. Ein Renderer, der die verlinkten
  //    `LayerItem`s ignoriert und eine eigene Fläche mit festverdrahtetem Ziel
  //    zeichnet, ruft `followLink` ebenfalls; der Host zöge daraufhin seine
  //    Affordanz zurück, während die Ziele der Items nirgends erreichbar wären.
  //  - ALLE Formen, nicht irgendeine. Der Probelauf stellt einen markierten, einen
  //    gewöhnlichen (ohne `activeIndicator`, der dokumentierte Default) und einen
  //    PIN-geschützten Link. Ein Renderer, der nur für markierte oder nur für
  //    frei erreichbare Ziele zeichnet, liess die übrigen ohne Affordanz — und der
  //    Host ist bei allen zurückgetreten.
  const reached = (t: string) => probe.followedTargets.includes(t);
  const hit = () =>
    need === "all" ? probe.probeTargets.every(reached) : probe.probeTargets.some(reached);

  // Geklickt wird, was ein NUTZER anfassen kann. `dispatchEvent` umgeht die
  // Unterdrückung des Browsers und ruft auch Handler auf einem `disabled`
  // Steuerelement oder in einem `inert`-Teilbaum — der Probelauf nähme dann eine
  // Affordanz ab, die niemand aktivieren kann. `click()` geht den regulären Weg,
  // und was ohnehin unbedienbar ist, wird vorher aussortiert.
  const activate = (el: Element): void => {
    if (isUnreachable(el)) return;
    (el as HTMLElement).click();
  };

  // Ein Schnappschuss reicht nicht: `defineAsyncComponent`, `Suspense` oder eine
  // Komponente, die sich nach dem Mount aktualisiert, bringt ihre Affordanz erst
  // danach ins DOM. Es wird deshalb wiederholt eingesammelt und geklickt, bis das
  // Ziel getroffen ist, nichts Neues mehr auftaucht oder das Budget endet.
  const clicked = new Set<Element>();
  while (!hit() && Date.now() < deadline) {
    const fresh = roots(container, before).filter((el) => !clicked.has(el));
    for (const el of fresh) {
      clicked.add(el);
      if (hit() || Date.now() > deadline) break;
      try {
        activate(el);
      } catch {
        /* ein werfender Handler liefert keine Affordanz - zählt als nichts */
      }
    }
    if (hit()) break;
    // Nichts Neues UND nichts mehr in der Warteschlange: ein weiterer Durchlauf
    // fände dasselbe. Ein Handler darf `followLink` hinter einem `await` rufen,
    // deshalb wird vorher noch kurz abgewartet (siehe {@link SETTLE_MS}).
    const settleUntil = Math.min(Date.now() + SETTLE_MS, deadline);
    let grew = false;
    while (!hit() && Date.now() < settleUntil && !grew) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      grew = roots(container, before).some((el) => !clicked.has(el));
    }
    if (!grew && !hit()) break;
  }

  const delivered = hit();
  cleanup();
  return delivered ? "delivered" : "absent";
}


/** Wie lange die Mount-Arbeit ruhig sein muss, bevor der Phasenschnitt faellt. */
const MOUNT_QUIET_MS = 120;
/** Obergrenze fuer das Abfliessen der Mount-Arbeit. */
const MOUNT_DRAIN_MS = 600;

/**
 * Laesst die aufgeschobene Mount-Arbeit abfliessen — bis RUHE, nicht fuer eine
 * feste Zahl von Runden.
 *
 * Drei Null-Timer reichten nur fuer Mikrotasks. Ein `onMounted(async () => { await
 * delay(50); host.followLink(l) })` kam erst danach — der Phasenschnitt lag also
 * davor, der Aufruf landete waehrend der Klick-Phase im Protokoll und galt als
 * Beleg. Der Renderer bestand mit genau dem Verhalten, das der Schnitt
 * ausschliessen soll: navigieren beim blossen Anzeigen.
 *
 * Gewartet wird deshalb, bis das Protokoll {@link MOUNT_QUIET_MS} lang unveraendert
 * bleibt, hoechstens aber {@link MOUNT_DRAIN_MS}. Das ist eine Verbesserung, keine
 * Garantie: ein Renderer, der noch spaeter von selbst navigiert, ist von einem
 * Klick-Effekt zeitlich nicht mehr zu trennen. Diese Grenze ist bewusst benannt
 * statt stillschweigend in Kauf genommen.
 */
async function drain(probe: { readonly linkCalls: readonly string[] }): Promise<void> {
  const until = Date.now() + MOUNT_DRAIN_MS;
  let seen = probe.linkCalls.length;
  let quietSince = Date.now();
  while (Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (probe.linkCalls.length !== seen) {
      seen = probe.linkCalls.length;
      quietSince = Date.now();
    } else if (Date.now() - quietSince >= MOUNT_QUIET_MS) {
      return;
    }
  }
}

/**
 * Ob ein Element für einen Nutzer unerreichbar ist.
 *
 * `disabled` verschluckt den Klick im Browser, und ein `inert`-Teilbaum ist weder
 * klickbar noch fokussierbar. Beides wird hier ausdrücklich geprüft statt sich auf
 * die Laufzeit zu verlassen: jsdom bildet `inert` nicht ab, und ein Probelauf, der
 * eine unbedienbare Fläche als Affordanz abnimmt, misst das Gegenteil dessen, was
 * die Deklaration verspricht.
 */
function isUnreachable(el: Element): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (n.hasAttribute("inert")) return true;
    if (n.hasAttribute("disabled")) return true;
    if (n.getAttribute("aria-disabled") === "true") return true;
  }
  return false;
}

/**
 * Alle Elemente, die der Probelauf anfassen darf: der Container UND das, was die
 * Anwendung ausserhalb davon gemountet hat.
 *
 * `Teleport` ist der Regelfall dafür — eine Overlay-Fläche wandert nach
 * `document.body`. Wer nur `container` absucht, findet die Affordanz eines
 * völlig gültigen Renderers nicht und meldet ihn als `undelivered`. Gesucht wird
 * deshalb auch im Wurzelelement der Anwendung, aber NICHT im übrigen Dokument:
 * fremde Steuerelemente anderer Läufe gehen den Probelauf nichts an.
 */
function roots(container: Element, before: ReadonlySet<Element>): Element[] {
  const out = new Set<Element>(Array.from(container.querySelectorAll("*")));
  for (const el of Array.from(document.body.children)) {
    // Teleport-Ziele hängen als Geschwister des Containers am Body — sie gehören
    // dazu. Aber NUR das, was dieser Mount erzeugt hat: `before` ist der Stand des
    // Bodys VOR dem Mount. Ohne diesen Vergleich sammelte der Lauf alles ein, was
    // noch dort stand, und das Gate fährt drei Skins nacheinander im SELBEN
    // Dokument — Skin B hätte die Reste von Skin A mitgeklickt und deren
    // `followLink` als eigene Affordanz gezählt.
    if (el === container || el.contains(container) || before.has(el)) continue;
    out.add(el);
    for (const inner of Array.from(el.querySelectorAll("*"))) out.add(inner);
  }
  // TIEFSTE ZUERST. `querySelectorAll` liefert Vorfahren vor ihren Nachfahren, und
  // das verbrauchte zustandsbehaftete Listener: ein gültiger delegierter
  // `onClickOnce` am Wrapper, der nur folgt, wenn `event.target.closest(...)`
  // trifft, wurde vom Klick auf den Wrapper selbst aufgezehrt — der spätere Klick
  // auf den Knopf erreichte ihn nicht mehr, obwohl ein Nutzer genau dort zuerst
  // klickt. Von innen nach aussen zu klicken trifft die Reihenfolge, in der ein
  // echter Klick durch den Baum läuft (Ziel zuerst, dann die Vorfahren per
  // Bubbling).
  return Array.from(out).sort((a, b) => depth(b) - depth(a));
}

/** Wie tief ein Element im Dokument haengt (fuer die Klick-Reihenfolge). */
function depth(el: Element): number {
  let n = 0;
  for (let p = el.parentElement; p; p = p.parentElement) n += 1;
  return n;
}

/**
 * Zeitbudget für die GANZE Klick-Phase eines Skins — nicht pro Handler.
 *
 * Der Probelauf ruft fremden Code. Ein Deckel je Handler skaliert nicht: hundert
 * Handler, deren Versprechen nie eintreffen, summierten sich auf Minuten und
 * liefen genau in den CI-Timeout, den der Deckel verhindern soll.
 */
const PROBE_BUDGET_MS = 3000;

/**
 * Nachlauf, nachdem alle Klicks gefeuert sind.
 *
 * Ein Handler darf `followLink` hinter einem `await` rufen — dafür muss die
 * Warteschlange noch abfliessen. Bewusst KURZ und getrennt vom Gesamtbudget: der
 * Host-Stub antwortet sofort, es gibt hier nichts, worauf ein konformer Renderer
 * lange warten müsste. Das ganze Budget hier abzuwarten hiesse, jeden Skin OHNE
 * Link volle drei Sekunden zu bestrafen — bei drei Skins im Gate reine Wartezeit.
 */
const SETTLE_MS = 250;

/**
 * Stellt eine DOM-Umgebung bereit und liefert Vues `createApp` dazu.
 *
 * Unter vitest (`environment: "jsdom"`) steht das DOM schon; im CLI wird es hier
 * aufgezogen. Die Reihenfolge ist nicht verhandelbar: `@vue/runtime-dom` greift
 * `document` beim MODUL-LADEN ab, deshalb wird Vue erst NACH den Globals
 * importiert (dynamisch), nie oben im Datei-Kopf.
 */
export async function ensureDom(): Promise<boolean> {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.document === "undefined") {
    let JSDOM: typeof import("jsdom").JSDOM;
    try {
      ({ JSDOM } = await import("jsdom"));
    } catch {
      return false;
    }
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
    });
    const w = dom.window as unknown as Record<string, unknown>;
    g.window = w;
    g.document = w.document;
    for (const name of [
      "Node",
      "Element",
      "HTMLElement",
      "SVGElement",
      "Text",
      "Comment",
      "DocumentFragment",
      "Event",
      "MouseEvent",
      "CustomEvent",
      "navigator",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ]) {
      if (g[name] === undefined && w[name] !== undefined) g[name] = w[name];
    }
  }
  return true;
}

/**
 * Die DOM-Umgebung plus Vues `createApp`.
 *
 * Vue wird DYNAMISCH geladen, und erst hier: `@vue/runtime-dom` greift `document`
 * beim Modul-Laden ab. Wer Vue vorher importiert (ein Skin etwa, den das CLI
 * nachlädt), bekommt eine Laufzeit ohne Dokument — deshalb ruft `cli.ts`
 * {@link ensureDom} auf, BEVOR es den Skin importiert.
 */
async function domRuntime(): Promise<{ createApp: typeof import("vue").createApp } | null> {
  if (!(await ensureDom())) return null;
  const vue = await import("vue");
  // KANARIENVOGEL. Ein dynamischer Import liefert das Modul aus dem Cache — wer
  // einen Vue-Skin STATISCH importiert, bevor {@link ensureDom} lief (der
  // dokumentierte programmatische Weg an `cli.ts` vorbei), bekommt hier eine
  // Laufzeit, die sich `document: null` gemerkt hat. Ihr `mount()` wirft, und der
  // Wurf sähe aus wie ein Renderer, der nichts zeichnet: ein voll konformer Skin
  // wäre als `undelivered` gemeldet worden.
  //
  // Ein triviales `div` klärt das vorab und kostet nichts. Wirft es, wird NICHT
  // gemessen — und damit nichts behauptet.
  const canary = document.createElement("div");
  try {
    const probeApp = vue.createApp({ render: () => vue.h("div") });
    probeApp.mount(canary);
    probeApp.unmount();
  } catch {
    return null;
  }
  return vue;
}

/**
 * Die Props, wie die Komponente sie SIEHT — nicht der rohe Prop-Beutel des VNode.
 *
 * Beim Instanziieren wendet Vue die Deklaration an: fehlende Props bekommen ihren
 * `default`, ein deklariertes `Boolean` ohne Wert wird zu `false` und mit leerem
 * String zu `true`. Nichts davon geschah hier, und der Unterschied ist messbar: eine
 * Aktions-Komponente, deren weggelassenes `enabled` per Deklaration `true` wäre,
 * bekam `undefined`, zeichnete ihr `data-action` nicht — und eine tatsächlich
 * angebotene Aktion rutschte von `full` auf `partial` oder `display`.
 *
 * Bewusst nur die Deklaration, kein Mount: die Aktions-Achse jagt Hunderte Fixtures
 * durch die Renderer, ein Mount je Fixture wäre zu teuer (siehe den Doc-Block oben).
 *
 * ══ Und damit ist dies ein NACHBAU, mit allem, was daran hängt
 *
 * Dieselbe Bauart, die der `honors`-Probelauf hinter sich hat: dort wurde aus dem
 * Auflösen von Hand eine Kette von Abweichungen gegenüber dem Original, und erst
 * `createApp().mount()` hat sie beendet. Hier ist die Fläche kleiner — es geht nur um
 * die Prop-Auflösung —, aber sie ist nicht endlich: `validator`, `required`, `mixins`,
 * `extends`, Symbol-Typen und die `attrs`-Trennung stehen alle noch draussen.
 *
 * Was hier nachgebildet ist, ist deshalb ausdrücklich benannt: Defaults (inklusive
 * Fabrik MIT rohen Props), `Boolean`-Auflösung inklusive Vues reihenfolgeabhängiger
 * `shouldCastTrue`-Regel. Alles andere fehlt, und wenn diese Fläche noch einmal
 * Befunde derselben Klasse sammelt, ist die Antwort nicht die nächste Regel, sondern
 * der Umbau auf einen echten Mount (obs-visu-skins#48).
 */
function normalizeProps(
  raw: Record<string, unknown>,
  declared: unknown,
): Record<string, unknown> {
  if (!declared || typeof declared !== "object") return raw;
  const out: Record<string, unknown> = { ...raw };
  // Array-Form (`props: ['a','b']`) trägt keine Defaults — nichts zu tun.
  if (Array.isArray(declared)) return out;
  for (const [name, spec] of Object.entries(declared as Record<string, unknown>)) {
    const given = out[name];
    const type = spec && typeof spec === "object" ? (spec as { type?: unknown }).type : spec;
    const types = Array.isArray(type) ? type : [type];
    const booleanAt = types.indexOf(Boolean);
    const stringAt = types.indexOf(String);
    const isBoolean = booleanAt >= 0;
    /**
     * Vues `shouldCastTrue` — und es hängt an der REIHENFOLGE der Union.
     *
     * Bei `{ type: [String, Boolean] }` bleibt ein leerer String ein leerer String,
     * weil `String` vorne steht; erst bei `[Boolean, String]` wird er zu `true`.
     * Ohne diese Regel meldete die Aktions-Achse eine Aktion, die die montierte
     * Anwendung nicht zeichnet: eine Komponente, die `data-action` nur bei striktem
     * `true` ausgibt, bekam hier ein erfundenes `true`.
     */
    const castsEmptyToTrue = isBoolean && (stringAt < 0 || booleanAt < stringAt);
    if (given === undefined) {
      const def =
        spec && typeof spec === "object" ? (spec as { default?: unknown }).default : undefined;
      if (def !== undefined) {
        // Objekt-/Array-Defaults liefert Vue über eine Fabrik, damit Instanzen sie
        // nicht teilen — und die Fabrik bekommt die ROHEN Props als Argument
        // (`default(rawProps) { return rawProps.kind === "switch" }`). Ohne das warf
        // eine solche Fabrik, und `renderAll` hielt das Widget für `broken`.
        out[name] =
          typeof def === "function" && type !== Function
            ? (def as (props: Record<string, unknown>) => unknown)(raw)
            : def;
      } else if (isBoolean) {
        // Ein deklariertes Boolean ohne Wert ist `false`, nicht `undefined`.
        out[name] = false;
      }
    } else if (castsEmptyToTrue && given === "") {
      // `<C enabled>` kommt als leerer String an und bedeutet `true`.
      out[name] = true;
    }
  }
  return out;
}

/**
 * Rendert einen Komponenten-VNode aus, falls es einer ist.
 *
 * Ein Renderer darf seine Elemente durch eine Komponente ziehen
 * (`h(PageComponent, { host })`); erst deren Render-Funktion erzeugt das Markup.
 * Wer nur `props`/`children` des äusseren VNode liest, sieht davon nichts.
 *
 * Nur noch für die AKTIONS-Achse ({@link collectActions}): die sucht `data-action`
 * im zurückgegebenen Baum und arbeitet bewusst ohne DOM, weil sie jede Fixture
 * jedes Typs durch jede Renderer-Fläche jagt — Hunderte Läufe, für die ein Mount
 * je Fixture zu teuer wäre. Der `honors`-Probelauf ist genau diesen Weg gegangen
 * und wieder abgebogen: dort wurde aus dem Auflösen ein Nachbau von Vues
 * Semantik, den {@link probeLinkDelivery} jetzt Vue selbst überlässt.
 *
 * Wirft die Komponente ohne echte Laufzeit, bleibt sie schlicht ungemessen —
 * `broken` ist dem Renderer selbst vorbehalten, nicht unserer Unfähigkeit, ihn
 * zu instanziieren.
 */
function expandComponent(vnode: { type?: unknown; props?: unknown; children?: unknown }): unknown {
  const type = vnode.type;
  const raw = (vnode.props ?? {}) as Record<string, unknown>;
  const slots = vnode.children;
  const options = type && typeof type === "object" ? (type as Record<string, unknown>) : undefined;
  const props = normalizeProps(raw, options?.props);
  const ctx = { slots, attrs: raw, emit: () => {}, expose: () => {} };

  // Die HÄUFIGSTE Komponentenform der Composition API — `defineComponent({ setup()
  // { return () => h(…) } })` — hat WEDER einen aufrufbaren `type` NOCH ein
  // `type.render`, solange Vue keine Instanz gebaut hat. Der Zweig gab hier
  // `undefined` zurück, der Teilbaum blieb ungeprüft, und ein funktionierender
  // Link in genau dieser Form galt als `undelivered`.
  //
  // `setup()` liefert entweder die Render-Funktion selbst (der Fall oben) oder ein
  // Objekt mit Bindungen — dann rendert `type.render` mit diesen Bindungen als
  // `this`. Beides wird bedient; wirft `setup` ohne echte Laufzeit, bleibt die
  // Komponente ungemessen wie bisher.
  let setupRender: ((props?: unknown, ctx?: unknown) => unknown) | undefined;
  let setupState: Record<string, unknown> | undefined;
  if (options && typeof options.setup === "function") {
    try {
      const produced = (options.setup as (p: unknown, c: unknown) => unknown)(props, ctx);
      if (typeof produced === "function") {
        setupRender = produced as (props?: unknown, ctx?: unknown) => unknown;
      } else if (produced && typeof produced === "object") {
        setupState = produced as Record<string, unknown>;
      }
    } catch {
      /* ungemessen, nicht `broken` - siehe oben */
    }
  }

  const render =
    setupRender ??
    (typeof type === "function"
      ? (type as (props?: unknown, ctx?: unknown) => unknown)
      : options && typeof options.render === "function"
        ? (options.render as (props?: unknown, ctx?: unknown) => unknown)
        : undefined);
  if (!render) return undefined;
  // Der `this`-Stellvertreter für die Options-API. Vue ruft `render()` dort mit
  // dem Komponenten-Proxy, über den `this.host`, `this.$props` usw. laufen. Als
  // nackte Funktion aufgerufen warf so ein `render()` an seiner ersten Zeile,
  // die Ausnahme galt als leerer Teilbaum, und der Skin fiel als `undelivered`
  // durch — dieselbe Fehlalarm-Klasse wie ein Handler ohne Ereignis-Argument.
  // Ein Proxy wäre hier falsch: er beantwortete JEDEN Namen und verschöbe damit
  // das Verhalten des Renderers; der Stellvertreter reicht genau die Props durch,
  // die der VNode mitbringt.
  const self = {
    ...props,
    // Die Bindungen aus `setup()`, falls es welche statt einer Render-Funktion
    // lieferte: `type.render` greift dort über `this` darauf zu.
    ...(setupState ?? {}),
    $props: props,
    $attrs: props,
    $slots: slots ?? {},
    $emit: () => {},
  };
  try {
    return render.call(self, props, ctx);
  } catch {
    return undefined;
  }
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
  // Dieselbe Aufloesung benutzt der `honors`-Probelauf ({@link expandComponent}).
  const expanded = expandComponent(vnode);
  if (expanded !== undefined) collectActions(expanded, out, depth + 1);

  if (vnode.children !== undefined) collectActions(vnode.children, out, depth + 1);
  return out;
}

/**
 * Die INLINE-Stile, die ein gerenderter Baum trägt — `style`-Props und `style="…"` in
 * rohem Markup.
 *
 * Die Farb-Achse sieht sonst nur die Stylesheets. Ein Renderer, der
 * `style: { color: "#777" }` über eine helle Fläche legt, konnte damit eine
 * unbeteiligte, bestandene Palette deklarieren und trotzdem `a11y.status: "pass"`
 * bekommen — die Farbe stand in keinem Blatt, also sah niemand sie.
 *
 * Gesammelt wird die Deklaration in derselben Form, in der auch ein Blatt sie führt
 * (`prop: value`), damit die Farb-Achse sie mit demselben eigenschaftsbewussten Scan
 * beurteilt: was eine Farbe an einer Farb-Eigenschaft ist, ist ein Befund; ein
 * `var(--token)` auf einen klassifizierten Token ist in Ordnung.
 */
export function collectInlineStyles(
  node: unknown,
  out: Set<string> = new Set(),
  depth = 0,
): Set<string> {
  if (depth > 64 || node === null || node === undefined) return out;

  if (typeof node === "string") {
    // Rohes Markup: `style="…"` mit den drei gültigen Quotierungen.
    const ATTR = /style\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    for (const m of node.matchAll(ATTR)) {
      const decls = m[1] ?? m[2] ?? "";
      for (const part of decls.split(";")) if (part.includes(":")) out.add(part.trim());
    }
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectInlineStyles(child, out, depth + 1);
    return out;
  }
  if (typeof node !== "object") return out;

  const vnode = node as { props?: Record<string, unknown> | null; children?: unknown };

  // Rohes Markup steht bei Vue in einem String-PROP (`innerHTML`), nicht in den
  // Kindern — dort escapt Vue es. Jeder String-Prop wird deshalb mitgelesen; der
  // Regex greift nur auf `style="…"`, ein Fehlalarm ist also nicht zu befürchten.
  for (const [name, value] of Object.entries(vnode.props ?? {})) {
    if (name === "style" || typeof value !== "string") continue;
    collectInlineStyles(value, out, depth + 1);
  }

  const style = vnode.props?.["style"];
  if (typeof style === "string") {
    for (const part of style.split(";")) if (part.includes(":")) out.add(part.trim());
  } else if (style !== null && typeof style === "object") {
    for (const [prop, value] of Object.entries(style as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      // Vue erlaubt camelCase; das Blatt kennt nur die Bindestrich-Form.
      const dashed = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      out.add(`${dashed}: ${String(value)}`);
    }
  }

  const expanded = expandComponent(vnode as never);
  if (expanded !== undefined) collectInlineStyles(expanded, out, depth + 1);
  if (vnode.children !== undefined) collectInlineStyles(vnode.children, out, depth + 1);
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
function renderAll(
  type: CoreWidgetType,
  surfaces: readonly [string, Renderer][],
  inlineStyles?: Set<string>,
): SurfaceRun {
  const states = FIXTURES[type] ?? {};
  const ctx = ctxStub();
  const marked = new Set<string>();
  const done = new Set<string>();
  const render = surfaces.map(([surface, fn]) => `${surface}:${implName(fn)}`).join(" ");

  for (const [surface, fn] of surfaces) {
    for (const state of Object.keys(states)) {
      const device = { type, id: `${type}.${state}`, ...states[state] } as never;
      try {
        const tree = fn(device, tokensStub, ctx);
        collectActions(tree, marked);
        if (inlineStyles) collectInlineStyles(tree, inlineStyles);
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
  inlineStyles?: Set<string>,
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

  const run = renderAll(type, surfaces, inlineStyles);
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
 * `async`, weil die `honors`-Achse einen Klick-Handler auch dann noch zählt, wenn
 * er `followLink` erst nach einem `await` ruft ({@link checkHonors}).
 *
 * @param skin manifest.json + tiles-Renderer-Map des Skins
 * @param now  Zeitstempel-Quelle (injizierbar für deterministische Tests)
 */
export async function generateSupport(
  skin: SkinInput,
  now: () => Date = () => new Date(),
): Promise<ConformanceResult> {
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

  /**
   * Die Inline-Stile ALLER Renderer-Flächen — sie entstehen beim ohnehin laufenden
   * Render-Durchgang und gehen unten in die Farb-Achse. Ohne sie sähe die Achse nur
   * die Stylesheets, und `style: { color: "#777" }` über einer hellen Fläche käme an
   * ihr vorbei.
   */
  const inlineStyles = new Set<string>();

  for (const type of CORE_WIDGET_TYPES) {
    const entry = classify(type, manifest, skin, inlineStyles);
    widgets[type] = entry;
    summary[entry.level] += 1;
  }

  const honors = await checkHonors(skin);

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
      // Die DEKLARATION, verbatim — sie bleibt, was sie ist.
      honors: manifest.layout.honors ?? [],
      // …und daneben das MESSERGEBNIS. Ohne diesen Eintrag trug support.json bei
      // `unknown`/`unrenderable`/`undelivered` weiterhin die behauptete
      // `honors`-Liste und KEINEN einzigen Befund: Exit-Code und stderr sind nach
      // dem Lauf weg, das Artefakt bleibt liegen, und ein späterer Konsument hielt
      // es für gültig. Ein Befund gehört deshalb IN das Artefakt, nicht nur in den
      // Lauf, der es geschrieben hat.
      ...(honors.length > 0 ? { honorsFindings: honors } : {}),
    },
    // Die Farb-Achse (Vertrag 1.13). Sie steht IMMER im Report — auch wenn der
    // Skin nichts deklariert: dann als `undeclared`, ausdruecklich unterscheidbar
    // von `pass` (Goldene Regel 3). AA ist Pflicht (Regel 6), deshalb zaehlt alles
    // ausser `pass` unten als harter Fehler.
    a11y: measureA11y({ manifest, styles: skin.styles, inlineStyles: [...inlineStyles] }),
  };

  const a11yFailed = report.a11y?.status !== "pass";
  return {
    report,
    hasGap: summary.gap > 0 || summary.broken > 0 || honors.length > 0 || a11yFailed,
    honors,
  };
}
