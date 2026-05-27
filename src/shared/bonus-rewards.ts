import {
    type BonusRewardId,
    type BonusRewardLedger,
    MAX_COMBO_SHARDS,
    type RunState
} from './contracts';
import { hashStringToSeed } from './rng';
import type { RunMapNodeKind } from './run-map';
import { gainRunInventoryItem, getRunInventoryGainFeedback, type RunInventoryItemId } from './run-inventory';

export type BonusRewardRoomKind = 'treasure_chest' | 'secret_room' | 'bonus_cache';

export interface BonusRewardPayout {
    shopGold?: number;
    comboShards?: number;
    relicFavorProgress?: number;
    score?: number;
    inventoryItems?: Partial<Record<RunInventoryItemId, number>>;
}

export interface BonusRewardDefinition {
    id: BonusRewardId;
    roomKind: BonusRewardRoomKind;
    label: string;
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
    }
};

export const createBonusRewardLedger = (): BonusRewardLedger => ({
    claimedInstanceIds: [],
    claimedRewardIds: {},
    discoveredSecretRooms: 0,
    openedTreasureRooms: 0
});

const normalizeBonusRewardLedger = (ledger: BonusRewardLedger): BonusRewardLedger => {
    const claimedRewardIds: BonusRewardLedger['claimedRewardIds'] = {};
    if (ledger.claimedRewardIds && typeof ledger.claimedRewardIds === 'object' && !Array.isArray(ledger.claimedRewardIds)) {
        for (const [id, count] of Object.entries(ledger.claimedRewardIds) as [BonusRewardId, unknown][]) {
            if (BONUS_REWARD_CATALOG[id]) {
                const safeCount = nonNegativeLedgerCount(count);
                if (safeCount > 0) {
                    claimedRewardIds[id] = safeCount;
                }
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
        return ['chest_gold', 'supply_cache', 'secret_favor', 'bonus_shards'];
    }
    if (routeKind === 'event') {
        return ['secret_favor', 'bonus_shards', 'supply_cache', 'chest_gold'];
    }
    return ['bonus_shards', 'supply_cache', 'chest_gold', 'secret_favor'];
};

const nonNegativeLedgerCount = (value: unknown): number =>
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

const selectBonusRewardDefinition = (
    candidates: BonusRewardId[],
    preferredIndex: number,
    floor: number,
    ledger: BonusRewardLedger
): BonusRewardDefinition => {
    const orderedCandidates = rotateRewardCandidates(candidates, preferredIndex);
    const eligibleRewardId = orderedCandidates.find((id) => isEligible(BONUS_REWARD_CATALOG[id], floor, ledger) === null);
    return BONUS_REWARD_CATALOG[eligibleRewardId ?? orderedCandidates[0]!];
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
    const rewardId = instanceId.slice(prefix.length) as BonusRewardId;
    const definition = BONUS_REWARD_CATALOG[rewardId];
    return definition ? bonusRewardInstanceForDefinition(definition, runSeed, rulesVersion, floor, safeLedger) : null;
};

const gainFavor = (run: RunState, progress: number): RunState => {
    const total = run.relicFavorProgress + progress;
    const bonusPicks = Math.floor(total / 3);
    return {
        ...run,
        bonusRelicPicksNextOffer: run.bonusRelicPicksNextOffer + bonusPicks,
        favorBonusRelicPicksNextOffer: run.favorBonusRelicPicksNextOffer + bonusPicks,
        relicFavorProgress: total % 3
    };
};

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

const nonNegativeFiniteAmount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const formatRewardUnit = (amount: number, singular: string, plural = `${singular}s`): string =>
    amount === 1 ? singular : plural;

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
    const currentComboShards = nonNegativeFiniteAmount(run.stats.comboShards);
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

    let nextRun: RunState = {
        ...run,
        shopGold: nonNegativeFiniteAmount(run.shopGold) + shopGoldGain,
        stats: {
            ...run.stats,
            totalScore: nonNegativeFiniteAmount(run.stats.totalScore) + scoreGain,
            currentLevelScore: nonNegativeFiniteAmount(run.stats.currentLevelScore) + scoreGain,
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
    for (const [itemId, amount] of Object.entries(payout.inventoryItems ?? {}) as [RunInventoryItemId, number][]) {
        const safeAmount = nonNegativeFiniteAmount(amount);
        if (safeAmount <= 0) {
            continue;
        }
        const preview = getRunInventoryGainFeedback(nextRun, itemId, safeAmount);
        nextRun = gainRunInventoryItem(nextRun, itemId, safeAmount);
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
                totalScore: nextRun.stats.totalScore + overflowScore,
                currentLevelScore: nextRun.stats.currentLevelScore + overflowScore
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

    const { run: nextRun, feedback } = previewBonusRewardClaim(run, reward);

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
    Object.values(BONUS_REWARD_CATALOG).map((reward) => ({
        id: reward.id,
        roomKind: reward.roomKind,
        label: reward.label,
        trigger: reward.trigger,
        eligibility: reward.eligibility,
        antiGrindLimit: `${reward.antiGrindLimit.maxClaims} per run`,
        summaryText: reward.summaryText
    }));
