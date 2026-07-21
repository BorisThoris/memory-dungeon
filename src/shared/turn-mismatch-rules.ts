import { type BoardState, type RunState, type RunStatus, type Tile } from './contracts';
import { applyDungeonEnemyAttack } from './dungeon-enemy-card-rules';
import { getActiveDungeonBossPressureRule } from './dungeon-boss-rules';
import { advanceEnemyHazardsOnBoard } from './dungeon-enemy-hazard-rules';
import { springArmedDungeonTraps } from './dungeon-trap-rules';
import {
    applySafeHazardWardMismatch,
    hazardKindsInTiles
} from './hazard-tile-effect-rules';
import { hasFirstMismatchGrace } from './mismatch-grace-rules';
import {
    addPendingMemorizeBonusForLostLives,
    decreaseRecallFocus,
    rememberForgottenTiles
} from './recall-rules';
import {
    clearResolveState
} from './run-timer-rules';
import { calculateRating } from './scoring-rules';
import { addTileTraitCountStats, normalizeSessionStats } from './session-stats-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { hiddenUnlessSprungTrap } from './tile-state-rules';
import {
    applyVolatileMismatchTrait,
    calculateTileTraitMismatchPenalty
} from './tile-trait-rules';

const nonNegativeMismatchCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export interface MismatchPenalty {
    consumesGuardToken: boolean;
    contractFail: boolean;
    guardTokens: number;
    hasGraceMismatch: boolean;
    lives: number;
    lostLife: boolean;
    pendingMemorizeBonusMs: number;
    status: RunStatus;
    tries: number;
}

export const createHiddenMismatchBoard = (
    board: BoardState,
    tileIds: readonly string[]
): BoardState => {
    const hiddenTileIds = new Set(tileIds);
    return {
        ...board,
        flippedTileIds: [],
        tiles: board.tiles.map((tile) => hiddenTileIds.has(tile.id) ? hiddenUnlessSprungTrap(tile) : tile)
    };
};

export const calculateMismatchPenalty = (
    run: RunState,
    board: BoardState,
    triesDelta: number
): MismatchPenalty => {
    const stats = normalizeSessionStats(run.stats);
    const safeTries = nonNegativeMismatchCount(stats.tries);
    const safeTriesDelta = nonNegativeMismatchCount(triesDelta);
    const safeGuardTokens = nonNegativeMismatchCount(stats.guardTokens);
    const safeLives = nonNegativeMismatchCount(run.lives);
    const tries = safeTries + safeTriesDelta;
    const hasGraceMismatch = hasFirstMismatchGrace(
        { ...run, lives: safeLives, stats: { ...stats, guardTokens: safeGuardTokens, tries: safeTries } },
        board
    );
    const consumesGuardToken = !hasGraceMismatch && safeGuardTokens > 0;
    const lostLife = !hasGraceMismatch && !consumesGuardToken;
    const contractFail = run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    const lives = contractFail ? 0 : lostLife ? safeLives - 1 : safeLives;
    const status: RunStatus = lives <= 0 || contractFail ? 'gameOver' : 'playing';
    const guardTokens = consumesGuardToken ? Math.max(0, safeGuardTokens - 1) : safeGuardTokens;

    return {
        consumesGuardToken,
        contractFail,
        guardTokens,
        hasGraceMismatch,
        lives,
        lostLife,
        pendingMemorizeBonusMs: addPendingMemorizeBonusForLostLives(run.pendingMemorizeBonusMs, lostLife ? 1 : 0),
        status,
        tries
    };
};

export interface MismatchTurnTransitionInput {
    run: RunState;
    board: BoardState;
    tileIds: readonly string[];
    sourceTiles: readonly Tile[];
    triesDelta: number;
    decoyTouched: boolean;
}

export const resolveMismatchTurnTransition = ({
    run,
    board,
    tileIds,
    sourceTiles,
    triesDelta,
    decoyTouched
}: MismatchTurnTransitionInput): RunState => {
    const stats = normalizeSessionStats(run.stats);
    const normalizedRun = { ...run, stats };
    const traitPenalty = calculateTileTraitMismatchPenalty(normalizedRun, sourceTiles, board);
    const bossPressure = board.floorTag === 'boss' ? getActiveDungeonBossPressureRule(board) : null;
    const penalty = calculateMismatchPenalty(
        normalizedRun,
        board,
        triesDelta + traitPenalty.triesDelta + (bossPressure?.mismatchTriesDelta ?? 0)
    );
    let lives = penalty.lives;
    const hiddenBoard = createHiddenMismatchBoard(board, tileIds);
    let pendingMemorizeBonusMs = penalty.pendingMemorizeBonusMs;

    const trapSpring = springArmedDungeonTraps(
        { ...run, lives: Math.max(lives, 0), stats: { ...stats, guardTokens: penalty.guardTokens, tries: penalty.tries } },
        hiddenBoard,
        sourceTiles
            .filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed')
            .map((tile) => tile.pairKey)
    );
    const trapStats = normalizeSessionStats(trapSpring.run.stats);
    lives = trapSpring.run.lives;
    const livesBeforeEnemyAttack = lives;
    const enemyAttack = applyDungeonEnemyAttack(
        lives,
        trapStats.guardTokens,
        trapSpring.alarmTriggered || trapSpring.enemyWoken ? hiddenBoard : trapSpring.board
    );
    lives = enemyAttack.lives;
    pendingMemorizeBonusMs = addPendingMemorizeBonusForLostLives(
        pendingMemorizeBonusMs,
        Math.max(0, livesBeforeEnemyAttack - Math.max(lives, 0))
    );
    const statusAfterEnemy: RunStatus =
        lives <= 0 || penalty.contractFail || trapSpring.run.status === 'gameOver' ? 'gameOver' : penalty.status;
    const advancedTrapBoard = advanceEnemyHazardsOnBoard(trapSpring.board);
    const mismatchHazards = hazardKindsInTiles(board.tiles, tileIds);
    const wardedHazards = applySafeHazardWardMismatch(run, advancedTrapBoard, sourceTiles, mismatchHazards);
    const { fragileBreak, snareHazard } = wardedHazards;
    const mirrorTriggered = mismatchHazards.has('mirror_decoy');
    const volatileTrait = traitPenalty.blocksVolatileShuffle
        ? { board: wardedHazards.board, triggered: false }
        : applyVolatileMismatchTrait(wardedHazards.board, run, sourceTiles);
    const spunMiss = rotateRunShiftingSpotlight(run, volatileTrait.board);

    return {
        ...run,
        status: statusAfterEnemy,
        lives: Math.max(lives, 0),
        shopGold: Math.max(0, trapSpring.run.shopGold),
        freeShuffleThisFloor: trapSpring.run.freeShuffleThisFloor,
        regionShuffleFreeThisFloor: trapSpring.run.regionShuffleFreeThisFloor,
        dungeonTrapsTriggered: trapSpring.run.dungeonTrapsTriggered,
        board: spunMiss.board,
        shiftingSpotlightNonce: spunMiss.shiftingSpotlightNonce,
        pinnedTileIds: snareHazard.triggered ? [] : run.pinnedTileIds,
        hazardTileTriggersThisFloor:
            nonNegativeMismatchCount(run.hazardTileTriggersThisFloor) +
            (snareHazard.triggered ? 1 : 0) +
            (mirrorTriggered ? 1 : 0) +
            nonNegativeMismatchCount(fragileBreak.brokenCount) +
            (volatileTrait.triggered ? 1 : 0),
        hazardShuffleSnaresThisFloor:
            nonNegativeMismatchCount(run.hazardShuffleSnaresThisFloor) + (snareHazard.triggered ? 1 : 0),
        hazardMirrorDecoysThisFloor:
            nonNegativeMismatchCount(run.hazardMirrorDecoysThisFloor) + (mirrorTriggered ? 1 : 0),
        hazardFragileCacheBreaksThisFloor:
            nonNegativeMismatchCount(run.hazardFragileCacheBreaksThisFloor) + nonNegativeMismatchCount(fragileBreak.brokenCount),
        safeHazardWardChargesThisFloor:
            Math.max(0, nonNegativeMismatchCount(run.safeHazardWardChargesThisFloor) - (wardedHazards.wardChargeSpent ? 1 : 0)),
        safeHazardWardsUsedThisFloor:
            nonNegativeMismatchCount(run.safeHazardWardsUsedThisFloor) + (wardedHazards.wardUsed ? 1 : 0),
        pendingMemorizeBonusMs,
        peekCharges: Math.max(0, nonNegativeMismatchCount(run.peekCharges) - nonNegativeMismatchCount(traitPenalty.peekChargeLoss)),
        stickyBlockIndex: null,
        recallFocus: decreaseRecallFocus(run),
        recallMistakesThisFloor:
            nonNegativeMismatchCount(run.recallMistakesThisFloor) + 1 + nonNegativeMismatchCount(traitPenalty.recallMistakesDelta),
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, tileIds),
        decoyFlippedThisFloor: run.decoyFlippedThisFloor || decoyTouched,
        stats: {
            ...trapStats,
            tries: penalty.tries,
            mismatches: nonNegativeMismatchCount(trapStats.mismatches) + 1,
            currentStreak: Math.floor(nonNegativeMismatchCount(stats.currentStreak) / 2),
            rating: calculateRating(penalty.tries),
            highestLevel: Math.max(nonNegativeMismatchCount(stats.highestLevel), nonNegativeMismatchCount(advancedTrapBoard.level)),
            guardTokens: nonNegativeMismatchCount(enemyAttack.guardTokens),
            tileTraitMismatches: addTileTraitCountStats(trapStats.tileTraitMismatches, sourceTiles),
            volatileTraitShuffles:
                nonNegativeMismatchCount(trapStats.volatileTraitShuffles) + (volatileTrait.triggered ? 1 : 0)
        },
        timerState: clearResolveState(run)
    };
};
