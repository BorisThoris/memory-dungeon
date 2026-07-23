/**
 * Small in-repo weighted random helpers (no npm deps). Uses an injected `rng`
 * returning values in [0, 1) so runs stay deterministic when seeded elsewhere.
 */
import { normalizeRngRoll } from './rng';
import { runNonNegativeIntegerWithFallback } from './run-number-guards';

const normalizeWeight = (weight: number): number => (Number.isFinite(weight) ? Math.max(0, weight) : 0);

const normalizePickCount = (count: number, max: number): number =>
    Math.min(runNonNegativeIntegerWithFallback(count, max), max);

/** Pick an index 0..weights.length-1 proportional to non-negative weights. If all weights are zero, picks uniformly. */
export const pickWeightedIndex = (rng: () => number, weights: readonly number[]): number => {
    if (weights.length === 0) {
        return 0;
    }
    let total = 0;
    const safe = weights.map(normalizeWeight);
    for (const w of safe) {
        total += w;
    }
    if (total <= 0) {
        return Math.min(weights.length - 1, Math.floor(normalizeRngRoll(rng()) * weights.length));
    }
    let r = normalizeRngRoll(rng()) * total;
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
        weight: normalizeWeight(x.weight)
    }));
    const out: T[] = [];
    const take = normalizePickCount(k, pool.length);
    for (let n = 0; n < take; n += 1) {
        const ws = pool.map((p) => p.weight);
        const idx = pickWeightedIndex(rng, ws);
        const [selected] = pool.splice(idx, 1);
        if (selected !== undefined) {
            out.push(selected.value);
        }
    }
    return out;
};
