import type { LevelResult, RouteChoice, RunState } from './contracts';
import { getRouteTraitForecastLine } from './tile-trait-rules';

export const ROUTE_GREED_SHOP_GOLD_REWARD = 3;
export const ROUTE_GREED_SCORE_REWARD = 35;
export const ROUTE_MYSTERY_SHOP_GOLD_REWARD = 2;
export const ROUTE_CARD_GREED_SHOP_GOLD_REWARD = 2;
export const ROUTE_CARD_GREED_SCORE_REWARD = 25;
export const ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD = 2;

export interface RouteChoiceAvailability {
    available: boolean;
    reason?: 'needs_more_lives';
    label?: string;
}

export const isRouteChoice = (value: unknown): value is RouteChoice => {
    if (value == null || typeof value !== 'object') {
        return false;
    }
    const choice = value as { detail?: unknown; id?: unknown; label?: unknown; routeType?: unknown };
    return (
        typeof choice.id === 'string' &&
        (choice.routeType === 'safe' || choice.routeType === 'greed' || choice.routeType === 'mystery') &&
        typeof choice.label === 'string' &&
        typeof choice.detail === 'string'
    );
};

export const routeChoicesForResult = (lastLevelResult: LevelResult | null | undefined): readonly RouteChoice[] =>
    Array.isArray(lastLevelResult?.routeChoices) ? lastLevelResult.routeChoices.filter(isRouteChoice) : [];

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
            detail: `Standard next floor. Keep the run curve predictable. ${getRouteTraitForecastLine('safe', run.relicIds)}`,
            rewardPreview: 'Recover 1 life if wounded; otherwise gain 1 guard token; costs 1 shop gold if you have any.'
        },
        {
            id: `${baseId}:greed`,
            routeType: 'greed',
            label: 'Greedy route',
            detail: `${greedDetail} ${getRouteTraitForecastLine('greed', run.relicIds)}`,
            rewardPreview: `+${ROUTE_GREED_SHOP_GOLD_REWARD} shop gold and +${ROUTE_GREED_SCORE_REWARD} score.`,
            riskPreview: '-1 life; unavailable at 1 life.'
        },
        {
            id: `${baseId}:mystery`,
            routeType: 'mystery',
            label: 'Mystery route',
            detail: `${mysteryDetail} ${getRouteTraitForecastLine('mystery', run.relicIds)}`,
            rewardPreview: 'Deterministic local reward: gold, combo shard, or relic Favor.'
        }
    ];
};

export const getRouteChoiceAvailability = (run: RunState, choice: RouteChoice): RouteChoiceAvailability => {
    if (choice.routeType === 'greed' && run.lives <= 1) {
        return {
            available: false,
            reason: 'needs_more_lives',
            label: 'Unavailable at 1 life'
        };
    }
    return { available: true };
};
