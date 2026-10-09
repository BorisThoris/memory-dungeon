import type { RunState } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { runNonNegativeInteger } from './run-number-guards';
import { releaseRealmHoldsIfStuck } from './realm-weather-rules';
import { finalizeLevel } from './floor-clear-transition';

const living = (state: string): boolean => state === 'hidden' || state === 'flipped';
export const meteorCharges = (run: Pick<RunState,'meteorCharges'>): number => runNonNegativeInteger(run.meteorCharges);
export const canAimMeteor = (run: RunState): boolean => run.status === 'playing' && !!run.board && meteorCharges(run) > 0
    && run.board.flippedTileIds.length <= 1 && run.board.tiles.some(t => living(t.state) && !isSingletonUtilityPairKey(t.pairKey));

/** Player-selected area strike. Its partners go too, so no unmatchable single cards remain. */
export const callMeteor = (run: RunState, tileId: string): RunState => {
    if (!canAimMeteor(run) || !run.board) return run;
    const board = run.board;
    const cell = board.tiles.findIndex(t => t.id === tileId && living(t.state) && !isSingletonUtilityPairKey(t.pairKey));
    if (cell < 0) return run;
    const x = cell % board.columns, y = Math.floor(cell / board.columns);
    const radius = Math.max(1.6, Math.sqrt(board.pairCount / 24) * 1.6);
    const pairs = new Set<string>();
    for (let index = 0; index < board.tiles.length; index++) {
        const tile = board.tiles[index]!;
        if (living(tile.state) && !isSingletonUtilityPairKey(tile.pairKey)
            && Math.hypot(index % board.columns - x, Math.floor(index / board.columns) - y) <= radius) pairs.add(tile.pairKey);
    }
    if (pairs.size === 0) return run;
    let cards = 0;
    const key = (board.meteorImpact?.key ?? 0) + 1;
    const tiles = board.tiles.map(tile => {
        if (!living(tile.state)) return tile;
        if (!pairs.has(tile.pairKey)) return tile.state === 'flipped' ? { ...tile, state:'hidden' as const } : tile;
        cards++;
        return { ...tile, state:'removed' as const, findableKind:undefined, meteorStruck:key };
    });
    releaseRealmHoldsIfStuck(tiles);
    const next: RunState = { ...run, meteorCharges: meteorCharges(run)-1, meteorArmed:false, powersUsedThisRun:true,
        pinnedTileIds:run.pinnedTileIds.filter(id=>!board.tiles.some(tile=>tile.id===id&&pairs.has(tile.pairKey))),
        board:{...board,tiles,flippedTileIds:[],matchedPairs:board.matchedPairs+pairs.size,
            meteorImpact:{key,cell,radius,cards}} };
    return next.board!.matchedPairs >= board.pairCount ? finalizeLevel(next,next.board!) : next;
};
