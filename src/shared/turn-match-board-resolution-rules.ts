import {
    FUSE_CACHE_FRESH_RESOLUTION_LIMIT,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import { damageFirstActiveDungeonEnemy } from './dungeon-enemy-card-rules';
import {
    advanceEnemyHazardsOnBoard,
    damageFirstRevealedEnemyHazard,
    defeatEnemyHazardsBlockingLastPair
} from './dungeon-enemy-hazard-rules';
import {
    applyFindableScoutGlint,
    applyLanternWardScout,
    applyOmenSealScout
} from './dungeon-scout-rules';
import { resolveOneArmedTrapPair } from './dungeon-trap-rules';
import {
    applyCascadeCacheHazard,
    hazardKindsInTiles
} from './hazard-tile-effect-rules';
import { createMatchedPairClaimBoard, type MatchClaimContext } from './match-claim-rules';
import { chainMomentum } from './chain-tier-rules';
import { resolveChunkBreak, type ChunkBreakResult } from './chunk-break-rules';
import { normalizeSessionStats } from './session-stats-rules';

export interface TurnMatchBoardResolutionResult {
    board: BoardState;
    findableScout: ReturnType<typeof applyFindableScoutGlint>;
    cascadeHazard: ReturnType<typeof applyCascadeCacheHazard>;
    chunkBreak: ChunkBreakResult;
    fragileCacheClaimed: boolean;
    tollCacheClaimed: boolean;
    fuseCacheClaimed: boolean;
    fuseCacheFresh: boolean;
    enemyDamage: ReturnType<typeof damageFirstActiveDungeonEnemy>;
    hazardDamage: ReturnType<typeof damageFirstRevealedEnemyHazard>;
    lastPairHazardClear: ReturnType<typeof defeatEnemyHazardsBlockingLastPair>;
    lanternScout: ReturnType<typeof applyLanternWardScout>;
    omenScout: ReturnType<typeof applyOmenSealScout>;
}

export interface TurnMatchBoardResolutionInput {
    run: RunState;
    board: BoardState;
    context: MatchClaimContext;
    firstTile: Tile;
    secondTile: Tile;
    firstTileId: string;
    secondTileId: string;
    thirdTileId?: string;
    findableScoutGain?: number;
}

export const resolveTurnMatchBoardResolution = ({
    run,
    board,
    context,
    firstTile,
    secondTile,
    firstTileId,
    secondTileId,
    thirdTileId,
    findableScoutGain
}: TurnMatchBoardResolutionInput): TurnMatchBoardResolutionResult => {
    const boardBeforeEnemyDamage = createMatchedPairClaimBoard({
        board,
        context,
        firstTileId,
        secondTileId,
        thirdTileId
    });
    const dungeonEffectBoard =
        context.matchedDungeonKind === 'lever' &&
        (firstTile.dungeonCardEffectId ?? secondTile.dungeonCardEffectId) === 'rune_seal'
            ? resolveOneArmedTrapPair(boardBeforeEnemyDamage)
            : boardBeforeEnemyDamage;
    const findableScout = applyFindableScoutGlint(
        dungeonEffectBoard,
        run,
        context.claimedFindableKind,
        findableScoutGain
    );
    const matchedHazards = hazardKindsInTiles(board.tiles, [firstTileId, secondTileId]);
    const cascadeHazard = matchedHazards.has('cascade_cache')
        ? applyCascadeCacheHazard(findableScout.board, run, context.matchedPairKey)
        : { board: findableScout.board, triggered: false };
    const fragileCacheClaimed = matchedHazards.has('fragile_cache');
    const tollCacheClaimed = matchedHazards.has('toll_cache');
    const fuseCacheClaimed = matchedHazards.has('fuse_cache');
    const fuseCacheFresh = fuseCacheClaimed && run.matchResolutionsThisFloor < FUSE_CACHE_FRESH_RESOLUTION_LIMIT;
    /*
     * The chain this match completes is the chain that buys the break: the streak the run holds
     * plus this match. The break runs before enemy damage so that, once chunks hit enemies
     * (design §2.6), the damage step sees the board the chunk left behind.
     */
    const chunkBreak = resolveChunkBreak({
        board: cascadeHazard.board,
        run,
        matchedTileIds: [firstTileId, secondTileId],
        chain: chainMomentum(normalizeSessionStats(run.stats).currentStreak + 1, run.chunkPairsThisChain)
    });
    const enemyDamage = damageFirstActiveDungeonEnemy(chunkBreak.board, 1);
    const hazardDamage = damageFirstRevealedEnemyHazard(enemyDamage.board, 1);
    const advancedHazardBoard = advanceEnemyHazardsOnBoard(hazardDamage.board);
    const lastPairHazardClear = defeatEnemyHazardsBlockingLastPair(advancedHazardBoard);
    const boardAfterHazards = lastPairHazardClear.board;
    const lanternScout =
        context.claimedRouteCardKind === 'lantern_ward'
            ? applyLanternWardScout(boardAfterHazards, run)
            : { board: boardAfterHazards, scouted: false };
    const omenScout =
        context.claimedRouteCardKind === 'omen_seal'
            ? applyOmenSealScout(lanternScout.board, run)
            : { board: lanternScout.board, scouted: false };

    return {
        board: omenScout.board,
        findableScout,
        cascadeHazard,
        chunkBreak,
        fragileCacheClaimed,
        tollCacheClaimed,
        fuseCacheClaimed,
        fuseCacheFresh,
        enemyDamage,
        hazardDamage,
        lastPairHazardClear,
        lanternScout,
        omenScout
    };
};
