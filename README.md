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

Zieht der Vertrag einen Minor weiter, ist die CI dieses Repos **rot, bis der zugehörige
Contract-PR drüben gemergt ist** — mit Typfehlern der Form „hat keinen exportierten
Member X" oder „Property Y existiert nicht auf Z". Das ist **kein Fehler in deinem Code**.

Grund: Der Workflow-Schritt „Recreate dev-link path" (`.github/workflows/ci.yml`) checkt
`Micsi/openbridgeserver@feat/visu-mobile-skins` aus und baut den Vertrag von dort. Solange
die neuen Typen in diesem Branch nicht liegen, kann hier nichts kompilieren.

**Reihenfolge:** erst der Contract-PR im obs-Repo, dann der Manifest-Bump hier. Dessen
`visu`-Check drüben ist im Zwischenschritt seinerseits rot — auch das ist eingebaut und im
obs-Repo unter `CONTRIBUTING-visu.md → „Contract-Bump: der rote Zwischenschritt"` samt
Freigabepflicht beschrieben. **Niemals die Reihenfolge drehen**, sonst blockieren sich
beide Seiten gegenseitig.

**Wenn deine CI rot ist, prüfe zuerst:** Steht die Vertragsversion, gegen die du baust,
schon in `feat/visu-mobile-skins`? Wenn nein, ist Warten die richtige Handlung, nicht
Reparieren.

### U2 — Paketname zentral als eine Konstante

Der endgültige npm-Scope/Paketname des Vertrags ist noch offen (`@obs/visu-contract` ist
ein Vorschlag, DECISIONS.md → D4). Damit eine spätere Umbenennung trivial bleibt,
referenziert dieses Repo den Namen **nur über eine einzige Konstante**:

```ts
import { CONTRACT_PACKAGE } from "@obs-visu-skins/contract-ref";
// CONTRACT_PACKAGE === "@obs/visu-contract"
// Die Vertrags-ZIELversion steht nicht hier, sondern je Skin in seinem
// `manifest.targetsContract`. ACHTUNG, phasenabhängig: nach dem Release darf ein
// Skin hinter dem Vertrag herhinken — in der Dev-Link-Phase NICHT. Dort verlangt
// der App-Test (`apps/visu/tests/*-skin-link.test.ts`) exakten Gleichstand, und
// genau daraus entsteht der rote Zwischenschritt beim Contract-Bump (siehe oben).
```

Wird der Vertrag umbenannt, ändert sich genau diese Konstante
(`packages/tooling/contract-ref/index.ts`) plus die jeweilige `dependencies`-Angabe der
Skin-Pakete — kein verstreuter hartkodierter String.

## Voraussetzungen & Setup

- Node `>=22`, pnpm `>=10`.

```sh
pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
```
