/** Deterministic PRNG + shuffle for seeded runs (daily, export/import, puzzles). */

export const hashStringToSeed = (str: string): number => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

/** Mulberry32: returns [0, 1) each call; mutates internal state via closure. */
export const createMulberry32 = (seed: number): (() => number) => {
    let t = seed >>> 0;
    return (): number => {
        t += 0x6d2b79f5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

export const normalizeRngRoll = (value: number): number =>
    Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;

export const pickRngIndex = (rng: () => number, length: number): number => {
    const safeLength = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
    return safeLength > 0 ? Math.floor(normalizeRngRoll(rng()) * safeLength) : 0;
};

export const shuffleWithRng = <T>(rng: () => number, items: T[]): T[] => {
    const next = [...items];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = pickRngIndex(rng, i + 1);
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};

export const deriveLevelTileRngSeed = (runSeed: number, level: number, rulesVersion: number): number =>
    hashStringToSeed(`tiles:${rulesVersion}:${runSeed}:${level}`);

export const deriveShuffleRngSeed = (runSeed: number, level: number, shuffleNonce: number, rulesVersion: number): number =>
    hashStringToSeed(`shuffle:${rulesVersion}:${runSeed}:${level}:${shuffleNonce}`);

export const deriveDailyRunSeed = (rulesVersion: number, date: Date = new Date()): number => {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    const key = `${rulesVersion}-${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return hashStringToSeed(key);
};

export const formatDailyDateKeyUtc = (date: Date = new Date()): string => {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
};

export const utcDateKeyMinusOneDay = (key: string): string => {
    if (!/^\d{8}$/.test(key)) {
        return key;
    }
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(4, 6)) - 1;
    const d = Number(key.slice(6, 8));
    const dt = new Date(Date.UTC(y, m, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) {
        return key;
    }
    dt.setUTCDate(dt.getUTCDate() - 1);
    return formatDailyDateKeyUtc(dt);
};

export const deriveDailyMutatorIndex = (dailySeed: number, mutatorTableLength: number): number => {
    if (mutatorTableLength <= 0) {
        return 0;
    }
    return hashStringToSeed(`dailyMut:${dailySeed}`) % mutatorTableLength;
};
