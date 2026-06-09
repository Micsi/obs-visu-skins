// @obs-visu-skins/ionic — Renderer-Stubs (CONTRACT-v1.md §3, ARCHITECTURE.md §3/§6).
//
// Golden rules: ein Skin besitzt nie State; je Typ EINE reine Renderer-Funktion,
// adressiert über den Typ-Schlüssel (renderers[type]) — niemals ein switch mit
// stillem Default. Der Renderer gibt Markup zurück und markiert nur data-action;
// der Host übersetzt Gesten auf die kanonischen Aktionen und besitzt allein den State.
//
// Diese Datei ist das M2-Foundation-Skelett: korrekt getypte, aber leere Maps,
// damit die nachfolgenden Renderer-Wellen TDD gegen die Vertrags-Fixtures fahren
// können. Jeder Eintrag wird je Kern-Typ als reine Funktion (tile + optional detail)
// ergänzt; fehlt ein Eintrag und ist der Typ nicht `unsupported`, meldet der
// Generator eine `gap` (ARCHITECTURE.md §2).

import type { CoreWidgetType, Renderer } from "@obs/visu-contract";

/** Welche Kern-Typen der Ionic-Skin rendert (Spiegel von manifest.json → widgets). */
export type IonicWidgetType = CoreWidgetType;

/** Eine partielle Map über die Kern-Typen auf reine Renderer-Funktionen. */
export type RendererMap = Partial<Record<IonicWidgetType, Renderer>>;

/**
 * Kachel-Renderer je Kern-Typ.
 * TODO(M2 Renderer-Wellen): light · switch · blind · jalousie · sensor · scene
 * als reine `Renderer`-Funktionen implementieren (Glass/iOS/MD nach Tweak `stil`).
 */
export const tiles: RendererMap = {};

/**
 * Detail-Flächen-Renderer je Kern-Typ (optional; fehlt das Detail, reicht der Host
 * ein generisches Default-Detail nach — ARCHITECTURE.md §6).
 * TODO(M2 Renderer-Wellen): Detail-Renderer ergänzen, wo die Kachel nicht genügt
 * (z. B. Helligkeits-Slider für `light`, Positions-/Lamellen-Slider für `jalousie`).
 */
export const details: RendererMap = {};
