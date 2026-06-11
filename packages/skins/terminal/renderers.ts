// @obs-visu-skins/terminal — Renderer-Map (CONTRACT-v1.md §3, ARCHITECTURE.md §3/§6).
//
// Golden rules: ein Skin besitzt nie State; je Typ EINE reine Renderer-Funktion,
// adressiert über den Typ-Schlüssel (renderers[type]) — niemals ein switch mit
// stillem Default. Der Renderer gibt Markup zurück und markiert nur data-action;
// der Host übersetzt Gesten auf die kanonischen Aktionen und besitzt allein den State.
//
// TE1-Scaffold: Nur die getypte Export-Form (tiles + details). Die reinen
// Renderer-Funktionen liefert das Folge-Issue TE2 und füllt diese Maps.
// Fehlt ein Eintrag und ist der Typ nicht `unsupported`, meldet der Generator
// eine `gap` (ARCHITECTURE.md §2).

import type { CoreWidgetType, Renderer } from "@obs/visu-contract";

import { lightTile } from "./src/tiles/light.js";
import { switchTile } from "./src/tiles/switch.js";
import { blindTile } from "./src/tiles/blind.js";
import { jalousieTile } from "./src/tiles/jalousie.js";
import { sensorTile } from "./src/tiles/sensor.js";
import { sceneTile } from "./src/tiles/scene.js";

/** Welche Kern-Typen der Terminal-Skin rendert (Spiegel von manifest.json → widgets). */
export type TerminalWidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<TerminalWidgetType, Renderer>>;

/**
 * Listen-Zeilen-Renderer je Kern-Typ — reine `Renderer`-Funktionen (eine Zeile pro
 * Gerät, monospace-/konsolenartig). Vollständig für alle sechs v1-Kern-Typen:
 * light · switch · blind · jalousie · sensor · scene. Adressierung über den Typ-
 * Schlüssel (tiles[type]); die in manifest.json deklarierten partiellen Aktionen
 * werden hier exakt gespiegelt (jalousie z. B. ohne setSlat), damit der
 * Konformitäts-Generator keine `gap` meldet.
 */
export const tiles: RendererMap = {
  light: lightTile,
  switch: switchTile,
  blind: blindTile,
  jalousie: jalousieTile,
  sensor: sensorTile,
  scene: sceneTile,
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
