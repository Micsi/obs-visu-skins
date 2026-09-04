/**
 * Zentrale Konstante für den Paketnamen des Vertrags.
 *
 * U2 (offene Frage): npm-Scope/Paketname des Vertrags ist noch nicht endgültig.
 * `@obs/visu-contract` ist ein Vorschlag (DECISIONS.md → D4). Damit eine spätere
 * Umbenennung trivial bleibt, referenziert das gesamte Repo den Vertrag NUR über
 * diese eine Konstante — nie als hartkodierten String an mehreren Stellen.
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
