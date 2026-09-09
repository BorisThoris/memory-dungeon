import type { SaveData } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The deepest floor this profile has on record. The save keeps no single number for it: the last
 * run's summary, the bounded history and the no-powers record each carry a floor, and the deepest
 * of them is the one the HUD's personal-best marker has to beat. A record older than the history's
 * cap survives in `bestFloorNoPowers` only when it was set without powers; that is the save's
 * limit, not this reading's.
 */
export const profileDeepestFloor = (saveData: SaveData): number =>
    Math.max(
        runNonNegativeInteger(saveData.lastRunSummary?.highestLevel),
        runNonNegativeInteger(saveData.playerStats?.bestFloorNoPowers),
        ...(saveData.runHistory ?? []).map((record) => runNonNegativeInteger(record.highestLevel))
    );
