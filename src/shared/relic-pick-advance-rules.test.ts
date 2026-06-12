import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { grantBonusRelicPickNextOffer } from './relic-immediate-rules';
import { openRelicOffer } from './relic-offer-rules';
import { completeRelicPickAndAdvance } from './relic-pick-advance-rules';

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

describe('completeRelicPickAndAdvance', () => {
    it('leaves stale or invalid picks unchanged', () => {
        const run = levelCompleteRun({
            relicIds: ['extra_shuffle_charge'],
            relicOffer: {
                options: ['extra_shuffle_charge'],
                pickRound: 0,
                picksRemaining: 1,
                tier: 1
            }
        });

        expect(completeRelicPickAndAdvance(run, 'extra_shuffle_charge')).toBe(run);
    });

    it('keeps multi-pick offers open and advances after the final pick', () => {
        let run = openRelicOffer(grantBonusRelicPickNextOffer(levelCompleteRun(), 1));
        const first = run.relicOffer!.options[0]!;

        run = completeRelicPickAndAdvance(run, first);

        expect(run.status).toBe('levelComplete');
        expect(run.relicOffer?.picksRemaining).toBe(1);

        const second = run.relicOffer!.options[0]!;
        const next = completeRelicPickAndAdvance(run, second);

        expect(next.status).toBe('memorize');
        expect(next.relicOffer).toBeNull();
        expect(next.relicIds).toEqual(expect.arrayContaining([first, second]));
    });
});
