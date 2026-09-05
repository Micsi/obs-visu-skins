// Die EINE Code-Fence-Buchhaltung dieses Pakets.
//
// ══ Der Fehler, gegen den sie steht
//
// Sieben Specs schneiden Abschnitte aus Markdown, und jedes trug bis eben seine eigene
// Kopie von `if (/^\s*```/.test(line)) fenced = !fenced;`. Diese Zeile ist zweifach
// falsch:
//
//   1. CommonMark kennt ZWEI Fence-Zeichen, ``` und ~~~. Eine `# …`-Zeile INNERHALB
//      eines `~~~`-Blocks galt der alten Buchhaltung deshalb als Überschrift und
//      schnitt den Abschnitt dort ab. Alles darunter war für KEINE Prüfung mehr
//      sichtbar, während das Dokument gerendert einwandfrei aussah.
//   2. Eine Fence schliesst nur mit demselben Zeichen, mindestens so lang wie der
//      Öffner und ohne Info-String. Eine `~~~`-Zeile in einem ```-Block ist Inhalt,
//      kein Schliesser — das blosse Umschalten machte daraus ein Ende.
//
// Weil derselbe Fehler in sieben Kopien stand, steht die Buchhaltung jetzt EINMAL hier.
// Wer sie morgen schärft, schärft sie überall.
//
// ══ Was diese Datei NICHT tut
//
// Sie ist kein Markdown-Parser. Sie kennt keine Fences, die tiefer als drei Zeichen
// eingerückt sind (in verschachtelten Listen zulässig), keine HTML-Blöcke und keine
// Setext-Überschriften. Für die Dokumente dieses Repos reicht das; wo es das nicht
// mehr tut, ist ein echter Parser die Antwort und keine weitere Sonderregel hier.

/**
 * Eine Code-Fence-Zeile. CommonMark kennt ``` und ~~~, und die Fence darf bis zu drei
 * Leerzeichen eingerückt sein.
 */
export const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** Offene Fence: Zeichen und Länge, denn geschlossen wird nur mit demselben Zeichen. */
export interface Fence {
  readonly char: string;
  readonly len: number;
}

/**
 * Fence-Buchhaltung für EINE Zeile: gibt den Zustand nach dieser Zeile zurück.
 *
 * `null` heisst „ausserhalb einer Fence". Ein Öffner merkt sich Zeichen und Länge; als
 * Schliesser zählt nur dasselbe Zeichen, mindestens so lang, ohne Info-String.
 */
export function stepFence(line: string, open: Fence | null): Fence | null {
  const m = FENCE_LINE.exec(line);
  if (!m) return open;
  const marker = m[1] as string;
  const char = marker[0] as string;
  const len = marker.length;
  if (open === null) return { char, len };
  if (char === open.char && len >= open.len && (m[2] as string).trim() === "") return null;
  return open;
}

/**
 * Der Text ohne seine Code-Blöcke (Fence-Zeilen eingeschlossen).
 *
 * Nicht `/```[\s\S]*?```/`: die Regex kennt nur Backticks und paart ausserdem den
 * ersten mit dem nächsten Vorkommen statt mit dem passenden Schliesser.
 */
export function stripFences(text: string): string {
  const out: string[] = [];
  let fence: Fence | null = null;
  for (const line of text.split("\n")) {
    const next = stepFence(line, fence);
    if (fence === null && next === null) {
      out.push(line);
      continue;
    }
    fence = next;
  }
  return out.join("\n");
}

/**
 * Die INHALTE der Code-Blöcke eines Textes — mit derselben Fence-Buchhaltung.
 *
 * Wer einen Kommandoblock als `~~~sh` schreibt, hat ihn damit weiterhin in der Prüfung
 * und nicht nur im gerenderten Dokument.
 */
export function codeBlocks(text: string): string[] {
  const out: string[] = [];
  let fence: Fence | null = null;
  let buf: string[] = [];
  for (const line of text.split("\n")) {
    if (FENCE_LINE.test(line)) {
      const next = stepFence(line, fence);
      if (fence === null) {
        fence = next;
        buf = [];
        continue;
      }
      if (next === null) {
        out.push(buf.join("\n"));
        fence = null;
        continue;
      }
      buf.push(line);
      continue;
    }
    if (fence !== null) buf.push(line);
  }
  return out;
}

/**
 * Der Abschnitt ab der EINEN Überschrift, die `heading` trifft.
 *
 * `end`: `"same-or-higher"` schneidet an der nächsten Überschrift gleicher oder höherer
 * Ebene ab, `"any-heading"` an jeder — auch an einer tieferen. Der zweite Modus ist für
 * Abschnitte gedacht, in denen ein Leser eine Aussage NACHSCHLÄGT: eine Untersektion ist
 * dann eine andere Leseeinheit, und eine angehängte `### Randnotiz` mit dem gesuchten
 * Stichwort darf den Abschnitt nicht retten.
 *
 * Drei Wurfbedingungen, jede gegen einen nachgemessenen Ausweg:
 *
 *   • KEINE Überschrift — der Abschnitt, an dem die Prüfung hängt, ist verschwunden.
 *   • MEHRERE gleichnamige — welcher gälte? Ein Decoy weiter oben, der brav die Pfade
 *     und Zahlen mitbringt, während der echte Abschnitt weiter lügt, wäre sonst ein
 *     Schlupfloch. Zwei gleichnamige Abschnitte sind ohnehin schon in der Doku ein
 *     Fehler.
 *   • UNBALANCIERTE Fence — fail-open hiesse: eine überzählige ```-Zeile irgendwo
 *     darunter, und der Abschnitt verschluckt den Rest der Datei. Damit ginge jeder
 *     Pfad, der IRGENDWO im Dokument steht, als „im Abschnitt genannt" durch.
 */
export function section(
  text: string,
  heading: RegExp,
  label: string,
  end: "same-or-higher" | "any-heading" = "same-or-higher",
): string {
  const lines = text.split("\n");
  const heads: number[] = [];
  let fence: Fence | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      continue;
    }
    if (fence === null && heading.test(line)) heads.push(i);
  }
  if (fence !== null) {
    throw new Error(
      `${label}: unbalancierte Code-Fence (${fence.char.repeat(fence.len)}) — die ` +
        `Abschnittsgrenzen dieses Dokuments sind nicht bestimmbar, und diese Ratsche ` +
        `prüfte daran nichts mehr.`,
    );
  }
  if (heads.length === 0) {
    throw new Error(`${label}: Abschnitt ${String(heading)} nicht gefunden.`);
  }
  if (heads.length > 1) {
    throw new Error(
      `${label}: Abschnitt ${String(heading)} steht ${heads.length}× ` +
        `(Zeilen ${heads.map((i) => i + 1).join(", ")}). Welcher gilt? Diese Ratsche kann ` +
        `es nicht entscheiden — und ein Leser auch nicht.`,
    );
  }
  const start = heads[0] as number;
  const level = (/^#+/.exec(lines[start] as string) as RegExpExecArray)[0].length;
  const nextHead = end === "any-heading" ? /^#{1,6}\s/ : new RegExp(`^#{1,${level}}\\s`);
  let stop = lines.length;
  fence = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      continue;
    }
    if (fence === null && nextHead.test(line)) {
      stop = i;
      break;
    }
  }
  if (fence !== null) {
    throw new Error(
      `${label}: unbalancierte Code-Fence (${fence.char.repeat(fence.len)}) ab Zeile ` +
        `${start + 1} — der Abschnitt hat kein Ende. So gelesen umfasst er den Rest der ` +
        `Datei, und diese Ratsche prüfte nichts mehr.`,
    );
  }
  return lines.slice(start + 1, stop).join("\n");
}
