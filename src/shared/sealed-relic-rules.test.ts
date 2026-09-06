import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { getRelicDraftRow, isRelicDraftEligible, RELIC_POOL, rollRelicOptions } from './relics';
import { openRelicOffer } from './relic-offer-rules';
import { rollSealedRelic } from './sealed-relic-rules';
import type { RelicId, RunState } from './contracts';

const clearedRun = (runSeed: number): RunState => {
    const base = createNewRun(0, { runSeed, gameMode: 'endless' });
    return {
        ...base,
        status: 'levelComplete',
        lastLevelResult: {
            clearLifeGained: 0,
            clearLifeReason: 'none',
            level: 3,
            livesRemaining: 3,
            mistakes: 0,
            perfect: false,
            rating: 'A',
            scoreGained: 100
        }
    };
};

describe('the sealed offering', () => {
    it('is a real relic from the pool, not a placeholder', () => {
        const run = clearedRun(1_234);
        const options = rollRelicOptions(run, 0, 3, 0);
        const sealed = rollSealedRelic(run, 0, 3, 0, options);

        expect(sealed).toBeTruthy();
        expect(RELIC_POOL).toContain(sealed as RelicId);
        expect(isRelicDraftEligible(sealed!, run)).toBe(true);
    });

    it('is never a card already face up beside it', () => {
        // A seal the player can read unsealed on the next card is a lie the first time they notice.
        for (const runSeed of [11, 222, 3_333, 44_444]) {
            const run = clearedRun(runSeed);
            const options = rollRelicOptions(run, 0, 3, 0);
            expect(options).not.toContain(rollSealedRelic(run, 0, 3, 0, options) as RelicId);
        }
    });

    it('leans rarer than the table, which is the whole reason to take it', () => {
        let checked = 0;
        for (const runSeed of [5_150, 60, 7_000, 81, 92_000, 103]) {
            const run = clearedRun(runSeed);
            const options = rollRelicOptions(run, 0, 3, 0);
            const rareLeft = RELIC_POOL.filter(
                (id) =>
                    !options.includes(id) &&
                    isRelicDraftEligible(id, run) &&
                    getRelicDraftRow(id).rarity === 'rare'
            );
            if (rareLeft.length === 0) {
                continue;
            }
            checked += 1;
            expect(rareLeft).toContain(rollSealedRelic(run, 0, 3, 0, options) as RelicId);
        }

        // A loop that never entered its assertion is a test that proves nothing.
        expect(checked).toBeGreaterThan(0);
    });

    it('is the same seal on a replay of the same run, floor and round', () => {
        const run = clearedRun(777);
        const options = rollRelicOptions(run, 0, 3, 0);

        expect(rollSealedRelic(run, 0, 3, 0, options)).toBe(rollSealedRelic(run, 0, 3, 0, options));
    });

    it('returns nobody rather than repeating an option when the pool is exhausted', () => {
        const run = clearedRun(999);
        expect(rollSealedRelic(run, 0, 3, 0, [...RELIC_POOL])).toBeNull();
    });
});

describe('a player can actually reach it', () => {
    it('is on the offer a cleared floor opens', () => {
        // Declared-but-unreachable is this project's most repeated defect: the seal has to be on
        // the offer the game builds, not only in the function that rolls one.
        const offered = openRelicOffer(clearedRun(2_468));

        expect(offered.relicOffer).toBeTruthy();
        expect(offered.relicOffer!.sealedRelicId).toBeTruthy();
        expect(offered.relicOffer!.options).not.toContain(offered.relicOffer!.sealedRelicId as RelicId);
    });

    it('can be picked, and lands as the relic it always was', async () => {
        const { createRelicPickAdvanceResult } = await import('./relic-offer-rules');
        const offered = openRelicOffer(clearedRun(2_468));
        const sealed = offered.relicOffer!.sealedRelicId!;
        const result = createRelicPickAdvanceResult(offered, sealed);

        expect(result.kind).not.toBe('unchanged');
        expect(result.run.relicIds).toContain(sealed);
    });

    it('still refuses a relic that was never on the table at all', async () => {
        // Accepting the seal must not have opened the draft to every relic in the pool.
        const { createRelicPickAdvanceResult } = await import('./relic-offer-rules');
        const offered = openRelicOffer(clearedRun(2_468));
        const notOffered = RELIC_POOL.find(
            (id) => !offered.relicOffer!.options.includes(id) && id !== offered.relicOffer!.sealedRelicId
        )!;

        expect(createRelicPickAdvanceResult(offered, notOffered)).toEqual({ kind: 'unchanged', run: offered });
    });
});
