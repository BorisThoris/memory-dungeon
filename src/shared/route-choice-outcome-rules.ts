import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    type RouteChoice,
    type RouteNodeType,
    type RunState
} from './contracts';
import { addPendingMemorizeBonusForLostLives } from './recall-rules';
import { getRunDungeonMapState } from './dungeon-run-state-rules';
import { gainRelicFavor } from './relic-favor-rules';
import { hashStringToSeed } from './rng';
import {
    ROUTE_GREED_SCORE_REWARD,
    ROUTE_GREED_SHOP_GOLD_REWARD,
    ROUTE_MYSTERY_SHOP_GOLD_REWARD,
    getRouteChoiceAvailability
} from './route-choice-rules';
import { createRouteCardPlan } from './route-card-plan-rules';
import {
    revealDungeonChoices,
    selectDungeonNode
} from './run-map';
import { normalizeSessionStats } from './session-stats-rules';

type MysteryRouteOutcome = 'shop_gold' | 'combo_shard' | 'relic_favor';

export interface RouteChoiceOutcomeResult {
    run: RunState;
    applied: boolean;
    routeType?: RouteNodeType;
    reason?: 'missing_choice' | 'invalid_status' | 'unavailable';
    summaryText?: string;
}

const withSelectedDungeonRoute = (
    run: RunState,
    choiceId: string,
    routeChoices: readonly RouteChoice[] = run.lastLevelResult?.routeChoices ?? []
): RunState => {
    const selected = selectDungeonNode(getRunDungeonMapState(run), choiceId);
    if (selected.selectedNodeId === choiceId || routeChoices.length === 0) {
        return { ...run, dungeonRun: selected };
    }

    const sourceFloor = run.lastLevelResult?.level ?? run.board?.level ?? selected.currentFloor;
    const revealed = revealDungeonChoices(selected, sourceFloor, routeChoices);
    return {
        ...run,
        dungeonRun: selectDungeonNode(revealed, choiceId)
    };
};

const mysteryRouteOutcomeFor = (run: RunState, clearedFloor: number): MysteryRouteOutcome => {
    const outcomes: MysteryRouteOutcome[] = ['shop_gold', 'combo_shard', 'relic_favor'];
    const seed = hashStringToSeed(`routeMystery:${run.runRulesVersion}:${run.runSeed}:${clearedFloor}`);
    return outcomes[Math.abs(seed) % outcomes.length] ?? 'relic_favor';
};

const nonNegativeRouteCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const addRouteScore = (run: RunState, score: number): RunState => {
    const scoreGain = nonNegativeRouteCount(score);
    const stats = normalizeSessionStats(run.stats);
    const totalScore = stats.totalScore + scoreGain;
    const bestScore = Math.max(stats.bestScore, totalScore);
    return {
        ...run,
        stats: {
            ...stats,
            totalScore,
            currentLevelScore: stats.currentLevelScore + scoreGain,
            bestScore
        },
        lastLevelResult: run.lastLevelResult
            ? {
                  ...run.lastLevelResult,
                  scoreGained: nonNegativeRouteCount(run.lastLevelResult.scoreGained) + scoreGain
              }
            : run.lastLevelResult
    };
};

const applySafeRouteRecallStabilization = (run: RunState): { run: RunState; summarySuffix: string } => {
    const recallLapses = nonNegativeRouteCount(run.lastLevelResult?.recallMistakes);
    if (recallLapses <= 0) {
        return { run, summarySuffix: '' };
    }
    const pendingMemorizeBonusBefore = nonNegativeRouteCount(run.pendingMemorizeBonusMs);
    const pendingMemorizeBonusMs = addPendingMemorizeBonusForLostLives(pendingMemorizeBonusBefore, 1);
    const gainedMs = pendingMemorizeBonusMs - pendingMemorizeBonusBefore;
    if (gainedMs <= 0) {
        return { run, summarySuffix: '' };
    }
    return {
        run: { ...run, pendingMemorizeBonusMs },
        summarySuffix: ` Recall stabilized: +${gainedMs}ms memorize time.`
    };
};

const applySafeRouteRecoveryToll = (run: RunState): { run: RunState; summarySuffix: string } => {
    const shopGold = nonNegativeRouteCount(run.shopGold);
    if (shopGold <= 0) {
        return { run, summarySuffix: '' };
    }
    return {
        run: { ...run, shopGold: shopGold - 1 },
        summarySuffix: ' Spent 1 shop gold.'
    };
};

const applyMysteryRouteOutcome = (run: RunState): { run: RunState; summaryText: string } => {
    const stats = normalizeSessionStats(run.stats);
    const clearedFloor = run.lastLevelResult?.level ?? run.board?.level ?? stats.highestLevel;
    const outcome = mysteryRouteOutcomeFor(run, clearedFloor);
    if (outcome === 'shop_gold') {
        return {
            run: { ...run, shopGold: nonNegativeRouteCount(run.shopGold) + ROUTE_MYSTERY_SHOP_GOLD_REWARD },
            summaryText: `Mystery route: +${ROUTE_MYSTERY_SHOP_GOLD_REWARD} shop gold.`
        };
    }
    if (outcome === 'combo_shard') {
        const comboShardsBefore = stats.comboShards;
        const comboShards = Math.min(MAX_COMBO_SHARDS, comboShardsBefore + 1);
        return {
            run: {
                ...run,
                stats: {
                    ...stats,
                    comboShards
                }
            },
            summaryText:
                comboShards > comboShardsBefore
                    ? 'Mystery route: +1 combo shard.'
                    : 'Mystery route: combo shards already full.'
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
    if (run.status !== 'levelComplete' || nonNegativeRouteCount(run.lives) <= 0) {
        return { run, applied: false, reason: 'invalid_status' };
    }
    const routeChoices = run.lastLevelResult?.routeChoices ?? [];
    const choice: RouteChoice | undefined = routeChoices.find((item) => item.id === choiceId);
    if (!choice) {
        return { run, applied: false, reason: 'missing_choice' };
    }
    if (
        run.pendingRouteCardPlan &&
        (routeChoices.some((item) => item.id === run.pendingRouteCardPlan?.choiceId) ||
            run.pendingRouteCardPlan.choiceId.startsWith('gateway:') ||
            run.pendingRouteCardPlan.choiceId.startsWith('loaded_gateway:'))
    ) {
        return { run, applied: false, routeType: choice.routeType, reason: 'unavailable' };
    }
    const availability = getRouteChoiceAvailability(run, choice);
    if (!availability.available) {
        return { run, applied: false, routeType: choice.routeType, reason: 'unavailable' };
    }
    const pendingRouteCardPlan = createRouteCardPlan(run, choice);
    if (choice.routeType === 'safe') {
        if (nonNegativeRouteCount(run.lives) < MAX_LIVES) {
            const tolled = applySafeRouteRecoveryToll(run);
            const lives = nonNegativeRouteCount(tolled.run.lives) + 1;
            const nextRun = applySafeRouteRecallStabilization({
                ...tolled.run,
                lives,
                pendingRouteCardPlan,
                lastLevelResult: tolled.run.lastLevelResult
                    ? { ...tolled.run.lastLevelResult, livesRemaining: lives }
                    : tolled.run.lastLevelResult
            });
            return {
                run: withSelectedDungeonRoute(nextRun.run, choiceId, routeChoices),
                applied: true,
                routeType: choice.routeType,
                summaryText: `Safe route: +1 life.${tolled.summarySuffix}${nextRun.summarySuffix}`
            };
        }
        const stats = normalizeSessionStats(run.stats);
        const guardTokensBefore = stats.guardTokens;
        const guardTokens = Math.min(MAX_GUARD_TOKENS, guardTokensBefore + 1);
        const guardGained = guardTokens > guardTokensBefore;
        const tolled = guardGained ? applySafeRouteRecoveryToll(run) : { run, summarySuffix: '' };
        const guardSummary = guardGained
            ? 'Safe route: +1 guard token.'
            : 'Safe route: guard tokens already full.';
        const nextRun = applySafeRouteRecallStabilization({
            ...tolled.run,
            pendingRouteCardPlan,
            stats: { ...normalizeSessionStats(tolled.run.stats), guardTokens }
        });
        return {
            run: withSelectedDungeonRoute(nextRun.run, choiceId, routeChoices),
            applied: true,
            routeType: choice.routeType,
            summaryText: `${guardSummary}${tolled.summarySuffix}${nextRun.summarySuffix}`
        };
    }
    if (choice.routeType === 'greed') {
        const scored = addRouteScore(run, ROUTE_GREED_SCORE_REWARD);
        const lives = Math.max(0, nonNegativeRouteCount(scored.lives) - 1);
        const nextRun = {
            ...scored,
            lives,
            shopGold: nonNegativeRouteCount(scored.shopGold) + ROUTE_GREED_SHOP_GOLD_REWARD,
            pendingRouteCardPlan,
            lastLevelResult: scored.lastLevelResult
                ? { ...scored.lastLevelResult, livesRemaining: lives }
                : scored.lastLevelResult
        };
        return {
            run: withSelectedDungeonRoute(nextRun, choiceId, routeChoices),
            applied: true,
            routeType: choice.routeType,
            summaryText: `Greedy route: +${ROUTE_GREED_SHOP_GOLD_REWARD} shop gold, +${ROUTE_GREED_SCORE_REWARD} score, -1 life.`
        };
    }
    const outcome = applyMysteryRouteOutcome(run);
    return {
        run: withSelectedDungeonRoute({ ...outcome.run, pendingRouteCardPlan }, choiceId, routeChoices),
        applied: true,
        routeType: choice.routeType,
        summaryText: outcome.summaryText
    };
};
