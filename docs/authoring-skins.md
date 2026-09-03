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
4. **AA-Pflicht — und sie wird GEMESSEN.** Farben im Renderer nur über die
   `Tokens`-Helfer (`t.accent`, `t.accentInk`); die eigentliche Palette lebt in deinem
   Stylesheet und wird in `manifest.json → a11y` deklariert. Der Konformitätslauf liest
   dein Blatt und rechnet WCAG darauf — auch an den Extremen jedes farbwirksamen Tweaks.
   Ohne `a11y`-Block meldet er `undeclared` und wird rot: AA ist Pflicht, und
   „ungemessen" ist nicht dasselbe wie „bestanden" (Schritt 3a).

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
`<name>.css`, `tsconfig.json` und `tests/scaffold.spec.ts` — und trägt das Paket
**automatisch** in die Root-`tsconfig.json` (`references`) ein. Das frische Skin ist sofort konformitäts-grün:
jeder Kern-Typ des Vertrags (`light · switch · blind · jalousie · sensor · scene · media ·
camera · climate` — die Liste kommt **aus dem Schema**, nicht aus dem Scaffold) hat einen
**Platzhalter-Renderer** (eine schlichte Kachel: Label · Typ · Zustand) und
`targetsContract` steht auf der aktuellen Vertragsversion.

`<name>.css` bringt eine **gemessen AA-sichere Startpalette** in beiden Themes mit
(alle acht Akzent-Token des Vertrags plus Grund/Fläche/Text), und `manifest.json → a11y`
deklariert, welcher Token welche Rolle trägt. Ein frisches Skin ist damit nicht nur
gap-frei, sondern AA-**gemessen** grün — du fängst über der Schwelle an und siehst
sofort, wenn deine eigene Farbwahl darunter fällt.

**Die Aktionslisten sind absichtlich leer.** Ein frisches Skin ist `display`-only: es zeigt
jeden Typ an und behauptet keine einzige Bedienung. Aktionen kommen erst dazu, wenn du sie
wirklich verdrahtest — und zwar **paarweise**: der Eintrag in `widgets.<type>.actions` und
der `data-action`-Marker im Renderer. Der Konformitätslauf misst den Marker im erzeugten
Markup, eine Deklaration allein hebt die Stufe nicht. Danach einmal:

```bash
pnpm install        # neues Paket verlinken
```

> **Achtung, Dev-Link:** `pnpm install` legt die `link:`-Symlinks auf
> `@obs/visu-contract` neu an — immer auf den Pfad aus `package.json`
> (`…/openbridgeserver-visu-integrate/packages/contract`). Wer den Vertrag gerade in
> einem ANDEREN Worktree ändert, muss nach jedem Install wieder umhängen
> (`./scripts/contract-link.sh <pfad>`), sonst misst der Lauf gegen den alten Vertrag —
> und `targetsContract` im frischen Manifest steht dann auf dessen Version.

## 2. Manifest + Renderer ausfüllen

- `manifest.json` → `widgets.<type>.actions`: welche **kanonischen** Aktionen dein Skin je
  Typ verdrahtet (`toggle`, `setDim`, `setPosition`, `setSlat`, `applyPreset`, `lock`,
  `unlock`, `activateScene`, `setSetpoint`, `playPause`, `stop`, `next`, `previous`,
  `setVolume`, `refresh`). Die Listen starten **leer** — trag nur ein, was du wirklich
  anbietest. Terminal lässt z. B. `setSlat`, `setDim` und `setVolume` bewusst weg und
  ZEIGT die Werte nur an. Was nicht in der Liste steht, darfst du im Renderer auch nicht
  als `data-action` markieren (das meldet der Lauf als `broken`) — und was drinsteht,
  aber nirgends markiert ist, hebt die Stufe nicht. Deklaration und Marker gehören
  zusammen; eine Aktion, die der Vertrag gar nicht kennt, ist ebenfalls `broken`.
- `manifest.json` → `layout.honors`: nur die Fähigkeiten, die du wirklich umsetzt. Das
  anerkannte Vokabular steht als geprüfte Liste im Vertrag
  (`contract.schema.json → layoutHonors`): `order`/`grouping` sind der Boden; `role` erst
  mit einer `roleMap`, `position`/`layers`/`popup` erst mit einem Pixel-/Overlay-Layout,
  `nav` erst mit eigener Navigation, `link` (ab Vertrag 1.12) erst, wenn du das Sprungziel
  eines platzierten Elements (`LayerItem.link`) auch wirklich als Affordanz zeichnest.
  `link` steckt **nicht** in `layers`: Layer zu rendern und den Link fallenzulassen ist
  erlaubt — dann darf `link` aber auch nicht dastehen (Goldene Regel 3). Zeichnest du ihn,
  dann ausschliesslich über die Host-Dienste `resolveLink` / `followLink` / `isLinkActive` /
  `linkLabel` am `PageHost`; ein eigener Abstieg durch den `navTree` ist ein Regelbruch
  (Goldene Regel 4).
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

`gap` und `broken` setzen den Exit-Code ≠ 0 — **und seit Vertrag 1.13 auch alles, was
nicht `a11y: pass` ist** (Schritt 3a). Das frische Scaffold ist auf beiden Achsen bereits
grün.

### 3a. AA deklarieren (Vertrag 1.13)

Der Generator misst Render- und Aktions-Achse am erzeugten Markup — Farbe steht dort
nicht. Damit er auch die **Farb-Achse** messen kann, deklarierst du in
`manifest.json → a11y`, was deine Farben TUN; die WERTE liest er aus deinem Stylesheet.
Du deklarierst also nie ein Kontrastverhältnis (das wäre beim nächsten Farbdreher still
falsch), sondern nur die Semantik:

```jsonc
"a11y": {
  "stylesheet": "./mein.css",              // relativ zum Manifest, oder ein Paket-Export
  "base": ":root",                          // optional: themenunabhängiger Token-Block
  "themes": { "dark": ".mein-root[data-theme=\"dark\"]" },
  "grounds": [
    { "token": "--bg" },                    // der erste Grund muss DECKEND sein
    { "token": "--tile", "over": "--bg" }   // durchscheinend? dann sag, was darunter liegt
  ],
  "alphas": [1],                            // Deckkräfte, die du auf Farbe legst
  "tokens": {
    "--bg":   { "role": "ground" },
    "--fg":   { "role": "text", "on": ["--bg", "--tile"] },
    "--dot":  { "role": "graphic", "on": ["--tile"] },
    "--grad": { "role": "exempt", "reason": "Verlauf, kein flaches Pixel" }
  },
  "tweakAxes": [{ "tweak": "tileAlpha", "cssVar": "--tile-alpha" }]
}
```

Vier Rollen, aus dem Vertrag (`contract.schema.json → a11y.roles`):

| Rolle     | Schwelle              | wofür                                            |
| --------- | --------------------- | ------------------------------------------------ |
| `text`    | 4.5:1 (WCAG 1.4.3)    | alles, was Schrift einfärbt                       |
| `graphic` | 3:1 (WCAG 1.4.11)     | bedeutungstragende Nicht-Text-Grafik              |
| `ground`  | —                     | Fläche, gegen die gemessen wird                   |
| `exempt`  | —                     | bewusst ausgenommen, **`reason` ist Pflicht**     |

Was dich davon abhält, dich grün zu deklarieren:

- **Vollständigkeit.** Jede Farb-Deklaration in einem erklärten Block MUSS eine Rolle
  haben. Die unbequeme Farbe wegzulassen ist selbst der Befund (`unclassified`).
- **`on` ist eine Einschränkung, kein Muss.** Lässt du es weg, misst der Generator gegen
  JEDEN Grund — die strengere Lesart. Einschränken musst du hinschreiben (und dann steht
  im Report, worauf du dich festgelegt hast).
- **Tweak-Extreme (CO5).** Jede Achse in `tweakAxes` wird an beiden Enden angefahren
  (`slider` → `min`/`max`, `select` → jede Option). Ein Kontrast, der nur in der
  Werkseinstellung hält, ist damit kein Bestehen mehr. Hat dein Skin keinen
  farbwirksamen Tweak, lässt du `tweakAxes` weg — der Report zeigt dann
  `tweakStops: ["default"]`, die Aussage bleibt also nachlesbar.
- **`undeclared` ≠ `pass`.** Ohne `a11y`-Block steht im Report ausdrücklich
  `"status": "undeclared"` — unterscheidbar von einem Skin, der deklariert und besteht
  (Goldene Regel 3).

Was der Lauf **nicht** misst (und auch nicht behauptet zu messen): ob ein Token wirklich
dort steht, wo dein `on` es hinsetzt; Deckkräfte, die du nicht in `alphas` nennst;
Schriftgrössen (jeder Text wird an 4.5:1 gemessen, nie an den 3:1 für grossen Text);
Verläufe und Schatten. Der Kopf von `packages/tooling/conformance/a11y.ts` führt das
vollständig aus.

Der `a11y`-Block landet in `support.json`:

```jsonc
"a11y": {
  "status": "pass", "aa": true, "checkedTweakExtremes": true,
  "thresholds": { "text": 4.5, "graphic": 3 },
  "themes": ["dark", "light"], "tweakStops": ["default"],
  "combinations": 88,
  "worst": { "text": { "token": "--t-acc-amber", "ratio": 4.58, … } },
  "violationCount": 0, "violations": [], "findings": []
}
```

`worst` ist die knappste bestandene Paarung je Rolle — dein Abstand zur Schwelle.

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
Ein neuer Skin braucht in der Wand **drei** Handgriffe, nicht einen:

1. `packages/tooling/fixture-wand/package.json` → `dependencies` um
   `"@obs-visu-skins/<name>": "workspace:*"` ergänzen, dann `pnpm install`.
2. `packages/tooling/fixture-wand/src/stubs.ts` → einen `Tokens`-Stub exportieren, der
   auf DEINE Akzent-Variablen zeigt:
   `export const <name>Tokens = tokensFor("--s-acc-", "--s-accent-ink", "system-ui");`
   Ohne ihn löst `t.accent(d.accent)` ins Leere auf und die Wand zeigt Fallback statt
   deiner Optik.
3. `packages/tooling/fixture-wand/src/main.ts` → Importe (`* as <name>`,
   `<name>/manifest.json`, `<name>/<name>.css?raw`) plus einen `SKINS`-Eintrag mit
   `manifest`, `tiles`, `tokens`, `css` und `root(theme)` (Wurzelklasse +
   `data-theme`-Attribut).

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

1. **Dev-Link** in `apps/visu/package.json` ergänzen. Der Pfad ist **absolut**, wie bei
   den bestehenden Einträgen:
   `"@obs-visu-skins/<name>": "link:/Volumes/Daten/Projekte/openbridge/obs-visu-skins/packages/skins/<name>"`,
   dann `pnpm install`.
2. **Stylesheet importieren** — sonst rendert die Seite unformatiertes Markup, während
   die jsdom-Tests grün bleiben (Struktur sind keine Pixel):
   `import '@obs-visu-skins/<name>/<name>.css';` in `apps/visu/src/main.ts` (so machen es
   ionic/terminal) oder in `apps/visu/src/pages/SkinPage.vue`.
3. **Host-Registry** `apps/visu/src/skin-host/skins.ts` um den Skin erweitern: Import von
   `tiles`/`details` (+ optional `presets`, `page`) und `manifest.json`, eingetragen unter
   dem Skin-Key `<name>`. **`rootClass` ist Pflicht** und muss exakt die Klasse sein, auf
   die dein Stylesheet gescoped ist (`.<name>-root` beim Scaffold) — sie ist der zweite
   Teil desselben Problems wie Punkt 2.
4. **Seite** mit `skin: "<name>"` im Seiten-Key anlegen/zuordnen — der Host adressiert den
   Renderer nach Typ über die Registry.

Damit rendert die App deine Optik, ohne dass Skin und App je voneinander wissen — beide
hängen nur am Vertrag.
