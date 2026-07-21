import type {
    BoardState,
    DungeonBossId,
    DungeonExitLockKind,
    DungeonKeyKind,
    EnemyHazardKind,
    EnemyHazardPattern,
    RouteNodeType,
    RunState,
    Tile
} from './contracts';
import {
    getDungeonBossDefinition,
    getDungeonBossPressureRule,
    type DungeonBossLifecycleSource,
    type DungeonBossPhase
} from './dungeon-boss-rules';
import {
    boardHasActionableProgressionPair,
    countReachableExitKeySources,
    getEffectivePrimaryExitLock
} from './board-inspection';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { dungeonKeyKindArticleLabel, dungeonKeyKindLabel } from './dungeon-key-copy';
import { normalizeSessionStats } from './session-stats-rules';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from './tile-identity';

const nonNegativeDungeonStatusCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const dungeonStatusKeyRecord = (value: unknown): Record<string, unknown> =>
    value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const nonNegativeDungeonStatusCountWithFallback = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : nonNegativeDungeonStatusCount(fallback);

export interface DungeonExitStatus {
    exitTile: Tile | null;
    revealed: boolean;
    lockKind: DungeonExitLockKind;
    requiredLeverCount: number;
    leverCount: number;
    terminalKeySoftlockFallback: boolean;
    keyFallbackPending: boolean;
    hasMatchingKey: boolean;
    hasMasterKey: boolean;
    canActivateWithoutSpend: boolean;
    canActivateWithKey: boolean;
    canActivateWithMasterKey: boolean;
    canActivate: boolean;
    lockedReason: string | null;
    routeType: RouteNodeType | null;
}

export interface DungeonThreatStatus {
    trapCardPairCount: number;
    hiddenTrapCardPairCount: number;
    armedTrapCardPairCount: number;
    resolvedTrapCardPairCount: number;
    movingEnemyHazardCount: number;
    revealedMovingEnemyHazardCount: number;
    bossMovingEnemyHazardCount: number;
    trapVocabulary: 'trap_card';
    movingHazardVocabulary: 'moving_enemy_hazard';
}

export interface DungeonEnemyLifecycleStatus {
    enemyCardPairCount: number;
    hiddenEnemyCardPairCount: number;
    awakeEnemyCardPairCount: number;
    defeatedEnemyCardPairCount: number;
    movingEnemyHazardCount: number;
    revealedMovingEnemyHazardCount: number;
    defeatedMovingEnemyHazardCount: number;
    activeBossEnemyCount: number;
    enemyCardVocabulary: 'enemy_card_pair';
    movingEnemyVocabulary: 'moving_enemy_patrol';
}

export interface DungeonBossReadModel {
    id: DungeonBossId;
    label: string;
    symbol: string;
    hazardKind: EnemyHazardKind;
    hazardPattern: EnemyHazardPattern;
    signatureModifier: string;
    rewardHook: string;
    cardCopy: string;
    visualAudioPlaceholders: string[];
    pressureCopy: string | null;
    bossCardPairCount: number;
    activeBossCardPairCount: number;
    movingPatrolCount: number;
    activeMovingPatrolCount: number;
    lifecycleSource: DungeonBossLifecycleSource;
    hp: number;
    maxHp: number;
    phase: DungeonBossPhase;
    phaseCopy: string;
}

export interface DungeonBoardStatus {
    exitCount: number;
    revealedExitCount: number;
    armedTrapCount: number;
    awakeEnemyCount: number;
    hiddenDungeonCardCount: number;
    leverCount: number;
    requiredLeverCount: number;
    keyCount: number;
    shopAvailable: boolean;
    roomAvailable: boolean;
    bossId: BoardState['dungeonBossId'];
    enemyHazardCount: number;
    revealedEnemyHazardCount: number;
    bossHazardLabel: string | null;
    objectiveId: BoardState['dungeonObjectiveId'];
    objectiveCompleted: boolean;
    objectiveProgress: number;
    objectiveRequired: number;
    objectiveLabel: string;
    threatStatus: DungeonThreatStatus;
    enemyLifecycleStatus: DungeonEnemyLifecycleStatus;
    bossReadModel: DungeonBossReadModel | null;
}

export interface DungeonObjectiveStatus {
    objectiveId: BoardState['dungeonObjectiveId'];
    completed: boolean;
    progress: number;
    required: number;
    label: string;
    detail: string;
}

export type DungeonBoardPresentationChipTone = 'neutral' | 'danger' | 'warning' | 'success' | 'info';

export interface DungeonBoardPresentationChip {
    id: string;
    label: string;
    value: string;
    tone: DungeonBoardPresentationChipTone;
    priority: number;
}

export interface DungeonBoardPresentation {
    visible: boolean;
    title: string;
    objectiveText: string | null;
    objectiveDetail: string | null;
    objectiveProgress: number;
    objectiveRequired: number;
    objectiveLabel: string | null;
    exitText: string | null;
    keyText: string | null;
    bossText: string | null;
    alertText: string | null;
    combatForecastText: string | null;
    chips: DungeonBoardPresentationChip[];
}

export const getDungeonExitStatus = (run: RunState): DungeonExitStatus => {
    const board = run.board;
    const exits = board?.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY) ?? [];
    const primaryExit = exits.find((tile) => tile.id === board?.dungeonExitTileId) ?? null;
    const undefeatedBossHazard = activeEnemyHazardsForBoard(board).find((hazard) => hazard.bossId) ?? null;
    const activeBossCard = board?.tiles.find(
        (tile) =>
            tile.dungeonBossId != null &&
            tile.state !== 'matched' &&
            tile.state !== 'removed' &&
            tile.dungeonCardState !== 'resolved'
    ) ?? null;
    const unresolvedBossObjective =
        board?.dungeonObjectiveId === 'defeat_boss' &&
        (undefeatedBossHazard != null || activeBossCard != null) &&
        !getDungeonObjectiveStatus(run).completed;
    const bossBlocksExit = unresolvedBossObjective;
    const effectivePrimaryExitLock = board
        ? getEffectivePrimaryExitLock({
              board,
              dungeonKeys: run.dungeonKeys,
              dungeonMasterKeys: run.dungeonMasterKeys
          })
        : null;
    const effectiveExitLock = (
        tile: Tile | null
    ): { lockKind: DungeonExitLockKind; requiredLeverCount: number; terminalKeySoftlockFallback: boolean } => {
        const rawLockKind = tile?.dungeonExitLockKind ?? board?.dungeonExitLockKind ?? 'none';
        const rawRequiredLeverCount = tile?.dungeonExitRequiredLeverCount ?? board?.dungeonExitRequiredLeverCount ?? 0;
        const primaryExitId = effectivePrimaryExitLock?.exitTile?.id ?? board?.dungeonExitTileId ?? primaryExit?.id ?? null;
        const isPrimaryExit = tile != null && primaryExitId != null && tile.id === primaryExitId;

        if (!isPrimaryExit || !effectivePrimaryExitLock) {
            return { lockKind: rawLockKind, requiredLeverCount: rawRequiredLeverCount, terminalKeySoftlockFallback: false };
        }
        return {
            lockKind: effectivePrimaryExitLock.lockKind,
            requiredLeverCount: effectivePrimaryExitLock.requiredLeverCount,
            terminalKeySoftlockFallback: effectivePrimaryExitLock.terminalKeySoftlockFallback
        };
    };
    const tileCanActivate = (tile: Tile): boolean => {
        const { lockKind: candidateLockKind, requiredLeverCount: candidateRequiredLevers } = effectiveExitLock(tile);
        const candidateLeverSatisfied =
            candidateLockKind !== 'lever' ||
            nonNegativeDungeonStatusCount(board?.dungeonLeverCount) >= candidateRequiredLevers;
        const candidateHasKey =
            candidateLockKind !== 'none' &&
            candidateLockKind !== 'lever' &&
            (nonNegativeDungeonStatusCount(run.dungeonKeys[candidateLockKind]) > 0 ||
                nonNegativeDungeonStatusCount(run.dungeonMasterKeys) > 0);
        return (
            tile.state !== 'hidden' &&
            !bossBlocksExit &&
            (candidateLockKind === 'none' ||
                (candidateLockKind === 'lever' && candidateLeverSatisfied) ||
                candidateHasKey)
        );
    };
    const exitTile =
        exits.find((tile) => tile.dungeonExitActivated) ??
        exits.find(tileCanActivate) ??
        primaryExit ??
        exits.find((tile) => tile.state !== 'hidden') ??
        exits[0] ??
        null;
    const { lockKind, requiredLeverCount, terminalKeySoftlockFallback } = effectiveExitLock(exitTile);
    const leverCount = nonNegativeDungeonStatusCount(board?.dungeonLeverCount);
    const hasMatchingKey =
        lockKind !== 'none' && lockKind !== 'lever' && nonNegativeDungeonStatusCount(run.dungeonKeys[lockKind]) > 0;
    const hasMasterKey = nonNegativeDungeonStatusCount(run.dungeonMasterKeys) > 0;
    const keyFallbackPending =
        Boolean(board) &&
        lockKind !== 'none' &&
        lockKind !== 'lever' &&
        !hasMatchingKey &&
        !hasMasterKey &&
        countReachableExitKeySources(board!, lockKind) <= 0 &&
        boardHasActionableProgressionPair(board!);
    const revealed = Boolean(exitTile && exitTile.state !== 'hidden');
    const leverSatisfied = lockKind !== 'lever' || leverCount >= requiredLeverCount;
    const canActivateWithoutSpend = revealed && lockKind === 'none' && !bossBlocksExit;
    const canActivateWithKey = revealed && lockKind !== 'none' && lockKind !== 'lever' && hasMatchingKey && !bossBlocksExit;
    const canActivateWithMasterKey = revealed && lockKind !== 'none' && lockKind !== 'lever' && hasMasterKey && !bossBlocksExit;
    const canActivate =
        canActivateWithoutSpend ||
        (revealed && lockKind === 'lever' && leverSatisfied && !bossBlocksExit) ||
        canActivateWithKey ||
        canActivateWithMasterKey;
    let lockedReason: string | null = null;
    if (!exitTile) {
        lockedReason = 'No exit is present on this floor.';
    } else if (!revealed) {
        lockedReason = 'Reveal the exit card first.';
    } else if (bossBlocksExit) {
        lockedReason = `Defeat ${undefeatedBossHazard?.label ?? activeBossCard?.label ?? dungeonBossLabel(board?.dungeonBossId) ?? 'the boss'} before using the exit.`;
    } else if (lockKind === 'lever' && !leverSatisfied) {
        lockedReason = `Find ${Math.max(requiredLeverCount - leverCount, 0)} more lever pair(s).`;
    } else if (keyFallbackPending) {
        lockedReason = 'No key source remains; clear the remaining pairs to force the exit open.';
    } else if (lockKind !== 'none' && lockKind !== 'lever' && !hasMatchingKey && !hasMasterKey) {
        lockedReason = `Needs ${dungeonKeyKindArticleLabel(lockKind as DungeonKeyKind)} or master key.`;
    }
    return {
        exitTile,
        revealed,
        lockKind,
        requiredLeverCount,
        leverCount,
        terminalKeySoftlockFallback,
        keyFallbackPending,
        hasMatchingKey,
        hasMasterKey,
        canActivateWithoutSpend,
        canActivateWithKey,
        canActivateWithMasterKey,
        canActivate,
        lockedReason,
        routeType: exitTile?.dungeonRouteType ?? null
    };
};

const dungeonObjectiveLabel = (objectiveId: BoardState['dungeonObjectiveId']): string => {
    if (objectiveId === 'open_bonus_exit') return 'Open a bonus exit';
    if (objectiveId === 'disarm_traps') return 'Disarm the traps';
    if (objectiveId === 'defeat_boss') return 'Defeat the boss';
    if (objectiveId === 'pacify_floor') return 'Pacify the floor';
    if (objectiveId === 'claim_route') return 'Claim a route';
    if (objectiveId === 'loot_cache') return 'Loot a cache';
    if (objectiveId === 'reveal_unknowns') return 'Reveal unknowns';
    return 'Find the exit';
};

const countDungeonPairs = (tiles: readonly Tile[], predicate: (tile: Tile) => boolean): number =>
    new Set(tiles.filter(predicate).map((tile) => tile.pairKey)).size;

const countResolvedDungeonPairs = (tiles: readonly Tile[], predicate: (tile: Tile) => boolean): number =>
    countDungeonPairs(
        tiles,
        (tile) =>
            predicate(tile) &&
            (tile.dungeonCardState === 'resolved' || tile.state === 'matched' || tile.state === 'removed')
    );

export const getDungeonThreatStatus = (board: BoardState | null | undefined): DungeonThreatStatus => {
    const activeTiles =
        board?.tiles.filter(
            (tile) =>
                tile.state !== 'matched' &&
                tile.state !== 'removed' &&
                tile.dungeonCardState !== 'resolved' &&
                tile.dungeonCardKind != null
        ) ?? [];
    const movingEnemyHazards = activeEnemyHazardsForBoard(board);

    return {
        trapCardPairCount: countDungeonPairs(
            board?.tiles ?? [],
            (tile) => tile.dungeonCardKind === 'trap' && tile.state !== 'matched' && tile.state !== 'removed'
        ),
        hiddenTrapCardPairCount: countDungeonPairs(
            activeTiles,
            (tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'hidden'
        ),
        armedTrapCardPairCount: countDungeonPairs(
            activeTiles,
            (tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed'
        ),
        resolvedTrapCardPairCount: countDungeonPairs(
            board?.tiles ?? [],
            (tile) =>
                tile.dungeonCardKind === 'trap' &&
                (tile.dungeonCardState === 'resolved' || tile.state === 'matched' || tile.state === 'removed')
        ),
        movingEnemyHazardCount: movingEnemyHazards.length,
        revealedMovingEnemyHazardCount: movingEnemyHazards.filter((hazard) => hazard.state === 'revealed').length,
        bossMovingEnemyHazardCount: movingEnemyHazards.filter((hazard) => hazard.bossId != null).length,
        trapVocabulary: 'trap_card',
        movingHazardVocabulary: 'moving_enemy_hazard'
    };
};

export const getDungeonEnemyLifecycleStatus = (runOrBoard: RunState | BoardState | null | undefined): DungeonEnemyLifecycleStatus => {
    const board = runOrBoard && 'tiles' in runOrBoard ? runOrBoard : runOrBoard?.board;
    const defeatedEnemyCounter =
        runOrBoard && 'board' in runOrBoard ? nonNegativeDungeonStatusCount(runOrBoard.dungeonEnemiesDefeatedThisFloor) : 0;
    const activeTiles =
        board?.tiles.filter(
            (tile) =>
                tile.state !== 'matched' &&
                tile.state !== 'removed' &&
                tile.dungeonCardState !== 'resolved' &&
                tile.dungeonCardKind != null
        ) ?? [];
    const resolvedEnemyPairs = countResolvedDungeonPairs(board?.tiles ?? [], (tile) => tile.dungeonCardKind === 'enemy');
    const counterOnlyDefeated = Math.max(0, defeatedEnemyCounter - resolvedEnemyPairs);
    const movingHazards = board?.enemyHazards ?? [];
    const activeMovingHazards = activeEnemyHazardsForBoard(board);

    return {
        enemyCardPairCount:
            countDungeonPairs(board?.tiles ?? [], (tile) => tile.dungeonCardKind === 'enemy') + counterOnlyDefeated,
        hiddenEnemyCardPairCount: countDungeonPairs(
            activeTiles,
            (tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardState === 'hidden'
        ),
        awakeEnemyCardPairCount: countDungeonPairs(
            activeTiles,
            (tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardState === 'revealed'
        ),
        defeatedEnemyCardPairCount: resolvedEnemyPairs + counterOnlyDefeated,
        movingEnemyHazardCount: activeMovingHazards.length,
        revealedMovingEnemyHazardCount: activeMovingHazards.filter((hazard) => hazard.state === 'revealed').length,
        defeatedMovingEnemyHazardCount: movingHazards.filter((hazard) => hazard.state === 'defeated').length,
        activeBossEnemyCount:
            activeTiles.filter((tile) => tile.dungeonBossId != null).length > 0
                ? 1
                : activeMovingHazards.filter((hazard) => hazard.bossId != null).length,
        enemyCardVocabulary: 'enemy_card_pair',
        movingEnemyVocabulary: 'moving_enemy_patrol'
    };
};

const dungeonBossPhaseForHp = (hp: number, maxHp: number, source: DungeonBossLifecycleSource): DungeonBossPhase => {
    if (source === 'none') {
        return 'unseen';
    }
    if (maxHp <= 0 || hp <= 0) {
        return 'defeated';
    }
    return hp <= Math.floor(maxHp / 2) ? 'bloodied' : 'opening';
};

const dungeonBossPhaseCopy = (phase: DungeonBossPhase): string => {
    if (phase === 'defeated') return 'Boss defeated.';
    if (phase === 'bloodied') return 'Boss bloodied; signature pressure remains active.';
    if (phase === 'opening') return 'Boss active; signature pressure is readable from its card or patrol pattern.';
    return 'Boss identity assigned, but no active boss enemy is present.';
};

export const getDungeonBossReadModel = (
    runOrBoard: RunState | BoardState | null | undefined,
    bossId?: DungeonBossId | null
): DungeonBossReadModel | null => {
    const board = runOrBoard && 'tiles' in runOrBoard ? runOrBoard : runOrBoard?.board;
    const resolvedBossId =
        bossId ??
        board?.dungeonBossId ??
        board?.tiles.find((tile) => tile.dungeonBossId != null)?.dungeonBossId ??
        board?.enemyHazards?.find((hazard) => hazard.bossId != null)?.bossId ??
        null;
    const definition = getDungeonBossDefinition(resolvedBossId);
    if (!definition) {
        return null;
    }
    const pressure = getDungeonBossPressureRule(definition.id);

    const bossTiles = board?.tiles.filter((tile) => tile.dungeonBossId === definition.id) ?? [];
    const activeBossTiles = bossTiles.filter(
        (tile) => tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardState !== 'resolved'
    );
    const bossHazards = board?.enemyHazards?.filter((hazard) => hazard.bossId === definition.id) ?? [];
    const activeBossHazards = activeEnemyHazardsForBoard(board).filter((hazard) => hazard.bossId === definition.id);
    const bossTileMaxHp = (tile: Tile): number =>
        nonNegativeDungeonStatusCountWithFallback(tile.dungeonCardMaxHp, definition.hp);
    const bossTileHp = (tile: Tile): number =>
        nonNegativeDungeonStatusCountWithFallback(tile.dungeonCardHp, bossTileMaxHp(tile));
    const bossHazardMaxHp = (hazard: { maxHp: number }): number =>
        nonNegativeDungeonStatusCountWithFallback(hazard.maxHp, definition.hp);
    const bossHazardHp = (hazard: { hp: number; maxHp: number }): number =>
        nonNegativeDungeonStatusCountWithFallback(hazard.hp, bossHazardMaxHp(hazard));
    const lifecycleSource: DungeonBossLifecycleSource =
        countDungeonPairs(activeBossTiles, () => true) > 0
            ? 'boss_card_pair'
            : activeBossHazards.length > 0
              ? 'moving_patrol'
              : 'none';
    const maxHp =
        lifecycleSource === 'boss_card_pair'
            ? Math.max(0, ...bossTiles.map(bossTileMaxHp))
            : lifecycleSource === 'moving_patrol'
              ? Math.max(0, ...bossHazards.map(bossHazardMaxHp))
              : definition.hp;
    const hp =
        lifecycleSource === 'boss_card_pair'
            ? Math.max(0, ...activeBossTiles.map(bossTileHp))
            : lifecycleSource === 'moving_patrol'
              ? Math.max(0, ...activeBossHazards.map(bossHazardHp))
              : 0;
    const phase =
        lifecycleSource === 'none' && (bossTiles.length > 0 || bossHazards.length > 0)
            ? 'defeated'
            : dungeonBossPhaseForHp(hp, maxHp, lifecycleSource);

    return {
        id: definition.id,
        label: definition.label,
        symbol: definition.symbol,
        hazardKind: definition.hazardKind,
        hazardPattern: definition.hazardPattern,
        signatureModifier: definition.signatureModifier,
        rewardHook: definition.rewardHook,
        cardCopy: definition.cardCopy,
        visualAudioPlaceholders: [...definition.visualAudioPlaceholders],
        pressureCopy: pressure?.pressureCopy ?? null,
        bossCardPairCount: countDungeonPairs(bossTiles, () => true),
        activeBossCardPairCount: countDungeonPairs(activeBossTiles, () => true),
        movingPatrolCount: bossHazards.length,
        activeMovingPatrolCount: activeBossHazards.length,
        lifecycleSource,
        hp,
        maxHp,
        phase,
        phaseCopy: dungeonBossPhaseCopy(phase)
    };
};

export const getDungeonObjectiveStatus = (run: RunState): DungeonObjectiveStatus => {
    const board = run.board;
    const objectiveId = board?.dungeonObjectiveId ?? 'find_exit';
    const label = dungeonObjectiveLabel(objectiveId);
    if (!board) {
        return { objectiveId, completed: false, progress: 0, required: 1, label, detail: 'No active floor.' };
    }

    const exits = board.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY);
    const revealedExitCount = exits.filter((tile) => tile.state !== 'hidden' || tile.dungeonExitActivated).length;
    if (objectiveId === 'find_exit') {
        const completed = revealedExitCount > 0 || board.dungeonExitActivated === true;
        return {
            objectiveId,
            completed,
            progress: completed ? 1 : 0,
            required: 1,
            label,
            detail: completed ? 'Exit found.' : 'Reveal any exit card.'
        };
    }

    if (objectiveId === 'open_bonus_exit') {
        const primaryExitId = board.dungeonExitTileId ?? exits[0]?.id ?? null;
        const bonusRevealed = exits.some(
            (tile) => tile.id !== primaryExitId && (tile.state !== 'hidden' || tile.dungeonExitActivated)
        );
        return {
            objectiveId,
            completed: bonusRevealed,
            progress: bonusRevealed ? 1 : 0,
            required: 1,
            label,
            detail: bonusRevealed ? 'Bonus route found.' : 'Reveal a non-primary exit card.'
        };
    }

    if (objectiveId === 'disarm_traps') {
        const activeTrapPairs = countDungeonPairs(board.tiles, (tile) => tile.dungeonCardKind === 'trap');
        const resolvedTrapPairs = countResolvedDungeonPairs(board.tiles, (tile) => tile.dungeonCardKind === 'trap');
        const counterOnlyResolved = Math.max(
            0,
            nonNegativeDungeonStatusCount(run.dungeonTrapsResolvedThisFloor) - resolvedTrapPairs
        );
        const required = Math.max(1, activeTrapPairs + counterOnlyResolved);
        const progress = resolvedTrapPairs + counterOnlyResolved;
        return {
            objectiveId,
            completed: progress >= required,
            progress: Math.min(progress, required),
            required,
            label,
            detail: `${Math.min(progress, required)}/${required} trap pair(s) resolved.`
        };
    }

    if (objectiveId === 'pacify_floor') {
        const activeEnemyPairs = countDungeonPairs(board.tiles, (tile) => tile.dungeonCardKind === 'enemy');
        const resolvedEnemyPairs = countResolvedDungeonPairs(board.tiles, (tile) => tile.dungeonCardKind === 'enemy');
        const movingEnemyHazards = board.enemyHazards ?? [];
        const activeMovingEnemyHazardIds = new Set(activeEnemyHazardsForBoard(board).map((hazard) => hazard.id));
        const resolvedMovingEnemyHazards = movingEnemyHazards.filter(
            (hazard) => hazard.state === 'defeated' || !activeMovingEnemyHazardIds.has(hazard.id)
        ).length;
        const counterOnlyDefeated = Math.max(
            0,
            nonNegativeDungeonStatusCount(run.dungeonEnemiesDefeatedThisFloor) -
                resolvedEnemyPairs -
                resolvedMovingEnemyHazards
        );
        const progress = resolvedEnemyPairs + resolvedMovingEnemyHazards + counterOnlyDefeated;
        const required = Math.max(1, activeEnemyPairs + resolvedMovingEnemyHazards + counterOnlyDefeated);
        return {
            objectiveId,
            completed: progress >= required,
            progress: Math.min(progress, required),
            required,
            label,
            detail: `${Math.min(progress, required)}/${required} enemy threat(s) pacified.`
        };
    }

    if (objectiveId === 'claim_route') {
        const routeExitActivated = board.tiles.some(
            (tile) => tile.dungeonCardKind === 'exit' && tile.dungeonExitActivated === true && tile.dungeonRouteType != null
        );
        const completed =
            nonNegativeDungeonStatusCount(run.dungeonGatewaysUsedThisFloor) > 0 ||
            board.selectedGatewayRouteType != null ||
            routeExitActivated;
        return {
            objectiveId,
            completed,
            progress: completed ? 1 : 0,
            required: 1,
            label,
            detail: completed ? 'Route claimed.' : 'Match a gateway or activate a route exit.'
        };
    }

    if (objectiveId === 'defeat_boss') {
        const bossHazards = board.enemyHazards?.filter((hazard) => hazard.bossId) ?? [];
        const activeBossHazards = activeEnemyHazardsForBoard(board).filter((hazard) => hazard.bossId);
        if (bossHazards.length > 0) {
            const required = Math.max(1, ...bossHazards.map((hazard) => nonNegativeDungeonStatusCountWithFallback(hazard.maxHp, 1)));
            const activeHp = Math.max(
                0,
                ...activeBossHazards.map((hazard) =>
                    nonNegativeDungeonStatusCountWithFallback(hazard.hp, nonNegativeDungeonStatusCountWithFallback(hazard.maxHp, 1))
                )
            );
            const completed = activeBossHazards.length === 0;
            const progress = completed ? required : Math.max(0, required - activeHp);
            return {
                objectiveId,
                completed,
                progress,
                required,
                label,
                detail: completed ? 'Boss defeated.' : `${progress}/${required} boss damage.`
            };
        }
        const bossTiles = board.tiles.filter((tile) => tile.dungeonBossId != null);
        const required = Math.max(1, ...bossTiles.map((tile) => nonNegativeDungeonStatusCountWithFallback(tile.dungeonCardMaxHp, 1)));
        const activeHp = Math.max(
            0,
            ...bossTiles.map((tile) =>
                nonNegativeDungeonStatusCountWithFallback(tile.dungeonCardHp, nonNegativeDungeonStatusCountWithFallback(tile.dungeonCardMaxHp, 1))
            )
        );
        const bossResolved =
            bossTiles.length > 0 &&
            bossTiles.every(
                (tile) => tile.dungeonCardState === 'resolved' || tile.state === 'matched' || tile.state === 'removed'
            );
        const completed =
            bossResolved ||
            (bossTiles.length === 0 &&
                board.dungeonBossId != null &&
                nonNegativeDungeonStatusCount(run.dungeonEnemiesDefeated) > 0);
        const progress = completed ? required : Math.max(0, required - activeHp);
        return {
            objectiveId,
            completed,
            progress,
            required,
            label,
            detail: completed ? 'Boss defeated.' : `${progress}/${required} boss damage.`
        };
    }

    if (objectiveId === 'loot_cache') {
        const resolvedPairs = countDungeonPairs(
            board.tiles,
            (tile) =>
                ((tile.dungeonCardKind === 'treasure' && tile.dungeonCardEffectId !== 'treasure_shard') ||
                    tile.dungeonCardKind === 'lock') &&
                (tile.dungeonCardState === 'resolved' || tile.state === 'matched')
        );
        const openedRooms = board.tiles.filter(
            (tile) => tile.dungeonCardEffectId === 'room_locked_cache' && tile.dungeonRoomUsed === true
        ).length;
        const progress = Math.max(nonNegativeDungeonStatusCount(run.dungeonTreasuresOpenedThisFloor), resolvedPairs + openedRooms);
        return {
            objectiveId,
            completed: progress >= 1,
            progress: Math.min(progress, 1),
            required: 1,
            label,
            detail: progress >= 1 ? 'Cache looted.' : 'Open a treasure, lock, or locked cache.'
        };
    }

    const revealTargets = board.tiles.filter(
        (tile) => tile.dungeonCardKind != null && tile.pairKey !== EXIT_PAIR_KEY && tile.dungeonCardState != null
    );
    const required = Math.max(1, Math.min(2, countDungeonPairs(revealTargets, () => true)));
    const progress = Math.min(
        required,
        countDungeonPairs(revealTargets, (tile) => tile.dungeonCardState !== 'hidden' || tile.state !== 'hidden')
    );
    return {
        objectiveId,
        completed: progress >= required,
        progress,
        required,
        label,
        detail: `${progress}/${required} unknown card pair(s) revealed.`
    };
};

export const getDungeonBoardStatus = (run: RunState): DungeonBoardStatus => {
    const board = run.board;
    const activeTiles =
        board?.tiles.filter(
            (tile) =>
                tile.state !== 'matched' &&
                tile.state !== 'removed' &&
                tile.dungeonCardState !== 'resolved' &&
                tile.dungeonCardKind != null
        ) ?? [];
    const objective = getDungeonObjectiveStatus(run);
    const activeEnemyHazards = activeEnemyHazardsForBoard(board);
    const bossHazard = activeEnemyHazards.find((hazard) => hazard.bossId);
    const threatStatus = getDungeonThreatStatus(board);
    const enemyLifecycleStatus = getDungeonEnemyLifecycleStatus(run);
    const bossReadModel = getDungeonBossReadModel(run);
    const exitStatus = getDungeonExitStatus(run);
    return {
        exitCount: board?.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY).length ?? 0,
        revealedExitCount: board?.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY && tile.state !== 'hidden').length ?? 0,
        armedTrapCount: threatStatus.armedTrapCardPairCount,
        awakeEnemyCount: new Set(
            activeTiles
                .filter((tile) => tile.dungeonCardKind === 'enemy' && tile.dungeonCardState === 'revealed')
                .map((tile) => tile.pairKey)
        ).size,
        hiddenDungeonCardCount: new Set(
            activeTiles.filter((tile) => tile.dungeonCardState === 'hidden').map((tile) => tile.pairKey)
        ).size,
        leverCount: nonNegativeDungeonStatusCount(board?.dungeonLeverCount),
        requiredLeverCount: exitStatus.requiredLeverCount,
        keyCount:
            Object.values(dungeonStatusKeyRecord(run.dungeonKeys)).reduce<number>(
                (sum, count) => sum + nonNegativeDungeonStatusCount(count),
                0
            ) +
            nonNegativeDungeonStatusCount(run.dungeonMasterKeys),
        shopAvailable: Boolean(
            board?.tiles.some((tile) => tile.pairKey === SHOP_PAIR_KEY && tile.dungeonCardState !== 'resolved')
        ),
        roomAvailable: Boolean(
            board?.tiles.some((tile) => tile.pairKey === ROOM_PAIR_KEY && tile.dungeonCardState !== 'resolved')
        ),
        bossId: board?.dungeonBossId ?? null,
        enemyHazardCount: activeEnemyHazards.length,
        revealedEnemyHazardCount: activeEnemyHazards.filter((hazard) => hazard.state === 'revealed').length,
        bossHazardLabel: bossHazard?.label ?? null,
        objectiveId: board?.dungeonObjectiveId ?? null,
        objectiveCompleted: objective.completed,
        objectiveProgress: objective.progress,
        objectiveRequired: objective.required,
        objectiveLabel: objective.label,
        threatStatus,
        enemyLifecycleStatus,
        bossReadModel
    };
};

const dungeonBossLabel = (bossId: BoardState['dungeonBossId']): string | null => {
    return getDungeonBossDefinition(bossId)?.label ?? null;
};

const dungeonLockSummary = (status: DungeonExitStatus, objective?: DungeonObjectiveStatus): string | null => {
    if (!status.exitTile) {
        return null;
    }
    if (!status.revealed) {
        if (objective?.objectiveId === 'defeat_boss' && objective.completed) {
            return 'Boss defeated - reveal exit';
        }
        return 'Exit hidden';
    }
    if (status.lockKind === 'none') {
        return 'Exit open';
    }
    if (status.lockKind === 'lever') {
        return `Levers ${status.leverCount}/${status.requiredLeverCount}`;
    }
    if (status.keyFallbackPending) {
        return 'Clear pairs to open';
    }
    const keyLabel = dungeonKeyKindLabel(status.lockKind as DungeonKeyKind);
    return status.canActivate ? `${keyLabel} ready` : `Needs ${keyLabel}`;
};

const DUNGEON_HUD_CHIP_LIMIT = 6;

const dungeonHudChip = (
    id: string,
    label: string,
    value: string,
    tone: DungeonBoardPresentationChipTone,
    priority: number
): DungeonBoardPresentationChip => ({ id, label, value, tone, priority });

const orderDungeonHudChips = (chips: readonly DungeonBoardPresentationChip[]): DungeonBoardPresentationChip[] =>
    [...chips].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, DUNGEON_HUD_CHIP_LIMIT);

const getDungeonCombatForecastText = (run: RunState, status: DungeonBoardStatus): string | null => {
    const activeHazards = activeEnemyHazardsForBoard(run.board);
    const maxContactDamage = activeHazards.reduce((max, hazard) => Math.max(max, hazard.damage), 0);
    const hasEnemyPressure = maxContactDamage > 0 || status.awakeEnemyCount > 0;
    if (!hasEnemyPressure) {
        return null;
    }

    const stats = normalizeSessionStats(run.stats);
    if (stats.guardTokens > 0) {
        const noun = stats.guardTokens === 1 ? 'guard' : 'guards';
        return `${stats.guardTokens} ${noun} ready: the next enemy hit spends guard before life.`;
    }

    const forecasts: string[] = [];
    if (maxContactDamage > 0) {
        forecasts.push(`patrol contact costs up to ${maxContactDamage} ${maxContactDamage === 1 ? 'life' : 'lives'}`);
    }
    if (status.awakeEnemyCount > 0) {
        forecasts.push('awake enemies cost 1 life on mismatch');
    }
    return `No guard: ${forecasts.join('; ')}.`;
};

export const getDungeonBoardPresentation = (run: RunState): DungeonBoardPresentation => {
    const board = run.board;
    const objective = getDungeonObjectiveStatus(run);
    const status = getDungeonBoardStatus(run);
    const exit = getDungeonExitStatus(run);
    const hasDungeonCards = Boolean(board?.tiles.some((tile) => tile.dungeonCardKind != null));
    const hasDungeonObjective = board?.dungeonObjectiveId != null && board.dungeonObjectiveId !== 'find_exit';
    const visible = Boolean(board) && (hasDungeonCards || hasDungeonObjective);
    if (!visible) {
        return {
            visible: false,
            title: 'Dungeon',
            objectiveText: null,
            objectiveDetail: null,
            objectiveProgress: 0,
            objectiveRequired: 0,
            objectiveLabel: null,
            exitText: null,
            keyText: null,
            bossText: null,
            alertText: null,
            combatForecastText: null,
            chips: []
        };
    }

    const hiddenCount = status.hiddenDungeonCardCount;
    const activeExitText = dungeonLockSummary(exit, objective);
    const keyText = `${status.keyCount} ${status.keyCount === 1 ? 'key' : 'keys'}`;
    const patrolNoun = status.enemyHazardCount === 1 ? 'patrol is' : 'patrols are';
    const chips: DungeonBoardPresentationChip[] = [];
    if (activeExitText) {
        chips.push(dungeonHudChip('exit', 'Exit', activeExitText, exit.canActivate ? 'success' : exit.revealed ? 'warning' : 'neutral', 30));
    }
    const bossText = status.bossHazardLabel ?? status.bossReadModel?.label ?? dungeonBossLabel(status.bossId);
    const bossPressureCopy = status.bossReadModel?.pressureCopy ?? null;
    if (bossText) {
        const bossValue = status.bossReadModel
            ? `${status.bossReadModel.hp}/${status.bossReadModel.maxHp} HP`
            : 'active';
        chips.push(dungeonHudChip('boss', 'Boss', bossValue, status.objectiveId === 'defeat_boss' ? 'danger' : 'warning', 20));
    }
    if (status.keyCount > 0 || exit.lockKind !== 'none') {
        chips.push(dungeonHudChip('keys', 'Keys', keyText, status.keyCount > 0 ? 'info' : 'neutral', 50));
    }
    if (status.armedTrapCount > 0) {
        chips.push(dungeonHudChip('traps', 'Traps', String(status.armedTrapCount), 'danger', 10));
    }
    if (status.awakeEnemyCount > 0) {
        chips.push(dungeonHudChip('enemies', 'Enemies', String(status.awakeEnemyCount), 'danger', 25));
    }
    if (status.enemyHazardCount > 0) {
        chips.push(
            dungeonHudChip(
                'enemy-hazards',
                'Patrols',
                `${status.revealedEnemyHazardCount}/${status.enemyHazardCount}`,
                status.revealedEnemyHazardCount > 0 ? 'danger' : 'warning',
                15
            )
        );
    }
    if (hiddenCount > 0) {
        chips.push(dungeonHudChip('hidden', 'Hidden', String(hiddenCount), 'neutral', 90));
    }
    if (status.roomAvailable) {
        chips.push(dungeonHudChip('room', 'Room', 'available', 'info', 70));
    }
    if (status.shopAvailable) {
        chips.push(dungeonHudChip('shop', 'Shop', 'available', 'info', 80));
    }

    const bossDoneExitHidden =
        objective.objectiveId === 'defeat_boss' && objective.completed && exit.exitTile != null && !exit.revealed;
    const alertText =
        status.armedTrapCount > 0
            ? `${status.armedTrapCount} armed ${status.armedTrapCount === 1 ? 'trap card' : 'trap cards'} will spring on mismatches.`
            : bossDoneExitHidden
              ? 'Boss defeated. Reveal the exit card, then activate it to leave.'
            : bossPressureCopy
              ? bossPressureCopy
              : status.revealedEnemyHazardCount > 0
              ? `${status.revealedEnemyHazardCount}/${status.enemyHazardCount} moving enemy ${patrolNoun} revealed. Safe matches damage revealed patrols; occupied cards still cost guard or life.`
            : status.enemyHazardCount > 0
              ? `${status.enemyHazardCount} moving enemy ${patrolNoun} moving after each action. Avoid occupied cards.`
            : status.awakeEnemyCount > 0
              ? `${status.awakeEnemyCount} awake ${status.awakeEnemyCount === 1 ? 'enemy' : 'enemies'} can attack on mismatches.`
              : exit.lockedReason
                ? exit.lockedReason
                : hiddenCount > 0
                  ? `${hiddenCount} hidden dungeon ${hiddenCount === 1 ? 'card' : 'cards'} remain.`
                  : null;
    const combatForecastText = getDungeonCombatForecastText(run, status);

    return {
        visible: true,
        title: 'Dungeon',
        objectiveText: status.objectiveId
            ? `${status.objectiveLabel} ${status.objectiveProgress}/${status.objectiveRequired}${
                  status.objectiveCompleted ? ' complete' : ''
              }`
            : null,
        objectiveDetail: objective.detail,
        objectiveProgress: status.objectiveProgress,
        objectiveRequired: status.objectiveRequired,
        objectiveLabel: status.objectiveLabel,
        exitText: activeExitText,
        keyText,
        bossText,
        alertText,
        combatForecastText,
        chips: orderDungeonHudChips(chips)
    };
};
