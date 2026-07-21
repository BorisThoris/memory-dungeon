import {
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_MATCH_SAFE_HAZARD_WARDS,
    FINDABLE_MATCH_SCORE,
    type FindableKind,
    type RouteCardKind,
    type RouteSpecialKind,
    type RunState,
    type Tile
} from './contracts';
import type { BoardState } from './contracts';
import { clearDungeonCardFields } from './dungeon-enemy-card-rules';
import { getDungeonMatchReward, type DungeonMatchReward } from './dungeon-match-reward-rules';
import { getRouteCardReward, type RouteCardReward } from './route-card-reward-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { hiddenUnlessSprungTrap } from './tile-state-rules';
import { isWildPairKey } from './tile-identity';

const nonNegativeMatchClaimCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const matchClaimTileIds = (value: unknown): string[] => Array.isArray(value) ? value : [];

export interface MatchClaimContext {
    anchorSealClaimed: boolean;
    catalystAltarUpgraded: boolean;
    claimedFindableKind: FindableKind | null;
    claimedRouteCardKind: RouteSpecialKind | RouteCardKind | null;
    claimedRouteSpecialRevealed: boolean;
    dungeonReward: DungeonMatchReward;
    dungeonTrapResolvedDelta: number;
    findableComboShardGain: number;
    findableSafeHazardWardGain: number;
    findableScoreBonus: number;
    findablesClaimedDelta: number;
    loadedGatewayClaimed: boolean;
    matchedDungeonKeyKind: NonNullable<Tile['dungeonKeyKind']>;
    matchedDungeonKind: Tile['dungeonCardKind'] | null;
    matchedPairKey: string;
    mimicCacheBite: boolean;
    mimicCacheClaimed: boolean;
    mimicCacheFatalBite: boolean;
    mimicCacheGuardBite: boolean;
    parasiteVesselConverted: boolean;
    pinLatticeRewarded: boolean;
    routeCardReward: RouteCardReward;
    usedWild: boolean;
}

export const deriveMatchClaimContext = ({
    firstTile,
    firstTileId,
    run,
    secondTile,
    secondTileId
}: {
    firstTile: Tile;
    firstTileId: string;
    run: RunState;
    secondTile: Tile;
    secondTileId: string;
}): MatchClaimContext => {
    const claimedFindableKind = firstTile.findableKind ?? secondTile.findableKind ?? null;
    const claimedRouteCardKind =
        firstTile.routeSpecialKind ??
        secondTile.routeSpecialKind ??
        firstTile.routeCardKind ??
        secondTile.routeCardKind ??
        null;
    const matchedPairKey = isWildPairKey(firstTile.pairKey) ? secondTile.pairKey : firstTile.pairKey;
    const claimedRouteSpecialRevealed = firstTile.routeSpecialRevealed === true || secondTile.routeSpecialRevealed === true;
    const routeCardReward = getRouteCardReward(
        run,
        run.board?.level ?? 0,
        matchedPairKey,
        claimedRouteCardKind,
        claimedRouteSpecialRevealed
    );
    const stats = normalizeSessionStats(run.stats);
    const mimicCacheClaimed = claimedRouteCardKind === 'mimic_cache';
    const mimicCacheBite = mimicCacheClaimed && !claimedRouteSpecialRevealed;
    const mimicCacheGuardBite = mimicCacheBite && stats.guardTokens > 0;
    const matchedDungeonKind = firstTile.dungeonCardKind ?? secondTile.dungeonCardKind ?? null;
    const dungeonReward = getDungeonMatchReward(run, firstTile, secondTile);

    return {
        anchorSealClaimed: claimedRouteCardKind === 'anchor_seal',
        catalystAltarUpgraded: claimedRouteCardKind === 'catalyst_altar' && stats.comboShards > 0,
        claimedFindableKind,
        claimedRouteCardKind,
        claimedRouteSpecialRevealed,
        dungeonReward,
        dungeonTrapResolvedDelta:
            matchedDungeonKind === 'trap' &&
            firstTile.dungeonCardState !== 'resolved' &&
            secondTile.dungeonCardState !== 'resolved'
                ? 1
                : 0,
        findableComboShardGain: claimedFindableKind != null ? FINDABLE_MATCH_COMBO_SHARDS[claimedFindableKind] : 0,
        findableSafeHazardWardGain:
            claimedFindableKind != null ? FINDABLE_MATCH_SAFE_HAZARD_WARDS[claimedFindableKind] : 0,
        findableScoreBonus: claimedFindableKind != null ? FINDABLE_MATCH_SCORE[claimedFindableKind] : 0,
        findablesClaimedDelta: claimedFindableKind != null ? 1 : 0,
        loadedGatewayClaimed: claimedRouteCardKind === 'loaded_gateway',
        matchedDungeonKeyKind: firstTile.dungeonKeyKind ?? secondTile.dungeonKeyKind ?? 'iron',
        matchedDungeonKind,
        matchedPairKey,
        mimicCacheBite,
        mimicCacheClaimed,
        mimicCacheFatalBite: mimicCacheBite && !mimicCacheGuardBite && run.lives <= 1,
        mimicCacheGuardBite,
        parasiteVesselConverted: claimedRouteCardKind === 'parasite_vessel' && run.parasiteFloors > 0,
        pinLatticeRewarded:
            claimedRouteCardKind === 'pin_lattice' &&
            run.pinLatticeRewardsThisFloor < 1 &&
            matchClaimTileIds(run.pinnedTileIds).includes(firstTileId) &&
            matchClaimTileIds(run.pinnedTileIds).includes(secondTileId),
        routeCardReward,
        usedWild: isWildPairKey(firstTile.pairKey) || isWildPairKey(secondTile.pairKey)
    };
};

export const createMatchedPairClaimBoard = ({
    board,
    context,
    firstTileId,
    secondTileId,
    thirdTileId
}: {
    board: BoardState;
    context: MatchClaimContext;
    firstTileId: string;
    secondTileId: string;
    thirdTileId?: string;
}): BoardState => {
    const nextKeysHeld = Math.max(0, nonNegativeMatchClaimCount(board.dungeonKeysHeld) + context.dungeonReward.keysHeldDelta);
    const nextKeysHeldByKind = (() => {
        if (context.dungeonReward.keysHeldDelta === 0) {
            return board.dungeonKeysHeldByKind;
        }
        const current = nonNegativeMatchClaimCount(board.dungeonKeysHeldByKind?.[context.matchedDungeonKeyKind]);
        const next = Math.max(0, current + context.dungeonReward.keysHeldDelta);
        return {
            ...(board.dungeonKeysHeldByKind ?? {}),
            [context.matchedDungeonKeyKind]: next
        };
    })();
    return {
        ...board,
        flippedTileIds: [],
        matchedPairs: nonNegativeMatchClaimCount(board.matchedPairs) + 1,
        tiles: board.tiles.map((tile) => {
            if (tile.id === firstTileId || tile.id === secondTileId) {
                return clearDungeonCardFields({
                    ...tile,
                    state: 'matched' as const,
                    findableKind: undefined,
                    routeCardKind: undefined,
                    routeSpecialKind: undefined,
                    routeSpecialRevealed: undefined,
                    routeSpecialRevealSource: undefined,
                    lanternScouted: undefined,
                    scoutRevealSource: undefined
                });
            }
            if (thirdTileId != null && tile.id === thirdTileId) {
                return hiddenUnlessSprungTrap(tile);
            }
            return tile;
        }),
        selectedGatewayRouteType: board.selectedGatewayRouteType ?? context.dungeonReward.gatewayRouteType ?? null,
        dungeonKeysHeld: nextKeysHeld,
        dungeonKeysHeldByKind: nextKeysHeldByKind,
        dungeonLeverCount: nonNegativeMatchClaimCount(board.dungeonLeverCount) + (context.matchedDungeonKind === 'lever' ? 1 : 0)
    };
};
