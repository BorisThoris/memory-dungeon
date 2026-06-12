import { describe, expect, it } from 'vitest';

import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    GAME_RULES_VERSION,
    type RunState
} from './contracts';
import { acceptEndlessRiskWager, canOfferEndlessRiskWager } from './risk-wager-rules';

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        status: 'levelComplete',
        relicOffer: null,
        gameMode: 'endless',
        runRulesVersion: GAME_RULES_VERSION,
        endlessRiskWager: null,
        featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
        lastLevelResult: {
            level: 4,
            featuredObjectiveId: 'flip_par',
            featuredObjectiveCompleted: true
        },
        ...overrides
    }) as RunState;

describe('risk wager rules', () => {
    it('offers endless risk wagers after a completed objective streak', () => {
        expect(canOfferEndlessRiskWager(run())).toBe(true);
    });

    it('accepts an offered wager for the next level', () => {
        expect(acceptEndlessRiskWager(run()).endlessRiskWager).toEqual({
            acceptedOnLevel: 4,
            targetLevel: 5,
            streakAtRisk: ENDLESS_RISK_WAGER_MIN_STREAK,
            bonusFavorOnSuccess: ENDLESS_RISK_WAGER_BONUS_FAVOR
        });
    });

    it('does not mutate runs that are not eligible', () => {
        const ineligible = run({ gameMode: 'daily' });

        expect(canOfferEndlessRiskWager(ineligible)).toBe(false);
        expect(acceptEndlessRiskWager(ineligible)).toBe(ineligible);
    });
});
