// @obs-visu-skins/ionic — Renderer-Map (CONTRACT-v1.md §3, ARCHITECTURE.md §3/§6).
//
// Golden rules: ein Skin besitzt nie State; je Typ EINE reine Renderer-Funktion,
// adressiert über den Typ-Schlüssel (renderers[type]) — niemals ein switch mit
// stillem Default. Der Renderer gibt Markup zurück und markiert nur data-action;
// der Host übersetzt Gesten auf die kanonischen Aktionen und besitzt allein den State.
//
// Diese Datei verdrahtet die in der M2-Renderer-Welle gelieferten reinen
// Renderer-Funktionen (je Kern-Typ tile + optional detail) zu den getypten Maps.
// Fehlt ein Eintrag und ist der Typ nicht `unsupported`, meldet der Generator
// eine `gap` (ARCHITECTURE.md §2).

import type { CoreWidgetType, Renderer } from "@obs/visu-contract";

import { LightTile } from "./src/tiles/LightTile.js";
import { SwitchTile } from "./src/tiles/SwitchTile.js";
import { blindTile } from "./src/tiles/BlindTile.js";
import { jalousieTile } from "./src/tiles/JalousieTile.js";
import { SensorTile } from "./src/tiles/Sensor.js";
import { SceneTile } from "./src/tiles/Scene.js";

import { LightDetail } from "./src/details/LightDetail.js";
import { SwitchDetail } from "./src/details/SwitchDetail.js";
import { blindDetail } from "./src/details/BlindDetail.js";
import { jalousieDetail } from "./src/details/JalousieDetail.js";

/** Welche Kern-Typen der Ionic-Skin rendert (Spiegel von manifest.json → widgets). */
export type IonicWidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<IonicWidgetType, Renderer>>;

/**
 * Kachel-Renderer je Kern-Typ — reine `Renderer`-Funktionen (Glass/iOS/MD nach Tweak `stil`).
 * Vollständig für alle sechs v1-Kern-Typen: light · switch · blind · jalousie · sensor · scene.
 */
export const tiles: RendererMap = {
  light: LightTile,
  switch: SwitchTile,
  blind: blindTile,
  jalousie: jalousieTile,
  sensor: SensorTile,
  scene: SceneTile,
};

/**
 * Detail-Flächen-Renderer je Kern-Typ (optional; fehlt das Detail, reicht der Host
 * ein generisches Default-Detail nach — ARCHITECTURE.md §6).
 * Vorhanden für die bedienbaren Typen: light · switch · blind · jalousie.
 * sensor (read-only) und scene (one-shot) brauchen keine Detail-Fläche.
 */
export const details: RendererMap = {
  light: LightDetail,
  switch: SwitchDetail,
  blind: blindDetail,
  jalousie: jalousieDetail,
};

// Tweaks-Verdrahtung: Root-Attribute/Style aus Daten-Tweaks (Daten=JSON, Verhalten=Code).
// ionic.css wird über package.json `exports["./ionic.css"]` ausgeliefert.
export { applyTweaks, TWEAK_DEFAULTS } from "./src/tweaks.js";
export type {
  IonicTweaks,
  IonicStil,
  IonicTheme,
  AccentStyle,
  RoomGroup,
  RootAttrs,
  RootTweakStyle,
} from "./src/tweaks.js";
