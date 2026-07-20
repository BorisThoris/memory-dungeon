import { describe, expect, it } from 'vitest';
import {
    generateDeterministicStressSeeds,
    readFlooredNumericCliArg,
    readNumericCliArg,
    readPositiveFlooredNumericCliArg,
    readSeedListCliArg,
    resolveSeedSweep
} from '../../scripts/seed-sweep-options';

describe('seed sweep CLI options', () => {
    const fallbackSeeds = [42_001, 42_002, 77_707] as const;

    it('reads numeric options without changing missing-value fallback behavior', () => {
        expect(readNumericCliArg(['--floors=250'], 'floors', 1000)).toBe(250);
        expect(readNumericCliArg([], 'floors', 1000)).toBe(1000);
        expect(readNumericCliArg(['--floors='], 'floors', 1000)).toBe(0);
        expect(readNumericCliArg(['--floors=invalid'], 'floors', 1000)).toBeNaN();
    });

    it('floors numeric options and falls back when malformed values are not finite', () => {
        expect(readFlooredNumericCliArg(['--floors=250.9'], 'floors', 1000)).toBe(250);
        expect(readFlooredNumericCliArg([], 'floors', 1000)).toBe(1000);
        expect(readFlooredNumericCliArg(['--floors='], 'floors', 1000)).toBe(0);
        expect(readFlooredNumericCliArg(['--floors=invalid'], 'floors', 1000)).toBe(1000);
        expect(readFlooredNumericCliArg(['--floors=Infinity'], 'floors', 1000)).toBe(1000);
    });

    it('rejects non-positive floored numeric options when a positive value is required', () => {
        expect(readPositiveFlooredNumericCliArg(['--seed=42002.9'], 'seed', 42_001)).toBe(42_002);
        expect(readPositiveFlooredNumericCliArg(['--seed=0'], 'seed', 42_001)).toBe(42_001);
        expect(readPositiveFlooredNumericCliArg(['--seed='], 'seed', 42_001)).toBe(42_001);
        expect(readPositiveFlooredNumericCliArg(['--seed=-5'], 'seed', 42_001)).toBe(42_001);
        expect(readPositiveFlooredNumericCliArg(['--seed=invalid'], 'seed', 42_001)).toBe(42_001);
    });

    it('accepts comma and whitespace seed lists and rejects invalid seeds', () => {
        expect(readSeedListCliArg(['--seeds=42001, 42002 77707'], fallbackSeeds)).toEqual([
            42_001, 42_002, 77_707
        ]);
        expect(readSeedListCliArg(['--seeds=-1,0,3.5,9007199254740992,42001'], fallbackSeeds)).toEqual([42_001]);
    });

    it('returns a fresh fallback list when the explicit seed list is missing or malformed', () => {
        const missing = readSeedListCliArg([], fallbackSeeds);
        const malformed = readSeedListCliArg(['--seeds=,'], fallbackSeeds);

        expect(missing).toEqual(fallbackSeeds);
        expect(malformed).toEqual(fallbackSeeds);
        expect(missing).not.toBe(fallbackSeeds);
        expect(malformed).not.toBe(fallbackSeeds);
    });

    it('generates the established deterministic stress sequence', () => {
        expect(generateDeterministicStressSeeds(3, 42_001)).toEqual([432_012, 425_003, 878_670]);
        expect(generateDeterministicStressSeeds(3.9, Number.POSITIVE_INFINITY)).toEqual([
            828_748, 35_467, 583_038
        ]);
        expect(generateDeterministicStressSeeds(0, 42_001)).toEqual([]);
        expect(generateDeterministicStressSeeds(Number.POSITIVE_INFINITY, 42_001)).toEqual([]);
    });

    it('gives a positive stress sweep precedence over explicit seeds', () => {
        expect(
            resolveSeedSweep(
                ['--stressSeeds=3', '--stressSeedBase=42001', '--seeds=1,2,3'],
                fallbackSeeds
            )
        ).toEqual([432_012, 425_003, 878_670]);
    });

    it('falls back to the default deterministic base when the stress base is malformed', () => {
        expect(resolveSeedSweep(['--stressSeeds=3', '--stressSeedBase=invalid'], fallbackSeeds)).toEqual([
            432_012, 425_003, 878_670
        ]);
    });

    it('falls back to explicit or default seeds when stress count is not positive', () => {
        expect(resolveSeedSweep(['--stressSeeds=0', '--seeds=101,202'], fallbackSeeds)).toEqual([101, 202]);
        expect(resolveSeedSweep(['--stressSeeds=invalid'], fallbackSeeds)).toEqual(fallbackSeeds);
    });
});
