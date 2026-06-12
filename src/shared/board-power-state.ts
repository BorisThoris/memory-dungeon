import {
    MAX_PINNED_TILES,
    type RunState
} from './contracts';

export const maxPinnedTilesForRun = (run: RunState): number =>
    MAX_PINNED_TILES + (run.relicIds.includes('pin_cap_plus_one') ? 1 : 0);

export const armRegionShuffleRow = (run: RunState, row: number | null): RunState =>
    run.status === 'playing' && run.board ? { ...run, regionShuffleRowArmed: row } : run;

export const togglePinnedTile = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }

    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }

    const isPinned = run.pinnedTileIds.includes(tileId);
    let pinnedTileIds: string[];

    if (isPinned) {
        pinnedTileIds = run.pinnedTileIds.filter((id) => id !== tileId);
    } else if (run.pinnedTileIds.length < maxPinnedTilesForRun(run)) {
        const cap = run.activeContract?.maxPinsTotalRun;
        if (cap != null && run.pinsPlacedCountThisRun >= cap) {
            return run;
        }
        pinnedTileIds = [...run.pinnedTileIds, tileId];
        return {
            ...run,
            pinnedTileIds,
            pinsPlacedCountThisRun: run.pinsPlacedCountThisRun + 1
        };
    } else {
        return run;
    }

    return {
        ...run,
        pinnedTileIds
    };
};

export const toggleStrayRemoveArmed = (run: RunState): RunState =>
    run.strayRemoveCharges > 0 && run.status === 'playing'
        ? { ...run, strayRemoveArmed: !run.strayRemoveArmed }
        : run;
