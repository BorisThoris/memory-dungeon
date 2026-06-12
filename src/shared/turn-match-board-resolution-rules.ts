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

export interface TurnMatchBoardResolutionResult {
    board: BoardState;
    findableScout: ReturnType<typeof applyFindableScoutGlint>;
    cascadeHazard: ReturnType<typeof applyCascadeCacheHazard>;
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
}

export const resolveTurnMatchBoardResolution = ({
    run,
    board,
    context,
    firstTile,
    secondTile,
    firstTileId,
    secondTileId,
    thirdTileId
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
    const findableScout = applyFindableScoutGlint(dungeonEffectBoard, run, context.claimedFindableKind);
    const matchedHazards = hazardKindsInTiles(board.tiles, [firstTileId, secondTileId]);
    const cascadeHazard = matchedHazards.has('cascade_cache')
        ? applyCascadeCacheHazard(findableScout.board, run, context.matchedPairKey)
        : { board: findableScout.board, triggered: false };
    const fragileCacheClaimed = matchedHazards.has('fragile_cache');
    const tollCacheClaimed = matchedHazards.has('toll_cache');
    const fuseCacheClaimed = matchedHazards.has('fuse_cache');
    const fuseCacheFresh = fuseCacheClaimed && run.matchResolutionsThisFloor < FUSE_CACHE_FRESH_RESOLUTION_LIMIT;
    const enemyDamage = damageFirstActiveDungeonEnemy(cascadeHazard.board, 1);
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
