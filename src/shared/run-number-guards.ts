export const runNonNegativeInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const runNonNegativeIntegerWithFallback = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : runNonNegativeInteger(fallback);

export const runNonNegativeIntegerOrFallback = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? runNonNegativeInteger(value) : fallback;

export const runNonNegativeIntegerOrNull = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? runNonNegativeInteger(value) : null;

export const decrementRunCounter = (value: unknown, amount = 1): number =>
    Math.max(0, runNonNegativeInteger(value) - runNonNegativeInteger(amount));

export const runFiniteIntegerDelta = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
