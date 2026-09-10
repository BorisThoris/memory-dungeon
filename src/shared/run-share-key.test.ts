import { describe, expect, it } from 'vitest';
import {
    describeRunShareKey,
    encodeRunShareKey,
    parseRunShareKey,
    type RunShareKey
} from './run-share-key';
import {
    createNewRun,
    createWildRun
} from './run-creation-rules';

const scholarContract = { bonusRelicDraftPick: true, maxMismatches: null, noShuffle: true };
const pinVowContract = { maxMismatches: null, maxPinsTotalRun: 10, noShuffle: false };

const keyOf = (run: Parameters<typeof describeRunShareKey>[0]): RunShareKey => {
    const described = describeRunShareKey(run);
    if ('refusal' in described) {
        throw new Error(`expected a key, got: ${described.refusal}`);
    }
    return described.key;
};

describe('describeRunShareKey', () => {
    it('tells four endless variants apart, which the older mode:rules:seed recipe could not', () => {
        expect(keyOf(createNewRun(0)).variant).toBe('classic');
        expect(keyOf(createWildRun(0)).variant).toBe('wild');
        expect(keyOf(createNewRun(0, { practiceMode: true })).variant).toBe('practice');
        expect(keyOf(createNewRun(0, { activeContract: scholarContract })).variant).toBe('scholar');
        expect(keyOf(createNewRun(0, { activeContract: pinVowContract })).variant).toBe('pin_vow');
    });
});

describe('encode and parse', () => {
    it('round-trips every variant it can build', () => {
        for (const run of [
            createNewRun(0),
            createWildRun(0),
            createNewRun(0, { practiceMode: true }),
            createNewRun(0, { activeContract: scholarContract }),
            createNewRun(0, { activeContract: pinVowContract })
        ]) {
            const key = keyOf(run);
            expect(parseRunShareKey(encodeRunShareKey(key)), key.variant).toEqual(key);
        }
    });

    it('finds the key inside the whole sentence the copy button puts on the clipboard', () => {
        const key = keyOf(createWildRun(0));
        const pasted = `Memory Dungeon — Wild Run: floor 14, 2,340 points. Same run: ${encodeRunShareKey(key)}`;
        expect(parseRunShareKey(pasted)).toEqual(key);
    });

    it('reads a key someone typed in the wrong case', () => {
        expect(parseRunShareKey('MD1:CLASSIC:33:912')).toEqual({ rulesVersion: 33, seed: 912, variant: 'classic' });
    });

    it('returns null rather than guessing at anything that is not a key', () => {
        for (const input of ['', 'hello', 'md1:', 'md1:classic:33', 'md1:nonsense:33:912', 'md2:classic:33:912']) {
            expect(parseRunShareKey(input), input).toBeNull();
        }
    });

    it('refuses a key for a run this build cannot make, rather than replaying it as a Classic run', () => {
        // Each of these named a real variant once: a timed run, a calm run with chosen mutators,
        // a dungeon showcase. None can be reproduced now, and a Classic run on the same seed would
        // be a different run under the same name.
        for (const input of [
            'md1:gauntlet:33:912:600000',
            'md1:meditation:33:912:short_memorize',
            'md1:showcase:33:912'
        ]) {
            expect(parseRunShareKey(input), input).toBeNull();
        }
    });
});
