# Manrope — Provenance & Lizenz

**Datum:** 2026-06-12
**Recherche-Stand:** 2026-06-12 (alle URLs an diesem Tag abgerufen)
**Zweck:** Entscheidungsgrundlage, ob `Manrope.woff2` in einem Open-Source-Skin-Paket mitgeliefert werden darf.

---

## Verdikt

**JA — Mitliefern erlaubt.** Manrope steht unter der **SIL Open Font License 1.1**, die das
Bündeln und Einbetten der Schrift (auch in kommerzieller Software) ausdrücklich gestattet,
solange der Lizenztext + Copyright-Notice beiliegen und die Schrift nicht *isoliert verkauft* wird.
Diese OFL-Einordnung ist über die Originalquelle und mehrere unabhängige Quellen bestätigt.

`OFL_CONFIRMED: yes`

---

## Urheber / Foundry

- **Designer:** Michael Sharanda (in Google-Fonts-Metadaten als „Mikhail Sharanda" geführt — dieselbe Person).
- **Erstveröffentlichung:** 2018 (v1.000, Juli 2018).
- **Variable-Font-Umbau:** 2019, Mirko Velimirović in Zusammenarbeit mit M. Sharanda.
- **Aktuelle Pflege für Google Fonts:** Aaron Bell (`aaronbell/manrope`) als Build-/Source-Repo.
- Beschreibung lt. Designer-Repo: „Manrope font is an open-source modern grotesque font family.
  Designed by Michael Sharanda in 2018. Supports most of Latin & Cyrillic languages."

## Offizielle Quellen

- **Projektseite (Marketing/Preview):** https://manropefont.com/
- **Designer-Repo (enthält Originalquellen `.glyphs`, OTF/TTF/WOFF2 und die `license.txt` mit Reserved Font Name):**
  https://github.com/davelab6/manrope (erstellt 2018-07-09, default branch `master`)
- **Aktuelles Google-Fonts-Build-/Source-Repo:** https://github.com/aaronbell/manrope (Fork der obigen Linie; in den Google-Fonts-`METADATA.pb` als `source.repository_url` referenziert)
- **In der Lizenz hinterlegte kanonische Upstream-URL:** `https://github.com/sharanda/manrope`
  → **Hinweis (unbestätigt):** Dieser Account/Repo-Pfad liefert aktuell (2026-06-12) **404**. Die URL existiert nur noch
  als Textreferenz innerhalb der Copyright-Zeile; sie ist nicht mehr als Live-Repo erreichbar. Das berührt die
  Lizenzgültigkeit nicht, ist aber für die Attribution zu beachten.

**Plausibilitäts-Check der „echten" Quelle:** Die niedrige Star-Zahl (`davelab6/manrope` = 27) ist hier *kein*
Warnsignal — die maßgebliche Distribution läuft über **Google Fonts**, nicht über das GitHub-Repo. `davelab6`
ist Dave Crossland (Google Fonts), `aaronbell` ist Aaron Bell (anerkannter Type-Engineer/GF-Contributor). Beide
Repos teilen dieselbe Behance-Homepage des Originalwerks. Die OFL liegt zusätzlich im offiziellen
`google/fonts`-Monorepo unter `ofl/manrope/` — das ist die belastbarste Primärquelle, da Google Fonts
ausschließlich OFL-Fonts hostet.

---

## Lizenz

**SIL Open Font License, Version 1.1 (26 February 2007).**

`LICENSE: SIL Open Font License 1.1`

### Wörtlich zitierte Copyright-/Notice-Zeile

Es existieren zwei wortgleich-lizenzierte, aber leicht unterschiedlich formulierte Notices. **Maßgeblich für die
Einbindung ist die vollständige Form aus dem Designer-Repo** (mit Reserved Font Name):

> `Copyright 2018 The Manrope Project Authors (https://github.com/sharanda/manrope), with Reserved Font Name “Manrope”.`

Quelle: https://github.com/davelab6/manrope/blob/master/license.txt
(raw: https://raw.githubusercontent.com/davelab6/manrope/master/license.txt) — abgerufen 2026-06-12.

Die über Google Fonts ausgelieferte Variable-Font-Variante trägt die verkürzte Notice (ohne den expliziten
„Reserved Font Name"-Zusatz, Jahr 2018):

> `Copyright 2018 The Manrope Project Authors (https://github.com/sharanda/manrope)`

Quelle: https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt
(raw: https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt) — abgerufen 2026-06-12.

Die `METADATA.pb` bei Google Fonts nennt zudem die per-Datei-Copyright `Copyright 2019 The Manrope Project Authors (...)`
(Jahr 2019, Variable-Font-Generation). Quelle: https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/METADATA.pb — 2026-06-12.

> **Empfehlung:** Beim Mitliefern die vollständige Designer-Notice mit Reserved Font Name verwenden, da „Manrope"
> ausweislich `davelab6/manrope/license.txt` ein **Reserved Font Name** ist. Das ist konservativer und korrekt.

### Maßgebliche OFL-Bedingungen (für unseren Use-Case)

Wörtlich aus dem Lizenz-Preamble (Google-Fonts-OFL.txt, 2026-06-12):

> „The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software
> provided that any reserved names are not used by derivative works."

Daraus für uns:

- **Bündeln/Einbetten in Software erlaubt** — ausdrücklich, auch zusammen mit kommerzieller Software.
- **Kein isolierter Verkauf** der Schrift „as is" (Verkauf *zusammen* mit Software ist erlaubt; das ist für ein
  Open-Source-Skin-Paket ohnehin nicht relevant).
- **Reserved Font Name „Manrope":** Bei **Modifikation** der Schriftdateien darf der Name „Manrope" **nicht**
  weiterverwendet werden — dann muss umbenannt werden. **Unverändertes Mitliefern ist davon nicht betroffen.**
- **Lizenz + Copyright-Notice müssen beiliegen** (`OFL.txt` mitausliefern).
- **Kein Sub-Licensing unter anderer Lizenz:** Die Schrift (und Derivate) müssen unter OFL bleiben.
  Das berührt **nicht** die Lizenz unseres restlichen Skin-/App-Codes oder der mit der Schrift gesetzten Dokumente.

---

## Auflagen für uns (beim Mitliefern einzuhalten)

1. **`OFL.txt` beilegen** — die vollständige SIL OFL 1.1 mit der Copyright-Notice unverändert ins `fonts/`-Verzeichnis
   neben die `.woff2` legen.
2. **Copyright-Notice beibehalten** — empfohlen die Designer-Form mit Reserved Font Name (s. o.).
3. **Schrift NICHT umbenennen, solange unverändert** — wir liefern sie unverändert, also bleibt der Name „Manrope" korrekt.
   Falls die Datei jemals subgesetzt/re-encodiert/modifiziert wird (z. B. eigenes Subsetting), muss geprüft werden, ob das
   als „Modified Version" gilt → dann **nicht** mehr „Manrope" im Family-Name führen. Reines verlustfreies
   Format-Repackaging (TTF→WOFF2) gilt üblicherweise nicht als verbotene Namensnutzung, ist aber im Zweifel als
   „unbestätigt" zu behandeln und konservativ zu umbenennen.
4. **Schrift nicht isoliert verkaufen** — für ein Open-Source-Paket nicht einschlägig.
5. Optional, gute Praxis: kurzer Attributions-Hinweis (Designer + Quelle + Lizenz) in der Skin-README.

---

## woff2-Bezugsquelle (reproduzierbar, lizenzsauber)

Drei gangbare Quellen; **Empfehlung: `@fontsource`** wegen versionierter, reproduzierbarer npm-Artefakte inkl. mitgelieferter `LICENSE`.

**A) Variable Font (empfohlen — eine Datei, Weights 200–800):**
- npm: `@fontsource-variable/manrope@5.2.8` (license-Feld: `OFL-1.1`)
- Datei (latin, variable wght): `https://unpkg.com/@fontsource-variable/manrope@5.2.8/files/manrope-latin-wght-normal.woff2`
- Typ: **variable** (`wght` 200..800), Style normal.

**B) Statische Einzel-Weights (falls variable nicht gewünscht):**
- npm: `@fontsource/manrope@5.2.8` (license-Feld: `OFL-1.1`, `type: google`, `version: v20`)
- Beispiel-Datei: `https://unpkg.com/@fontsource/manrope@5.2.8/files/manrope-latin-400-normal.woff2` (HTTP 200 verifiziert)
- Typ: **static**, je Datei ein Weight (z. B. 400) + Subset (latin/latin-ext/cyrillic/greek/vietnamese).

**C) Direkt von Google Fonts / gstatic (variable, v20):**
- CSS-Index: `https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap`
- Beispiel-woff2 (latin-Subset, gstatic, asset-Version v20):
  `https://fonts.gstatic.com/s/manrope/v20/...woff2` (exakter Hash-Pfad je Subset, aus obigem CSS auszulesen)
- Typ: **variable** (`font-weight: 200 800`), pro Subset eine woff2.

> Datei wurde **nicht** heruntergeladen — nur Quelle + Methode dokumentiert. Reproduktion: `npm pack @fontsource-variable/manrope@5.2.8`
> bzw. das jeweilige `unpkg.com`-File ziehen, oder das per Google-Fonts-CSS referenzierte gstatic-Asset.

---

## Aktuelle Version

- **Asset-/Distributions-Version (Google Fonts / fontsource):** `v20` (Stand 2026-06-12).
- **fontsource-Paketversion:** `5.2.8` (Wrapper-Version, ≠ Font-Version).
- **Ursprüngliche Release-Linie:** v1.000 (Juli 2018), Variable-Font ab 2019.
- Eine einzelne offizielle „Font-Version X.Y" wird im Designer-Repo nicht prominent geführt; die belastbarste
  laufende Versionsangabe ist die Google-Fonts-Asset-Version `v20`.

`FONT_VERSION: Google-Fonts-Asset v20 (urspr. v1.000 / 2018, Variable ab 2019)`

---

## Quellenliste (alle abgerufen 2026-06-12)

1. Google Fonts OFL (Primärquelle Lizenztext): https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt
2. Google Fonts METADATA.pb (Designer, Version, Source-Repo): https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/METADATA.pb
3. Designer-Repo `license.txt` (Reserved-Font-Name-Notice): https://raw.githubusercontent.com/davelab6/manrope/master/license.txt
4. Designer-Repo README (Urheber, Changelog): https://raw.githubusercontent.com/davelab6/manrope/master/README.md
5. Designer-Repo Übersicht: https://github.com/davelab6/manrope
6. Aktuelles Source-/Build-Repo (Google Fonts): https://github.com/aaronbell/manrope + OFL.txt: https://raw.githubusercontent.com/aaronbell/manrope/master/OFL.txt
7. Build-Config (Axis/Weights): https://raw.githubusercontent.com/aaronbell/manrope/master/sources/config.yaml
8. Projekt-Homepage: https://manropefont.com/
9. fontsource (statisch) npm — license `OFL-1.1`, version v20: https://www.npmjs.com/package/@fontsource/manrope (`https://registry.npmjs.org/@fontsource/manrope/latest`, `https://unpkg.com/@fontsource/manrope@5.2.8/metadata.json`)
10. fontsource (variable) npm — license `OFL-1.1`: https://registry.npmjs.org/@fontsource-variable/manrope/latest
11. Google Fonts CSS2 (gstatic woff2 v20): https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap
12. Behance-Originalwerk (Marketing-Homepage der Repos): https://www.behance.net/gallery/67424063/Manrope-Modern-Geometric-Sans-Serif-font-family

## Restunsicherheiten

- Die in der Copyright-Zeile zitierte URL `https://github.com/sharanda/manrope` liefert 404 (Account/Repo nicht mehr
  live). Reine Textreferenz; **Lizenzgültigkeit unberührt**. (markiert: unbestätigt, ob der Account je „sharanda" hieß
  oder umbenannt wurde.)
- Format-Repackaging TTF→WOFF2 als „nicht-modifizierend" ist gängige Praxis, aber juristisch nicht trennscharf durch die
  OFL geregelt → bei eigenem Subsetting konservativ umbenennen.
