import type { BoardState, RunState, Tile } from './contracts';
import { revealOneHiddenDungeonHazardPair } from './dungeon-enemy-card-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export const DUNGEON_TRAP_SCORE_PENALTY = 10;
export const DUNGEON_HEX_TRAP_SCORE_PENALTY = 20;

export interface SpringArmedDungeonTrapsResult {
    alarmTriggered: boolean;
    board: BoardState;
    enemyWoken: boolean;
    run: RunState;
}

export const springArmedDungeonTraps = (
    run: RunState,
    board: BoardState,
    trappedPairKeys: readonly string[]
): SpringArmedDungeonTrapsResult => {
    const keys = [...new Set(trappedPairKeys)];
    if (keys.length === 0) {
        return { run, board, alarmTriggered: false, enemyWoken: false };
    }
    const stats = normalizeSessionStats(run.stats);
    let lives = runNonNegativeInteger(run.lives);
    let guardTokens = stats.guardTokens;
    let shopGold = runNonNegativeInteger(run.shopGold);
    let triggered = 0;
    let alarmTriggered = false;
    let snareDisablesShuffle = false;
    let hexTriggered = false;
    for (const pairKey of keys) {
        const armedTile = board.tiles.find(
            (tile) =>
                tile.pairKey === pairKey &&
                tile.dungeonCardKind === 'trap' &&
                tile.dungeonCardState === 'revealed'
        );
        if (!armedTile) {
            continue;
        }
        triggered += 1;
        if (armedTile.dungeonCardEffectId === 'trap_alarm') {
            alarmTriggered = true;
        } else if (armedTile.dungeonCardEffectId === 'trap_snare') {
            if (guardTokens > 0) {
                guardTokens -= 1;
            } else {
                snareDisablesShuffle = true;
            }
        } else if (armedTile.dungeonCardEffectId === 'trap_hex') {
            hexTriggered = true;
        } else if (guardTokens > 0) {
            guardTokens -= 1;
        } else {
            lives -= 1;
            if (armedTile.dungeonCardEffectId === 'trap_mimic') {
                shopGold = Math.max(0, shopGold - 1);
            }
        }
    }
    if (triggered === 0) {
        return { run, board, alarmTriggered: false, enemyWoken: false };
    }
    const scorePenalty = DUNGEON_TRAP_SCORE_PENALTY * triggered + (hexTriggered ? DUNGEON_HEX_TRAP_SCORE_PENALTY : 0);
    const hexRevealTileIds = hexTriggered ? revealOneHiddenDungeonHazardPair(board.tiles) : new Set<string>();
    const enemyWoken = board.tiles.some(
        (candidate) =>
            candidate.dungeonCardKind === 'enemy' &&
            candidate.dungeonCardState === 'hidden' &&
            (alarmTriggered || candidate.dungeonCardEffectId === 'enemy_stalker' || hexRevealTileIds.has(candidate.id))
    );
    const nextBoard: BoardState = {
        ...board,
        matchedPairs: Math.min(runNonNegativeInteger(board.pairCount), runNonNegativeInteger(board.matchedPairs) + triggered),
        tiles: board.tiles.map((candidate) =>
            keys.includes(candidate.pairKey) && candidate.dungeonCardKind === 'trap'
                ? // A sprung trap has spent itself. It used to stay face-up for the rest of the floor,
                  // a dead card the player had to keep reading around; now it pops off the board the
                  // way a claimed pair does, so the bite is the only thing it leaves behind.
                  { ...candidate, dungeonCardState: 'resolved' as const, state: 'removed' as const }
                : alarmTriggered && candidate.dungeonCardKind === 'enemy' && candidate.dungeonCardState === 'hidden'
                  ? { ...candidate, dungeonCardState: 'revealed' as const }
                : triggered > 0 &&
                    candidate.dungeonCardEffectId === 'enemy_stalker' &&
                    candidate.dungeonCardState === 'hidden'
                  ? { ...candidate, dungeonCardState: 'revealed' as const }
                : hexRevealTileIds.has(candidate.id)
                  ? { ...candidate, dungeonCardState: 'revealed' as const }
                : candidate
        )
    };
    return {
        run: {
            ...run,
            lives: Math.max(0, lives),
            status: lives <= 0 ? 'gameOver' : run.status,
            freeShuffleThisFloor: snareDisablesShuffle ? false : run.freeShuffleThisFloor,
            regionShuffleFreeThisFloor: snareDisablesShuffle ? false : run.regionShuffleFreeThisFloor,
            shopGold,
            dungeonTrapsTriggered: runNonNegativeInteger(run.dungeonTrapsTriggered) + triggered,
            dungeonTrapsResolvedThisFloor: runNonNegativeInteger(run.dungeonTrapsResolvedThisFloor) + triggered,
            stats: {
                ...stats,
                totalScore: Math.max(0, stats.totalScore - scorePenalty),
                currentLevelScore: Math.max(0, stats.currentLevelScore - scorePenalty),
                guardTokens
            }
        },
        board: nextBoard,
        alarmTriggered,
        enemyWoken
    };
};

export const revealDungeonCardPair = (run: RunState, tile: Tile): RunState => {
    if (!run.board || tile.dungeonCardState !== 'hidden' || tile.dungeonCardKind == null) {
        return run;
    }
    const revealedBoard: BoardState = {
        ...run.board,
        tiles: run.board.tiles.map((candidate) =>
            candidate.pairKey === tile.pairKey && candidate.dungeonCardKind === tile.dungeonCardKind
                ? { ...candidate, dungeonCardState: 'revealed' }
                : candidate
        )
    };
    if (tile.dungeonCardKind === 'trap') {
        const sprung = springArmedDungeonTraps({ ...run, board: revealedBoard }, revealedBoard, [tile.pairKey]);
        return { ...sprung.run, board: sprung.board };
    }
    return {
        ...run,
        board: revealedBoard
    };
};

/**
 * Spotting a trap with a peek charge takes it off the board for nothing.
 *
 * A peek is a look, not a reach: the player spends the charge, sees the trap, and the trap is
 * disarmed rather than sprung. It costs no life and no guard token, and it counts as a resolved
 * trap pair the same way springing one does, so a disarm-traps floor can be finished this way.
 */
export const disarmDungeonTrapPairByPeek = (run: RunState, tileId: string): RunState => {
    const board = run.board;
    const tile = board?.tiles.find((candidate) => candidate.id === tileId);
    if (
        !board ||
        !tile ||
        tile.dungeonCardKind !== 'trap' ||
        tile.dungeonCardState === 'resolved' ||
        tile.state === 'matched' ||
        tile.state === 'removed'
    ) {
        return run;
    }
    const disarmedBoard: BoardState = {
        ...board,
        flippedTileIds: board.flippedTileIds.filter((id) => id !== tileId),
        matchedPairs: Math.min(
            runNonNegativeInteger(board.pairCount),
            runNonNegativeInteger(board.matchedPairs) + 1
        ),
        tiles: board.tiles.map((candidate) =>
            candidate.pairKey === tile.pairKey && candidate.dungeonCardKind === 'trap'
                ? { ...candidate, dungeonCardState: 'resolved' as const, state: 'removed' as const }
                : candidate
        )
    };
    return {
        ...run,
        board: disarmedBoard,
        dungeonTrapsResolvedThisFloor: runNonNegativeInteger(run.dungeonTrapsResolvedThisFloor) + 1
    };
};

export const resolveOneArmedTrapPair = (board: BoardState): BoardState => {
    const trapPairKey = board.tiles.find(
        (tile) =>
            tile.dungeonCardKind === 'trap' &&
            tile.dungeonCardState === 'revealed' &&
            tile.state !== 'matched' &&
            tile.state !== 'removed'
    )?.pairKey;
    if (!trapPairKey) {
        return board;
    }
    return {
        ...board,
        tiles: board.tiles.map((tile) =>
            tile.pairKey === trapPairKey && tile.dungeonCardKind === 'trap'
                ? { ...tile, dungeonCardState: 'resolved' as const }
                : tile
        )
    };
};
