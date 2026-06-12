import { type BoardState, type RunState, type RunStatus, type Tile } from './contracts';
import { applyDungeonEnemyAttack } from './dungeon-enemy-card-rules';
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
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { hiddenUnlessSprungTrap } from './tile-state-rules';

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
    const tries = run.stats.tries + triesDelta;
    const hasGraceMismatch = hasFirstMismatchGrace(run, board);
    const consumesGuardToken = !hasGraceMismatch && run.stats.guardTokens > 0;
    const lostLife = !hasGraceMismatch && !consumesGuardToken;
    const contractFail = run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    const lives = contractFail ? 0 : lostLife ? run.lives - 1 : run.lives;
    const status: RunStatus = lives <= 0 || contractFail ? 'gameOver' : 'playing';
    const guardTokens = consumesGuardToken ? run.stats.guardTokens - 1 : run.stats.guardTokens;

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
    const penalty = calculateMismatchPenalty(run, board, triesDelta);
    let lives = penalty.lives;
    const hiddenBoard = createHiddenMismatchBoard(board, tileIds);
    let pendingMemorizeBonusMs = penalty.pendingMemorizeBonusMs;

    const trapSpring = springArmedDungeonTraps(
        { ...run, lives: Math.max(lives, 0), stats: { ...run.stats, guardTokens: penalty.guardTokens } },
        hiddenBoard,
        sourceTiles
            .filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed')
            .map((tile) => tile.pairKey)
    );
    lives = trapSpring.run.lives;
    const livesBeforeEnemyAttack = lives;
    const enemyAttack = applyDungeonEnemyAttack(
        lives,
        trapSpring.run.stats.guardTokens,
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
    const spunMiss = rotateRunShiftingSpotlight(run, wardedHazards.board);

    return {
        ...run,
        status: statusAfterEnemy,
        lives: Math.max(lives, 0),
        shopGold: trapSpring.run.shopGold,
        freeShuffleThisFloor: trapSpring.run.freeShuffleThisFloor,
        regionShuffleFreeThisFloor: trapSpring.run.regionShuffleFreeThisFloor,
        dungeonTrapsTriggered: trapSpring.run.dungeonTrapsTriggered,
        board: spunMiss.board,
        shiftingSpotlightNonce: spunMiss.shiftingSpotlightNonce,
        pinnedTileIds: snareHazard.triggered ? [] : run.pinnedTileIds,
        hazardTileTriggersThisFloor:
            run.hazardTileTriggersThisFloor +
            (snareHazard.triggered ? 1 : 0) +
            (mirrorTriggered ? 1 : 0) +
            fragileBreak.brokenCount,
        hazardShuffleSnaresThisFloor: run.hazardShuffleSnaresThisFloor + (snareHazard.triggered ? 1 : 0),
        hazardMirrorDecoysThisFloor: run.hazardMirrorDecoysThisFloor + (mirrorTriggered ? 1 : 0),
        hazardFragileCacheBreaksThisFloor: run.hazardFragileCacheBreaksThisFloor + fragileBreak.brokenCount,
        safeHazardWardChargesThisFloor:
            (run.safeHazardWardChargesThisFloor ?? 0) - (wardedHazards.wardUsed ? 1 : 0),
        safeHazardWardsUsedThisFloor:
            (run.safeHazardWardsUsedThisFloor ?? 0) + (wardedHazards.wardUsed ? 1 : 0),
        pendingMemorizeBonusMs,
        stickyBlockIndex: null,
        recallFocus: decreaseRecallFocus(run),
        recallMistakesThisFloor: run.recallMistakesThisFloor + 1,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, tileIds),
        decoyFlippedThisFloor: run.decoyFlippedThisFloor || decoyTouched,
        stats: {
            ...trapSpring.run.stats,
            tries: penalty.tries,
            mismatches: trapSpring.run.stats.mismatches + 1,
            currentStreak: Math.floor(run.stats.currentStreak / 2),
            rating: calculateRating(penalty.tries),
            highestLevel: Math.max(run.stats.highestLevel, advancedTrapBoard.level),
            guardTokens: enemyAttack.guardTokens
        },
        timerState: clearResolveState(run)
    };
};
