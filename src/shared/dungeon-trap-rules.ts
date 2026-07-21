import type { BoardState, RunState, Tile } from './contracts';
import { revealOneHiddenDungeonHazardPair } from './dungeon-enemy-card-rules';
import { normalizeSessionStats } from './session-stats-rules';

export const DUNGEON_TRAP_SCORE_PENALTY = 10;
export const DUNGEON_HEX_TRAP_SCORE_PENALTY = 20;

export interface SpringArmedDungeonTrapsResult {
    alarmTriggered: boolean;
    board: BoardState;
    enemyWoken: boolean;
    run: RunState;
}

const nonNegativeTrapCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

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
    let lives = nonNegativeTrapCount(run.lives);
    let guardTokens = stats.guardTokens;
    let shopGold = nonNegativeTrapCount(run.shopGold);
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
        matchedPairs: Math.min(nonNegativeTrapCount(board.pairCount), nonNegativeTrapCount(board.matchedPairs) + triggered),
        tiles: board.tiles.map((candidate) =>
            keys.includes(candidate.pairKey) && candidate.dungeonCardKind === 'trap'
                ? { ...candidate, dungeonCardState: 'resolved' as const, state: 'flipped' as const }
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
            dungeonTrapsTriggered: nonNegativeTrapCount(run.dungeonTrapsTriggered) + triggered,
            dungeonTrapsResolvedThisFloor: nonNegativeTrapCount(run.dungeonTrapsResolvedThisFloor) + triggered,
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
