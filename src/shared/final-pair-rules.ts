import type { RunState, Tile } from './contracts';
import { tilesArePairMatch } from './scoring-rules';

/** No choice remains once the only two live cards form a pair. */
export const getFinalPair = (run: RunState): [Tile, Tile] | null => {
    if (run.status !== 'playing' || !run.board) return null;
    const remaining: Tile[] = [];
    for (const tile of run.board.tiles) {
        if (tile.state !== 'hidden' && tile.state !== 'flipped') continue;
        remaining.push(tile);
        if (remaining.length > 2) return null;
    }
    return remaining.length === 2 && tilesArePairMatch(remaining[0]!, remaining[1]!)
        ? [remaining[0]!, remaining[1]!] : null;
};

/** Reveal first so the ordinary resolve timer can show the pair and award its normal payoff. */
export const revealFinalPair = (run: RunState): RunState => {
    const pair = getFinalPair(run);
    if (!pair || !run.board) return run;
    const ids = pair.map(tile => tile.id);
    return {
        ...run,
        status: 'resolving',
        board: {
            ...run.board,
            tiles: run.board.tiles.map(tile => ids.includes(tile.id) ? { ...tile, state: 'flipped' } : tile),
            flippedTileIds: ids
        },
        flipHistory: [...run.flipHistory, ...pair.filter(tile => tile.state === 'hidden').map(tile => tile.id)],
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        lanternLitTileIds: [],
        realmLitTileIds: [],
        timerState: { ...run.timerState, resolveRemainingMs: 300 }
    };
};
