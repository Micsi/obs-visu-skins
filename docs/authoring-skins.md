# Skin-Authoring-Guide

Ein **Skin** ist physisch ein Ordner unter `packages/skins/<name>/`: ein `manifest.json`,
ein `renderers.ts` (eine reine Renderer-Funktion je Kern-Typ, adressiert über
`tiles[type]`) und ein Test. App und Skins kennen einander nicht — beide hängen nur am
Vertrag `@obs/visu-contract`. Dieser Guide ist der End-to-End-Workflow vom leeren Ordner
bis zum in der App registrierten Skin.

## Goldene Regeln (immer)

1. **Kein State.** Renderer sind reine Funktionen über schreibgeschützte Daten; nie
   `d.x = …`. Gesten markierst du nur als `data-action="<kanonische Aktion>"` — der Host
   besitzt allein den State und übersetzt Gesten.
2. **Adressierung über den Typ-Schlüssel** (`tiles[type]`) — niemals ein `switch` mit
   stillem Default. Fehlt ein Eintrag und ist der Typ nicht `unsupported`, ist das eine
   `gap`.
3. **`unsupported` ist Pflicht.** Was dein Skin nicht rendert, deklarierst du ehrlich
   (z. B. `"unsupported": ["camera", "media"]`). Wähle nur ab, was wirklich nicht zu
   deinem Modell passt — eine pauschale Abwahl stellt den Typ still und nimmt dir die
   `gap`-Meldung, wenn der Vertrag ihn später erweitert. Rendert dein Skin alles, bleibt
   die Angabe als leeres Array stehen.
4. **AA-Pflicht.** Farben nur über die `Tokens`-Helfer (`t.accent`, `t.accentInk`) — die
   liefern AA-sichere Werte. Keine hartkodierten Kontraste.

## 0. Setup

```bash
pnpm install
```

## 1. Scaffold

```bash
pnpm new-skin <name>                # Grid-Layout (Default)
pnpm new-skin <name> --layout list  # Listen-Layout
```

Das erzeugt `packages/skins/<name>/` mit `package.json`, `manifest.json`, `renderers.ts`,
`tsconfig.json` und `tests/scaffold.spec.ts` — und trägt das Paket **automatisch** in die
Root-`tsconfig.json` (`references`) ein. Das frische Skin ist sofort konformitäts-grün:
jeder der neun Kern-Typen (`light · switch · blind · jalousie · sensor · scene · media ·
camera · climate`) hat einen **Platzhalter-Renderer** (eine schlichte Kachel: Label · Typ ·
Zustand), `targetsContract` steht auf der aktuellen Vertragsversion und die Aktionen sind
der vollständige kanonische Satz. Danach einmal:

```bash
pnpm install        # neues Paket verlinken
```

## 2. Manifest + Renderer ausfüllen

- `manifest.json` → `widgets.<type>.actions`: welche **kanonischen** Aktionen dein Skin je
  Typ verdrahtet (`toggle`, `setDim`, `setPosition`, `setSlat`, `applyPreset`, `lock`,
  `unlock`, `activateScene`, `setSetpoint`, `playPause`, `stop`, `next`, `previous`,
  `setVolume`, `refresh`). Streiche, was du nicht anbietest — Terminal lässt z. B.
  `setSlat`, `setDim` und `setVolume` weg und ZEIGT die Werte nur an. Was du streichst,
  darfst du im Renderer auch nicht als `data-action` markieren.
- `manifest.json` → `layout.honors`: nur die Fähigkeiten, die du wirklich umsetzt
  (`order`/`grouping` sind der Boden; `role` erst mit einer `roleMap`, `position`/`layers`/
  `popup` erst mit einem Pixel-/Overlay-Layout).
- `renderers.ts` → ersetze `placeholderTile` Stück für Stück durch echte Renderer. Lagere
  pro Typ in `src/tiles/<type>.ts` aus (vgl. `packages/skins/terminal/src/tiles/`). Jede
  Funktion hat die Signatur `(d, t, ctx) => VNode` (Vue `h()`).
- Detailflächen (`details`) sind optional: leer lassen → der Host reicht ein generisches
  Default-Detail nach.

## 3. Konformität messen

Der Konformitäts-Generator (`@obs-visu-skins/conformance`) prüft je Kern-Typ: er muss
**entweder** einen `tiles`-Renderer **und** einen `widgets`-Eintrag haben **oder** in
`unsupported` stehen. Danach jagt er jede Vertrags-Fixture des Typs headless durch deinen
Renderer und vergibt die Stufe — du behauptest sie nie selbst:

| Stufe         | Bedeutung                                                                     |
| ------------- | ----------------------------------------------------------------------------- |
| `full`        | rendert und verdrahtet **alle** kanonischen Aktionen des Typs                 |
| `partial`     | rendert und verdrahtet **einen Teil** (`actions: "4/5"` nennt welchen Anteil) |
| `display`     | rendert; der Vertrag kennt keine Aktion (`sensor`) oder du verdrahtest keine  |
| `unsupported` | bewusst abgewählt                                                             |
| `gap`         | **Fehler** — weder gerendert noch abgewählt                                   |
| `broken`      | **Fehler** — der Renderer wirft an einer Fixture                              |

`gap` und `broken` setzen den Exit-Code ≠ 0. Das frische Scaffold ist bereits grün.

Trage dein Skin ins CI-Gate ein und fahre es:

```bash
# 1. in packages/tooling/conformance/gate.spec.ts → SKINS-Liste "@obs-visu-skins/<name>" ergänzen
# 2. in packages/tooling/conformance/package.json → devDependency "@obs-visu-skins/<name>": "workspace:*"
pnpm install
pnpm --filter @obs-visu-skins/conformance gate
```

Das Gate fährt den Generator über jeden gelisteten Skin und wird bei jeder `gap` rot —
genau wie in der CI. (Der Generator ist auch als Funktion `generateSupport(skin)` aus
`@obs-visu-skins/conformance` importierbar, falls du ihn in eigenen Tests aufrufen willst.)

## 4. Visuell prüfen

```bash
pnpm --filter @obs-visu-skins/fixture-wand dev
```

Öffne die genannte URL (Vite meldet sie, üblicherweise <http://localhost:5173/>). Die
Fixture-Wand rendert jede Vertrags-Fixture (jeder Typ × jeder Zustand) durch die Renderer
eines gewählten Skins — eine visuelle Vollständigkeits-Wand. Oben schaltest du **Skin** und
**Theme** um; die Kopfzeile zählt `ok · unsupported · gap · broken`. Rote Zellen (`gap`,
`broken`) sind deine To-do-Liste; bewusst abgewählte Typen erscheinen neutral gestrichelt.
Ein neuer Skin wird in `packages/tooling/fixture-wand/src/main.ts` in die `SKINS`-Registry
eingetragen (Manifest, `tiles`, Stylesheet, Wurzel-Element/Theme-Attribute).

## 5. Tests + Gates

```bash
pnpm --filter @obs-visu-skins/<name> test   # vitest run --typecheck
pnpm typecheck                              # tsc --build (gesamter Workspace)
pnpm lint
```

Erweitere `tests/scaffold.spec.ts` (oder lege `tests/tiles.spec.ts` an) mit echten
Form-Tests gegen die Vertrags-Fixtures, sobald du die Platzhalter ersetzt
(vgl. `packages/skins/terminal/tests/tiles.spec.ts`).

## 6. In der App registrieren

Im App-Repo (`openbridgeserver`, Visu-Integration):

1. **Dev-Link** in `apps/visu/package.json` ergänzen:
   `"@obs-visu-skins/<name>": "link:../../../obs-visu-skins/packages/skins/<name>"`,
   dann `pnpm install`.
2. **Host-Registry** `apps/visu/src/skin-host/skins.ts` um den Skin erweitern (Import von
   `tiles`/`details` + `manifest.json`, eingetragen unter dem Skin-Key `<name>`).
3. **Seite** mit `skin: "<name>"` im Seiten-Key anlegen/zuordnen — der Host adressiert den
   Renderer nach Typ über die Registry.

Damit rendert die App deine Optik, ohne dass Skin und App je voneinander wissen — beide
hängen nur am Vertrag.
