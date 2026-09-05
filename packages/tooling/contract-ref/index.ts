/**
 * Zentrale Konstante für den Paketnamen des Vertrags.
 *
 * U2 (offene Frage): npm-Scope/Paketname des Vertrags ist noch nicht endgültig.
 * `@obs/visu-contract` ist ein Vorschlag (DECISIONS.md → D4).
 *
 * **Diese Konstante ist KEINE Einzelquelle des Namens, auch wenn ihr Name das nahelegt.**
 * Sie wird im Repo derzeit nirgends gelesen, und der Paketname steht in jedem Import
 * ausgeschrieben — Dutzende Stellen unter `packages/`, dazu die `dependencies`-Einträge,
 * `scripts/contract-link.sh` und `.github/workflows/ci.yml`. Eine Umbenennung ist ein
 * repo-weites Suchen-und-Ersetzen.
 *
 * Sie lässt sich auch nicht nachträglich zur Einzelquelle machen: ein `import`-Spezifizierer
 * muss in ESM ein String-Literal sein, auch beim Typ-Import. Was diese Konstante kann, ist
 * den Namen für Fehlermeldungen und Werkzeuge bereitstellen — mehr nicht. Der frühere
 * Kommentar behauptete das Gegenteil und stand genau an der Stelle, auf die das README
 * beim Thema Umbenennung zeigt.
 *
 * Bezug während der Entwicklung: per pnpm-Workspace-Link bzw. Git-Dependency
 * (siehe README → „Vertrag während der Entwicklung beziehen").
 */
export const CONTRACT_PACKAGE = "@obs/visu-contract" as const;

// Bewusst KEINE `TARGET_CONTRACT_VERSION` hier. Die Zielversion eines Skins steht
// in seinem eigenen `manifest.targetsContract` — genau eine Quelle je Skin, und die
// Skins ziehen nicht im Gleichschritt um. Eine repo-weite Konstante daneben war
// ungenutzt auf "1.1" stehengeblieben, waehrend die Manifeste bei 1.12 standen: eine
// Falle mit exakt dem Namen, nach dem der naechste Autor greifen wuerde.

export type ContractPackageName = typeof CONTRACT_PACKAGE;
