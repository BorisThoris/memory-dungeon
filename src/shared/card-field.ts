/**
 * The mass board stores one alive bit per pair, never one object per card.
 * Cells in the second half use a seeded bijection, so both cards have stable
 * positions and every clear removes the real pair exactly once.
 */
export const MIN_FIELD_CARD_EXPONENT = 4;
export const MAX_FIELD_CARD_EXPONENT = 26;
const FULL_WORD = 0xffffffff;

export interface CardField {
    readonly cardExponent: number;
    readonly seed: number;
    readonly columns: number;
    readonly rows: number;
    readonly pairCapacity: number;
    readonly livePairs: number;
    readonly aliveWords: readonly number[];
    readonly permutation: number;
    readonly permutationOffset: number;
    readonly inversePermutation: number;
    readonly revision: number;
}
export interface FieldClear {
    field: CardField;
    removedPairs: number;
    /** Work counters make scale tests independent of the host's clock speed. */
    visitedWords: number;
    visitedCells: number;
}
export interface SerializedCardField {
    version: 1;
    cardExponent: number;
    seed: number;
    aliveWords: number[];
}

export const fieldHash = (value: number): number => {
    let x = value >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    return (x ^ (x >>> 16)) >>> 0;
};
export const popcount32 = (value: number): number => {
    let x = value >>> 0;
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
};
const inverseOdd32 = (value: number): number => {
    let inverse = value;
    for (let i = 0; i < 5; i++) inverse = Math.imul(inverse, 2 - Math.imul(value, inverse));
    return inverse >>> 0;
};
const validExponent = (exponent: number): boolean => Number.isInteger(exponent) && exponent >= MIN_FIELD_CARD_EXPONENT && exponent <= MAX_FIELD_CARD_EXPONENT;

export const createCardField = (cardExponent: number, seed: number): CardField => {
    if (!validExponent(cardExponent)) throw new RangeError(`Card exponent must be ${MIN_FIELD_CARD_EXPONENT}–${MAX_FIELD_CARD_EXPONENT}`);
    const cardCapacity = 2 ** cardExponent;
    const pairCapacity = cardCapacity / 2;
    const columns = 2 ** Math.ceil(cardExponent / 2);
    const permutation = (fieldHash(seed) | 1) >>> 0;
    const aliveWords = new Array<number>(Math.ceil(pairCapacity / 32)).fill(FULL_WORD);
    if (pairCapacity < 32) aliveWords[0] = (2 ** pairCapacity - 1) >>> 0;
    return { cardExponent, seed: seed >>> 0, columns, rows: cardCapacity / columns,
        pairCapacity, livePairs: pairCapacity, aliveWords, permutation,
        permutationOffset: fieldHash(seed ^ 0xa511e9b3) & (pairCapacity - 1),
        inversePermutation: inverseOdd32(permutation), revision: 0 };
};

export const fieldPairAtCell = (field: CardField, cell: number): number | null => {
    if (!Number.isInteger(cell) || cell < 0 || cell >= field.pairCapacity * 2) return null;
    return cell < field.pairCapacity ? cell
        : (Math.imul(cell - field.pairCapacity, field.permutation) + field.permutationOffset) & (field.pairCapacity - 1);
};
export const fieldPairCells = (field: CardField, pair: number): readonly [number, number] | null => {
    if (!Number.isInteger(pair) || pair < 0 || pair >= field.pairCapacity) return null;
    return [pair, field.pairCapacity + (Math.imul(pair - field.permutationOffset, field.inversePermutation) & (field.pairCapacity - 1))];
};
export const fieldPairAlive = (field: CardField, pair: number): boolean =>
    Number.isInteger(pair) && pair >= 0 && pair < field.pairCapacity && ((field.aliveWords[pair >>> 5] ?? 0) & (1 << (pair & 31))) !== 0;
export const fieldCellAlive = (field: CardField, cell: number): boolean => {
    const pair = fieldPairAtCell(field, cell);
    return pair !== null && fieldPairAlive(field, pair);
};

/** One copy of the bitset per event, only if it changes. No per-card effect list. */
const fieldEditor = (field: CardField, requested: number) => {
    const limit = requested === Infinity ? field.livePairs : Math.min(field.livePairs, Math.max(0, Number.isFinite(requested) ? Math.floor(requested) : 0));
    let words: number[] | null = null;
    let removed = 0;
    let visitedWords = 0;
    let visitedCells = 0;
    const removeMask = (index: number, mask: number): void => {
        if (removed >= limit || index < 0 || index >= field.aliveWords.length) return;
        visitedWords++;
        const before = (words ?? field.aliveWords)[index]!;
        let hit = (before & mask) >>> 0;
        let count = popcount32(hit);
        if (count > limit - removed) {
            let kept = 0;
            count = limit - removed;
            for (let n = 0; n < count; n++) {
                const bit = (hit & -hit) >>> 0;
                kept = (kept | bit) >>> 0;
                hit = (hit & ~bit) >>> 0;
            }
            hit = kept;
        }
        if (count === 0) return;
        words ??= field.aliveWords.slice();
        words[index] = (before & ~hit) >>> 0;
        removed += count;
    };
    const removePair = (pair: number): void => {
        visitedCells++;
        if (Number.isInteger(pair) && pair >= 0 && pair < field.pairCapacity) removeMask(pair >>> 5, 1 << (pair & 31));
    };
    const removeRange = (from: number, to: number): void => {
        const start = Math.max(0, Math.ceil(from));
        const end = Math.min(field.pairCapacity - 1, Math.floor(to));
        for (let word = start >>> 5; word <= (end >>> 5) && start <= end && removed < limit; word++) {
            const left = word === (start >>> 5) ? start & 31 : 0;
            const right = word === (end >>> 5) ? end & 31 : 31;
            removeMask(word, ((FULL_WORD << left) & (FULL_WORD >>> (31 - right))) >>> 0);
        }
    };
    const removePermutedRange = (from: number, to: number): void => {
        if (from > to || removed >= limit) return;
        const mask = field.pairCapacity - 1;
        let pair = (Math.imul(from - field.pairCapacity, field.permutation) + field.permutationOffset) & mask;
        const step = field.permutation & mask;
        // Increment the bijection across a row. Avoid per-cell validation, popcount and call chains.
        for (let cell = from; cell <= to && removed < limit; cell++, pair = (pair + step) & mask) {
            visitedCells++; visitedWords++;
            const index = pair >>> 5, bit = 1 << (pair & 31);
            const before = (words ?? field.aliveWords)[index]!;
            if ((before & bit) === 0) continue;
            words ??= field.aliveWords.slice();
            words[index] = (before & ~bit) >>> 0;
            removed++;
        }
    };
    return {
        get full() { return removed >= limit; },
        removePair, removeRange, removeMask, removePermutedRange,
        finish: (): FieldClear => ({ field: words ? { ...field, aliveWords: words, livePairs: field.livePairs - removed, revision: field.revision + 1 } : field,
            removedPairs: removed, visitedWords, visitedCells })
    };
};

/** Focused memory matches clear their corresponding pairs in the large field. */
export const clearFieldPairs = (field: CardField, pairs: readonly number[]): FieldClear => {
    const edit = fieldEditor(field, pairs.length);
    for (const pair of pairs) edit.removePair(pair);
    return edit.finish();
};

/** Automatic engines clear a seeded band of live pairs in O(words), not O(cards). */
export const clearFieldBudget = (field: CardField, pairs: number, nonce: number): FieldClear => {
    const edit = fieldEditor(field, pairs);
    const start = fieldHash(field.seed ^ nonce) % field.aliveWords.length;
    for (let n = 0; n < field.aliveWords.length && !edit.full; n++) edit.removeMask((start + n) % field.aliveWords.length, FULL_WORD);
    return edit.finish();
};

/** A spatial impact clears cells inside its circle, along with their matching partners.
 * First-half spans are erased a word at a time; second-half cells use the exact permutation.
 * Whole-field impacts and automation use the word path even at tens of millions of cards.
 */
export const clearFieldCircle = (field: CardField, x: number, y: number, radius: number, maxPairs = Infinity): FieldClear => {
    const edit = fieldEditor(field, maxPairs);
    if (![x, y, radius].every(Number.isFinite) || radius < 0 || edit.full) return edit.finish();
    const maxDx = Math.max(Math.abs(x), Math.abs(x - field.columns + 1));
    const maxDy = Math.max(Math.abs(y), Math.abs(y - field.rows + 1));
    if (radius >= Math.hypot(maxDx, maxDy)) {
        edit.removeRange(0, field.pairCapacity - 1);
        return edit.finish();
    }
    const y0 = Math.max(0, Math.ceil(y - radius));
    const y1 = Math.min(field.rows - 1, Math.floor(y + radius));
    for (let row = y0; row <= y1 && !edit.full; row++) {
        const reach = Math.sqrt(Math.max(0, radius * radius - (row - y) ** 2));
        const left = Math.max(0, Math.ceil(x - reach));
        const right = Math.min(field.columns - 1, Math.floor(x + reach));
        if (left > right) continue;
        const first = row * field.columns + left;
        const last = row * field.columns + right;
        if (first < field.pairCapacity) edit.removeRange(first, Math.min(last, field.pairCapacity - 1));
        edit.removePermutedRange(Math.max(first, field.pairCapacity), last);
    }
    return edit.finish();
};

/** Select a real live target without constructing a list of all remaining cards. */
export const findLiveFieldPair = (field: CardField, nonce: number): number | null => {
    if (field.livePairs === 0) return null;
    const start = fieldHash(field.seed ^ nonce) % field.aliveWords.length;
    for (let n = 0; n < field.aliveWords.length; n++) {
        const index = (start + n) % field.aliveWords.length;
        const word = field.aliveWords[index]!;
        if (word !== 0) return index * 32 + 31 - Math.clz32((word & -word) >>> 0);
    }
    return null;
};

export const serializeCardField = (field: CardField): SerializedCardField => ({ version: 1, cardExponent: field.cardExponent, seed: field.seed, aliveWords: field.aliveWords.slice() });
export const restoreCardField = (value: unknown): CardField | null => {
    if (!value || typeof value !== 'object') return null;
    const input = value as Partial<SerializedCardField>;
    if (input.version !== 1 || !validExponent(input.cardExponent ?? NaN) || !Number.isInteger(input.seed) || input.seed! < 0 || input.seed! > FULL_WORD || !Array.isArray(input.aliveWords)) return null;
    if (input.aliveWords.length !== Math.ceil(2 ** (input.cardExponent! - 1) / 32)) return null;
    const field = createCardField(input.cardExponent!, input.seed!);
    if (input.aliveWords.length !== field.aliveWords.length) return null;
    let livePairs = 0;
    for (let i = 0; i < input.aliveWords.length; i++) {
        const word = input.aliveWords[i]!;
        if (!Number.isInteger(word) || word < 0 || word > FULL_WORD || ((word & ~field.aliveWords[i]!) >>> 0) !== 0) return null;
        livePairs += popcount32(word);
    }
    return { ...field, aliveWords: input.aliveWords.slice(), livePairs };
};
