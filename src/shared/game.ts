import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    CHAIN_HEAL_STREAK_STEP,
    COMBO_GUARD_STREAK_STEP,
    CATALYST_ALTAR_FALLBACK_SCORE_REWARD,
    CATALYST_ALTAR_UPGRADED_SCORE_REWARD,
    CURSED_LAST_BONUS_SCORE,
    DEBUG_REVEAL_MS,
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    FEATURED_OBJECTIVE_STREAK_MISS_DECAY,
    FINDABLE_KIND_SPAWN_WEIGHTS,
    FINDABLE_MATCH_COMBO_SHARDS,
    FINDABLE_MATCH_SAFE_HAZARD_WARDS,
    FINDABLE_MATCH_SCORE,
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    FEATURED_OBJECTIVE_STREAK_BONUS_MAX,
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    FLIP_PAR_BONUS_SCORE,
    FLOOR_CLEAR_GOLD_BASE,
    FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD,
    FUSE_CACHE_FRESH_RESOLUTION_LIMIT,
    FUSE_CACHE_FRESH_SCORE_REWARD,
    FUSE_CACHE_FRESH_SHOP_GOLD_REWARD,
    GAME_RULES_VERSION,
    SHIFTING_BOUNTY_MATCH_BONUS,
    SHIFTING_WARD_MATCH_PENALTY,
    GLASS_WITNESS_BONUS_SCORE,
    INITIAL_LIVES,
    INITIAL_REGION_SHUFFLE_CHARGES,
    INITIAL_SHUFFLE_CHARGES,
    MATCH_DELAY_MS,
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    MAX_PENDING_MEMORIZE_BONUS_MS,
    MAX_PINNED_TILES,
    LOADED_GATEWAY_SCORE_REWARD,
    MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD,
    MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
    MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
    PARASITE_VESSEL_FALLBACK_SCORE_REWARD,
    PIN_LATTICE_SCORE_REWARD,
    MEMORIZE_BASE_MS,
    MEMORIZE_BONUS_PER_LIFE_LOST_MS,
    MEMORIZE_DECAY_EVERY_N_LEVELS,
    MEMORIZE_MIN_MS,
    MEMORIZE_STEP_MS,
    SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    type AchievementId,
    TOLL_CACHE_MATCH_SCORE_TOLL,
    TOLL_CACHE_SHOP_GOLD_REWARD,
    type BoardState,
    type DungeonCardEffectId,
    type DungeonBossId,
    type EnemyHazardKind,
    type EnemyHazardPattern,
    type EnemyHazardState,
    type DungeonFloorBlueprint,
    type DungeonRunNodeKind,
    type DungeonExitLockKind,
    type DungeonKeyKind,
    type DungeonCardKind,
    type FindableKind,
    type HazardTileKind,
    type ClearLifeReason,
    type FeaturedObjectiveId,
    type FloorTag,
    type FloorArchetypeId,
    type GameMode,
    type LevelResult,
    type MutatorId,
    type Rating,
    type RelicId,
    type RelicOfferServiceId,
    type ResumableRunStatus,
    type RunShopItemId,
    type RunShopOfferState,
    type RunState,
    type RunStatus,
    type RouteSideRoomState,
    type RouteChoice,
    type RouteCardKind,
    type RouteCardPlan,
    type RouteNodeType,
    type RouteSpecialKind,
    type RouteWorldProfile,
    type SessionStats,
    type Tile,
    type WeakerShuffleMode
} from './contracts';
import {
    claimBonusReward,
    createBonusRewardLedger,
    rollBonusRewardRoom
} from './bonus-rewards';
import {
    getChapterActBiomeForCycleFloor,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from './floor-mutator-schedule';
import { createRestShrineServices } from './rest-shrine';
import { applyRunEventChoice, rollRunEventRoom } from './run-events';
import { getDungeonLevelResultTags } from './secondary-objectives';
import { DAILY_MUTATOR_TABLE, hasMutator } from './mutators';
import {
    applyRelicOfferService,
    getRelicOfferServiceActions,
    getRelicDraftOptionReasons,
    needsRelicPick,
    relicMilestoneIndexForFloor,
    rollRelicOptions,
    skipRelicOfferMilestone
} from './relics';
import {
    createMulberry32,
    deriveDailyMutatorIndex,
    deriveDailyRunSeed,
    deriveLevelTileRngSeed,
    deriveShuffleRngSeed,
    formatDailyDateKeyUtc,
    hashStringToSeed,
    shuffleWithRng
} from './rng';
import {
    assignRouteWorldSpecials,
    deriveRouteWorldProfile
} from './route-world';
import {
    createDungeonRunMapState,
    enterSelectedDungeonNode,
    getSelectedDungeonNode,
    revealDungeonChoices,
    selectDungeonNode
} from './run-map';
import {
    LETTER_SYMBOLS,
    NUMBER_SYMBOLS,
    getSymbolSetForLevel as getSymbolSetForLevelFromCatalog
} from './tile-symbol-catalog';
import { getDungeonCardKindDefinition } from './dungeon-cards';
import { getHazardTileDefinition } from './hazard-tiles';

type SymbolEntry = { symbol: string; label: string };
const COMBO_SHARD_STREAK_STEP = 2;
const COMBO_SHARDS_PER_LIFE = 3;
export const DECOY_PAIR_KEY = '__decoy__';
export const WILD_PAIR_KEY = '__wild__';
export const EXIT_PAIR_KEY = '__exit__';
export const SHOP_PAIR_KEY = '__shop__';
export const ROOM_PAIR_KEY = '__room__';
const PICKUP_BASELINE_RULES_VERSION = 8;
const HAZARD_TILE_BASELINE_RULES_VERSION = 20;
const FRAGILE_CACHE_BASELINE_LEVEL = 3;
const FRAGILE_CACHE_MATCH_SCORE = 25;
const TOLL_CACHE_BASELINE_LEVEL = 5;
const FUSE_CACHE_BASELINE_LEVEL = 7;

const isSingletonUtilityPairKey = (pairKey: string): boolean =>
    pairKey === DECOY_PAIR_KEY ||
    pairKey === WILD_PAIR_KEY ||
    pairKey === EXIT_PAIR_KEY ||
    pairKey === SHOP_PAIR_KEY ||
    pairKey === ROOM_PAIR_KEY;

/** When the board includes a wild joker, returns its tile id (for `RunState.wildTileId`); otherwise null. */
export const getWildTileIdFromBoard = (board: BoardState): string | null =>
    board.tiles.find((t) => t.pairKey === WILD_PAIR_KEY)?.id ?? null;

export const boardHasGlassDecoy = (board: BoardState): boolean =>
    board.tiles.some((t) => t.pairKey === DECOY_PAIR_KEY && t.tileHazardKind !== 'mirror_decoy');

const pickCursedPairKey = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number
): string | null => {
    const realKeys = [
        ...new Set(
            tiles
                .map((t) => t.pairKey)
                .filter((k) => !isSingletonUtilityPairKey(k))
        )
    ];
    if (realKeys.length < 2) {
        return null;
    }
    const rng = createMulberry32(hashStringToSeed(`cursed:${rulesVersion}:${runSeed}:${level}`));
    return realKeys[Math.floor(rng() * realKeys.length)]!;
};

const flipParLimit = (pairCount: number): number => Math.ceil(pairCount * 1.25) + 2;
const ECHO_EXTRA_RESOLVE_MS = 380;
const SHUFFLE_SCORE_TAX_FACTOR = 0.94;
const ENCORE_BONUS_SCORE = 18;
const GAMBIT_FAIL_EXTRA_TRIES = 1;
const RELIC_FAVOR_PER_BONUS_PICK = 3;

const FEATURED_OBJECTIVE_BONUS_SCORES: Record<FeaturedObjectiveId, number> = {
    scholar_style: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    glass_witness: GLASS_WITNESS_BONUS_SCORE,
    cursed_last: CURSED_LAST_BONUS_SCORE,
    flip_par: FLIP_PAR_BONUS_SCORE
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Documented in `docs/BALANCE_NOTES.md` (presentation mutator match penalties). */
export const PRESENTATION_MUTATOR_MATCH_PENALTIES = {
    wide_recall: 5,
    silhouette_twist: 5,
    distraction_channel: 4
} as const;

export const getPresentationMutatorMatchPenalty = (run: RunState): number => {
    let penalty = 0;
    if (hasMutator(run, 'wide_recall')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.wide_recall;
    }
    if (hasMutator(run, 'silhouette_twist')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.silhouette_twist;
    }
    if (hasMutator(run, 'distraction_channel')) {
        penalty += PRESENTATION_MUTATOR_MATCH_PENALTIES.distraction_channel;
    }
    return penalty;
};

const createTimerState = (overrides?: Partial<RunState['timerState']>): RunState['timerState'] => ({
    memorizeRemainingMs: null,
    resolveRemainingMs: null,
    debugRevealRemainingMs: null,
    pausedFromStatus: null,
    gauntletPausedAtMs: null,
    ...overrides
});

const dungeonRunFor = (run: RunState): RunState['dungeonRun'] =>
    run.dungeonRun ?? createDungeonRunMapState(run.runSeed, run.runRulesVersion, run.board?.level ?? run.stats.highestLevel);

const withSelectedDungeonRoute = (run: RunState, choiceId: string): RunState => ({
    ...run,
    dungeonRun: selectDungeonNode(dungeonRunFor(run), choiceId)
});

export const generateRouteChoices = (run: RunState, nextLevel: number): NonNullable<LevelResult['routeChoices']> => {
    const baseId = `${run.runRulesVersion}:${run.runSeed}:${nextLevel}`;
    const greedDetail =
        nextLevel % 3 === 0
            ? 'Higher pressure route hook with vendor access after the next floor.'
            : 'Higher pressure route hook for future shop, elite, or bonus rewards.';
    const mysteryDetail =
        nextLevel % 4 === 0
            ? 'Hidden treasure or secret-room hook with capped bonus rewards.'
            : 'Random event and secret-room hook with replayable local RNG.';
    return [
        {
            id: `${baseId}:safe`,
            routeType: 'safe',
            label: 'Safe passage',
            detail: 'Standard next floor. Keep the run curve predictable.',
            rewardPreview: 'Recover 1 life if wounded; otherwise gain 1 guard token.'
        },
        {
            id: `${baseId}:greed`,
            routeType: 'greed',
            label: 'Greedy route',
            detail: greedDetail,
            rewardPreview: `+${ROUTE_GREED_SHOP_GOLD_REWARD} shop gold and +${ROUTE_GREED_SCORE_REWARD} score.`,
            riskPreview: '-1 life; unavailable at 1 life.'
        },
        {
            id: `${baseId}:mystery`,
            routeType: 'mystery',
            label: 'Mystery route',
            detail: mysteryDetail,
            rewardPreview: 'Deterministic local reward: gold, combo shard, or relic Favor.'
        }
    ];
};

export interface RouteChoiceOutcomeResult {
    run: RunState;
    applied: boolean;
    routeType?: RouteNodeType;
    reason?: 'missing_choice' | 'invalid_status' | 'unavailable';
    summaryText?: string;
}

const mysteryRouteOutcomeFor = (run: RunState, clearedFloor: number): MysteryRouteOutcome => {
    const outcomes: MysteryRouteOutcome[] = ['shop_gold', 'combo_shard', 'relic_favor'];
    const seed = hashStringToSeed(`routeMystery:${run.runRulesVersion}:${run.runSeed}:${clearedFloor}`);
    return outcomes[Math.abs(seed) % outcomes.length]!;
};

const addRouteScore = (run: RunState, score: number): RunState => {
    const totalScore = run.stats.totalScore + score;
    const bestScore = Math.max(run.stats.bestScore, totalScore);
    return {
        ...run,
        stats: {
            ...run.stats,
            totalScore,
            currentLevelScore: run.stats.currentLevelScore + score,
            bestScore
        },
        lastLevelResult: run.lastLevelResult
            ? {
                  ...run.lastLevelResult,
                  scoreGained: run.lastLevelResult.scoreGained + score
              }
            : run.lastLevelResult
    };
};

const applyMysteryRouteOutcome = (run: RunState): { run: RunState; summaryText: string } => {
    const clearedFloor = run.lastLevelResult?.level ?? run.board?.level ?? run.stats.highestLevel;
    const outcome = mysteryRouteOutcomeFor(run, clearedFloor);
    if (outcome === 'shop_gold') {
        return {
            run: { ...run, shopGold: run.shopGold + ROUTE_MYSTERY_SHOP_GOLD_REWARD },
            summaryText: `Mystery route: +${ROUTE_MYSTERY_SHOP_GOLD_REWARD} shop gold.`
        };
    }
    if (outcome === 'combo_shard') {
        return {
            run: {
                ...run,
                stats: {
                    ...run.stats,
                    comboShards: Math.min(MAX_COMBO_SHARDS, run.stats.comboShards + 1)
                }
            },
            summaryText: 'Mystery route: +1 combo shard.'
        };
    }
    const favor = gainRelicFavor(run, 1);
    return {
        run: {
            ...run,
            bonusRelicPicksNextOffer: favor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: favor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: favor.relicFavorProgress
        },
        summaryText: 'Mystery route: +1 relic Favor.'
    };
};

export const applyRouteChoiceOutcome = (run: RunState, choiceId: string): RouteChoiceOutcomeResult => {
    if (run.status !== 'levelComplete') {
        return { run, applied: false, reason: 'invalid_status' };
    }
    const choice: RouteChoice | undefined = run.lastLevelResult?.routeChoices?.find((item) => item.id === choiceId);
    if (!choice) {
        return { run, applied: false, reason: 'missing_choice' };
    }
    const pendingRouteCardPlan = createRouteCardPlan(run, choice);
    if (choice.routeType === 'safe') {
        if (run.lives < MAX_LIVES) {
            const nextRun = {
                ...run,
                lives: run.lives + 1,
                pendingRouteCardPlan,
                lastLevelResult: run.lastLevelResult
                    ? { ...run.lastLevelResult, livesRemaining: run.lives + 1 }
                    : run.lastLevelResult
            };
            return { run: withSelectedDungeonRoute(nextRun, choiceId), applied: true, routeType: choice.routeType, summaryText: 'Safe route: +1 life.' };
        }
        const guardTokens = Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1);
        return {
            run: withSelectedDungeonRoute({ ...run, pendingRouteCardPlan, stats: { ...run.stats, guardTokens } }, choiceId),
            applied: true,
            routeType: choice.routeType,
            summaryText: 'Safe route: +1 guard token.'
        };
    }
    if (choice.routeType === 'greed') {
        if (run.lives <= 1) {
            return { run, applied: false, routeType: choice.routeType, reason: 'unavailable' };
        }
        const scored = addRouteScore(run, ROUTE_GREED_SCORE_REWARD);
        const nextRun = {
            ...scored,
            lives: scored.lives - 1,
            shopGold: scored.shopGold + ROUTE_GREED_SHOP_GOLD_REWARD,
            pendingRouteCardPlan,
            lastLevelResult: scored.lastLevelResult
                ? { ...scored.lastLevelResult, livesRemaining: scored.lives - 1 }
                : scored.lastLevelResult
        };
        return {
            run: withSelectedDungeonRoute(nextRun, choiceId),
            applied: true,
            routeType: choice.routeType,
            summaryText: `Greedy route: +${ROUTE_GREED_SHOP_GOLD_REWARD} shop gold, +${ROUTE_GREED_SCORE_REWARD} score, -1 life.`
        };
    }
    const outcome = applyMysteryRouteOutcome(run);
    return {
        run: withSelectedDungeonRoute({ ...outcome.run, pendingRouteCardPlan }, choiceId),
        applied: true,
        routeType: choice.routeType,
        summaryText: outcome.summaryText
    };
};

const routeNodeKindForSideRoom = (routeType: RouteNodeType, targetFloor: number): RouteSideRoomState['nodeKind'] => {
    if (routeType === 'safe') {
        return 'rest';
    }
    if (routeType === 'greed') {
        return targetFloor % 3 === 0 ? 'shop' : 'treasure';
    }
    return targetFloor % 4 === 0 ? 'treasure' : 'event';
};

const buildBonusSideRoom = (
    run: RunState,
    routeType: RouteNodeType,
    nodeKind: RouteSideRoomState['nodeKind'],
    floor: number
): RouteSideRoomState => {
    const reward = rollBonusRewardRoom({
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion,
        floor,
        routeKind: nodeKind,
        ledger: run.bonusRewardLedger
    });
    const routeLabel = routeType === 'safe' ? 'Safe' : routeType === 'greed' ? 'Greed' : 'Mystery';
    return {
        id: `${reward.instanceId}:side`,
        kind: 'bonus_reward',
        routeType,
        nodeKind,
        floor,
        title: `${routeLabel} ${reward.label}`,
        body: reward.eligible
            ? `${reward.trigger} ${reward.discoverability}`
            : `${reward.label} is exhausted for this run.`,
        primaryLabel: reward.eligible ? `Claim ${reward.label}` : 'Continue',
        primaryDetail: reward.eligible ? reward.summaryText : (reward.unavailableReason ?? 'No reward available.'),
        skipLabel: reward.eligible ? 'Leave it' : 'Continue',
        payload: { kind: 'bonus_reward', instanceId: reward.instanceId }
    };
};

export const openRouteSideRoom = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || run.sideRoom || !run.pendingRouteCardPlan) {
        return run;
    }
    const routeType = run.pendingRouteCardPlan.routeType;
    const floor = run.pendingRouteCardPlan.targetLevel;
    const nodeKind = routeNodeKindForSideRoom(routeType, floor);

    if (routeType === 'safe' && run.lives < MAX_LIVES) {
        const services = createRestShrineServices(run);
        const service = services.find((item) => item.serviceId === 'rest_heal' && item.available);
        if (service) {
            return {
                ...run,
                sideRoom: {
                    id: `${run.runRulesVersion}:${run.runSeed}:${floor}:safe-rest`,
                    kind: 'rest_shrine',
                    routeType,
                    nodeKind,
                    floor,
                    title: 'Safe Quiet Rest',
                    body: 'The safe route opens a recovery stop before the next floor.',
                    primaryLabel: service.label,
                    primaryDetail: 'Restore 1 life without spending shop gold.',
                    skipLabel: 'Save the time',
                    payload: { kind: 'rest_heal', serviceId: service.id }
                }
            };
        }
    }

    if (routeType === 'mystery' && nodeKind === 'event') {
        const event = rollRunEventRoom({ runSeed: run.runSeed, rulesVersion: run.runRulesVersion, floor });
        const choice = event.options.find((option) => option.effect !== 'skip') ?? event.options[0]!;
        return {
            ...run,
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType,
                nodeKind,
                floor,
                title: event.title,
                body: event.body,
                primaryLabel: choice.label,
                primaryDetail: choice.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: option.id === choice.id || (index === 0 && choice.id == null)
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: choice.id }
            }
        };
    }

    return {
        ...run,
        sideRoom: buildBonusSideRoom(run, routeType, nodeKind, floor)
    };
};

export const claimRouteSideRoomPrimary = (run: RunState): RunState => {
    const eventChoiceId =
        run.sideRoom?.payload.kind === 'event_choice' ? run.sideRoom.payload.choiceId : undefined;
    const choiceId = run.sideRoom?.choices?.find((choice) => choice.primary)?.id ?? eventChoiceId;
    return choiceId ? claimRouteSideRoomChoice(run, choiceId) : claimRouteSideRoomChoice(run);
};

export const claimRouteSideRoomChoice = (run: RunState, choiceId?: string): RunState => {
    if (run.status !== 'levelComplete' || !run.sideRoom) {
        return run;
    }
    const sideRoom = run.sideRoom;
    const clearedRun = { ...run, sideRoom: null };
    if (sideRoom.payload.kind === 'rest_heal') {
        return { ...clearedRun, lives: Math.min(MAX_LIVES, clearedRun.lives + 1) };
    }
    if (sideRoom.payload.kind === 'event_choice') {
        const event = rollRunEventRoom({
            runSeed: run.runSeed,
            rulesVersion: run.runRulesVersion,
            floor: sideRoom.floor
        });
        if (event.eventKey !== sideRoom.payload.eventKey) {
            return clearedRun;
        }
        return applyRunEventChoice(clearedRun, event, choiceId ?? sideRoom.payload.choiceId).run;
    }
    const reward = rollBonusRewardRoom({
        runSeed: run.runSeed,
        rulesVersion: run.runRulesVersion,
        floor: sideRoom.floor,
        routeKind: sideRoom.nodeKind,
        ledger: run.bonusRewardLedger
    });
    if (reward.instanceId !== sideRoom.payload.instanceId) {
        return clearedRun;
    }
    const result = claimBonusReward(clearedRun, run.bonusRewardLedger, reward);
    return result.claimed ? { ...result.run, bonusRewardLedger: result.ledger } : clearedRun;
};

export const skipRouteSideRoom = (run: RunState): RunState =>
    run.sideRoom ? { ...run, sideRoom: null } : run;

export const SHOP_ITEM_CATALOG: Record<
    RunShopItemId,
    Omit<RunShopOfferState, 'id' | 'purchased' | 'compatible' | 'unavailableReason'>
> = {
    heal_life: {
        itemId: 'heal_life',
        label: 'Mend a life',
        description: 'Restore 1 life now, capped by max lives.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: MAX_LIVES
    },
    peek_charge: {
        itemId: 'peek_charge',
        label: 'Peek charge',
        description: 'Add 1 peek charge for this run.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    destroy_charge: {
        itemId: 'destroy_charge',
        label: 'Destroy charge',
        description: 'Add 1 destroy charge to the uncapped run bank.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 3,
        cost: 3,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    iron_key: {
        itemId: 'iron_key',
        label: 'Iron key',
        description: 'Adds one run-local key for locked exit doors and caches.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    master_key: {
        itemId: 'master_key',
        label: 'Master key',
        description: 'Opens any one locked exit door or cache in this run.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 5,
        cost: 5,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    }
};

export const getShopGoldRewardForFloor = (level: number): number =>
    FLOOR_CLEAR_GOLD_BASE + Math.max(0, Math.floor(level) - 1);

export const getShopRerollCostForFloor = (level: number): number =>
    1 + Math.floor(Math.max(0, Math.floor(level) - 1) / 3);

export type RunShopSource = 'floor_clear_shop' | 'board_shop';

export interface RunShopStockPlan {
    source: RunShopSource;
    level: number;
    routeType: RouteNodeType | null;
    itemIds: RunShopItemId[];
    rerollCost: number;
    previewCopy: string;
}

export interface RunShopReadModel {
    source: RunShopSource;
    level: number;
    routeType: RouteNodeType | null;
    offerCount: number;
    availableOfferCount: number;
    purchasedOfferCount: number;
    wallet: number;
    rerollCost: number;
    canReroll: boolean;
    previewCopy: string;
}

export const getRunShopStockPlan = (run: RunState): RunShopStockPlan => {
    const level = run.board?.level ?? run.stats.highestLevel;
    const source: RunShopSource = run.board?.dungeonShopTileId ? 'board_shop' : 'floor_clear_shop';
    const routeType = run.board?.routeWorldProfile?.routeType ?? run.pendingRouteCardPlan?.routeType ?? null;
    const itemIds: RunShopItemId[] = ['heal_life', 'peek_charge', 'destroy_charge', 'iron_key'];
    if (level >= 5 || source === 'board_shop') {
        itemIds.push('master_key');
    }
    const previewCopy =
        source === 'board_shop'
            ? `Board vendor: ${itemIds.length} deterministic services, reroll ${getShopRerollCostForFloor(level)} shop gold.`
            : `Floor-clear vendor: ${itemIds.length} deterministic services, reroll ${getShopRerollCostForFloor(level)} shop gold.`;
    return {
        source,
        level,
        routeType,
        itemIds,
        rerollCost: getShopRerollCostForFloor(level),
        previewCopy
    };
};

export const getShopWalletPacing = (run: RunState): {
    earnedThisFloor: number;
    totalWallet: number;
    sinkCostTotal: number;
    conversionAtRunEnd: 'unspent_shop_gold_expires';
} => {
    const level = run.board?.level ?? run.stats.highestLevel;
    return {
        earnedThisFloor: getShopGoldRewardForFloor(level),
        totalWallet: run.shopGold,
        sinkCostTotal: run.shopOffers.reduce((sum, offer) => sum + offer.cost, 0),
        conversionAtRunEnd: 'unspent_shop_gold_expires'
    };
};

export const getRunShopWalletPacing = (run: RunState): {
    earnedThisFloor: number;
    totalWallet: number;
    sinkCostTotal: number;
    conversionAtRunEnd: 'unspent_shop_gold_expires';
} => ({
    earnedThisFloor: getShopGoldRewardForFloor(run.board?.level ?? run.stats.highestLevel),
    totalWallet: run.shopGold,
    sinkCostTotal: run.shopOffers.reduce((sum, offer) => sum + offer.cost, 0),
    conversionAtRunEnd: 'unspent_shop_gold_expires'
});

const getShopOfferCompatibility = (
    run: RunState,
    itemId: RunShopItemId
): Pick<RunShopOfferState, 'compatible' | 'unavailableReason'> => {
    if (itemId === 'heal_life' && run.lives >= MAX_LIVES) {
        return { compatible: false, unavailableReason: 'Life already full.' };
    }
    return { compatible: true, unavailableReason: null };
};

export const createRunShopOffers = (run: RunState): RunShopOfferState[] => {
    const plan = getRunShopStockPlan(run);
    return plan.itemIds.map((itemId, index) => {
        const base = SHOP_ITEM_CATALOG[itemId];
        return {
            ...base,
            ...getShopOfferCompatibility(run, itemId),
            id: `${run.runRulesVersion}:${run.runSeed}:${plan.level}:shop:${run.shopRerolls}:${index}`,
            purchased: false
        };
    });
};

export const canRerollShopOffers = (run: RunState): boolean =>
    run.shopOffers.length > 0 &&
    run.shopRerolls < 1 &&
    run.shopGold >= getShopRerollCostForFloor(run.board?.level ?? run.stats.highestLevel);

export const getRunShopReadModel = (run: RunState): RunShopReadModel => {
    const plan = getRunShopStockPlan(run);
    const availableOfferCount = run.shopOffers.filter(
        (offer) => !offer.purchased && offer.compatible && run.shopGold >= offer.cost
    ).length;
    return {
        source: plan.source,
        level: plan.level,
        routeType: plan.routeType,
        offerCount: run.shopOffers.length,
        availableOfferCount,
        purchasedOfferCount: run.shopOffers.filter((offer) => offer.purchased).length,
        wallet: run.shopGold,
        rerollCost: plan.rerollCost,
        canReroll: canRerollShopOffers(run),
        previewCopy: plan.previewCopy
    };
};

export const rerollShopOffers = (run: RunState): RunState => {
    if (!canRerollShopOffers(run)) {
        return run;
    }
    const cost = getShopRerollCostForFloor(run.board?.level ?? run.stats.highestLevel);
    const nextRun = { ...run, shopGold: run.shopGold - cost, shopRerolls: run.shopRerolls + 1 };
    return { ...nextRun, shopOffers: createRunShopOffers(nextRun) };
};

export const purchaseShopOffer = (run: RunState, offerId: string): RunState => {
    const offer = run.shopOffers.find((item) => item.id === offerId);
    if (!offer || offer.purchased || !offer.compatible || run.shopGold < offer.cost) {
        return run;
    }

    let next: RunState = {
        ...run,
        shopGold: run.shopGold - offer.cost,
        shopOffers: run.shopOffers.map((item) => (item.id === offerId ? { ...item, purchased: true } : item))
    };

    switch (offer.itemId) {
        case 'heal_life':
            next = { ...next, lives: Math.min(MAX_LIVES, next.lives + 1) };
            break;
        case 'peek_charge':
            next = { ...next, peekCharges: next.peekCharges + 1 };
            break;
        case 'destroy_charge':
            next = { ...next, destroyPairCharges: next.destroyPairCharges + 1 };
            break;
        case 'iron_key':
            next = {
                ...next,
                dungeonKeys: { ...next.dungeonKeys, iron: (next.dungeonKeys.iron ?? 0) + 1 }
            };
            break;
        case 'master_key':
            next = { ...next, dungeonMasterKeys: next.dungeonMasterKeys + 1 };
            break;
        default:
            break;
    }

    return next;
};

const getSymbolSetForLevel = (level: number): readonly SymbolEntry[] => getSymbolSetForLevelFromCatalog(level);

export const getMemorizeDuration = (level: number): number => {
    const decaySteps = Math.floor(Math.max(level - 1, 0) / MEMORIZE_DECAY_EVERY_N_LEVELS);
    return Math.max(MEMORIZE_MIN_MS, MEMORIZE_BASE_MS - MEMORIZE_STEP_MS * decaySteps);
};

export const getMemorizeDurationForRun = (run: RunState, level: number): number => {
    let ms = getMemorizeDuration(level);
    if (hasMutator(run, 'short_memorize')) {
        ms = Math.max(MEMORIZE_MIN_MS, ms - 350);
    }
    if (run.relicIds.includes('memorize_bonus_ms')) {
        ms += 280;
    }
    if (run.relicIds.includes('memorize_under_short_memorize') && hasMutator(run, 'short_memorize')) {
        ms += 220;
    }
    if (run.gameMode === 'meditation') {
        ms = Math.floor(ms * 1.55);
    }
    return ms;
};

export const calculateRating = (tries: number): Rating => {
    if (tries === 0) return 'S++';
    if (tries === 1) return 'S';
    if (tries === 2) return 'A';
    if (tries <= 4) return 'B';
    if (tries <= 6) return 'C';
    if (tries <= 8) return 'D';
    return 'F';
};

export const calculateMatchScore = (
    level: number,
    currentStreak: number,
    multiplier: number = 1
): number =>
    Math.floor((20 + 5 * Math.max(level - 1, 0) + 10 * Math.max(currentStreak, 0)) * multiplier);

const isWildPairKey = (pairKey: string): boolean => pairKey === WILD_PAIR_KEY;

/** Exported for UI resolving highlights (gambit 3-flip) — keep in sync with `resolveGambitThree`. */
export const tilesArePairMatch = (a: Tile, b: Tile): boolean => {
    if (a.pairKey === b.pairKey && a.pairKey !== DECOY_PAIR_KEY) {
        return true;
    }
    if (a.pairKey === DECOY_PAIR_KEY || b.pairKey === DECOY_PAIR_KEY) {
        return false;
    }
    if (isWildPairKey(a.pairKey) && !isWildPairKey(b.pairKey)) {
        return true;
    }
    if (isWildPairKey(b.pairKey) && !isWildPairKey(a.pairKey)) {
        return true;
    }
    return false;
};

const atomicVariantForPairKey = (pairKey: string): number => {
    let h = 0;
    for (let i = 0; i < pairKey.length; i++) {
        h = (h * 31 + pairKey.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 8;
};

/** Effective delay after two tiles are flipped (0 if immediate match). */
export const computeFlipResolveDelayMs = (
    run: RunState,
    flippedTileIds: string[],
    opts: { resolveDelayMultiplier: number; echoFeedbackEnabled: boolean }
): number => {
    if (flippedTileIds.length !== 2 || !run.board) {
        return 0;
    }
    const [firstId, secondId] = flippedTileIds;
    const firstTile = run.board.tiles.find((t) => t.id === firstId);
    const secondTile = run.board.tiles.find((t) => t.id === secondId);
    if (!firstTile || !secondTile) {
        return 0;
    }
    if (tilesArePairMatch(firstTile, secondTile)) {
        return 0;
    }
    let ms = MATCH_DELAY_MS * opts.resolveDelayMultiplier;
    if (opts.echoFeedbackEnabled) {
        ms += ECHO_EXTRA_RESOLVE_MS;
    }
    return ms;
};

export const calculateLevelClearBonus = (level: number): number => 50 * level;

export const calculatePerfectClearBonus = (): number => 25;

const getClearLifeReason = (tries: number): ClearLifeReason => {
    if (tries === 0) return 'perfect';
    if (tries === 1) return 'clean';
    return 'none';
};

const ROUTE_GREED_SHOP_GOLD_REWARD = 3;
const ROUTE_GREED_SCORE_REWARD = 35;
const ROUTE_MYSTERY_SHOP_GOLD_REWARD = 2;
const ROUTE_CARD_GREED_SHOP_GOLD_REWARD = 2;
const ROUTE_CARD_GREED_SCORE_REWARD = 25;
const ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD = 2;
const DUNGEON_TRAP_SCORE_PENALTY = 10;
const DUNGEON_HEX_TRAP_SCORE_PENALTY = 20;
const DUNGEON_TRAP_DISARM_SCORE_REWARD = 10;
const DUNGEON_TRAP_DISARM_GOLD_REWARD = 1;
const DUNGEON_MIMIC_DISARM_SCORE_REWARD = 20;
const DUNGEON_MIMIC_DISARM_GOLD_REWARD = 2;
const DUNGEON_TREASURE_GOLD_REWARD = 2;
const DUNGEON_TREASURE_SCORE_REWARD = 20;
const DUNGEON_TREASURE_CACHE_GOLD_REWARD = 3;
const DUNGEON_TREASURE_CACHE_SCORE_REWARD = 35;
const DUNGEON_LOCK_SCORE_REWARD = 35;
const DUNGEON_ENEMY_DEFEAT_SCORE = 30;
const DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD = 4;
const DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD = 50;
const DUNGEON_KEY_CACHE_SCORE_REWARD = 15;
const DUNGEON_OMEN_ARCHIVE_SCORE_REWARD = 15;
const DUNGEON_BOSS_DEFEAT_SCORE = 70;
const DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD = 90;
const DUNGEON_OBJECTIVE_SCORE_REWARD = 35;
const DUNGEON_OBJECTIVE_FAVOR_REWARD = 1;
type MysteryRouteOutcome = 'shop_gold' | 'combo_shard' | 'relic_favor';
type MysteryRouteCardOutcome = 'shop_gold' | 'combo_shard' | 'relic_favor';

export type DungeonBossLifecycleSource = 'boss_card_pair' | 'moving_patrol' | 'none';
export type DungeonBossPhase = 'unseen' | 'opening' | 'bloodied' | 'defeated';

export interface DungeonBossRewardHook {
    score: number;
    shopGold: number;
    guardTokens: number;
    comboShards: number;
    relicFavor: number;
    enemiesDefeated: number;
    treasuresOpened: number;
}

export interface DungeonBossDefinition {
    id: DungeonBossId;
    label: string;
    symbol: string;
    hp: number;
    hazardKind: EnemyHazardKind;
    hazardPattern: EnemyHazardPattern;
    signatureModifier: string;
    rewardHook: string;
    cardCopy: string;
    visualAudioPlaceholders: string[];
    reward: DungeonBossRewardHook;
}

export const DUNGEON_BOSS_DEFINITIONS: Record<DungeonBossId, DungeonBossDefinition> = {
    trap_warden: {
        id: 'trap_warden',
        label: 'Trap Warden',
        symbol: 'W',
        hp: 3,
        hazardKind: 'warden',
        hazardPattern: 'guard',
        signatureModifier: 'Guard pattern prioritizes traps, locks, keys, levers, and reward-adjacent pressure.',
        rewardHook: 'Defeat grants guard, score, and Favor.',
        cardCopy: 'Defeat it for score, guard, and Favor.',
        visualAudioPlaceholders: ['trap chain tell', 'warding shield hit flash', 'boss defeat lockbreak stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 0,
            guardTokens: 1,
            comboShards: 0,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    },
    rush_sentinel: {
        id: 'rush_sentinel',
        label: 'Rush Sentinel',
        symbol: 'S',
        hp: 3,
        hazardKind: 'sentinel',
        hazardPattern: 'patrol',
        signatureModifier: 'Patrol pattern rotates pressure across active non-utility cards.',
        rewardHook: 'Defeat grants a combo shard, bonus score, and Favor.',
        cardCopy: 'Defeat it for score, a combo shard, and Favor.',
        visualAudioPlaceholders: ['rush windup tell', 'dash lane afterimage', 'combo shard defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE + 10,
            shopGold: 0,
            guardTokens: 0,
            comboShards: 1,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    },
    treasure_keeper: {
        id: 'treasure_keeper',
        label: 'Treasure Keeper',
        symbol: 'K',
        hp: 3,
        hazardKind: 'warden',
        hazardPattern: 'guard',
        signatureModifier: 'Guard pattern favors treasure, key, lever, and lock cards.',
        rewardHook: 'Defeat grants shop gold, treasure progress, score, and Favor.',
        cardCopy: 'Defeat it for score, shop gold, and Favor.',
        visualAudioPlaceholders: ['coin guard tell', 'cache glint hit flash', 'treasure spill defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 4,
            guardTokens: 0,
            comboShards: 0,
            relicFavor: 1,
            enemiesDefeated: 1,
            treasuresOpened: 1
        }
    },
    spire_observer: {
        id: 'spire_observer',
        label: 'Spire Observer',
        symbol: 'O',
        hp: 3,
        hazardKind: 'observer',
        hazardPattern: 'observe',
        signatureModifier: 'Observe pattern prioritizes boss, enemy, and trap encounter cards.',
        rewardHook: 'Defeat grants extra Favor and score.',
        cardCopy: 'Defeat it for extra Favor.',
        visualAudioPlaceholders: ['spire gaze tell', 'observation pulse hit flash', 'favor chime defeat stinger'],
        reward: {
            score: DUNGEON_BOSS_DEFEAT_SCORE,
            shopGold: 0,
            guardTokens: 0,
            comboShards: 0,
            relicFavor: 2,
            enemiesDefeated: 1,
            treasuresOpened: 0
        }
    }
};

export const getDungeonBossDefinition = (bossId: DungeonBossId | null | undefined): DungeonBossDefinition | null =>
    bossId ? DUNGEON_BOSS_DEFINITIONS[bossId] : null;

export interface DungeonEliteEncounterRules {
    nodeKind: 'elite';
    label: string;
    objectiveId: 'pacify_floor';
    threatBudgetFloor: number;
    rewardBudgetFloor: number;
    movingPatrolFloor: number;
    ruleHook: string;
    rewardHook: string;
    completionCopy: string;
    scoreRule: string;
}

export const DUNGEON_ELITE_ENCOUNTER_RULES: DungeonEliteEncounterRules = {
    nodeKind: 'elite',
    label: 'Elite memory',
    objectiveId: 'pacify_floor',
    threatBudgetFloor: 2,
    rewardBudgetFloor: 1,
    movingPatrolFloor: 1,
    ruleHook: 'Elite nodes force rush-recall enemy pressure with at least one elite enemy pair and a moving patrol.',
    rewardHook: 'Elite boards add a small reward budget and route elite anchors without boss score or boss Favor rules.',
    completionCopy: 'Elite pacified. Claim the premium route reward without applying boss-floor scoring.',
    scoreRule: 'Uses normal floor scoring; no boss multiplier.'
};

export const getDungeonEliteEncounterRules = (
    nodeKind: DungeonRunNodeKind | null | undefined
): DungeonEliteEncounterRules | null => (nodeKind === 'elite' ? DUNGEON_ELITE_ENCOUNTER_RULES : null);

export type DungeonRoomEffectId = Extract<DungeonCardEffectId, `room_${string}`>;
export type DungeonRoomTrigger = 'reveal' | 'reveal_or_reuse';
export type DungeonRoomResolvedState = 'one_shot_resolved' | 'reusable_revealed' | 'key_gated_until_paid';

export interface DungeonRoomEffectDefinition {
    effectId: DungeonRoomEffectId;
    label: string;
    trigger: DungeonRoomTrigger;
    costText: string;
    rewardText: string;
    resolvedState: DungeonRoomResolvedState;
    blockedText: string | null;
}

export interface DungeonRoomReadModel {
    effectId: DungeonRoomEffectId;
    label: string;
    trigger: DungeonRoomTrigger;
    costText: string;
    rewardText: string;
    resolvedState: DungeonRoomResolvedState;
    used: boolean;
    canUse: boolean;
    blockedText: string | null;
    copy: string;
}

export const DUNGEON_ROOM_EFFECT_DEFINITIONS: Record<DungeonRoomEffectId, DungeonRoomEffectDefinition> = {
    room_campfire: {
        effectId: 'room_campfire',
        label: 'Campfire',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Restores 1 life, or grants score if already at full life.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_fountain: {
        effectId: 'room_fountain',
        label: 'Fountain',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants 1 guard token up to the guard cap.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_map: {
        effectId: 'room_map',
        label: 'Map Room',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Reveals hidden utility card families on this floor without solving exact pairs.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_forge: {
        effectId: 'room_forge',
        label: 'Forge',
        trigger: 'reveal_or_reuse',
        costText: 'Costs 2 shop gold.',
        rewardText: 'Adds 1 destroy-pair charge to the uncapped bank.',
        resolvedState: 'reusable_revealed',
        blockedText: 'Needs 2 shop gold.'
    },
    room_shrine: {
        effectId: 'room_shrine',
        label: 'Shrine Room',
        trigger: 'reveal',
        costText: 'Spends 1 shop gold when available.',
        rewardText: 'Grants guard when paid, otherwise grants score.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_scrying_lens: {
        effectId: 'room_scrying_lens',
        label: 'Scrying Lens',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Reveals one hidden dungeon card family clue without granting match score.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_armory: {
        effectId: 'room_armory',
        label: 'Armory',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Adds 1 destroy-pair charge to the uncapped bank.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_locked_cache: {
        effectId: 'room_locked_cache',
        label: 'Locked Cache Room',
        trigger: 'reveal_or_reuse',
        costText: 'Requires an iron key or master key.',
        rewardText: 'Spends the key for shop gold and score; without a key it stays revealed until paid.',
        resolvedState: 'key_gated_until_paid',
        blockedText: 'Needs an iron key or master key.'
    },
    room_key_cache: {
        effectId: 'room_key_cache',
        label: 'Key Cache',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants an iron key and score.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_trap_workshop: {
        effectId: 'room_trap_workshop',
        label: 'Trap Workshop',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Resolves one armed trap pair, or reveals one hidden trap family clue.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    },
    room_omen_archive: {
        effectId: 'room_omen_archive',
        label: 'Omen Archive',
        trigger: 'reveal',
        costText: 'No cost.',
        rewardText: 'Grants Favor, score, and reveals one hidden dungeon pair.',
        resolvedState: 'one_shot_resolved',
        blockedText: null
    }
};

const isDungeonRoomEffectId = (effectId: DungeonCardEffectId | null | undefined): effectId is DungeonRoomEffectId =>
    Boolean(effectId && effectId in DUNGEON_ROOM_EFFECT_DEFINITIONS);

export const getDungeonRoomEffectDefinition = (
    effectId: DungeonCardEffectId | null | undefined
): DungeonRoomEffectDefinition | null => (isDungeonRoomEffectId(effectId) ? DUNGEON_ROOM_EFFECT_DEFINITIONS[effectId] : null);

export const getDungeonRoomReadModel = (
    tile: Tile,
    run?: RunState | null
): DungeonRoomReadModel | null => {
    if (tile.dungeonCardKind !== 'room') {
        return null;
    }
    const definition = getDungeonRoomEffectDefinition(tile.dungeonCardEffectId);
    if (!definition) {
        return null;
    }
    const used = tile.dungeonRoomUsed === true || tile.dungeonCardState === 'resolved';
    const hasIronKey = (run?.dungeonKeys.iron ?? 0) > 0;
    const hasMasterKey = (run?.dungeonMasterKeys ?? 0) > 0;
    const forgeCanPay = (run?.shopGold ?? 0) >= 2;
    const canUse =
        definition.effectId === 'room_forge'
            ? forgeCanPay
            : definition.effectId === 'room_locked_cache'
              ? hasIronKey || hasMasterKey
              : !used;
    const blockedText = canUse ? null : used ? 'Room already used.' : definition.blockedText;
    const stateCopy =
        definition.resolvedState === 'reusable_revealed'
            ? 'Reusable room.'
            : definition.resolvedState === 'key_gated_until_paid'
              ? used
                  ? 'Resolved after key spend.'
                  : 'Reveals first and stays available until paid.'
              : 'Resolves after one use.';

    return {
        effectId: definition.effectId,
        label: definition.label,
        trigger: definition.trigger,
        costText: definition.costText,
        rewardText: definition.rewardText,
        resolvedState: definition.resolvedState,
        used,
        canUse,
        blockedText,
        copy: `Dungeon room: ${tile.label}. ${definition.rewardText} ${definition.costText} ${stateCopy}${
            blockedText ? ` ${blockedText}` : ''
        }`
    };
};

export type DungeonTreasureRewardId =
    | 'treasure_gold'
    | 'treasure_cache'
    | 'treasure_shard'
    | 'lock_cache'
    | 'room_locked_cache'
    | 'secret_door';
export type DungeonTreasureTier = 'minor' | 'standard' | 'cache' | 'secret';

export interface DungeonTreasureRewardDefinition {
    rewardId: DungeonTreasureRewardId;
    label: string;
    tier: DungeonTreasureTier;
    gateText: string;
    payoutText: string;
    claimCondition: string;
}

export interface DungeonTreasureReadModel extends DungeonTreasureRewardDefinition {
    source: 'dungeon_card' | 'room' | 'route_special';
    available: boolean;
    copy: string;
}

export const DUNGEON_TREASURE_REWARD_DEFINITIONS: Record<DungeonTreasureRewardId, DungeonTreasureRewardDefinition> = {
    treasure_gold: {
        rewardId: 'treasure_gold',
        label: 'Treasure',
        tier: 'standard',
        gateText: 'Ungated.',
        payoutText: 'Pays shop gold and score.',
        claimCondition: 'Match the treasure pair.'
    },
    treasure_cache: {
        rewardId: 'treasure_cache',
        label: 'Treasure Cache',
        tier: 'cache',
        gateText: 'Ungated, but weighted toward treasure floors.',
        payoutText: 'Pays increased shop gold and score.',
        claimCondition: 'Match the cache pair.'
    },
    treasure_shard: {
        rewardId: 'treasure_shard',
        label: 'Supply Cache',
        tier: 'minor',
        gateText: 'Ungated supply reward.',
        payoutText: 'Pays a small shop gold and score reward.',
        claimCondition: 'Match the supply pair.'
    },
    lock_cache: {
        rewardId: 'lock_cache',
        label: 'Locked Cache',
        tier: 'cache',
        gateText: 'Can spend an iron/master key for full value.',
        payoutText: 'Pays cache score and treasure progress, or a small consolation when matched.',
        claimCondition: 'Spend a key on activation or match the lock pair.'
    },
    room_locked_cache: {
        rewardId: 'room_locked_cache',
        label: 'Locked Cache Room',
        tier: 'cache',
        gateText: 'Requires an iron key or master key.',
        payoutText: 'Pays shop gold and score.',
        claimCondition: 'Reveal the room, then reopen it after finding a key.'
    },
    secret_door: {
        rewardId: 'secret_door',
        label: 'Secret Door',
        tier: 'secret',
        gateText: 'Mystery route special; revealed by peek/scout pressure.',
        payoutText: 'Pays relic Favor progress.',
        claimCondition: 'Reveal or remember the secret pair, then match it.'
    }
};

const treasureRewardIdForTile = (tile: Tile): DungeonTreasureRewardId | null => {
    if (tile.routeSpecialKind === 'secret_door') return 'secret_door';
    if (tile.dungeonCardEffectId === 'treasure_gold') return 'treasure_gold';
    if (tile.dungeonCardEffectId === 'treasure_cache') return 'treasure_cache';
    if (tile.dungeonCardEffectId === 'treasure_shard') return 'treasure_shard';
    if (tile.dungeonCardEffectId === 'lock_cache') return 'lock_cache';
    if (tile.dungeonCardEffectId === 'room_locked_cache') return 'room_locked_cache';
    return null;
};

export const getDungeonTreasureRewardDefinition = (
    rewardId: DungeonTreasureRewardId
): DungeonTreasureRewardDefinition => DUNGEON_TREASURE_REWARD_DEFINITIONS[rewardId];

export const getDungeonTreasureReadModel = (tile: Tile): DungeonTreasureReadModel | null => {
    const rewardId = treasureRewardIdForTile(tile);
    if (!rewardId) {
        return null;
    }
    const definition = getDungeonTreasureRewardDefinition(rewardId);
    const source =
        tile.routeSpecialKind === 'secret_door'
            ? 'route_special'
            : tile.dungeonCardKind === 'room'
              ? 'room'
              : 'dungeon_card';
    const available = tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardState !== 'resolved';
    return {
        ...definition,
        source,
        available,
        copy: `${definition.label}: ${definition.payoutText} ${definition.gateText} ${definition.claimCondition}`
    };
};

const createRouteCardPlanForRoute = (
    run: RunState,
    routeType: RouteNodeType,
    choiceId: string
): RouteCardPlan => {
    const sourceLevel = run.lastLevelResult?.level ?? run.board?.level ?? run.stats.highestLevel;
    return {
        choiceId,
        routeType,
        sourceLevel,
        targetLevel: sourceLevel + 1
    };
};

const createRouteCardPlan = (run: RunState, choice: RouteChoice): RouteCardPlan =>
    createRouteCardPlanForRoute(run, choice.routeType, choice.id);

const loadedGatewayRouteTypeFor = (run: RunState, pairKey: string): RouteNodeType => {
    const seed = hashStringToSeed(
        `loadedGateway:${run.runRulesVersion}:${run.runSeed}:${run.board?.level ?? run.stats.highestLevel}:${pairKey}`
    );
    return Math.abs(seed) % 2 === 0 ? 'mystery' : 'greed';
};

const hasFirstMismatchGrace = (run: RunState, board: BoardState): boolean =>
    run.stats.tries === 0 && (board.level === 1 || (run.stats.guardTokens === 0 && run.lives >= 2));

const applyComboShardGain = (
    comboShards: number,
    lives: number,
    shardGain: number,
    allowLifeGain: boolean = true
): { comboShards: number; lifeGain: number } => {
    if (shardGain <= 0) {
        return { comboShards, lifeGain: 0 };
    }

    const nextComboShards = comboShards + shardGain;

    if (allowLifeGain && lives < MAX_LIVES && nextComboShards >= COMBO_SHARDS_PER_LIFE) {
        return {
            comboShards: nextComboShards - COMBO_SHARDS_PER_LIFE,
            lifeGain: 1
        };
    }

    return {
        comboShards: Math.min(MAX_COMBO_SHARDS, nextComboShards),
        lifeGain: 0
    };
};

const clearDungeonCardFields = (tile: Tile): Tile => ({
    ...tile,
    dungeonCardKind: undefined,
    dungeonBossId: undefined,
    dungeonCardState: undefined,
    dungeonCardEffectId: undefined,
    dungeonCardHp: undefined,
    dungeonCardMaxHp: undefined,
    dungeonRouteType: undefined,
    lanternScouted: undefined,
    scoutRevealSource: undefined
});

const activeDungeonEnemyPairKeys = (board: BoardState): string[] => [
    ...new Set(
        board.tiles
            .filter(
                (tile) =>
                    tile.dungeonCardKind === 'enemy' &&
                    tile.dungeonCardState === 'revealed' &&
                    tile.state !== 'matched' &&
                    tile.state !== 'removed' &&
                    (tile.dungeonCardHp ?? 0) > 0
            )
            .map((tile) => tile.pairKey)
    )
];

const damageFirstActiveDungeonEnemy = (
    board: BoardState,
    amount: number
): { board: BoardState; defeated: number; score: number } => {
    if (amount <= 0) {
        return { board, defeated: 0, score: 0 };
    }
    const pairKey = activeDungeonEnemyPairKeys(board)[0];
    if (!pairKey) {
        return { board, defeated: 0, score: 0 };
    }
    const currentHp =
        board.tiles.find((tile) => tile.pairKey === pairKey && tile.dungeonCardKind === 'enemy')?.dungeonCardHp ?? 1;
    const nextHp = Math.max(0, currentHp - amount);
    const defeated = currentHp > 0 && nextHp === 0 ? 1 : 0;
    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) =>
                tile.pairKey === pairKey && tile.dungeonCardKind === 'enemy'
                    ? defeated
                        ? clearDungeonCardFields({
                              ...tile,
                              state: 'removed',
                              dungeonCardHp: nextHp,
                              dungeonCardState: 'resolved'
                          })
                        : {
                              ...tile,
                              dungeonCardHp: nextHp,
                              dungeonCardState: 'revealed'
                          }
                    : tile
            )
        },
        defeated,
        score: defeated ? DUNGEON_ENEMY_DEFEAT_SCORE : 0
    };
};

const applyDungeonEnemyAttack = (
    lives: number,
    guardTokens: number,
    activeBoard: BoardState
): { lives: number; guardTokens: number; attacked: boolean } => {
    if (activeDungeonEnemyPairKeys(activeBoard).length === 0) {
        return { lives, guardTokens, attacked: false };
    }
    if (guardTokens > 0) {
        return { lives, guardTokens: guardTokens - 1, attacked: true };
    }
    return { lives: lives - 1, guardTokens, attacked: true };
};

const revealOneHiddenDungeonHazardPair = (tiles: readonly Tile[]): Set<string> => {
    const target = tiles.find(
        (tile) =>
            (tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap') &&
            tile.dungeonCardState === 'hidden' &&
            tile.state !== 'matched' &&
            tile.state !== 'removed'
    );
    if (!target) {
        return new Set();
    }
    return new Set(
        tiles
            .filter(
                (tile) =>
                    tile.pairKey === target.pairKey &&
                    tile.dungeonCardKind === target.dungeonCardKind &&
                    tile.dungeonCardState === 'hidden'
            )
            .map((tile) => tile.id)
    );
};

const tileIsUnresolved = (tile: Tile): boolean => tile.state !== 'matched' && tile.state !== 'removed';

type ScoutRevealSource = 'lantern_ward' | 'omen_seal';
type ScoutTargetKind = 'dungeon' | 'route' | 'hazard';

const tileAlreadyScouted = (tile: Tile): boolean => tile.scoutRevealSource != null || tile.lanternScouted === true;

const chooseScoutPairKey = (
    board: BoardState,
    run: RunState,
    source: ScoutRevealSource
): { pairKey: string; kind: ScoutTargetKind } | null => {
    const dungeonKeys = [
        ...new Set(
            board.tiles
                .filter(
                    (tile) =>
                        (tile.dungeonCardKind === 'trap' || tile.dungeonCardKind === 'enemy') &&
                        tile.dungeonCardState === 'hidden' &&
                        !tileAlreadyScouted(tile) &&
                        tileIsUnresolved(tile)
                )
                .map((tile) => tile.pairKey)
        )
    ];
    const routeKeys = [
        ...new Set(
            board.tiles
                .filter(
                    (tile) =>
                        (tile.routeSpecialKind === 'mystery_veil' ||
                            tile.routeSpecialKind === 'secret_door' ||
                            tile.routeSpecialKind === 'omen_seal' ||
                            tile.routeSpecialKind === 'mimic_cache' ||
                            tile.routeSpecialKind === 'loaded_gateway' ||
                            tile.routeSpecialKind === 'parasite_vessel') &&
                        tile.routeSpecialRevealed !== true &&
                        tileIsUnresolved(tile)
                )
                .map((tile) => tile.pairKey)
        )
    ];
    const hazardKeys = [
        ...new Set(
            board.tiles
                .filter((tile) => tile.tileHazardKind != null && !tileAlreadyScouted(tile) && tileIsUnresolved(tile))
                .map((tile) => tile.pairKey)
        )
    ];
    const pick = (keys: readonly string[]): string | null => {
        if (keys.length === 0) {
            return null;
        }
        const rng = createMulberry32(
            hashStringToSeed(
                `${source}Scout:${run.runRulesVersion}:${run.runSeed}:${board.level}:${
                    source === 'lantern_ward' ? run.lanternWardScoutsThisFloor : run.omenSealScoutsThisFloor
                }`
            )
        );
        return shuffleWithRng(() => rng(), [...keys].sort())[0] ?? null;
    };
    const priority: readonly ScoutTargetKind[] =
        source === 'omen_seal' ? ['hazard', 'dungeon', 'route'] : ['dungeon', 'route', 'hazard'];
    for (const kind of priority) {
        const key = pick(kind === 'dungeon' ? dungeonKeys : kind === 'route' ? routeKeys : hazardKeys);
        if (key) return { pairKey: key, kind };
    }
    return null;
};

const applyScoutReveal = (
    board: BoardState,
    run: RunState,
    source: ScoutRevealSource
): { board: BoardState; scouted: boolean } => {
    const target = chooseScoutPairKey(board, run, source);
    if (!target) {
        return { board, scouted: false };
    }
    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) => {
                if (tile.pairKey !== target.pairKey) {
                    return tile;
                }
                if (target.kind === 'dungeon' && (tile.dungeonCardKind === 'trap' || tile.dungeonCardKind === 'enemy')) {
                    return {
                        ...tile,
                        dungeonCardState: 'revealed' as const,
                        lanternScouted: source === 'lantern_ward' ? true : tile.lanternScouted,
                        scoutRevealSource: source
                    };
                }
                if (target.kind === 'route') {
                    return { ...tile, routeSpecialRevealed: true, routeSpecialRevealSource: source };
                }
                if (target.kind === 'hazard' && tile.tileHazardKind != null) {
                    return {
                        ...tile,
                        lanternScouted: source === 'lantern_ward' ? true : tile.lanternScouted,
                        scoutRevealSource: source
                    };
                }
                return tile;
            })
        },
        scouted: true
    };
};

const applyLanternWardScout = (board: BoardState, run: RunState): { board: BoardState; scouted: boolean } =>
    applyScoutReveal(board, run, 'lantern_ward');

const applyOmenSealScout = (board: BoardState, run: RunState): { board: BoardState; scouted: boolean } =>
    applyScoutReveal(board, run, 'omen_seal');

const applyFindableScoutGlint = (
    board: BoardState,
    run: RunState,
    claimedKind: FindableKind | null
): { board: BoardState; scouted: boolean } =>
    claimedKind === 'scout_glint' ? applyScoutReveal(board, run, 'omen_seal') : { board, scouted: false };

const springArmedDungeonTraps = (
    run: RunState,
    board: BoardState,
    trappedPairKeys: readonly string[]
): { run: RunState; board: BoardState; alarmTriggered: boolean; enemyWoken: boolean } => {
    const keys = [...new Set(trappedPairKeys)];
    if (keys.length === 0) {
        return { run, board, alarmTriggered: false, enemyWoken: false };
    }
    let lives = run.lives;
    let guardTokens = run.stats.guardTokens;
    let shopGold = run.shopGold;
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
            dungeonTrapsTriggered: run.dungeonTrapsTriggered + triggered,
            dungeonTrapsResolvedThisFloor: (run.dungeonTrapsResolvedThisFloor ?? 0) + triggered,
            stats: {
                ...run.stats,
                totalScore: Math.max(0, run.stats.totalScore - scorePenalty),
                currentLevelScore: Math.max(0, run.stats.currentLevelScore - scorePenalty),
                guardTokens
            }
        },
        board: nextBoard,
        alarmTriggered,
        enemyWoken
    };
};

const isSprungTrapTile = (tile: Tile): boolean =>
    tile.dungeonCardKind === 'trap' &&
    tile.dungeonCardState === 'resolved' &&
    tile.state !== 'matched' &&
    tile.state !== 'removed';

const hiddenUnlessSprungTrap = (tile: Tile): Tile =>
    isSprungTrapTile(tile) ? { ...tile, state: 'flipped' as const } : { ...tile, state: 'hidden' as const };

const revealDungeonCardPair = (run: RunState, tile: Tile): RunState => {
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

const resolveOneArmedTrapPair = (board: BoardState): BoardState => {
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

const createSessionStats = (bestScore: number): SessionStats => ({
    totalScore: 0,
    currentLevelScore: 0,
    bestScore,
    tries: 0,
    rating: calculateRating(0),
    levelsCleared: 0,
    matchesFound: 0,
    mismatches: 0,
    highestLevel: 1,
    currentStreak: 0,
    bestStreak: 0,
    perfectClears: 0,
    guardTokens: 0,
    comboShards: 0,
    shufflesUsed: 0,
    pairsDestroyed: 0
});

export interface BuildBoardOptions {
    runSeed?: number;
    runRulesVersion?: number;
    activeMutators?: MutatorId[];
    /** Puzzle mode: skip RNG; copy these tiles as-is. */
    fixedTiles?: Tile[] | null;
    /** `enhance` preserves legacy dungeon additions; `exact` copies fixed tiles without encounter layers. */
    fixedTilesMode?: 'enhance' | 'exact';
    /** H4: include one wild tile that pairs with any real symbol. */
    includeWildTile?: boolean;
    floorTag?: FloorTag;
    floorArchetypeId?: FloorArchetypeId | null;
    featuredObjectiveId?: FeaturedObjectiveId | null;
    cycleFloor?: number | null;
    routeCardPlan?: RouteCardPlan | null;
    routeWorldProfile?: RouteWorldProfile | null;
    dungeonNodeKind?: DungeonRunNodeKind | null;
    gameMode?: GameMode;
    suppressFindables?: boolean;
}

export interface DungeonEncounterContext {
    nodeKind: DungeonRunNodeKind | null;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    pairCountDelta: number;
}

const floorTagForDungeonNode = (kind: DungeonRunNodeKind | null | undefined, fallback: FloorTag): FloorTag => {
    if (kind === 'boss') {
        return 'boss';
    }
    if (kind === 'rest' || kind === 'shop') {
        return 'breather';
    }
    return fallback;
};

const floorArchetypeForDungeonNode = (
    kind: DungeonRunNodeKind | null | undefined,
    fallback: FloorArchetypeId | null
): FloorArchetypeId | null => {
    if (kind === 'treasure') {
        return 'treasure_gallery';
    }
    if (kind === 'trap') {
        return 'trap_hall';
    }
    if (kind === 'event') {
        return 'script_room';
    }
    if (kind === 'elite') {
        return 'rush_recall';
    }
    if (kind === 'rest' || kind === 'shop') {
        return 'breather';
    }
    return fallback;
};

const createDungeonEncounterContext = (
    nodeKind: DungeonRunNodeKind | null | undefined,
    fallbackFloorTag: FloorTag,
    fallbackFloorArchetypeId: FloorArchetypeId | null
): DungeonEncounterContext => {
    const normalizedKind = nodeKind ?? null;
    const pairCountDelta =
        normalizedKind === 'elite' || normalizedKind === 'trap' || normalizedKind === 'boss'
            ? 1
            : normalizedKind === 'rest' || normalizedKind === 'shop'
              ? -1
              : normalizedKind === 'treasure' || normalizedKind === 'event'
                ? 0
                : 0;
    return {
        nodeKind: normalizedKind,
        floorTag: floorTagForDungeonNode(normalizedKind, fallbackFloorTag),
        floorArchetypeId: floorArchetypeForDungeonNode(normalizedKind, fallbackFloorArchetypeId),
        pairCountDelta
    };
};

const enemyHazardProfileForBoss = (
    bossId: DungeonBossId | null
): { kind: EnemyHazardKind; pattern: EnemyHazardPattern; label: string; hp: number } => {
    const definition = getDungeonBossDefinition(bossId) ?? DUNGEON_BOSS_DEFINITIONS.rush_sentinel;
    return {
        kind: definition.hazardKind,
        pattern: definition.hazardPattern,
        label: definition.label,
        hp: definition.hp
    };
};

const enemyHazardEligibleTiles = (tiles: readonly Tile[]): Tile[] =>
    tiles.filter(
        (tile) =>
            tile.state !== 'matched' &&
            tile.state !== 'removed' &&
            !isSingletonUtilityPairKey(tile.pairKey) &&
            tile.pairKey !== DECOY_PAIR_KEY &&
            tile.pairKey !== WILD_PAIR_KEY
    );

const unclearedRealPairKeys = (tiles: readonly Tile[]): string[] => [
    ...new Set(
        tiles
            .filter(
                (tile) =>
                    tile.state !== 'matched' &&
                    tile.state !== 'removed' &&
                    !isSingletonUtilityPairKey(tile.pairKey) &&
                    tile.pairKey !== DECOY_PAIR_KEY &&
                    tile.pairKey !== WILD_PAIR_KEY
            )
            .map((tile) => tile.pairKey)
    )
];

const defeatEnemyHazardOccupationOnFinalPair = (board: BoardState): BoardState => {
    const activeHazards = board.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
    if (activeHazards.length === 0) {
        return board;
    }
    const remainingPairKeys = unclearedRealPairKeys(board.tiles);
    if (remainingPairKeys.length !== 1) {
        return board;
    }
    const finalPairTileIds = new Set(
        board.tiles
            .filter(
                (tile) =>
                    tile.pairKey === remainingPairKeys[0] &&
                    tile.state !== 'matched' &&
                    tile.state !== 'removed'
            )
            .map((tile) => tile.id)
    );
    if (finalPairTileIds.size === 0) {
        return board;
    }
    const hazardsToClear = new Set(
        activeHazards
            .filter((hazard) => finalPairTileIds.has(hazard.currentTileId) || finalPairTileIds.has(hazard.nextTileId))
            .map((hazard) => hazard.id)
    );
    if (hazardsToClear.size === 0) {
        return board;
    }
    return {
        ...board,
        enemyHazards: board.enemyHazards?.map((hazard) =>
            hazardsToClear.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
        )
    };
};

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
    return candidates[Math.abs(turn + offset) % candidates.length]!.id;
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
        return level >= 10 ? 2 : 1;
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

const createEnemyHazardsForBoard = ({
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

const advanceEnemyHazardsOnBoard = (board: BoardState, steps: number = 1): BoardState => {
    const hazards = board.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
    if (hazards.length === 0 || steps <= 0) {
        return board;
    }
    const nextTurn = (board.enemyHazardTurn ?? 0) + steps;
    const occupied = new Set<string>();
    const nextHazards = board.enemyHazards!.map((hazard, index) => {
        if (hazard.state === 'defeated') {
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

const damageFirstRevealedEnemyHazard = (
    board: BoardState,
    amount: number
): { board: BoardState; defeated: number; bossDefeated: number; score: number } => {
    const target = board.enemyHazards?.find((hazard) => hazard.state === 'revealed' && hazard.hp > 0);
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
    const board = run.board;
    const hazard = board?.enemyHazards?.find((candidate) => candidate.currentTileId === tileId && candidate.state !== 'defeated');
    const tile = board?.tiles.find((candidate) => candidate.id === tileId) ?? null;
    if (!board || !hazard || !tile || tile.state !== 'hidden' || run.status !== 'playing') {
        return run;
    }
    const advanceHazards = options.advanceHazards ?? true;
    const consumesGuardToken = run.stats.guardTokens > 0;
    const lives = consumesGuardToken ? run.lives : Math.max(0, run.lives - hazard.damage);
    const revealedBoard: BoardState = {
        ...board,
        enemyHazards: board.enemyHazards?.map((candidate) =>
            candidate.id === hazard.id ? { ...candidate, state: 'revealed' as const } : candidate
        )
    };
    const advancedBoard = advanceHazards
        ? advanceEnemyHazardsOnBoard(revealedBoard)
        : defeatEnemyHazardOccupationOnFinalPair(revealedBoard);
    return {
        ...run,
        status: lives <= 0 ? 'gameOver' : run.status,
        lives,
        board: advancedBoard,
        enemyHazardHitsThisFloor: (run.enemyHazardHitsThisFloor ?? 0) + 1,
        stats: {
            ...run.stats,
            guardTokens: consumesGuardToken ? run.stats.guardTokens - 1 : run.stats.guardTokens
        }
    };
};

const defeatEnemyHazardsForFloorClear = (
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

const createTiles = (
    level: number,
    pairCount: number,
    runSeed: number,
    rulesVersion: number,
    mutators: MutatorId[],
    includeWildTile?: boolean
): Tile[] => {
    const rng = createMulberry32(deriveLevelTileRngSeed(runSeed, level, rulesVersion));
    const symbolSource = mutators.includes('category_letters') ? LETTER_SYMBOLS : getSymbolSetForLevel(level);
    const symbols = symbolSource.slice(0, pairCount);
    const pairs: Tile[] = symbols.flatMap((entry, index) => {
        const pairKey = `${level}-${index}`;
        const atomicVariant = atomicVariantForPairKey(pairKey);
        return [
            {
                id: `${pairKey}-A`,
                pairKey,
                state: 'hidden' as const,
                symbol: entry.symbol,
                label: entry.label,
                atomicVariant
            },
            {
                id: `${pairKey}-B`,
                pairKey,
                state: 'hidden' as const,
                symbol: entry.symbol,
                label: entry.label,
                atomicVariant
            }
        ];
    });

    if (mutators.includes('glass_floor')) {
        pairs.push({
            id: `${level}-decoy`,
            pairKey: DECOY_PAIR_KEY,
            state: 'hidden' as const,
            symbol: 'X',
            label: 'Decoy',
            atomicVariant: 0
        });
    }

    if (includeWildTile) {
        pairs.push({
            id: `${level}-wild`,
            pairKey: WILD_PAIR_KEY,
            state: 'hidden' as const,
            symbol: '★',
            label: 'Wild',
            atomicVariant: 0
        });
    }

    return shuffleWithRng(() => rng(), pairs);
};

const exitRouteTypeForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): RouteNodeType => {
    if (floorTag === 'boss' || floorArchetypeId === 'trap_hall' || floorArchetypeId === 'rush_recall') {
        return 'greed';
    }
    if (floorArchetypeId === 'treasure_gallery' || floorArchetypeId === 'spotlight_hunt' || level % 4 === 0) {
        return 'mystery';
    }
    return 'safe';
};

const primaryExitLockKindForFloor = (
    level: number,
    floorArchetypeId: FloorArchetypeId | null
): DungeonExitLockKind => {
    if (level <= 2) {
        return 'none';
    }
    if (
        floorArchetypeId === 'script_room' ||
        floorArchetypeId === 'spotlight_hunt' ||
        floorArchetypeId === 'rush_recall' ||
        level % 3 === 0
    ) {
        return 'lever';
    }
    return 'none';
};

const requiredLeverCountForFloor = (level: number, lockKind: DungeonExitLockKind): number =>
    lockKind === 'lever' ? (level >= 8 ? 2 : 1) : 0;

const dungeonObjectiveForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['objectiveId'] => {
    if (floorTag === 'boss') {
        return 'defeat_boss';
    }
    if (floorArchetypeId === 'trap_hall') {
        return 'disarm_traps';
    }
    if (floorArchetypeId === 'rush_recall') {
        return 'pacify_floor';
    }
    if (floorArchetypeId === 'treasure_gallery') {
        return 'loot_cache';
    }
    if (floorArchetypeId === 'shadow_read' || floorArchetypeId === 'script_room') {
        return 'reveal_unknowns';
    }
    if (budgetForFloor(level, floorTag, floorArchetypeId).gatewayBudget > 0) {
        return 'claim_route';
    }
    return 'find_exit';
};

const dungeonBossForFloor = (
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['bossId'] => {
    if (floorTag !== 'boss') {
        return null;
    }
    if (floorArchetypeId === 'trap_hall') {
        return 'trap_warden';
    }
    if (floorArchetypeId === 'treasure_gallery') {
        return 'treasure_keeper';
    }
    if (floorArchetypeId === 'spotlight_hunt') {
        return 'spire_observer';
    }
    return 'rush_sentinel';
};

const budgetForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): Pick<DungeonFloorBlueprint, 'threatBudget' | 'rewardBudget' | 'utilityBudget' | 'lockBudget' | 'gatewayBudget'> => {
    const boss = floorTag === 'boss';
    if (floorArchetypeId === 'treasure_gallery') {
        return { threatBudget: boss ? 2 : 1, rewardBudget: 3, utilityBudget: 2, lockBudget: level >= 4 ? 2 : 1, gatewayBudget: level >= 5 ? 1 : 0 };
    }
    if (floorArchetypeId === 'trap_hall') {
        return { threatBudget: 4, rewardBudget: 1, utilityBudget: 1, lockBudget: 1, gatewayBudget: boss ? 1 : 0 };
    }
    if (floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read') {
        return { threatBudget: 1, rewardBudget: 1, utilityBudget: 2, lockBudget: level >= 4 ? 1 : 0, gatewayBudget: 1 };
    }
    if (floorArchetypeId === 'breather' || floorTag === 'breather') {
        return { threatBudget: 0, rewardBudget: 2, utilityBudget: 2, lockBudget: 0, gatewayBudget: 0 };
    }
    if (boss) {
        return { threatBudget: 2, rewardBudget: 1, utilityBudget: 1, lockBudget: 1, gatewayBudget: 1 };
    }
    return {
        threatBudget: level >= 2 ? 1 : 0,
        rewardBudget: level % 3 === 0 ? 1 : 0,
        utilityBudget: level >= 2 ? 1 : 0,
        lockBudget: level >= 4 ? 1 : 0,
        gatewayBudget: level >= 5 && level % 5 === 0 ? 1 : 0
    };
};

const exitSpecsForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null
): DungeonFloorBlueprint['exitSpecs'] => {
    const routeType = exitRouteTypeForFloor(level, floorTag, floorArchetypeId);
    const lockKind = primaryExitLockKindForFloor(level, floorArchetypeId);
    const requiredLeverCount = requiredLeverCountForFloor(level, lockKind);
    const effectId: DungeonCardEffectId =
        floorTag === 'boss'
            ? 'exit_boss'
            : routeType === 'greed'
              ? 'exit_greed'
              : routeType === 'mystery'
                ? 'exit_mystery'
                : 'exit_safe';
    const specs: DungeonFloorBlueprint['exitSpecs'] = [
        {
            id: `${level}-exit`,
            routeType,
            effectId,
            lockKind,
            requiredLeverCount,
            labelPrefix: 'Primary'
        }
    ];
    const alternateRouteType: RouteNodeType | null =
        level >= 4 && (floorTag === 'boss' || floorArchetypeId === 'treasure_gallery' || level % 4 === 0)
            ? routeType === 'greed'
                ? 'safe'
                : 'greed'
            : null;
    if (alternateRouteType) {
        specs.push({
            id: `${level}-exit-alt`,
            routeType: alternateRouteType,
            effectId: alternateRouteType === 'greed' ? 'exit_greed' : 'exit_safe',
            lockKind: level >= 6 ? 'iron' : floorArchetypeId === 'treasure_gallery' ? 'treasure' : 'none',
            requiredLeverCount: 0,
            labelPrefix: 'Alternate'
        });
    }
    return specs;
};

const chooseRoomEffectsForFloor = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): DungeonCardEffectId[] => {
    const effectId = roomEffectForFloor(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind);
    return effectId ? [effectId] : [];
};

const pairCapacityForDungeonEncounter = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    dungeonNodeKind?: DungeonRunNodeKind | null
): number => {
    const encounter = createDungeonEncounterContext(dungeonNodeKind, floorTag, floorArchetypeId);
    return clamp(level + 1 + encounter.pairCountDelta, Math.min(2, NUMBER_SYMBOLS.length), NUMBER_SYMBOLS.length);
};

export const createDungeonFloorBlueprint = ({
    runSeed,
    rulesVersion,
    level,
    floorTag,
    floorArchetypeId,
    gameMode,
    dungeonNodeKind
}: {
    runSeed: number;
    rulesVersion: number;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    gameMode?: GameMode;
    dungeonNodeKind?: DungeonRunNodeKind | null;
}): DungeonFloorBlueprint => {
    const eliteRules = getDungeonEliteEncounterRules(dungeonNodeKind);
    const baseBudgets = budgetForFloor(level, floorTag, floorArchetypeId);
    const budgets = eliteRules
        ? {
              ...baseBudgets,
              threatBudget: Math.max(baseBudgets.threatBudget, eliteRules.threatBudgetFloor),
              rewardBudget: Math.max(baseBudgets.rewardBudget, eliteRules.rewardBudgetFloor)
          }
        : baseBudgets;
    const bossId = dungeonBossForFloor(floorTag, floorArchetypeId);
    const objectiveId = eliteRules?.objectiveId ?? dungeonObjectiveForFloor(level, floorTag, floorArchetypeId);
    const pairedCardCapacity = pairCapacityForDungeonEncounter(level, floorTag, floorArchetypeId, dungeonNodeKind);
    const pairedCardSpecs = capDungeonCardRecipeForBudget(
        dungeonCardRecipeForFloor(level, floorTag, floorArchetypeId, gameMode, {
            ...budgets,
            bossId
        }),
        pairedCardCapacity,
        objectiveId
    );
    return {
        level,
        floorTag,
        floorArchetypeId,
        bossId,
        objectiveId,
        ...budgets,
        exitSpecs: exitSpecsForFloor(level, floorTag, floorArchetypeId),
        pairedCardSpecs,
        roomEffectIds: chooseRoomEffectsForFloor(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind),
        shopTileId: shouldAddDungeonShopTile(runSeed, rulesVersion, level, floorTag, floorArchetypeId, gameMode, dungeonNodeKind)
            ? `${level}-shop`
            : null
    };
};

export interface DungeonEncounterBudgetSummary {
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    dungeonNodeKind: DungeonRunNodeKind | null;
    pairCapacity: number;
    pairedCardCount: number;
    singletonUtilityCount: number;
    threatPairCount: number;
    rewardPairCount: number;
    utilityPairCount: number;
    lockPairCount: number;
    routePairCount: number;
    bossPairCount: number;
    objectiveId: DungeonFloorBlueprint['objectiveId'];
    bossId: DungeonFloorBlueprint['bossId'];
    cardKindCounts: Record<DungeonCardKind, number>;
    warnings: string[];
}

const emptyDungeonCardKindCounts = (): Record<DungeonCardKind, number> => ({
    enemy: 0,
    trap: 0,
    treasure: 0,
    shrine: 0,
    gateway: 0,
    key: 0,
    lock: 0,
    exit: 0,
    lever: 0,
    shop: 0,
    room: 0
});

export const inspectDungeonEncounterBudget = (options: {
    runSeed: number;
    rulesVersion: number;
    level: number;
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    gameMode?: GameMode;
    dungeonNodeKind?: DungeonRunNodeKind | null;
}): DungeonEncounterBudgetSummary => {
    const encounter = createDungeonEncounterContext(
        options.dungeonNodeKind,
        options.floorTag,
        options.floorArchetypeId
    );
    const blueprint = createDungeonFloorBlueprint({
        ...options,
        floorTag: encounter.floorTag,
        floorArchetypeId: encounter.floorArchetypeId,
        dungeonNodeKind: encounter.nodeKind
    });
    const pairCapacity = pairCapacityForDungeonEncounter(
        options.level,
        options.floorTag,
        options.floorArchetypeId,
        options.dungeonNodeKind
    );
    const cardKindCounts = emptyDungeonCardKindCounts();
    for (const card of blueprint.pairedCardSpecs) {
        cardKindCounts[card.kind] += 1;
    }
    cardKindCounts.exit = blueprint.exitSpecs.length;
    cardKindCounts.shop = blueprint.shopTileId ? 1 : 0;
    cardKindCounts.room = blueprint.roomEffectIds.length;

    const threatPairCount = cardKindCounts.enemy + cardKindCounts.trap;
    const rewardPairCount = cardKindCounts.treasure + cardKindCounts.shrine;
    const utilityPairCount = cardKindCounts.key + cardKindCounts.lever;
    const lockPairCount = cardKindCounts.lock;
    const routePairCount = cardKindCounts.gateway;
    const bossPairCount = blueprint.pairedCardSpecs.filter((card) => card.bossId != null).length;
    const pairedCardCount = blueprint.pairedCardSpecs.length;
    const singletonUtilityCount = blueprint.exitSpecs.length + (blueprint.shopTileId ? 1 : 0) + blueprint.roomEffectIds.length;
    const warnings: string[] = [];

    if (pairedCardCount > pairCapacity) {
        warnings.push(
            `paired cards ${pairedCardCount} exceed pair capacity ${pairCapacity} for level ${options.level}`
        );
    }
    if (blueprint.exitSpecs.length === 0) {
        warnings.push(`level ${options.level} has no exit spec`);
    }
    if (blueprint.objectiveId === 'defeat_boss' && blueprint.bossId == null && bossPairCount === 0) {
        warnings.push(`level ${options.level} has defeat_boss objective without a boss budget`);
    }
    if (blueprint.objectiveId === 'claim_route' && routePairCount === 0 && blueprint.exitSpecs.length === 0) {
        warnings.push(`level ${options.level} has claim_route objective without a gateway or exit`);
    }

    return {
        level: options.level,
        floorTag: encounter.floorTag,
        floorArchetypeId: encounter.floorArchetypeId,
        dungeonNodeKind: encounter.nodeKind,
        pairCapacity,
        pairedCardCount,
        singletonUtilityCount,
        threatPairCount,
        rewardPairCount,
        utilityPairCount,
        lockPairCount,
        routePairCount,
        bossPairCount,
        objectiveId: blueprint.objectiveId,
        bossId: blueprint.bossId,
        cardKindCounts,
        warnings
    };
};

const addDungeonExitTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; exitTileId: string; routeType: RouteNodeType; lockKind: DungeonExitLockKind; requiredLevers: number } => {
    const makeExitTile = (
        id: string,
        exitRouteType: RouteNodeType,
        exitEffectId: DungeonCardEffectId,
        exitLockKind: DungeonExitLockKind,
        exitRequiredLevers: number,
        labelPrefix: string
    ): Tile => ({
        id,
        pairKey: EXIT_PAIR_KEY,
        state: 'hidden',
        symbol: exitRouteType === 'greed' ? '>' : exitRouteType === 'mystery' ? '?' : '^',
        label:
            blueprint.floorTag === 'boss'
                ? `${labelPrefix} Boss Exit`
                : exitRouteType === 'greed'
                  ? `${labelPrefix} Greed Exit`
                  : exitRouteType === 'mystery'
                    ? `${labelPrefix} Mystery Exit`
                    : `${labelPrefix} Safe Exit`,
        atomicVariant: 0,
        dungeonCardKind: 'exit',
        dungeonCardState: 'hidden',
        dungeonCardEffectId: exitEffectId,
        dungeonRouteType: exitRouteType,
        dungeonExitLockKind: exitLockKind,
        dungeonExitRequiredLeverCount: exitRequiredLevers,
        dungeonExitActivated: false
    });
    const exitTiles = blueprint.exitSpecs.map((spec) =>
        makeExitTile(spec.id, spec.routeType, spec.effectId, spec.lockKind, spec.requiredLeverCount, spec.labelPrefix)
    );
    const primary = blueprint.exitSpecs[0]!;
    return {
        tiles: [...tiles, ...exitTiles],
        exitTileId: primary.id,
        routeType: primary.routeType,
        lockKind: primary.lockKind,
        requiredLevers: primary.requiredLeverCount
    };
};

const shouldAddDungeonShopTile = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): boolean => {
    if (!gameMode || gameMode === 'puzzle' || level <= 1 || floorTag === 'boss') {
        return false;
    }
    if (dungeonNodeKind === 'shop') {
        return true;
    }
    if (dungeonNodeKind === 'rest') {
        return false;
    }
    if (floorTag === 'breather' || floorArchetypeId === 'treasure_gallery') {
        return true;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonShop:${rulesVersion}:${runSeed}:${level}`));
    const threshold = floorArchetypeId === 'script_room' || floorArchetypeId === 'spotlight_hunt' ? 0.45 : 0.3;
    return rng() < threshold;
};

const addDungeonShopTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; shopTileId: string | null } => {
    if (!blueprint.shopTileId) {
        return { tiles, shopTileId: null };
    }
    const shopTileId = blueprint.shopTileId;
    return {
        tiles: [
            ...tiles,
            {
                id: shopTileId,
                pairKey: SHOP_PAIR_KEY,
                state: 'hidden',
                symbol: 'S',
                label: 'Vendor Alcove',
                atomicVariant: 0,
                dungeonCardKind: 'shop',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: 'shop_vendor'
            }
        ],
        shopTileId
    };
};

const roomEffectForFloor = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): DungeonCardEffectId | null => {
    if (!gameMode || gameMode === 'puzzle' || level <= 1 || floorTag === 'boss') {
        return null;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonRoom:${rulesVersion}:${runSeed}:${level}`));
    if (dungeonNodeKind === 'rest') {
        const options: DungeonCardEffectId[] = [
            'room_campfire',
            'room_fountain',
            'room_shrine',
            'room_map',
            'room_scrying_lens',
            'room_armory'
        ];
        return options[Math.floor(rng() * options.length)]!;
    }
    if (dungeonNodeKind === 'event') {
        const options: DungeonCardEffectId[] = ['room_map', 'room_omen_archive', 'room_scrying_lens', 'room_forge'];
        return options[Math.floor(rng() * options.length)]!;
    }
    if (dungeonNodeKind === 'treasure') {
        const options: DungeonCardEffectId[] = ['room_key_cache', 'room_locked_cache', 'room_armory', 'room_scrying_lens'];
        return options[Math.floor(rng() * options.length)]!;
    }
    if (dungeonNodeKind === 'trap') {
        return 'room_trap_workshop';
    }
    const chance = floorTag === 'breather' ? 0.65 : floorArchetypeId === 'script_room' ? 0.45 : 0.28;
    if (rng() >= chance) {
        return null;
    }
    const options: DungeonCardEffectId[] =
        floorArchetypeId === 'script_room'
            ? ['room_map', 'room_omen_archive', 'room_forge', 'room_fountain', 'room_scrying_lens']
              : floorTag === 'breather'
              ? [
                    'room_campfire',
                    'room_fountain',
                    'room_forge',
                    'room_shrine',
                    'room_map',
                    'room_scrying_lens',
                    'room_armory',
                    'room_key_cache'
                ]
              : floorArchetypeId === 'treasure_gallery'
                ? ['room_key_cache', 'room_forge', 'room_armory', 'room_locked_cache', 'room_scrying_lens']
                : floorArchetypeId === 'trap_hall'
                  ? ['room_trap_workshop', 'room_scrying_lens', 'room_armory', 'room_fountain']
                  : floorArchetypeId === 'shadow_read'
                    ? ['room_omen_archive', 'room_map', 'room_scrying_lens', 'room_shrine']
                    : [
                          'room_campfire',
                          'room_fountain',
                          'room_map',
                          'room_forge',
                          'room_shrine',
                          'room_scrying_lens',
                          'room_armory',
                          'room_key_cache'
                      ];
    return options[Math.floor(rng() * options.length)]!;
};

const addDungeonRoomTile = (
    tiles: Tile[],
    blueprint: DungeonFloorBlueprint
): { tiles: Tile[]; roomTileId: string | null } => {
    const effectId = blueprint.roomEffectIds[0] ?? null;
    if (!effectId) {
        return { tiles, roomTileId: null };
    }
    const roomTileId = `${blueprint.level}-room`;
    const label =
        effectId === 'room_campfire'
            ? 'Campfire'
            : effectId === 'room_fountain'
              ? 'Fountain'
              : effectId === 'room_map'
                ? 'Map Room'
                : effectId === 'room_shrine'
                  ? 'Shrine'
                  : effectId === 'room_scrying_lens'
                  ? 'Scrying Lens'
                  : effectId === 'room_armory'
                    ? 'Armory'
                    : effectId === 'room_locked_cache'
                      ? 'Locked Cache'
                      : effectId === 'room_key_cache'
                        ? 'Key Cache'
                        : effectId === 'room_trap_workshop'
                          ? 'Trap Workshop'
                          : effectId === 'room_omen_archive'
                            ? 'Omen Archive'
                            : 'Forge';
    const symbol =
        effectId === 'room_campfire'
            ? 'C'
            : effectId === 'room_fountain'
              ? 'F'
              : effectId === 'room_map'
                ? 'M'
                : effectId === 'room_shrine'
                  ? '+'
                  : effectId === 'room_scrying_lens'
                  ? '?'
                  : effectId === 'room_armory'
                    ? 'A'
                    : effectId === 'room_locked_cache'
                      ? 'L'
                      : effectId === 'room_key_cache'
                        ? 'K'
                        : effectId === 'room_trap_workshop'
                          ? 'T'
                          : effectId === 'room_omen_archive'
                            ? 'O'
                            : 'G';
    return {
        tiles: [
            ...tiles,
            {
                id: roomTileId,
                pairKey: ROOM_PAIR_KEY,
                state: 'hidden',
                symbol,
                label,
                atomicVariant: 0,
                dungeonCardKind: 'room',
                dungeonCardState: 'hidden',
                dungeonCardEffectId: effectId,
                dungeonRoomUsed: false
            }
        ],
        roomTileId
    };
};

/** Distinct pairKeys that have at least one tile with `findableKind` (run `findablesTotalThisFloor` / fixtures). */
export const countFindablePairs = (tiles: readonly Tile[]): number =>
    new Set(tiles.filter((tile) => tile.findableKind != null).map((tile) => tile.pairKey)).size;

const pickFindableKind = (roll: number): FindableKind => {
    const rows = (Object.entries(FINDABLE_KIND_SPAWN_WEIGHTS) as [FindableKind, number][]).filter(
        ([, weight]) => weight > 0
    );
    const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
    let cursor = roll * total;
    for (const [kind, weight] of rows) {
        if (cursor < weight) {
            return kind;
        }
        cursor -= weight;
    }
    return rows[rows.length - 1]?.[0] ?? 'shard_spark';
};

const assignFindableKindsToTiles = (
    tiles: Tile[],
    mutators: MutatorId[],
    runSeed: number,
    rulesVersion: number,
    level: number
): Tile[] => {
    const eligibleKeys = [
        ...new Set(
            tiles
                .map((t) => t.pairKey)
                .filter((k) => !isSingletonUtilityPairKey(k))
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const legacyFindables = rulesVersion < PICKUP_BASELINE_RULES_VERSION;
    if (legacyFindables && !mutators.includes('findables_floor')) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`findables:${rulesVersion}:${runSeed}:${level}`));
    let pairCountTarget = 0;
    if (legacyFindables) {
        const roll = rng();
        pairCountTarget = roll < 0.2 ? 0 : roll < 0.7 ? 1 : 2;
    } else if (mutators.includes('findables_floor')) {
        pairCountTarget = 2;
    } else if (level <= 3) {
        pairCountTarget = 1;
    } else {
        pairCountTarget = rng() < 0.5 ? 1 : 2;
    }
    const n = Math.min(pairCountTarget, eligibleKeys.length);
    if (n === 0) {
        return tiles;
    }
    const keys = [...eligibleKeys];
    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = keys[i]!;
        keys[i] = keys[j]!;
        keys[j] = tmp;
    }
    const picked = keys.slice(0, n);
    const kindByKey = new Map<string, FindableKind>();
    for (const key of picked) {
        kindByKey.set(key, pickFindableKind(rng()));
    }
    return tiles.map((t) => {
        const kind = kindByKey.get(t.pairKey);
        return kind ? { ...t, findableKind: kind } : t;
    });
};

interface DungeonCardAssignment {
    kind: DungeonCardKind;
    effectId: DungeonCardEffectId;
    symbol: string;
    label: string;
    hp?: number;
    routeType?: RouteNodeType;
    bossId?: NonNullable<DungeonFloorBlueprint['bossId']>;
}

const capDungeonCardRecipeForBudget = (
    cards: DungeonCardAssignment[],
    capacity: number,
    objectiveId: DungeonFloorBlueprint['objectiveId']
): DungeonCardAssignment[] => {
    if (cards.length <= capacity) {
        return cards;
    }
    const selected: DungeonCardAssignment[] = [];
    const selectedIndexes = new Set<number>();
    const take = (predicate: (card: DungeonCardAssignment) => boolean): void => {
        for (let index = 0; index < cards.length && selected.length < capacity; index += 1) {
            if (!selectedIndexes.has(index) && predicate(cards[index]!)) {
                selected.push(cards[index]!);
                selectedIndexes.add(index);
            }
        }
    };

    take((card) => card.bossId != null || card.effectId === 'lever_floor');
    if (objectiveId === 'claim_route') {
        take((card) => card.kind === 'gateway');
    }
    if (objectiveId === 'disarm_traps') {
        take((card) => card.kind === 'trap' || card.effectId === 'rune_seal');
    }
    if (objectiveId === 'loot_cache') {
        take((card) => card.kind === 'treasure' || card.kind === 'lock' || card.kind === 'key');
    }
    take(() => true);

    return selected;
};

type DungeonCardRecipeBudgets = Pick<
    DungeonFloorBlueprint,
    'threatBudget' | 'rewardBudget' | 'utilityBudget' | 'lockBudget' | 'gatewayBudget' | 'bossId'
>;

const bossCardFor = (bossId: DungeonFloorBlueprint['bossId']): DungeonCardAssignment | null => {
    const definition = getDungeonBossDefinition(bossId);
    if (!definition) {
        return null;
    }
    return {
        kind: 'enemy',
        effectId: 'enemy_elite',
        symbol: definition.symbol,
        label: definition.label,
        hp: definition.hp,
        bossId: definition.id
    };
};

const sentryCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_sentry',
    symbol: 'e',
    label: 'Sentry',
    hp: 1
});

const eliteCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_elite',
    symbol: 'E',
    label: 'Elite Sentinel',
    hp: 2
});

const stalkerCard = (): DungeonCardAssignment => ({
    kind: 'enemy',
    effectId: 'enemy_stalker',
    symbol: 's',
    label: 'Stalker',
    hp: 2
});

const trapCard = (effectId: DungeonCardEffectId, floorArchetypeId: FloorArchetypeId | null): DungeonCardAssignment => ({
    kind: 'trap',
    effectId,
    symbol: '!',
    label:
        effectId === 'trap_alarm'
            ? 'Alarm Trap'
            : effectId === 'trap_snare'
              ? 'Snare Trap'
              : effectId === 'trap_hex'
                ? 'Hex Trap'
            : effectId === 'trap_mimic'
              ? 'Mimic Trap'
              : floorArchetypeId === 'shadow_read' || effectId === 'trap_curse'
                ? 'Curse Trap'
                : 'Spike Trap'
});

const treasureCard = (level: number, floorArchetypeId: FloorArchetypeId | null): DungeonCardAssignment => ({
    kind: 'treasure',
    effectId: floorArchetypeId === 'treasure_gallery' || level >= 5 ? 'treasure_cache' : 'treasure_gold',
    symbol: '$',
    label: 'Treasure Cache'
});

const lockCard = (): DungeonCardAssignment => ({ kind: 'lock', effectId: 'lock_cache', symbol: 'L', label: 'Locked Cache' });
const keyCard = (): DungeonCardAssignment => ({ kind: 'key', effectId: 'key_iron', symbol: 'K', label: 'Iron Key' });
const shrineCard = (): DungeonCardAssignment => ({ kind: 'shrine', effectId: 'shrine_guard', symbol: '+', label: 'Guard Shrine' });
const gatewayCard = (routeType: RouteNodeType = 'greed'): DungeonCardAssignment => ({
    kind: 'gateway',
    effectId: routeType === 'safe' ? 'gateway_safe' : routeType === 'mystery' ? 'gateway_mystery' : 'gateway_depth',
    symbol: routeType === 'mystery' ? '?' : '>',
    label: routeType === 'mystery' ? 'Mystery Gateway' : routeType === 'safe' ? 'Safe Gateway' : 'Depth Gateway',
    routeType
});

const minorSupplyCard = (): DungeonCardAssignment => ({
    kind: 'treasure',
    effectId: 'treasure_shard',
    symbol: '.',
    label: 'Supply Cache'
});

const dungeonCardRecipeForFloor = (
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    blueprint?: DungeonCardRecipeBudgets
): DungeonCardAssignment[] => {
    const budgets = blueprint ?? {
        ...budgetForFloor(level, floorTag, floorArchetypeId),
        bossId: dungeonBossForFloor(floorTag, floorArchetypeId)
    };
    const cards: DungeonCardAssignment[] = [];
    const exitLockKind = primaryExitLockKindForFloor(level, floorArchetypeId);
    const leverCount = requiredLeverCountForFloor(level, exitLockKind);
    for (let i = 0; i < leverCount; i++) {
        cards.push({ kind: 'lever', effectId: 'lever_floor', symbol: 'V', label: i === 0 ? 'Exit Lever' : `Exit Lever ${i + 1}` });
    }

    const bossCard = bossCardFor(budgets.bossId);
    if (bossCard) {
        cards.push(bossCard);
    }

    let threatsAdded = bossCard ? 1 : 0;
    if (threatsAdded < budgets.threatBudget && level >= 2 && gameMode !== 'meditation') {
        cards.push(
            floorArchetypeId === 'shadow_read'
                ? trapCard('trap_hex', floorArchetypeId)
                : floorTag === 'boss' || floorArchetypeId === 'trap_hall'
                ? stalkerCard()
                : floorArchetypeId === 'rush_recall'
                  ? eliteCard()
                  : sentryCard()
        );
        threatsAdded += 1;
    }

    while (threatsAdded < budgets.threatBudget) {
        const trapEffectId: DungeonCardEffectId =
            floorArchetypeId === 'shadow_read'
                ? threatsAdded % 2 === 0
                    ? 'trap_hex'
                    : 'trap_curse'
                  : floorArchetypeId === 'trap_hall'
                  ? threatsAdded === 1
                      ? 'trap_mimic'
                      : threatsAdded % 2 === 0
                      ? 'trap_snare'
                      : 'trap_hex'
                  : level >= 6
                    ? 'trap_mimic'
                    : 'trap_spikes';
        cards.push(trapCard(trapEffectId, floorArchetypeId));
        threatsAdded += 1;
    }

    for (let i = 0; i < budgets.rewardBudget; i++) {
        cards.push(treasureCard(level, floorArchetypeId));
    }

    for (let i = 0; i < budgets.utilityBudget; i++) {
        if (floorArchetypeId === 'trap_hall' && level >= 4 && i === 0) {
            cards.push({ kind: 'lever', effectId: 'rune_seal', symbol: 'R', label: 'Rune Seal' });
        } else if (floorTag === 'breather') {
            cards.push(shrineCard());
        } else if (floorArchetypeId === 'script_room' || floorArchetypeId === 'spotlight_hunt' || floorArchetypeId === 'parasite_tithe') {
            cards.push(shrineCard());
        } else if (level >= 3 && floorArchetypeId !== 'breather') {
            cards.push(keyCard());
        }
    }

    for (let i = 0; i < budgets.lockBudget; i++) {
        cards.push(i % 2 === 0 && level >= 3 ? keyCard() : lockCard());
    }

    for (let i = 0; i < budgets.gatewayBudget; i++) {
        cards.push(gatewayCard(floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read' ? 'mystery' : 'greed'));
    }

    return cards;
};

const assignDungeonCardsToTiles = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    blueprint?: DungeonFloorBlueprint
): Tile[] => {
    if (!gameMode) {
        return tiles;
    }
    const assignments = blueprint?.pairedCardSpecs ?? dungeonCardRecipeForFloor(level, floorTag, floorArchetypeId, gameMode);
    if (assignments.length === 0) {
        return tiles;
    }
    const eligibleKeys = [
        ...new Set(
            tiles
                .filter(
                    (tile) =>
                        tile.pairKey !== DECOY_PAIR_KEY &&
                        tile.pairKey !== WILD_PAIR_KEY &&
                        tile.routeSpecialKind == null &&
                        tile.routeCardKind == null
                )
                .map((tile) => tile.pairKey)
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonCards:${rulesVersion}:${runSeed}:${level}`));
    const keys = [...eligibleKeys];
    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = keys[i]!;
        keys[i] = keys[j]!;
        keys[j] = tmp;
    }
    const assignmentByPairKey = new Map<string, DungeonCardAssignment>();
    const count = Math.min(assignments.length, keys.length);
    for (let i = 0; i < count; i++) {
        assignmentByPairKey.set(keys[i]!, assignments[i]!);
    }
    return tiles.map((tile) => {
        const assignment = assignmentByPairKey.get(tile.pairKey);
        if (!assignment) {
            return tile;
        }
        return {
            ...tile,
            symbol: assignment.symbol,
            label: assignment.label,
            dungeonCardKind: assignment.kind,
            dungeonCardState: 'hidden',
            dungeonCardEffectId: assignment.effectId,
            dungeonCardHp: assignment.hp,
            dungeonCardMaxHp: assignment.hp,
            dungeonRouteType: assignment.routeType,
            dungeonBossId: assignment.bossId ?? undefined,
            dungeonKeyKind: assignment.kind === 'key' ? 'iron' : undefined
        };
    });
};

const assignDungeonFillerCardsToTiles = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): Tile[] => {
    if (!gameMode || gameMode === 'puzzle' || gameMode === 'meditation' || level <= 1) {
        return tiles;
    }
    const eligibleKeys = [
        ...new Set(
            tiles
                .filter(
                    (tile) =>
                        !isSingletonUtilityPairKey(tile.pairKey) &&
                        tile.pairKey !== DECOY_PAIR_KEY &&
                        tile.pairKey !== WILD_PAIR_KEY &&
                        tile.dungeonCardKind == null &&
                        tile.routeSpecialKind == null &&
                        tile.routeCardKind == null &&
                        tile.findableKind == null
                )
                .map((tile) => tile.pairKey)
        )
    ];
    if (eligibleKeys.length === 0) {
        return tiles;
    }
    const target =
        dungeonNodeKind === 'treasure'
            ? 3
            : dungeonNodeKind === 'rest' || dungeonNodeKind === 'shop'
              ? 2
        : floorArchetypeId === 'treasure_gallery' || floorTag === 'breather'
            ? 2
            : floorArchetypeId === 'script_room' || floorArchetypeId === 'shadow_read'
              ? 1
              : level >= 5
                ? 1
                : 0;
    if (target <= 0) {
        return tiles;
    }
    const rng = createMulberry32(hashStringToSeed(`dungeonFillers:${rulesVersion}:${runSeed}:${level}`));
    const picked = shuffleWithRng(() => rng(), eligibleKeys).slice(0, Math.min(target, eligibleKeys.length));
    const pickedSet = new Set(picked);
    const assignment = minorSupplyCard();
    return tiles.map((tile) =>
        pickedSet.has(tile.pairKey)
            ? {
                  ...tile,
                  symbol: assignment.symbol,
                  label: assignment.label,
                  dungeonCardKind: assignment.kind,
                  dungeonCardState: 'hidden',
                  dungeonCardEffectId: assignment.effectId
              }
            : tile
    );
};

const tileCanCarryHazard = (tile: Tile): boolean =>
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.findableKind == null &&
    tile.tileHazardKind == null;

const assignHazardTilesToGeneratedBoard = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    gameMode?: GameMode
): Tile[] => {
    if (!gameMode || rulesVersion < HAZARD_TILE_BASELINE_RULES_VERSION) {
        return tiles;
    }

    const eligibleKeys = [
        ...new Set(tiles.filter(tileCanCarryHazard).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanCarryHazard(tile)).length === 2);
    const rng = createMulberry32(hashStringToSeed(`hazardTiles:${rulesVersion}:${runSeed}:${level}:${gameMode}`));
    const shuffledKeys = shuffleWithRng(() => rng(), eligibleKeys);
    const candidateHazardKinds: HazardTileKind[] = ['shuffle_snare', 'cascade_cache'];
    if (level >= FRAGILE_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('fragile_cache');
    }
    if (level >= TOLL_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('toll_cache');
    }
    if (level >= FUSE_CACHE_BASELINE_LEVEL) {
        candidateHazardKinds.push('fuse_cache');
    }
    const hazardKinds: HazardTileKind[] =
        candidateHazardKinds.length > 2
            ? shuffleWithRng(() => rng(), candidateHazardKinds).slice(0, 2)
            : candidateHazardKinds;
    const hazardByPairKey = new Map<string, HazardTileKind>();
    for (let i = 0; i < Math.min(hazardKinds.length, shuffledKeys.length); i += 1) {
        hazardByPairKey.set(shuffledKeys[i]!, hazardKinds[i]!);
    }

    const assignedTiles = tiles.map((tile) => {
        const kind = hazardByPairKey.get(tile.pairKey);
        return kind ? { ...tile, tileHazardKind: kind } : tile;
    });

    const mirrorSourceKey = shuffledKeys.find((key) => !hazardByPairKey.has(key));
    const mirrorSource =
        (mirrorSourceKey ? assignedTiles.find((tile) => tile.pairKey === mirrorSourceKey) : null) ??
        assignedTiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey));
    if (!mirrorSource || assignedTiles.some((tile) => tile.tileHazardKind === 'mirror_decoy')) {
        return assignedTiles;
    }

    const mirrorDefinition = getHazardTileDefinition('mirror_decoy');
    return [
        ...assignedTiles,
        {
            id: `hazard-mirror-${rulesVersion}-${runSeed}-${level}`,
            pairKey: DECOY_PAIR_KEY,
            symbol: mirrorSource.symbol,
            label: mirrorDefinition.label,
            state: 'hidden',
            tileHazardKind: 'mirror_decoy'
        }
    ];
};

interface DungeonGraphSlots {
    mainPath: number[];
    branches: number[];
    hazards: number[];
    rewards: number[];
}

const uniqueSlotOrder = (slots: number[], total: number): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const slot of slots) {
        if (slot < 0 || slot >= total || seen.has(slot)) {
            continue;
        }
        seen.add(slot);
        out.push(slot);
    }
    return out;
};

const makeDungeonGraphSlots = (total: number, columns: number, rng: () => number): DungeonGraphSlots => {
    const rows = Math.max(1, Math.ceil(total / columns));
    const path: number[] = [];
    let col = Math.min(columns - 1, Math.max(0, Math.floor(rng() * columns)));
    for (let row = 0; row < rows; row += 1) {
        const step = Math.floor(rng() * 3) - 1;
        col = Math.min(columns - 1, Math.max(0, col + step));
        const slot = row * columns + col;
        if (slot < total) {
            path.push(slot);
        }
    }
    const pathSet = new Set(path);
    const branches: number[] = [];
    for (const slot of path) {
        const row = Math.floor(slot / columns);
        const slotCol = slot % columns;
        for (const delta of [-1, 1]) {
            const nextCol = slotCol + delta;
            const next = row * columns + nextCol;
            if (nextCol >= 0 && nextCol < columns && next < total && !pathSet.has(next)) {
                branches.push(next);
            }
        }
    }
    const all = Array.from({ length: total }, (_, index) => index);
    const offPath = all.filter((slot) => !pathSet.has(slot));
    return {
        mainPath: uniqueSlotOrder(path, total),
        branches: uniqueSlotOrder(branches, total),
        hazards: uniqueSlotOrder([...path.slice(1), ...branches, ...offPath], total),
        rewards: uniqueSlotOrder([...branches, ...offPath, ...path], total)
    };
};

const nearestAvailableSlot = (
    preferred: number,
    available: Set<number>,
    total: number,
    allowed: (slot: number) => boolean
): number | null => {
    const ordered = [...available].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
    return ordered.find((slot) => slot >= 0 && slot < total && allowed(slot)) ?? null;
};

const dungeonLayoutPriority = (tile: Tile): number => {
    if (tile.pairKey === EXIT_PAIR_KEY) return 0;
    if (tile.pairKey === SHOP_PAIR_KEY || tile.pairKey === ROOM_PAIR_KEY) return 1;
    if (tile.dungeonBossId) return 2;
    if (tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap') return 3;
    if (tile.dungeonCardKind === 'lever' || tile.dungeonCardKind === 'gateway') return 4;
    if (tile.dungeonCardKind === 'treasure' || tile.dungeonCardKind === 'shrine' || tile.dungeonCardKind === 'key' || tile.dungeonCardKind === 'lock') return 5;
    if (tile.dungeonCardKind != null) return 6;
    return 7;
};

export const applyDungeonLayoutPlan = (
    tiles: Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    floorTag: FloorTag,
    floorArchetypeId: FloorArchetypeId | null,
    gameMode?: GameMode,
    dungeonNodeKind?: DungeonRunNodeKind | null
): Tile[] => {
    if (!gameMode || !tiles.some((tile) => tile.dungeonCardKind != null)) {
        return tiles;
    }
    const total = tiles.length;
    if (total <= 3) {
        return tiles;
    }
    const columns = clamp(Math.ceil(Math.sqrt(total)), 2, 8);
    const rng = createMulberry32(hashStringToSeed(`dungeonLayout:${rulesVersion}:${runSeed}:${level}:${dungeonNodeKind ?? 'floor'}`));
    const graph = makeDungeonGraphSlots(total, columns, rng);
    const shuffledTiles = shuffleWithRng(() => rng(), tiles);
    const orderedTiles = [...shuffledTiles].sort(
        (a, b) => dungeonLayoutPriority(a) - dungeonLayoutPriority(b) || a.id.localeCompare(b.id)
    );
    const available = new Set(Array.from({ length: total }, (_, index) => index));
    const placed = new Map<number, Tile>();
    const exitSlots: number[] = [];
    const lastRowStart = Math.max(0, Math.floor((total - 1) / columns) * columns);
    const tailStart = Math.max(0, total - 3);
    const preferredFrom = (slots: number[], fallback: number, offset: number): number => slots[offset % Math.max(1, slots.length)] ?? fallback;

    orderedTiles.forEach((tile, order) => {
        const isExit = tile.pairKey === EXIT_PAIR_KEY;
        const isBranch = tile.pairKey === SHOP_PAIR_KEY || tile.pairKey === ROOM_PAIR_KEY;
        const isHazard = tile.dungeonCardKind === 'enemy' || tile.dungeonCardKind === 'trap' || tile.dungeonBossId != null;
        const isReward =
            tile.dungeonCardKind === 'treasure' ||
            tile.dungeonCardKind === 'shrine' ||
            tile.dungeonCardKind === 'key' ||
            tile.dungeonCardKind === 'lock';
        const fallback = Math.floor(((order + 1) / (orderedTiles.length + 1)) * total);
        const preferred = isExit
            ? preferredFrom(graph.mainPath, Math.floor(total * 0.58), graph.mainPath.length - 2 - exitSlots.length)
            : isBranch
              ? preferredFrom(
                    graph.branches,
                    dungeonNodeKind === 'shop' || dungeonNodeKind === 'rest' ? Math.floor(total * 0.28) : Math.floor(total * 0.42),
                    order
                )
              : isHazard
                ? preferredFrom(
                      graph.hazards,
                      dungeonNodeKind === 'trap' || dungeonNodeKind === 'elite' || dungeonNodeKind === 'boss'
                          ? Math.floor(total * 0.32)
                          : Math.floor(total * 0.35),
                      order
                  )
                : isReward
                  ? preferredFrom(
                        graph.rewards,
                        dungeonNodeKind === 'treasure' ? Math.floor(total * 0.45) : Math.floor(total * 0.5),
                        order
                    )
                  : fallback;
        const slot =
            nearestAvailableSlot(preferred, available, total, (candidate) => {
                if (!isExit) {
                    return true;
                }
                const notTail = total <= columns + 3 || (candidate < tailStart && candidate < lastRowStart);
                const separated = exitSlots.every((existing) => Math.abs(existing - candidate) > 1);
                return notTail && separated;
            }) ??
            nearestAvailableSlot(preferred, available, total, (candidate) => !isExit || exitSlots.every((existing) => Math.abs(existing - candidate) > 1)) ??
            nearestAvailableSlot(preferred, available, total, () => true);
        if (slot == null) {
            return;
        }
        available.delete(slot);
        placed.set(slot, tile);
        if (isExit) {
            exitSlots.push(slot);
        }
    });

    return Array.from({ length: total }, (_, index) => placed.get(index)).filter((tile): tile is Tile => tile != null);
};

/** Remaining real pairs that can still be matched (not both matched; no removed tile in pair). */
const eligibleSpotlightPairKeys = (board: BoardState): string[] => {
    const groups = new Map<string, Tile[]>();
    for (const t of board.tiles) {
        if (t.pairKey === DECOY_PAIR_KEY || t.pairKey === WILD_PAIR_KEY) {
            continue;
        }
        const list = groups.get(t.pairKey) ?? [];
        list.push(t);
        groups.set(t.pairKey, list);
    }
    const keys: string[] = [];
    for (const [key, tiles] of groups) {
        if (tiles.some((x) => x.state === 'removed')) {
            continue;
        }
        if (tiles.every((x) => x.state === 'matched')) {
            continue;
        }
        keys.push(key);
    }
    return keys;
};

const pickShiftingSpotlightKeys = (
    board: BoardState,
    runSeed: number,
    rulesVersion: number,
    level: number,
    step: 'init' | number
): { wardPairKey: string | null; bountyPairKey: string | null } => {
    const keys = eligibleSpotlightPairKeys(board);
    if (keys.length === 0) {
        return { wardPairKey: null, bountyPairKey: null };
    }
    const stepTag = step === 'init' ? 'init' : String(step);
    const rng = createMulberry32(
        hashStringToSeed(`shiftSpotlight:${rulesVersion}:${runSeed}:${level}:${stepTag}`)
    );
    const shuffled = [...keys];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = tmp;
    }
    if (shuffled.length === 1) {
        return { wardPairKey: null, bountyPairKey: shuffled[0]! };
    }
    return { wardPairKey: shuffled[0]!, bountyPairKey: shuffled[1]! };
};

const shiftingSpotlightMatchDelta = (board: BoardState | undefined, matchedPairKey: string): number => {
    if (!board) {
        return 0;
    }
    let d = 0;
    if (board.bountyPairKey === matchedPairKey) {
        d += SHIFTING_BOUNTY_MATCH_BONUS;
    }
    if (board.wardPairKey === matchedPairKey) {
        d -= SHIFTING_WARD_MATCH_PENALTY;
    }
    return d;
};

const withRotatedShiftingSpotlight = (
    run: RunState,
    board: BoardState
): { board: BoardState; shiftingSpotlightNonce: number } => {
    const nonceBase = run.shiftingSpotlightNonce ?? 0;
    if (!hasMutator(run, 'shifting_spotlight')) {
        return { board, shiftingSpotlightNonce: nonceBase };
    }
    if (isBoardComplete(board)) {
        return { board, shiftingSpotlightNonce: nonceBase };
    }
    const nextNonce = nonceBase + 1;
    const { wardPairKey, bountyPairKey } = pickShiftingSpotlightKeys(
        board,
        run.runSeed,
        run.runRulesVersion,
        board.level,
        nextNonce
    );
    return {
        board: { ...board, wardPairKey, bountyPairKey },
        shiftingSpotlightNonce: nextNonce
    };
};

export const buildBoard = (level: number, options: BuildBoardOptions = {}): BoardState => {
    const runSeed = options.runSeed ?? 0;
    const rulesVersion = options.runRulesVersion ?? GAME_RULES_VERSION;
    const mutators = options.activeMutators ?? [];
    const encounter = createDungeonEncounterContext(
        options.dungeonNodeKind,
        options.floorTag ?? 'normal',
        options.floorArchetypeId ?? null
    );
    const floorArchetypeId = encounter.floorArchetypeId;
    const featuredObjectiveId = options.featuredObjectiveId ?? null;
    const cycleFloor = options.cycleFloor ?? null;
    const actBiome = cycleFloor != null ? getChapterActBiomeForCycleFloor(cycleFloor) : null;
    const floorTag = encounter.floorTag;
    const dungeonBlueprint = options.gameMode
        ? createDungeonFloorBlueprint({
              runSeed,
              rulesVersion,
              level,
              floorTag,
              floorArchetypeId,
              gameMode: options.gameMode,
              dungeonNodeKind: encounter.nodeKind
          })
        : null;

    if (options.fixedTiles && options.fixedTiles.length > 0) {
        const exactFixedTiles = options.fixedTilesMode === 'exact';
        const exitTiles = options.gameMode && !exactFixedTiles
            ? addDungeonExitTile(
                  options.fixedTiles.map((t) => ({ ...t })),
                  dungeonBlueprint!
              ).tiles
            : options.fixedTiles.map((t) => ({ ...t }));
        const shopAdded = dungeonBlueprint && !exactFixedTiles
            ? addDungeonShopTile(exitTiles, dungeonBlueprint)
            : { tiles: exitTiles, shopTileId: null };
        const roomAdded = dungeonBlueprint && !exactFixedTiles
            ? addDungeonRoomTile(shopAdded.tiles, dungeonBlueprint)
            : { tiles: shopAdded.tiles, roomTileId: null };
        const tiles = exactFixedTiles
            ? roomAdded.tiles
            : applyDungeonLayoutPlan(
                  roomAdded.tiles,
                  runSeed,
                  rulesVersion,
                  level,
                  floorTag,
                  floorArchetypeId,
                  options.gameMode,
                  encounter.nodeKind
              );
        const tileCount = tiles.length;
        const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
        const rows = Math.ceil(tileCount / columns);
        const realPairKeys = new Set(tiles.map((t) => t.pairKey).filter((k) => !isSingletonUtilityPairKey(k)));
        const exit = tiles.find((t) => t.pairKey === EXIT_PAIR_KEY);
        const enemyHazards = exactFixedTiles
            ? []
            : createEnemyHazardsForBoard({
                  tiles,
                  runSeed,
                  rulesVersion,
                  level,
                  floorTag,
                  floorArchetypeId,
                  nodeKind: encounter.nodeKind,
                  bossId: dungeonBlueprint?.bossId ?? null,
                  gameMode: options.gameMode
              });

        return {
            level,
            pairCount: realPairKeys.size,
            columns,
            rows,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorTag,
            cursedPairKey: null,
            wardPairKey: null,
            bountyPairKey: null,
            floorArchetypeId,
            featuredObjectiveId,
            cycleFloor,
            actTitle: actBiome?.actTitle ?? null,
            actFloorNumber: actBiome?.actFloorNumber ?? null,
            actFloorCount: actBiome?.actFloorCount ?? null,
            biomeTitle: actBiome?.biomeTitle ?? null,
            biomeTone: actBiome?.biomeTone ?? null,
            routeWorldProfile: options.routeWorldProfile ?? null,
            selectedGatewayRouteType: null,
            dungeonKeysHeld: 0,
            dungeonExitTileId: exit?.id ?? null,
            dungeonExitActivated: false,
            dungeonExitLockKind: exit?.dungeonExitLockKind ?? 'none',
            dungeonExitRequiredLeverCount: exit?.dungeonExitRequiredLeverCount ?? 0,
            dungeonLeverCount: 0,
            dungeonShopTileId: shopAdded.shopTileId,
            dungeonShopVisited: false,
            dungeonBossId: exactFixedTiles ? null : dungeonBlueprint?.bossId ?? null,
            dungeonObjectiveId: exactFixedTiles ? 'find_exit' : dungeonBlueprint?.objectiveId ?? 'find_exit',
            enemyHazards,
            enemyHazardTurn: 0
        };
    }

    const pairCount = clamp(level + 1 + encounter.pairCountDelta, Math.min(2, NUMBER_SYMBOLS.length), NUMBER_SYMBOLS.length);
    const routeWorldProfile =
        options.routeWorldProfile ??
        deriveRouteWorldProfile({
            plan: options.routeCardPlan,
            level,
            floorTag,
            floorArchetypeId,
            mutators
    });
    const routeTiles = assignRouteWorldSpecials({
        tiles: options.suppressFindables
            ? createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile)
            : assignFindableKindsToTiles(
                  createTiles(level, pairCount, runSeed, rulesVersion, mutators, options.includeWildTile),
                  mutators,
                  runSeed,
                  rulesVersion,
                  level
              ),
        profile: routeWorldProfile,
        runSeed,
        rulesVersion,
        level,
        forbiddenPairKeys: [DECOY_PAIR_KEY, WILD_PAIR_KEY]
    });
    const dungeonPairTiles = assignDungeonCardsToTiles(
        routeTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode,
        dungeonBlueprint ?? undefined
    );
    const dungeonFillerTiles = assignDungeonFillerCardsToTiles(
        dungeonPairTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode,
        encounter.nodeKind
    );
    const exitAdded = options.gameMode
        ? addDungeonExitTile(dungeonFillerTiles, dungeonBlueprint!)
        : null;
    const shopAdded = dungeonBlueprint
        ? addDungeonShopTile(exitAdded?.tiles ?? dungeonFillerTiles, dungeonBlueprint)
        : { tiles: exitAdded?.tiles ?? dungeonFillerTiles, shopTileId: null };
    const roomAdded = dungeonBlueprint
        ? addDungeonRoomTile(shopAdded.tiles, dungeonBlueprint)
        : { tiles: shopAdded.tiles, roomTileId: null };
    const hazardTiles = assignHazardTilesToGeneratedBoard(
        roomAdded.tiles,
        runSeed,
        rulesVersion,
        level,
        options.gameMode
    );
    const tiles = applyDungeonLayoutPlan(
        hazardTiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        options.gameMode
    );
    const tileCount = tiles.length;
    const columns = clamp(Math.ceil(Math.sqrt(tileCount)), 2, 8);
    const rows = Math.ceil(tileCount / columns);
    const cursedPairKey =
        featuredObjectiveId === 'cursed_last' || featuredObjectiveId === null
            ? pickCursedPairKey(tiles, runSeed, rulesVersion, level)
            : null;
    const enemyHazards = createEnemyHazardsForBoard({
        tiles,
        runSeed,
        rulesVersion,
        level,
        floorTag,
        floorArchetypeId,
        nodeKind: encounter.nodeKind,
        bossId: dungeonBlueprint?.bossId ?? null,
        gameMode: options.gameMode
    });
    const baseBoard: BoardState = {
        level,
        pairCount,
        columns,
        rows,
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        floorTag,
        cursedPairKey,
        floorArchetypeId,
        featuredObjectiveId,
        cycleFloor,
        actTitle: actBiome?.actTitle ?? null,
        actFloorNumber: actBiome?.actFloorNumber ?? null,
        actFloorCount: actBiome?.actFloorCount ?? null,
        biomeTitle: actBiome?.biomeTitle ?? null,
        biomeTone: actBiome?.biomeTone ?? null,
        routeWorldProfile,
        selectedGatewayRouteType: null,
        dungeonKeysHeld: 0,
        dungeonExitTileId: exitAdded?.exitTileId ?? null,
        dungeonExitActivated: false,
        dungeonExitLockKind: exitAdded?.lockKind ?? 'none',
        dungeonExitRequiredLeverCount: exitAdded?.requiredLevers ?? 0,
        dungeonLeverCount: 0,
        dungeonShopTileId: shopAdded.shopTileId,
        dungeonShopVisited: false,
        dungeonBossId: dungeonBlueprint?.bossId ?? null,
        dungeonObjectiveId: dungeonBlueprint?.objectiveId ?? 'find_exit',
        enemyHazards,
        enemyHazardTurn: 0
    };
    if (!mutators.includes('shifting_spotlight')) {
        return { ...baseBoard, wardPairKey: null, bountyPairKey: null };
    }
    const { wardPairKey, bountyPairKey } = pickShiftingSpotlightKeys(
        baseBoard,
        runSeed,
        rulesVersion,
        level,
        'init'
    );
    return { ...baseBoard, wardPairKey, bountyPairKey };
};

/**
 * Floor is complete when every tile is matched or removed.
 * **Glass decoy** (`DECOY_PAIR_KEY`): singleton decoy trap — it never pairs; intent is to clear all **real** tiles
 * and leave the decoy face-down for the glass-witness bonus. Completion when every **non-decoy** tile is
 * matched or removed and the decoy (if present) is still **hidden** (unflipped).
 */
export const isBoardComplete = (board: BoardState): boolean =>
    (board.dungeonExitTileId ? board.dungeonExitActivated === true : true) &&
    board.tiles.every((t) => {
        if (isSingletonUtilityPairKey(t.pairKey) && t.pairKey !== DECOY_PAIR_KEY) {
            return true;
        }
        if (t.state === 'matched' || t.state === 'removed') {
            return true;
        }
        if (
            t.pairKey === DECOY_PAIR_KEY &&
            (t.state === 'hidden' || (t.tileHazardKind === 'mirror_decoy' && t.state === 'flipped'))
        ) {
            return board.tiles
                .filter((x) => !isSingletonUtilityPairKey(x.pairKey))
                .every((x) => x.state === 'matched' || x.state === 'removed');
        }
        return false;
    });

const tileIsSafeHazardEffectTarget = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.findableKind == null &&
    tile.tileHazardKind == null;

const applyShuffleSnareHazard = (board: BoardState, run: RunState): { board: BoardState; triggered: boolean } => {
    const hiddenIndices: number[] = [];
    board.tiles.forEach((tile, index) => {
        if (tileIsSafeHazardEffectTarget(tile) && tile.pairKey !== board.cursedPairKey) {
            hiddenIndices.push(index);
        }
    });
    if (hiddenIndices.length < 2) {
        return { board, triggered: false };
    }
    const rng = createMulberry32(
        hashStringToSeed(
            `hazardSnare:${run.runRulesVersion}:${run.runSeed}:${board.level}:${run.hazardShuffleSnaresThisFloor}:${run.hazardTileTriggersThisFloor}`
        )
    );
    const nextTiles = [...board.tiles];
    const shuffled = shuffleWithRng(
        () => rng(),
        hiddenIndices.map((index) => board.tiles[index]!)
    );
    hiddenIndices.forEach((index, slot) => {
        nextTiles[index] = shuffled[slot]!;
    });
    return { board: { ...board, tiles: nextTiles }, triggered: true };
};

const applyCascadeCacheHazard = (board: BoardState, run: RunState, matchedPairKey: string): { board: BoardState; triggered: boolean } => {
    const blockedPairKeys = new Set<string>([matchedPairKey]);
    if (board.cursedPairKey) {
        blockedPairKeys.add(board.cursedPairKey);
    }
    const pairKeys = [
        ...new Set(
            board.tiles
                .filter((tile) => tileIsSafeHazardEffectTarget(tile) && !blockedPairKeys.has(tile.pairKey))
                .map((tile) => tile.pairKey)
        )
    ].filter((pairKey) => board.tiles.filter((tile) => tile.pairKey === pairKey && tileIsSafeHazardEffectTarget(tile)).length === 2);
    if (pairKeys.length === 0) {
        return { board, triggered: false };
    }
    const rng = createMulberry32(
        hashStringToSeed(
            `hazardCascade:${run.runRulesVersion}:${run.runSeed}:${board.level}:${run.hazardCascadeCachesThisFloor}:${matchedPairKey}`
        )
    );
    const targetPairKey = shuffleWithRng(() => rng(), pairKeys)[0]!;
    return {
        board: {
            ...board,
            matchedPairs: board.matchedPairs + 1,
            tiles: board.tiles.map((tile) =>
                tile.pairKey === targetPairKey ? { ...tile, state: 'removed' as const } : tile
            )
        },
        triggered: true
    };
};

const withAnchorSealPressureRotation = (
    run: RunState,
    board: BoardState
): { board: BoardState; shiftingSpotlightNonce: number; anchorSealUsed: boolean } => {
    if (hasMutator(run, 'shifting_spotlight') && !isBoardComplete(board) && run.anchorSealChargesThisFloor > 0) {
        return {
            board,
            shiftingSpotlightNonce: run.shiftingSpotlightNonce ?? 0,
            anchorSealUsed: true
        };
    }
    return {
        ...withRotatedShiftingSpotlight(run, board),
        anchorSealUsed: false
    };
};

const breakFragileCacheHazards = (
    board: BoardState,
    sourceTiles: readonly Tile[]
): { board: BoardState; brokenCount: number } => {
    const brokenPairKeys = new Set(
        sourceTiles
            .filter((tile) => tile.tileHazardKind === 'fragile_cache')
            .map((tile) => tile.pairKey)
    );
    if (brokenPairKeys.size === 0) {
        return { board, brokenCount: 0 };
    }
    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) =>
                brokenPairKeys.has(tile.pairKey) && tile.tileHazardKind === 'fragile_cache'
                    ? { ...tile, tileHazardKind: undefined }
                    : tile
            )
        },
        brokenCount: brokenPairKeys.size
    };
};

const applySafeHazardWardMismatch = (
    run: RunState,
    board: BoardState,
    sourceTiles: readonly Tile[],
    mismatchHazards: ReadonlySet<HazardTileKind>
): {
    board: BoardState;
    fragileBreak: { board: BoardState; brokenCount: number };
    snareHazard: { board: BoardState; triggered: boolean };
    wardUsed: boolean;
} => {
    const hasWardCharge = (run.safeHazardWardChargesThisFloor ?? 0) > 0;
    const blocksSnare = hasWardCharge && mismatchHazards.has('shuffle_snare');
    const blocksFragile =
        hasWardCharge &&
        !blocksSnare &&
        sourceTiles.some((tile) => tile.tileHazardKind === 'fragile_cache');
    const fragileBreak = blocksFragile
        ? { board, brokenCount: 0 }
        : breakFragileCacheHazards(board, sourceTiles);
    const snareHazard =
        mismatchHazards.has('shuffle_snare') && !blocksSnare
            ? applyShuffleSnareHazard(fragileBreak.board, run)
            : { board: fragileBreak.board, triggered: false };

    return {
        board: snareHazard.board,
        fragileBreak,
        snareHazard,
        wardUsed: blocksSnare || blocksFragile
    };
};

const hazardKindsInTiles = (tiles: readonly Tile[], ids: readonly string[]): Set<HazardTileKind> => {
    const idsSet = new Set(ids);
    const kinds = new Set<HazardTileKind>();
    for (const tile of tiles) {
        if (idsSet.has(tile.id) && tile.tileHazardKind) {
            kinds.add(tile.tileHazardKind);
        }
    }
    return kinds;
};

/** Pairs where both tiles are still hidden (eligible for shuffle / destroy targeting). */
export const countFullyHiddenPairs = (board: BoardState): number => {
    const hiddenCountByKey = new Map<string, number>();

    for (const tile of board.tiles) {
        if (tile.state === 'hidden') {
            hiddenCountByKey.set(tile.pairKey, (hiddenCountByKey.get(tile.pairKey) ?? 0) + 1);
        }
    }
    // removed tiles do not contribute

    let fullPairs = 0;
    for (const count of hiddenCountByKey.values()) {
        if (count >= 2) {
            fullPairs += 1;
        }
    }

    return fullPairs;
};

export type BoardFairnessIssueCode =
    | 'real_pair_incomplete'
    | 'real_pair_missing_actionable_tile'
    | 'decoy_flipped_or_cleared_before_completion'
    | 'wild_singleton_unmatched_without_route'
    | 'matched_pairs_counter_mismatch'
    | 'board_tile_count_mismatch'
    | 'flipped_tile_reference_missing'
    | 'exit_card_missing'
    | 'exit_tile_reference_missing'
    | 'exit_card_mismatch'
    | 'exit_lock_unreachable'
    | 'enemy_hazard_tile_reference_missing'
    | 'enemy_hazard_on_cleared_tile'
    | 'dungeon_card_pair_mismatch'
    | 'dungeon_card_hp_mismatch'
    | 'dungeon_objective_unreachable'
    | 'run_has_no_board'
    | 'run_terminal_incomplete_board'
    | 'run_resolving_without_flipped_tiles';

export interface BoardFairnessIssue {
    code: BoardFairnessIssueCode;
    message: string;
    tileIds?: string[];
    pairKey?: string;
}

export interface BoardFairnessReport {
    complete: boolean;
    issues: BoardFairnessIssue[];
    realPairKeys: string[];
    actionableRealPairKeys: string[];
    hiddenRealPairKeys: string[];
    decoyTileIds: string[];
    wildTileIds: string[];
    hasCompletionRoute: boolean;
}

const tileIsActionableForCompletion = (tile: Tile): boolean =>
    tile.state === 'hidden' || tile.state === 'flipped';

const pairIsCleared = (tiles: readonly Tile[]): boolean =>
    tiles.every((tile) => tile.state === 'matched' || tile.state === 'removed');

const tileIsClearedForFairness = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const countUnclearedDungeonPairs = (tiles: readonly Tile[], predicate: (tile: Tile) => boolean): number => {
    const pairKeys = new Set<string>();
    for (const tile of tiles) {
        if (!tileIsClearedForFairness(tile) && predicate(tile)) {
            pairKeys.add(tile.pairKey);
        }
    }
    return pairKeys.size;
};

/**
 * REG-087 anti-softlock inspection for board structure and completion reachability.
 *
 * This is intentionally rules-only and side-effect free: it does not solve perfect play, but it catches
 * malformed/orphaned pairs, stale completion counters, flipped decoys, and singleton wild boards that no longer have
 * a legal path to finish. Decoys are allowed as hidden singleton traps; wild tiles are allowed only while at least one
 * real actionable tile or stray-removal route remains.
 */
export const inspectBoardFairness = (board: BoardState): BoardFairnessReport => {
    const issues: BoardFairnessIssue[] = [];
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }

    const realPairKeys: string[] = [];
    const actionableRealPairKeys: string[] = [];
    const hiddenRealPairKeys: string[] = [];
    const decoyTileIds = groups.get(DECOY_PAIR_KEY)?.map((tile) => tile.id) ?? [];
    const wildTiles = groups.get(WILD_PAIR_KEY) ?? [];
    const wildTileIds = wildTiles.map((tile) => tile.id);
    const exitTiles = groups.get(EXIT_PAIR_KEY) ?? [];

    let structurallyClearable = true;
    let matchedOrRemovedRealPairs = 0;

    for (const [pairKey, tiles] of groups) {
        if (isSingletonUtilityPairKey(pairKey)) {
            continue;
        }
        realPairKeys.push(pairKey);
        const tileIds = tiles.map((tile) => tile.id);
        if (tiles.length !== 2) {
            structurallyClearable = false;
            issues.push({
                code: 'real_pair_incomplete',
                message: `Real pair "${pairKey}" has ${tiles.length} tile(s); exactly 2 are required.`,
                pairKey,
                tileIds
            });
            continue;
        }
        if (pairIsCleared(tiles)) {
            matchedOrRemovedRealPairs += 1;
            continue;
        }
        const actionableTiles = tiles.filter(tileIsActionableForCompletion);
        if (actionableTiles.length !== 2) {
            structurallyClearable = false;
            issues.push({
                code: 'real_pair_missing_actionable_tile',
                message: `Real pair "${pairKey}" is partially unavailable before completion.`,
                pairKey,
                tileIds
            });
            continue;
        }
        actionableRealPairKeys.push(pairKey);
        if (actionableTiles.every((tile) => tile.state === 'hidden')) {
            hiddenRealPairKeys.push(pairKey);
        }
    }

    const nonUtilityTileCount = board.tiles.filter((tile) => !isSingletonUtilityPairKey(tile.pairKey)).length;
    const expectedNonUtilityTileCount = board.pairCount * 2;
    if (nonUtilityTileCount !== expectedNonUtilityTileCount) {
        structurallyClearable = false;
        issues.push({
            code: 'board_tile_count_mismatch',
            message: `Board has ${nonUtilityTileCount} non-utility tile(s), expected ${expectedNonUtilityTileCount} from pairCount.`
        });
    }

    if (board.dungeonExitTileId && exitTiles.length === 0) {
        structurallyClearable = false;
        issues.push({ code: 'exit_card_missing', message: 'Board declares an exit tile, but no exit card exists.' });
    }
    if (board.dungeonExitTileId) {
        const declaredExit = board.tiles.find((tile) => tile.id === board.dungeonExitTileId);
        if (!declaredExit) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_tile_reference_missing',
                message: `Board declares exit tile "${board.dungeonExitTileId}", but that tile does not exist.`,
                tileIds: [board.dungeonExitTileId]
            });
        } else if (declaredExit.pairKey !== EXIT_PAIR_KEY || declaredExit.dungeonCardKind !== 'exit') {
            structurallyClearable = false;
            issues.push({
                code: 'exit_card_mismatch',
                message: `Declared exit tile "${declaredExit.id}" is not an exit card.`,
                pairKey: declaredExit.pairKey,
                tileIds: [declaredExit.id]
            });
        }
    }
    const primaryExit = board.dungeonExitTileId
        ? board.tiles.find((tile) => tile.id === board.dungeonExitTileId)
        : exitTiles[0];
    const exitLockKind = primaryExit?.dungeonExitLockKind ?? board.dungeonExitLockKind ?? 'none';
    const requiredLeverCount =
        primaryExit?.dungeonExitRequiredLeverCount ?? board.dungeonExitRequiredLeverCount ?? 0;
    if (exitLockKind === 'lever' && (board.dungeonLeverCount ?? 0) < requiredLeverCount) {
        const leverPairCount = countUnclearedDungeonPairs(board.tiles, (tile) => tile.dungeonCardKind === 'lever');
        if ((board.dungeonLeverCount ?? 0) + leverPairCount < requiredLeverCount) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_lock_unreachable',
                message: `Lever-locked exit requires ${requiredLeverCount} lever(s), but only ${(board.dungeonLeverCount ?? 0) + leverPairCount} can be reached.`
            });
        }
    }
    if (board.matchedPairs !== matchedOrRemovedRealPairs) {
        issues.push({
            code: 'matched_pairs_counter_mismatch',
            message: `matchedPairs is ${board.matchedPairs}, but ${matchedOrRemovedRealPairs} real pair(s) are matched or removed.`
        });
    }

    const realTilesComplete = realPairKeys.length > 0 && realPairKeys.length === matchedOrRemovedRealPairs;
    for (const decoy of groups.get(DECOY_PAIR_KEY) ?? []) {
        if (decoy.state !== 'hidden' && !(decoy.tileHazardKind === 'mirror_decoy' && decoy.state === 'flipped') && !realTilesComplete) {
            structurallyClearable = false;
            issues.push({
                code: 'decoy_flipped_or_cleared_before_completion',
                message: 'Glass decoy must stay hidden until all real pairs are cleared.',
                pairKey: DECOY_PAIR_KEY,
                tileIds: [decoy.id]
            });
        }
    }

    const actionableRealTileExists = actionableRealPairKeys.length > 0;
    const hiddenRealTileExists = board.tiles.some(
        (tile) => !isSingletonUtilityPairKey(tile.pairKey) && tile.state === 'hidden'
    );
    for (const wild of wildTiles) {
        if (tileIsActionableForCompletion(wild) && !actionableRealTileExists && !hiddenRealTileExists) {
            structurallyClearable = false;
            issues.push({
                code: 'wild_singleton_unmatched_without_route',
                message: 'Wild singleton is still actionable, but no real hidden tile or removal route remains.',
                pairKey: WILD_PAIR_KEY,
                tileIds: [wild.id]
            });
        }
    }

    for (const flippedId of board.flippedTileIds) {
        if (!board.tiles.some((tile) => tile.id === flippedId && tile.state === 'flipped')) {
            issues.push({
                code: 'flipped_tile_reference_missing',
                message: `flippedTileIds references "${flippedId}", but no matching flipped tile exists.`,
                tileIds: [flippedId]
            });
        }
    }

    for (const [pairKey, tiles] of groups) {
        if (isSingletonUtilityPairKey(pairKey) || pairIsCleared(tiles)) {
            continue;
        }
        const dungeonTiles = tiles.filter((tile) => !tileIsClearedForFairness(tile) && tile.dungeonCardKind != null);
        if (dungeonTiles.length === 0) {
            continue;
        }
        const tileIds = tiles.map((tile) => tile.id);
        const first = dungeonTiles[0]!;
        if (
            tiles.length !== dungeonTiles.length ||
            dungeonTiles.some(
                (tile) =>
                    tile.dungeonCardKind !== first.dungeonCardKind ||
                    tile.dungeonCardEffectId !== first.dungeonCardEffectId ||
                    tile.dungeonBossId !== first.dungeonBossId
            )
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_card_pair_mismatch',
                message: `Dungeon pair "${pairKey}" has inconsistent card metadata.`,
                pairKey,
                tileIds
            });
        }
        if (
            first.dungeonCardKind === 'enemy' &&
            dungeonTiles.some(
                (tile) =>
                    tile.dungeonCardHp !== first.dungeonCardHp ||
                    tile.dungeonCardMaxHp !== first.dungeonCardMaxHp
            )
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_card_hp_mismatch',
                message: `Enemy pair "${pairKey}" has inconsistent HP metadata.`,
                pairKey,
                tileIds
            });
        }
    }

    const tileById = new Map(board.tiles.map((tile) => [tile.id, tile]));
    for (const hazard of board.enemyHazards ?? []) {
        if (hazard.state === 'defeated') {
            continue;
        }
        for (const tileId of [hazard.currentTileId, hazard.nextTileId]) {
            const tile = tileById.get(tileId);
            if (!tile) {
                structurallyClearable = false;
                issues.push({
                    code: 'enemy_hazard_tile_reference_missing',
                    message: `Enemy hazard "${hazard.id}" references missing tile "${tileId}".`,
                    tileIds: [tileId]
                });
            } else if (tileIsClearedForFairness(tile)) {
                structurallyClearable = false;
                issues.push({
                    code: 'enemy_hazard_on_cleared_tile',
                    message: `Enemy hazard "${hazard.id}" references cleared tile "${tileId}".`,
                    tileIds: [tileId]
                });
            }
        }
    }

    if (board.dungeonObjectiveId === 'defeat_boss') {
        const hasBossRoute =
            board.dungeonBossId != null ||
            board.tiles.some((tile) => !tileIsClearedForFairness(tile) && tile.dungeonBossId != null) ||
            (board.enemyHazards ?? []).some((hazard) => hazard.bossId != null && hazard.state !== 'defeated');
        if (!hasBossRoute) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_objective_unreachable',
                message: 'Defeat-boss objective is active, but no boss card or boss hazard exists.'
            });
        }
    }

    const hasCompletionRoute = structurallyClearable && (isBoardComplete(board) || actionableRealPairKeys.length > 0);

    return {
        complete: isBoardComplete(board),
        issues,
        realPairKeys,
        actionableRealPairKeys,
        hiddenRealPairKeys,
        decoyTileIds,
        wildTileIds,
        hasCompletionRoute
    };
};

export interface RunFairnessReport extends BoardFairnessReport {
    status: RunStatus | 'missingBoard';
    intentionalBlockers: string[];
}

/** REG-087 run-level wrapper around board fairness: classifies intentional transient blockers separately from issues. */
export const inspectRunFairness = (run: RunState): RunFairnessReport => {
    if (!run.board) {
        return {
            complete: false,
            issues: [
                {
                    code: 'run_has_no_board',
                    message: 'Run has no board to inspect.'
                }
            ],
            realPairKeys: [],
            actionableRealPairKeys: [],
            hiddenRealPairKeys: [],
            decoyTileIds: [],
            wildTileIds: [],
            hasCompletionRoute: false,
            status: 'missingBoard',
            intentionalBlockers: []
        };
    }

    const boardReport = inspectBoardFairness(run.board);
    const issues = [...boardReport.issues];
    const intentionalBlockers: string[] = [];

    if (run.status === 'memorize') {
        intentionalBlockers.push('memorize_window');
    }
    if (run.status === 'paused') {
        intentionalBlockers.push('paused');
    }
    if (run.status === 'levelComplete') {
        intentionalBlockers.push('level_complete');
    }
    if (run.status === 'resolving') {
        if (run.board.flippedTileIds.length >= 2) {
            intentionalBlockers.push('resolving_flips');
        } else {
            issues.push({
                code: 'run_resolving_without_flipped_tiles',
                message: 'Run is resolving without enough flipped tiles to resolve.'
            });
        }
    }
    if (run.status === 'gameOver' && !boardReport.complete) {
        issues.push({
            code: 'run_terminal_incomplete_board',
            message: 'Run is terminal while the board is incomplete.'
        });
    }

    return {
        ...boardReport,
        issues,
        status: run.status,
        intentionalBlockers
    };
};

export const canShuffleBoard = (run: RunState): boolean =>
    run.status === 'playing' &&
    Boolean(run.board) &&
    run.board!.flippedTileIds.length === 0 &&
    !run.activeContract?.noShuffle &&
    (run.shuffleCharges > 0 ||
        (run.freeShuffleThisFloor && run.relicIds.includes('first_shuffle_free_per_floor'))) &&
    countFullyHiddenPairs(run.board!) >= 2;

export const canDestroyPair = (run: RunState, tileId: string): boolean => {
    if (run.status !== 'playing' || !run.board || run.board.flippedTileIds.length !== 0 || run.destroyPairCharges <= 0) {
        return false;
    }

    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden' || tile.pairKey === DECOY_PAIR_KEY) {
        return false;
    }

    const pairTiles = run.board.tiles.filter((t) => t.pairKey === tile.pairKey);
    return pairTiles.length === 2 && pairTiles.every((t) => t.state === 'hidden');
};

/**
 * Board-only checks for destroy targeting (mirrors `canDestroyPair` tile rules).
 * Caller gates run status, charges, contract `noDestroy`, armed state, and flipped tiles.
 */
export const tileIsDestroyEligiblePreview = (board: BoardState, tileId: string): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden' || tile.pairKey === DECOY_PAIR_KEY) {
        return false;
    }
    const pairTiles = board.tiles.filter((t) => t.pairKey === tile.pairKey);
    return pairTiles.length === 2 && pairTiles.every((t) => t.state === 'hidden');
};

/** All tile ids that are valid destroy targets when run rules would allow destroy (fully hidden real pairs). */
export const collectDestroyEligibleTileIds = (board: BoardState): Set<string> => {
    const eligible = new Set<string>();
    for (const tile of board.tiles) {
        if (tileIsDestroyEligiblePreview(board, tile.id)) {
            eligible.add(tile.id);
        }
    }
    return eligible;
};

/** Peek can target any still-hidden tile that has not already been peek-revealed this floor. */
export const tileIsPeekEligiblePreview = (
    board: BoardState,
    peekRevealedTileIds: readonly string[],
    tileId: string
): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return false;
    }
    return !peekRevealedTileIds.includes(tileId);
};

export const collectPeekEligibleTileIds = (
    board: BoardState,
    peekRevealedTileIds: readonly string[]
): Set<string> => {
    const eligible = new Set<string>();
    for (const tile of board.tiles) {
        if (tileIsPeekEligiblePreview(board, peekRevealedTileIds, tile.id)) {
            eligible.add(tile.id);
        }
    }
    return eligible;
};

const STRAY_PROTECTED_ROUTE_SPECIALS = new Set<RouteSpecialKind>([
    'keystone_pair',
    'final_ward',
    'omen_seal'
]);

const PEEK_REVEALED_ROUTE_SPECIALS = new Set<RouteSpecialKind>([
    'mystery_veil',
    'secret_door',
    'omen_seal',
    'mimic_cache',
    'loaded_gateway',
    'parasite_vessel'
]);

const isCompletionSafeStrayPairKey = (pairKey: string): boolean =>
    pairKey === WILD_PAIR_KEY || pairKey === SHOP_PAIR_KEY || pairKey === ROOM_PAIR_KEY;

const tileIsCompletionSafeStrayTarget = (board: BoardState, tileId: string): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    return Boolean(
        tile &&
            tile.state === 'hidden' &&
            tile.pairKey !== DECOY_PAIR_KEY &&
            isCompletionSafeStrayPairKey(tile.pairKey) &&
            (!tile.routeSpecialKind || !STRAY_PROTECTED_ROUTE_SPECIALS.has(tile.routeSpecialKind))
    );
};

/** Stray remove targets hidden completion-safe singleton/special tiles (mirrors `applyStrayRemove`). */
export const tileIsStrayEligiblePreview = (board: BoardState, tileId: string): boolean => {
    return tileIsCompletionSafeStrayTarget(board, tileId);
};

export const applyShuffle = (run: RunState): RunState => {
    if (!canShuffleBoard(run) || !run.board) {
        return run;
    }

    const hiddenIndices: number[] = [];
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden') {
            hiddenIndices.push(index);
        }
    });

    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, run.shuffleNonce, run.runRulesVersion)
    );
    const cols = run.board.columns;
    const nextTiles = [...run.board.tiles];

    if (run.weakerShuffleMode === 'rows_only') {
        const rowToIndices = new Map<number, number[]>();
        for (const index of hiddenIndices) {
            const row = Math.floor(index / cols);
            const list = rowToIndices.get(row) ?? [];
            list.push(index);
            rowToIndices.set(row, list);
        }
        for (const indices of rowToIndices.values()) {
            const chunk = indices.map((i) => nextTiles[i]!);
            const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
            indices.forEach((cellIdx, slot) => {
                nextTiles[cellIdx] = shuffledChunk[slot]!;
            });
        }
    } else {
        const hiddenTiles = hiddenIndices.map((index) => run.board!.tiles[index]);
        const shuffled = shuffleWithRng(() => shuffleRng(), hiddenTiles);
        hiddenIndices.forEach((index, slot) => {
            nextTiles[index] = shuffled[slot]!;
        });
    }

    let nextCharges = run.shuffleCharges;
    let nextFree = run.freeShuffleThisFloor;
    if (nextFree && run.relicIds.includes('first_shuffle_free_per_floor')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    }

    let matchScoreMultiplier = run.matchScoreMultiplier;
    if (run.shuffleScoreTaxActive) {
        matchScoreMultiplier *= SHUFFLE_SCORE_TAX_FACTOR;
    }

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleCharges: nextCharges,
        shuffleNonce: run.shuffleNonce + 1,
        freeShuffleThisFloor: nextFree,
        matchScoreMultiplier,
        pinnedTileIds: [],
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...run.stats,
            shufflesUsed: run.stats.shufflesUsed + 1
        }
    };
};

export const canRegionShuffle = (run: RunState): boolean =>
    run.status === 'playing' &&
    Boolean(run.board) &&
    run.board!.flippedTileIds.length === 0 &&
    !run.activeContract?.noShuffle &&
    (run.regionShuffleCharges > 0 ||
        (run.regionShuffleFreeThisFloor && run.relicIds.includes('region_shuffle_free_first'))) &&
    countFullyHiddenPairs(run.board!) >= 1;

/** Row shuffle needs at least two hidden tiles in that row. */
export const canRegionShuffleRow = (run: RunState, rowIndex: number): boolean => {
    if (!canRegionShuffle(run) || !run.board) {
        return false;
    }
    const cols = run.board.columns;
    let hidden = 0;
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hidden += 1;
        }
    });
    return hidden >= 2;
};

export const armRegionShuffleRow = (run: RunState, row: number | null): RunState =>
    run.status === 'playing' && run.board ? { ...run, regionShuffleRowArmed: row } : run;

export const applyRegionShuffle = (run: RunState, rowIndex: number): RunState => {
    if (!canRegionShuffle(run) || !run.board) {
        return run;
    }
    const cols = run.board.columns;
    const hiddenInRow: number[] = [];
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hiddenInRow.push(index);
        }
    });
    if (hiddenInRow.length < 2) {
        return run;
    }

    let nextFree = run.regionShuffleFreeThisFloor;
    let nextCharges = run.regionShuffleCharges;
    if (nextFree && run.relicIds.includes('region_shuffle_free_first')) {
        nextFree = false;
    } else if (nextCharges > 0) {
        nextCharges -= 1;
    } else {
        return run;
    }

    const shuffleRng = createMulberry32(
        deriveShuffleRngSeed(run.runSeed, run.board.level, run.shuffleNonce, run.runRulesVersion)
    );
    const nextTiles = [...run.board.tiles];
    const chunk = hiddenInRow.map((i) => nextTiles[i]!);
    const shuffledChunk = shuffleWithRng(() => shuffleRng(), chunk);
    hiddenInRow.forEach((cellIdx, slot) => {
        nextTiles[cellIdx] = shuffledChunk[slot]!;
    });

    return {
        ...run,
        powersUsedThisRun: true,
        shuffleUsedThisFloor: true,
        shuffleNonce: run.shuffleNonce + 1,
        regionShuffleCharges: nextCharges,
        regionShuffleFreeThisFloor: nextFree,
        regionShuffleRowArmed: null,
        pinnedTileIds: [],
        board: {
            ...run.board,
            tiles: nextTiles
        },
        stats: {
            ...run.stats,
            shufflesUsed: run.stats.shufflesUsed + 1
        }
    };
};

export const applyFlashPair = (run: RunState): RunState => {
    if (run.status !== 'playing' || !run.board || run.flashPairCharges < 1) {
        return run;
    }
    if (!run.practiceMode && !run.wildMenuRun) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const hiddenByKey = new Map<string, string[]>();
    for (const t of run.board.tiles) {
        if (t.state !== 'hidden' || t.pairKey === DECOY_PAIR_KEY) {
            continue;
        }
        const list = hiddenByKey.get(t.pairKey) ?? [];
        list.push(t.id);
        hiddenByKey.set(t.pairKey, list);
    }
    const complete = [...hiddenByKey.values()].filter((ids) => ids.length >= 2);
    if (complete.length === 0) {
        return run;
    }
    const rng = createMulberry32(
        hashStringToSeed(`flashPair:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${run.shuffleNonce}`)
    );
    const picked = complete[Math.floor(rng() * complete.length)]!;
    const pairIds = picked.slice(0, 2);
    return {
        ...run,
        flashPairCharges: run.flashPairCharges - 1,
        powersUsedThisRun: true,
        shuffleNonce: run.shuffleNonce + 1,
        flashPairRevealedTileIds: pairIds
    };
};

const maxPinnedTilesForRun = (run: RunState): number =>
    MAX_PINNED_TILES + (run.relicIds.includes('pin_cap_plus_one') ? 1 : 0);

export const togglePinnedTile = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }

    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }

    const isPinned = run.pinnedTileIds.includes(tileId);
    let pinnedTileIds: string[];

    if (isPinned) {
        pinnedTileIds = run.pinnedTileIds.filter((id) => id !== tileId);
    } else if (run.pinnedTileIds.length < maxPinnedTilesForRun(run)) {
        const cap = run.activeContract?.maxPinsTotalRun;
        if (cap != null && run.pinsPlacedCountThisRun >= cap) {
            return run;
        }
        pinnedTileIds = [...run.pinnedTileIds, tileId];
        return {
            ...run,
            pinnedTileIds,
            pinsPlacedCountThisRun: run.pinsPlacedCountThisRun + 1
        };
    } else {
        return run;
    }

    return {
        ...run,
        pinnedTileIds
    };
};

export interface CreateRunOptions {
    runSeed?: number;
    gameMode?: GameMode;
    activeMutators?: MutatorId[];
    practiceMode?: boolean;
    activeContract?: RunState['activeContract'];
    dailyDateKeyUtc?: string | null;
    puzzleId?: string | null;
    gauntletDurationMs?: number | null;
    fixedBoard?: BoardState | null;
    initialRelicIds?: RelicId[];
    /** Import / debug: use historical rules version for same tile order. */
    runRulesVersionOverride?: number;
    /** H4: add wild tile to generated boards. */
    enableWildJoker?: boolean;
    weakerShuffleMode?: WeakerShuffleMode;
    shuffleScoreTaxActive?: boolean;
    /** Hook powers: defaults on if undefined. */
    enablePeek?: boolean;
    initialStrayRemoveCharges?: number;
    resolveDelayMultiplier?: number;
    echoFeedbackEnabled?: boolean;
    wildMenuRun?: boolean;
    /** First-run guidance: build floor 1 as ordinary real pairs so prompts never target specials. */
    onboardingSafeFirstFloor?: boolean;
    /** Copied from save: +1 relic pick at each milestone when meta unlock is active. */
    metaRelicDraftExtraPerMilestone?: number;
}

const randomRunSeed = (): number => Math.floor(Math.random() * 0x7fffffff);

const applyRelicImmediate = (run: RunState, relicId: RelicId): RunState => {
    switch (relicId) {
        case 'extra_shuffle_charge':
            return { ...run, shuffleCharges: run.shuffleCharges + 1 };
        case 'destroy_bank_plus_one':
            return {
                ...run,
                destroyPairCharges: run.destroyPairCharges + 1
            };
        case 'first_shuffle_free_per_floor':
            return { ...run, freeShuffleThisFloor: true };
        case 'combo_shard_plus_step':
            return {
                ...run,
                stats: { ...run.stats, comboShards: Math.min(MAX_COMBO_SHARDS, run.stats.comboShards + 1) }
            };
        case 'memorize_under_short_memorize':
            return run;
        case 'parasite_ward_once':
            return { ...run, parasiteWardRemaining: run.parasiteWardRemaining + 1 };
        case 'region_shuffle_free_first':
            return run;
        case 'peek_charge_plus_one':
            return { ...run, peekCharges: run.peekCharges + 1 };
        case 'stray_charge_plus_one':
            return { ...run, strayRemoveCharges: run.strayRemoveCharges + 1 };
        case 'pin_cap_plus_one':
            return run;
        case 'guard_token_plus_one':
            return {
                ...run,
                stats: {
                    ...run.stats,
                    guardTokens: Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1)
                }
            };
        case 'shrine_echo':
            return grantBonusRelicPickNextOffer(run, 1);
        case 'chapter_compass':
        case 'wager_surety':
        case 'parasite_ledger':
            return run;
        default:
            return run;
    }
};

export const createNewRun = (bestScore: number, options: CreateRunOptions = {}): RunState => {
    const runSeed = options.runSeed ?? randomRunSeed();
    const gameMode = options.gameMode ?? 'endless';
    const rulesVersion = options.runRulesVersionOverride ?? GAME_RULES_VERSION;
    let activeMutators = options.activeMutators ?? [];
    let initialFloorTag: FloorTag = 'normal';
    let initialFloorArchetypeId: FloorArchetypeId | null = null;
    let initialFeaturedObjectiveId: FeaturedObjectiveId | null = null;
    let initialCycleFloor: number | null = null;
    const useOnboardingSafeFirstFloor = options.onboardingSafeFirstFloor === true && gameMode === 'endless';
    if (
        gameMode === 'endless' &&
        usesEndlessFloorSchedule(gameMode, rulesVersion) &&
        !options.wildMenuRun &&
        !useOnboardingSafeFirstFloor &&
        activeMutators.length === 0
    ) {
        const entry = pickFloorScheduleEntry(runSeed, rulesVersion, 1, gameMode);
        activeMutators = entry.mutators;
        initialFloorTag = entry.floorTag;
        initialFloorArchetypeId = entry.floorArchetypeId;
        initialFeaturedObjectiveId = entry.featuredObjectiveId;
        initialCycleFloor = entry.cycleFloor;
    }
    const weakerShuffleMode: WeakerShuffleMode = options.weakerShuffleMode ?? 'full';
    const shuffleScoreTaxActive = options.shuffleScoreTaxActive ?? false;
    const enableWildJoker = options.enableWildJoker ?? false;
    const peekCharges = options.enablePeek === false ? 0 : 1;
    const board =
        options.fixedBoard ??
        buildBoard(1, {
            runSeed,
            runRulesVersion: rulesVersion,
            activeMutators: useOnboardingSafeFirstFloor ? [] : activeMutators,
            includeWildTile: enableWildJoker,
            floorTag: initialFloorTag,
            floorArchetypeId: initialFloorArchetypeId,
            featuredObjectiveId: initialFeaturedObjectiveId,
            cycleFloor: initialCycleFloor,
            gameMode: useOnboardingSafeFirstFloor ? undefined : gameMode,
            suppressFindables: useOnboardingSafeFirstFloor
        });
    const dungeonRun = createDungeonRunMapState(runSeed, rulesVersion, 1);

    const run: RunState = {
        status: 'memorize',
        lives: INITIAL_LIVES,
        board,
        stats: createSessionStats(bestScore),
        achievementsEnabled: !options.practiceMode,
        debugUsed: false,
        debugPeekActive: false,
        pendingMemorizeBonusMs: 0,
        shuffleCharges: INITIAL_SHUFFLE_CHARGES,
        destroyPairCharges: 0,
        pinnedTileIds: [],
        powersUsedThisRun: false,
        timerState: createTimerState({ memorizeRemainingMs: null }),
        lastLevelResult: null,
        lastRunSummary: null,
        runSeed,
        runRulesVersion: rulesVersion,
        gameMode,
        shuffleNonce: 0,
        activeMutators,
        relicIds: [...(options.initialRelicIds ?? [])],
        relicTiersClaimed: 0,
        bonusRelicPicksNextOffer: 0,
        favorBonusRelicPicksNextOffer: 0,
        relicFavorProgress: 0,
        shopGold: 0,
        shopOffers: [],
        shopRerolls: 0,
        featuredObjectiveStreak: 0,
        endlessRiskWager: null,
        pendingRouteCardPlan: null,
        sideRoom: null,
        dungeonRun,
        bonusRewardLedger: createBonusRewardLedger(),
        metaRelicDraftExtraPerMilestone: options.metaRelicDraftExtraPerMilestone ?? 0,
        relicOffer: null,
        activeContract: options.activeContract ?? null,
        practiceMode: options.practiceMode ?? false,
        dailyDateKeyUtc: options.dailyDateKeyUtc ?? null,
        puzzleId: options.puzzleId ?? null,
        stickyBlockIndex: null,
        parasiteFloors: 0,
        freeShuffleThisFloor: false,
        gauntletDeadlineMs:
            options.gauntletDurationMs != null ? Date.now() + options.gauntletDurationMs : null,
        gauntletSessionDurationMs: options.gauntletDurationMs ?? null,
        dailyStreakCount: 0,
        flipHistory: [],
        peekCharges,
        peekRevealedTileIds: [],
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        wildTileId: getWildTileIdFromBoard(board),
        wildMatchesRemaining: enableWildJoker ? 1 : 0,
        strayRemoveCharges: options.initialStrayRemoveCharges ?? 0,
        strayRemoveArmed: false,
        matchScoreMultiplier: 1,
        nBackMatchCounter: 0,
        nBackAnchorPairKey: null,
        matchedPairKeysThisRun: [],
        weakerShuffleMode,
        shuffleScoreTaxActive,
        resolveDelayMultiplier: options.resolveDelayMultiplier ?? 1,
        echoFeedbackEnabled: options.echoFeedbackEnabled ?? true,
        wildMenuRun: options.wildMenuRun ?? false,
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(board),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        parasiteWardRemaining: 0,
        flashPairCharges:
            options.practiceMode || options.wildMenuRun ? 1 : 0,
        flashPairRevealedTileIds: [],
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        regionShuffleRowArmed: null,
        regionShuffleFreeThisFloor: false,
        pinsPlacedCountThisRun: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        hazardTileTriggersThisFloor: 0,
        hazardShuffleSnaresThisFloor: 0,
        hazardCascadeCachesThisFloor: 0,
        hazardMirrorDecoysThisFloor: 0,
        hazardFragileCacheClaimsThisFloor: 0,
        hazardFragileCacheBreaksThisFloor: 0,
        hazardTollCachesThisFloor: 0,
        hazardFuseCachesThisFloor: 0,
        hazardFuseCacheExpiredClaimsThisFloor: 0,
        lanternWardScoutsThisFloor: 0,
        omenSealScoutsThisFloor: 0,
        mimicCacheClaimsThisFloor: 0,
        mimicCacheBitesThisFloor: 0,
        mimicCacheGuardBitesThisFloor: 0,
        anchorSealChargesThisFloor: 0,
        anchorSealUsesThisFloor: 0,
        loadedGatewayPlansThisFloor: 0,
        catalystAltarUpgradesThisFloor: 0,
        parasiteVesselConversionsThisFloor: 0,
        pinLatticeRewardsThisFloor: 0,
        safeHazardWardChargesThisFloor: 0,
        safeHazardWardsUsedThisFloor: 0,
        shiftingSpotlightNonce: 0,
        dungeonEnemiesDefeated: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonTrapsTriggered: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpened: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        dungeonGatewaysUsed: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonKeys: {},
        dungeonMasterKeys: 0,
        dungeonShopVisitedThisFloor: false,
        enemyHazardHitsThisFloor: 0,
        enemyHazardsDefeatedThisFloor: 0
    };

    let runWithRelics = run;
    for (const relicId of runWithRelics.relicIds) {
        runWithRelics = applyRelicImmediate(runWithRelics, relicId);
    }

    const memorizeMs = getMemorizeDurationForRun(runWithRelics, 1) + runWithRelics.pendingMemorizeBonusMs;

    return {
        ...runWithRelics,
        freeShuffleThisFloor: runWithRelics.relicIds.includes('first_shuffle_free_per_floor'),
        regionShuffleFreeThisFloor: runWithRelics.relicIds.includes('region_shuffle_free_first'),
        timerState: createTimerState({ memorizeRemainingMs: memorizeMs })
    };
};

export const createMeditationRun = (
    bestScore: number,
    focusMutators?: MutatorId[],
    extra: Partial<CreateRunOptions> = {}
): RunState =>
    createNewRun(bestScore, {
        gameMode: 'meditation',
        activeMutators: focusMutators && focusMutators.length > 0 ? focusMutators : undefined,
        ...extra
    });

export const createWildRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState =>
    createNewRun(bestScore, {
        enableWildJoker: true,
        initialStrayRemoveCharges: 1,
        wildMenuRun: true,
        activeMutators: ['sticky_fingers', 'short_memorize', 'findables_floor'],
        ...extra
    });

export const createDungeonShowcaseRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState => {
    const runSeed = extra.runSeed ?? 72_001;
    const base = finishMemorizePhase(
        createNewRun(bestScore, {
            ...extra,
            gameMode: 'endless',
            practiceMode: true,
            runSeed,
            activeMutators: extra.activeMutators ?? ['wide_recall']
        })
    );
    const board = buildBoard(5, {
        activeMutators: base.activeMutators,
        dungeonNodeKind: 'combat',
        floorArchetypeId: 'survey_hall',
        floorTag: 'normal',
        gameMode: 'endless',
        runRulesVersion: base.runRulesVersion,
        runSeed
    });

    return {
        ...base,
        board,
        dungeonRun: createDungeonRunMapState(runSeed, base.runRulesVersion, 5),
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        lastLevelResult: null
    };
};

export const createDailyRun = (bestScore: number, extra: Partial<CreateRunOptions> = {}): RunState => {
    const runSeed = deriveDailyRunSeed(GAME_RULES_VERSION);
    const mutIndex = deriveDailyMutatorIndex(runSeed, DAILY_MUTATOR_TABLE.length);
    const activeMutators = [DAILY_MUTATOR_TABLE[mutIndex]!];

    return createNewRun(bestScore, {
        runSeed,
        gameMode: 'daily',
        activeMutators,
        dailyDateKeyUtc: formatDailyDateKeyUtc(),
        ...extra
    });
};

export const createGauntletRun = (
    bestScore: number,
    gauntletDurationMs: number = 10 * 60 * 1000,
    extra: Partial<CreateRunOptions> = {}
): RunState =>
    createNewRun(bestScore, {
        gameMode: 'gauntlet',
        gauntletDurationMs,
        ...extra
    });

export const createPuzzleRun = (
    bestScore: number,
    puzzleId: string,
    tiles: Tile[],
    level = 1,
    extra: Partial<CreateRunOptions> = {}
): RunState => {
    const columns = clamp(Math.ceil(Math.sqrt(tiles.length)), 2, 8);
    const rows = Math.ceil(tiles.length / columns);
    const pairCount = new Set(tiles.map((t) => t.pairKey).filter((k) => k !== DECOY_PAIR_KEY)).size;

    return createNewRun(bestScore, {
        gameMode: 'puzzle',
        puzzleId,
        fixedBoard: {
            level,
            pairCount,
            columns,
            rows,
            tiles: tiles.map((t) => ({ ...t })),
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null
        },
        ...extra
    });
};

export const isGauntletExpired = (run: RunState): boolean =>
    run.status !== 'paused' && run.gauntletDeadlineMs !== null && Date.now() > run.gauntletDeadlineMs;

/** Total relic selections this milestone visit (minimum 1). See `openRelicOffer`. */
export const computeRelicOfferPickBudget = (run: RunState): number => {
    let n = 1 + run.bonusRelicPicksNextOffer;
    if (hasMutator(run, 'generous_shrine')) {
        n += 1;
    }
    if (run.gameMode === 'daily') {
        n += 1;
    }
    n += run.metaRelicDraftExtraPerMilestone ?? 0;
    if (run.activeContract?.bonusRelicDraftPick) {
        n += 1;
    }
    return Math.max(1, n);
};

export const openRelicOffer = (run: RunState): RunState => {
    if (!needsRelicPick(run) || run.relicOffer) {
        return run;
    }
    const cleared = run.lastLevelResult!.level;
    const tierIndex = relicMilestoneIndexForFloor(cleared);
    if (tierIndex === null) {
        return run;
    }
    const picksRemaining = computeRelicOfferPickBudget(run);
    const options = rollRelicOptions(run, tierIndex, cleared, 0);
    if (options.length === 0) {
        return skipRelicOfferMilestone(run);
    }
    const contextualOptionReasons = getRelicDraftOptionReasons(run, cleared, options);

    return {
        ...run,
        bonusRelicPicksNextOffer: 0,
        favorBonusRelicPicksNextOffer: 0,
        relicOffer: {
            tier: tierIndex + 1,
            options,
            picksRemaining,
            pickRound: 0,
            services: getRelicOfferServiceActions({
                ...run,
                relicOffer: {
                    tier: tierIndex + 1,
                    options,
                    picksRemaining,
                    pickRound: 0
                }
            }),
            favorBonusPicks: run.favorBonusRelicPicksNextOffer,
            contextualOptionReasons
        }
    };
};

/** Increment extra selections for the next milestone draft (consumed in `openRelicOffer`). */
export const grantBonusRelicPickNextOffer = (run: RunState, amount: number = 1): RunState => ({
    ...run,
    bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer + amount
});

export const completeRelicPickAndAdvance = (run: RunState, relicId: RelicId): RunState => {
    const offer = run.relicOffer;
    if (!offer?.options.includes(relicId)) {
        return run;
    }

    let next: RunState = {
        ...run,
        relicIds: [...run.relicIds, relicId]
    };
    next = applyRelicImmediate(next, relicId);

    const remainingAfter = offer.picksRemaining - 1;

    if (remainingAfter > 0) {
        const cleared = run.lastLevelResult!.level;
        const tierIndex = relicMilestoneIndexForFloor(cleared);
        if (tierIndex === null) {
            return run;
        }
        const newPickRound = offer.pickRound + 1;
        const newOptions = rollRelicOptions(next, tierIndex, cleared, newPickRound);
        const contextualOptionReasons = getRelicDraftOptionReasons(next, cleared, newOptions);
        if (newOptions.length === 0) {
            next = {
                ...next,
                relicTiersClaimed: run.relicTiersClaimed + 1,
                relicOffer: null
            };
            return advanceToNextLevel(next);
        }
        return {
            ...next,
            relicOffer: {
                tier: offer.tier,
                options: newOptions,
                picksRemaining: remainingAfter,
                pickRound: newPickRound,
                serviceUses: offer.serviceUses,
                bannedRelicIds: offer.bannedRelicIds,
                upgradedOffer: offer.upgradedOffer,
                services: getRelicOfferServiceActions({
                    ...next,
                    relicOffer: {
                        ...offer,
                        options: newOptions,
                        picksRemaining: remainingAfter,
                        pickRound: newPickRound
                    }
                }),
                favorBonusPicks: offer.favorBonusPicks,
                contextualOptionReasons
            }
        };
    }

    next = {
        ...next,
        relicTiersClaimed: run.relicTiersClaimed + 1,
        relicOffer: null
    };
    return advanceToNextLevel(next);
};

export const applyRelicOfferServiceToRun = (
    run: RunState,
    serviceId: RelicOfferServiceId,
    targetRelicId?: RelicId
): RunState => {
    const result = applyRelicOfferService(run, serviceId, targetRelicId);
    return result.applied ? result.run : run;
};

export const useRelicOfferService = applyRelicOfferServiceToRun;

export const finishMemorizePhase = (run: RunState): RunState =>
    run.status !== 'memorize'
        ? run
        : {
              ...run,
              status: 'playing',
              timerState: {
                  ...run.timerState,
                  memorizeRemainingMs: null,
                  pausedFromStatus: null
              }
          };

export const flipTile = (run: RunState, tileId: string): RunState => {
    if (!run.board) {
        return run;
    }

    const gambitThirdWhileResolving =
        run.status === 'resolving' &&
        run.gambitAvailableThisFloor &&
        !run.gambitThirdFlipUsed &&
        run.board.flippedTileIds.length === 2;

    if (run.status !== 'playing' && !gambitThirdWhileResolving) {
        return run;
    }

    const runAfterFlashClear =
        run.flashPairRevealedTileIds.length > 0 ? { ...run, flashPairRevealedTileIds: [] } : run;
    const board = runAfterFlashClear.board;
    if (!board) {
        return runAfterFlashClear;
    }

    const allowThird =
        runAfterFlashClear.gambitAvailableThisFloor &&
        !runAfterFlashClear.gambitThirdFlipUsed &&
        board.flippedTileIds.length === 2;
    const maxFlips = allowThird ? 3 : 2;
    if (board.flippedTileIds.length >= maxFlips) {
        return runAfterFlashClear;
    }

    const tile = board.tiles.find((candidate) => candidate.id === tileId);

    if (!tile || (!isSprungTrapTile(tile) && tile.state !== 'hidden') || board.flippedTileIds.includes(tileId)) {
        return runAfterFlashClear;
    }

    const tileIndex = board.tiles.findIndex((candidate) => candidate.id === tileId);
    if (
        board.flippedTileIds.length === 0 &&
        runAfterFlashClear.stickyBlockIndex !== null &&
        tileIndex === runAfterFlashClear.stickyBlockIndex
    ) {
        return runAfterFlashClear;
    }

    if (tile.pairKey === EXIT_PAIR_KEY) {
        return revealDungeonExit(runAfterFlashClear, tileId);
    }
    if (tile.pairKey === SHOP_PAIR_KEY) {
        return revealDungeonShop(runAfterFlashClear, tileId);
    }
    if (tile.pairKey === ROOM_PAIR_KEY) {
        return revealDungeonRoom(runAfterFlashClear, tileId);
    }

    const runAfterDungeonReveal = tile.state === 'hidden' ? revealDungeonCardPair(runAfterFlashClear, tile) : runAfterFlashClear;
    if (runAfterDungeonReveal.status === 'gameOver') {
        return runAfterDungeonReveal;
    }
    const revealedBoard = runAfterDungeonReveal.board;
    if (!revealedBoard) {
        return runAfterDungeonReveal;
    }
    const peekRevealedTileIds =
        runAfterDungeonReveal.peekRevealedTileIds.length > 0 ? ([] as string[]) : runAfterDungeonReveal.peekRevealedTileIds;
    if (
        tile.state === 'hidden' &&
        tile.dungeonCardKind === 'trap' &&
        runAfterDungeonReveal.dungeonTrapsTriggered > runAfterFlashClear.dungeonTrapsTriggered
    ) {
        return {
            ...runAfterDungeonReveal,
            status: 'playing',
            peekRevealedTileIds,
            board: {
                ...revealedBoard,
                flippedTileIds: []
            },
            flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
            timerState: clearResolveState(runAfterDungeonReveal)
        };
    }

    const flippedTileIds = [...revealedBoard.flippedTileIds, tileId];
    const firstFlippedId = revealedBoard.flippedTileIds[0] ?? null;
    const firstFlippedTile = firstFlippedId
        ? revealedBoard.tiles.find((candidate) => candidate.id === firstFlippedId) ?? null
        : null;
    const revealedTile = revealedBoard.tiles.find((candidate) => candidate.id === tileId) ?? tile;
    const resolvesMatchImmediately =
        flippedTileIds.length === 2 &&
        firstFlippedTile !== null &&
        tilesArePairMatch(firstFlippedTile, revealedTile);

    let resolveRemainingMs = runAfterDungeonReveal.timerState.resolveRemainingMs;
    if (flippedTileIds.length === 2) {
        resolveRemainingMs = resolvesMatchImmediately
            ? 0
            : computeFlipResolveDelayMs(runAfterDungeonReveal, flippedTileIds, {
                  resolveDelayMultiplier: runAfterDungeonReveal.resolveDelayMultiplier,
                  echoFeedbackEnabled: runAfterDungeonReveal.echoFeedbackEnabled
              });
    } else if (flippedTileIds.length === 3) {
        resolveRemainingMs = MATCH_DELAY_MS * runAfterDungeonReveal.resolveDelayMultiplier;
    }

    return {
        ...runAfterDungeonReveal,
        peekRevealedTileIds,
        status: flippedTileIds.length >= 2 ? 'resolving' : 'playing',
        board: {
            ...revealedBoard,
            tiles: revealedBoard.tiles.map((candidate) =>
                candidate.id === tileId ? { ...candidate, state: 'flipped' } : candidate
            ),
            flippedTileIds
        },
        flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
        timerState: {
            ...runAfterDungeonReveal.timerState,
            resolveRemainingMs,
            pausedFromStatus: null
        }
    };
};

const finalizeLevel = (run: RunState, board: BoardState): RunState => {
    const floorClearHazards = defeatEnemyHazardsForFloorClear(board);
    const finalizedBoard: BoardState = { ...floorClearHazards.board, flippedTileIds: [] };
    const runWithFloorClearHazards =
        floorClearHazards.defeated > 0
            ? {
                  ...run,
                  dungeonEnemiesDefeated: run.dungeonEnemiesDefeated + floorClearHazards.bossesDefeated,
                  dungeonEnemiesDefeatedThisFloor:
                      (run.dungeonEnemiesDefeatedThisFloor ?? 0) + floorClearHazards.bossesDefeated,
                  enemyHazardsDefeatedThisFloor:
                      (run.enemyHazardsDefeatedThisFloor ?? 0) + floorClearHazards.defeated
              }
            : run;
    run = runWithFloorClearHazards;
    board = finalizedBoard;
    const perfect = run.stats.tries === 0;
    const clearLifeReason = getClearLifeReason(run.stats.tries);
    const clearLifeGained = clearLifeReason !== 'none' && run.lives < MAX_LIVES ? 1 : 0;
    const levelBonus = calculateLevelClearBonus(board.level);
    const perfectBonus = perfect ? calculatePerfectClearBonus() : 0;
    const bonusTags: string[] = [];
    let objectiveBonus = 0;
    const endlessFeaturedObjectiveActive = isEndlessFeaturedObjectiveBoard(run, board);
    const featuredObjectiveId = endlessFeaturedObjectiveActive ? board.featuredObjectiveId : null;
    const featuredObjectiveCompleted =
        featuredObjectiveId != null ? isFeaturedObjectiveCompleted(run, board, featuredObjectiveId) : false;
    let relicFavorGained = 0;
    let endlessRiskWagerFavorGained = 0;
    const activeEndlessRiskWager =
        featuredObjectiveId != null && run.endlessRiskWager?.targetLevel === board.level
            ? run.endlessRiskWager
            : null;
    const endlessRiskWagerOutcome =
        activeEndlessRiskWager != null ? (featuredObjectiveCompleted ? 'won' : 'lost') : undefined;
    const hasWagerSurety = run.relicIds.includes('wager_surety');
    const featuredObjectiveStreak =
        featuredObjectiveId != null
            ? featuredObjectiveCompleted
                ? run.featuredObjectiveStreak + 1
                : activeEndlessRiskWager
                  ? hasWagerSurety
                      ? 1
                      : 0
                  : Math.max(0, run.featuredObjectiveStreak - FEATURED_OBJECTIVE_STREAK_MISS_DECAY)
            : run.featuredObjectiveStreak;
    const endlessRiskWagerStreakLost =
        activeEndlessRiskWager != null && !featuredObjectiveCompleted
            ? Math.max(0, activeEndlessRiskWager.streakAtRisk - featuredObjectiveStreak)
            : undefined;
    const featuredObjectiveStreakBonus =
        featuredObjectiveId != null && featuredObjectiveCompleted
            ? Math.min(
                  Math.max(0, featuredObjectiveStreak - 1) * FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
                  FEATURED_OBJECTIVE_STREAK_BONUS_MAX
              )
            : 0;
    const bossObjectiveCompleted =
        board.floorTag === 'boss' ? getDungeonObjectiveStatus({ ...run, board }).completed : false;
    const bossTrophyCacheOutcome =
        board.floorTag === 'boss' ? (bossObjectiveCompleted ? ('claimed' as const) : ('forfeited' as const)) : undefined;
    const bossTrophyCacheScore =
        bossTrophyCacheOutcome === 'claimed' ? DUNGEON_BOSS_TROPHY_CACHE_SCORE_REWARD : 0;

    if (featuredObjectiveId != null) {
        if (featuredObjectiveCompleted) {
            objectiveBonus += FEATURED_OBJECTIVE_BONUS_SCORES[featuredObjectiveId];
            bonusTags.push(featuredObjectiveId);
            relicFavorGained = board.floorTag === 'boss' ? 2 : 1;
            if (activeEndlessRiskWager) {
                endlessRiskWagerFavorGained =
                    activeEndlessRiskWager.bonusFavorOnSuccess + (hasWagerSurety ? 1 : 0);
            }
            if (featuredObjectiveStreakBonus > 0) {
                bonusTags.push('objective_streak');
            }
        }
    } else {
        if (!run.shuffleUsedThisFloor && !run.destroyUsedThisFloor) {
            objectiveBonus += SCHOLAR_STYLE_FLOOR_BONUS_SCORE;
            bonusTags.push('scholar_style');
        }
        if (run.glassDecoyActiveThisFloor && !run.decoyFlippedThisFloor) {
            objectiveBonus += GLASS_WITNESS_BONUS_SCORE;
            bonusTags.push('glass_witness');
        }
        if (board.cursedPairKey && !run.cursedMatchedEarlyThisFloor) {
            objectiveBonus += CURSED_LAST_BONUS_SCORE;
            bonusTags.push('cursed_last');
        }
        if (board.pairCount >= 2 && run.matchResolutionsThisFloor <= flipParLimit(board.pairCount)) {
            objectiveBonus += FLIP_PAR_BONUS_SCORE;
            bonusTags.push('flip_par');
        }
    }
    const preBossSubtotal =
        run.stats.currentLevelScore +
        levelBonus +
        perfectBonus +
        objectiveBonus +
        featuredObjectiveStreakBonus +
        bossTrophyCacheScore;
    const scoreGained =
        board.floorTag === 'boss'
            ? Math.floor(preBossSubtotal * BOSS_FLOOR_SCORE_MULTIPLIER)
            : preBossSubtotal;
    if (board.floorTag === 'boss') {
        bonusTags.push('boss_floor');
        bonusTags.push(bossTrophyCacheOutcome === 'claimed' ? 'boss_trophy_cache' : 'boss_trophy_forfeited');
    }
    bonusTags.push(...getDungeonLevelResultTags(run, board, perfect));
    const totalScore = run.stats.totalScore + scoreGained - run.stats.currentLevelScore;
    const bestScore = Math.max(run.stats.bestScore, totalScore);
    const rating = calculateRating(run.stats.tries);
    const lives = Math.min(MAX_LIVES, run.lives + clearLifeGained);
    const totalRelicFavorGained = relicFavorGained + endlessRiskWagerFavorGained;
    const relicFavor = gainRelicFavor(run, totalRelicFavorGained);
    const routeChoices: LevelResult['routeChoices'] =
        run.gameMode === 'endless' && board.level > 0 ? generateRouteChoices(run, board.level + 1) : undefined;
    const currentDungeonRun = dungeonRunFor(run);
    const dungeonRun = routeChoices
        ? revealDungeonChoices(currentDungeonRun, board.level, routeChoices)
        : {
              ...currentDungeonRun,
              currentFloor: board.level,
              nodes: currentDungeonRun.nodes.map((node) =>
                  node.id === currentDungeonRun.currentNodeId ? { ...node, status: 'cleared' as const } : node
              )
          };
    const parasiteFloors =
        featuredObjectiveId != null &&
        featuredObjectiveCompleted &&
        run.relicIds.includes('parasite_ledger') &&
        hasMutator(run, 'score_parasite')
            ? Math.max(0, run.parasiteFloors - 1)
            : run.parasiteFloors;
    const lastLevelResult: LevelResult = {
        level: board.level,
        scoreGained,
        rating,
        livesRemaining: lives,
        perfect,
        mistakes: run.stats.tries,
        clearLifeReason,
        clearLifeGained,
        bonusTags: bonusTags.length > 0 ? [...new Set(bonusTags)] : undefined,
        objectiveBonusScore: objectiveBonus > 0 ? objectiveBonus : undefined,
        featuredObjectiveId: featuredObjectiveId ?? undefined,
        featuredObjectiveCompleted: featuredObjectiveId != null ? featuredObjectiveCompleted : undefined,
        relicFavorGained: featuredObjectiveId != null ? totalRelicFavorGained : undefined,
        featuredObjectiveStreak: featuredObjectiveId != null ? featuredObjectiveStreak : undefined,
        featuredObjectiveStreakBonus:
            featuredObjectiveId != null && featuredObjectiveStreakBonus > 0 ? featuredObjectiveStreakBonus : undefined,
        endlessRiskWagerOutcome,
        endlessRiskWagerFavorGained:
            endlessRiskWagerFavorGained > 0 ? endlessRiskWagerFavorGained : undefined,
        endlessRiskWagerStreakLost,
        bossTrophyCacheOutcome,
        bossTrophyCacheScore: bossTrophyCacheScore > 0 ? bossTrophyCacheScore : undefined,
        hazardTileTriggers: run.hazardTileTriggersThisFloor > 0 ? run.hazardTileTriggersThisFloor : undefined,
        hazardShuffleSnares: run.hazardShuffleSnaresThisFloor > 0 ? run.hazardShuffleSnaresThisFloor : undefined,
        hazardCascadeCaches: run.hazardCascadeCachesThisFloor > 0 ? run.hazardCascadeCachesThisFloor : undefined,
        hazardMirrorDecoys: run.hazardMirrorDecoysThisFloor > 0 ? run.hazardMirrorDecoysThisFloor : undefined,
        hazardFragileCacheClaims:
            run.hazardFragileCacheClaimsThisFloor > 0 ? run.hazardFragileCacheClaimsThisFloor : undefined,
        hazardFragileCacheBreaks:
            run.hazardFragileCacheBreaksThisFloor > 0 ? run.hazardFragileCacheBreaksThisFloor : undefined,
        hazardTollCaches: run.hazardTollCachesThisFloor > 0 ? run.hazardTollCachesThisFloor : undefined,
        hazardFuseCaches: run.hazardFuseCachesThisFloor > 0 ? run.hazardFuseCachesThisFloor : undefined,
        hazardFuseCacheExpiredClaims:
            run.hazardFuseCacheExpiredClaimsThisFloor > 0 ? run.hazardFuseCacheExpiredClaimsThisFloor : undefined,
        lanternWardScouts: run.lanternWardScoutsThisFloor > 0 ? run.lanternWardScoutsThisFloor : undefined,
        omenSealScouts: run.omenSealScoutsThisFloor > 0 ? run.omenSealScoutsThisFloor : undefined,
        mimicCacheClaims: run.mimicCacheClaimsThisFloor > 0 ? run.mimicCacheClaimsThisFloor : undefined,
        mimicCacheBites: run.mimicCacheBitesThisFloor > 0 ? run.mimicCacheBitesThisFloor : undefined,
        anchorSealUses: run.anchorSealUsesThisFloor > 0 ? run.anchorSealUsesThisFloor : undefined,
        loadedGatewayPlans: run.loadedGatewayPlansThisFloor > 0 ? run.loadedGatewayPlansThisFloor : undefined,
        catalystAltarUpgrades:
            run.catalystAltarUpgradesThisFloor > 0 ? run.catalystAltarUpgradesThisFloor : undefined,
        parasiteVesselConversions:
            run.parasiteVesselConversionsThisFloor > 0 ? run.parasiteVesselConversionsThisFloor : undefined,
        pinLatticeRewards: run.pinLatticeRewardsThisFloor > 0 ? run.pinLatticeRewardsThisFloor : undefined,
        safeHazardWardsUsed: run.safeHazardWardsUsedThisFloor > 0 ? run.safeHazardWardsUsedThisFloor : undefined,
        routeChoices
    };

    return {
        ...run,
        status: 'levelComplete',
        lives,
        bonusRelicPicksNextOffer: relicFavor.bonusRelicPicksNextOffer,
        favorBonusRelicPicksNextOffer: relicFavor.favorBonusRelicPicksNextOffer,
        relicFavorProgress: relicFavor.relicFavorProgress,
        shopGold: run.shopGold + getShopGoldRewardForFloor(board.level),
        shopOffers: run.shopOffers,
        parasiteFloors,
        featuredObjectiveStreak,
        endlessRiskWager: activeEndlessRiskWager ? null : run.endlessRiskWager,
        gauntletDeadlineMs:
            run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
                ? run.gauntletDeadlineMs + GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS
                : run.gauntletDeadlineMs,
        board,
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        strayRemoveArmed: false,
        regionShuffleRowArmed: null,
        stickyBlockIndex: null,
        dungeonRun,
        stats: {
            ...run.stats,
            totalScore,
            bestScore,
            currentLevelScore: scoreGained,
            rating,
            levelsCleared: run.stats.levelsCleared + 1,
            highestLevel: Math.max(run.stats.highestLevel, board.level),
            perfectClears: perfect ? run.stats.perfectClears + 1 : run.stats.perfectClears
        },
        timerState: {
            ...run.timerState,
            resolveRemainingMs: null,
            pausedFromStatus: null
        },
        lastLevelResult
    };
};

export const applyDestroyPair = (run: RunState, tileId: string): RunState => {
    if (run.activeContract?.noDestroy || !canDestroyPair(run, tileId) || !run.board) {
        return run;
    }

    const tile = run.board.tiles.find((t) => t.id === tileId)!;
    const pairTileIds = run.board.tiles.filter((t) => t.pairKey === tile.pairKey).map((t) => t.id);

    const board: BoardState = {
        ...run.board,
        matchedPairs: run.board.matchedPairs + 1,
        tiles: run.board.tiles.map((t) =>
            pairTileIds.includes(t.id)
                ? {
                      ...t,
                      state: 'matched' as const,
                      findableKind: undefined,
                      routeCardKind: undefined,
                      routeSpecialKind: undefined,
                      routeSpecialRevealed: undefined,
                      routeSpecialRevealSource: undefined,
                      lanternScouted: undefined,
                      scoutRevealSource: undefined
                  }
                : t
        )
    };

    const pinnedTileIds = run.pinnedTileIds.filter((id) => !pairTileIds.includes(id));

    const spunDestroy = withRotatedShiftingSpotlight(run, board);

    const nextRun: RunState = {
        ...run,
        powersUsedThisRun: true,
        destroyUsedThisFloor: true,
        destroyPairCharges: run.destroyPairCharges - 1,
        pinnedTileIds,
        board: spunDestroy.board,
        shiftingSpotlightNonce: spunDestroy.shiftingSpotlightNonce,
        parasiteFloors: hasMutator(run, 'score_parasite') ? 0 : run.parasiteFloors,
        stats: {
            ...run.stats,
            matchesFound: run.stats.matchesFound + 1,
            pairsDestroyed: run.stats.pairsDestroyed + 1
        }
    };

    return isBoardComplete(spunDestroy.board) ? finalizeLevel(nextRun, spunDestroy.board) : nextRun;
};

export const applyPeek = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board || run.peekCharges < 1) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return run;
    }
    if (run.peekRevealedTileIds.includes(tileId)) {
        return run;
    }
    const board =
        tile.routeSpecialKind && PEEK_REVEALED_ROUTE_SPECIALS.has(tile.routeSpecialKind)
            ? {
                  ...run.board,
                  tiles: run.board.tiles.map((t) =>
                  t.pairKey === tile.pairKey
                      ? { ...t, routeSpecialRevealed: true, routeSpecialRevealSource: 'peek' as const }
                      : t
                  )
              }
            : run.board;
    return {
        ...run,
        board,
        peekCharges: run.peekCharges - 1,
        powersUsedThisRun: true,
        peekRevealedTileIds: [...run.peekRevealedTileIds, tileId]
    };
};

export const cancelResolvingWithUndo = (run: RunState): RunState => {
    if (run.status !== 'resolving' || !run.board || run.undoUsesThisFloor < 1) {
        return run;
    }
    const ids = [...run.board.flippedTileIds];
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((t) => (ids.includes(t.id) ? hiddenUnlessSprungTrap(t) : t))
    };
    return {
        ...run,
        status: 'playing',
        board,
        undoUsesThisFloor: run.undoUsesThisFloor - 1,
        powersUsedThisRun: true,
        timerState: clearResolveState(run)
    };
};

export const toggleStrayRemoveArmed = (run: RunState): RunState =>
    run.strayRemoveCharges > 0 && run.status === 'playing'
        ? { ...run, strayRemoveArmed: !run.strayRemoveArmed }
        : run;

export const applyStrayRemove = (run: RunState, tileId: string): RunState => {
    if (!run.strayRemoveArmed || run.status !== 'playing' || !run.board || run.strayRemoveCharges < 1) {
        return run;
    }
    if (run.board.flippedTileIds.length > 0) {
        return run;
    }
    const tile = run.board.tiles.find((t) => t.id === tileId);
    if (!tile || !tileIsCompletionSafeStrayTarget(run.board, tileId)) {
        return run;
    }
    const board: BoardState = {
        ...run.board,
        tiles: run.board.tiles.map((t) =>
            t.id === tileId
                ? {
                      ...t,
                      state: 'removed' as const,
                      routeCardKind: undefined,
                      routeSpecialKind: undefined,
                      routeSpecialRevealed: undefined,
                      routeSpecialRevealSource: undefined,
                      lanternScouted: undefined,
                      scoutRevealSource: undefined
                  }
                : t.pairKey === tile.pairKey
                  ? {
                        ...t,
                        routeCardKind: undefined,
                        routeSpecialKind: undefined,
                        routeSpecialRevealed: undefined,
                        routeSpecialRevealSource: undefined,
                        lanternScouted: undefined,
                        scoutRevealSource: undefined
                    }
                  : t
        )
    };
    return {
        ...run,
        powersUsedThisRun: true,
        strayRemoveCharges: run.strayRemoveCharges - 1,
        strayRemoveArmed: false,
        board
    };
};

const clearResolveState = (run: RunState): RunState['timerState'] => ({
    ...run.timerState,
    resolveRemainingMs: null,
    pausedFromStatus: null
});

const isEndlessFeaturedObjectiveBoard = (run: RunState, board: BoardState): boolean =>
    run.gameMode === 'endless' &&
    usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
    board.featuredObjectiveId != null;

export const canOfferEndlessRiskWager = (run: RunState): boolean =>
    run.status === 'levelComplete' &&
    run.relicOffer == null &&
    run.gameMode === 'endless' &&
    usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
    run.endlessRiskWager == null &&
    run.lastLevelResult?.featuredObjectiveId != null &&
    run.lastLevelResult.featuredObjectiveCompleted === true &&
    run.featuredObjectiveStreak >= ENDLESS_RISK_WAGER_MIN_STREAK;

export const acceptEndlessRiskWager = (run: RunState): RunState => {
    if (!canOfferEndlessRiskWager(run) || !run.lastLevelResult) {
        return run;
    }

    return {
        ...run,
        endlessRiskWager: {
            acceptedOnLevel: run.lastLevelResult.level,
            targetLevel: run.lastLevelResult.level + 1,
            streakAtRisk: run.featuredObjectiveStreak,
            bonusFavorOnSuccess: ENDLESS_RISK_WAGER_BONUS_FAVOR
        }
    };
};

const isFeaturedObjectiveCompleted = (
    run: RunState,
    board: BoardState,
    objectiveId: FeaturedObjectiveId
): boolean => {
    switch (objectiveId) {
        case 'scholar_style':
            return !run.shuffleUsedThisFloor && !run.destroyUsedThisFloor;
        case 'glass_witness':
            return run.glassDecoyActiveThisFloor && !run.decoyFlippedThisFloor;
        case 'cursed_last':
            return Boolean(board.cursedPairKey) && !run.cursedMatchedEarlyThisFloor;
        case 'flip_par':
            return board.pairCount >= 2 && run.matchResolutionsThisFloor <= flipParLimit(board.pairCount);
        default:
            return false;
    }
};

const gainRelicFavor = (
    run: RunState,
    favorGain: number
): Pick<RunState, 'bonusRelicPicksNextOffer' | 'favorBonusRelicPicksNextOffer' | 'relicFavorProgress'> => {
    if (favorGain <= 0) {
        return {
            bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer,
            relicFavorProgress: run.relicFavorProgress
        };
    }
    const totalFavor = run.relicFavorProgress + favorGain;
    const bonusPicks = Math.floor(totalFavor / RELIC_FAVOR_PER_BONUS_PICK);
    return {
        bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer + bonusPicks,
        favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer + bonusPicks,
        relicFavorProgress: totalFavor % RELIC_FAVOR_PER_BONUS_PICK
    };
};

interface RouteCardReward {
    score: number;
    shopGold: number;
    guardTokens: number;
    safeHazardWardCharges: number;
    comboShards: number;
    relicFavor: number;
}

const emptyRouteCardReward = (): RouteCardReward => ({
    score: 0,
    shopGold: 0,
    guardTokens: 0,
    safeHazardWardCharges: 0,
    comboShards: 0,
    relicFavor: 0
});

const mysteryRouteCardOutcomeFor = (run: RunState, level: number, pairKey: string): MysteryRouteCardOutcome => {
    const outcomes: MysteryRouteCardOutcome[] = ['shop_gold', 'combo_shard', 'relic_favor'];
    const seed = hashStringToSeed(`routeCardMystery:${run.runRulesVersion}:${run.runSeed}:${level}:${pairKey}`);
    return outcomes[Math.abs(seed) % outcomes.length]!;
};

const getRouteCardReward = (
    run: RunState,
    level: number,
    pairKey: string,
    kind: RouteSpecialKind | RouteCardKind | null,
    routeSpecialRevealed = false
): RouteCardReward => {
    if (kind === 'safe_ward') {
        return { ...emptyRouteCardReward(), guardTokens: 1 };
    }
    if (kind === 'guard_cache') {
        return run.stats.guardTokens >= MAX_GUARD_TOKENS
            ? { ...emptyRouteCardReward(), safeHazardWardCharges: 1 }
            : { ...emptyRouteCardReward(), guardTokens: 1 };
    }
    if (kind === 'greed_cache') {
        return {
            ...emptyRouteCardReward(),
            score: ROUTE_CARD_GREED_SCORE_REWARD,
            shopGold: ROUTE_CARD_GREED_SHOP_GOLD_REWARD
        };
    }
    if (kind === 'elite_cache') {
        return {
            ...emptyRouteCardReward(),
            score: 55,
            shopGold: 4
        };
    }
    if (kind === 'final_ward') {
        return {
            ...emptyRouteCardReward(),
            guardTokens: 1,
            comboShards: 1
        };
    }
    if (kind === 'greed_toll') {
        return {
            ...emptyRouteCardReward(),
            score: 40,
            shopGold: 3
        };
    }
    if (kind === 'fragile_cache') {
        return {
            ...emptyRouteCardReward(),
            score: 20,
            shopGold: 1
        };
    }
    if (kind === 'lantern_ward') {
        return {
            ...emptyRouteCardReward(),
            score: 10,
            guardTokens: 1
        };
    }
    if (kind === 'secret_door') {
        return {
            ...emptyRouteCardReward(),
            relicFavor: 1
        };
    }
    if (kind === 'omen_seal') {
        return {
            ...emptyRouteCardReward(),
            relicFavor: 1,
            comboShards: 1
        };
    }
    if (kind === 'mimic_cache') {
        return routeSpecialRevealed
            ? {
                  ...emptyRouteCardReward(),
                  score: MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
                  shopGold: MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
                  comboShards: 1
              }
            : {
                  ...emptyRouteCardReward(),
                  shopGold: MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD
              };
    }
    if (kind === 'loaded_gateway') {
        return {
            ...emptyRouteCardReward(),
            score: LOADED_GATEWAY_SCORE_REWARD
        };
    }
    if (kind === 'catalyst_altar') {
        return {
            ...emptyRouteCardReward(),
            score:
                run.stats.comboShards > 0
                    ? CATALYST_ALTAR_UPGRADED_SCORE_REWARD
                    : CATALYST_ALTAR_FALLBACK_SCORE_REWARD
        };
    }
    if (kind === 'parasite_vessel') {
        return run.parasiteFloors > 0
            ? {
                  ...emptyRouteCardReward(),
                  relicFavor: 1
              }
            : {
                  ...emptyRouteCardReward(),
                  score: PARASITE_VESSEL_FALLBACK_SCORE_REWARD
              };
    }
    if (kind === 'keystone_pair') {
        return {
            ...emptyRouteCardReward(),
            score: 45,
            relicFavor: 1
        };
    }
    if (kind === 'mystery_veil') {
        const outcome = mysteryRouteCardOutcomeFor(run, level, pairKey);
        if (outcome === 'shop_gold') {
            return { ...emptyRouteCardReward(), shopGold: ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD };
        }
        if (outcome === 'combo_shard') {
            return { ...emptyRouteCardReward(), comboShards: 1 };
        }
        return { ...emptyRouteCardReward(), relicFavor: 1 };
    }
    return emptyRouteCardReward();
};

interface DungeonMatchReward {
    score: number;
    shopGold: number;
    guardTokens: number;
    comboShards: number;
    relicFavor: number;
    keysHeldDelta: number;
    keysSpent: number;
    gatewayRouteType: RouteNodeType | null;
    enemiesDefeated: number;
    treasuresOpened: number;
    gatewaysUsed: number;
}

const emptyDungeonMatchReward = (): DungeonMatchReward => ({
    score: 0,
    shopGold: 0,
    guardTokens: 0,
    comboShards: 0,
    relicFavor: 0,
    keysHeldDelta: 0,
    keysSpent: 0,
    gatewayRouteType: null,
    enemiesDefeated: 0,
    treasuresOpened: 0,
    gatewaysUsed: 0
});

const bossDungeonMatchReward = (bossId: Tile['dungeonBossId']): DungeonMatchReward => {
    const definition = getDungeonBossDefinition(bossId);
    if (definition) {
        return {
            ...emptyDungeonMatchReward(),
            ...definition.reward
        };
    }
    return {
        ...emptyDungeonMatchReward(),
        score: DUNGEON_BOSS_DEFEAT_SCORE,
        relicFavor: 1,
        enemiesDefeated: 1
    };
};

const getDungeonMatchReward = (run: RunState, first: Tile, second: Tile): DungeonMatchReward => {
    const kind = first.dungeonCardKind ?? second.dungeonCardKind ?? null;
    const effectId = first.dungeonCardEffectId ?? second.dungeonCardEffectId ?? null;
    if (first.dungeonCardState === 'resolved' || second.dungeonCardState === 'resolved') {
        return emptyDungeonMatchReward();
    }
    if (!kind || !effectId) {
        return emptyDungeonMatchReward();
    }
    if (kind === 'gateway') {
        const routeType = first.dungeonRouteType ?? second.dungeonRouteType ?? null;
        return {
            ...emptyDungeonMatchReward(),
            gatewayRouteType: routeType,
            gatewaysUsed: routeType && run.pendingRouteCardPlan == null ? 1 : 0
        };
    }
    if (kind === 'enemy') {
        const bossId = first.dungeonBossId ?? second.dungeonBossId ?? null;
        return bossId
            ? bossDungeonMatchReward(bossId)
            : {
                  ...emptyDungeonMatchReward(),
                  score: DUNGEON_ENEMY_DEFEAT_SCORE,
                  enemiesDefeated: 1
              };
    }
    if (kind === 'treasure') {
        if (effectId === 'treasure_shard') {
            return {
                ...emptyDungeonMatchReward(),
                score: 12,
                shopGold: 1
            };
        }
        if (effectId === 'treasure_cache') {
            return {
                ...emptyDungeonMatchReward(),
                score: DUNGEON_TREASURE_CACHE_SCORE_REWARD,
                shopGold: DUNGEON_TREASURE_CACHE_GOLD_REWARD,
                treasuresOpened: 1
            };
        }
        return {
            ...emptyDungeonMatchReward(),
            score: DUNGEON_TREASURE_SCORE_REWARD,
            shopGold: DUNGEON_TREASURE_GOLD_REWARD,
            treasuresOpened: 1
        };
    }
    if (kind === 'shrine') {
        return { ...emptyDungeonMatchReward(), guardTokens: 1, relicFavor: 1 };
    }
    if (kind === 'key') {
        return { ...emptyDungeonMatchReward(), keysHeldDelta: 1, score: 10 };
    }
    if (kind === 'lever') {
        return { ...emptyDungeonMatchReward(), score: effectId === 'rune_seal' ? 25 : 15 };
    }
    if (kind === 'trap') {
        if (effectId === 'trap_mimic') {
            return {
                ...emptyDungeonMatchReward(),
                score: DUNGEON_MIMIC_DISARM_SCORE_REWARD,
                shopGold: DUNGEON_MIMIC_DISARM_GOLD_REWARD
            };
        }
        return {
            ...emptyDungeonMatchReward(),
            score: DUNGEON_TRAP_DISARM_SCORE_REWARD,
            shopGold: DUNGEON_TRAP_DISARM_GOLD_REWARD
        };
    }
    if (kind === 'lock') {
        const hasKey = (run.dungeonKeys.iron ?? 0) > 0 || run.dungeonMasterKeys > 0 || (run.board?.dungeonKeysHeld ?? 0) > 0;
        return hasKey
            ? {
                  ...emptyDungeonMatchReward(),
                  keysHeldDelta: -1,
                  keysSpent: 1,
                  shopGold: 3,
                  score: DUNGEON_LOCK_SCORE_REWARD,
                  treasuresOpened: 1
              }
            : { ...emptyDungeonMatchReward(), score: 5 };
    }
    return emptyDungeonMatchReward();
};

const addRunDungeonKey = (
    keys: Partial<Record<DungeonKeyKind, number>>,
    kind: DungeonKeyKind,
    amount: number
): Partial<Record<DungeonKeyKind, number>> => ({
    ...keys,
    [kind]: Math.max(0, (keys[kind] ?? 0) + amount)
});

export type DungeonExitActivationSpend = 'none' | 'key' | 'master_key';

export interface DungeonExitStatus {
    exitTile: Tile | null;
    revealed: boolean;
    lockKind: DungeonExitLockKind;
    requiredLeverCount: number;
    leverCount: number;
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
    exitText: string | null;
    keyText: string | null;
    bossText: string | null;
    alertText: string | null;
    chips: DungeonBoardPresentationChip[];
}

const getDungeonExitTile = (board: BoardState | null): Tile | null => {
    const exits = board?.tiles.filter((tile) => tile.pairKey === EXIT_PAIR_KEY) ?? [];
    return (
        exits.find((tile) => tile.dungeonExitActivated) ??
        exits.find((tile) => tile.state !== 'hidden') ??
        exits.find((tile) => tile.id === board?.dungeonExitTileId) ??
        exits[0] ??
        null
    );
};

export const getDungeonExitStatus = (run: RunState): DungeonExitStatus => {
    const board = run.board;
    const exitTile = getDungeonExitTile(board);
    const lockKind = exitTile?.dungeonExitLockKind ?? board?.dungeonExitLockKind ?? 'none';
    const requiredLeverCount = exitTile?.dungeonExitRequiredLeverCount ?? board?.dungeonExitRequiredLeverCount ?? 0;
    const leverCount = board?.dungeonLeverCount ?? 0;
    const hasMatchingKey = lockKind !== 'none' && lockKind !== 'lever' && (run.dungeonKeys[lockKind] ?? 0) > 0;
    const hasMasterKey = run.dungeonMasterKeys > 0;
    const revealed = Boolean(exitTile && exitTile.state !== 'hidden');
    const undefeatedBossHazard = board?.enemyHazards?.find((hazard) => hazard.bossId && hazard.state !== 'defeated') ?? null;
    const activeBossCard = board?.tiles.find(
        (tile) => tile.dungeonBossId != null && tile.state !== 'matched' && tile.state !== 'removed'
    ) ?? null;
    const unresolvedBossObjective =
        board?.dungeonObjectiveId === 'defeat_boss' &&
        (undefeatedBossHazard != null ||
            activeBossCard != null ||
            (board.dungeonBossId != null && (run.dungeonEnemiesDefeatedThisFloor ?? 0) <= 0));
    const bossBlocksExit = unresolvedBossObjective;
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
    } else if (lockKind !== 'none' && lockKind !== 'lever' && !hasMatchingKey && !hasMasterKey) {
        lockedReason = `Needs a ${lockKind} key or master key.`;
    }
    return {
        exitTile,
        revealed,
        lockKind,
        requiredLeverCount,
        leverCount,
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
        board?.tiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardKind != null) ?? [];
    const movingEnemyHazards = board?.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];

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
    const defeatedEnemyCounter = runOrBoard && 'board' in runOrBoard ? (runOrBoard.dungeonEnemiesDefeatedThisFloor ?? 0) : 0;
    const activeTiles =
        board?.tiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardKind != null) ?? [];
    const resolvedEnemyPairs = countResolvedDungeonPairs(board?.tiles ?? [], (tile) => tile.dungeonCardKind === 'enemy');
    const counterOnlyDefeated = Math.max(0, defeatedEnemyCounter - resolvedEnemyPairs);
    const movingHazards = board?.enemyHazards ?? [];
    const activeMovingHazards = movingHazards.filter((hazard) => hazard.state !== 'defeated');

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

    const bossTiles = board?.tiles.filter((tile) => tile.dungeonBossId === definition.id) ?? [];
    const activeBossTiles = bossTiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed');
    const bossHazards = board?.enemyHazards?.filter((hazard) => hazard.bossId === definition.id) ?? [];
    const activeBossHazards = bossHazards.filter((hazard) => hazard.state !== 'defeated');
    const lifecycleSource: DungeonBossLifecycleSource =
        countDungeonPairs(activeBossTiles, () => true) > 0
            ? 'boss_card_pair'
            : activeBossHazards.length > 0
              ? 'moving_patrol'
              : 'none';
    const maxHp =
        lifecycleSource === 'boss_card_pair'
            ? Math.max(0, ...bossTiles.map((tile) => tile.dungeonCardMaxHp ?? definition.hp))
            : lifecycleSource === 'moving_patrol'
              ? Math.max(0, ...bossHazards.map((hazard) => hazard.maxHp))
              : definition.hp;
    const hp =
        lifecycleSource === 'boss_card_pair'
            ? Math.max(0, ...activeBossTiles.map((tile) => tile.dungeonCardHp ?? 0))
            : lifecycleSource === 'moving_patrol'
              ? Math.max(0, ...activeBossHazards.map((hazard) => hazard.hp))
              : 0;
    const phase = dungeonBossPhaseForHp(hp, maxHp, lifecycleSource);

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
        const counterOnlyResolved = Math.max(0, (run.dungeonTrapsResolvedThisFloor ?? 0) - resolvedTrapPairs);
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
        const counterOnlyDefeated = Math.max(0, (run.dungeonEnemiesDefeatedThisFloor ?? 0) - resolvedEnemyPairs);
        const progress = resolvedEnemyPairs + counterOnlyDefeated;
        const required = Math.max(1, activeEnemyPairs + counterOnlyDefeated);
        return {
            objectiveId,
            completed: progress >= required,
            progress: Math.min(progress, required),
            required,
            label,
            detail: `${Math.min(progress, required)}/${required} enemy pair(s) pacified.`
        };
    }

    if (objectiveId === 'claim_route') {
        const routeExitActivated = board.tiles.some(
            (tile) => tile.dungeonCardKind === 'exit' && tile.dungeonExitActivated === true && tile.dungeonRouteType != null
        );
        const completed =
            (run.dungeonGatewaysUsedThisFloor ?? 0) > 0 || board.selectedGatewayRouteType != null || routeExitActivated;
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
        if (bossHazards.length > 0) {
            const required = Math.max(1, ...bossHazards.map((hazard) => hazard.maxHp));
            const activeHp = Math.max(0, ...bossHazards.map((hazard) => hazard.hp));
            const completed = bossHazards.every((hazard) => hazard.state === 'defeated');
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
        const required = Math.max(1, ...bossTiles.map((tile) => tile.dungeonCardMaxHp ?? 1));
        const activeHp = Math.max(0, ...bossTiles.map((tile) => tile.dungeonCardHp ?? 0));
        const bossResolved =
            bossTiles.length > 0 &&
            bossTiles.every(
                (tile) => tile.dungeonCardState === 'resolved' || tile.state === 'matched' || tile.state === 'removed'
            );
        const completed =
            bossResolved || (bossTiles.length === 0 && board.dungeonBossId != null && run.dungeonEnemiesDefeated > 0);
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
        const progress = Math.max(run.dungeonTreasuresOpenedThisFloor ?? 0, resolvedPairs + openedRooms);
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
        board?.tiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed' && tile.dungeonCardKind != null) ?? [];
    const objective = getDungeonObjectiveStatus(run);
    const activeEnemyHazards = board?.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
    const bossHazard = activeEnemyHazards.find((hazard) => hazard.bossId);
    const threatStatus = getDungeonThreatStatus(board);
    const enemyLifecycleStatus = getDungeonEnemyLifecycleStatus(run);
    const bossReadModel = getDungeonBossReadModel(run);
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
        leverCount: board?.dungeonLeverCount ?? 0,
        requiredLeverCount: board?.dungeonExitRequiredLeverCount ?? 0,
        keyCount: Object.values(run.dungeonKeys).reduce((sum, count) => sum + (count ?? 0), 0) + run.dungeonMasterKeys,
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

const dungeonLockSummary = (status: DungeonExitStatus): string | null => {
    if (!status.exitTile) {
        return null;
    }
    if (!status.revealed) {
        return 'Exit hidden';
    }
    if (status.lockKind === 'none') {
        return 'Exit open';
    }
    if (status.lockKind === 'lever') {
        return `Levers ${status.leverCount}/${status.requiredLeverCount}`;
    }
    return status.canActivate ? `${status.lockKind} key ready` : `Needs ${status.lockKind} key`;
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
            exitText: null,
            keyText: null,
            bossText: null,
            alertText: null,
            chips: []
        };
    }

    const hiddenCount = status.hiddenDungeonCardCount;
    const activeExitText = dungeonLockSummary(exit);
    const keyText = `${status.keyCount} ${status.keyCount === 1 ? 'key' : 'keys'}`;
    const chips: DungeonBoardPresentationChip[] = [];
    if (activeExitText) {
        chips.push(dungeonHudChip('exit', 'Exit', activeExitText, exit.canActivate ? 'success' : exit.revealed ? 'warning' : 'neutral', 30));
    }
    const bossText = status.bossHazardLabel ?? status.bossReadModel?.label ?? dungeonBossLabel(status.bossId);
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

    const alertText =
        status.armedTrapCount > 0
            ? `${status.armedTrapCount} armed ${status.armedTrapCount === 1 ? 'trap card' : 'trap cards'} will spring on mismatches.`
            : status.enemyHazardCount > 0
              ? `${status.enemyHazardCount} moving enemy ${status.enemyHazardCount === 1 ? 'patrol is' : 'patrols are'} moving after each action. Avoid occupied cards.`
            : status.awakeEnemyCount > 0
              ? `${status.awakeEnemyCount} awake ${status.awakeEnemyCount === 1 ? 'enemy' : 'enemies'} can attack on mismatches.`
              : exit.lockedReason
                ? exit.lockedReason
                : hiddenCount > 0
                  ? `${hiddenCount} hidden dungeon ${hiddenCount === 1 ? 'card' : 'cards'} remain.`
                  : null;

    return {
        visible: true,
        title: 'Dungeon',
        objectiveText: status.objectiveId
            ? `${status.objectiveLabel} ${status.objectiveProgress}/${status.objectiveRequired}${
                  status.objectiveCompleted ? ' complete' : ''
              }`
            : null,
        objectiveDetail: objective.detail,
        exitText: activeExitText,
        keyText,
        bossText,
        alertText,
        chips: orderDungeonHudChips(chips)
    };
};

export const getDungeonCardCopy = (tile: Tile): string => {
    if (!tile.dungeonCardKind) {
        return '';
    }
    if (tile.dungeonCardKind === 'exit') {
        const lock =
            tile.dungeonExitLockKind && tile.dungeonExitLockKind !== 'none'
                ? ` Requires ${tile.dungeonExitLockKind === 'lever' ? `${tile.dungeonExitRequiredLeverCount ?? 1} lever(s)` : `${tile.dungeonExitLockKind} key`}.`
                : ' Can be opened once revealed.';
        const route = tile.dungeonRouteType ? ` Leads to a ${tile.dungeonRouteType} route.` : '';
        return `Dungeon exit: ${tile.label}.${lock}${route}`;
    }
    if (tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'resolved') {
        return `Resolved trap: ${tile.label}. Its effect has sprung and your next action is ready.`;
    }
    if (tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed') {
        if (tile.dungeonCardEffectId === 'trap_alarm') {
            return `Armed trap: ${tile.label}. Match its pair to disarm. Mismatches wake hidden enemies.`;
        }
        if (tile.dungeonCardEffectId === 'trap_snare') {
            return `Armed trap: ${tile.label}. Match its pair to disarm. Mismatches consume guard or disable free shuffles this floor.`;
        }
        if (tile.dungeonCardEffectId === 'trap_hex') {
            return `Armed trap: ${tile.label}. Match its pair to disarm. Mismatches cut score and reveal a hidden hazard.`;
        }
        if (tile.dungeonCardEffectId === 'trap_mimic') {
            return `Armed trap: ${tile.label}. Match its pair for loot. Mismatches cost life and gold.`;
        }
        return `Armed trap: ${tile.label}. Match its pair to disarm.`;
    }
    if (tile.dungeonCardKind === 'room') {
        return getDungeonRoomReadModel(tile)?.copy ?? `Dungeon room: ${tile.label}.`;
    }
    if (tile.dungeonCardKind === 'shop') {
        return `Dungeon shop: ${tile.label}. Opens the vendor and can be revisited on this floor.`;
    }
    if (tile.dungeonCardKind === 'key') {
        return `Dungeon key: ${tile.label}. Matching it banks an iron key for locked cards or bonus exits.`;
    }
    if (tile.dungeonCardKind === 'lock') {
        const treasure = getDungeonTreasureReadModel(tile);
        return treasure
            ? `Dungeon lock: ${tile.label}. ${treasure.payoutText} ${treasure.gateText}`
            : `Dungeon lock: ${tile.label}. Spend a key to turn it into loot, or match it for a small consolation.`;
    }
    if (tile.dungeonCardKind === 'lever') {
        return tile.dungeonCardEffectId === 'rune_seal'
            ? `Dungeon lever: ${tile.label}. Matching it seals revealed traps.`
            : `Dungeon lever: ${tile.label}. Matching it powers lever exits.`;
    }
    if (tile.dungeonCardKind === 'treasure') {
        const treasure = getDungeonTreasureReadModel(tile);
        return treasure
            ? `Dungeon treasure: ${tile.label}. ${treasure.payoutText} ${treasure.claimCondition}`
            : `Dungeon treasure: ${tile.label}. Matching it pays gold and score.`;
    }
    if (tile.dungeonCardKind === 'shrine') {
        return `Dungeon shrine: ${tile.label}. Matching it grants guard and Favor.`;
    }
    if (tile.dungeonCardKind === 'gateway') {
        const route = tile.dungeonRouteType ? ` Selects ${tile.dungeonRouteType} route.` : '';
        return `${getDungeonCardKindDefinition('gateway').copyLabel}: ${tile.label}.${route}`;
    }
    const bossDefinition = getDungeonBossDefinition(tile.dungeonBossId);
    if (bossDefinition) {
        return `Dungeon boss: ${tile.label}. ${bossDefinition.cardCopy} HP ${tile.dungeonCardHp ?? 0}.`;
    }
    if (tile.dungeonCardEffectId === 'enemy_stalker') {
        return `Dungeon enemy: ${tile.label}. Wakes when traps spring and attacks on mismatches. HP ${tile.dungeonCardHp ?? 0}.`;
    }
    const kindCopy = getDungeonCardKindDefinition(tile.dungeonCardKind).copyLabel;
    const hp = tile.dungeonCardKind === 'enemy' && tile.dungeonCardHp != null ? ` HP ${tile.dungeonCardHp}.` : '';
    const boss = tile.dungeonBossId ? ' Boss pair.' : '';
    return `${kindCopy}: ${tile.label}.${boss}${hp}`;
};

export const revealDungeonExit = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== EXIT_PAIR_KEY) {
        return run;
    }
    return {
        ...run,
        board: advanceEnemyHazardsOnBoard({
            ...run.board,
            tiles: run.board.tiles.map((candidate) =>
                candidate.id === tileId
                    ? {
                          ...candidate,
                          state: candidate.state === 'hidden' ? 'flipped' : candidate.state,
                          dungeonCardState: 'revealed'
                      }
                    : candidate
            )
        })
    };
};

export const revealDungeonShop = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== SHOP_PAIR_KEY) {
        return run;
    }
    const nextBoard: BoardState = advanceEnemyHazardsOnBoard({
        ...run.board,
        dungeonShopVisited: true,
        tiles: run.board.tiles.map((candidate) =>
            candidate.id === tileId
                ? {
                      ...candidate,
                      state: candidate.state === 'hidden' ? 'flipped' : candidate.state,
                      dungeonCardState: 'resolved' as const
                  }
                : candidate
        )
    });
    const nextRun = {
        ...run,
        board: nextBoard,
        dungeonShopVisitedThisFloor: true
    };
    return {
        ...nextRun,
        shopOffers: run.shopOffers.length > 0 ? run.shopOffers : createRunShopOffers(nextRun)
    };
};

const scryDungeonCardTiles = (tiles: readonly Tile[], sourceTileId: string): Set<string> => {
    const target = tiles.find(
        (candidate) =>
            candidate.id !== sourceTileId &&
            candidate.state === 'hidden' &&
            candidate.dungeonCardKind != null &&
            candidate.dungeonCardState === 'hidden'
    );
    if (!target) {
        return new Set();
    }
    if (isSingletonUtilityPairKey(target.pairKey)) {
        return new Set([target.id]);
    }
    return new Set(
        tiles
            .filter(
                (candidate) =>
                    candidate.pairKey === target.pairKey &&
                    candidate.dungeonCardKind === target.dungeonCardKind &&
                    candidate.dungeonCardState === 'hidden'
            )
            .map((candidate) => candidate.id)
    );
};

const revealFirstHiddenDungeonPair = (tiles: readonly Tile[], sourceTileId: string): Set<string> => {
    const target = tiles.find(
        (candidate) =>
            candidate.id !== sourceTileId &&
            candidate.state === 'hidden' &&
            candidate.dungeonCardKind != null &&
            candidate.dungeonCardState === 'hidden'
    );
    if (!target) {
        return new Set();
    }
    if (isSingletonUtilityPairKey(target.pairKey)) {
        return new Set([target.id]);
    }
    return new Set(
        tiles
            .filter(
                (candidate) =>
                    candidate.pairKey === target.pairKey &&
                    candidate.dungeonCardKind === target.dungeonCardKind &&
                    candidate.dungeonCardState === 'hidden'
            )
            .map((candidate) => candidate.id)
    );
};

const trapWorkshopTileUpdates = (tiles: readonly Tile[]): { ids: Set<string>; resolved: boolean } => {
    const armed = tiles.find((candidate) => candidate.dungeonCardKind === 'trap' && candidate.dungeonCardState === 'revealed');
    if (armed) {
        return {
            ids: new Set(tiles.filter((candidate) => candidate.pairKey === armed.pairKey).map((candidate) => candidate.id)),
            resolved: true
        };
    }
    const hidden = tiles.find((candidate) => candidate.dungeonCardKind === 'trap' && candidate.dungeonCardState === 'hidden');
    if (!hidden) {
        return { ids: new Set(), resolved: false };
    }
    return {
        ids: new Set(tiles.filter((candidate) => candidate.pairKey === hidden.pairKey).map((candidate) => candidate.id)),
        resolved: false
    };
};

export const revealDungeonRoom = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== ROOM_PAIR_KEY || tile.dungeonCardKind !== 'room') {
        return run;
    }
    const effectId = tile.dungeonCardEffectId;
    const alreadyUsed = tile.dungeonRoomUsed === true;
    let nextRun: RunState = run;
    let markUsed = effectId !== 'room_forge';
    let openedLockedCache = false;
    const scryTileIds = effectId === 'room_scrying_lens' ? scryDungeonCardTiles(run.board.tiles, tileId) : new Set<string>();
    const omenRevealTileIds =
        effectId === 'room_omen_archive' ? revealFirstHiddenDungeonPair(run.board.tiles, tileId) : new Set<string>();
    const trapWorkshopUpdates =
        effectId === 'room_trap_workshop' ? trapWorkshopTileUpdates(run.board.tiles) : { ids: new Set<string>(), resolved: false };
    if (alreadyUsed && effectId !== 'room_forge') {
        markUsed = true;
    } else if (effectId === 'room_campfire') {
        nextRun =
            run.lives < MAX_LIVES
                ? { ...run, lives: Math.min(MAX_LIVES, run.lives + 1) }
                : {
                      ...run,
                      stats: {
                          ...run.stats,
                          totalScore: run.stats.totalScore + 15,
                          currentLevelScore: run.stats.currentLevelScore + 15
                      }
                  };
    } else if (effectId === 'room_fountain') {
        nextRun = {
            ...run,
            stats: { ...run.stats, guardTokens: Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1) }
        };
    } else if (effectId === 'room_map') {
        nextRun = run;
    } else if (effectId === 'room_forge') {
        if (run.shopGold >= 2) {
            nextRun = {
                ...run,
                shopGold: run.shopGold - 2,
                destroyPairCharges: run.destroyPairCharges + 1
            };
        }
        markUsed = false;
    } else if (effectId === 'room_shrine') {
        nextRun =
            run.shopGold > 0
                ? {
                      ...run,
                      shopGold: run.shopGold - 1,
                      stats: {
                          ...run.stats,
                          guardTokens: Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1)
                      }
                  }
                : {
                      ...run,
                      stats: {
                          ...run.stats,
                          totalScore: run.stats.totalScore + 10,
                          currentLevelScore: run.stats.currentLevelScore + 10
                      }
                  };
    } else if (effectId === 'room_scrying_lens') {
        nextRun = run;
    } else if (effectId === 'room_armory') {
        nextRun = {
            ...run,
            destroyPairCharges: run.destroyPairCharges + 1
        };
    } else if (effectId === 'room_key_cache') {
        nextRun = {
            ...run,
            dungeonKeys: addRunDungeonKey(run.dungeonKeys, 'iron', 1),
            stats: {
                ...run.stats,
                totalScore: run.stats.totalScore + DUNGEON_KEY_CACHE_SCORE_REWARD,
                currentLevelScore: run.stats.currentLevelScore + DUNGEON_KEY_CACHE_SCORE_REWARD,
                bestScore: Math.max(run.stats.bestScore, run.stats.totalScore + DUNGEON_KEY_CACHE_SCORE_REWARD)
            }
        };
    } else if (effectId === 'room_trap_workshop') {
        nextRun = {
            ...run,
            dungeonTrapsResolvedThisFloor: trapWorkshopUpdates.resolved
                ? (run.dungeonTrapsResolvedThisFloor ?? 0) + 1
                : run.dungeonTrapsResolvedThisFloor
        };
    } else if (effectId === 'room_omen_archive') {
        const favor = gainRelicFavor(run, 1);
        nextRun = {
            ...run,
            bonusRelicPicksNextOffer: favor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: favor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: favor.relicFavorProgress,
            stats: {
                ...run.stats,
                totalScore: run.stats.totalScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD,
                currentLevelScore: run.stats.currentLevelScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD,
                bestScore: Math.max(run.stats.bestScore, run.stats.totalScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD)
            }
        };
    } else if (effectId === 'room_locked_cache') {
        if ((run.dungeonKeys.iron ?? 0) > 0) {
            openedLockedCache = true;
            nextRun = {
                ...run,
                dungeonKeys: addRunDungeonKey(run.dungeonKeys, 'iron', -1),
                shopGold: run.shopGold + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD,
                stats: {
                    ...run.stats,
                    totalScore: run.stats.totalScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD,
                    currentLevelScore: run.stats.currentLevelScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD
                }
            };
        } else if (run.dungeonMasterKeys > 0) {
            openedLockedCache = true;
            nextRun = {
                ...run,
                dungeonMasterKeys: run.dungeonMasterKeys - 1,
                shopGold: run.shopGold + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD,
                stats: {
                    ...run.stats,
                    totalScore: run.stats.totalScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD,
                    currentLevelScore: run.stats.currentLevelScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD
                }
            };
        }
        markUsed = openedLockedCache;
    }
    const board = nextRun.board ?? run.board;
    const nextBoard = advanceEnemyHazardsOnBoard({
        ...board,
        tiles: board.tiles.map((candidate) => {
            if (candidate.id === tileId) {
                return {
                    ...candidate,
                    state: candidate.state === 'hidden' ? ('flipped' as const) : candidate.state,
                    dungeonCardState: markUsed ? ('resolved' as const) : ('revealed' as const),
                    dungeonRoomUsed: markUsed ? true : candidate.dungeonRoomUsed
                };
            }
            if (effectId === 'room_map' && candidate.state === 'hidden' && isSingletonUtilityPairKey(candidate.pairKey)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (scryTileIds.has(candidate.id)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (omenRevealTileIds.has(candidate.id)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (trapWorkshopUpdates.ids.has(candidate.id)) {
                return {
                    ...candidate,
                    dungeonCardState: trapWorkshopUpdates.resolved ? ('resolved' as const) : ('revealed' as const)
                };
            }
            return candidate;
        })
    });
    return {
        ...nextRun,
        board: nextBoard
    };
};

const sealBoardForDungeonExit = (board: BoardState): BoardState => {
    const realPairKeys = new Set(
        board.tiles
            .map((tile) => tile.pairKey)
            .filter((pairKey) => !isSingletonUtilityPairKey(pairKey))
    );
    return {
        ...board,
        matchedPairs: realPairKeys.size,
        flippedTileIds: [],
        dungeonExitActivated: true,
        tiles: board.tiles.map((tile) => {
            if (tile.pairKey === EXIT_PAIR_KEY) {
                return {
                    ...tile,
                    state: 'matched' as const,
                    dungeonCardState: 'resolved' as const,
                    dungeonExitActivated: true
                };
            }
            if (isSingletonUtilityPairKey(tile.pairKey)) {
                return tile.state === 'flipped' ? { ...tile, state: 'hidden' as const } : tile;
            }
            return tile.state === 'matched' || tile.state === 'removed'
                ? tile
                : clearDungeonCardFields({ ...tile, state: 'removed' as const });
        })
    };
};

export const activateDungeonExit = (
    run: RunState,
    spend: DungeonExitActivationSpend = 'none'
): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const status = getDungeonExitStatus(run);
    if (!status.exitTile || !status.revealed) {
        return run;
    }
    const lockKind = status.lockKind;
    const spendsKey = spend === 'key' && lockKind !== 'none' && lockKind !== 'lever' && status.canActivateWithKey;
    const spendsMaster = spend === 'master_key' && lockKind !== 'none' && lockKind !== 'lever' && status.canActivateWithMasterKey;
    const canOpen =
        status.canActivateWithoutSpend ||
        (lockKind === 'lever' && status.canActivate) ||
        spendsKey ||
        spendsMaster;
    if (!canOpen) {
        return run;
    }
    const nextKeys = spendsKey ? addRunDungeonKey(run.dungeonKeys, lockKind as DungeonKeyKind, -1) : run.dungeonKeys;
    const objective = getDungeonObjectiveStatus(run);
    const dungeonObjectiveRewarded =
        (objective.completed || (objective.objectiveId === 'claim_route' && status.routeType != null)) &&
        objective.objectiveId !== 'find_exit';
    const dungeonObjectiveFavor = gainRelicFavor(
        run,
        dungeonObjectiveRewarded ? DUNGEON_OBJECTIVE_FAVOR_REWARD : 0
    );
    const openedBoard = sealBoardForDungeonExit(run.board);
    const routeType = status.routeType;
    const nextRun: RunState = {
        ...run,
        dungeonKeys: nextKeys,
        dungeonMasterKeys: spendsMaster ? Math.max(0, run.dungeonMasterKeys - 1) : run.dungeonMasterKeys,
        dungeonGatewaysUsed: run.dungeonGatewaysUsed + 1,
        pendingRouteCardPlan:
            run.pendingRouteCardPlan == null && routeType
                ? createRouteCardPlanForRoute(
                      run,
                      routeType,
                      `exit:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${routeType}`
                  )
                : run.pendingRouteCardPlan,
        stats: dungeonObjectiveRewarded
            ? {
                  ...run.stats,
                  totalScore: run.stats.totalScore + DUNGEON_OBJECTIVE_SCORE_REWARD,
                  currentLevelScore: run.stats.currentLevelScore + DUNGEON_OBJECTIVE_SCORE_REWARD
              }
            : run.stats,
        bonusRelicPicksNextOffer: dungeonObjectiveFavor.bonusRelicPicksNextOffer,
        favorBonusRelicPicksNextOffer: dungeonObjectiveFavor.favorBonusRelicPicksNextOffer,
        relicFavorProgress: dungeonObjectiveFavor.relicFavorProgress,
        board: openedBoard
    };
    return finalizeLevel(nextRun, openedBoard);
};

const resolveGambitThree = (run: RunState, encorePairKeys: string[]): RunState => {
    if (!run.board || run.board.flippedTileIds.length !== 3) {
        return run;
    }
    const [aId, bId, cId] = run.board.flippedTileIds;
    const ta = run.board.tiles.find((t) => t.id === aId)!;
    const tb = run.board.tiles.find((t) => t.id === bId)!;
    const tc = run.board.tiles.find((t) => t.id === cId)!;
    let matchA = aId;
    let matchB = bId;
    let thirdId = cId;
    let found = false;
    if (tilesArePairMatch(ta, tb)) {
        thirdId = cId;
        found = true;
    } else if (tilesArePairMatch(ta, tc)) {
        matchB = cId;
        thirdId = bId;
        found = true;
    } else if (tilesArePairMatch(tb, tc)) {
        matchA = bId;
        matchB = cId;
        thirdId = aId;
        found = true;
    }

    if (found) {
        const tileMatchA = run.board.tiles.find((t) => t.id === matchA)!;
        const tileMatchB = run.board.tiles.find((t) => t.id === matchB)!;
        const claimedFindableKind = tileMatchA.findableKind ?? tileMatchB.findableKind ?? null;
        const claimedRouteCardKind =
            tileMatchA.routeSpecialKind ??
            tileMatchB.routeSpecialKind ??
            tileMatchA.routeCardKind ??
            tileMatchB.routeCardKind ??
            null;
        const matchedPairKey = isWildPairKey(tileMatchA.pairKey) ? tileMatchB.pairKey : tileMatchA.pairKey;
        const claimedRouteSpecialRevealed = tileMatchA.routeSpecialRevealed === true || tileMatchB.routeSpecialRevealed === true;
        const routeCardReward = getRouteCardReward(
            run,
            run.board.level,
            matchedPairKey,
            claimedRouteCardKind,
            claimedRouteSpecialRevealed
        );
        const mimicCacheClaimed = claimedRouteCardKind === 'mimic_cache';
        const mimicCacheBite = mimicCacheClaimed && !claimedRouteSpecialRevealed;
        const mimicCacheGuardBite = mimicCacheBite && run.stats.guardTokens > 0;
        const mimicCacheFatalBite = mimicCacheBite && !mimicCacheGuardBite && run.lives <= 1;
        const anchorSealClaimed = claimedRouteCardKind === 'anchor_seal';
        const loadedGatewayClaimed = claimedRouteCardKind === 'loaded_gateway';
        const catalystAltarUpgraded = claimedRouteCardKind === 'catalyst_altar' && run.stats.comboShards > 0;
        const parasiteVesselConverted = claimedRouteCardKind === 'parasite_vessel' && run.parasiteFloors > 0;
        const pinLatticeRewarded =
            claimedRouteCardKind === 'pin_lattice' &&
            run.pinLatticeRewardsThisFloor < 1 &&
            run.pinnedTileIds.includes(matchA) &&
            run.pinnedTileIds.includes(matchB);
        const dungeonReward = getDungeonMatchReward(run, tileMatchA, tileMatchB);
        const matchedDungeonKind = tileMatchA.dungeonCardKind ?? tileMatchB.dungeonCardKind ?? null;
        const matchedDungeonKeyKind = tileMatchA.dungeonKeyKind ?? tileMatchB.dungeonKeyKind ?? 'iron';
        const dungeonTrapResolvedDelta =
            matchedDungeonKind === 'trap' &&
            tileMatchA.dungeonCardState !== 'resolved' &&
            tileMatchB.dungeonCardState !== 'resolved'
                ? 1
                : 0;
        const findableScoreBonus =
            claimedFindableKind != null ? FINDABLE_MATCH_SCORE[claimedFindableKind] : 0;
        const findableComboShardGain =
            claimedFindableKind != null ? FINDABLE_MATCH_COMBO_SHARDS[claimedFindableKind] : 0;
        const findableSafeHazardWardGain =
            claimedFindableKind != null ? FINDABLE_MATCH_SAFE_HAZARD_WARDS[claimedFindableKind] : 0;
        const findablesClaimedDelta = claimedFindableKind != null ? 1 : 0;

        const boardBeforeEnemyDamage: BoardState = {
            ...run.board,
            flippedTileIds: [],
            matchedPairs: run.board.matchedPairs + 1,
            tiles: run.board.tiles.map((tile) => {
                if (tile.id === matchA || tile.id === matchB) {
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
                if (tile.id === thirdId) {
                    return hiddenUnlessSprungTrap(tile);
                }
                return tile;
            }),
            selectedGatewayRouteType:
                run.board.selectedGatewayRouteType ?? dungeonReward.gatewayRouteType ?? null,
            dungeonKeysHeld: Math.max(0, (run.board.dungeonKeysHeld ?? 0) + dungeonReward.keysHeldDelta),
            dungeonLeverCount:
                (run.board.dungeonLeverCount ?? 0) + (matchedDungeonKind === 'lever' ? 1 : 0)
        };
        const dungeonEffectBoard =
            matchedDungeonKind === 'lever' && (tileMatchA.dungeonCardEffectId ?? tileMatchB.dungeonCardEffectId) === 'rune_seal'
                ? resolveOneArmedTrapPair(boardBeforeEnemyDamage)
                : boardBeforeEnemyDamage;
        const findableScout = applyFindableScoutGlint(dungeonEffectBoard, run, claimedFindableKind);
        const matchedHazards = hazardKindsInTiles(run.board.tiles, [matchA, matchB]);
        const cascadeHazard = matchedHazards.has('cascade_cache')
            ? applyCascadeCacheHazard(findableScout.board, run, matchedPairKey)
            : { board: findableScout.board, triggered: false };
        const fragileCacheClaimed = matchedHazards.has('fragile_cache');
        const tollCacheClaimed = matchedHazards.has('toll_cache');
        const fuseCacheClaimed = matchedHazards.has('fuse_cache');
        const fuseCacheFresh = fuseCacheClaimed && run.matchResolutionsThisFloor < FUSE_CACHE_FRESH_RESOLUTION_LIMIT;
        const enemyDamage = damageFirstActiveDungeonEnemy(cascadeHazard.board, 1);
        const hazardDamage = damageFirstRevealedEnemyHazard(enemyDamage.board, 1);
        const boardAfterHazards = advanceEnemyHazardsOnBoard(hazardDamage.board);
        const lanternScout =
            claimedRouteCardKind === 'lantern_ward'
                ? applyLanternWardScout(boardAfterHazards, run)
                : { board: boardAfterHazards, scouted: false };
        const omenScout =
            claimedRouteCardKind === 'omen_seal'
                ? applyOmenSealScout(lanternScout.board, run)
                : { board: lanternScout.board, scouted: false };
        const board = omenScout.board;
        const currentStreak = run.stats.currentStreak + 1;
        const meditation = run.gameMode === 'meditation';
        const guardTokenGain =
            meditation || currentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
        const guardTokensBeforeRewards = Math.max(0, run.stats.guardTokens - (mimicCacheGuardBite ? 1 : 0));
        const guardTokens = Math.min(
            MAX_GUARD_TOKENS,
            guardTokensBeforeRewards + guardTokenGain + routeCardReward.guardTokens + dungeonReward.guardTokens
        );
        const comboShardReward = meditation
            ? applyComboShardGain(
                  Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
                  mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
                  findableComboShardGain + routeCardReward.comboShards + dungeonReward.comboShards,
                  false
              )
            : applyComboShardGain(
                  Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
                  mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
                  (currentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
                      findableComboShardGain +
                      routeCardReward.comboShards +
                      dungeonReward.comboShards
              );
        const chainHealLifeGain =
            meditation || currentStreak % CHAIN_HEAL_STREAK_STEP !== 0 ? 0 : 1;
        const lives = mimicCacheFatalBite
            ? 0
            : Math.min(
                  MAX_LIVES,
                  run.lives -
                      (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0) +
                      chainHealLifeGain +
                      comboShardReward.lifeGain
              );
        const encoreKey = matchedPairKey;
        const cursedKeyG = run.board.cursedPairKey;
        const cursedEarlyG =
            Boolean(cursedKeyG && encoreKey === cursedKeyG && run.board.matchedPairs < run.board.pairCount - 1);
        const encoreBonus = encorePairKeys.includes(encoreKey) ? ENCORE_BONUS_SCORE : 0;
        const spotlightDelta = shiftingSpotlightMatchDelta(run.board, encoreKey);
        const presentationPenalty = getPresentationMutatorMatchPenalty(run);
        const matchScore = Math.max(
            0,
            calculateMatchScore(board.level, currentStreak, run.matchScoreMultiplier) +
                encoreBonus +
                findableScoreBonus +
                routeCardReward.score +
                dungeonReward.score +
                enemyDamage.score +
                hazardDamage.score +
                (fragileCacheClaimed ? FRAGILE_CACHE_MATCH_SCORE : 0) +
                (fuseCacheFresh ? FUSE_CACHE_FRESH_SCORE_REWARD : 0) +
                (pinLatticeRewarded ? PIN_LATTICE_SCORE_REWARD : 0) +
                spotlightDelta -
                (tollCacheClaimed ? TOLL_CACHE_MATCH_SCORE_TOLL : 0) -
                presentationPenalty
        );
        const totalScore = run.stats.totalScore + matchScore;
        const currentLevelScore = run.stats.currentLevelScore + matchScore;
        const bestScore = Math.max(run.stats.bestScore, totalScore);
        const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor);
        const nBackMatchCounter = run.nBackMatchCounter + 1;
        const nBackAnchorPairKey =
            hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;
        const wildMatchesRemaining =
            isWildPairKey(tileMatchA.pairKey) || isWildPairKey(tileMatchB.pairKey)
                ? 0
                : run.wildMatchesRemaining;

        const spunG = withAnchorSealPressureRotation(run, board);
        const loadedGatewayRouteType = loadedGatewayClaimed ? loadedGatewayRouteTypeFor(run, matchedPairKey) : null;

        const nextRun: RunState = {
            ...run,
            gambitThirdFlipUsed: true,
            gambitAvailableThisFloor: false,
            powersUsedThisRun: true,
            status: mimicCacheFatalBite ? 'gameOver' : 'playing',
            lives,
            board: spunG.board,
            shiftingSpotlightNonce: spunG.shiftingSpotlightNonce,
            wildMatchesRemaining,
            shopGold:
                run.shopGold +
                routeCardReward.shopGold +
                dungeonReward.shopGold +
                (tollCacheClaimed ? TOLL_CACHE_SHOP_GOLD_REWARD : 0) +
                (fuseCacheClaimed
                    ? fuseCacheFresh
                        ? FUSE_CACHE_FRESH_SHOP_GOLD_REWARD
                        : FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD
                    : 0),
            dungeonKeys:
                matchedDungeonKind === 'key'
                    ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, 1)
                    : run.dungeonKeys,
            bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: routeFavor.relicFavorProgress,
            nBackMatchCounter,
            nBackAnchorPairKey,
            matchedPairKeysThisRun: [...run.matchedPairKeysThisRun, encoreKey],
            pendingRouteCardPlan:
                run.pendingRouteCardPlan == null && loadedGatewayRouteType
                    ? createRouteCardPlanForRoute(
                          run,
                          loadedGatewayRouteType,
                          `loaded_gateway:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${matchedPairKey}`
                      )
                    : run.pendingRouteCardPlan == null && dungeonReward.gatewayRouteType
                    ? createRouteCardPlanForRoute(
                          run,
                          dungeonReward.gatewayRouteType,
                          `gateway:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${dungeonReward.gatewayRouteType}`
                      )
                    : run.pendingRouteCardPlan,
            pinnedTileIds: run.pinnedTileIds.filter((id) => id !== matchA && id !== matchB),
            stickyBlockIndex: hasMutator(run, 'sticky_fingers')
                ? run.board.tiles.findIndex((t) => t.id === matchA)
                : null,
            cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedEarlyG,
            matchResolutionsThisFloor: run.matchResolutionsThisFloor + 1,
            findablesClaimedThisFloor: run.findablesClaimedThisFloor + findablesClaimedDelta,
            safeHazardWardChargesThisFloor: Math.min(
                1,
                (run.safeHazardWardChargesThisFloor ?? 0) + routeCardReward.safeHazardWardCharges + findableSafeHazardWardGain
            ),
            hazardTileTriggersThisFloor:
                run.hazardTileTriggersThisFloor +
                (cascadeHazard.triggered ? 1 : 0) +
                (fragileCacheClaimed ? 1 : 0) +
                (tollCacheClaimed ? 1 : 0) +
                (fuseCacheClaimed ? 1 : 0),
            hazardCascadeCachesThisFloor: run.hazardCascadeCachesThisFloor + (cascadeHazard.triggered ? 1 : 0),
            hazardFragileCacheClaimsThisFloor:
                run.hazardFragileCacheClaimsThisFloor + (fragileCacheClaimed ? 1 : 0),
            hazardTollCachesThisFloor: run.hazardTollCachesThisFloor + (tollCacheClaimed ? 1 : 0),
            hazardFuseCachesThisFloor: run.hazardFuseCachesThisFloor + (fuseCacheClaimed ? 1 : 0),
            hazardFuseCacheExpiredClaimsThisFloor:
                run.hazardFuseCacheExpiredClaimsThisFloor + (fuseCacheClaimed && !fuseCacheFresh ? 1 : 0),
            lanternWardScoutsThisFloor: run.lanternWardScoutsThisFloor + (lanternScout.scouted ? 1 : 0),
            omenSealScoutsThisFloor:
                run.omenSealScoutsThisFloor + (findableScout.scouted ? 1 : 0) + (omenScout.scouted ? 1 : 0),
            mimicCacheClaimsThisFloor: run.mimicCacheClaimsThisFloor + (mimicCacheClaimed ? 1 : 0),
            mimicCacheBitesThisFloor: run.mimicCacheBitesThisFloor + (mimicCacheBite ? 1 : 0),
            mimicCacheGuardBitesThisFloor: run.mimicCacheGuardBitesThisFloor + (mimicCacheGuardBite ? 1 : 0),
            anchorSealChargesThisFloor:
                Math.max(0, run.anchorSealChargesThisFloor - (spunG.anchorSealUsed ? 1 : 0)) +
                (anchorSealClaimed ? 1 : 0),
            anchorSealUsesThisFloor: run.anchorSealUsesThisFloor + (spunG.anchorSealUsed ? 1 : 0),
            loadedGatewayPlansThisFloor: run.loadedGatewayPlansThisFloor + (loadedGatewayClaimed ? 1 : 0),
            catalystAltarUpgradesThisFloor:
                run.catalystAltarUpgradesThisFloor + (catalystAltarUpgraded ? 1 : 0),
            parasiteVesselConversionsThisFloor:
                run.parasiteVesselConversionsThisFloor + (parasiteVesselConverted ? 1 : 0),
            pinLatticeRewardsThisFloor: run.pinLatticeRewardsThisFloor + (pinLatticeRewarded ? 1 : 0),
            parasiteFloors: parasiteVesselConverted ? Math.max(0, run.parasiteFloors - 1) : run.parasiteFloors,
            dungeonEnemiesDefeated:
                run.dungeonEnemiesDefeated + dungeonReward.enemiesDefeated + enemyDamage.defeated + hazardDamage.bossDefeated,
            dungeonEnemiesDefeatedThisFloor:
                (run.dungeonEnemiesDefeatedThisFloor ?? 0) + dungeonReward.enemiesDefeated + enemyDamage.defeated + hazardDamage.bossDefeated,
            enemyHazardsDefeatedThisFloor: (run.enemyHazardsDefeatedThisFloor ?? 0) + hazardDamage.defeated,
            dungeonTreasuresOpened: run.dungeonTreasuresOpened + dungeonReward.treasuresOpened,
            dungeonTreasuresOpenedThisFloor:
                (run.dungeonTreasuresOpenedThisFloor ?? 0) + dungeonReward.treasuresOpened,
            dungeonTrapsResolvedThisFloor: (run.dungeonTrapsResolvedThisFloor ?? 0) + dungeonTrapResolvedDelta,
            dungeonGatewaysUsed: run.dungeonGatewaysUsed + dungeonReward.gatewaysUsed,
            dungeonGatewaysUsedThisFloor:
                (run.dungeonGatewaysUsedThisFloor ?? 0) + dungeonReward.gatewaysUsed,
            stats: {
                ...run.stats,
                totalScore,
                currentLevelScore,
                bestScore,
                matchesFound: run.stats.matchesFound + 1,
                currentStreak,
                bestStreak: Math.max(run.stats.bestStreak, currentStreak),
                highestLevel: Math.max(run.stats.highestLevel, board.level),
                guardTokens,
                comboShards: comboShardReward.comboShards
            },
            timerState: clearResolveState(run)
        };
        return nextRun.status === 'gameOver'
            ? nextRun
            : isBoardComplete(spunG.board)
              ? finalizeLevel(nextRun, spunG.board)
              : nextRun;
    }

    const tries = run.stats.tries + GAMBIT_FAIL_EXTRA_TRIES;
    const hasGraceMismatch = hasFirstMismatchGrace(run, run.board);
    const consumesGuardToken = !hasGraceMismatch && run.stats.guardTokens > 0;
    const lostLife = !hasGraceMismatch && !consumesGuardToken;
    let lives = lostLife ? run.lives - 1 : run.lives;
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((tile) =>
            tile.id === aId || tile.id === bId || tile.id === cId ? hiddenUnlessSprungTrap(tile) : tile
        )
    };
    const contractFail =
        run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    const status: RunStatus = lives <= 0 || contractFail ? 'gameOver' : 'playing';
    if (contractFail) {
        lives = 0;
    }
    const guardTokens = consumesGuardToken ? run.stats.guardTokens - 1 : run.stats.guardTokens;
    const gambitDecoy =
        ta.pairKey === DECOY_PAIR_KEY || tb.pairKey === DECOY_PAIR_KEY || tc.pairKey === DECOY_PAIR_KEY;

    const trapSpring = springArmedDungeonTraps(
        { ...run, lives: Math.max(lives, 0), stats: { ...run.stats, guardTokens } },
        board,
        [ta, tb, tc]
            .filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed')
            .map((tile) => tile.pairKey)
    );
    lives = trapSpring.run.lives;
    const enemyAttack = applyDungeonEnemyAttack(
        lives,
        trapSpring.run.stats.guardTokens,
        trapSpring.alarmTriggered || trapSpring.enemyWoken ? board : trapSpring.board
    );
    lives = enemyAttack.lives;
    const statusAfterEnemy: RunStatus = lives <= 0 || contractFail || trapSpring.run.status === 'gameOver' ? 'gameOver' : status;
    const advancedTrapBoard = advanceEnemyHazardsOnBoard(trapSpring.board);
    const mismatchHazards = hazardKindsInTiles(run.board.tiles, [aId, bId, cId]);
    const wardedHazards = applySafeHazardWardMismatch(run, advancedTrapBoard, [ta, tb, tc], mismatchHazards);
    const { fragileBreak, snareHazard } = wardedHazards;
    const mirrorTriggered = mismatchHazards.has('mirror_decoy');
    const spunGambitMiss = withRotatedShiftingSpotlight(run, wardedHazards.board);

    return {
        ...run,
        gambitThirdFlipUsed: true,
        gambitAvailableThisFloor: false,
        powersUsedThisRun: true,
        status: statusAfterEnemy,
        lives: Math.max(lives, 0),
        shopGold: trapSpring.run.shopGold,
        freeShuffleThisFloor: trapSpring.run.freeShuffleThisFloor,
        regionShuffleFreeThisFloor: trapSpring.run.regionShuffleFreeThisFloor,
        dungeonTrapsTriggered: trapSpring.run.dungeonTrapsTriggered,
        board: spunGambitMiss.board,
        shiftingSpotlightNonce: spunGambitMiss.shiftingSpotlightNonce,
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
        stickyBlockIndex: null,
        decoyFlippedThisFloor: run.decoyFlippedThisFloor || gambitDecoy,
        stats: {
            ...trapSpring.run.stats,
            tries,
            mismatches: trapSpring.run.stats.mismatches + 1,
            currentStreak: Math.floor(run.stats.currentStreak / 2),
            rating: calculateRating(tries),
            highestLevel: Math.max(run.stats.highestLevel, advancedTrapBoard.level),
            guardTokens: enemyAttack.guardTokens
        },
        timerState: clearResolveState(run)
    };
};

const resolveTwoFlippedTiles = (run: RunState, encorePairKeys: string[]): RunState => {
    if (!run.board || run.board.flippedTileIds.length !== 2) {
        return run;
    }

    const [firstId, secondId] = run.board.flippedTileIds;
    const firstTile = run.board.tiles.find((tile) => tile.id === firstId);
    const secondTile = run.board.tiles.find((tile) => tile.id === secondId);

    if (!firstTile || !secondTile) {
        return run;
    }

    const isMatch = tilesArePairMatch(firstTile, secondTile);

    if (isMatch) {
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
            run.board.level,
            matchedPairKey,
            claimedRouteCardKind,
            claimedRouteSpecialRevealed
        );
        const mimicCacheClaimed = claimedRouteCardKind === 'mimic_cache';
        const mimicCacheBite = mimicCacheClaimed && !claimedRouteSpecialRevealed;
        const mimicCacheGuardBite = mimicCacheBite && run.stats.guardTokens > 0;
        const mimicCacheFatalBite = mimicCacheBite && !mimicCacheGuardBite && run.lives <= 1;
        const anchorSealClaimed = claimedRouteCardKind === 'anchor_seal';
        const loadedGatewayClaimed = claimedRouteCardKind === 'loaded_gateway';
        const catalystAltarUpgraded = claimedRouteCardKind === 'catalyst_altar' && run.stats.comboShards > 0;
        const parasiteVesselConverted = claimedRouteCardKind === 'parasite_vessel' && run.parasiteFloors > 0;
        const pinLatticeRewarded =
            claimedRouteCardKind === 'pin_lattice' &&
            run.pinLatticeRewardsThisFloor < 1 &&
            run.pinnedTileIds.includes(firstId) &&
            run.pinnedTileIds.includes(secondId);
        const dungeonReward = getDungeonMatchReward(run, firstTile, secondTile);
        const matchedDungeonKind = firstTile.dungeonCardKind ?? secondTile.dungeonCardKind ?? null;
        const matchedDungeonKeyKind = firstTile.dungeonKeyKind ?? secondTile.dungeonKeyKind ?? 'iron';
        const dungeonTrapResolvedDelta =
            matchedDungeonKind === 'trap' &&
            firstTile.dungeonCardState !== 'resolved' &&
            secondTile.dungeonCardState !== 'resolved'
                ? 1
                : 0;
        const findableScoreBonus =
            claimedFindableKind != null ? FINDABLE_MATCH_SCORE[claimedFindableKind] : 0;
        const findableComboShardGain =
            claimedFindableKind != null ? FINDABLE_MATCH_COMBO_SHARDS[claimedFindableKind] : 0;
        const findableSafeHazardWardGain =
            claimedFindableKind != null ? FINDABLE_MATCH_SAFE_HAZARD_WARDS[claimedFindableKind] : 0;
        const findablesClaimedDelta = claimedFindableKind != null ? 1 : 0;

        const boardBeforeEnemyDamage: BoardState = {
            ...run.board,
            flippedTileIds: [],
            matchedPairs: run.board.matchedPairs + 1,
            tiles: run.board.tiles.map((tile) =>
                tile.id === firstId || tile.id === secondId
                    ? clearDungeonCardFields({
                          ...tile,
                          state: 'matched',
                          findableKind: undefined,
                          routeCardKind: undefined,
                          routeSpecialKind: undefined,
                          routeSpecialRevealed: undefined,
                          routeSpecialRevealSource: undefined,
                          lanternScouted: undefined,
                          scoutRevealSource: undefined
                      })
                    : tile
            ),
            selectedGatewayRouteType:
                run.board.selectedGatewayRouteType ?? dungeonReward.gatewayRouteType ?? null,
            dungeonKeysHeld: Math.max(0, (run.board.dungeonKeysHeld ?? 0) + dungeonReward.keysHeldDelta),
            dungeonLeverCount:
                (run.board.dungeonLeverCount ?? 0) + (matchedDungeonKind === 'lever' ? 1 : 0)
        };
        const dungeonEffectBoard =
            matchedDungeonKind === 'lever' && (firstTile.dungeonCardEffectId ?? secondTile.dungeonCardEffectId) === 'rune_seal'
                ? resolveOneArmedTrapPair(boardBeforeEnemyDamage)
                : boardBeforeEnemyDamage;
        const findableScout = applyFindableScoutGlint(dungeonEffectBoard, run, claimedFindableKind);
        const matchedHazards = hazardKindsInTiles(run.board.tiles, [firstId, secondId]);
        const cascadeHazard = matchedHazards.has('cascade_cache')
            ? applyCascadeCacheHazard(findableScout.board, run, matchedPairKey)
            : { board: findableScout.board, triggered: false };
        const fragileCacheClaimed = matchedHazards.has('fragile_cache');
        const tollCacheClaimed = matchedHazards.has('toll_cache');
        const fuseCacheClaimed = matchedHazards.has('fuse_cache');
        const fuseCacheFresh = fuseCacheClaimed && run.matchResolutionsThisFloor < FUSE_CACHE_FRESH_RESOLUTION_LIMIT;
        const enemyDamage = damageFirstActiveDungeonEnemy(cascadeHazard.board, 1);
        const hazardDamage = damageFirstRevealedEnemyHazard(enemyDamage.board, 1);
        const boardAfterHazards = advanceEnemyHazardsOnBoard(hazardDamage.board);
        const lanternScout =
            claimedRouteCardKind === 'lantern_ward'
                ? applyLanternWardScout(boardAfterHazards, run)
                : { board: boardAfterHazards, scouted: false };
        const omenScout =
            claimedRouteCardKind === 'omen_seal'
                ? applyOmenSealScout(lanternScout.board, run)
                : { board: lanternScout.board, scouted: false };
        const board = omenScout.board;
        const currentStreak = run.stats.currentStreak + 1;
        const meditation = run.gameMode === 'meditation';
        const guardTokenGain =
            meditation || currentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
        const guardTokensBeforeRewards = Math.max(0, run.stats.guardTokens - (mimicCacheGuardBite ? 1 : 0));
        const guardTokens = Math.min(
            MAX_GUARD_TOKENS,
            guardTokensBeforeRewards + guardTokenGain + routeCardReward.guardTokens + dungeonReward.guardTokens
        );
        const comboShardReward = meditation
            ? applyComboShardGain(
                  Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
                  mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
                  findableComboShardGain + routeCardReward.comboShards,
                  false
              )
            : applyComboShardGain(
                  Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
                  mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
                  (currentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
                      findableComboShardGain +
                      routeCardReward.comboShards +
                      dungeonReward.comboShards
              );
        const chainHealLifeGain =
            meditation || currentStreak % CHAIN_HEAL_STREAK_STEP !== 0 ? 0 : 1;
        const lives = mimicCacheFatalBite
            ? 0
            : Math.min(
                  MAX_LIVES,
                  run.lives -
                      (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0) +
                      chainHealLifeGain +
                      comboShardReward.lifeGain
              );
        const encoreKey = matchedPairKey;
        const cursedKey = run.board.cursedPairKey;
        const cursedEarly =
            Boolean(cursedKey && encoreKey === cursedKey && run.board.matchedPairs < run.board.pairCount - 1);
        const encoreBonus = encorePairKeys.includes(encoreKey) ? ENCORE_BONUS_SCORE : 0;
        const spotlightDelta = shiftingSpotlightMatchDelta(run.board, encoreKey);
        const presentationPenalty = getPresentationMutatorMatchPenalty(run);
        const matchScore = Math.max(
            0,
            calculateMatchScore(board.level, currentStreak, run.matchScoreMultiplier) +
                encoreBonus +
                findableScoreBonus +
                routeCardReward.score +
                dungeonReward.score +
                enemyDamage.score +
                hazardDamage.score +
                (fragileCacheClaimed ? FRAGILE_CACHE_MATCH_SCORE : 0) +
                (fuseCacheFresh ? FUSE_CACHE_FRESH_SCORE_REWARD : 0) +
                (pinLatticeRewarded ? PIN_LATTICE_SCORE_REWARD : 0) +
                spotlightDelta -
                (tollCacheClaimed ? TOLL_CACHE_MATCH_SCORE_TOLL : 0) -
                presentationPenalty
        );
        const totalScore = run.stats.totalScore + matchScore;
        const currentLevelScore = run.stats.currentLevelScore + matchScore;
        const bestScore = Math.max(run.stats.bestScore, totalScore);
        const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor);

        const matchedPinsFiltered = run.pinnedTileIds.filter((id) => id !== firstId && id !== secondId);

        const firstFlippedIdx = run.board.tiles.findIndex((t) => t.id === firstId);
        const nBackMatchCounter = run.nBackMatchCounter + 1;
        const nBackAnchorPairKey =
            hasMutator(run, 'n_back_anchor') && nBackMatchCounter % 2 === 0 ? encoreKey : run.nBackAnchorPairKey;
        const usedWild = isWildPairKey(firstTile.pairKey) || isWildPairKey(secondTile.pairKey);
        const wildMatchesRemaining = usedWild ? 0 : run.wildMatchesRemaining;

        const spun = withAnchorSealPressureRotation(run, board);
        const loadedGatewayRouteType = loadedGatewayClaimed ? loadedGatewayRouteTypeFor(run, matchedPairKey) : null;

        const nextRun: RunState = {
            ...run,
            status: mimicCacheFatalBite ? 'gameOver' : 'playing',
            lives,
            board: spun.board,
            shiftingSpotlightNonce: spun.shiftingSpotlightNonce,
            powersUsedThisRun: usedWild ? true : run.powersUsedThisRun,
            wildMatchesRemaining,
            shopGold:
                run.shopGold +
                routeCardReward.shopGold +
                dungeonReward.shopGold +
                (tollCacheClaimed ? TOLL_CACHE_SHOP_GOLD_REWARD : 0) +
                (fuseCacheClaimed
                    ? fuseCacheFresh
                        ? FUSE_CACHE_FRESH_SHOP_GOLD_REWARD
                        : FUSE_CACHE_EXPIRED_SHOP_GOLD_REWARD
                    : 0),
            dungeonKeys:
                matchedDungeonKind === 'key'
                    ? addRunDungeonKey(run.dungeonKeys, matchedDungeonKeyKind, 1)
                    : run.dungeonKeys,
            bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: routeFavor.relicFavorProgress,
            nBackMatchCounter,
            nBackAnchorPairKey,
            matchedPairKeysThisRun: [...run.matchedPairKeysThisRun, encoreKey],
            pendingRouteCardPlan:
                run.pendingRouteCardPlan == null && loadedGatewayRouteType
                    ? createRouteCardPlanForRoute(
                          run,
                          loadedGatewayRouteType,
                          `loaded_gateway:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${matchedPairKey}`
                      )
                    : run.pendingRouteCardPlan == null && dungeonReward.gatewayRouteType
                    ? createRouteCardPlanForRoute(
                          run,
                          dungeonReward.gatewayRouteType,
                          `gateway:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${dungeonReward.gatewayRouteType}`
                      )
                    : run.pendingRouteCardPlan,
            pinnedTileIds: matchedPinsFiltered,
            stickyBlockIndex: hasMutator(run, 'sticky_fingers') ? firstFlippedIdx : null,
            cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedEarly,
            matchResolutionsThisFloor: run.matchResolutionsThisFloor + 1,
            findablesClaimedThisFloor: run.findablesClaimedThisFloor + findablesClaimedDelta,
            safeHazardWardChargesThisFloor: Math.min(
                1,
                (run.safeHazardWardChargesThisFloor ?? 0) + routeCardReward.safeHazardWardCharges + findableSafeHazardWardGain
            ),
            hazardTileTriggersThisFloor:
                run.hazardTileTriggersThisFloor +
                (cascadeHazard.triggered ? 1 : 0) +
                (fragileCacheClaimed ? 1 : 0) +
                (tollCacheClaimed ? 1 : 0) +
                (fuseCacheClaimed ? 1 : 0),
            hazardCascadeCachesThisFloor: run.hazardCascadeCachesThisFloor + (cascadeHazard.triggered ? 1 : 0),
            hazardFragileCacheClaimsThisFloor:
                run.hazardFragileCacheClaimsThisFloor + (fragileCacheClaimed ? 1 : 0),
            hazardTollCachesThisFloor: run.hazardTollCachesThisFloor + (tollCacheClaimed ? 1 : 0),
            hazardFuseCachesThisFloor: run.hazardFuseCachesThisFloor + (fuseCacheClaimed ? 1 : 0),
            hazardFuseCacheExpiredClaimsThisFloor:
                run.hazardFuseCacheExpiredClaimsThisFloor + (fuseCacheClaimed && !fuseCacheFresh ? 1 : 0),
            lanternWardScoutsThisFloor: run.lanternWardScoutsThisFloor + (lanternScout.scouted ? 1 : 0),
            omenSealScoutsThisFloor:
                run.omenSealScoutsThisFloor + (findableScout.scouted ? 1 : 0) + (omenScout.scouted ? 1 : 0),
            mimicCacheClaimsThisFloor: run.mimicCacheClaimsThisFloor + (mimicCacheClaimed ? 1 : 0),
            mimicCacheBitesThisFloor: run.mimicCacheBitesThisFloor + (mimicCacheBite ? 1 : 0),
            mimicCacheGuardBitesThisFloor: run.mimicCacheGuardBitesThisFloor + (mimicCacheGuardBite ? 1 : 0),
            anchorSealChargesThisFloor:
                Math.max(0, run.anchorSealChargesThisFloor - (spun.anchorSealUsed ? 1 : 0)) +
                (anchorSealClaimed ? 1 : 0),
            anchorSealUsesThisFloor: run.anchorSealUsesThisFloor + (spun.anchorSealUsed ? 1 : 0),
            loadedGatewayPlansThisFloor: run.loadedGatewayPlansThisFloor + (loadedGatewayClaimed ? 1 : 0),
            catalystAltarUpgradesThisFloor:
                run.catalystAltarUpgradesThisFloor + (catalystAltarUpgraded ? 1 : 0),
            parasiteVesselConversionsThisFloor:
                run.parasiteVesselConversionsThisFloor + (parasiteVesselConverted ? 1 : 0),
            pinLatticeRewardsThisFloor: run.pinLatticeRewardsThisFloor + (pinLatticeRewarded ? 1 : 0),
            parasiteFloors: parasiteVesselConverted ? Math.max(0, run.parasiteFloors - 1) : run.parasiteFloors,
            dungeonEnemiesDefeated:
                run.dungeonEnemiesDefeated + dungeonReward.enemiesDefeated + enemyDamage.defeated + hazardDamage.bossDefeated,
            dungeonEnemiesDefeatedThisFloor:
                (run.dungeonEnemiesDefeatedThisFloor ?? 0) + dungeonReward.enemiesDefeated + enemyDamage.defeated + hazardDamage.bossDefeated,
            enemyHazardsDefeatedThisFloor: (run.enemyHazardsDefeatedThisFloor ?? 0) + hazardDamage.defeated,
            dungeonTreasuresOpened: run.dungeonTreasuresOpened + dungeonReward.treasuresOpened,
            dungeonTreasuresOpenedThisFloor:
                (run.dungeonTreasuresOpenedThisFloor ?? 0) + dungeonReward.treasuresOpened,
            dungeonTrapsResolvedThisFloor: (run.dungeonTrapsResolvedThisFloor ?? 0) + dungeonTrapResolvedDelta,
            dungeonGatewaysUsed: run.dungeonGatewaysUsed + dungeonReward.gatewaysUsed,
            dungeonGatewaysUsedThisFloor:
                (run.dungeonGatewaysUsedThisFloor ?? 0) + dungeonReward.gatewaysUsed,
            stats: {
                ...run.stats,
                totalScore,
                currentLevelScore,
                bestScore,
                matchesFound: run.stats.matchesFound + 1,
                currentStreak,
                bestStreak: Math.max(run.stats.bestStreak, currentStreak),
                highestLevel: Math.max(run.stats.highestLevel, board.level),
                guardTokens,
                comboShards: comboShardReward.comboShards
            },
            timerState: clearResolveState(run)
        };

        return nextRun.status === 'gameOver'
            ? nextRun
            : isBoardComplete(spun.board)
              ? finalizeLevel(nextRun, spun.board)
              : nextRun;
    }

    const tries = run.stats.tries + 1;
    const hasGraceMismatch = hasFirstMismatchGrace(run, run.board);
    const consumesGuardToken = !hasGraceMismatch && run.stats.guardTokens > 0;
    const lostLife = !hasGraceMismatch && !consumesGuardToken;
    let lives = lostLife ? run.lives - 1 : run.lives;
    const board: BoardState = {
        ...run.board,
        flippedTileIds: [],
        tiles: run.board.tiles.map((tile) =>
            tile.id === firstId || tile.id === secondId ? hiddenUnlessSprungTrap(tile) : tile
        )
    };
    const contractFail =
        run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    const status: RunStatus = lives <= 0 || contractFail ? 'gameOver' : 'playing';
    if (contractFail) {
        lives = 0;
    }
    const guardTokens = consumesGuardToken ? run.stats.guardTokens - 1 : run.stats.guardTokens;

    const pendingMemorizeBonusMs = lostLife
        ? Math.min(
              MAX_PENDING_MEMORIZE_BONUS_MS,
              run.pendingMemorizeBonusMs + MEMORIZE_BONUS_PER_LIFE_LOST_MS
          )
        : run.pendingMemorizeBonusMs;

    const decoyTouch =
        firstTile.pairKey === DECOY_PAIR_KEY || secondTile.pairKey === DECOY_PAIR_KEY;

    const trapSpring = springArmedDungeonTraps(
        { ...run, lives: Math.max(lives, 0), stats: { ...run.stats, guardTokens } },
        board,
        [firstTile, secondTile]
            .filter((tile) => tile.dungeonCardKind === 'trap' && tile.dungeonCardState === 'revealed')
            .map((tile) => tile.pairKey)
    );
    lives = trapSpring.run.lives;
    const enemyAttack = applyDungeonEnemyAttack(
        lives,
        trapSpring.run.stats.guardTokens,
        trapSpring.alarmTriggered || trapSpring.enemyWoken ? board : trapSpring.board
    );
    lives = enemyAttack.lives;
    const statusAfterEnemy: RunStatus = lives <= 0 || contractFail || trapSpring.run.status === 'gameOver' ? 'gameOver' : status;
    const advancedTrapBoard = advanceEnemyHazardsOnBoard(trapSpring.board);
    const mismatchHazards = hazardKindsInTiles(run.board.tiles, [firstId, secondId]);
    const wardedHazards = applySafeHazardWardMismatch(run, advancedTrapBoard, [firstTile, secondTile], mismatchHazards);
    const { fragileBreak, snareHazard } = wardedHazards;
    const mirrorTriggered = mismatchHazards.has('mirror_decoy');
    const spunMiss = withRotatedShiftingSpotlight(run, wardedHazards.board);

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
        decoyFlippedThisFloor: run.decoyFlippedThisFloor || decoyTouch,
        stats: {
            ...trapSpring.run.stats,
            tries,
            mismatches: trapSpring.run.stats.mismatches + 1,
            currentStreak: Math.floor(run.stats.currentStreak / 2),
            rating: calculateRating(tries),
            highestLevel: Math.max(run.stats.highestLevel, advancedTrapBoard.level),
            guardTokens: enemyAttack.guardTokens
        },
        timerState: clearResolveState(run)
    };
};

export const resolveBoardTurn = (run: RunState, encorePairKeys: string[] = []): RunState => {
    if (!run.board) {
        return run;
    }
    if (run.board.flippedTileIds.length === 3) {
        return resolveGambitThree(run, encorePairKeys);
    }
    if (run.board.flippedTileIds.length !== 2) {
        return run;
    }
    return resolveTwoFlippedTiles(run, encorePairKeys);
};

/**
 * CARD-008 — Tile ids for match-score board floater (two-flip or gambit matched pair).
 * Mirrors `resolveGambitThree` pairing and renderer `tileResolvingSelection.gambitMatchPairIds`.
 * Returns null when three tiles are flipped but none form a pair (gambit fail).
 */
export const getMatchFloaterAnchorTileIds = (
    run: RunState | null
): { tileIdA: string; tileIdB: string } | null => {
    const board = run?.board;
    if (!board) {
        return null;
    }
    const ids = board.flippedTileIds;
    if (ids.length === 2) {
        return { tileIdA: ids[0], tileIdB: ids[1] };
    }
    if (ids.length !== 3) {
        return null;
    }
    const [aId, bId, cId] = ids;
    const ta = board.tiles.find((t) => t.id === aId);
    const tb = board.tiles.find((t) => t.id === bId);
    const tc = board.tiles.find((t) => t.id === cId);
    if (!ta || !tb || !tc) {
        return null;
    }
    if (tilesArePairMatch(ta, tb)) {
        return { tileIdA: aId, tileIdB: bId };
    }
    if (tilesArePairMatch(ta, tc)) {
        return { tileIdA: aId, tileIdB: cId };
    }
    if (tilesArePairMatch(tb, tc)) {
        return { tileIdA: bId, tileIdB: cId };
    }
    return null;
};

/**
 * Tile ids for mismatch floater: flipped pair order for two-flip miss; three ids (flip sequence) for gambit miss.
 */
export const getMismatchFloaterAnchorTileIds = (
    run: RunState | null
): { tileIdA: string; tileIdB: string; tileIdC?: string } | null => {
    const board = run?.board;
    if (!board) {
        return null;
    }
    const ids = board.flippedTileIds;
    if (ids.length === 2) {
        return { tileIdA: ids[0], tileIdB: ids[1] };
    }
    if (ids.length === 3) {
        return { tileIdA: ids[0], tileIdB: ids[1], tileIdC: ids[2] };
    }
    return null;
};

export const advanceToNextLevel = (run: RunState): RunState => {
    if (run.status !== 'levelComplete' || run.gameMode === 'puzzle' || !run.board) {
        return run;
    }

    const cleanClearDestroyBonus =
        run.lastLevelResult !== null && run.lastLevelResult.mistakes === 0 ? 1 : 0;
    const nextDestroyPairCharges = run.destroyPairCharges + cleanClearDestroyBonus;

    const nextLevelNum = run.board.level + 1;
    const currentDungeonRun = dungeonRunFor(run);
    const selectedDungeonNode = getSelectedDungeonNode(currentDungeonRun);
    let nextActiveMutators = [...run.activeMutators];
    let nextFloorTag: FloorTag = 'normal';
    let nextFloorArchetypeId: FloorArchetypeId | null = null;
    let nextFeaturedObjectiveId: FeaturedObjectiveId | null = null;
    let nextCycleFloor: number | null = null;
    if (usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) && !run.wildMenuRun) {
        const entry = pickFloorScheduleEntry(run.runSeed, run.runRulesVersion, nextLevelNum, run.gameMode);
        nextActiveMutators = entry.mutators;
        nextFloorTag = entry.floorTag;
        nextFloorArchetypeId = entry.floorArchetypeId;
        nextFeaturedObjectiveId = entry.featuredObjectiveId;
        nextCycleFloor = entry.cycleFloor;
    }
    nextFloorTag = floorTagForDungeonNode(selectedDungeonNode?.kind, nextFloorTag);
    nextFloorArchetypeId = floorArchetypeForDungeonNode(selectedDungeonNode?.kind, nextFloorArchetypeId);

    let parasiteFloors = run.parasiteFloors + 1;
    let lives = run.lives;
    let nextParasiteWard = run.parasiteWardRemaining;
    if (hasMutator(run, 'score_parasite') && parasiteFloors >= 4) {
        parasiteFloors = 0;
        if (nextParasiteWard > 0) {
            nextParasiteWard -= 1;
        } else {
            lives = Math.max(0, lives - 1);
        }
    }

    const nextBoard = buildBoard(nextLevelNum, {
        runSeed: run.runSeed,
        runRulesVersion: run.runRulesVersion,
        activeMutators: nextActiveMutators,
        includeWildTile: run.wildMatchesRemaining > 0,
        floorTag: nextFloorTag,
        floorArchetypeId: nextFloorArchetypeId,
        featuredObjectiveId: nextFeaturedObjectiveId,
        cycleFloor: nextCycleFloor,
        routeCardPlan: run.pendingRouteCardPlan,
        dungeonNodeKind: selectedDungeonNode?.kind,
        gameMode: run.gameMode
    });
    const runForNextMemorize: RunState = { ...run, activeMutators: nextActiveMutators };
    const baseMemorizeMs = getMemorizeDurationForRun(runForNextMemorize, nextBoard.level);
    const memorizeWithBonus = baseMemorizeMs + run.pendingMemorizeBonusMs;

    const status = lives <= 0 ? 'gameOver' : 'memorize';

    return {
        ...run,
        status,
        lives,
        activeMutators: nextActiveMutators,
        dungeonRun: enterSelectedDungeonNode(currentDungeonRun),
        pendingRouteCardPlan: null,
        sideRoom: null,
        board: nextBoard,
        debugPeekActive: false,
        pendingMemorizeBonusMs: 0,
        pinnedTileIds: [],
        destroyPairCharges: nextDestroyPairCharges,
        parasiteFloors,
        parasiteWardRemaining: nextParasiteWard,
        stickyBlockIndex: null,
        freeShuffleThisFloor: run.relicIds.includes('first_shuffle_free_per_floor'),
        regionShuffleFreeThisFloor: run.relicIds.includes('region_shuffle_free_first'),
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        peekRevealedTileIds: [],
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(nextBoard),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(nextBoard.tiles),
        hazardTileTriggersThisFloor: 0,
        hazardShuffleSnaresThisFloor: 0,
        hazardCascadeCachesThisFloor: 0,
        hazardMirrorDecoysThisFloor: 0,
        hazardFragileCacheClaimsThisFloor: 0,
        hazardFragileCacheBreaksThisFloor: 0,
        hazardTollCachesThisFloor: 0,
        hazardFuseCachesThisFloor: 0,
        hazardFuseCacheExpiredClaimsThisFloor: 0,
        lanternWardScoutsThisFloor: 0,
        omenSealScoutsThisFloor: 0,
        mimicCacheClaimsThisFloor: 0,
        mimicCacheBitesThisFloor: 0,
        mimicCacheGuardBitesThisFloor: 0,
        anchorSealChargesThisFloor: 0,
        anchorSealUsesThisFloor: 0,
        loadedGatewayPlansThisFloor: 0,
        catalystAltarUpgradesThisFloor: 0,
        parasiteVesselConversionsThisFloor: 0,
        pinLatticeRewardsThisFloor: 0,
        safeHazardWardChargesThisFloor: 0,
        safeHazardWardsUsedThisFloor: 0,
        shiftingSpotlightNonce: 0,
        flashPairRevealedTileIds: [],
        regionShuffleRowArmed: null,
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        shopOffers: [],
        shopRerolls: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonShopVisitedThisFloor: false,
        enemyHazardHitsThisFloor: 0,
        enemyHazardsDefeatedThisFloor: 0,
        wildTileId: getWildTileIdFromBoard(nextBoard),
        timerState: createTimerState({ memorizeRemainingMs: status === 'memorize' ? memorizeWithBonus : null }),
        lastLevelResult: null,
        stats: {
            ...run.stats,
            tries: 0,
            currentLevelScore: 0,
            rating: calculateRating(0),
            highestLevel: Math.max(run.stats.highestLevel, nextBoard.level),
            currentStreak: 0
        }
    };
};

const isResumableStatus = (status: RunState['status']): status is ResumableRunStatus =>
    status === 'memorize' || status === 'playing' || status === 'resolving';

export const pauseRun = (run: RunState): RunState => {
    if (!isResumableStatus(run.status)) {
        return run;
    }
    const gauntletPausedAtMs =
        run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
            ? Date.now()
            : (run.timerState.gauntletPausedAtMs ?? null);

    return {
        ...run,
        status: 'paused',
        timerState: {
            ...run.timerState,
            pausedFromStatus: run.status,
            gauntletPausedAtMs
        }
    };
};

export const resumeRun = (run: RunState): RunState => {
    if (run.status !== 'paused' || !run.timerState.pausedFromStatus) {
        return run;
    }
    const gauntletPausedAtMs = run.timerState.gauntletPausedAtMs ?? null;
    const gauntletPauseDeltaMs =
        run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null && gauntletPausedAtMs !== null
            ? Math.max(0, Date.now() - gauntletPausedAtMs)
            : 0;

    return {
        ...run,
        gauntletDeadlineMs:
            run.gauntletDeadlineMs !== null ? run.gauntletDeadlineMs + gauntletPauseDeltaMs : run.gauntletDeadlineMs,
        status: run.timerState.pausedFromStatus,
        timerState: {
            ...run.timerState,
            pausedFromStatus: null,
            gauntletPausedAtMs: null
        }
    };
};

export const enableDebugPeek = (run: RunState, disableAchievementsOnDebug: boolean): RunState => ({
    ...run,
    debugPeekActive: true,
    debugUsed: true,
    achievementsEnabled: disableAchievementsOnDebug ? false : run.achievementsEnabled,
    timerState: {
        ...run.timerState,
        debugRevealRemainingMs: DEBUG_REVEAL_MS
    }
});

export const disableDebugPeek = (run: RunState): RunState =>
    run.debugPeekActive
        ? {
              ...run,
              debugPeekActive: false,
              timerState: {
                  ...run.timerState,
                  debugRevealRemainingMs: null
              }
          }
        : run;

export const createRunSummary = (run: RunState, unlockedAchievements: AchievementId[]): RunState => ({
    ...run,
    lastRunSummary: {
        totalScore: run.stats.totalScore,
        bestScore: run.stats.bestScore,
        levelsCleared: run.stats.levelsCleared,
        highestLevel: run.stats.highestLevel,
        achievementsEnabled: run.achievementsEnabled,
        unlockedAchievements,
        bestStreak: run.stats.bestStreak,
        perfectClears: run.stats.perfectClears,
        runSeed: run.runSeed,
        runRulesVersion: run.runRulesVersion,
        gameMode: run.gameMode,
        dailyDateKeyUtc: run.dailyDateKeyUtc ?? undefined,
        activeMutators: [...run.activeMutators],
        relicIds: [...run.relicIds],
        practiceMode: run.practiceMode,
        wildMenuRun: run.wildMenuRun,
        activeContract: run.activeContract ? { ...run.activeContract } : null
    }
});
