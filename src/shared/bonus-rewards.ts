import {
    type BonusRewardId,
    type BonusRewardLedger,
    type BoardState,
    MAX_COMBO_SHARDS,
    type RewardPerkId,
    type RunState,
    type StartingLoadoutId
} from './contracts';
import { hashStringToSeed } from './rng';
import type { RunMapNodeKind } from './run-map';
import {
    gainRunInventoryItem,
    getRunInventoryGainFeedback,
    getRunInventoryItemPayoutRows,
    type RunInventoryItemId
} from './run-inventory';
import { normalizeSessionStats } from './session-stats-rules';
import { getTraitBuildRewardRowsForBoard } from './trait-build-rewards';

export type BonusRewardRoomKind = 'treasure_chest' | 'secret_room' | 'bonus_cache';

export interface BonusRewardPayout {
    shopGold?: number;
    comboShards?: number;
    relicFavorProgress?: number;
    score?: number;
    inventoryItems?: Partial<Record<RunInventoryItemId, number>>;
    rewardPerks?: RewardPerkId[];
}

export interface BonusRewardDefinition {
    id: BonusRewardId;
    roomKind: BonusRewardRoomKind;
    label: string;
    traitBuildLabels?: string[];
    trigger: string;
    discoverability: string;
    eligibility: string;
    antiGrindLimit: {
        scope: 'per_run';
        maxClaims: number;
    };
    payout: BonusRewardPayout;
    summaryText: string;
}

export interface BonusRewardInstance extends BonusRewardDefinition {
    instanceId: string;
    runSeed: number;
    rulesVersion: number;
    floor: number;
    offlineOnly: true;
    eligible: boolean;
    unavailableReason: string | null;
}

export const BONUS_REWARD_IDS = [
    'chest_gold',
    'secret_favor',
    'bonus_shards',
    'supply_cache',
    'trait_toolkit',
    'key_insurance',
    'hazard_ward',
    'free_swap_floor',
    'echo_conduit_lens',
    'trait_streak_lens',
    'cursed_opener_contract',
    'stasis_lockbox',
    'hazard_banisher'
] as const satisfies readonly BonusRewardId[];

const DEFAULT_BONUS_REWARD_ID: BonusRewardId = 'bonus_shards';

export const BONUS_REWARD_CATALOG: Record<BonusRewardId, BonusRewardDefinition> = {
    chest_gold: {
        id: 'chest_gold',
        roomKind: 'treasure_chest',
        label: 'Treasure chest',
        trigger: 'Greed route on every fifth floor or authored treasure node.',
        discoverability: 'Shown as a Sealed Gallery node before entry; no hidden online roll.',
        eligibility: 'Floor 2+ and fewer than two chest-gold claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { shopGold: 2, score: 25, inventoryItems: { iron_key: 1 } },
        summaryText: '+2 shop gold, +25 score, and +1 dungeon key.'
    },
    secret_favor: {
        id: 'secret_favor',
        roomKind: 'secret_room',
        label: 'Secret shrine',
        trigger: 'Deterministic seed roll from a mystery or treasure-adjacent route.',
        discoverability: 'Foreshadowed as a cracked wall note in node copy; one secret per run.',
        eligibility: 'Floor 3+ and no secret room already discovered this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { relicFavorProgress: 1, inventoryItems: { peek_charge: 1 } },
        summaryText: '+1 relic Favor progress and +1 peek charge.'
    },
    bonus_shards: {
        id: 'bonus_shards',
        roomKind: 'bonus_cache',
        label: 'Bonus cache',
        trigger: 'Breather/treasure side room after a clean route choice.',
        discoverability: 'Displayed as a bonus cache reward row on eligible local nodes.',
        eligibility: 'Floor 2+ and fewer than two shard cache claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { comboShards: 1, inventoryItems: { guard_token: 1 } },
        summaryText: '+1 combo shard and +1 guard token, capped by run limits.'
    },
    supply_cache: {
        id: 'supply_cache',
        roomKind: 'bonus_cache',
        label: 'Supply cache',
        trigger: 'Armory side room after a routed cache, event, or treasure detour.',
        discoverability: 'Displayed as a supply cache reward row before claiming; never hidden behind online state.',
        eligibility: 'Floor 2+ and fewer than two supply-cache claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { score: 10, inventoryItems: { destroy_charge: 1, peek_charge: 1 } },
        summaryText: '+1 destroy charge, +1 peek charge, and +10 score.'
    },
    trait_toolkit: {
        id: 'trait_toolkit',
        roomKind: 'bonus_cache',
        label: 'Trait toolkit',
        traitBuildLabels: ['Drift Routing', 'Conduit Cartographer'],
        trigger: 'Route reward draft after trait-heavy or cache-adjacent floors.',
        discoverability: 'Shown as a board-shaping reward choice before the next floor.',
        eligibility: 'Floor 2+ and fewer than two trait-toolkit claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { score: 10, inventoryItems: { region_shuffle_charge: 1, peek_charge: 1 } },
        summaryText: '+1 row/swap charge, +1 peek charge, and +10 score.'
    },
    key_insurance: {
        id: 'key_insurance',
        roomKind: 'bonus_cache',
        label: 'Key insurance',
        trigger: 'Safe, treasure, or shop-adjacent route reward draft before locked exits can spike.',
        discoverability: 'Shown as a lock-safety reward choice before the next floor.',
        eligibility: 'Floor 2+ and fewer than two key-insurance claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { shopGold: 1, score: 10, inventoryItems: { iron_key: 1 } },
        summaryText: '+1 dungeon key, +1 shop gold, and +10 score.'
    },
    hazard_ward: {
        id: 'hazard_ward',
        roomKind: 'bonus_cache',
        label: 'Hazard ward',
        trigger: 'Trap, event, or mystery route reward draft before pressure-heavy floors.',
        discoverability: 'Shown as a defensive reward choice before the next floor.',
        eligibility: 'Floor 2+ and fewer than two hazard-ward claims this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 2 },
        payout: { score: 10, inventoryItems: { destroy_charge: 1, guard_token: 1 } },
        summaryText: '+1 destroy charge, +1 guard token, and +10 score.'
    },
    free_swap_floor: {
        id: 'free_swap_floor',
        roomKind: 'bonus_cache',
        label: 'Free swap discipline',
        traitBuildLabels: ['Drift Routing', 'Mirror Warden'],
        trigger: 'Build reward draft on shop, rest, or tool-heavy route nodes.',
        discoverability: 'Shown as a durable board-control reward before the next floor.',
        eligibility: 'Floor 2+ and one free-swap-discipline claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { rewardPerks: ['free_first_swap_per_floor'], score: 15 },
        summaryText: 'First row/swap use each floor is free, plus +15 score.'
    },
    echo_conduit_lens: {
        id: 'echo_conduit_lens',
        roomKind: 'bonus_cache',
        label: 'Echo conduit lens',
        traitBuildLabels: ['Conduit Cartographer', 'Sealed Catalyst'],
        trigger: 'Build reward draft after safe or mystery trait-routing floors.',
        discoverability: 'Shown as a durable Echo/Conduit interaction reward.',
        eligibility: 'Floor 2+ and one Echo conduit lens claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { rewardPerks: ['echo_conduit_double'], inventoryItems: { peek_charge: 1 } },
        summaryText: 'Echo effects trigger twice beside Conduit, plus +1 peek charge.'
    },
    trait_streak_lens: {
        id: 'trait_streak_lens',
        roomKind: 'bonus_cache',
        label: 'Trait streak lens',
        traitBuildLabels: ['Mirror Warden', 'Sealed Catalyst'],
        trigger: 'Build reward draft after trait-heavy floors.',
        discoverability: 'Shown as a durable clean-trait-streak reward.',
        eligibility: 'Floor 2+ and one trait streak lens claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { rewardPerks: ['trait_streak_toolkit'], score: 10 },
        summaryText: 'A trait match at x3+ clean streak creates +1 flash pair, plus +10 score.'
    },
    cursed_opener_contract: {
        id: 'cursed_opener_contract',
        roomKind: 'bonus_cache',
        label: 'Cursed opener contract',
        traitBuildLabels: ['Cursed Greed'],
        trigger: 'Greed reward draft after risky route pressure.',
        discoverability: 'Shown as a durable high-risk opener reward.',
        eligibility: 'Floor 2+ and one cursed opener contract claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { rewardPerks: ['cursed_opener_greed'], shopGold: 1 },
        summaryText: 'First clean Cursed match each floor gains extra gold and score, plus +1 shop gold.'
    },
    stasis_lockbox: {
        id: 'stasis_lockbox',
        roomKind: 'bonus_cache',
        label: 'Stasis lockbox',
        traitBuildLabels: ['Stasis Locksmith', 'Mirror Warden'],
        trigger: 'Build reward draft after Stasis, Sealed, or Conduit interaction floors.',
        discoverability: 'Shown as a board-control reward before floors with lockable trait clusters.',
        eligibility: 'Floor 2+ and one stasis-lockbox claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { score: 15, inventoryItems: { region_shuffle_charge: 1, guard_token: 1 } },
        summaryText: '+1 row/swap charge, +1 guard token, and +15 score.'
    },
    hazard_banisher: {
        id: 'hazard_banisher',
        roomKind: 'bonus_cache',
        label: 'Hazard banisher',
        trigger: 'Trap, mystery, or boss-prep reward draft.',
        discoverability: 'Shown as a durable pressure-control reward.',
        eligibility: 'Floor 2+ and one hazard banisher claim this run.',
        antiGrindLimit: { scope: 'per_run', maxClaims: 1 },
        payout: { rewardPerks: ['hazard_banish_per_floor'], inventoryItems: { destroy_charge: 1 } },
        summaryText: 'Gain +1 destroy charge now; each new floor banishes one hazard marker or grants +1 destroy charge.'
    }
};

const isBonusRewardId = (value: string): value is BonusRewardId =>
    Object.prototype.hasOwnProperty.call(BONUS_REWARD_CATALOG, value);

export const createBonusRewardLedger = (): BonusRewardLedger => ({
    claimedInstanceIds: [],
    claimedRewardIds: {},
    discoveredSecretRooms: 0,
    openedTreasureRooms: 0
});

const normalizeBonusRewardLedger = (ledger: BonusRewardLedger): BonusRewardLedger => {
    const claimedRewardIds: BonusRewardLedger['claimedRewardIds'] = {};
    if (ledger.claimedRewardIds && typeof ledger.claimedRewardIds === 'object' && !Array.isArray(ledger.claimedRewardIds)) {
        const savedRewardIds = ledger.claimedRewardIds as Partial<Record<BonusRewardId, unknown>>;
        for (const id of BONUS_REWARD_IDS) {
            const safeCount = nonNegativeLedgerCount(savedRewardIds[id]);
            if (safeCount > 0) {
                claimedRewardIds[id] = safeCount;
            }
        }
    }

    return {
        claimedInstanceIds: Array.isArray(ledger.claimedInstanceIds)
            ? [...new Set(ledger.claimedInstanceIds.filter((id): id is string => typeof id === 'string'))]
            : [],
        claimedRewardIds,
        discoveredSecretRooms: nonNegativeLedgerCount(ledger.discoveredSecretRooms),
        openedTreasureRooms: nonNegativeLedgerCount(ledger.openedTreasureRooms)
    };
};

const rewardIdsForRouteKind = (routeKind: RunMapNodeKind | 'unknown'): BonusRewardId[] => {
    if (routeKind === 'treasure') {
        return ['chest_gold', 'trait_toolkit', 'key_insurance', 'free_swap_floor', 'supply_cache', 'secret_favor', 'bonus_shards'];
    }
    if (routeKind === 'event') {
        return ['secret_favor', 'hazard_ward', 'trait_streak_lens', 'echo_conduit_lens', 'bonus_shards', 'supply_cache', 'chest_gold'];
    }
    if (routeKind === 'shop') {
        return ['trait_toolkit', 'free_swap_floor', 'key_insurance', 'hazard_banisher', 'supply_cache', 'chest_gold', 'secret_favor', 'bonus_shards'];
    }
    if (routeKind === 'rest') {
        return ['key_insurance', 'free_swap_floor', 'bonus_shards', 'trait_toolkit', 'supply_cache', 'secret_favor'];
    }
    return ['bonus_shards', 'trait_toolkit', 'trait_streak_lens', 'echo_conduit_lens', 'hazard_ward', 'hazard_banisher', 'supply_cache', 'key_insurance', 'chest_gold', 'secret_favor'];
};

const nonNegativeLedgerCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const nonNegativeFiniteAmount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const rewardCount = (ledger: BonusRewardLedger, id: BonusRewardId): number =>
    nonNegativeLedgerCount(ledger.claimedRewardIds?.[id]);

const isEligible = (definition: BonusRewardDefinition, floor: number, ledger: BonusRewardLedger): string | null => {
    if (floor < 2) {
        return 'Bonus rooms unlock after floor 1.';
    }
    if (definition.id === 'secret_favor' && floor < 3) {
        return 'Secret shrines unlock after floor 2.';
    }
    if (definition.roomKind === 'secret_room' && ledger.discoveredSecretRooms >= 1) {
        return 'Secret room already discovered this run.';
    }
    if (rewardCount(ledger, definition.id) >= definition.antiGrindLimit.maxClaims) {
        return `${definition.label} claim limit reached for this run.`;
    }
    return null;
};

const rotateRewardCandidates = (candidates: BonusRewardId[], startIndex: number): BonusRewardId[] => {
    if (candidates.length === 0) {
        return [];
    }
    const normalizedStart = ((startIndex % candidates.length) + candidates.length) % candidates.length;
    return [...candidates.slice(normalizedStart), ...candidates.slice(0, normalizedStart)];
};

const LOADOUT_REWARD_BIAS: Record<StartingLoadoutId, BonusRewardId[]> = {
    memory_scout: ['echo_conduit_lens', 'trait_streak_lens', 'secret_favor'],
    route_tactician: ['free_swap_floor', 'trait_toolkit'],
    cursebreaker: ['hazard_banisher', 'hazard_ward', 'cursed_opener_contract'],
    vaultbreaker: ['key_insurance', 'chest_gold']
};

const uniqueBonusRewardIds = (ids: readonly BonusRewardId[]): BonusRewardId[] => [...new Set(ids)];

const applyLoadoutRewardBias = (
    candidates: BonusRewardId[],
    startingLoadoutId: StartingLoadoutId | null | undefined
): BonusRewardId[] => {
    if (!startingLoadoutId) {
        return candidates;
    }
    const preferred = LOADOUT_REWARD_BIAS[startingLoadoutId] ?? [];
    return uniqueBonusRewardIds([
        ...preferred.filter((id) => candidates.includes(id)),
        ...candidates
    ]);
};

const applyBoardTraitRewardBias = (
    candidates: BonusRewardId[],
    board: BoardState | null | undefined
): BonusRewardId[] => {
    const buildRows = getTraitBuildRewardRowsForBoard(board);
    const buildLabels = new Set(buildRows.map((row) => row.label));
    if (buildLabels.size === 0) {
        return candidates;
    }
    const rankByBuildLabel = (id: BonusRewardId): number => {
        const labels = BONUS_REWARD_CATALOG[id].traitBuildLabels ?? [];
        const rank = buildRows.findIndex((row) => labels.includes(row.label));
        return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
    };
    const matchingCatalogRewards = BONUS_REWARD_IDS
        .filter((id) => (BONUS_REWARD_CATALOG[id].traitBuildLabels ?? []).some((label) => buildLabels.has(label)))
        .sort((a, b) => rankByBuildLabel(a) - rankByBuildLabel(b));
    const preferred = candidates
        .filter((id) => (BONUS_REWARD_CATALOG[id].traitBuildLabels ?? []).some((label) => buildLabels.has(label)))
        .sort((a, b) => rankByBuildLabel(a) - rankByBuildLabel(b));
    return uniqueBonusRewardIds([...matchingCatalogRewards, ...preferred, ...candidates]);
};

const selectBonusRewardDefinition = (
    candidates: BonusRewardId[],
    preferredIndex: number,
    floor: number,
    ledger: BonusRewardLedger
): BonusRewardDefinition => {
    const orderedCandidates = rotateRewardCandidates(candidates, preferredIndex);
    const eligibleRewardId = orderedCandidates.find((id) => isEligible(BONUS_REWARD_CATALOG[id], floor, ledger) === null);
    return BONUS_REWARD_CATALOG[eligibleRewardId ?? orderedCandidates[0] ?? DEFAULT_BONUS_REWARD_ID];
};

export const rollBonusRewardRoom = ({
    runSeed,
    rulesVersion,
    floor,
    routeKind = 'unknown',
    ledger = createBonusRewardLedger()
}: {
    runSeed: number;
    rulesVersion: number;
    floor: number;
    routeKind?: RunMapNodeKind | 'unknown';
    ledger?: BonusRewardLedger;
}): BonusRewardInstance => {
    const safeLedger = normalizeBonusRewardLedger(ledger);
    const candidates = rewardIdsForRouteKind(routeKind);
    const seed = hashStringToSeed(`bonusReward:${rulesVersion}:${runSeed}:${floor}:${routeKind}`);
    const preferredIndex = routeKind === 'treasure' ? 0 : Math.abs(seed) % candidates.length;
    const definition = selectBonusRewardDefinition(candidates, preferredIndex, floor, safeLedger);
    const unavailableReason = isEligible(definition, floor, safeLedger);
    return {
        ...definition,
        instanceId: `${rulesVersion}:${runSeed}:${floor}:${definition.id}`,
        runSeed,
        rulesVersion,
        floor,
        offlineOnly: true,
        eligible: unavailableReason === null,
        unavailableReason
    };
};

export const rollBonusRewardDraft = ({
    runSeed,
    rulesVersion,
    floor,
    routeKind = 'unknown',
    ledger = createBonusRewardLedger(),
    count = 3,
    startingLoadoutId = null,
    board = null
}: {
    runSeed: number;
    rulesVersion: number;
    floor: number;
    routeKind?: RunMapNodeKind | 'unknown';
    ledger?: BonusRewardLedger;
    count?: number;
    startingLoadoutId?: StartingLoadoutId | null;
    board?: BoardState | null;
}): BonusRewardInstance[] => {
    const safeLedger = normalizeBonusRewardLedger(ledger);
    const candidates = rewardIdsForRouteKind(routeKind);
    const seed = hashStringToSeed(`bonusRewardDraft:${rulesVersion}:${runSeed}:${floor}:${routeKind}`);
    const ordered = applyLoadoutRewardBias(
        applyBoardTraitRewardBias(
            rotateRewardCandidates(candidates, Math.abs(seed) % candidates.length),
            board
        ),
        startingLoadoutId
    );
    const selected: BonusRewardInstance[] = [];
    for (const id of ordered) {
        const definition = BONUS_REWARD_CATALOG[id];
        const instance = bonusRewardInstanceForDefinition(definition, runSeed, rulesVersion, floor, safeLedger);
        if (instance.eligible || selected.length === 0) {
            selected.push(instance);
        }
        if (selected.length >= Math.max(1, Math.min(3, Math.floor(count)))) {
            break;
        }
    }
    return selected;
};

const bonusRewardInstanceForDefinition = (
    definition: BonusRewardDefinition,
    runSeed: number,
    rulesVersion: number,
    floor: number,
    ledger: BonusRewardLedger
): BonusRewardInstance => {
    const unavailableReason = isEligible(definition, floor, ledger);
    return {
        ...definition,
        instanceId: `${rulesVersion}:${runSeed}:${floor}:${definition.id}`,
        runSeed,
        rulesVersion,
        floor,
        offlineOnly: true,
        eligible: unavailableReason === null,
        unavailableReason
    };
};

export const resolveBonusRewardRoomByInstanceId = ({
    runSeed,
    rulesVersion,
    floor,
    routeKind = 'unknown',
    ledger = createBonusRewardLedger(),
    instanceId
}: {
    runSeed: number;
    rulesVersion: number;
    floor: number;
    routeKind?: RunMapNodeKind | 'unknown';
    ledger?: BonusRewardLedger;
    instanceId: string;
}): BonusRewardInstance | null => {
    const safeLedger = normalizeBonusRewardLedger(ledger);
    const rolled = rollBonusRewardRoom({ runSeed, rulesVersion, floor, routeKind, ledger: safeLedger });
    if (rolled.instanceId === instanceId) {
        return rolled;
    }

    const prefix = `${rulesVersion}:${runSeed}:${floor}:`;
    if (!instanceId.startsWith(prefix)) {
        return null;
    }
    const rewardId = instanceId.slice(prefix.length);
    if (!isBonusRewardId(rewardId)) {
        return null;
    }
    return bonusRewardInstanceForDefinition(BONUS_REWARD_CATALOG[rewardId], runSeed, rulesVersion, floor, safeLedger);
};

const gainFavor = (run: RunState, progress: number): RunState => {
    const total = nonNegativeFiniteAmount(run.relicFavorProgress) + nonNegativeFiniteAmount(progress);
    const bonusPicks = Math.floor(total / 3);
    return {
        ...run,
        bonusRelicPicksNextOffer: nonNegativeFiniteAmount(run.bonusRelicPicksNextOffer) + bonusPicks,
        favorBonusRelicPicksNextOffer: nonNegativeFiniteAmount(run.favorBonusRelicPicksNextOffer) + bonusPicks,
        relicFavorProgress: total % 3
    };
};

const shouldApplyShrineEchoTreasurePayout = (
    run: RunState,
    ledger: BonusRewardLedger,
    reward: BonusRewardInstance
): boolean =>
    (run.relicIds ?? []).includes('shrine_echo') &&
    reward.roomKind === 'treasure_chest' &&
    ledger.openedTreasureRooms === 0;

export interface BonusRewardClaimResult {
    run: RunState;
    ledger: BonusRewardLedger;
    claimed: boolean;
    rewardId: BonusRewardId;
    feedback: {
        summary: string;
        gained: string[];
        capped: string[];
    };
    reason?: 'ineligible' | 'already_claimed';
}

export interface BonusRewardClaimPreview {
    eligible: boolean;
    rewardId: BonusRewardId;
    run: RunState;
    feedback: BonusRewardClaimResult['feedback'];
    reason?: 'ineligible';
}

const emptyFeedback = (summary: string): BonusRewardClaimResult['feedback'] => ({
    summary,
    gained: [],
    capped: []
});

const PARTIAL_PICKUP_OVERFLOW_SCORE = 5;
const FULL_PICKUP_OVERFLOW_SCORE = 10;

const pushUnique = (labels: string[], label: string): void => {
    if (!labels.includes(label)) {
        labels.push(label);
    }
};

const formatRewardUnit = (amount: number, singular: string, plural = `${singular}s`): string =>
    amount === 1 ? singular : plural;

const REWARD_PERK_LABELS: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'Free Route Link',
    echo_conduit_double: 'Echo Conduit Double',
    trait_streak_toolkit: 'Trait Streak Flash',
    cursed_opener_greed: 'Cursed Opener Greed',
    hazard_banish_per_floor: 'Hazard Banish'
};

const REWARD_PERK_DETAILS: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'First row shuffle or tile swap each floor is free.',
    echo_conduit_double: 'Echo beside Conduit grants an extra peek and repeats adjacent Sealed shard value.',
    trait_streak_toolkit: 'A trait match at x3+ clean streak banks a flash-pair charge.',
    cursed_opener_greed: 'The first Cursed match each floor grants extra shop gold and score.',
    hazard_banish_per_floor: 'Each new floor clears one hazard marker before play; if none exists, it grants a destroy charge.'
};

const REWARD_PERK_LANES: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'Route prime',
    echo_conduit_double: 'Trait combo',
    trait_streak_toolkit: 'Chain reward',
    cursed_opener_greed: 'Greed opener',
    hazard_banish_per_floor: 'Hazard control'
};

const REWARD_PERK_PAYOFFS: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'Free route link',
    echo_conduit_double: 'Double Echo payoff',
    trait_streak_toolkit: 'x3 trait flash',
    cursed_opener_greed: 'Cursed gold opener',
    hazard_banish_per_floor: 'Hazard erased before flip'
};

const REWARD_PERK_MOMENTS: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'First prime move',
    echo_conduit_double: 'Echo next to Conduit',
    trait_streak_toolkit: 'Trait match at x3+',
    cursed_opener_greed: 'First Cursed opener',
    hazard_banish_per_floor: 'Floor start'
};

const REWARD_PERK_NEXT_CUES: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'Use Swap or row shuffle to connect trait routes.',
    echo_conduit_double: 'Match Echo touching Conduit before cashing adjacent Sealed.',
    trait_streak_toolkit: 'Keep the clean chain alive; cash a trait match at x3+ for a tool.',
    cursed_opener_greed: 'Open the floor with Cursed when the board is already readable.',
    hazard_banish_per_floor: 'Check the first board beat; hazard pressure should already be reduced.'
};

const REWARD_PERK_ARCADE_CUES: Record<RewardPerkId, string> = {
    free_first_swap_per_floor: 'Free prime',
    echo_conduit_double: 'Double pop',
    trait_streak_toolkit: 'Trait cash',
    cursed_opener_greed: 'Open greed',
    hazard_banish_per_floor: 'Trap erased'
};

const isRewardPerkId = (id: unknown): id is RewardPerkId =>
    typeof id === 'string' && Object.prototype.hasOwnProperty.call(REWARD_PERK_LABELS, id);

const normalizeRewardPerkIds = (value: unknown): RewardPerkId[] =>
    Array.isArray(value) ? value.filter(isRewardPerkId) : [];

export const getRewardPerkRows = (run: Pick<RunState, 'rewardPerkIds'>) =>
    normalizeRewardPerkIds(run.rewardPerkIds).map((id) => ({
        id,
        label: REWARD_PERK_LABELS[id],
        detail: REWARD_PERK_DETAILS[id],
        arcadeCue: REWARD_PERK_ARCADE_CUES[id],
        lane: REWARD_PERK_LANES[id],
        moment: REWARD_PERK_MOMENTS[id],
        payoff: REWARD_PERK_PAYOFFS[id],
        nextCue: REWARD_PERK_NEXT_CUES[id]
    }));

export type RewardPerkReadinessState = 'armed' | 'soon' | 'spent' | 'passive';

export interface RewardPerkReadinessRow {
    id: RewardPerkId;
    label: string;
    detail: string;
    arcadeCue: string;
    lane: string;
    moment: string;
    payoff: string;
    nextCue: string;
    readiness: RewardPerkReadinessState;
    readinessLabel: string;
    readinessDetail: string;
    meterPercent: number;
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const rewardPerkReadiness = (
    id: RewardPerkId,
    run: Pick<
        RunState,
        | 'activeContract'
        | 'matchResolutionsThisFloor'
        | 'regionShuffleCharges'
        | 'regionShuffleFreeThisFloor'
        | 'stats'
    >
): Pick<RewardPerkReadinessRow, 'meterPercent' | 'readiness' | 'readinessDetail' | 'readinessLabel'> => {
    switch (id) {
        case 'free_first_swap_per_floor': {
            const freeSetupAvailable = run.regionShuffleFreeThisFloor || nonNegativeFiniteAmount(run.regionShuffleCharges) > 0;
            return freeSetupAvailable
                ? {
                      meterPercent: 100,
                      readiness: 'armed',
                      readinessDetail: 'Use row shuffle or tile swap to prime combo traits together.',
                      readinessLabel: 'Free prime armed'
                  }
                : {
                      meterPercent: 100,
                      readiness: 'spent',
                      readinessDetail: 'The prime move has been used this floor.',
                      readinessLabel: 'Prime spent'
                  };
        }
        case 'echo_conduit_double':
            return {
                meterPercent: 66,
                readiness: 'soon',
                readinessDetail: 'Look for Echo touching Conduit before resolving the pair.',
                readinessLabel: 'Needs Echo + Conduit'
            };
        case 'trait_streak_toolkit': {
            const streak = normalizeSessionStats(run.stats).currentStreak;
            const progress = Math.min(2, streak);
            return progress >= 2
                ? {
                      meterPercent: 100,
                      readiness: 'armed',
                      readinessDetail: 'The next trait match in this clean chain creates a flash-pair charge.',
                      readinessLabel: 'Trait cashout armed'
                  }
                : {
                      meterPercent: clampPercent((progress / 2) * 100),
                      readiness: 'soon',
                      readinessDetail: `${2 - progress} clean match${2 - progress === 1 ? '' : 'es'} until a trait match can cash this perk.`,
                      readinessLabel: `${progress}/2 chain`
                  };
        }
        case 'cursed_opener_greed':
            return run.matchResolutionsThisFloor === 0
                ? {
                      meterPercent: 100,
                      readiness: 'armed',
                      readinessDetail: 'Your first resolved match can cash the Cursed opener.',
                      readinessLabel: 'Opening greed armed'
                  }
                : {
                      meterPercent: 100,
                      readiness: 'spent',
                      readinessDetail: 'The opener window has closed for this floor.',
                      readinessLabel: 'Opener spent'
                  };
        case 'hazard_banish_per_floor':
            return {
                meterPercent: run.activeContract?.noDestroy ? 0 : 100,
                readiness: run.activeContract?.noDestroy ? 'spent' : 'passive',
                readinessDetail: run.activeContract?.noDestroy
                    ? 'Destroy-locked contract prevents hazard banish recovery.'
                    : 'Floor-start hazard control resolves automatically.',
                readinessLabel: run.activeContract?.noDestroy ? 'Blocked' : 'Auto floor start'
            };
    }
};

export const getRewardPerkReadinessRows = (
    run: Pick<
        RunState,
        | 'activeContract'
        | 'matchResolutionsThisFloor'
        | 'regionShuffleCharges'
        | 'regionShuffleFreeThisFloor'
        | 'rewardPerkIds'
        | 'stats'
    >
): RewardPerkReadinessRow[] =>
    getRewardPerkRows(run).map((row) => ({
        ...row,
        ...rewardPerkReadiness(row.id, run)
    }));

const REWARD_PERK_BOARD_CUE_PRIORITY: Record<RewardPerkId, number> = {
    trait_streak_toolkit: 5,
    cursed_opener_greed: 4,
    echo_conduit_double: 3,
    free_first_swap_per_floor: 2,
    hazard_banish_per_floor: 1
};

export const getPrimaryRewardPerkReadinessRow = (
    run: Parameters<typeof getRewardPerkReadinessRows>[0]
): RewardPerkReadinessRow | null =>
    getRewardPerkReadinessRows(run)
        .filter((row) => row.readiness === 'armed')
        .sort((a, b) => REWARD_PERK_BOARD_CUE_PRIORITY[b.id] - REWARD_PERK_BOARD_CUE_PRIORITY[a.id])[0] ?? null;

const applyBonusRewardPayout = (
    run: RunState,
    payout: BonusRewardPayout
): Pick<BonusRewardClaimResult, 'run' | 'feedback'> => {
    const gained: string[] = [];
    const capped: string[] = [];
    let cappedPickupParts = 0;
    const shopGoldGain = nonNegativeFiniteAmount(payout.shopGold);
    const scoreGain = nonNegativeFiniteAmount(payout.score);
    const favorProgressGain = nonNegativeFiniteAmount(payout.relicFavorProgress);
    const comboShardGain = nonNegativeFiniteAmount(payout.comboShards);
    const stats = normalizeSessionStats(run.stats);
    const currentComboShards = stats.comboShards;
    const nextComboShards = Math.min(MAX_COMBO_SHARDS, currentComboShards + comboShardGain);
    if (comboShardGain > 0) {
        const actual = nextComboShards - currentComboShards;
        if (actual > 0) {
            gained.push(`+${actual} ${formatRewardUnit(actual, 'combo shard')}`);
        }
        if (actual < comboShardGain) {
            cappedPickupParts += comboShardGain - actual;
            pushUnique(capped, 'Combo shards already full');
        }
    }

    let nextRewardPerkIds = normalizeRewardPerkIds(run.rewardPerkIds);
    let nextRun: RunState = {
        ...run,
        rewardPerkIds: nextRewardPerkIds,
        shopGold: nonNegativeFiniteAmount(run.shopGold) + shopGoldGain,
        stats: {
            ...stats,
            totalScore: stats.totalScore + scoreGain,
            currentLevelScore: stats.currentLevelScore + scoreGain,
            comboShards: nextComboShards
        }
    };
    if (shopGoldGain > 0) {
        gained.push(`+${shopGoldGain} shop gold`);
    }
    if (scoreGain > 0) {
        gained.push(`+${scoreGain} score`);
    }
    if (favorProgressGain > 0) {
        nextRun = gainFavor(nextRun, favorProgressGain);
        gained.push(`+${favorProgressGain} relic Favor progress`);
    }
    for (const perkId of normalizeRewardPerkIds(payout.rewardPerks)) {
        if (nextRewardPerkIds.includes(perkId)) {
            continue;
        }
        nextRewardPerkIds = [...nextRewardPerkIds, perkId];
        nextRun = { ...nextRun, rewardPerkIds: nextRewardPerkIds };
        gained.push(`Unlock ${REWARD_PERK_LABELS[perkId]}`);
        gained.push(`Perk next: ${REWARD_PERK_NEXT_CUES[perkId]}`);
    }
    for (const { id: itemId, amount } of getRunInventoryItemPayoutRows(payout.inventoryItems)) {
        if (amount <= 0) {
            continue;
        }
        const preview = getRunInventoryGainFeedback(nextRun, itemId, amount);
        nextRun = gainRunInventoryItem(nextRun, itemId, amount);
        if (preview.gainedLabel) {
            gained.push(preview.gainedLabel);
        }
        if (preview.capped && preview.cappedLabel) {
            cappedPickupParts += preview.requested - preview.accepted;
            pushUnique(capped, preview.cappedLabel);
        }
    }

    const overflowScore =
        cappedPickupParts <= 0
            ? 0
            : gained.length === 0
              ? FULL_PICKUP_OVERFLOW_SCORE
              : cappedPickupParts * PARTIAL_PICKUP_OVERFLOW_SCORE;
    if (overflowScore > 0) {
        nextRun = {
            ...nextRun,
            stats: {
                ...nextRun.stats,
                totalScore: nonNegativeFiniteAmount(nextRun.stats.totalScore) + overflowScore,
                currentLevelScore: nonNegativeFiniteAmount(nextRun.stats.currentLevelScore) + overflowScore
            }
        };
        gained.push(`+${overflowScore} overflow score`);
    }

    return {
        run: nextRun,
        feedback: {
            summary: [...gained, ...capped].join('; '),
            gained,
            capped
        }
    };
};

export const previewBonusRewardClaim = (
    run: RunState,
    reward: BonusRewardInstance
): BonusRewardClaimPreview => {
    if (!reward.eligible) {
        return {
            eligible: false,
            rewardId: reward.id,
            run,
            feedback: emptyFeedback(reward.unavailableReason ?? reward.summaryText),
            reason: 'ineligible'
        };
    }
    const applied = applyBonusRewardPayout(run, reward.payout);
    return {
        eligible: true,
        rewardId: reward.id,
        run: applied.run,
        feedback: {
            ...applied.feedback,
            summary: applied.feedback.summary || reward.summaryText
        }
    };
};

export const claimBonusReward = (
    run: RunState,
    ledger: BonusRewardLedger,
    reward: BonusRewardInstance
): BonusRewardClaimResult => {
    const safeLedger = normalizeBonusRewardLedger(ledger);
    if (reward.runSeed !== run.runSeed || reward.rulesVersion !== run.runRulesVersion) {
        return {
            run,
            ledger: safeLedger,
            claimed: false,
            rewardId: reward.id,
            feedback: emptyFeedback('Reward does not belong to this run.'),
            reason: 'ineligible'
        };
    }
    if (safeLedger.claimedInstanceIds.includes(reward.instanceId)) {
        return {
            run,
            ledger: safeLedger,
            claimed: false,
            rewardId: reward.id,
            feedback: emptyFeedback(reward.summaryText),
            reason: 'already_claimed'
        };
    }
    const currentUnavailableReason = isEligible(reward, reward.floor, safeLedger);
    if (!reward.eligible || currentUnavailableReason) {
        return {
            run,
            ledger: safeLedger,
            claimed: false,
            rewardId: reward.id,
            feedback: emptyFeedback(currentUnavailableReason ?? reward.unavailableReason ?? reward.summaryText),
            reason: 'ineligible'
        };
    }

    let { run: nextRun, feedback } = previewBonusRewardClaim(run, reward);
    if (shouldApplyShrineEchoTreasurePayout(run, safeLedger, reward)) {
        nextRun = gainFavor(nextRun, 1);
        feedback = {
            ...feedback,
            gained: [...feedback.gained, 'Shrine Echo: +1 relic Favor progress']
        };
    }

    return {
        run: nextRun,
        ledger: {
            claimedInstanceIds: [...safeLedger.claimedInstanceIds, reward.instanceId],
            claimedRewardIds: {
                ...safeLedger.claimedRewardIds,
                [reward.id]: rewardCount(safeLedger, reward.id) + 1
            },
            discoveredSecretRooms:
                safeLedger.discoveredSecretRooms + (reward.roomKind === 'secret_room' ? 1 : 0),
            openedTreasureRooms:
                safeLedger.openedTreasureRooms + (reward.roomKind === 'treasure_chest' ? 1 : 0)
        },
        claimed: true,
        rewardId: reward.id,
        feedback
    };
};

export const getBonusRewardRows = () =>
    BONUS_REWARD_IDS.map((id) => {
        const reward = BONUS_REWARD_CATALOG[id];
        return {
            id: reward.id,
            roomKind: reward.roomKind,
            label: reward.label,
            trigger: reward.trigger,
            eligibility: reward.eligibility,
            antiGrindLimit: `${reward.antiGrindLimit.maxClaims} per run`,
            summaryText: reward.summaryText,
            traitBuildLabels: [...(reward.traitBuildLabels ?? [])]
        };
    });
