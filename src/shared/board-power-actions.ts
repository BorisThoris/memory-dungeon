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
import { DECOY_PAIR_KEY } from './tile-identity';
import {
    canDestroyPair,
    canRegionShuffle,
    canSwapHiddenTiles,
    canShuffleBoard
} from './board-power-availability';
import { hasMutator } from './mutators';
import {
    PEEK_REVEALED_ROUTE_SPECIALS,
    tileIsCompletionSafeStrayTarget
} from './board-power-targeting';
import { clearResolveState } from './run-timer-rules';
import { hiddenUnlessSprungTrap } from './tile-state-rules';

const SHUFFLE_SCORE_TAX_FACTOR = 0.94;

const nonNegativePowerCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export interface DestroyPairTransitionOptions {
    isBoardComplete: (board: BoardState) => boolean;
    rotateShiftingSpotlight: (
        run: RunState,
        board: BoardState
    ) => { board: BoardState; shiftingSpotlightNonce: number };
}

export interface DestroyPairTransitionResult {
    run: RunState;
    boardComplete: boolean;
    changed: boolean;
}

export const applyDestroyPairTransition = (
    run: RunState,
    tileId: string,
    options: DestroyPairTransitionOptions
): DestroyPairTransitionResult => {
    if (run.activeContract?.noDestroy || !canDestroyPair(run, tileId) || !run.board) {
        return { run, boardComplete: false, changed: false };
    }

    const tile = run.board.tiles.find((t) => t.id === tileId)!;
    const pairTileIds = run.board.tiles.filter((t) => t.pairKey === tile.pairKey).map((t) => t.id);

    const board: BoardState = {
        ...run.board,
        matchedPairs: nonNegativePowerCount(run.board.matchedPairs) + 1,
        tiles: run.board.tiles.map((t) =>
            pairTileIds.includes(t.id)
                ? {
                      ...t,
                      state: 'matched' as const,
                      findableKind: undefined,
                      routeCardKind: undefined,
                      routeSpecialKind: undefined,
                      routeSpecialRevealed: undefined,
                      routeSpecialRevealSource: undefined,
                      lanternScouted: undefined,
                      scoutRevealSource: undefined
                  }
                : t
        )
    };

    const pinnedTileIds = run.pinnedTileIds.filter((id) => !pairTileIds.includes(id));
    const spunDestroy = options.rotateShiftingSpotlight(run, board);

    const nextRun: RunState = {
        ...run,
        powersUsedThisRun: true,
        destroyUsedThisFloor: true,
        destroyPairCharges: Math.max(0, nonNegativePowerCount(run.destroyPairCharges) - 1),
        pinnedTileIds,
        board: spunDestroy.board,
        shiftingSpotlightNonce: spunDestroy.shiftingSpotlightNonce,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, pairTileIds),
        parasiteFloors: hasMutator(run, 'score_parasite') ? 0 : nonNegativePowerCount(run.parasiteFloors),
        stats: {
            ...run.stats,
            matchesFound: nonNegativePowerCount(run.stats.matchesFound) + 1,
            pairsDestroyed: nonNegativePowerCount(run.stats.pairsDestroyed) + 1
        }
    };

    return {
        run: nextRun,
        boardComplete: options.isBoardComplete(spunDestroy.board),
        changed: true
    };
};

export const applyShuffle = (run: RunState): RunState => {
    if (!canShuffleBoard(run) || !run.board) {
        return run;
    }

    const hiddenIndices: number[] = [];
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden') {
            hiddenIndices.push(index);
        }
    });

    const shuffleNonce = nonNegativePowerCount(run.shuffleNonce);
    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, shuffleNonce, run.runRulesVersion)
    );
    const cols = run.board.columns;
    const nextTiles = [...run.board.tiles];

    if (run.weakerShuffleMode === 'rows_only') {
        const rowToIndices = new Map<number, number[]>();
        for (const index of hiddenIndices) {
            const row = Math.floor(index / cols);
            const list = rowToIndices.get(row) ?? [];
            list.push(index);
            rowToIndices.set(row, list);
        }
        for (const indices of rowToIndices.values()) {
            const chunk = indices.map((i) => nextTiles[i]!);
            const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
            indices.forEach((cellIdx, slot) => {
                nextTiles[cellIdx] = shuffledChunk[slot]!;
            });
        }
    } else {
        const hiddenTiles = hiddenIndices.map((index) => run.board!.tiles[index]);
        const shuffled = shuffleWithRng(() => shuffleRng(), hiddenTiles);
        hiddenIndices.forEach((index, slot) => {
            nextTiles[index] = shuffled[slot]!;
        });
    }

    let nextCharges = nonNegativePowerCount(run.shuffleCharges);
    let nextFree = run.freeShuffleThisFloor;
    if (nextFree && run.relicIds.includes('first_shuffle_free_per_floor')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    }

    let matchScoreMultiplier = run.matchScoreMultiplier;
    if (run.shuffleScoreTaxActive) {
        matchScoreMultiplier *= SHUFFLE_SCORE_TAX_FACTOR;
    }
    const shuffledTileIds = hiddenIndices.map((index) => run.board!.tiles[index]!.id);

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleCharges: nextCharges,
        shuffleNonce: shuffleNonce + 1,
        freeShuffleThisFloor: nextFree,
        matchScoreMultiplier,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, shuffledTileIds),
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...run.stats,
            shufflesUsed: nonNegativePowerCount(run.stats.shufflesUsed) + 1
        }
    };
};

export const applyRegionShuffle = (run: RunState, rowIndex: number): RunState => {
    if (!canRegionShuffle(run) || !run.board) {
        return run;
    }
    const cols = run.board.columns;
    const hiddenInRow: number[] = [];
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hiddenInRow.push(index);
        }
    });
    if (hiddenInRow.length < 2) {
        return run;
    }

    let nextFree = run.regionShuffleFreeThisFloor;
    let nextCharges = nonNegativePowerCount(run.regionShuffleCharges);
    if (nextFree && run.relicIds.includes('region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
        return run;
    }

    const shuffleNonce = nonNegativePowerCount(run.shuffleNonce);
    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, shuffleNonce, run.runRulesVersion)
    );
    const nextTiles = [...run.board.tiles];
    const chunk = hiddenInRow.map((i) => nextTiles[i]!);
    const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
    hiddenInRow.forEach((cellIdx, slot) => {
        nextTiles[cellIdx] = shuffledChunk[slot]!;
    });
    const shuffledTileIds = hiddenInRow.map((index) => run.board!.tiles[index]!.id);

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleNonce: shuffleNonce + 1,
        regionShuffleCharges: nextCharges,
        regionShuffleFreeThisFloor: nextFree,
        regionShuffleRowArmed: null,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, shuffledTileIds),
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...run.stats,
            shufflesUsed: nonNegativePowerCount(run.stats.shufflesUsed) + 1
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

    let nextFree = run.regionShuffleFreeThisFloor;
    let nextCharges = nonNegativePowerCount(run.regionShuffleCharges);
    if (nextFree && run.relicIds.includes('region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
        return run;
    }

    const nextTiles = [...run.board.tiles];
    const firstTile = nextTiles[firstIndex]!;
    nextTiles[firstIndex] = nextTiles[secondIndex]!;
    nextTiles[secondIndex] = firstTile;

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleNonce: nonNegativePowerCount(run.shuffleNonce) + 1,
        regionShuffleCharges: nextCharges,
        regionShuffleFreeThisFloor: nextFree,
        regionShuffleRowArmed: null,
        pinnedTileIds: [],
        recallFocus: 0,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [firstTileId, secondTileId]),
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...run.stats,
            shufflesUsed: nonNegativePowerCount(run.stats.shufflesUsed) + 1
        }
    };
};

export const applyFlashPair = (run: RunState): RunState => {
    const flashPairCharges = nonNegativePowerCount(run.flashPairCharges);
    if (run.status !== 'playing' || !run.board || flashPairCharges < 1) {
        return run;
    }
    if (!run.practiceMode && !run.wildMenuRun) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const hiddenByKey = new Map<string, string[]>();
    for (const t of run.board.tiles) {
        if (t.state !== 'hidden' || t.pairKey === DECOY_PAIR_KEY) {
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
    const shuffleNonce = nonNegativePowerCount(run.shuffleNonce);
    const rng = createMulberry32(
        hashStringToSeed(`flashPair:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${shuffleNonce}`)
    );
    const picked = complete[pickRngIndex(rng, complete.length)]!;
    const pairIds = picked.slice(0, 2);
    return {
        ...run,
        flashPairCharges: Math.max(0, flashPairCharges - 1),
        powersUsedThisRun: true,
        shuffleNonce: shuffleNonce + 1,
        flashPairRevealedTileIds: pairIds
    };
};

export const applyPeek = (run: RunState, tileId: string): RunState => {
    const peekCharges = nonNegativePowerCount(run.peekCharges);
    if (run.status !== 'playing' || !run.board || peekCharges < 1) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }
    if (run.peekRevealedTileIds.includes(tileId)) {
        return run;
    }
    const board =
        tile.routeSpecialKind && PEEK_REVEALED_ROUTE_SPECIALS.has(tile.routeSpecialKind)
            ? {
                  ...run.board,
                  tiles: run.board.tiles.map((t) =>
                      t.pairKey === tile.pairKey
                          ? { ...t, routeSpecialRevealed: true, routeSpecialRevealSource: 'peek' as const }
                          : t
                  )
              }
            : run.board;
    return {
        ...run,
        board,
        peekCharges: Math.max(0, peekCharges - 1),
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        peekRevealedTileIds: [...run.peekRevealedTileIds, tileId]
    };
};

export const applyStrayRemove = (run: RunState, tileId: string): RunState => {
    const strayRemoveCharges = nonNegativePowerCount(run.strayRemoveCharges);
    if (!run.strayRemoveArmed || run.status !== 'playing' || !run.board || strayRemoveCharges < 1) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || !tileIsCompletionSafeStrayTarget(run.board, tileId)) {
        return run;
    }
    const board: BoardState = {
        ...run.board,
        tiles: run.board.tiles.map((t) =>
            t.id === tileId
                ? {
                      ...t,
                      state: 'removed' as const,
                      routeCardKind: undefined,
                      routeSpecialKind: undefined,
                      routeSpecialRevealed: undefined,
                      routeSpecialRevealSource: undefined,
                      lanternScouted: undefined,
                      scoutRevealSource: undefined
                  }
                : t.pairKey === tile.pairKey
                  ? {
                        ...t,
                        routeCardKind: undefined,
                        routeSpecialKind: undefined,
                        routeSpecialRevealed: undefined,
                        routeSpecialRevealSource: undefined,
                        lanternScouted: undefined,
                        scoutRevealSource: undefined
                    }
                  : t
        )
    };
    return {
        ...run,
        powersUsedThisRun: true,
        strayRemoveCharges: Math.max(0, strayRemoveCharges - 1),
        strayRemoveArmed: false,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        board
    };
};

export const cancelResolvingWithUndo = (run: RunState): RunState => {
    const undoUsesThisFloor = nonNegativePowerCount(run.undoUsesThisFloor);
    if (run.status !== 'resolving' || !run.board || undoUsesThisFloor < 1) {
        return run;
    }
    const ids = [...run.board.flippedTileIds];
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((t) => (ids.includes(t.id) ? hiddenUnlessSprungTrap(t) : t))
    };
    return {
        ...run,
        status: 'playing',
        board,
        undoUsesThisFloor: Math.max(0, undoUsesThisFloor - 1),
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, ids),
        timerState: clearResolveState(run)
    };
};
