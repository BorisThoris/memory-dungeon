/**
 * What the Inventory screen needs from a run: the mode's title and the charge counts.
 *
 * Gen 214: this file also held `createInventoryScreenModel`, which assembled eleven projections -
 * economy rows, prep rows, a loadout summary, perfect-memory attribution, two reward signals, a
 * payoff-engine beat, run-loop signals, the equipped cosmetic - and the two helpers that fed it.
 * Nothing rendered any of it. The screen was rebuilt green-field around a run line, the mutator
 * chips and a charge table, and the model lost its caller in that rebuild without losing its test,
 * so every one of those projections went on being maintained and verified for nobody.
 *
 * The module audit could not see it, because the module IS imported - the screen takes these two
 * helpers from it. `yarn audit:test-only-exports` is the audit that can, and this is the first
 * thing it was pointed at.
 */
import type { RunState } from '../../shared/contracts';
import { GAME_MODE_CODEX } from '../../shared/game-catalog';
import { getRunInventoryRows } from '../../shared/run-inventory';

export const modeTitle = (gameMode: string): string =>
    GAME_MODE_CODEX.find((mode) => mode.id === gameMode)?.title ?? gameMode;

export const createInventoryQuantityMap = (run: RunState): Map<string, number> => {
    const inventoryRows = getRunInventoryRows(run);
    return new Map(inventoryRows.map((row) => [row.id, row.quantity]));
};
