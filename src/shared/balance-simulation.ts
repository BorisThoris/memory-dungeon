import {
    FINDABLE_KIND_SPAWN_WEIGHTS,
    GAME_RULES_VERSION,
    INITIAL_LIVES,
    MAX_LIVES,
    type DungeonRunNodeKind,
    type FindableKind,
    type MutatorId,
    type RouteNodeType,
    type TileTraitKind,
    type Tile
} from './contracts';
import { buildBoard, countFindablePairs } from './board-generation';
import { countReachableExitKeySources, getEffectivePrimaryExitLock, inspectBoardFairness } from './board-inspection';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { getShopGoldRewardForFloor, SHOP_ITEM_CATALOG } from './shop-rules';
import { pickFloorScheduleEntry, usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { RELIC_DRAFT, RELIC_POOL, type RelicDraftRarity } from './relics';
import {
    countTraitComboOpportunityPairs,
    countTraitInteractionLines,
    hasTraitBoardPowerInteractionOpportunity,
    hasTraitRewardInteractionFloor,
    hasTraitSwapSetupOpportunity
} from './tile-trait-rules';

export interface BalanceSimulationInput {
    seeds?: readonly number[];
    seed?: number;
    floors: number;
    rulesVersion?: number;
}

export interface BalanceSimulationRow {
    key: string;
    label: string;
    value: number;
    targetMin: number;
    targetMax: number;
    status: 'within_range' | 'below_range' | 'above_range';
    source: string;
}

export interface BalanceSimulationReport {
    rulesVersion: number;
    seeds: number[];
    floors: number;
    offlineOnly: true;
    samples: Array<{
        seed: number;
        floor: number;
        shopGoldEarned: number;
        findablePickupPairs: number;
        findableKindCounts: Record<FindableKind, number>;
        tileTraitPairs: number;
        traitComboOpportunityPairs: number;
        traitMatchRouteFloors: number;
        traitSwapSetupOpportunities: number;
        traitInteractionLines: number;
        traitRewardPickupFloors: number;
        traitBoardPowerInteractionOpportunities: number;
        deadTraitFloors: number;
        tileTraitKindCounts: Record<TileTraitKind, number>;
        floorTag: string;
        dungeonNodeKind: DungeonRunNodeKind;
        shopSinkBudget: number;
        enemyThreatPairs: number;
        movingEnemyHazards: number;
        bossMovingEnemyHazards: number;
        hazardTileCount: number;
        contactRisk: number;
        floorBand: 'early' | 'mid' | 'late';
        relicFavorPotential: number;
        comboShardPotential: number;
        guardRewardPotential: number;
        relicOfferAvailable: number;
        consumableRewardPotential: number;
        treasureRewardPairs: number;
        routeRewardPairs: number;
        eventRewardPotential: number;
        roomRewardPotential: number;
        keyInflowPotential: number;
        boardFairnessIssueCount: number;
        shopGoldInflowPotential: number;
        destroyChargeInflowPotential: number;
        peekChargeInflowPotential: number;
        recoveryReliefPotential: number;
        netPressureAfterRelief: number;
    }>;
    aggregate: {
        totalShopGoldEarned: number;
        findablePickupPairs: number;
        findableKindCounts: Record<FindableKind, number>;
        tileTraitPairs: number;
        traitComboOpportunityPairs: number;
        traitMatchRouteFloors: number;
        traitSwapSetupOpportunities: number;
        traitInteractionLines: number;
        traitRewardPickupFloors: number;
        traitBoardPowerInteractionOpportunities: number;
        deadTraitFloors: number;
        deadTraitFloorsByBand: Record<'early' | 'mid' | 'late', number>;
        tileTraitKindCounts: Record<TileTraitKind, number>;
        bossFloors: number;
        breatherFloors: number;
        eliteFloors: number;
        enemyThreatPairs: number;
        movingEnemyHazards: number;
        bossMovingEnemyHazards: number;
        hazardTileCount: number;
        contactRisk: number;
        shopSinkBudget: number;
        relicFavorPotential: number;
        comboShardPotential: number;
        guardRewardPotential: number;
        relicOfferAvailable: number;
        consumableRewardPotential: number;
        treasureRewardPairs: number;
        routeRewardPairs: number;
        eventRewardPotential: number;
        roomRewardPotential: number;
        keyInflowPotential: number;
        boardFairnessIssueCount: number;
        shopGoldInflowPotential: number;
        destroyChargeInflowPotential: number;
        peekChargeInflowPotential: number;
        recoveryReliefPotential: number;
        netPressureAfterRelief: number;
        highPressureLowRecoveryFloors: number;
    };
    rows: BalanceSimulationRow[];
    notes: string[];
}

export type DungeonBalanceProfileId = 'cautious' | 'average' | 'greedy' | 'high_skill';

export interface DungeonBalanceProfileDefinition {
    id: DungeonBalanceProfileId;
    riskTolerance: number;
    rewardBias: number;
    guardEfficiency: number;
    shopVisitBias: number;
}

export interface DungeonBalanceProfileMetrics {
    profile: DungeonBalanceProfileId;
    seedOutcomes: Array<{
        seed: number;
        floorsCleared: number;
        livesLost: number;
        runFalls: number;
        minLivesRemaining: number;
        lowLifeFloors: number;
        unhealedLowLifeFloors: number;
        endingShopGold: number;
        bossWins: number;
        bossAttempts: number;
    }>;
    floorsCleared: number;
    livesLost: number;
    guardUsed: number;
    healingPurchased: number;
    healingPurchaseShare: number;
    minLivesRemaining: number;
    runFalls: number;
    maxAtRiskStreak: number;
    lowLifeFloors: number;
    lowLifeFloorShare: number;
    maxLowLifeStreak: number;
    unhealedLowLifeFloors: number;
    unhealedLowLifeFloorShare: number;
    maxUnhealedLowLifeStreak: number;
    recoveryDebtFloors: number;
    maxRecoveryDebtStreak: number;
    routeChoiceCounts: Record<RouteNodeType, number>;
    dominantRouteShare: number;
    safeRouteTollSpend: number;
    greedLifeCosts: number;
    shopServiceSpend: number;
    shopGoldEarned: number;
    endingShopGold: number;
    maxShopGoldHeld: number;
    worstSeedFloorsClearedShare: number;
    worstSeedLowLifeFloorShare: number;
    worstSeedUnhealedLowLifeFloorShare: number;
    worstSeedRunFalls: number;
    maxSeedEndingShopGold: number;
    seedFloorClearShareSpread: number;
    rewardClaims: number;
    bossWins: number;
    bossAttempts: number;
    shopsVisited: number;
    firstRiskSample: { floor: number; seed: number } | null;
}

export interface DungeonBalanceProfileReport {
    base: BalanceSimulationReport;
    profiles: DungeonBalanceProfileMetrics[];
    bounds: {
        minFloorsClearedShare: number;
        maxLivesLostPerFloor: number;
        minBossWinShare: number;
        maxShopGoldPerFloor: number;
        minLivesRemaining: number;
        maxRunFalls: number;
        maxHealingPurchaseShare: number;
        maxAtRiskStreak: number;
        maxLowLifeFloorShare: number;
        maxLowLifeStreak: number;
        maxUnhealedLowLifeFloorShare: number;
        maxUnhealedLowLifeStreak: number;
        maxRecoveryDebtStreak: number;
        maxDominantRouteShare: number;
        maxEndingShopGoldPerFloor: number;
        maxShopGoldHeldPerFloor: number;
        minWorstSeedFloorsClearedShare: number;
        maxWorstSeedLowLifeFloorShare: number;
        maxWorstSeedUnhealedLowLifeFloorShare: number;
        maxWorstSeedRunFalls: number;
        maxSeedEndingShopGoldPerFloor: number;
        maxSeedFloorClearShareSpread: number;
    };
    notes: string[];
}

export const DUNGEON_BALANCE_PROFILES: readonly DungeonBalanceProfileDefinition[] = [
    { id: 'cautious', riskTolerance: 0.72, rewardBias: 0.82, guardEfficiency: 0.88, shopVisitBias: 0.92 },
    { id: 'average', riskTolerance: 0.58, rewardBias: 1, guardEfficiency: 0.72, shopVisitBias: 1 },
    { id: 'greedy', riskTolerance: 0.42, rewardBias: 1.24, guardEfficiency: 0.52, shopVisitBias: 1.16 },
    { id: 'high_skill', riskTolerance: 0.84, rewardBias: 1.08, guardEfficiency: 0.95, shopVisitBias: 1.06 }
] as const;

const statusFor = (value: number, targetMin: number, targetMax: number): BalanceSimulationRow['status'] =>
    value < targetMin ? 'below_range' : value > targetMax ? 'above_range' : 'within_range';

const row = (
    key: string,
    label: string,
    value: number,
    targetMin: number,
    targetMax: number,
    source: string
): BalanceSimulationRow => ({
    key,
    label,
    value,
    targetMin,
    targetMax,
    status: statusFor(value, targetMin, targetMax),
    source
});

const scheduleMutatorsFor = (seed: number, rulesVersion: number, level: number): MutatorId[] => {
    if (!usesEndlessFloorSchedule('endless', rulesVersion)) {
        return [];
    }
    return pickFloorScheduleEntry(seed, rulesVersion, level, 'endless').mutators;
};

const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

// Typed lock keys are alternatives to the same shop insurance slot, not extra services sold every visit.
const ALTERNATE_LOCK_KEY_SHOP_ITEMS = new Set(['treasure_key', 'shrine_key', 'boss_key', 'trap_key']);

const relicRarityShare = (rarity: RelicDraftRarity): number => {
    const total = RELIC_POOL.reduce((sum, id) => sum + RELIC_DRAFT[id].weight, 0);
    const rarityTotal = RELIC_POOL
        .filter((id) => RELIC_DRAFT[id].rarity === rarity)
        .reduce((sum, id) => sum + RELIC_DRAFT[id].weight, 0);
    return total === 0 ? 0 : rarityTotal / total;
};

const simulationNodeKindForFloor = (floor: number, floorTag: string): DungeonRunNodeKind => {
    if (floorTag === 'boss') return 'boss';
    if (floorTag === 'breather') return floor % 3 === 0 ? 'shop' : 'rest';
    if (floor % 5 === 0) return 'trap';
    if (floor % 2 === 0) return 'elite';
    return 'combat';
};

const floorBandFor = (floor: number): 'early' | 'mid' | 'late' =>
    floor <= 4 ? 'early' : floor <= 8 ? 'mid' : 'late';

const uniquePairCount = <T>(items: readonly T[], keyFor: (item: T) => string | null): number =>
    new Set(items.map(keyFor).filter((key): key is string => key != null)).size;

const emptyFindableKindCounts = (): Record<FindableKind, number> => ({
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 0
});

const TILE_TRAIT_KINDS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

const emptyTileTraitKindCounts = (): Record<TileTraitKind, number> => ({
    echo: 0,
    volatile: 0,
    mirror: 0,
    cursed: 0,
    sealed: 0,
    heavy: 0,
    drift: 0,
    conduit: 0,
    stasis: 0
});

const countFindableKinds = (tiles: readonly Tile[]): Record<FindableKind, number> => {
    const counts = emptyFindableKindCounts();
    const seenPairs = new Set<string>();
    for (const tile of tiles) {
        if (!tile.findableKind || seenPairs.has(tile.pairKey)) {
            continue;
        }
        seenPairs.add(tile.pairKey);
        counts[tile.findableKind] += 1;
    }
    return counts;
};

const countTileTraitKinds = (tiles: readonly Tile[]): Record<TileTraitKind, number> => {
    const counts = emptyTileTraitKindCounts();
    const seenPairs = new Set<string>();
    for (const tile of tiles) {
        if (!tile.tileTraitKind || seenPairs.has(tile.pairKey)) {
            continue;
        }
        seenPairs.add(tile.pairKey);
        counts[tile.tileTraitKind] += 1;
    }
    return counts;
};

const sumFindableKindCounts = (
    counts: readonly Record<FindableKind, number>[]
): Record<FindableKind, number> =>
    counts.reduce((totals, sampleCounts) => {
        for (const kind of Object.keys(totals) as FindableKind[]) {
            totals[kind] += sampleCounts[kind];
        }
        return totals;
    }, emptyFindableKindCounts());

const sumTileTraitKindCounts = (
    counts: readonly Record<TileTraitKind, number>[]
): Record<TileTraitKind, number> =>
    counts.reduce((totals, sampleCounts) => {
        for (const kind of TILE_TRAIT_KINDS) {
            totals[kind] += sampleCounts[kind];
        }
        return totals;
    }, emptyTileTraitKindCounts());

export const getFindableKindShares = (
    counts: Record<FindableKind, number>
): Record<FindableKind, number> => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return (Object.keys(counts) as FindableKind[]).reduce<Record<FindableKind, number>>(
        (shares, kind) => ({
            ...shares,
            [kind]: total === 0 ? 0 : counts[kind] / total
        }),
        emptyFindableKindCounts()
    );
};

export const getTileTraitKindShares = (
    counts: Record<TileTraitKind, number>
): Record<TileTraitKind, number> => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return TILE_TRAIT_KINDS.reduce<Record<TileTraitKind, number>>(
        (shares, kind) => ({
            ...shares,
            [kind]: total === 0 ? 0 : counts[kind] / total
        }),
        emptyTileTraitKindCounts()
    );
};

const samplePressure = (sample: BalanceSimulationReport['samples'][number]): number =>
    sample.contactRisk + sample.enemyThreatPairs * 0.25 + sample.bossMovingEnemyHazards * 0.9;

const sampleRecoveryReliefPotential = (sample: {
    guardRewardPotential: number;
    roomRewardPotential: number;
    dungeonNodeKind: DungeonRunNodeKind;
    shopSinkBudget: number;
    keyInflowPotential: number;
}): number =>
    sample.guardRewardPotential +
    sample.roomRewardPotential +
    (sample.dungeonNodeKind === 'shop' ? 1 : 0) +
    (sample.shopSinkBudget > 0 ? 0.5 : 0) +
    (sample.keyInflowPotential > 0 ? 0.5 : 0);

const longestStreak = <T>(items: readonly T[], predicate: (item: T) => boolean): number => {
    let current = 0;
    let longest = 0;
    for (const item of items) {
        current = predicate(item) ? current + 1 : 0;
        longest = Math.max(longest, current);
    }
    return longest;
};

const healingBuyThresholdForProfile = (profile: DungeonBalanceProfileId): number => {
    switch (profile) {
        case 'cautious':
            return MAX_LIVES;
        case 'greedy':
            return 3;
        case 'high_skill':
            return 3;
        case 'average':
        default:
            return 3;
    }
};

const shopServiceSpendShareForProfile = (profile: DungeonBalanceProfileId): number => {
    switch (profile) {
        case 'cautious':
            return 0.6;
        case 'greedy':
            return 0.9;
        case 'high_skill':
            return 0.7;
        case 'average':
        default:
            return 0.75;
    }
};

const emptyRouteChoiceCounts = (): Record<RouteNodeType, number> => ({ safe: 0, greed: 0, mystery: 0 });

const chooseProfileRoute = (
    profile: DungeonBalanceProfileId,
    lives: number,
    sample: BalanceSimulationReport['samples'][number]
): RouteNodeType => {
    const pressure = samplePressure(sample);
    if (profile === 'cautious') {
        if (lives < MAX_LIVES || pressure >= 3.2) return 'safe';
        return sample.floor % 2 === 0 ? 'mystery' : 'safe';
    }
    if (profile === 'greedy') {
        if (lives >= 3 && pressure <= 3.5) return 'greed';
        return lives <= 2 ? 'safe' : 'mystery';
    }
    if (profile === 'high_skill') {
        if (lives <= 2 || (pressure >= 3.1 && lives < MAX_LIVES)) return 'safe';
        if (sample.floor % 5 === 0 && lives >= 4) return 'greed';
        return sample.floor % 2 === 0 ? 'mystery' : 'safe';
    }
    if (lives <= 2 || pressure >= 3) return 'safe';
    return sample.floor % 4 === 0 ? 'greed' : 'mystery';
};

export const runBalanceSimulation = ({
    seeds,
    seed,
    floors,
    rulesVersion = GAME_RULES_VERSION
}: BalanceSimulationInput): BalanceSimulationReport => {
    const safeFloors = Math.max(1, Math.floor(floors));
    const safeSeeds = seeds && seeds.length > 0 ? [...seeds] : [seed ?? 0];
    const floorNumbers = Array.from({ length: safeFloors }, (_, index) => index + 1);
    const shopSinkPerVisit = Object.values(SHOP_ITEM_CATALOG)
        .filter((item) => !ALTERNATE_LOCK_KEY_SHOP_ITEMS.has(item.itemId))
        .reduce((sum, item) => sum + item.baseCost, 0);
    const samples = safeSeeds.flatMap((sampleSeed) =>
        floorNumbers.map((floor) => {
            const schedule = pickFloorScheduleEntry(sampleSeed, rulesVersion, floor, 'endless');
            const dungeonNodeKind = simulationNodeKindForFloor(floor, schedule.floorTag);
            const board = buildBoard(floor, {
                runSeed: sampleSeed,
                runRulesVersion: rulesVersion,
                floorTag: schedule.floorTag,
                floorArchetypeId: schedule.floorArchetypeId,
                dungeonNodeKind,
                gameMode: 'endless',
                activeMutators: scheduleMutatorsFor(sampleSeed, rulesVersion, floor)
            });
            const activeHazards = activeEnemyHazardsForBoard(board);
            const hazardTileCount = board.tiles.filter((tile) => tile.tileHazardKind != null).length;
            const enemyThreatPairs = new Set(
                board.tiles
                    .filter((tile) => tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap')
                    .map((tile) => tile.pairKey)
            ).size;
            const treasureRewardPairs = uniquePairCount(
                board.tiles,
                (tile) => (tile.dungeonCardKind === 'treasure' || tile.dungeonCardKind === 'lock' ? tile.pairKey : null)
            );
            const keyPairs = uniquePairCount(board.tiles, (tile) => (tile.dungeonCardKind === 'key' ? tile.pairKey : null));
            const shrinePairs = uniquePairCount(
                board.tiles,
                (tile) => (tile.dungeonCardKind === 'shrine' ? tile.pairKey : null)
            );
            const routeRewardPairs = uniquePairCount(
                board.tiles,
                (tile) => (tile.routeCardKind || tile.routeSpecialKind ? tile.pairKey : null)
            );
            const roomEffectIds = board.tiles
                .map((tile) => tile.dungeonCardEffectId)
                .filter((id): id is NonNullable<typeof id> => id != null && id.startsWith('room_'));
            const eventRewardPotential = floor % 7 === 0 ? 2 : 0;
            const roomRewardPotential = roomEffectIds.length > 0 || dungeonNodeKind === 'rest' ? 1 : 0;
            const primaryExitLock = getEffectivePrimaryExitLock({ board });
            const boardFairnessIssueCount = inspectBoardFairness(board).issues.length;
            const lockedExitKeySourceCount =
                primaryExitLock.lockKind !== 'none' && primaryExitLock.lockKind !== 'lever'
                    ? countReachableExitKeySources(board, primaryExitLock.lockKind)
                    : 0;
            const keyInflowPotential = Math.max(
                keyPairs,
                lockedExitKeySourceCount
            );
            const findableKindCounts = countFindableKinds(board.tiles);
            const tileTraitKindCounts = countTileTraitKinds(board.tiles);
            const tileTraitPairs = Object.values(tileTraitKindCounts).reduce((sum, count) => sum + count, 0);
            const traitComboOpportunityPairs = countTraitComboOpportunityPairs(board);
            const traitMatchRouteFloors = traitComboOpportunityPairs > 0 ? 1 : 0;
            const traitSwapSetupOpportunities = hasTraitSwapSetupOpportunity(board) ? 1 : 0;
            const traitInteractionLines = countTraitInteractionLines(board);
            const traitRewardPickupFloors = hasTraitRewardInteractionFloor(board) ? 1 : 0;
            const traitBoardPowerInteractionOpportunities = hasTraitBoardPowerInteractionOpportunity(
                board,
                traitSwapSetupOpportunities > 0
            )
                ? 1
                : 0;
            const deadTraitFloors = tileTraitPairs > 0 && traitInteractionLines === 0 ? 1 : 0;
            const shopGoldInflowPotential =
                getShopGoldRewardForFloor(floor) +
                treasureRewardPairs +
                routeRewardPairs +
                (eventRewardPotential > 0 ? 2 : 0);
            const destroyChargeInflowPotential =
                roomEffectIds.includes('room_armory') || eventRewardPotential > 0 ? 1 : 0;
            const peekChargeInflowPotential =
                floor % 3 === 0 ? SHOP_ITEM_CATALOG.peek_charge.stock : roomEffectIds.includes('room_scrying_lens') ? 1 : 0;
            const recoveryReliefPotential = sampleRecoveryReliefPotential({
                guardRewardPotential: shrinePairs + (dungeonNodeKind === 'rest' ? 1 : 0),
                roomRewardPotential,
                dungeonNodeKind,
                shopSinkBudget: floor % 3 === 0 ? shopSinkPerVisit : 0,
                keyInflowPotential
            });
            const pressure =
                activeHazards.reduce((sum, hazard) => sum + hazard.damage, 0) +
                enemyThreatPairs * 0.25 +
                activeHazards.filter((hazard) => hazard.bossId != null).length * 0.9;
            return {
                seed: sampleSeed,
                floor,
                shopGoldEarned: getShopGoldRewardForFloor(floor),
                findablePickupPairs: countFindablePairs(board.tiles),
                findableKindCounts,
                tileTraitPairs,
                traitComboOpportunityPairs,
                traitMatchRouteFloors,
                traitSwapSetupOpportunities,
                traitInteractionLines,
                traitRewardPickupFloors,
                traitBoardPowerInteractionOpportunities,
                deadTraitFloors,
                tileTraitKindCounts,
                floorTag: schedule.floorTag,
                dungeonNodeKind,
                shopSinkBudget: floor % 3 === 0 ? shopSinkPerVisit : 0,
                enemyThreatPairs,
                movingEnemyHazards: activeHazards.length,
                bossMovingEnemyHazards: activeHazards.filter((hazard) => hazard.bossId != null).length,
                hazardTileCount,
                contactRisk: activeHazards.reduce((sum, hazard) => sum + hazard.damage, 0),
                floorBand: floorBandFor(floor),
                relicFavorPotential: schedule.featuredObjectiveId != null ? (schedule.floorTag === 'boss' ? 2 : 1) : 0,
                comboShardPotential: countFindablePairs(board.tiles) + (routeRewardPairs > 0 ? 1 : 0),
                guardRewardPotential: shrinePairs + (dungeonNodeKind === 'rest' ? 1 : 0),
                relicOfferAvailable: floor >= 3 && floor % 3 === 0 ? 1 : 0,
                consumableRewardPotential: keyPairs + (floor % 3 === 0 ? SHOP_ITEM_CATALOG.peek_charge.stock : 0),
                treasureRewardPairs,
                routeRewardPairs,
                eventRewardPotential,
                roomRewardPotential,
                keyInflowPotential,
                boardFairnessIssueCount,
                shopGoldInflowPotential,
                destroyChargeInflowPotential,
                peekChargeInflowPotential,
                recoveryReliefPotential,
                netPressureAfterRelief: Math.max(0, pressure - recoveryReliefPotential)
            };
        })
    );
    const shopGoldBySeed = safeSeeds.map(() =>
        floorNumbers.reduce((sum, floor) => sum + getShopGoldRewardForFloor(floor), 0)
    );
    const shopVisits = floorNumbers.filter((floor) => floor % 3 === 0).length;
    const findableCounts = samples.map((sample) => sample.findablePickupPairs);
    const aggregateFindableKindCounts = sumFindableKindCounts(samples.map((sample) => sample.findableKindCounts));
    const findableKindShares = getFindableKindShares(aggregateFindableKindCounts);
    const tileTraitCounts = samples.map((sample) => sample.tileTraitPairs);
    const traitComboOpportunityCounts = samples.map((sample) => sample.traitComboOpportunityPairs);
    const traitMatchRouteFloorCounts = samples.map((sample) => sample.traitMatchRouteFloors);
    const traitSwapSetupOpportunityCounts = samples.map((sample) => sample.traitSwapSetupOpportunities);
    const traitInteractionLineCounts = samples.map((sample) => sample.traitInteractionLines);
    const traitRewardPickupFloorCounts = samples.map((sample) => sample.traitRewardPickupFloors);
    const traitBoardPowerInteractionOpportunityCounts = samples.map((sample) => sample.traitBoardPowerInteractionOpportunities);
    const deadTraitFloorCounts = samples.map((sample) => sample.deadTraitFloors);
    const deadTraitFloorsByBand = samples.reduce<Record<'early' | 'mid' | 'late', number>>(
        (counts, sample) => ({ ...counts, [sample.floorBand]: counts[sample.floorBand] + sample.deadTraitFloors }),
        { early: 0, mid: 0, late: 0 }
    );
    const aggregateTileTraitKindCounts = sumTileTraitKindCounts(samples.map((sample) => sample.tileTraitKindCounts));
    const tileTraitKindShares = getTileTraitKindShares(aggregateTileTraitKindCounts);
    const totalFindableWeight = Object.values(FINDABLE_KIND_SPAWN_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    const bossFloors = safeSeeds.flatMap((seed) =>
        floorNumbers.map((floor) => pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless').floorTag === 'boss' ? 1 : 0)
    );
    const movingHazardCounts = samples.map((sample) => sample.movingEnemyHazards);
    const hazardTileCounts = samples.map((sample) => sample.hazardTileCount);
    const contactRiskCounts = samples.map((sample) => sample.contactRisk);
    const openerHazardCounts = samples.filter((sample) => sample.floor === 1).map((sample) => sample.hazardTileCount);
    const pressureStepUps = safeSeeds.flatMap((sampleSeed) => {
        const seedSamples = samples.filter((sample) => sample.seed === sampleSeed).sort((a, b) => a.floor - b.floor);
        return seedSamples.slice(1).map((sample, index) => samplePressure(sample) - samplePressure(seedSamples[index]!));
    });
    const recoveryDebtStreaks = safeSeeds.map((sampleSeed) => {
        const seedSamples = samples.filter((sample) => sample.seed === sampleSeed).sort((a, b) => a.floor - b.floor);
        return longestStreak(seedSamples, (sample) => sample.netPressureAfterRelief >= 2);
    });
    const pressureFloorRelief = samples
        .filter((sample) => samplePressure(sample) >= 2.5)
        .map((sample) => sample.recoveryReliefPotential);
    const rewardTotalsByBand = samples.reduce<Record<'early' | 'mid' | 'late', number>>(
        (totals, sample) => ({
            ...totals,
            [sample.floorBand]:
                totals[sample.floorBand] +
                sample.shopGoldEarned +
                sample.relicFavorPotential +
                sample.comboShardPotential +
                sample.guardRewardPotential +
                sample.consumableRewardPotential +
                sample.treasureRewardPairs +
                sample.routeRewardPairs +
                sample.eventRewardPotential +
                sample.roomRewardPotential
        }),
        { early: 0, mid: 0, late: 0 }
    );
    const sampleCountsByBand = samples.reduce<Record<'early' | 'mid' | 'late', number>>(
        (counts, sample) => ({ ...counts, [sample.floorBand]: counts[sample.floorBand] + 1 }),
        { early: 0, mid: 0, late: 0 }
    );
    const rewardAverageByBand = (Object.keys(rewardTotalsByBand) as Array<keyof typeof rewardTotalsByBand>).map((band) =>
        sampleCountsByBand[band] === 0 ? 0 : rewardTotalsByBand[band] / sampleCountsByBand[band]
    );

    const rows = [
        row(
            'avg_shop_gold_per_seed',
            'Average shop gold earned per simulated seed',
            Number(average(shopGoldBySeed).toFixed(2)),
            safeFloors * 3,
            safeFloors * 8,
            'getShopGoldRewardForFloor'
        ),
        row(
            'shop_sink_pressure',
            'Shop sink total per simulated shop visit',
            shopSinkPerVisit * shopVisits,
            shopVisits * 6,
            shopVisits * 24,
            'SHOP_ITEM_CATALOG baseCost'
        ),
        row(
            'avg_findable_pairs_per_floor',
            'Average pickup pairs per floor',
            Number(average(findableCounts).toFixed(2)),
            1,
            2,
            'buildBoard/countFindablePairs'
        ),
        row(
            'avg_tile_trait_pairs_per_floor',
            'Average trait-marked pairs per floor',
            Number(average(tileTraitCounts).toFixed(2)),
            3,
            14,
            'assignTileTraitsToGeneratedBoard'
        ),
        row(
            'avg_trait_combo_opportunity_pairs_per_floor',
            'Average trait pairs with previewable adjacency combos per floor',
            Number(average(traitComboOpportunityCounts).toFixed(2)),
            1,
            10,
            'getTileTraitInteractionPreviewLines'
        ),
        row(
            'trait_match_route_floor_share',
            'Share of floors with at least one match-triggerable trait route',
            Number(average(traitMatchRouteFloorCounts).toFixed(2)),
            0.75,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'avg_trait_swap_setup_opportunities_per_floor',
            'Share of floors with at least one one-swap trait route setup',
            Number(average(traitSwapSetupOpportunityCounts).toFixed(2)),
            0.1,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'avg_trait_interaction_lines_per_floor',
            'Average readable trait interaction preview lines per floor',
            Number(average(traitInteractionLineCounts).toFixed(2)),
            1,
            12,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'trait_reward_pickup_floor_share',
            'Share of floors where traits can produce a reward pickup or resource',
            Number(average(traitRewardPickupFloorCounts).toFixed(2)),
            0.7,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'trait_board_power_interaction_floor_share',
            'Share of floors where traits can interact with shuffle, swap, or block tools',
            Number(average(traitBoardPowerInteractionOpportunityCounts).toFixed(2)),
            0.5,
            1,
            'hasTraitSwapSetupOpportunity'
        ),
        row(
            'dead_trait_floor_share',
            'Share of trait floors without any readable trait interaction',
            Number(average(deadTraitFloorCounts).toFixed(2)),
            0,
            0,
            'getBoardTraitInteractionPreviewLines'
        ),
        ...TILE_TRAIT_KINDS.map((kind) =>
            row(
                `tile_trait_share_${kind}`,
                `Tile trait ${kind} observed share`,
                Number(tileTraitKindShares[kind].toFixed(2)),
                0,
                0.45,
                'assignTileTraitsToGeneratedBoard'
            )
        ),
        ...(Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS) as FindableKind[]).map((kind) => {
            const targetShare = FINDABLE_KIND_SPAWN_WEIGHTS[kind] / totalFindableWeight;
            return row(
                `findable_share_${kind}`,
                `Findable ${kind} observed share`,
                Number(findableKindShares[kind].toFixed(2)),
                Math.max(0, Number((targetShare - 0.18).toFixed(2))),
                Math.min(1, Number((targetShare + 0.18).toFixed(2))),
                'FINDABLE_KIND_SPAWN_WEIGHTS'
            );
        }),
        row(
            'boss_floor_share',
            'Boss floor share in schedule sample',
            Number(average(bossFloors).toFixed(2)),
            0.1,
            0.25,
            'pickFloorScheduleEntry'
        ),
        row(
            'avg_moving_enemy_hazards_per_floor',
            'Average moving enemy patrol overlays per floor',
            Number(average(movingHazardCounts).toFixed(2)),
            0.6,
            1.6,
            'buildBoard enemyHazards'
        ),
        row(
            'avg_hazard_tiles_per_floor',
            'Average board hazard tiles per floor',
            Number(average(hazardTileCounts).toFixed(2)),
            2,
            5,
            'buildBoard tileHazardKind'
        ),
        row(
            'opener_hazard_tiles_per_seed',
            'Average floor-1 hazard tiles per simulated seed',
            Number(average(openerHazardCounts).toFixed(2)),
            0,
            0,
            'buildBoard tileHazardKind opener gate'
        ),
        row(
            'avg_contact_risk_per_floor',
            'Average moving enemy contact damage per floor',
            Number(average(contactRiskCounts).toFixed(2)),
            0.6,
            1.6,
            'EnemyHazardState damage'
        ),
        row(
            'max_pressure_step_up',
            'Largest floor-to-floor pressure increase per seed',
            Number(Math.max(0, ...pressureStepUps).toFixed(2)),
            0,
            3,
            'contact, enemy-card, and boss hazard pressure'
        ),
        row(
            'avg_recovery_relief_on_pressure_floors',
            'Average recovery relief on high-pressure floors',
            Number(average(pressureFloorRelief).toFixed(2)),
            0.4,
            4,
            'guard, room, shop, and key recovery relief'
        ),
        row(
            'max_recovery_debt_streak',
            'Longest seeded streak of high net pressure after relief',
            Math.max(0, ...recoveryDebtStreaks),
            0,
            3,
            'pressure minus guard/shop/room/key relief'
        ),
        row(
            'elite_route_node_share',
            'Elite route node share in simulation sample',
            Number(average(samples.map((sample) => (sample.dungeonNodeKind === 'elite' ? 1 : 0))).toFixed(2)),
            0.15,
            0.35,
            'simulationNodeKindForFloor'
        ),
        row(
            'rare_relic_weight_share',
            'Rare relic draft weight share',
            Number(relicRarityShare('rare').toFixed(2)),
            0.1,
            0.25,
            'RELIC_DRAFT weights'
        ),
        row(
            'avg_relic_favor_potential_per_floor',
            'Average featured-objective Favor potential per floor',
            Number(average(samples.map((sample) => sample.relicFavorPotential)).toFixed(2)),
            0.4,
            1.2,
            'featured objective schedule'
        ),
        row(
            'avg_combo_shard_potential_per_floor',
            'Average combo shard potential per floor',
            Number(average(samples.map((sample) => sample.comboShardPotential)).toFixed(2)),
            1,
            3,
            'findables and route reward pairs'
        ),
        row(
            'avg_guard_reward_potential_per_floor',
            'Average guard reward potential per floor',
            Number(average(samples.map((sample) => sample.guardRewardPotential)).toFixed(2)),
            0.1,
            1.5,
            'shrine pairs and rest nodes'
        ),
        row(
            'relic_offer_cadence',
            'Relic offer cadence per simulated seed',
            Number(average(safeSeeds.map(() => floorNumbers.filter((floor) => floor >= 3 && floor % 3 === 0).length)).toFixed(2)),
            Math.floor(safeFloors / 4),
            Math.ceil(safeFloors / 2),
            'relic milestone cadence'
        ),
        row(
            'avg_consumable_reward_potential_per_floor',
            'Average consumable reward potential per floor',
            Number(average(samples.map((sample) => sample.consumableRewardPotential)).toFixed(2)),
            0.2,
            2,
            'key cards and shop stock'
        ),
        row(
            'avg_treasure_reward_pairs_per_floor',
            'Average treasure/cache pairs per floor',
            Number(average(samples.map((sample) => sample.treasureRewardPairs)).toFixed(2)),
            0.1,
            2.5,
            'treasure and lock card pairs'
        ),
        row(
            'reward_band_spread',
            'Reward-source spread across early/mid/late bands',
            Number((Math.min(...rewardAverageByBand) / Math.max(1, Math.max(...rewardAverageByBand))).toFixed(2)),
            0.35,
            1,
            'floor-band reward totals'
        ),
        row(
            'board_fairness_issue_floor_share',
            'Share of sampled floors with generated board fairness issues',
            Number((samples.filter((sample) => sample.boardFairnessIssueCount > 0).length / samples.length).toFixed(2)),
            0,
            0,
            'board fairness inspection'
        ),
        row(
            'avg_live_shop_gold_inflow_per_floor',
            'Average live shop-gold inflow estimate per floor',
            Number(average(samples.map((sample) => sample.shopGoldInflowPotential)).toFixed(2)),
            4,
            12,
            'floor clear, route, event, and treasure estimates'
        ),
        row(
            'avg_route_reward_pairs_per_floor',
            'Average route reward carrier pairs per floor',
            Number(average(samples.map((sample) => sample.routeRewardPairs)).toFixed(2)),
            0,
            2,
            'route reward pair assignment'
        ),
        row(
            'avg_event_room_reward_potential_per_floor',
            'Average event-room reward options per floor',
            Number(average(samples.map((sample) => sample.eventRewardPotential)).toFixed(2)),
            0,
            1,
            'event node estimate'
        ),
        row(
            'avg_key_inflow_potential_per_floor',
            'Average key inflow estimate per floor',
            Number(average(samples.map((sample) => sample.keyInflowPotential)).toFixed(2)),
            0,
            1.5,
            'key cards and locked exits'
        ),
        row(
            'avg_power_charge_inflow_per_floor',
            'Average destroy/peek charge inflow estimate per floor',
            Number(average(samples.map((sample) => sample.destroyChargeInflowPotential + sample.peekChargeInflowPotential)).toFixed(2)),
            0.1,
            2,
            'room, event, and shop charge estimates'
        )
    ];

    return {
        rulesVersion,
        seeds: safeSeeds,
        floors: safeFloors,
        offlineOnly: true,
        samples,
        aggregate: {
            totalShopGoldEarned: samples.reduce((sum, sample) => sum + sample.shopGoldEarned, 0),
            findablePickupPairs: samples.reduce((sum, sample) => sum + sample.findablePickupPairs, 0),
            findableKindCounts: aggregateFindableKindCounts,
            tileTraitPairs: samples.reduce((sum, sample) => sum + sample.tileTraitPairs, 0),
            traitComboOpportunityPairs: samples.reduce((sum, sample) => sum + sample.traitComboOpportunityPairs, 0),
            traitMatchRouteFloors: samples.reduce((sum, sample) => sum + sample.traitMatchRouteFloors, 0),
            traitSwapSetupOpportunities: samples.reduce((sum, sample) => sum + sample.traitSwapSetupOpportunities, 0),
            traitInteractionLines: samples.reduce((sum, sample) => sum + sample.traitInteractionLines, 0),
            traitRewardPickupFloors: samples.reduce((sum, sample) => sum + sample.traitRewardPickupFloors, 0),
            traitBoardPowerInteractionOpportunities: samples.reduce(
                (sum, sample) => sum + sample.traitBoardPowerInteractionOpportunities,
                0
            ),
            deadTraitFloors: samples.reduce((sum, sample) => sum + sample.deadTraitFloors, 0),
            deadTraitFloorsByBand,
            tileTraitKindCounts: aggregateTileTraitKindCounts,
            bossFloors: samples.filter((sample) => sample.floorTag === 'boss').length,
            breatherFloors: samples.filter((sample) => sample.floorTag === 'breather').length,
            eliteFloors: samples.filter((sample) => sample.dungeonNodeKind === 'elite').length,
            enemyThreatPairs: samples.reduce((sum, sample) => sum + sample.enemyThreatPairs, 0),
            movingEnemyHazards: samples.reduce((sum, sample) => sum + sample.movingEnemyHazards, 0),
            bossMovingEnemyHazards: samples.reduce((sum, sample) => sum + sample.bossMovingEnemyHazards, 0),
            hazardTileCount: samples.reduce((sum, sample) => sum + sample.hazardTileCount, 0),
            contactRisk: samples.reduce((sum, sample) => sum + sample.contactRisk, 0),
            shopSinkBudget: samples.reduce((sum, sample) => sum + sample.shopSinkBudget, 0),
            relicFavorPotential: samples.reduce((sum, sample) => sum + sample.relicFavorPotential, 0),
            comboShardPotential: samples.reduce((sum, sample) => sum + sample.comboShardPotential, 0),
            guardRewardPotential: samples.reduce((sum, sample) => sum + sample.guardRewardPotential, 0),
            relicOfferAvailable: samples.reduce((sum, sample) => sum + sample.relicOfferAvailable, 0),
            consumableRewardPotential: samples.reduce((sum, sample) => sum + sample.consumableRewardPotential, 0),
            treasureRewardPairs: samples.reduce((sum, sample) => sum + sample.treasureRewardPairs, 0),
            routeRewardPairs: samples.reduce((sum, sample) => sum + sample.routeRewardPairs, 0),
            eventRewardPotential: samples.reduce((sum, sample) => sum + sample.eventRewardPotential, 0),
            roomRewardPotential: samples.reduce((sum, sample) => sum + sample.roomRewardPotential, 0),
            keyInflowPotential: samples.reduce((sum, sample) => sum + sample.keyInflowPotential, 0),
            boardFairnessIssueCount: samples.reduce((sum, sample) => sum + sample.boardFairnessIssueCount, 0),
            shopGoldInflowPotential: samples.reduce((sum, sample) => sum + sample.shopGoldInflowPotential, 0),
            destroyChargeInflowPotential: samples.reduce((sum, sample) => sum + sample.destroyChargeInflowPotential, 0),
            peekChargeInflowPotential: samples.reduce((sum, sample) => sum + sample.peekChargeInflowPotential, 0),
            recoveryReliefPotential: samples.reduce((sum, sample) => sum + sample.recoveryReliefPotential, 0),
            netPressureAfterRelief: samples.reduce((sum, sample) => sum + sample.netPressureAfterRelief, 0),
            highPressureLowRecoveryFloors: samples.filter((sample) => sample.netPressureAfterRelief >= 2).length
        },
        rows,
        notes: [
            'Simulation is deterministic and local-only; no leaderboard or server authority is implied.',
            'Targets are smoke-test guardrails, not final balance verdicts.',
            'Live economy fields are estimates from existing route/event/room/reward rules; runtime gameplay is unchanged.',
            'Findable kind distribution rows are diagnostics for seeded generation drift; they do not alter rewards or spawn rules.',
            'Tile trait rows verify density and mix for the reward/drawback layer without changing runtime gameplay.'
        ]
    };
};

export const summarizeBalanceSimulation = (report: BalanceSimulationReport): string =>
    report.rows.map((entry) => `${entry.key}=${entry.value}(${entry.status})`).join('; ');

export const BALANCE_SIMULATION_BASELINE = {
    totalShopGoldEarned: { min: 70, max: 85 },
    findablePickupPairs: { min: 12, max: 24 },
    bossFloors: { min: 2, max: 2 },
    breatherFloors: { min: 3, max: 3 },
    shopSinkBudget: { min: 84, max: 84 }
} as const;

export const assertBalanceSimulationWithinBaseline = (
    report: BalanceSimulationReport,
    baseline: typeof BALANCE_SIMULATION_BASELINE
): { ok: boolean; issues: string[] } => {
    const issues = (Object.keys(baseline) as Array<keyof typeof baseline>).flatMap((key) => {
        const value = report.aggregate[key];
        const range = baseline[key];
        return value < range.min || value > range.max ? [`${key}:${value} outside ${range.min}-${range.max}`] : [];
    });
    return { ok: issues.length === 0, issues };
};

const sampleRewardPotential = (sample: BalanceSimulationReport['samples'][number]): number =>
    sample.relicFavorPotential +
    sample.comboShardPotential +
    sample.guardRewardPotential +
    sample.consumableRewardPotential +
    sample.treasureRewardPairs +
    sample.findablePickupPairs;

export const runDungeonBalanceProfileSimulation = (
    input: BalanceSimulationInput & { profiles?: readonly DungeonBalanceProfileId[] }
): DungeonBalanceProfileReport => {
    const base = runBalanceSimulation(input);
    const selectedProfiles = input.profiles?.length
        ? DUNGEON_BALANCE_PROFILES.filter((profile) => input.profiles?.includes(profile.id))
        : DUNGEON_BALANCE_PROFILES;
    const samplesBySeed = base.seeds.map((sampleSeed) =>
        base.samples.filter((sample) => sample.seed === sampleSeed).sort((a, b) => a.floor - b.floor)
    );
    const healLifeCost = SHOP_ITEM_CATALOG.heal_life.baseCost;

    const profiles = selectedProfiles.map((profile) => {
        let floorsCleared = 0;
        let livesLost = 0;
        let guardUsed = 0;
        let healingPurchased = 0;
        let minLivesRemaining = INITIAL_LIVES;
        let runFalls = 0;
        let maxAtRiskStreak = 0;
        let lowLifeFloors = 0;
        let maxLowLifeStreak = 0;
        let unhealedLowLifeFloors = 0;
        let maxUnhealedLowLifeStreak = 0;
        let recoveryDebtFloors = 0;
        let maxRecoveryDebtStreak = 0;
        let healingSpend = 0;
        let shopSpendBudget = 0;
        const routeChoiceCounts = emptyRouteChoiceCounts();
        let safeRouteTollSpend = 0;
        let greedLifeCosts = 0;
        let shopServiceSpend = 0;
        let endingShopGold = 0;
        let maxShopGoldHeld = 0;
        let rewardClaims = 0;
        let bossWins = 0;
        let bossAttempts = 0;
        const seedOutcomes: DungeonBalanceProfileMetrics['seedOutcomes'] = [];
        let firstRiskSample: DungeonBalanceProfileMetrics['firstRiskSample'] = null;

        for (const seedSamples of samplesBySeed) {
            let lives = INITIAL_LIVES;
            let shopGold = 0;
            let atRiskStreak = 0;
            let lowLifeStreak = 0;
            let recoveryDebtStreak = 0;
            let seedFloorsCleared = 0;
            let seedLivesLost = 0;
            let seedRunFalls = 0;
            let seedMinLivesRemaining = INITIAL_LIVES;
            let seedLowLifeFloors = 0;
            let seedUnhealedLowLifeFloors = 0;
            let seedBossWins = 0;
            let seedBossAttempts = 0;
            let unhealedLowLifeStreak = 0;

            for (const sample of seedSamples) {
                shopGold += Math.floor(sample.shopGoldEarned * profile.rewardBias);
                maxShopGoldHeld = Math.max(maxShopGoldHeld, shopGold);
                shopSpendBudget += sample.shopSinkBudget;

                const shopAvailable = sample.shopSinkBudget > 0 || sample.dungeonNodeKind === 'shop';
                const healThreshold = healingBuyThresholdForProfile(profile.id);
                if (shopAvailable && lives < healThreshold && lives < MAX_LIVES && shopGold >= healLifeCost) {
                    lives += 1;
                    shopGold -= healLifeCost;
                    healingPurchased += 1;
                    healingSpend += healLifeCost;
                    maxShopGoldHeld = Math.max(maxShopGoldHeld, shopGold);
                }
                if (shopAvailable && sample.shopSinkBudget > 0 && shopGold > 0) {
                    const discretionarySpend = Math.min(
                        shopGold,
                        Math.floor(sample.shopSinkBudget * shopServiceSpendShareForProfile(profile.id))
                    );
                    shopGold -= discretionarySpend;
                    shopServiceSpend += discretionarySpend;
                }

                const pressure = samplePressure(sample);
                const guardAvailable = sample.guardRewardPotential + (profile.id === 'cautious' ? 1 : 0);
                const guardSpend = Math.min(guardAvailable, Math.floor(pressure * profile.guardEfficiency));
                const residualPressure = Math.max(0, pressure - guardSpend - profile.riskTolerance);
                const profileRecoveryDebt = Math.max(
                    0,
                    residualPressure -
                        sample.recoveryReliefPotential -
                        (shopAvailable && shopGold >= healLifeCost ? 0.75 : 0)
                );
                if (profileRecoveryDebt >= 1) {
                    recoveryDebtFloors += 1;
                    recoveryDebtStreak += 1;
                } else {
                    recoveryDebtStreak = 0;
                }
                maxRecoveryDebtStreak = Math.max(maxRecoveryDebtStreak, recoveryDebtStreak);
                const lost = Math.floor(residualPressure / (profile.id === 'greedy' ? 1.35 : 1.55));
                const cleared = lost <= (profile.id === 'greedy' ? 1 : 2) && lives - lost > 0;

                guardUsed += guardSpend;
                livesLost += lost;
                seedLivesLost += lost;
                lives -= lost;
                minLivesRemaining = Math.min(minLivesRemaining, lives);
                seedMinLivesRemaining = Math.min(seedMinLivesRemaining, lives);
                atRiskStreak = lost > 0 ? atRiskStreak + 1 : 0;
                maxAtRiskStreak = Math.max(maxAtRiskStreak, atRiskStreak);
                rewardClaims += sampleRewardPotential(sample) * profile.rewardBias;
                if (sample.floorTag === 'boss') {
                    bossAttempts += 1;
                    seedBossAttempts += 1;
                    if (cleared && residualPressure <= 2.25) {
                        bossWins += 1;
                        seedBossWins += 1;
                    }
                }
                if (cleared) {
                    floorsCleared += 1;
                    seedFloorsCleared += 1;
                    if (residualPressure <= 0.75 && lives < MAX_LIVES) {
                        lives += 1;
                        minLivesRemaining = Math.min(minLivesRemaining, lives);
                        seedMinLivesRemaining = Math.min(seedMinLivesRemaining, lives);
                    }
                    const routeChoice = chooseProfileRoute(profile.id, lives, sample);
                    routeChoiceCounts[routeChoice] += 1;
                    if (routeChoice === 'safe') {
                        if (lives < MAX_LIVES) {
                            if (shopGold > 0) {
                                shopGold -= 1;
                                safeRouteTollSpend += 1;
                            }
                            lives += 1;
                        }
                    } else if (routeChoice === 'greed' && lives > 1) {
                        lives -= 1;
                        shopGold += 2;
                        greedLifeCosts += 1;
                        rewardClaims += 1.5;
                        maxShopGoldHeld = Math.max(maxShopGoldHeld, shopGold);
                    } else if (routeChoice === 'mystery') {
                        rewardClaims += 1;
                    }
                    minLivesRemaining = Math.min(minLivesRemaining, lives);
                    seedMinLivesRemaining = Math.min(seedMinLivesRemaining, lives);
                } else {
                    if (!firstRiskSample) {
                        firstRiskSample = { floor: sample.floor, seed: sample.seed };
                    }
                    if (lives <= 0) {
                        runFalls += 1;
                        seedRunFalls += 1;
                        lives = INITIAL_LIVES;
                        atRiskStreak = 0;
                    }
                }
                if (lives <= 2) {
                    lowLifeFloors += 1;
                    seedLowLifeFloors += 1;
                    lowLifeStreak += 1;
                    if (!(shopAvailable && lives < MAX_LIVES && shopGold >= healLifeCost)) {
                        unhealedLowLifeFloors += 1;
                        seedUnhealedLowLifeFloors += 1;
                        unhealedLowLifeStreak += 1;
                    } else {
                        unhealedLowLifeStreak = 0;
                    }
                } else {
                    lowLifeStreak = 0;
                    unhealedLowLifeStreak = 0;
                }
                maxLowLifeStreak = Math.max(maxLowLifeStreak, lowLifeStreak);
                maxUnhealedLowLifeStreak = Math.max(maxUnhealedLowLifeStreak, unhealedLowLifeStreak);
            }
            endingShopGold += shopGold;
            seedOutcomes.push({
                seed: seedSamples[0]?.seed ?? 0,
                floorsCleared: seedFloorsCleared,
                livesLost: seedLivesLost,
                runFalls: seedRunFalls,
                minLivesRemaining: seedMinLivesRemaining,
                lowLifeFloors: seedLowLifeFloors,
                unhealedLowLifeFloors: seedUnhealedLowLifeFloors,
                endingShopGold: shopGold,
                bossWins: seedBossWins,
                bossAttempts: seedBossAttempts
            });
        }

        const shopsVisited = Math.round(
            base.samples.filter((sample) => sample.dungeonNodeKind === 'shop').length * profile.shopVisitBias
        );
        const totalRouteChoices = Object.values(routeChoiceCounts).reduce((sum, count) => sum + count, 0);
        const dominantRouteShare =
            totalRouteChoices === 0 ? 0 : Math.max(...Object.values(routeChoiceCounts)) / totalRouteChoices;
        const seedFloorClearShares = seedOutcomes.map((outcome) => outcome.floorsCleared / Math.max(1, base.floors));
        const worstSeedFloorsClearedShare = seedFloorClearShares.length === 0 ? 0 : Math.min(...seedFloorClearShares);
        const bestSeedFloorsClearedShare = seedFloorClearShares.length === 0 ? 0 : Math.max(...seedFloorClearShares);
        const worstSeedLowLifeFloorShare =
            seedOutcomes.length === 0
                ? 0
                : Math.max(...seedOutcomes.map((outcome) => outcome.lowLifeFloors / Math.max(1, base.floors)));
        const worstSeedUnhealedLowLifeFloorShare =
            seedOutcomes.length === 0
                ? 0
                : Math.max(
                      ...seedOutcomes.map((outcome) => outcome.unhealedLowLifeFloors / Math.max(1, base.floors))
                  );

        return {
            profile: profile.id,
            seedOutcomes,
            floorsCleared,
            livesLost,
            guardUsed,
            healingPurchased,
            minLivesRemaining,
            runFalls,
            maxAtRiskStreak,
            lowLifeFloors,
            lowLifeFloorShare: Number((lowLifeFloors / Math.max(1, base.samples.length)).toFixed(2)),
            maxLowLifeStreak,
            unhealedLowLifeFloors,
            unhealedLowLifeFloorShare: Number(
                (unhealedLowLifeFloors / Math.max(1, base.samples.length)).toFixed(2)
            ),
            maxUnhealedLowLifeStreak,
            recoveryDebtFloors,
            maxRecoveryDebtStreak,
            routeChoiceCounts,
            dominantRouteShare: Number(dominantRouteShare.toFixed(2)),
            safeRouteTollSpend,
            greedLifeCosts,
            shopServiceSpend,
            shopGoldEarned: Number((base.aggregate.totalShopGoldEarned * profile.rewardBias).toFixed(2)),
            endingShopGold,
            maxShopGoldHeld,
            worstSeedFloorsClearedShare: Number(worstSeedFloorsClearedShare.toFixed(2)),
            worstSeedLowLifeFloorShare: Number(worstSeedLowLifeFloorShare.toFixed(2)),
            worstSeedUnhealedLowLifeFloorShare: Number(worstSeedUnhealedLowLifeFloorShare.toFixed(2)),
            worstSeedRunFalls: Math.max(0, ...seedOutcomes.map((outcome) => outcome.runFalls)),
            maxSeedEndingShopGold: Math.max(0, ...seedOutcomes.map((outcome) => outcome.endingShopGold)),
            seedFloorClearShareSpread: Number((bestSeedFloorsClearedShare - worstSeedFloorsClearedShare).toFixed(2)),
            rewardClaims: Number(rewardClaims.toFixed(2)),
            bossWins,
            bossAttempts,
            shopsVisited,
            firstRiskSample,
            healingPurchaseShare: shopSpendBudget === 0 ? 0 : Number((healingSpend / shopSpendBudget).toFixed(2))
        };
    });

    return {
        base,
        profiles,
        bounds: {
            minFloorsClearedShare: 0.82,
            maxLivesLostPerFloor: 1.35,
            minBossWinShare: 0.5,
            maxShopGoldPerFloor: 12,
            minLivesRemaining: 1,
            maxRunFalls: 0,
            maxHealingPurchaseShare: 0.45,
            maxAtRiskStreak: 5,
            maxLowLifeFloorShare: 0.45,
            maxLowLifeStreak: 5,
            maxUnhealedLowLifeFloorShare: 0.35,
            maxUnhealedLowLifeStreak: 4,
            maxRecoveryDebtStreak: 3,
            maxDominantRouteShare: 0.75,
            maxEndingShopGoldPerFloor: 5,
            maxShopGoldHeldPerFloor: 6,
            minWorstSeedFloorsClearedShare: 0.72,
            maxWorstSeedLowLifeFloorShare: 0.55,
            maxWorstSeedUnhealedLowLifeFloorShare: 0.45,
            maxWorstSeedRunFalls: 0,
            maxSeedEndingShopGoldPerFloor: 7,
            maxSeedFloorClearShareSpread: 0.28
        },
        notes: [
            'Profiles are broad deterministic guardrails, not exact win-rate claims.',
            'Bounds intentionally report profile/seed/floor context so balance failures are actionable.',
            'Profile diagnostics carry lives and healing across each seed to catch survivability cliffs hidden by average loss rates.',
            'Route-choice diagnostics model safe, greed, and mystery pressure so one route cannot silently become the default answer.',
            'Wallet-carry diagnostics keep profile survivability from masking runaway unspent shop gold.',
            'Recovery-debt diagnostics catch clustered pressure floors whose local guard, shop, room, or key relief is too thin.',
            'Low-life exposure diagnostics catch runs that survive on paper while spending too many floors near collapse.',
            'Unhealed low-life diagnostics separate ordinary danger from low-life floors without immediate shop healing access.',
            'Per-seed profile outcomes keep a rough seed from hiding inside healthy aggregate averages.'
        ]
    };
};

export const assertDungeonBalanceProfilesWithinBounds = (
    report: DungeonBalanceProfileReport
): { ok: boolean; issues: string[] } => {
    const totalFloors = Math.max(1, report.base.samples.length);
    const issues = report.profiles.flatMap((profile) => {
        const context = `${profile.profile}@seed:${profile.firstRiskSample?.seed ?? report.base.seeds[0] ?? 0}/floor:${
            profile.firstRiskSample?.floor ?? report.base.floors
        }`;
        const profileIssues: string[] = [];
        if (profile.floorsCleared / totalFloors < report.bounds.minFloorsClearedShare) {
            profileIssues.push(`${context}:floorsCleared=${profile.floorsCleared}/${totalFloors}`);
        }
        if (profile.livesLost / totalFloors > report.bounds.maxLivesLostPerFloor) {
            profileIssues.push(`${context}:livesLost=${profile.livesLost}/${totalFloors}`);
        }
        if (profile.minLivesRemaining < report.bounds.minLivesRemaining) {
            profileIssues.push(`${context}:minLivesRemaining=${profile.minLivesRemaining}`);
        }
        if (profile.runFalls > report.bounds.maxRunFalls) {
            profileIssues.push(`${context}:runFalls=${profile.runFalls}`);
        }
        if (profile.healingPurchaseShare > report.bounds.maxHealingPurchaseShare) {
            profileIssues.push(`${context}:healingPurchaseShare=${profile.healingPurchaseShare}`);
        }
        if (profile.maxAtRiskStreak > report.bounds.maxAtRiskStreak) {
            profileIssues.push(`${context}:maxAtRiskStreak=${profile.maxAtRiskStreak}`);
        }
        if (profile.lowLifeFloorShare > report.bounds.maxLowLifeFloorShare) {
            profileIssues.push(`${context}:lowLifeFloorShare=${profile.lowLifeFloorShare}`);
        }
        if (profile.maxLowLifeStreak > report.bounds.maxLowLifeStreak) {
            profileIssues.push(`${context}:maxLowLifeStreak=${profile.maxLowLifeStreak}`);
        }
        if (profile.unhealedLowLifeFloorShare > report.bounds.maxUnhealedLowLifeFloorShare) {
            profileIssues.push(`${context}:unhealedLowLifeFloorShare=${profile.unhealedLowLifeFloorShare}`);
        }
        if (profile.maxUnhealedLowLifeStreak > report.bounds.maxUnhealedLowLifeStreak) {
            profileIssues.push(`${context}:maxUnhealedLowLifeStreak=${profile.maxUnhealedLowLifeStreak}`);
        }
        if (profile.maxRecoveryDebtStreak > report.bounds.maxRecoveryDebtStreak) {
            profileIssues.push(`${context}:maxRecoveryDebtStreak=${profile.maxRecoveryDebtStreak}`);
        }
        if (profile.dominantRouteShare > report.bounds.maxDominantRouteShare) {
            profileIssues.push(`${context}:dominantRouteShare=${profile.dominantRouteShare}`);
        }
        if (profile.endingShopGold / totalFloors > report.bounds.maxEndingShopGoldPerFloor) {
            profileIssues.push(`${context}:endingShopGold=${profile.endingShopGold}/${totalFloors}`);
        }
        if (profile.maxShopGoldHeld / report.base.floors > report.bounds.maxShopGoldHeldPerFloor) {
            profileIssues.push(`${context}:maxShopGoldHeld=${profile.maxShopGoldHeld}/${report.base.floors}`);
        }
        if (profile.worstSeedFloorsClearedShare < report.bounds.minWorstSeedFloorsClearedShare) {
            profileIssues.push(`${context}:worstSeedFloorsClearedShare=${profile.worstSeedFloorsClearedShare}`);
        }
        if (profile.worstSeedLowLifeFloorShare > report.bounds.maxWorstSeedLowLifeFloorShare) {
            profileIssues.push(`${context}:worstSeedLowLifeFloorShare=${profile.worstSeedLowLifeFloorShare}`);
        }
        if (profile.worstSeedUnhealedLowLifeFloorShare > report.bounds.maxWorstSeedUnhealedLowLifeFloorShare) {
            profileIssues.push(
                `${context}:worstSeedUnhealedLowLifeFloorShare=${profile.worstSeedUnhealedLowLifeFloorShare}`
            );
        }
        if (profile.worstSeedRunFalls > report.bounds.maxWorstSeedRunFalls) {
            profileIssues.push(`${context}:worstSeedRunFalls=${profile.worstSeedRunFalls}`);
        }
        if (profile.maxSeedEndingShopGold / report.base.floors > report.bounds.maxSeedEndingShopGoldPerFloor) {
            profileIssues.push(`${context}:maxSeedEndingShopGold=${profile.maxSeedEndingShopGold}/${report.base.floors}`);
        }
        if (profile.seedFloorClearShareSpread > report.bounds.maxSeedFloorClearShareSpread) {
            profileIssues.push(`${context}:seedFloorClearShareSpread=${profile.seedFloorClearShareSpread}`);
        }
        if (profile.bossAttempts > 0 && profile.bossWins / profile.bossAttempts < report.bounds.minBossWinShare) {
            profileIssues.push(`${context}:bossWins=${profile.bossWins}/${profile.bossAttempts}`);
        }
        if (profile.shopGoldEarned / totalFloors > report.bounds.maxShopGoldPerFloor) {
            profileIssues.push(`${context}:shopGoldEarned=${profile.shopGoldEarned}/${totalFloors}`);
        }
        return profileIssues;
    });

    return { ok: issues.length === 0, issues };
};
