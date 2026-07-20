/**
 * Small in-repo weighted random helpers (no npm deps). Uses an injected `rng`
 * returning values in [0, 1) so runs stay deterministic when seeded elsewhere.
 */

/** Pick an index 0..weights.length-1 proportional to non-negative weights. If all weights are zero, picks uniformly. */
export const pickWeightedIndex = (rng: () => number, weights: readonly number[]): number => {
    if (weights.length === 0) {
        return 0;
    }
    let total = 0;
    const safe = weights.map((w) => (Number.isFinite(w) ? Math.max(0, w) : 0));
    for (const w of safe) {
        total += w;
    }
    const roll = (): number => {
        const value = rng();
        return Number.isFinite(value) ? Math.min(1 - Number.EPSILON, Math.max(0, value)) : 0;
    };
    if (total <= 0) {
        return Math.min(weights.length - 1, Math.floor(roll() * weights.length));
    }
    let r = roll() * total;
    for (let i = 0; i < safe.length; i += 1) {
        r -= safe[i];
        if (r < 0) {
            return i;
        }
    }
    return safe.length - 1;
};

/**
 * Up to `k` unique picks from `items` weighted without replacement.
 * If remaining total weight is zero before `k` picks, falls back to uniform among leftovers.
 */
export const pickWeightedWithoutReplacement = <T>(
    rng: () => number,
    items: readonly { value: T; weight: number }[],
    k: number
): T[] => {
    if (items.length === 0 || k <= 0) {
        return [];
    }
    const pool = items.map((x) => ({
        value: x.value,
        weight: Number.isFinite(x.weight) ? Math.max(0, x.weight) : 0
    }));
    const out: T[] = [];
    const take = Number.isFinite(k) ? Math.min(Math.floor(k), pool.length) : pool.length;
    for (let n = 0; n < take; n += 1) {
        const ws = pool.map((p) => p.weight);
        const idx = pickWeightedIndex(rng, ws);
        out.push(pool[idx]!.value);
        pool.splice(idx, 1);
    }
    return out;
};
