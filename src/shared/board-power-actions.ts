import type {
    BoardState,
    RunState
} from './contracts';
import {
    createMulberry32,
    deriveShuffleRngSeed,
    hashStringToSeed,
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
        matchedPairs: run.board.matchedPairs + 1,
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
        destroyPairCharges: run.destroyPairCharges - 1,
        pinnedTileIds,
        board: spunDestroy.board,
        shiftingSpotlightNonce: spunDestroy.shiftingSpotlightNonce,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, pairTileIds),
        parasiteFloors: hasMutator(run, 'score_parasite') ? 0 : run.parasiteFloors,
        stats: {
            ...run.stats,
            matchesFound: run.stats.matchesFound + 1,
            pairsDestroyed: run.stats.pairsDestroyed + 1
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

    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, run.shuffleNonce, run.runRulesVersion)
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

    let nextCharges = run.shuffleCharges;
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
        shuffleNonce: run.shuffleNonce + 1,
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
            shufflesUsed: run.stats.shufflesUsed + 1
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
    let nextCharges = run.regionShuffleCharges;
    if (nextFree && run.relicIds.includes('region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
        return run;
    }

    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, run.shuffleNonce, run.runRulesVersion)
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
        shuffleNonce: run.shuffleNonce + 1,
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
            shufflesUsed: run.stats.shufflesUsed + 1
        }
    };
};

export const applyFlashPair = (run: RunState): RunState => {
    if (run.status !== 'playing' || !run.board || run.flashPairCharges < 1) {
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
    const rng = createMulberry32(
        hashStringToSeed(`flashPair:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${run.shuffleNonce}`)
    );
    const picked = complete[Math.floor(rng() * complete.length)]!;
    const pairIds = picked.slice(0, 2);
    return {
        ...run,
        flashPairCharges: run.flashPairCharges - 1,
        powersUsedThisRun: true,
        shuffleNonce: run.shuffleNonce + 1,
        flashPairRevealedTileIds: pairIds
    };
};

export const applyPeek = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board || run.peekCharges < 1) {
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
        peekCharges: run.peekCharges - 1,
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        peekRevealedTileIds: [...run.peekRevealedTileIds, tileId]
    };
};

export const applyStrayRemove = (run: RunState, tileId: string): RunState => {
    if (!run.strayRemoveArmed || run.status !== 'playing' || !run.board || run.strayRemoveCharges < 1) {
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
        strayRemoveCharges: run.strayRemoveCharges - 1,
        strayRemoveArmed: false,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        board
    };
};

export const cancelResolvingWithUndo = (run: RunState): RunState => {
    if (run.status !== 'resolving' || !run.board || run.undoUsesThisFloor < 1) {
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
        undoUsesThisFloor: run.undoUsesThisFloor - 1,
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, ids),
        timerState: clearResolveState(run)
    };
};
