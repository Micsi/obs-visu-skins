// Ratsche gegen den Dämpfungsverband über gefärbtem Text.
//
// ══ Der Defekt, den sie festhält
//
// Der Skin markiert „gesperrt/readonly/inert" mit `opacity` auf einem
// CONTAINER. Das ist eine Gruppenopazität: sie dämpft Text UND Grund darunter
// gegen das, was hinter der Gruppe liegt, und frisst den Kontrast zwischen
// beiden. Bis zu dieser Runde stand `.jal-body` in der Sperr-Regel — und darin
// liegt das Fenster samt Ablesetext. Der Text stand gesperrt bei 2.25:1
// (flaches Alpha-Modell) bzw. 2.90:1 (Gruppenopazität) gegen die Textschwelle.
//
// Der Konformitätslauf kann das NICHT sehen: er kennt nur `alphas` je Token —
// eine Deklaration —, keine Verschachtelung und keine Gruppenopazität. Wer
// `.jal-posrail` wieder auf `.jal-body` zurückschreibt, macht den Fix
// stillschweigend rückgängig und der Lauf bleibt grün. Genau das hat der
// Kritiker vorgeführt.
//
// ══ Die Invariante
//
// Für jedes gerenderte Element, das eine Farbe aus einem als `text` geführten
// Token trägt, und für jeden Dämpfungsfaktor α, den es von sich selbst oder
// einem Vorfahren erbt, gilt EINES von beidem:
//
//   1. α steht in `alphas` dieses Tokens — dann MISST der Lauf die Dämpfung.
//   2. Der gedämpfte Verband ist ein INAKTIVES Bedienelement: er enthält
//      mindestens ein Bedienelement, und JEDES Bedienelement darin trägt
//      `disabled`/`aria-disabled`. Dann greift die Ausnahme aus WCAG 1.4.3 und
//      1.4.11 („inactive user interface components have no contrast
//      requirement").
//
// Sonst ist es ein Befund.
//
// ══ Was das über den Graubereich sagt — ausdrücklich, nicht nebenbei
//
// `.jal-rail-cap` („AUF"/„ZU") und `.jal-slatval` („81°") bleiben im
// 0.55-Verband und lesen dort 3.73:1 (hell) bzw. 4.45:1 (dunkel). Sie sind
// Beschriftung und Werteblase EINES Reglers, der in diesem Zustand `disabled`
// trägt — Fall 2. Der Ablesetext des Fensters war das nicht: `.jal-window`
// trägt `role="button"` samt `data-action="openDetail"` OHNE `disabled`, ist
// also auch auf der gesperrten Kachel bedienbar. Genau daran fällt der
// Rückfall auf, und genau das ist der Unterschied, den diese Spec zieht.
//
// ══ Grenzen dieser Spec (damit sie niemand für mehr hält, als sie ist)
//
//  • Sie prüft die gerenderten Bäume der Kachel-Renderer, nicht jede denkbare
//    Host-Komposition.
//  • Attribut- und Zustands-Bedingungen in Selektoren (`[data-theme]`,
//    `:hover`) werden als ERFÜLLT gewertet. Das macht sie strenger, nie
//    laxer: mehr Verbände und mehr Tinten-Treffer als real.
//  • Selektorformen, die sie nicht sicher deuten kann (Kind-/Geschwister-
//    Kombinatoren), lässt sie nicht durchrutschen, sondern bricht ab.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Device, SkinManifest } from "@obs/visu-contract";
import manifestJson from "../manifest.json" with { type: "json" };

import { LightTile } from "../src/tiles/LightTile.js";
import { SwitchTile } from "../src/tiles/SwitchTile.js";
import { MediaTile } from "../src/tiles/Media.js";
import { CameraTile } from "../src/tiles/Camera.js";
import { jalousieTile } from "../src/tiles/JalousieTile.js";
import { ctxStub, tokensStub, type VNodeLike } from "./_vnode.js";

const manifest = manifestJson as unknown as SkinManifest;
const tokens = manifest.a11y!.tokens;

const CSS = readFileSync(fileURLToPath(new URL("../ionic.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/* ------------------------------------------------------- Selektor-Deutung */

interface Compound {
  readonly tag?: string;
  readonly classes: readonly string[];
  readonly needsDisabled: boolean;
}

/**
 * Ein Selektor als Kette von Compounds (nur Nachfahren-Kombinator).
 * `null` heisst „nicht sicher deutbar" — der Aufrufer entscheidet, ob er das
 * ignoriert (Pseudo-Element) oder daran scheitert.
 */
function parseSelector(sel: string): Compound[] | null {
  const s = sel.trim();
  if (s.includes("::")) return null; // Pseudo-Element trägt keinen Renderer-Text
  if (/[>+~]/.test(s)) return null;
  const out: Compound[] = [];
  for (const part of s.split(/\s+/)) {
    // Attribut-Bedingungen fallen weg (bewusst strenger, siehe Kopf).
    const bare = part.replace(/\[[^\]]*\]/g, "");
    const needsDisabled = /:disabled\b/.test(bare);
    const core = bare.replace(/:[a-z-]+(\([^)]*\))?/gi, "");
    const classes = [...core.matchAll(/\.([\w-]+)/g)].map((m) => m[1]!);
    const tagMatch = /^([a-z][\w-]*)/i.exec(core);
    const tag = tagMatch ? tagMatch[1]! : undefined;
    if (!tag && classes.length === 0 && !needsDisabled) {
      if (core.trim().length === 0 && bare.trim().length > 0) continue; // reiner Attributselektor
      return null;
    }
    out.push({ tag, classes, needsDisabled });
  }
  return out.length > 0 ? out : null;
}

interface Rule {
  readonly selector: string;
  readonly chain: readonly Compound[];
  readonly body: string;
}

function rules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = (m[1] ?? "").slice((m[1] ?? "").lastIndexOf(";") + 1);
    for (const sel of head.split(",").map((s) => s.trim())) {
      if (sel.length === 0 || sel.startsWith("@")) continue;
      out.push({ selector: sel, body: m[2] ?? "" });
    }
  }
  return out;
}
const RULES = rules();

/** Jede Regel mit `opacity: <Zahl < 1>` — der Dämpfungsverband. */
const DIMS: (Rule & { alpha: number })[] = [];
for (const r of RULES) {
  const m = /(?:^|;)\s*opacity\s*:\s*([0-9.]+)\s*(?:;|$)/.exec(r.body);
  if (!m) continue;
  const alpha = Number(m[1]);
  if (!(alpha < 1)) continue;
  const chain = parseSelector(r.selector);
  if (chain === null) continue; // ::after & Co. — kein Renderer-Text darin
  DIMS.push({ ...r, chain, alpha });
}

/** Jede Regel, die eine Textfarbe aus einem `text`-Token setzt. */
const INKS: (Rule & { token: string })[] = [];
for (const r of RULES) {
  const m = /(?:^|;)\s*(?:color|-webkit-text-fill-color)\s*:\s*var\(\s*(--[\w-]+)/.exec(r.body);
  if (!m) continue;
  const token = m[1]!;
  if (tokens[token]?.role !== "text") continue;
  const chain = parseSelector(r.selector);
  if (chain === null) continue;
  INKS.push({ ...r, chain, token });
}

/* ------------------------------------------------------------ Baum-Wandeln */

interface Node {
  readonly v: VNodeLike;
  readonly tag: string;
  readonly classes: readonly string[];
  readonly path: readonly Node[]; // Vorfahren, Wurzel zuerst
}

function classesOf(v: VNodeLike): string[] {
  const c = v.props?.["class"];
  const s =
    typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.filter((x) => typeof x === "string").join(" ")
        : "";
  return s.split(/\s+/).filter(Boolean);
}
const isDisabled = (v: VNodeLike): boolean =>
  v.props?.["disabled"] === true || v.props?.["aria-disabled"] === "true";

function walk(node: unknown, path: Node[], out: Node[]): void {
  if (Array.isArray(node)) {
    for (const c of node) walk(c, path, out);
    return;
  }
  if (!node || typeof node !== "object" || !("type" in node)) return;
  const v = node as VNodeLike;
  if (typeof v.type !== "string") return;
  const self: Node = { v, tag: v.type, classes: classesOf(v), path };
  out.push(self);
  walk(v.children, [...path, self], out);
}

const matches = (n: Node, c: Compound): boolean =>
  (c.tag === undefined || c.tag === n.tag) &&
  c.classes.every((cl) => n.classes.includes(cl)) &&
  (!c.needsDisabled || isDisabled(n.v));

/** Trifft die Selektorkette auf diesen Knoten (Nachfahren-Kombinator)? */
function chainMatches(n: Node, chain: readonly Compound[]): boolean {
  if (!matches(n, chain[chain.length - 1]!)) return false;
  let i = chain.length - 2;
  for (let p = n.path.length - 1; p >= 0 && i >= 0; p -= 1) {
    if (matches(n.path[p]!, chain[i]!)) i -= 1;
  }
  return i < 0;
}

/* ------------------------------------------------------------- Die Bäume */

const dev = <T>(o: T): Device => o as unknown as Device;
const ctx = ctxStub();
const TREES: { name: string; root: unknown }[] = [
  {
    name: "jalousie (gesperrt)",
    root: jalousieTile(
      dev({
        type: "jalousie",
        room: "OG",
        label: "Bad",
        accent: "blue",
        position: 42,
        slat: 81,
        locked: true,
      }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "jalousie (readonly)",
    root: jalousieTile(
      dev({
        type: "jalousie",
        room: "OG",
        label: "Bad",
        accent: "blue",
        position: 42,
        slat: 81,
        writable: false,
      }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "jalousie (frei)",
    root: jalousieTile(
      dev({ type: "jalousie", room: "OG", label: "Bad", accent: "blue", position: 42, slat: 81 }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "media (readonly)",
    root: MediaTile(
      dev({
        type: "media",
        room: "EG",
        label: "Radio",
        accent: "teal",
        title: "Titel",
        artist: "Wer",
        playing: true,
        volume: 30,
        writable: false,
      }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "licht (readonly)",
    root: LightTile(
      dev({
        type: "light",
        room: "EG",
        label: "Licht",
        accent: "orange",
        on: true,
        dim: 50,
        writable: false,
      }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "schalter (readonly)",
    root: SwitchTile(
      dev({
        type: "switch",
        room: "EG",
        label: "Lüfter",
        accent: "blue",
        on: true,
        writable: false,
      }),
      tokensStub,
      ctx,
    ),
  },
  {
    name: "kamera (readonly)",
    root: CameraTile(
      dev({
        type: "camera",
        room: "EG",
        label: "Tür",
        accent: "slate",
        online: true,
        writable: false,
      }),
      tokensStub,
      ctx,
    ),
  },
];

/* -------------------------------------------------------------------- Spec */

interface Finding {
  readonly tree: string;
  readonly detail: string;
}

function audit(): { findings: Finding[]; checked: number; dimmed: number } {
  const findings: Finding[] = [];
  let checked = 0;
  let dimmed = 0;
  for (const { name, root } of TREES) {
    const nodes: Node[] = [];
    walk(root, [], nodes);
    for (const n of nodes) {
      // Die Tinte dieses Knotens: die nächstgelegene Tinten-Regel auf ihm selbst
      // oder einem Vorfahren (CSS-Vererbung von `color`).
      let token: string | undefined;
      for (const cand of [n, ...[...n.path].reverse()]) {
        const hit = INKS.find((i) => chainMatches(cand, i.chain));
        if (hit) {
          token = hit.token;
          break;
        }
      }
      if (token === undefined) continue;
      checked += 1;
      const alphas = tokens[token]?.alphas ?? [1];
      for (const cand of [n, ...n.path]) {
        for (const d of DIMS) {
          if (!chainMatches(cand, d.chain)) continue;
          dimmed += 1;
          if (alphas.includes(d.alpha)) continue; // Fall 1: gemessen
          // Fall 2: inaktives Bedienelement — jedes Steuerelement im Verband
          // trägt `disabled`.
          const group = nodes.filter((x) => x === cand || x.path.includes(cand));
          const controls = group.filter(
            (x) =>
              ["button", "input", "select", "textarea", "a"].includes(x.tag) ||
              typeof x.v.props?.["data-action"] === "string" ||
              typeof x.v.props?.["role"] === "string",
          );
          const live = controls.filter((x) => !isDisabled(x.v));
          if (controls.length > 0 && live.length === 0) continue;
          findings.push({
            tree: name,
            detail:
              `${d.selector} { opacity: ${d.alpha} } daempft ${token} auf .${n.classes.join(".") || n.tag}` +
              ` — ${d.alpha} steht nicht in alphas [${alphas.join(", ")}], und der Verband ist kein` +
              ` inaktives Bedienelement (${controls.length === 0 ? "gar kein Bedienelement darin" : `bedienbar: ${live.map((x) => "." + (x.classes.join(".") || x.tag)).join(", ")}`}).`,
          });
        }
      }
    }
  }
  return { findings, checked, dimmed };
}

const RESULT = audit();

describe("kein gefaerbter Text steht ungemessen in einem Daempfungsverband", () => {
  it("die Zerlegung hat ueberhaupt etwas gesehen", () => {
    // Ohne diese Zeile waere ein kaputter Parser oder ein leerer Baum ein
    // gruener Lauf — die haeufigste Art, wie eine Ratsche lautlos aufhoert.
    expect(DIMS.length).toBeGreaterThanOrEqual(6);
    expect(INKS.length).toBeGreaterThan(20);
    expect(INKS.some((i) => i.token === "--jal-ink")).toBe(true);
    expect(RESULT.checked).toBeGreaterThan(20);
    // Es MUSS Daempfungsverbaende geben, die auf reale Knoten treffen — sonst
    // prueft die Regel unten gegen die leere Menge und ist immer gruen.
    expect(RESULT.dimmed).toBeGreaterThan(5);
  });

  it("der Ablesetext der gesperrten Jalousie steht in KEINEM Verband", () => {
    // Die Gegenrichtung zum Auditbericht unten: hier steht namentlich, worum es
    // ging. Faellt .jal-readout wieder in eine gedaempfte Gruppe, ist diese
    // Zeile rot, auch wenn jemand die Ausnahmeregel aufweicht.
    const nodes: Node[] = [];
    walk(TREES[0]!.root, [], nodes);
    const readout = nodes.find((n) => n.classes.includes("jal-readout"));
    expect(readout, "die gesperrte Jalousie rendert keinen .jal-readout").toBeDefined();
    const over = [readout!, ...readout!.path].flatMap((cand) =>
      DIMS.filter((d) => chainMatches(cand, d.chain)).map((d) => `${d.selector} @${d.alpha}`),
    );
    expect(over, `Ablesetext liegt unter: ${over.join(" · ")}`).toEqual([]);
  });

  it("jede Daempfung ueber gefaerbtem Text ist gemessen oder inaktiv", () => {
    const lines = RESULT.findings.map((f) => `${f.tree}: ${f.detail}`);
    expect(lines, `ungemessene Daempfung ueber Text:\n  ${lines.join("\n  ")}`).toEqual([]);
  });
});
