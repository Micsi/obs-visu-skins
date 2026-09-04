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
(`Micsi/openbridgeserver`, Branch `feat/visu-mobile-skins`) — dieses Repo kennt es nur
über einen Dev-Link, nicht über eine Abhängigkeit im Code.

## Vor der ersten Änderung lesen

| Datei                             | Wofür                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `README.md`                       | Drei-Welten-Modell, **Goldene Regeln** (verbindlich), Workspace, Vertragsbezug |
| `docs/authoring-skins.md`         | Einen Skin bauen: Scaffold → Manifest → Konformität → Wand → App               |
| `CONTRIBUTING-visu.md` (obs-Repo) | Branch-Modell, Vertrags-Lieferweg, CI-Gates, Release                           |

Die Goldenen Regeln stehen **nur** im README — sie hier zu wiederholen hiesse, zwei
Fassungen zu pflegen, die auseinanderdriften.

## Der Konformitätslauf misst, er glaubt nicht

Der Generator (`packages/tooling/conformance`) prüft einen Skin gegen den Vertrag, indem
er die Renderer **ausführt** — nicht, indem er das Manifest liest. Das ist die zentrale
Eigenschaft dieses Repos, und sie ist mehrfach hart erarbeitet:

- Ein `gap 0 · broken 0` ohne ausgeführten Renderer ist **vakuum-erfüllt** und wertlos.
- Die `honors`-Achse mountet die Seite mit Vue in ein echtes DOM und feuert echte Klicks.
  Sie baut Vues Verhalten bewusst **nicht** nach — jede Nachbildung wich an der nächsten
  Stelle vom Original ab (siehe die Kommentare in `index.ts`).
- Wer eine Prüfung ergänzt, schreibt eine **Gegenprobe**: ein Spec, das ohne den Fix
  nachweislich rot ist. Ein Test, der die _Schreibweise_ eines Fixes festhält statt seiner
  _Wirkung_, deckt einen Fix, der in der Zielumgebung gar nichts tut.

## Contract-Bump: eine rote CI ist hier zeitweise normal

Zieht der Vertrag einen Minor weiter, ist die CI dieses Repos **rot, bis der Manifest-Bump
gemergt ist** — und zwar `main` selbst, also auch jeder neu geöffnete PR, auch ein reiner
Doku-PR. Erkennungsmerkmal: `expected '<alt>' to be '<neu>'` in einer `scaffold.spec.ts`,
oder ein fehlender Vertrags-Export. **Jeder andere Fehler ist deiner.**

Details und die Reihenfolge: `README.md → „Contract-Bump: eine rote CI ist hier normal"`
und, ausführlich mit den Freigabepflichten, `CONTRIBUTING-visu.md → „Contract-Bump: der
rote Zwischenschritt"` im obs-Repo.

## CI-Gates

`pnpm lint` · `pnpm typecheck` · `pnpm -r test` · `pnpm --filter @obs-visu-skins/conformance gate`.

Das Gate fährt **alle** Skins und bricht bei `gap`/`broken` oder einem `honors`-Befund.
Ein neuer Skin muss in `gate.spec.ts` **und** in der `devDependencies` des
conformance-Pakets eingetragen werden, sonst wird er nie gemessen.

Vor jeder Aussage über einen grünen Lauf: die vier Gates wirklich fahren, nicht schätzen.

## Cross-Repo-Etikette

- Der Vertrag wird **hier nie geändert** — er lebt im obs-Repo. Braucht ein Skin eine neue
  Vertragsfläche, geht das über einen Contract-PR dort.
- Die absoluten `link:`-Pfade sind Entwicklungs-Tooling und dürfen nie in einen
  Release-Stand sickern.
