import {
    MAX_PINNED_TILES,
    type RunState
} from './contracts';
import { hasRunRelic } from './relics';
import { runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';

export const maxPinnedTilesForRun = (run: RunState): number =>
    MAX_PINNED_TILES + (hasRunRelic(run, 'pin_cap_plus_one') ? 1 : 0);

export const togglePinnedTile = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }

    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }

    const currentPinnedTileIds = runStringArray(run.pinnedTileIds);
    const isPinned = currentPinnedTileIds.includes(tileId);
    let pinnedTileIds: string[];

    if (isPinned) {
        pinnedTileIds = currentPinnedTileIds.filter((id) => id !== tileId);
    } else if (currentPinnedTileIds.length < maxPinnedTilesForRun(run)) {
        const cap = run.activeContract?.maxPinsTotalRun;
        const pinsPlacedCountThisRun = runNonNegativeInteger(run.pinsPlacedCountThisRun);
        if (cap != null && pinsPlacedCountThisRun >= runNonNegativeInteger(cap)) {
            return run;
        }
        pinnedTileIds = [...currentPinnedTileIds, tileId];
        return {
            ...run,
            pinnedTileIds,
            pinsPlacedCountThisRun: pinsPlacedCountThisRun + 1
        };
    } else {
        return run;
    }

    return {
        ...run,
        pinnedTileIds
    };
};
