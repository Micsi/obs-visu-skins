# AGENTS/CLAUDE Alias Note

`AGENTS.md` ist die **kanonische** Agenten-Anweisung dieses Repos.
`CLAUDE.md` ist ein Symlink auf genau diese Datei (Werkzeug-Kompatibilität).
Eine von beiden zu lesen genügt; beide zu lesen ist redundant.

# AGENTS.md

Leitfaden für KI-Agenten, die in `obs-visu-skins` arbeiten.

## Was dieses Repo ist

Die **Skins** und das **Tooling** des obs-Visu-Systems: austauschbare Darstellungen
(`packages/skins/*`), der Konformitäts-Generator, die Fixture-Wand und das Scaffold
(`packages/tooling/*`). Die App und der **Vertrag** liegen in einem anderen Repo
(`Micsi/openbridgeserver`, Branch `feat/visu-mobile-skins`).

Die Grenze verläuft anders, als sie oft gelesen wird:

- **Zum App-Code hat dieses Repo keinerlei Bezug** — kein Import, kein Eintrag in einer
  `package.json`, keine Annahme über Store, Seiten oder Host. Skins und App kennen
  einander nicht; beide hängen nur am Vertrag.
- **Der Vertrag dagegen ist eine echte Code-Abhängigkeit.** Die Skin- und Tooling-Pakete
  führen `@obs/visu-contract` in ihren `dependencies` und importieren seine Typen und
  Fixtures direkt — die Skins und die Tooling-Pakete, die ihn wirklich verbrauchen
  (heute sechs; `contract-ref` und `docs-guard` etwa nicht). Aufgelöst wird sie derzeit über einen Dev-Link (pnpm `link:`, siehe
  `scripts/contract-link.sh`) statt über eine Registry — das ist der Bezugsweg, nicht ihr
  Ersatz.

Praktisch heisst das: **Vertragsänderungen betreffen dich.** Zieht der Vertrag weiter,
sind Typen, Manifest-Versionen und ggf. der `dependencies`-Eintrag hier nachzuziehen —
das ist Teil der Änderung, nicht Sache des anderen Repos.

## Vor der ersten Änderung lesen

| Datei                             | Wofür                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                       | Drei-Welten-Modell, **Goldene Regeln** (verbindlich, vollständig), Workspace, Vertragsbezug                                               |
| `docs/authoring-skins.md`         | Einen Skin bauen: Scaffold → Manifest → Konformität → Wand → App; **Goldene Regeln** nur als wörtliche Teil-Wiedergabe, nicht verbindlich |
| `CONTRIBUTING-visu.md` (obs-Repo) | Branch-Modell, Vertrags-Lieferweg, CI-Gates, Release                                                                                      |

Verbindlich ist allein die Fassung der **Goldenen Regeln** in `README.md`.
`docs/authoring-skins.md` gibt einen Teil davon wieder, weil der Guide als durchgehende
Anleitung gelesen wird — aber im Wortlaut und unter der Nummer des README, damit die
Wiedergabe nicht driften kann; `packages/tooling/docs-guard` misst genau das. Eine
zweite, frei formulierte Fassung — hier oder anderswo — ist kein Weg: sie hiesse zwei
Wahrheiten.

## Der Konformitätslauf misst, er glaubt nicht

Der Generator (`packages/tooling/conformance`) prüft einen Skin gegen den Vertrag, indem
er die Renderer **ausführt** — nicht, indem er das Manifest liest. Das ist die zentrale
Eigenschaft dieses Repos, und sie ist mehrfach hart erarbeitet:

- Ein `gap 0 · broken 0` ohne ausgeführten Renderer ist **vakuum-erfüllt** und wertlos.
- Die `honors`-Achse führt genau ein Token wirklich aus: bei `link` mountet der Lauf die
  Seite mit Vue in ein echtes DOM und feuert echte Klicks — in der deklarierten Richtung
  wie in der Gegenrichtung (der Renderer zeichnet den Sprung, das Manifest nennt ihn
  nicht). Sie baut Vues Verhalten bewusst **nicht** nach; jede Nachbildung wich an der
  nächsten Stelle vom Original ab (siehe die Kommentare in `index.ts`).
- Die übrigen sieben Token des Vertrags-Vokabulars (`order`, `grouping`, `role`,
  `position`, `nav`, `layers`, `popup`) prüft der Lauf **nur** gegen dieses Vokabular: ein
  Tippfehler fällt auf, das Verhalten dahinter bleibt ungemessen. `honors: ["layers"]` im
  Manifest hat das Gate also nie in Aktion gesehen — der Nachweis dafür bleibt Sache der
  Specs des Skins.
- Wer eine Prüfung ergänzt, schreibt eine **Gegenprobe**: ein Spec, das ohne den Fix
  nachweislich rot ist. Ein Test, der die _Schreibweise_ eines Fixes festhält statt seiner
  _Wirkung_, deckt einen Fix, der in der Zielumgebung gar nichts tut.

## Contract-Bump: eine rote CI ist hier zeitweise normal

Zieht der Vertrag einen Minor weiter, ist die CI dieses Repos **zweimal nacheinander
rot**, und die beiden Phasen treffen verschieden weit. Vor dem Contract-Merge betrifft es
nur Branches, die die ausstehende Vertragsfläche schon importieren — unverändertes `main`
und unbeteiligte PRs kompilieren weiter gegen den alten Vertrag. Erst nach dem Merge trifft
es **jeden** neu ausgeführten Lauf, auf `main` wie in jedem neu geöffneten PR, auch in
einem reinen Doku-PR. Ein bereits eingetragener grüner Check bleibt grün, bis er neu läuft.
Vor dem Contract-Merge fehlt der Vertrags-Export; tsc meldet englisch
`has no exported member 'X'`. Danach tragen die Manifeste noch die alte Version:
`expected '<alt>' to be '<neu>'` in der Vertragsversions-Assertion, die pro Skin anders
heisst und zusätzlich in der Spec des Konformitäts-Generators steht; die vier aktuellen
Pfade stehen im README. Es sind also zwei auflösende Bedingungen in dieser Reihenfolge:
erst der **Contract-Merge** drüben, dann der **Manifest-Bump** hier. Ein fehlender
Vertrags-Export zählt allerdings erst dazu, wenn nachgewiesen ist, dass der ausstehende
Vertrag ihn wirklich mitbringt — sonst ist es ein Tippfehler, und Warten hilft dagegen
nie. **Jeder Fehler ausserhalb dieser beiden Bilder ist deiner.**

Details und die Reihenfolge: `README.md → „Contract-Bump: eine rote CI ist hier normal"`
und, ausführlich mit den Freigabepflichten, `CONTRIBUTING-visu.md → „Contract-Bump: der
rote Zwischenschritt"` im obs-Repo.

## CI-Gates

`pnpm lint` · `pnpm typecheck` · `pnpm -r test` · `pnpm --filter @obs-visu-skins/conformance gate`.

Das Gate fährt **alle** Skins und bricht bei `gap`/`broken`, bei einem `honors`-Befund
und bei einer Farb-Achse, die nicht `pass` meldet. Die AA-Messung ist seit Vertrag 1.13
Pflicht: ein Skin ohne `a11y`-Deklaration steht auf `undeclared`, ausdrücklich nicht auf
`pass` (Goldene Regel 6: **AA-Kontrast ist Pflicht**), und das Gate fällt. Ein roter Lauf ohne eine einzige `gap`-,
`broken`- oder `honors`-Zeile im Report ist deshalb kein undokumentierter Fehler,
sondern eine Aufforderung, die AA-Konfiguration des Skins zu reparieren.

Ein neuer Skin muss in `gate.spec.ts` **und** in der `devDependencies` des
conformance-Pakets eingetragen werden, sonst wird er nie gemessen.

Vor jeder Aussage über einen grünen Lauf: die vier Gates wirklich fahren, nicht schätzen.

## Cross-Repo-Etikette

- Der Vertrag wird **hier nie geändert** — er lebt im obs-Repo. Braucht ein Skin eine neue
  Vertragsfläche, geht das über einen Contract-PR dort.
- Die absoluten `link:`-Pfade sind Entwicklungs-Tooling und dürfen nie in einen
  Release-Stand sickern.
