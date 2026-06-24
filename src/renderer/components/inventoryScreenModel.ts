import { getRewardPerkRows } from '../../shared/bonus-rewards';
import type { RunState, SaveData } from '../../shared/contracts';
import { getCosmeticCollectionRows } from '../../shared/cosmetics';
import { GAME_MODE_CODEX } from '../../shared/game-catalog';
import { getInventoryPrepRows } from '../../shared/inventory-prep';
import { getPerfectMemoryAttribution } from '../../shared/long-run-feedback';
import { getInventoryRewardSignal } from '../../shared/meta-reward-signals';
import { getRunEconomyRows } from '../../shared/run-economy';
import { getRunInventoryRows, getRunLoadoutSummary } from '../../shared/run-inventory';
import { getRunBuildProfile } from '../../shared/relics';
import { getRunStartingLoadoutRow } from '../../shared/starting-loadouts';
import {
    getTraitBuildRewardRows,
    getTraitBuildRewardRowsForLoadout
} from '../../shared/trait-build-rewards';

export const modeTitle = (gameMode: string): string =>
    GAME_MODE_CODEX.find((mode) => mode.id === gameMode)?.title ?? gameMode;

export const createInventoryQuantityMap = (run: RunState): Map<string, number> => {
    const inventoryRows = getRunInventoryRows(run);
    return new Map(inventoryRows.map((row) => [row.id, row.quantity]));
};

export const getActiveTraitBuildRows = (run: RunState) => {
    const relicTraitBuildRows = getTraitBuildRewardRows().filter((row) =>
        row.relicIds.some((relicId) => run.relicIds.includes(relicId))
    );
    return [...getTraitBuildRewardRowsForLoadout(run.startingLoadoutId), ...relicTraitBuildRows].filter(
        (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index
    );
};

export const createInventoryScreenModel = (run: RunState, saveData: SaveData) => {
    const inventoryRows = getRunInventoryRows(run);

    return {
        activeTraitBuildRows: getActiveTraitBuildRows(run),
        buildProfile: getRunBuildProfile(run),
        economyRows: getRunEconomyRows(run),
        equippedCosmetic: getCosmeticCollectionRows(saveData).find((row) => row.equipped) ?? null,
        inventoryQuantityById: new Map(inventoryRows.map((row) => [row.id, row.quantity])),
        inventoryRows,
        loadoutSummary: getRunLoadoutSummary(run),
        perfectMemoryAttribution: getPerfectMemoryAttribution(run),
        prepRows: getInventoryPrepRows(run),
        rewardPerkRows: getRewardPerkRows(run),
        rewardSignal: getInventoryRewardSignal(run),
        startingLoadoutRow: getRunStartingLoadoutRow(run)
    };
};
