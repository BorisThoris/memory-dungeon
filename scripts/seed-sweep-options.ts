export const readNumericCliArg = (argv: readonly string[], name: string, fallback: number): number => {
    const prefix = `--${name}=`;
    const raw = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    return raw != null ? Number(raw) : fallback;
};

export const readSeedListCliArg = (argv: readonly string[], fallback: readonly number[]): number[] => {
    const prefix = '--seeds=';
    const raw = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    if (!raw) {
        return [...fallback];
    }

    const seeds = raw
        .split(/[,\s]+/u)
        .map((part) => Number(part.trim()))
        .filter((seed) => Number.isSafeInteger(seed) && seed > 0);
    return seeds.length > 0 ? seeds : [...fallback];
};

const floorFiniteOrFallback = (value: number, fallback: number): number =>
    Number.isFinite(value) ? Math.floor(value) : fallback;

export const readFlooredNumericCliArg = (argv: readonly string[], name: string, fallback: number): number =>
    floorFiniteOrFallback(readNumericCliArg(argv, name, fallback), fallback);

export const generateDeterministicStressSeeds = (count: number, baseSeed: number): number[] => {
    const seeds: number[] = [];
    let state = Math.max(1, Math.floor(baseSeed)) >>> 0;
    for (let index = 0; index < count; index += 1) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
        seeds.push(10_000 + (state % 990_000));
    }
    return seeds;
};

export const resolveSeedSweep = (argv: readonly string[], fallback: readonly number[]): number[] => {
    const stressSeedCount = Math.max(0, readFlooredNumericCliArg(argv, 'stressSeeds', 0));
    if (stressSeedCount > 0) {
        const baseSeed = readFlooredNumericCliArg(argv, 'stressSeedBase', 42_001);
        return generateDeterministicStressSeeds(stressSeedCount, baseSeed);
    }
    return readSeedListCliArg(argv, fallback);
};
