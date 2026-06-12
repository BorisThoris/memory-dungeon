import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game-core';
import { grantBonusRelicPickNextOffer } from './relic-immediate-rules';
import {
    computeRelicOfferPickBudget,
    createRelicPickAdvanceResult,
    openRelicOffer
} from './relic-offer-rules';

const levelCompleteRun = (overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(999, { gameMode: 'endless' }),
    status: 'levelComplete',
    lastLevelResult: {
        clearLifeGained: 0,
        clearLifeReason: 'none',
        level: 3,
        livesRemaining: 3,
        mistakes: 0,
        perfect: false,
        rating: 'S',
        scoreGained: 1
    },
    ...overrides
});

describe('relic-offer-rules', () => {
    it('computes draft pick budget from run bonuses, daily mode, mutators, and contract flags', () => {
        const run = createNewRun(0, {
            activeContract: {
                bonusRelicDraftPick: true,
                maxMismatches: null,
                noDestroy: true,
                noShuffle: true
            },
            activeMutators: ['generous_shrine'],
            gameMode: 'daily',
            metaRelicDraftExtraPerMilestone: 1
        });

        expect(computeRelicOfferPickBudget(grantBonusRelicPickNextOffer(run, 1))).toBe(6);
    });

    it('opens an offer and consumes pending bonus pick counters', () => {
        const run = grantBonusRelicPickNextOffer(levelCompleteRun({
            favorBonusRelicPicksNextOffer: 1
        }), 1);

        const opened = openRelicOffer(run);

        expect(opened.relicOffer?.picksRemaining).toBe(2);
        expect(opened.bonusRelicPicksNextOffer).toBe(0);
        expect(opened.favorBonusRelicPicksNextOffer).toBe(0);
        expect(opened.relicOffer?.favorBonusPicks).toBe(1);
    });

    it('returns unchanged for stale or invalid relic picks', () => {
        const run = levelCompleteRun({
            relicIds: ['extra_shuffle_charge'],
            relicOffer: {
                options: ['extra_shuffle_charge'],
                pickRound: 0,
                picksRemaining: 1,
                tier: 1
            }
        });

        expect(createRelicPickAdvanceResult(run, 'extra_shuffle_charge')).toEqual({
            kind: 'unchanged',
            run
        });
    });

    it('continues multi-pick offers before returning an advance result for the final pick', () => {
        let run = openRelicOffer(grantBonusRelicPickNextOffer(levelCompleteRun(), 1));
        const first = run.relicOffer!.options[0]!;
        const firstResult = createRelicPickAdvanceResult(run, first);

        expect(firstResult.kind).toBe('offerContinues');
        if (firstResult.kind !== 'offerContinues') {
            return;
        }
        expect(firstResult.run.relicOffer?.picksRemaining).toBe(1);

        run = firstResult.run;
        const second = run.relicOffer!.options[0]!;
        const secondResult = createRelicPickAdvanceResult(run, second);

        expect(secondResult.kind).toBe('advanceToNextLevel');
        if (secondResult.kind !== 'advanceToNextLevel') {
            return;
        }
        expect(secondResult.run.relicOffer).toBeNull();
        expect(secondResult.run.relicTiersClaimed).toBe(1);
        expect(secondResult.run.relicIds).toEqual(expect.arrayContaining([first, second]));
    });
});
