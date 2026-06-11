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

/** Welche Kern-Typen der Terminal-Skin rendert (Spiegel von manifest.json → widgets). */
export type TerminalWidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<TerminalWidgetType, Renderer>>;

/**
 * Listen-Zeilen-Renderer je Kern-Typ — reine `Renderer`-Funktionen.
 * TE1-Scaffold: noch leer; TE2 verdrahtet die sechs v1-Kern-Typen.
 */
export const tiles: RendererMap = {};

/**
 * Detail-Flächen-Renderer je Kern-Typ (optional; fehlt das Detail, reicht der Host
 * ein generisches Default-Detail nach — ARCHITECTURE.md §6).
 * TE1-Scaffold: noch leer; TE2 verdrahtet die bedienbaren Typen.
 */
export const details: RendererMap = {};
