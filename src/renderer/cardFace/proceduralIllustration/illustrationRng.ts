export type IllustrationRng = {
    nextU32: () => number;
    /** In [0, 1) */
    nextFloat01: () => number;
    /** In [0, max) integer */
    nextInt: (max: number) => number;
    /** In [min, max] inclusive integer */
    nextIntInclusive: (min: number, max: number) => number;
    pickWeighted: <T>(entries: readonly { value: T; weight: number }[]) => T;
};

const positiveInteger = (value: number): number => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

const positiveWeight = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

/** Mulberry32 — fast deterministic PRNG for illustration rolls. */
export const createIllustrationRng = (seed: number): IllustrationRng => {
    let state = seed >>> 0;

    const nextU32 = (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return (t ^ (t >>> 14)) >>> 0;
    };

    const nextFloat01 = (): number => nextU32() / 4294967296;

    const nextInt = (max: number): number => {
        const normalizedMax = positiveInteger(max);
        if (normalizedMax <= 0) {
            return 0;
        }
        return nextU32() % normalizedMax;
    };

    const nextIntInclusive = (min: number, max: number): number => {
        if (!Number.isFinite(min)) {
            return 0;
        }
        const normalizedMin = Math.floor(min);
        if (!Number.isFinite(max)) {
            return normalizedMin;
        }
        const normalizedMax = Math.floor(max);
        if (normalizedMax <= normalizedMin) {
            return normalizedMin;
        }
        return normalizedMin + nextInt(normalizedMax - normalizedMin + 1);
    };

    const pickWeighted = <T>(entries: readonly { value: T; weight: number }[]): T => {
        const first = entries[0];
        if (!first) {
            throw new RangeError('pickWeighted requires at least one entry.');
        }
        let total = 0;
        for (const e of entries) {
            total += positiveWeight(e.weight);
        }
        if (total <= 0) {
            return first.value;
        }
        let r = nextFloat01() * total;
        for (const e of entries) {
            r -= positiveWeight(e.weight);
            if (r <= 0) {
                return e.value;
            }
        }
        return entries[entries.length - 1]?.value ?? first.value;
    };

    return { nextU32, nextFloat01, nextInt, nextIntInclusive, pickWeighted };
};
