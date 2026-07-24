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
import { normalizeSessionStats } from './session-stats-rules';
import { hiddenUnlessSprungTrap } from './tile-state-rules';
import { hasRunRelic } from './relics';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

const SHUFFLE_SCORE_TAX_FACTOR = 0.94;

const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const hasClearFlipState = (run: RunState): boolean => Array.isArray(run.board?.flippedTileIds) && run.board.flippedTileIds.length === 0;

type TileEntry = {
    index: number;
    tile: BoardState['tiles'][number];
};

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

    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile) {
        return { run, boardComplete: false, changed: false };
    }
    const pairTileIds = run.board.tiles.filter((t) => t.pairKey === tile.pairKey).map((t) => t.id);

    const board: BoardState = {
        ...run.board,
        matchedPairs: runNonNegativeInteger(run.board.matchedPairs) + 1,
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

    const pinnedTileIds = stringArray(run.pinnedTileIds).filter((id) => !pairTileIds.includes(id));
    const spunDestroy = options.rotateShiftingSpotlight(run, board);
    const stats = normalizeSessionStats(run.stats);

    const nextRun: RunState = {
        ...run,
        powersUsedThisRun: true,
        destroyUsedThisFloor: true,
        destroyPairCharges: decrementRunCounter(run.destroyPairCharges),
        pinnedTileIds,
        board: spunDestroy.board,
        shiftingSpotlightNonce: spunDestroy.shiftingSpotlightNonce,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, pairTileIds),
        parasiteFloors: hasMutator(run, 'score_parasite') ? 0 : runNonNegativeInteger(run.parasiteFloors),
        stats: {
            ...stats,
            matchesFound: runNonNegativeInteger(stats.matchesFound) + 1,
            pairsDestroyed: runNonNegativeInteger(stats.pairsDestroyed) + 1
        }
    };

    return {
        run: nextRun,
        boardComplete: options.isBoardComplete(spunDestroy.board),
        changed: true
    };
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

    let nextCharges = runNonNegativeInteger(run.shuffleCharges);
    let nextFree = run.freeShuffleThisFloor;
    if (nextFree && hasRunRelic(run, 'first_shuffle_free_per_floor')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    }

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
        freeShuffleThisFloor: nextFree,
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

    let nextFree = run.regionShuffleFreeThisFloor;
    let nextCharges = runNonNegativeInteger(run.regionShuffleCharges);
    if (nextFree && hasRunRelic(run, 'region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
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
        regionShuffleCharges: nextCharges,
        regionShuffleFreeThisFloor: nextFree,
        regionShuffleRowArmed: null,
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

    let nextFree = run.regionShuffleFreeThisFloor;
    let nextCharges = runNonNegativeInteger(run.regionShuffleCharges);
    if (nextFree && hasRunRelic(run, 'region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
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
    const peekRevealedTileIds = stringArray(run.peekRevealedTileIds);
    if (peekRevealedTileIds.includes(tileId)) {
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
        peekCharges: decrementRunCounter(peekCharges),
        powersUsedThisRun: true,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        peekRevealedTileIds: [...peekRevealedTileIds, tileId]
    };
};

export const applyStrayRemove = (run: RunState, tileId: string): RunState => {
    const strayRemoveCharges = runNonNegativeInteger(run.strayRemoveCharges);
    if (!run.strayRemoveArmed || run.status !== 'playing' || !run.board || strayRemoveCharges < 1) {
        return run;
    }
    if (!hasClearFlipState(run)) {
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
        strayRemoveCharges: decrementRunCounter(strayRemoveCharges),
        strayRemoveArmed: false,
        recallFocus: decreaseRecallFocus(run),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, [tileId]),
        board
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
    const ids = stringArray(run.board.flippedTileIds);
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((t) => (ids.includes(t.id) ? hiddenUnlessSprungTrap(t) : t))
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
