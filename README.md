# obs-visu-skins

Pluggable Skin-System für **obs Visu** — Renderer pro Widget-Typ über
`@obs/visu-contract` (`ionic` · `terminal` · später `bento` · `tactile`) plus
Konformitäts-Tooling.

Dieses Repo ist ein **pnpm-Workspace** (TypeScript). Es enthält ausschließlich
**Darstellung**: pro Optik ein Skin-Paket sowie das Tooling, das jeden Skin gegen den
Vertrag prüft. Modell, State und Host-Logik leben in der obs-App, nicht hier.

## Architektur in Kürze (Drei-Welten-Modell)

```
   VERTRAG  @obs/visu-contract  (reine Daten, Semver)
   Typen · Datenformen · kanonische Aktionen · Layout-Rollen · Icon-Slots · Fixtures
        ▲ implementiert                 ▲ zielt auf (targetsContract)
        │                               │
   APP  obs Visu                   SKINS  obs-visu-skins  (dieses Repo)
   Modell · DataSource · Store ──▶  ionic · terminal · …
   ctx-Helfer · Seiten · Host  rendert  renderers · Raster · Icons · Tweaks · Font
                              über Skin
```

- **App und Skins kennen einander nicht.** Beide hängen nur am Vertrag. Ein Skin hängt
  **ausschließlich** an `@obs/visu-contract`, **nie** am App-Code.
- **Ein Skin ist physisch ein Ordner** (`packages/skins/<name>/`) mit `manifest.json`,
  `renderers.ts` (eine reine Funktion je Typ, adressiert über `renderers[type]`), Styles
  sowie optional Icons/Font. Der Autor kann andere Optiken nicht beschädigen.
- **Der Skin besitzt nie State.** Renderer sind reine Funktionen über schreibgeschützte
  Daten; Gesten werden vom Host auf kanonische Aktionen abgebildet.
- **Konformität wird gemessen, nicht behauptet.** Das Tooling (`packages/tooling/`) rendert
  jeden Skin headless gegen die Vertrags-Fixtures und schreibt `support.json` je Skin
  (`full` · `partial` · `display` · `unsupported`; `gap`/`broken` = Fehler).

### Goldene Regeln (verbindlich)

1. **Kein Datenfork pro Skin** — es gibt genau ein Modell, Skins lesen es schreibgeschützt.
2. Renderer werden **nach Typ adressiert**, nicht erraten (kein `switch` mit stillem Default).
3. **„Nicht unterstützt" ist eine Pflichtangabe** (`unsupported`), kein Zufall.
4. **Der Skin besitzt nie State.**
5. **Reihenfolge + Gruppierung sind der unverhandelbare Layout-Boden**; Rollen/Spans sind
   additiv und ignorierbar.
6. **AA-Kontrast ist Pflicht**, auch an den Tweak-Extremen.
7. **Daten als JSON, Verhalten als TS/JS** — der Vertrag führt nichts aus.

Vollständige Herleitung: siehe Übergabepaket `design_handoff_visu_skins`
(`README.md`, `ARCHITECTURE.md`, `CONTRACT-v1.md`).

## Workspace-Struktur

```
obs-visu-skins/
  pnpm-workspace.yaml          # packages/skins/* · packages/tooling/*
  tsconfig.base.json           # gemeinsame strict-TS-Basis
  tsconfig.json                # Solution-Config (project references)
  eslint.config.js             # ESLint flat config (typescript-eslint + prettier)
  .prettierrc.json
  packages/
    skins/                     # ein Paket je Optik (ionic, terminal, …) — folgt
    tooling/
      contract-ref/            # zentrale Konstante: Paketname des Vertrags (U2)
```

Skin- und Tooling-Pakete entstehen in Folge-Tasks; dieses Bootstrap liefert nur das Gerüst.

## Vertrag während der Entwicklung beziehen

Der Vertrag `@obs/visu-contract` lebt im obs-Projekt (`packages/contract`, siehe
`DECISIONS.md → D4`) und ist ein eigenständig versioniertes Paket. Bis er publiziert ist,
wird er **per pnpm-Workspace-Link bzw. Git-Dependency** bezogen — nicht aus einer
Registry. Zwei unterstützte Wege:

- **Workspace-Link (Mono-Checkout):** Vertrag und Skins liegen im selben pnpm-Workspace,
  Dependency als `"@obs/visu-contract": "workspace:*"`.
- **Git-Dependency (getrennter Checkout):** Dependency als Git-URL auf das
  `packages/contract`-Unterverzeichnis des obs-Repos (z. B.
  `git+ssh://git@github.com/<org>/openbridgeserver.git#<ref>` mit `path:packages/contract`).

### Contract-Bump: eine rote CI ist hier normal (MUST lesen, bevor du sie debuggst)

Zieht der Vertrag einen Minor weiter, ist die CI dieses Repos in **zwei aufeinander
folgenden Phasen rot** — mit zwei verschiedenen Fehlerbildern und zwei verschiedenen
auflösenden Bedingungen. Wer sie verwechselt, wartet auf den falschen Merge:

1. **Vor dem Contract-Merge:** die Skins referenzieren einen Typ, den der eingehängte
   Vertrag noch nicht mitbringt. tsc meldet das englisch — `has no exported member 'X'`
   (TS2305) oder `Property 'Y' does not exist on type 'Z'` (TS2339); eine deutsche
   Fassung gibt es nur mit `--locale de`, und das setzt hier nichts.
   Auflösende Bedingung: der **Contract-Merge** drüben.
2. **Nach dem Contract-Merge:** die CI baut jetzt den neuen Vertrag, die Skin-Manifeste
   tragen aber weiter die alte `targetsContract`-Version. Die Vertragsversions-Assertion
   meldet `expected '<alt>' to be '<neu>'`.
   Auflösende Bedingung: der **Manifest-Bump** hier.

Der erste Merge macht die CI also nicht grün, er tauscht nur das Fehlerbild aus; grün wird
sie erst, wenn beide durch sind. Beides ist **kein Fehler in deinem Code**.

Grund: `.github/workflows/ci.yml` holt den Vertrag in drei getrennten Schritten heran: ein
zweiter, namenloser `actions/checkout` zieht `Micsi/openbridgeserver@feat/visu-mobile-skins`
in den Lauf, der Workflow-Schritt „Recreate dev-link path" verschiebt dieses Verzeichnis nur
und legt den absoluten `link:`-Pfad als Symlink an, und erst der Workflow-Schritt
„Build contract" kompiliert ihn. Solange die neuen Typen in diesem Branch nicht liegen, kann
hier nichts kompilieren. Wer beim Debuggen unter „Recreate dev-link path" nachsieht, findet
im Log nur `mv`, `mkdir -p` und `ln -s` — kein Checkout, kein Build.

**Reihenfolge:** erst der Contract-PR im obs-Repo, dann der Manifest-Bump hier. Dessen
`visu`-Check drüben ist im Zwischenschritt seinerseits rot — auch das ist eingebaut und im
obs-Repo unter `CONTRIBUTING-visu.md → „Contract-Bump: der rote Zwischenschritt"` samt
Freigabepflicht beschrieben. **Niemals die Reihenfolge drehen**, sonst blockieren sich
beide Seiten gegenseitig.

**Es trifft auch `main` — aber nur neu ausgeführte Läufe.** Dieses Repo kennt genau zwei
Trigger, `push` und `pull_request` auf `main`; ein Fortschritt im Vertrags-Repo feuert hier
gar nichts. Ein bereits eingetragener grüner Check an `main` oder an einem offenen PR bleibt
deshalb grün, bis er neu läuft — rot werden erst der nächste Push, der nächste PR und jeder
Rerun. Sobald der Vertrag drüben weiter
ist als die Manifeste hier, wird die Vertragsversions-Assertion **jedes** Skins rot
(`expected '<alt>' to be '<neu>'`, die Zeile misst `targetsContract` bewusst gegen den
Vertrag statt gegen ein Literal). Sie trägt pro Skin einen anderen Dateinamen — es gibt
keine gemeinsame `scaffold`-Datei, auf die man sich beim Lesen der Meldung verlassen
könnte. Und es bleibt nicht bei den Skins: der Konformitäts-Generator hält in seiner
eigenen Spec das ECHTE ionic-Manifest gegen den ECHTEN Vertrag und wird mit derselben
Meldung rot:

- `packages/skins/edomi/tests/edomi.spec.ts`
- `packages/skins/ionic/tests/smoke.spec.ts`
- `packages/skins/terminal/tests/scaffold.spec.ts`
- `packages/tooling/conformance/tests/conformance.spec.ts`

Bis der Manifest-Bump gemergt ist, erbt jeder neu geöffnete PR diese rote CI — auch ein
reiner Doku-PR, der keine Zeile Code anfasst.

**Wenn deine CI rot ist, prüfe zuerst:** Steht `expected '<alt>' to be '<neu>'` in einer
der vier Dateien oben? Dann ist es dieser Zwischenschritt, und Warten (bzw. der
Manifest-Bump) ist die richtige Handlung — nicht Reparieren.

**Ein fehlender Vertrags-Export allein belegt das NICHT.** Dieselbe Meldung
(`has no exported member 'X'`) entsteht auch bei einem vertippten oder frei erfundenen
Member.
Wer dort wartet statt zu reparieren, wartet für immer: auch der Contract-Merge löst
diesen Fehler nicht auf. Also erst nachweisen, dass der ausstehende Vertrag den genannten
Export wirklich mitbringt, dann einstufen — mit dem Contract-Worktree des ausstehenden
Contract-PR:

```sh
# 1. Bringt der ausstehende Vertrag den vermissten Member überhaupt mit?
grep -rn "<vermisster-Member>" <pfad-zum-contract-paket>/src/

# 2. Gegenprobe am ganzen Workspace: Dev-Link temporär umhängen und typecheck fahren.
#    (Das Zielpaket muss gebaut sein — `pnpm build` im Contract-Worktree.)
./scripts/contract-link.sh <pfad-zum-contract-paket>
pnpm typecheck
./scripts/contract-link.sh --restore
```

Ist der Export dort und wird `pnpm typecheck` damit grün: Zwischenschritt, warten. Fehlt
er dort, ist der Fehler deiner. Jeder ANDERE Fehler ist es ohnehin.

### U2 — Paketname des Vertrags (noch offen)

Der endgültige npm-Scope/Paketname des Vertrags ist noch offen (`@obs/visu-contract` ist
ein Vorschlag, DECISIONS.md → D4). `packages/tooling/contract-ref/index.ts` hält ihn als
Konstante bereit:

```ts
import { CONTRACT_PACKAGE } from "@obs-visu-skins/contract-ref";
// CONTRACT_PACKAGE === "@obs/visu-contract"
// Die Vertrags-ZIELversion steht nicht hier, sondern je Skin in seinem
// `manifest.targetsContract`. ACHTUNG, phasenabhängig: nach dem Release darf ein
// Skin hinter dem Vertrag herhinken — in der Dev-Link-Phase NICHT. Dort verlangt
// der App-Test (`apps/visu/tests/*-skin-link.test.ts`) exakten Gleichstand, und
// genau daraus entsteht der rote Zwischenschritt beim Contract-Bump (siehe oben).
```

**Die Konstante ist ein Angebot, keine Einzelquelle — im Repo liest sie derzeit niemand.**
Der Paketname steht ausgeschrieben in jedem Import: erhoben sind 68 Dateien unter
`packages/`, verteilt über 6 Pakete, dazu deren `dependencies`-Eintrag sowie
`scripts/contract-link.sh` und `.github/workflows/ci.yml`.

Eine Umbenennung ist deshalb ein repo-weites Suchen-und-Ersetzen über genau diese Stellen.
Die Konstante hilft dabei nicht: ein `import`-Spezifizierer muss in ESM ein String-Literal
sein, auch beim Typ-Import — sie lässt sich also gar nicht in die Importe ziehen. Sie taugt
für Fehlermeldungen und Werkzeuge, nicht als Einzelquelle des Namens.

## Voraussetzungen & Setup

- Node `>=22`, pnpm `>=10`.

```sh
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
```
