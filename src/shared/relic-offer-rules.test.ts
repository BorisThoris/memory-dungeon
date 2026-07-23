import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game-core';
import { grantBonusRelicPickNextOffer } from './relic-immediate-rules';
import {
    MAX_RELIC_PICKS_PER_OFFER,
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
    it('caps draft pick budget even when bonuses stack heavily', () => {
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

        expect(computeRelicOfferPickBudget(grantBonusRelicPickNextOffer(run, 1))).toBe(MAX_RELIC_PICKS_PER_OFFER);
    });

    it('opens an offer and consumes pending bonus pick counters used by the capped visit', () => {
        const run = grantBonusRelicPickNextOffer(levelCompleteRun({
            favorBonusRelicPicksNextOffer: 1
        }), 1);

        const opened = openRelicOffer(run);

        expect(opened.relicOffer?.picksRemaining).toBe(2);
        expect(opened.bonusRelicPicksNextOffer).toBe(0);
        expect(opened.favorBonusRelicPicksNextOffer).toBe(0);
        expect(opened.relicOffer?.favorBonusPicks).toBe(1);
    });

    it('carries unused banked bonus picks into later relic offers', () => {
        const run = grantBonusRelicPickNextOffer(levelCompleteRun({
            bonusRelicPicksNextOffer: 3,
            favorBonusRelicPicksNextOffer: 2
        }), 0);

        const opened = openRelicOffer(run);

        expect(opened.relicOffer?.picksRemaining).toBe(MAX_RELIC_PICKS_PER_OFFER);
        expect(opened.bonusRelicPicksNextOffer).toBe(1);
        expect(opened.favorBonusRelicPicksNextOffer).toBe(0);
        expect(opened.relicOffer?.favorBonusPicks).toBe(2);
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

    it('normalizes malformed multi-pick offer counters before continuing', () => {
        const opened = openRelicOffer(grantBonusRelicPickNextOffer(levelCompleteRun(), 1));
        const relicId = opened.relicOffer!.options[0]!;
        const run = {
            ...opened,
            relicOffer: {
                ...opened.relicOffer!,
                picksRemaining: 2.9,
                pickRound: Number.NaN
            }
        };

        const result = createRelicPickAdvanceResult(run, relicId);

        expect(result.kind).toBe('offerContinues');
        if (result.kind !== 'offerContinues') {
            return;
        }
        expect(result.run.relicOffer?.picksRemaining).toBe(1);
        expect(result.run.relicOffer?.pickRound).toBe(1);
    });

    it('normalizes malformed relic ids before appending selected relics', () => {
        const opened = openRelicOffer(levelCompleteRun({
            relicIds: Number.NaN as unknown as RunState['relicIds']
        }));
        const relicId = opened.relicOffer!.options[0]!;

        const result = createRelicPickAdvanceResult(opened, relicId);

        expect(result.kind).toBe('advanceToNextLevel');
        if (result.kind !== 'advanceToNextLevel') {
            return;
        }
        expect(result.run.relicIds).toEqual([relicId]);
    });

    it('normalizes malformed claimed tier counters before finalizing an offer', () => {
        const opened = openRelicOffer(levelCompleteRun());
        const relicId = opened.relicOffer!.options[0]!;

        const result = createRelicPickAdvanceResult({
            ...opened,
            relicTiersClaimed: Number.POSITIVE_INFINITY
        }, relicId);

        expect(result.kind).toBe('advanceToNextLevel');
        if (result.kind !== 'advanceToNextLevel') {
            return;
        }
        expect(result.run.relicTiersClaimed).toBe(1);
        expect(result.run.relicOffer).toBeNull();
    });

    it('normalizes malformed lives before opening or advancing relic offers', () => {
        const unopened = levelCompleteRun({ lives: Number.NaN });

        expect(openRelicOffer(unopened).relicOffer).toBeNull();

        const opened = openRelicOffer(levelCompleteRun());
        const relicId = opened.relicOffer!.options[0]!;
        const result = createRelicPickAdvanceResult({ ...opened, lives: Number.POSITIVE_INFINITY }, relicId);

        expect(result).toEqual({ kind: 'unchanged', run: { ...opened, lives: Number.POSITIVE_INFINITY } });
    });
});
