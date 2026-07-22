import type {
    BoardState,
    DungeonBossId,
    DungeonRunNodeKind,
    EnemyHazardKind,
    EnemyHazardPattern,
    EnemyHazardState,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    RunState,
    Tile
} from './contracts';
import { DUNGEON_BOSS_DEFEAT_SCORE } from './dungeon-boss-rules';
import { enemyHazardProfileForBoss } from './dungeon-encounter-context-rules';
import { DUNGEON_ENEMY_DEFEAT_SCORE } from './dungeon-match-reward-rules';
import {
    activeEnemyHazardsForBoard,
    clearFinalPairEnemyHazardOccupationForRun,
    defeatEnemyHazardOccupationOnFinalPair,
    enemyHazardEligibleTiles
} from './enemy-hazard-board-rules';
import { addPendingMemorizeBonusForLostLives } from './recall-rules';
import { hashStringToSeed } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';
import { isSprungTrapTile } from './tile-state-rules';

const nonNegativeEnemyHazardCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const flippedTileCount = (board: BoardState | null | undefined): number => (Array.isArray(board?.flippedTileIds) ? board.flippedTileIds.length : 0);

export interface EnemyHazardPatternDefinition {
    pattern: EnemyHazardPattern;
    label: string;
    selectionPriority: string;
    telegraph: string;
}

export const ENEMY_HAZARD_PATTERN_DEFINITIONS: Record<EnemyHazardPattern, EnemyHazardPatternDefinition> = {
    patrol: {
        pattern: 'patrol',
        label: 'Patrol',
        selectionPriority: 'Rotates through any active non-utility card.',
        telegraph: 'Shows the next occupied card before movement resolves.'
    },
    stalk: {
        pattern: 'stalk',
        label: 'Stalker',
        selectionPriority: 'Prioritizes hidden active cards.',
        telegraph: 'Pressures unrevealed memory targets.'
    },
    guard: {
        pattern: 'guard',
        label: 'Warden',
        selectionPriority: 'Prioritizes treasure, key, lever, and lock cards.',
        telegraph: 'Guards reward or unlock cards.'
    },
    observe: {
        pattern: 'observe',
        label: 'Observer',
        selectionPriority: 'Prioritizes boss, enemy, and trap cards.',
        telegraph: 'Keeps pressure near encounter cards.'
    }
};

const preferredEnemyHazardTiles = (tiles: readonly Tile[], pattern: EnemyHazardPattern): Tile[] => {
    const eligible = enemyHazardEligibleTiles(tiles);
    if (pattern === 'guard') {
        const guarded = eligible.filter(
            (tile) =>
                tile.dungeonCardKind === 'treasure' ||
                tile.dungeonCardKind === 'key' ||
                tile.dungeonCardKind === 'lever' ||
                tile.dungeonCardKind === 'lock'
        );
        return guarded.length >= 2 ? guarded : eligible;
    }
    if (pattern === 'stalk') {
        const hidden = eligible.filter((tile) => tile.state === 'hidden');
        return hidden.length >= 2 ? hidden : eligible;
    }
    if (pattern === 'observe') {
        const observed = eligible.filter(
            (tile) => tile.dungeonBossId != null || tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap'
        );
        return observed.length >= 2 ? observed : eligible;
    }
    return eligible;
};

export const getEnemyHazardMovementCandidateIds = (
    board: BoardState,
    pattern: EnemyHazardPattern
): string[] => preferredEnemyHazardTiles(board.tiles, pattern).map((tile) => tile.id);

const pickHazardTileId = (
    tiles: readonly Tile[],
    pattern: EnemyHazardPattern,
    turn: number,
    offset: number,
    forbiddenIds: ReadonlySet<string> = new Set()
): string | null => {
    const candidates = preferredEnemyHazardTiles(tiles, pattern).filter((tile) => !forbiddenIds.has(tile.id));
    if (candidates.length === 0) {
        return null;
    }
    return candidates[Math.abs(turn + offset) % candidates.length]?.id ?? null;
};

const buildEnemyHazard = ({
    id,
    kind,
    pattern,
    label,
    hp,
    tiles,
    turn,
    offset,
    bossId,
    forbiddenIds
}: {
    id: string;
    kind: EnemyHazardKind;
    pattern: EnemyHazardPattern;
    label: string;
    hp: number;
    tiles: readonly Tile[];
    turn: number;
    offset: number;
    bossId?: DungeonBossId;
    forbiddenIds: Set<string>;
}): EnemyHazardState | null => {
    const currentTileId = pickHazardTileId(tiles, pattern, turn, offset, forbiddenIds);
    if (!currentTileId) {
        return null;
    }
    forbiddenIds.add(currentTileId);
    const nextTileId = pickHazardTileId(tiles, pattern, turn + 1, offset + 1, forbiddenIds) ?? currentTileId;
    return {
        id,
        kind,
        label,
        currentTileId,
        nextTileId,
        pattern,
        state: 'hidden',
        damage: 1,
        hp,
        maxHp: hp,
        bossId
    };
};

const enemyHazardCountForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    nodeKind: DungeonRunNodeKind | null,
    gameMode?: GameMode
): number => {
    if (!gameMode || gameMode === 'puzzle' || gameMode === 'meditation' || level <= 1) {
        return 0;
    }
    if (nodeKind === 'boss' || floorTag === 'boss') {
        return 1;
    }
    if (nodeKind === 'rest' || nodeKind === 'shop') {
        return level >= 7 ? 1 : 0;
    }
    if (nodeKind === 'trap' || nodeKind === 'elite' || floorArchetypeId === 'trap_hall' || floorArchetypeId === 'rush_recall') {
        return level >= 7 ? 2 : 1;
    }
    if (nodeKind === 'treasure' || nodeKind === 'event' || floorArchetypeId === 'treasure_gallery' || floorArchetypeId === 'script_room') {
        return level >= 8 ? 2 : 1;
    }
    return level >= 5 ? 1 : 0;
};

export const createEnemyHazardsForBoard = ({
    tiles,
    runSeed,
    rulesVersion,
    level,
    floorTag,
    floorArchetypeId,
    nodeKind,
    bossId,
    gameMode
}: {
    tiles: readonly Tile[];
    runSeed: number;
    rulesVersion: number;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    nodeKind: DungeonRunNodeKind | null;
    bossId: DungeonBossId | null;
    gameMode?: GameMode;
}): EnemyHazardState[] => {
    const count = enemyHazardCountForFloor(level, floorTag, floorArchetypeId, nodeKind, gameMode);
    if (count <= 0 || enemyHazardEligibleTiles(tiles).length < 2) {
        return [];
    }
    const forbiddenIds = new Set<string>();
    const turn = Math.abs(hashStringToSeed(`enemyHazards:${rulesVersion}:${runSeed}:${level}`));
    const hazards: EnemyHazardState[] = [];
    if (bossId || nodeKind === 'boss' || floorTag === 'boss') {
        const bossProfile = enemyHazardProfileForBoss(bossId);
        const boss = buildEnemyHazard({
            id: `${level}:boss:${bossId ?? 'rush_sentinel'}`,
            ...bossProfile,
            tiles,
            turn,
            offset: 0,
            bossId: bossId ?? 'rush_sentinel',
            forbiddenIds
        });
        if (boss) hazards.push(boss);
    }
    const normalCount = Math.max(0, count - hazards.length);
    for (let index = 0; index < normalCount; index += 1) {
        const kind: EnemyHazardKind =
            nodeKind === 'trap' || floorArchetypeId === 'trap_hall'
                ? 'stalker'
                : nodeKind === 'treasure' || floorArchetypeId === 'treasure_gallery'
                  ? 'warden'
                  : 'sentinel';
        const pattern: EnemyHazardPattern = kind === 'stalker' ? 'stalk' : kind === 'warden' ? 'guard' : 'patrol';
        const label = kind === 'stalker' ? 'Stalker Shade' : kind === 'warden' ? 'Cache Warden' : 'Patrol Sentry';
        const hazard = buildEnemyHazard({
            id: `${level}:hazard:${index}`,
            kind,
            pattern,
            label,
            hp: kind === 'sentinel' ? 1 : 2,
            tiles,
            turn,
            offset: index + 3,
            forbiddenIds
        });
        if (hazard) hazards.push(hazard);
    }
    return hazards;
};

export const advanceEnemyHazardsOnBoard = (board: BoardState, steps: number = 1): BoardState => {
    const safeSteps = nonNegativeEnemyHazardCount(steps);
    const hazards = activeEnemyHazardsForBoard(board);
    if (hazards.length === 0 || safeSteps <= 0) {
        return board;
    }
    const sourceHazards = board.enemyHazards ?? [];
    const activeIds = new Set(hazards.map((hazard) => hazard.id));
    const nextTurn = nonNegativeEnemyHazardCount(board.enemyHazardTurn) + safeSteps;
    const occupied = new Set<string>();
    const nextHazards = sourceHazards.map((hazard, index) => {
        if (!activeIds.has(hazard.id)) {
            return hazard;
        }
        const currentTileId =
            board.tiles.some((tile) => tile.id === hazard.nextTileId && tile.state !== 'matched' && tile.state !== 'removed')
                ? hazard.nextTileId
                : pickHazardTileId(board.tiles, hazard.pattern, nextTurn, index, occupied) ?? hazard.currentTileId;
        occupied.add(currentTileId);
        const nextTileId = pickHazardTileId(board.tiles, hazard.pattern, nextTurn + 1, index + 1, occupied) ?? currentTileId;
        return { ...hazard, currentTileId, nextTileId };
    });
    return defeatEnemyHazardOccupationOnFinalPair({ ...board, enemyHazardTurn: nextTurn, enemyHazards: nextHazards });
};

export const damageFirstRevealedEnemyHazard = (
    board: BoardState,
    amount: number
): { board: BoardState; defeated: number; bossDefeated: number; score: number } => {
    const target = activeEnemyHazardsForBoard(board).find((hazard) => hazard.state === 'revealed' && hazard.hp > 0);
    if (!target || amount <= 0) {
        return { board, defeated: 0, bossDefeated: 0, score: 0 };
    }
    const nextHp = Math.max(0, target.hp - amount);
    const defeated = nextHp === 0 ? 1 : 0;
    const nextBoard: BoardState = {
        ...board,
        enemyHazards: board.enemyHazards?.map((hazard) =>
            hazard.id === target.id
                ? {
                      ...hazard,
                      hp: nextHp,
                      state: defeated ? 'defeated' : 'revealed'
                  }
                : hazard
        )
    };
    return {
        board: nextBoard,
        defeated,
        bossDefeated: defeated && target.bossId ? 1 : 0,
        score: defeated ? (target.bossId ? DUNGEON_BOSS_DEFEAT_SCORE : DUNGEON_ENEMY_DEFEAT_SCORE) : 0
    };
};

export const applyEnemyHazardClick = (
    run: RunState,
    tileId: string,
    options: { advanceHazards?: boolean } = {}
): RunState => {
    const cleanedRun = clearFinalPairEnemyHazardOccupationForRun(run);
    const board = cleanedRun.board;
    const hazard = activeEnemyHazardsForBoard(board).find((candidate) => candidate.currentTileId === tileId);
    const tile = board?.tiles.find((candidate) => candidate.id === tileId) ?? null;
    const canApplyContact =
        cleanedRun.status === 'playing' ||
        (cleanedRun.status === 'resolving' &&
            cleanedRun.gambitAvailableThisFloor &&
            !cleanedRun.gambitThirdFlipUsed &&
            flippedTileCount(board) === 2);
    if (!board || !hazard || !tile || tile.state !== 'hidden' || !canApplyContact) {
        return cleanedRun;
    }
    const advanceHazards = options.advanceHazards ?? true;
    const guardTokens = nonNegativeEnemyHazardCount(cleanedRun.stats.guardTokens);
    const currentLives = nonNegativeEnemyHazardCount(cleanedRun.lives);
    const damage = nonNegativeEnemyHazardCount(hazard.damage);
    const consumesGuardToken = guardTokens > 0;
    const lives = consumesGuardToken ? currentLives : Math.max(0, currentLives - damage);
    const lostLives = Math.max(0, currentLives - lives);
    const revealedBoard: BoardState = {
        ...board,
        enemyHazards: board.enemyHazards?.map((candidate) =>
            candidate.id === hazard.id ? { ...candidate, state: 'revealed' as const } : candidate
        )
    };
    const advancedBoard = advanceHazards
        ? lives > 0
            ? advanceEnemyHazardsOnBoard(revealedBoard)
            : revealedBoard
        : defeatEnemyHazardOccupationOnFinalPair(revealedBoard);
    return {
        ...cleanedRun,
        status: lives <= 0 ? 'gameOver' : cleanedRun.status,
        lives,
        pendingMemorizeBonusMs: addPendingMemorizeBonusForLostLives(cleanedRun.pendingMemorizeBonusMs, lostLives),
        board: advancedBoard,
        enemyHazardHitsThisFloor: nonNegativeEnemyHazardCount(cleanedRun.enemyHazardHitsThisFloor) + 1,
        stats: {
            ...cleanedRun.stats,
            guardTokens: consumesGuardToken ? Math.max(0, guardTokens - 1) : guardTokens
        }
    };
};

export const defeatEnemyHazardsForFloorClear = (
    board: BoardState
): { board: BoardState; defeated: number; bossesDefeated: number } => {
    const active = board.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
    if (active.length === 0) {
        return { board, defeated: 0, bossesDefeated: 0 };
    }
    const activeIds = new Set(active.map((hazard) => hazard.id));
    const bossesDefeated = active.filter((hazard) => hazard.bossId).length;
    return {
        board: {
            ...board,
            enemyHazards: board.enemyHazards?.map((hazard) =>
                activeIds.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
            )
        },
        defeated: active.length,
        bossesDefeated
    };
};

const getLastUnmatchedRealPairTileIds = (board: BoardState): string[] | null => {
    const unresolvedByPairKey = new Map<string, string[]>();
    for (const tile of board.tiles) {
        if (
            isSingletonUtilityPairKey(tile.pairKey) ||
            tile.state === 'matched' ||
            tile.state === 'removed' ||
            tile.dungeonCardState === 'resolved' ||
            isSprungTrapTile(tile)
        ) {
            continue;
        }
        unresolvedByPairKey.set(tile.pairKey, [...(unresolvedByPairKey.get(tile.pairKey) ?? []), tile.id]);
    }
    return unresolvedByPairKey.size === 1 ? [...unresolvedByPairKey.values()][0] ?? null : null;
};

export const defeatEnemyHazardsBlockingLastPair = (
    board: BoardState
): { board: BoardState; defeated: number; bossesDefeated: number } => {
    const lastPairTileIds = getLastUnmatchedRealPairTileIds(board);
    if (!lastPairTileIds || lastPairTileIds.length === 0) {
        return { board, defeated: 0, bossesDefeated: 0 };
    }
    const blockedTileIds = new Set(lastPairTileIds);
    const blockingHazards =
        board.enemyHazards?.filter(
            (hazard) =>
                hazard.state === 'hidden' &&
                (blockedTileIds.has(hazard.currentTileId) || blockedTileIds.has(hazard.nextTileId))
        ) ?? [];
    if (blockingHazards.length === 0) {
        return { board, defeated: 0, bossesDefeated: 0 };
    }
    const blockingIds = new Set(blockingHazards.map((hazard) => hazard.id));
    return {
        board: {
            ...board,
            enemyHazards: board.enemyHazards?.map((hazard) =>
                blockingIds.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
            )
        },
        defeated: blockingHazards.length,
        bossesDefeated: blockingHazards.filter((hazard) => hazard.bossId != null).length
    };
};

export const clearLastPairEnemyHazardSoftlock = (run: RunState, board: BoardState): RunState => {
    const cleared = defeatEnemyHazardsBlockingLastPair(board);
    if (cleared.defeated === 0) {
        return run.board === board ? run : { ...run, board };
    }
    return {
        ...run,
        board: cleared.board,
        dungeonEnemiesDefeated:
            nonNegativeEnemyHazardCount(run.dungeonEnemiesDefeated) + nonNegativeEnemyHazardCount(cleared.bossesDefeated),
        dungeonEnemiesDefeatedThisFloor:
            nonNegativeEnemyHazardCount(run.dungeonEnemiesDefeatedThisFloor) + nonNegativeEnemyHazardCount(cleared.bossesDefeated),
        enemyHazardsDefeatedThisFloor:
            nonNegativeEnemyHazardCount(run.enemyHazardsDefeatedThisFloor) + nonNegativeEnemyHazardCount(cleared.defeated)
    };
};
