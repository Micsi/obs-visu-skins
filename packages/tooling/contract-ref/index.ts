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

/** Vertrags-Zielversion, auf die die Skins in diesem Repo zielen (`targetsContract`). */
export const TARGET_CONTRACT_VERSION = "1.1" as const;

export type ContractPackageName = typeof CONTRACT_PACKAGE;
