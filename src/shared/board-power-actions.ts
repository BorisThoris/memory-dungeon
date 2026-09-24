import type {
    BoardState,
    RunState
} from './contracts';
import {
    createMulberry32,
    deriveShuffleRngSeed,
    hashStringToSeed,
    pickRngIndex,
    shuffleWithRng
} from './rng';
import {
    decreaseRecallFocus,
    rememberForgottenTiles
} from './recall-rules';
import {
    hasClearFlipState,
    canRegionShuffle,
    canSwapHiddenTiles,
    canShuffleBoard
} from './board-power-availability';
import { clearResolveState } from './run-timer-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { hideTileAfterTurn } from './tile-state-rules';
import { runFilteredStringArray } from './run-array-guards';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

const SHUFFLE_SCORE_TAX_FACTOR = 0.94;

type TileEntry = {
    index: number;
    tile: BoardState['tiles'][number];
};

export const applyShuffle = (run: RunState): RunState => {
    const board = run.board;
    if (!canShuffleBoard(run) || !board) {
        return run;
    }

    const hiddenEntries: TileEntry[] = [];
    board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden') {
            hiddenEntries.push({ index, tile });
        }
    });

    const shuffleNonce = runNonNegativeInteger(run.shuffleNonce);
    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, board.level, shuffleNonce, run.runRulesVersion)
    );
    const cols = board.columns;
    const nextTiles = [...board.tiles];

    if (run.weakerShuffleMode === 'rows_only') {
        const rowToEntries = new Map<number, TileEntry[]>();
        for (const entry of hiddenEntries) {
            const row = Math.floor(entry.index / cols);
            const list = rowToEntries.get(row) ?? [];
            list.push(entry);
            rowToEntries.set(row, list);
        }
        for (const entries of rowToEntries.values()) {
            const chunk = entries.map((entry) => entry.tile);
            const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
            entries.forEach((entry, slot) => {
                nextTiles[entry.index] = shuffledChunk[slot] ?? entry.tile;
            });
        }
    } else {
        const hiddenTiles = hiddenEntries.map((entry) => entry.tile);
        const shuffled = shuffleWithRng(() => shuffleRng(), hiddenTiles);
        hiddenEntries.forEach((entry, slot) => {
            nextTiles[entry.index] = shuffled[slot] ?? entry.tile;
        });
    }

    const nextCharges = decrementRunCounter(run.shuffleCharges);

    let matchScoreMultiplier = run.matchScoreMultiplier;
    if (run.shuffleScoreTaxActive) {
        matchScoreMultiplier *= SHUFFLE_SCORE_TAX_FACTOR;
    }
    const shuffledTileIds = hiddenEntries.map((entry) => entry.tile.id);
    const stats = normalizeSessionStats(run.stats);

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleCharges: nextCharges,
        shuffleNonce: shuffleNonce + 1,
        matchScoreMultiplier,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, shuffledTileIds),
        board: {
            ...board,
            tiles: nextTiles
        },
        stats: {
            ...stats,
            shufflesUsed: runNonNegativeInteger(stats.shufflesUsed) + 1
        }
    };
};

export const applyRegionShuffle = (run: RunState, rowIndex: number): RunState => {
    const board = run.board;
    if (!canRegionShuffle(run) || !board) {
        return run;
    }
    const cols = board.columns;
    const hiddenInRow: TileEntry[] = [];
    board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hiddenInRow.push({ index, tile });
        }
    });
    if (hiddenInRow.length < 2) {
        return run;
    }

    const nextCharges = runNonNegativeInteger(run.regionShuffleCharges);
    if (nextCharges <= 0) {
        return run;
    }

    const shuffleNonce = runNonNegativeInteger(run.shuffleNonce);
    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, board.level, shuffleNonce, run.runRulesVersion)
    );
    const nextTiles = [...board.tiles];
    const chunk = hiddenInRow.map((entry) => entry.tile);
    const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
    hiddenInRow.forEach((entry, slot) => {
        nextTiles[entry.index] = shuffledChunk[slot] ?? entry.tile;
    });
    const shuffledTileIds = hiddenInRow.map((entry) => entry.tile.id);
    const stats = normalizeSessionStats(run.stats);

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleNonce: shuffleNonce + 1,
        regionShuffleCharges: nextCharges - 1,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, shuffledTileIds),
        board: {
            ...board,
            tiles: nextTiles
        },
        stats: {
            ...stats,
            shufflesUsed: runNonNegativeInteger(stats.shufflesUsed) + 1
        }
    };
};

export const applyTileSwap = (run: RunState, firstTileId: string, secondTileId: string): RunState => {
    if (!canSwapHiddenTiles(run, firstTileId, secondTileId) || !run.board) {
        return run;
    }
    const firstIndex = run.board.tiles.findIndex((tile) => tile.id === firstTileId);
    const secondIndex = run.board.tiles.findIndex((tile) => tile.id === secondTileId);
    if (firstIndex < 0 || secondIndex < 0) {
        return run;
    }

    const nextCharges = runNonNegativeInteger(run.regionShuffleCharges);
    if (nextCharges <= 0) {
        return run;
    }

    const nextTiles = [...run.board.tiles];
    const firstTile = nextTiles[firstIndex];
    const secondTile = nextTiles[secondIndex];
    if (!firstTile || !secondTile) {
        return run;
    }
    nextTiles[firstIndex] = secondTile;
    nextTiles[secondIndex] = firstTile;
    const stats = normalizeSessionStats(run.stats);

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleNonce: runNonNegativeInteger(run.shuffleNonce) + 1,
        regionShuffleCharges: nextCharges - 1,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [firstTileId, secondTileId]),
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...stats,
            shufflesUsed: runNonNegativeInteger(stats.shufflesUsed) + 1
        }
    };
};

export const applyFlashPair = (run: RunState): RunState => {
    const flashPairCharges = runNonNegativeInteger(run.flashPairCharges);
    if (run.status !== 'playing' || !run.board || flashPairCharges < 1) {
        return run;
    }
    if (!run.practiceMode && !run.wildMenuRun) {
        return run;
    }
    if (!hasClearFlipState(run)) {
        return run;
    }
    const hiddenByKey = new Map<string, string[]>();
    for (const t of run.board.tiles) {
        if (t.state !== 'hidden') {
            continue;
        }
        const list = hiddenByKey.get(t.pairKey) ?? [];
        list.push(t.id);
        hiddenByKey.set(t.pairKey, list);
    }
    const complete = [...hiddenByKey.values()].filter((ids) => ids.length >= 2);
    if (complete.length === 0) {
        return run;
    }
    const shuffleNonce = runNonNegativeInteger(run.shuffleNonce);
    const rng = createMulberry32(
        hashStringToSeed(`flashPair:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${shuffleNonce}`)
    );
    const picked = complete[pickRngIndex(rng, complete.length)];
    if (!picked) {
        return run;
    }
    const pairIds = picked.slice(0, 2);
    return {
        ...run,
        flashPairCharges: decrementRunCounter(flashPairCharges),
        powersUsedThisRun: true,
        shuffleNonce: shuffleNonce + 1,
        flashPairRevealedTileIds: pairIds
    };
};

export const applyPeek = (run: RunState, tileId: string): RunState => {
    const peekCharges = runNonNegativeInteger(run.peekCharges);
    if (run.status !== 'playing' || !run.board || peekCharges < 1) {
        return run;
    }
    if (!hasClearFlipState(run)) {
        return run;
    }
    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }
    const peekRevealedTileIds = runFilteredStringArray(run.peekRevealedTileIds);
    if (peekRevealedTileIds.includes(tileId)) {
        return run;
    }
    return {
        ...run,
        peekCharges: decrementRunCounter(peekCharges),
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        peekRevealedTileIds: [...peekRevealedTileIds, tileId]
    };
};

/**
 * The bomb: the pair of the one card face up leaves the board.
 *
 * Destroy (removed Gen 200, `docs/REMOVED_POWERS.md`) was this power with nothing that granted a
 * charge. The store stop grants them now (`run-store-rules.ts`), and the bomb aims at the card the
 * player has just turned over rather than an armed target: flip a card, realise you do not know
 * where its twin is, and spend a bomb instead of a guess. No score, no miss, no turn, and the chain
 * stands. It may not take the floor's last pair - that pair is the clear, and the clear is a match.
 */
export const bombTargetTileId = (run: RunState): string | null => {
    if (run.status !== 'playing' || !run.board || runNonNegativeInteger(run.bombCharges) < 1) {
        return null;
    }
    const flipped = runFilteredStringArray(run.board.flippedTileIds);
    if (flipped.length !== 1) {
        return null;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === flipped[0]);
    if (!tile || tile.state !== 'flipped') {
        return null;
    }
    const partner = run.board.tiles.find((candidate) => candidate.pairKey === tile.pairKey && candidate.id !== tile.id);
    if (!partner || partner.state !== 'hidden') {
        return null;
    }
    const pairsLeft = new Set(
        run.board.tiles.filter((candidate) => candidate.state === 'hidden' || candidate.state === 'flipped').map((candidate) => candidate.pairKey)
    ).size;
    return pairsLeft > 1 ? tile.id : null;
};

export const applyBomb = (run: RunState, tileId: string): RunState => {
    if (bombTargetTileId(run) !== tileId || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId)!;
    const pairTileIds = run.board.tiles.filter((candidate) => candidate.pairKey === tile.pairKey).map((candidate) => candidate.id);
    return {
        ...run,
        bombCharges: decrementRunCounter(run.bombCharges),
        powersUsedThisRun: true,
        pinnedTileIds: runFilteredStringArray(run.pinnedTileIds).filter((id) => !pairTileIds.includes(id)),
        board: {
            ...run.board,
            flippedTileIds: [],
            matchedPairs: runNonNegativeInteger(run.board.matchedPairs) + 1,
            tiles: run.board.tiles.map((candidate) =>
                pairTileIds.includes(candidate.id)
                    ? { ...candidate, state: 'removed' as const, findableKind: undefined }
                    : candidate
            )
        }
    };
};

export const cancelResolvingWithUndo = (run: RunState): RunState => {
    const undoUsesThisFloor = runNonNegativeInteger(run.undoUsesThisFloor);
    if (run.status !== 'resolving' || !run.board || undoUsesThisFloor < 1) {
        return run;
    }
    if (!Array.isArray(run.board.flippedTileIds)) {
        return run;
    }
    const ids = runFilteredStringArray(run.board.flippedTileIds);
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((t) => (ids.includes(t.id) ? hideTileAfterTurn(t) : t))
    };
    return {
        ...run,
        status: 'playing',
        board,
        undoUsesThisFloor: decrementRunCounter(undoUsesThisFloor),
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, ids),
        timerState: clearResolveState(run)
    };
};
