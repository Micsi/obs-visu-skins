// @obs-visu-skins/terminal — Renderer-Map (CONTRACT-v1.md §3, ARCHITECTURE.md §3/§6).
//
// Goldene Regeln: ein Skin besitzt nie State; je Typ EINE reine Renderer-Funktion,
// adressiert über den Typ-Schlüssel (renderers[type]) — niemals ein switch mit
// stillem Default. Der Renderer gibt Markup zurück und markiert nur data-action;
// der Host übersetzt Gesten auf die kanonischen Aktionen und besitzt allein den State.
//
// ---------------------------------------------------------------------------
// Vertragsstand: targetsContract "1.10" (vorher "1.1").
//
// Der Nachzug über neun Minor-Versionen ist bewusst pro Fläche entschieden, nicht
// bloß eine erhöhte Zahl im Manifest:
//   • v1.2 media/camera, v1.4 climate — alle drei waren pauschal `unsupported`,
//     obwohl diese Deklaration noch gegen 1.1 geschrieben wurde, als sie gar keine
//     Kern-Typen waren. Terminal rendert sie jetzt (siehe tiles unten); `unsupported`
//     ist damit leer — und bleibt leer, damit ein künftiger Vertrags-Bump einen
//     neuen Kern-Typ wieder als `gap` sichtbar macht statt ihn stillzustellen.
//   • v1.1 `ctx.t` — Befehls-/Statuswörter laufen über src/i18n.ts (`skin.terminal.*`).
//   • v1.4 `ctx.stateParts` (Zustandswort fett) + `SensorDevice.series/min/max`
//     (Inline-Sparkline im sensor-Renderer).
//   • v1.5 `DeviceBase.writable` — nicht schreibbare Geräte verlieren ihre
//     data-action, statt Bedienbarkeit vorzutäuschen.
//   • v1.6 `presets`/`applyPreset` — Vorgabepositionen als benannte Befehle
//     ([Beschattung] …), was der Terminal-Sprache entspricht.
//   • v1.7 `gestures` — tap = markierte Aktion, Long-Press = Host-Default-Detail.
//   • v1.8 `ctx.floorShort` — Eyebrow als „<Kürzel> <Raum>".
//   • v1.9 Layering (`position`/`layers`/`popup`) und v1.10 Page-Renderer:
//     BEWUSST nicht übernommen. Terminal ist listenbasiert und misst sich am
//     verfügbaren Platz statt an Autoren-Pixeln: terminal.css gibt der Zeile
//     `flex-wrap` und eine Container-Query, die unter ~520 px auf Label/Zustand/
//     Befehle untereinander umstellt — geprüft in einer 371-px-Spalte, ohne
//     Horizontalscroll und ohne gekürzte Labels. Ein Pixel-Layout, ein Layer-Stack
//     oder modale Popups haben darin keine Entsprechung. `layout.honors` deklariert
//     deshalb nur `order` + `grouping` (der Layout-Boden, Goldene Regel 5) und der
//     Skin exportiert keinen `PageRenderer` — die Seite gehört weiter dem Host.
//     Auch `role` steht nicht mehr in `honors`: terminal hat keine `roleMap` und
//     eine einspaltige Liste hat keinen Rollen-Footprint, die Deklaration war ein
//     ungedeckter Anspruch.
// ---------------------------------------------------------------------------

import type { CoreWidgetType, Renderer } from "@obs/visu-contract";

import { lightTile } from "./src/tiles/light.js";
import { switchTile } from "./src/tiles/switch.js";
import { blindTile } from "./src/tiles/blind.js";
import { jalousieTile } from "./src/tiles/jalousie.js";
import { sensorTile } from "./src/tiles/sensor.js";
import { sceneTile } from "./src/tiles/scene.js";
import { mediaTile } from "./src/tiles/media.js";
import { cameraTile } from "./src/tiles/camera.js";
import { climateTile } from "./src/tiles/climate.js";

/** Welche Kern-Typen der Terminal-Skin rendert (Spiegel von manifest.json → widgets). */
export type TerminalWidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<TerminalWidgetType, Renderer>>;

/**
 * Listen-Zeilen-Renderer je Kern-Typ — reine `Renderer`-Funktionen (eine Zeile pro
 * Gerät, monospace-/konsolenartig, kein Raster). Vollständig für ALLE neun Kern-Typen
 * des Vertrags 1.10. Adressierung über den Typ-Schlüssel (tiles[type]); die in
 * manifest.json deklarierten Aktionen werden hier exakt gespiegelt — nicht verdrahtete
 * Aktionen (light.setDim, jalousie.setSlat, media.setVolume) werden ANGEZEIGT, aber nie
 * als Bedienelement vorgetäuscht. Der Konformitäts-Generator rechnet daraus `full`
 * bzw. `partial` aus; `display` bei sensor (der Vertrag kennt dort keine Aktion).
 */
export const tiles: RendererMap = {
  light: lightTile,
  switch: switchTile,
  blind: blindTile,
  jalousie: jalousieTile,
  sensor: sensorTile,
  scene: sceneTile,
  media: mediaTile,
  camera: cameraTile,
  climate: climateTile,
};

/**
 * Detail-Flächen-Renderer je Kern-Typ.
 *
 * Terminal liefert BEWUSST keine eigenen Detail-Flächen: die schlichte Listen-/
 * Konsolenoptik bedient direkt in der Zeile. Fehlt ein Detail, reicht der Host ein
 * generisches Default-Detail nach (ARCHITECTURE.md §6) — genau dieses Host-Default-
 * Detail nutzt der Terminal-Skin. Die Map bleibt daher leer.
 */
export const details: RendererMap = {};
