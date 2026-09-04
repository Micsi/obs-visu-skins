// @obs-visu-skins/conformance — Tokens-/Ctx-Stubs für den headless Renderer-Lauf.
//
// Der Vertrag liefert nur Daten und Typen (Goldene Regel 7); die Ctx-Helfer kommen
// im Betrieb aus dem Host. Für den Konformitätslauf (und die Fixture-Wand) braucht
// es eine ehrliche, aber minimale Nachbildung: sie erfindet keine Gerätedaten,
// sondern formuliert nur die zentralen Zustandstexte, die der Host sonst liefert.
//
// Bewusst KEIN State (Goldene Regel 4) — reine Funktionen über die Fixture-Daten.

import type { Ctx, Device, LinkOutcome, PageHost, PageLink, Tokens } from "@obs/visu-contract";

/** Neutrale Tokens: der headless Lauf prüft Struktur, nicht Farbe. */
export const tokensStub: Tokens = {
  accent: (token) => `var(--acc-${token})`,
  accentInk: (token) => `var(--ink-${token})`,
  font: "monospace",
  space: (step) => `${step * 4}px`,
};

const FLOORS: Record<string, string> = {
  Erdgeschoss: "EG",
  Obergeschoss: "OG",
  Untergeschoss: "UG",
  Dachgeschoss: "DG",
  Keller: "KG",
};

const nf = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

function fmt(v: number | string, dec?: number): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return dec === undefined
    ? nf.format(n)
    : new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      }).format(n);
}

/**
 * Der zentrale Zustandstext je Typ — die Formulierung, die im Betrieb aus dem Core
 * kommt. Über den Typ-Schlüssel adressiert, kein switch mit stillem Default
 * (Goldene Regel 2): ein unbekannter Typ liefert einen leeren Text und fällt damit
 * in der Wand sichtbar auf.
 */
const STATE_TEXT: Record<string, (d: never) => string> = {
  light: (d: Device & { on: boolean; dim: number | null }) =>
    d.on ? (d.dim === null ? "Ein" : `Ein — ${fmt(d.dim)} %`) : "Aus",
  switch: (d: Device & { on: boolean }) => (d.on ? "Ein" : "Aus"),
  blind: (d: Device & { position: number }) =>
    `${fmt(d.position)} % · ${d.position === 0 ? "Offen" : d.position === 100 ? "Zu" : "Teil"}`,
  jalousie: (d: Device & { position: number; slat: number }) =>
    `${fmt(d.position)} % · Lamelle ${fmt(d.slat)} %`,
  sensor: (d: Device & { value: number | string; unit: string }) =>
    `${fmt(d.value)} ${d.unit}`.trim(),
  scene: (d: Device & { sub?: string }) => d.sub ?? "",
  media: (d: Device & { playState: string; title: string | null }) =>
    d.playState === "playing"
      ? `Spielt — ${d.title ?? ""}`.trim()
      : d.playState === "paused"
        ? "Pause"
        : "Gestoppt",
  camera: (d: Device & { online: boolean }) => (d.online ? "Online" : "Offline"),
  climate: (d: Device & { setpoint: number; current: number; unit: string }) =>
    `${fmt(d.setpoint, 1)} ${d.unit} — Ist ${fmt(d.current, 1)} ${d.unit}`,
};

/** Ctx-Nachbildung für den headless Lauf; `overrides` für gezielte Testfälle. */
export function ctxStub(overrides: Partial<Ctx> = {}): Ctx {
  const stateText = (d: Device): string => {
    const fn = STATE_TEXT[d.type];
    return fn ? fn(d as never) : "";
  };

  return {
    stateText,
    stateParts: (d) => {
      const text = stateText(d);
      const cut = text.indexOf(" ");
      return cut === -1
        ? { word: text, rest: "" }
        : { word: text.slice(0, cut), rest: text.slice(cut) };
    },
    hyphenate: (s) => s,
    floorShort: (d) => (d.floor ? (FLOORS[d.floor] ?? d.floor) : ""),
    icon: (_d, slot) => `icon:${slot}`,
    nf: fmt,
    warn: (d) =>
      d.type === "sensor" && typeof d.status === "string" && /erhöht|hoch|warn/i.test(d.status),
    ...overrides,
  };
}

/* ------------------------------------------------- PageHost-Stub (Vertrag 1.12) */

/**
 * Die Link-FORMEN, die der Probelauf stellt — und die ein Skin alle bedienen muss.
 *
 * Ein einziges Element genuegte nicht, und zwar in zwei Richtungen:
 *
 *  - Es trug immer `activeIndicator: "dot"`. Ein Renderer, der seine Klickflaeche
 *    nur fuer markierte Links baut, bestand damit — waehrend jeder GEWOEHNLICHE
 *    Link (das Feld ist optional, dokumentierter Default `none`) ohne Affordanz
 *    blieb, nachdem der Host wegen der Deklaration zurueckgetreten war.
 *  - Es loeste immer als `navigate` auf. Ein Renderer, der nur bei
 *    `resolveLink(...).kind === "navigate"` zeichnet, bestand ebenfalls — waehrend
 *    ein PIN-geschuetztes Ziel (`gate`) leer ausging. Genau dort ist die
 *    Affordanz aber noetig: sie fuehrt auf den PIN-Pfad.
 *
 * `unknown` steht bewusst NICHT hier: dort ist es dokumentiert richtig, KEINE
 * Affordanz zu zeichnen (eine tote Klickflaeche ist schlimmer als keine).
 */
const PROBE_LINKS = [
  { target: "probe-target", indicator: "dot" as const, outcome: "navigate" as const },
  { target: "probe-plain", indicator: undefined, outcome: "navigate" as const },
  { target: "probe-gated", indicator: undefined, outcome: "gate" as const },
] as const;

const PROBE_TARGET = PROBE_LINKS[0].target;

/** Was ein Page-Renderer beim Probelauf am Host TATSÄCHLICH angefragt hat. */
export interface PageHostProbe {
  readonly host: PageHost;
  /** Namen der aufgerufenen Link-Dienste, in Aufrufreihenfolge. */
  readonly linkCalls: string[];
  /**
   * Die Ziele, mit denen `followLink` gerufen wurde — in Aufrufreihenfolge.
   *
   * Der Name allein genuegt nicht: ein Renderer, der das verlinkte `LayerItem`
   * ignoriert und irgendeine andere Flaeche mit einem festverdrahteten Ziel
   * zeichnet, ruft `followLink` ebenfalls. Der Host wuerde daraufhin seine eigene
   * Affordanz zurueckziehen, waehrend das Ziel des Items nirgends erreichbar ist.
   */
  readonly followedTargets: string[];
  /** Das erste Ziel, das der Probelauf anbietet (Rueckwaertskompatibilitaet). */
  readonly probeTarget: string;
  /**
   * ALLE Ziele des gestellten Layers — markiert, gewoehnlich, PIN-geschuetzt.
   * Der Probelauf verlangt eine Affordanz fuer JEDES davon: der Host tritt wegen
   * der Deklaration bei allen zurueck, also darf keines leer ausgehen.
   */
  readonly probeTargets: readonly string[];
  /**
   * Leert das Protokoll. Der Probelauf trennt damit zwei Phasen, die sonst in
   * einen Topf fielen: was der Renderer WÄHREND des Zeichnens am Host fragt, und
   * was ein KLICK auslöst. Nur das Zweite ist eine Affordanz — ein Renderer, der
   * `followLink` schon beim Rendern ruft und einen leeren Baum zurückgibt, hat
   * keine gezeichnet (und navigiert im Browser beim blossen Anzeigen der Seite,
   * was für sich genommen ein Fehler wäre).
   */
  reset(): void;
}

/**
 * Ein minimaler {@link PageHost} für den Konformitätslauf: er beantwortet jede
 * Frage neutral und PROTOKOLLIERT, welche Link-Dienste der Skin benutzt hat.
 *
 * Damit wird `honors: ['link']` messbar statt behauptet. Der Host tritt bei
 * diesem String mit seiner eigenen Sprung-Affordanz zurück - ein Skin, der ihn
 * deklariert und dann nichts zeichnet, hätte also GAR KEINE Affordanz mehr.
 * Genau die Kehrseite dessen, was der Slot verhindern soll (Goldene Regel 3).
 *
 * Kein State (Goldene Regel 4): eine Seite, ein Layer, ein verlinktes Element.
 */
export function pageHostProbe(): PageHostProbe {
  const linkCalls: string[] = [];
  const followedTargets: string[] = [];
  const note = <T>(name: string, value: T): T => {
    linkCalls.push(name);
    return value;
  };
  /** Das Urteil des Hosts je Ziel — `navigate` fuer die offenen, `gate` fuer das
   *  PIN-geschuetzte. Ein unbekanntes Ziel gilt als `unknown`, wie beim echten Host. */
  const outcomeFor = (target: string): LinkOutcome => {
    const form = PROBE_LINKS.find((l) => l.target === target);
    if (!form) return { kind: "unknown", targetNodeId: target };
    return form.outcome === "gate"
      ? { kind: "gate", pageId: target, accessNodeId: "probe-page" }
      : { kind: "navigate", pageId: target };
  };
  const host: PageHost = {
    navTree: [
      {
        id: "probe-page",
        name: "Probe",
        type: "PAGE",
        access: "public",
        children: [],
      },
    ],
    currentPageId: "probe-page",
    navigate: () => {},
    layersFor: (id: string) =>
      id === "probe-page"
        ? [
            {
              id: "probe-page",
              origin: "own" as const,
              order: 0,
              items: PROBE_LINKS.map((l, i) => ({
                id: `probe-item-${i}`,
                position: { x: 0, y: i * 10, w: 10, h: 10 },
                link: l.indicator
                  ? { targetNodeId: l.target, activeIndicator: l.indicator }
                  : { targetNodeId: l.target },
              })),
            },
          ]
        : [],
    renderTile: (deviceId: string) => `<tile:${deviceId}>`,
    openPopups: [],
    openPopup: () => {},
    closePopup: () => {},
    resolveLink: (link: PageLink) => note("resolveLink", outcomeFor(link.targetNodeId)),
    followLink: (link: PageLink) =>
      note("followLink", (followedTargets.push(link.targetNodeId), outcomeFor(link.targetNodeId))),
    isLinkActive: () => note("isLinkActive", false),
    linkLabel: (link: PageLink) => note("linkLabel", `zur Seite ${link.targetNodeId}`),
  };
  return {
    host,
    linkCalls,
    followedTargets,
    probeTarget: PROBE_TARGET,
    probeTargets: PROBE_LINKS.map((l) => l.target),
    reset: () => {
      linkCalls.length = 0;
      followedTargets.length = 0;
    },
  };
}

/* --------------------------------------------- Klick-Ereignis (Vertrag 1.12) */

/**
 * Ein Stellvertreter-Klickereignis für den `honors`-Probelauf.
 *
 * Der Probelauf ruft die gefundenen `onClick`-Handler selbst auf. Tat er das mit
 * GAR KEINEM Argument, warf jeder völlig normale Vue-Handler
 * (`(event) => { event.preventDefault(); host.followLink(link) }`) an der ersten
 * Zeile — noch VOR `followLink` — und der Skin fiel als `undelivered` durch,
 * obwohl er im Browser genau das Richtige tut. Ein Wächter, der einen konformen
 * Skin ablehnt, weil dieser sein Ereignis anfasst, misst nicht, er rät.
 *
 * Bewusst ein konkretes Objekt und KEIN Proxy: der Stellvertreter beantwortet die
 * Fläche, die ein Klick-Handler real benutzt, und sonst nichts. Ein Proxy, der auf
 * jeden Namen eine Funktion zurückgibt, machte `if (event.defaultPrevented)` und
 * ähnliche Abfragen still wahr und verschöbe das Verhalten des Handlers.
 */
export function clickEventStub(): Record<string, unknown> {
  const target: Record<string, unknown> = {
    nodeType: 1,
    tagName: "BUTTON",
    dataset: {},
    classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => false },
    getAttribute: () => null,
    setAttribute: () => {},
    hasAttribute: () => false,
    closest: () => null,
    matches: () => false,
    focus: () => {},
    blur: () => {},
    getBoundingClientRect: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    }),
  };
  const event: Record<string, unknown> = {
    type: "click",
    isTrusted: false,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 2,
    timeStamp: 0,
    detail: 1,
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    screenX: 0,
    screenY: 0,
    pageX: 0,
    pageY: 0,
    offsetX: 0,
    offsetY: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    pointerType: "mouse",
    target,
    currentTarget: target,
    srcElement: target,
    relatedTarget: null,
    view: null,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},
    composedPath: () => [target],
  };
  return event;
}

/**
 * Ein Klick-Ereignis, dessen `stopImmediatePropagation()` BEOBACHTBAR ist.
 *
 * Vue legt nach `mergeProps` mehrere Listener als Array unter einem Prop-Namen
 * ab und ruft sie der Reihe nach mit DEMSELBEN Ereignis. Ruft ein früherer
 * `stopImmediatePropagation()`, kommen die späteren gar nicht mehr dran. Der
 * Probelauf feuerte jedes Array-Glied einzeln mit einem frischen Ereignis, dessen
 * Methode ein No-op ist — ein Array, dessen SPÄTERER Listener `followLink` ruft,
 * bestand damit, obwohl ein echter Klick ihn nie erreicht.
 *
 * Der Leser steht bewusst NEBEN dem Ereignis und nicht darin: ein Handler sieht
 * genau die Fläche, die der Browser ihm gibt, und keine erfundene Abfrage, an der
 * er sein Verhalten ausrichten könnte.
 */
export function clickEventProbe(): {
  readonly event: Record<string, unknown>;
  readonly immediateStopped: () => boolean;
} {
  let stopped = false;
  const event = clickEventStub();
  event.stopImmediatePropagation = () => {
    stopped = true;
  };
  return { event, immediateStopped: () => stopped };
}
