import { describe, expect, it } from 'vitest';
import { clearFieldBudget, clearFieldCircle, clearFieldPairs, createCardField, fieldCellAlive, fieldPairAlive, fieldPairAtCell, fieldPairCells, findLiveFieldPair, popcount32, restoreCardField, serializeCardField } from './card-field';

const countLive = (field: ReturnType<typeof createCardField>) => field.aliveWords.reduce((sum, word) => sum + popcount32(word), 0);

describe('the actual large card field', () => {
    it('has exactly two stable cells for every pair, including the permuted half', () => {
        for (const seed of [0, 1, 73, 0xffffffff]) {
            const field = createCardField(12, seed);
            const appearances = new Uint8Array(field.pairCapacity);
            for (let cell = 0; cell < field.pairCapacity * 2; cell++) {
                const pair = fieldPairAtCell(field, cell)!;
                appearances[pair]++;
                expect(fieldPairCells(field, pair)).toContain(cell);
            }
            expect(appearances.every(count => count === 2)).toBe(true);
            expect(fieldPairAtCell(field, -1)).toBeNull();
            expect(fieldPairAtCell(field, 4096)).toBeNull();
        }
    });
    it('backs more than two million individual cards with 32,768 words, not card objects', () => {
        const field = createCardField(21, 42);
        expect(field.columns * field.rows).toBe(2_097_152);
        expect(field.livePairs * 2).toBe(2_097_152);
        expect(field.aliveWords).toHaveLength(32_768);
        expect(field.aliveWords.length * 8).toBeLessThan(300_000);
        for (const cell of [0, 63, 345_821, 1_048_576, 2_097_151]) {
            const pair = fieldPairAtCell(field, cell)!;
            const cleared = clearFieldPairs(field, [pair]);
            expect(cleared.removedPairs).toBe(1);
            for (const partner of fieldPairCells(field, pair)!) expect(fieldCellAlive(cleared.field, partner)).toBe(false);
            expect(fieldCellAlive(field, cell)).toBe(true);
        }
    });
    it('clears spatial circles exactly against an independent cell-by-cell oracle', () => {
        for (const seed of [0, 11, 923]) {
            const field = createCardField(10, seed);
            for (const [x, y, radius] of [[0, 0, 4], [16, 20, 7.5], [-4, 8, 6], [23, 31, 9], [8, 8, 0]]) {
                const hit = new Set<number>();
                for (let cell = 0; cell < field.pairCapacity * 2; cell++) {
                    if ((cell % field.columns - x!) ** 2 + (Math.floor(cell / field.columns) - y!) ** 2 <= radius! ** 2) hit.add(fieldPairAtCell(field, cell)!);
                }
                const result = clearFieldCircle(field, x!, y!, radius!);
                expect(result.removedPairs).toBe(hit.size);
                expect(result.field.livePairs).toBe(field.livePairs - hit.size);
                for (let pair = 0; pair < field.pairCapacity; pair++) expect(fieldPairAlive(result.field, pair)).toBe(!hit.has(pair));
                expect(countLive(result.field)).toBe(result.field.livePairs);
                expect(clearFieldCircle(result.field, x!, y!, radius!).removedPairs).toBe(0);
            }
        }
    });
    it('bounds an impact by its power and never rewards overlapping hits twice', () => {
        let field = createCardField(21, 17);
        let removed = 0;
        for (const budget of [1, 17, 60_000, 250_000]) {
            const result = clearFieldCircle(field, 700, 500, 800, budget);
            expect(result.removedPairs).toBe(budget);
            expect(result.field.livePairs).toBe(field.livePairs - budget);
            removed += budget;
            field = result.field;
        }
        expect(countLive(field)).toBe(1_048_576 - removed);
        const target = findLiveFieldPair(field, 10)!;
        const first = clearFieldPairs(field, [target, target, -1, NaN]);
        expect(first.removedPairs).toBe(1);
        const again = clearFieldPairs(first.field, [target]);
        expect(again.removedPairs).toBe(0);
        expect(again.field).toBe(first.field);
    });
    it('clears a whole million-card field with word operations and an immutable previous state', () => {
        const original = createCardField(21, 3);
        const result = clearFieldCircle(original, 0, 0, 5000);
        expect(result.removedPairs).toBe(1_048_576);
        expect(result.visitedWords).toBe(32_768);
        expect(result.visitedCells).toBe(0);
        expect(result.field.livePairs).toBe(0);
        expect(countLive(result.field)).toBe(0);
        expect(original.livePairs).toBe(1_048_576);
        expect(countLive(original)).toBe(1_048_576);
        expect(findLiveFieldPair(result.field, 17)).toBeNull();
    });
    it('supports automatic clears with exact budgets through fragmentation and exhaustion', () => {
        let field = createCardField(21, 300);
        for (let step = 0; step < 20; step++) {
            const previous = field;
            const result = clearFieldBudget(field, 60_013, step);
            expect(result.removedPairs).toBe(Math.min(previous.livePairs, 60_013));
            expect(result.visitedCells).toBe(0);
            expect(result.visitedWords).toBeLessThanOrEqual(previous.aliveWords.length);
            field = result.field;
        }
        expect(field.livePairs).toBe(0);
        expect(countLive(field)).toBe(0);
    });
    it('round-trips a genuinely damaged million-card field without losing its pair mapping', () => {
        const field = clearFieldCircle(createCardField(21, 67), 900, 700, 320).field;
        const restored = restoreCardField(JSON.parse(JSON.stringify(serializeCardField(field))))!;
        expect(restored).not.toBeNull();
        expect(restored.aliveWords).toEqual(field.aliveWords);
        expect(restored.livePairs).toBe(field.livePairs);
        for (const cell of [7, 12_123, 1_152_316, 2_097_151]) expect(fieldPairAtCell(restored, cell)).toBe(fieldPairAtCell(field, cell));
        expect(clearFieldBudget(restored, 35_617, 17).field.aliveWords).toEqual(clearFieldBudget(field, 35_617, 17).field.aliveWords);
    });
    it('rejects malformed fields and treats invalid or empty impacts as no-ops', () => {
        const field = createCardField(4, 1);
        const saved = serializeCardField(field);
        expect(restoreCardField({ ...saved, aliveWords: [0xffffffff] })).toBeNull();
        expect(restoreCardField({ ...saved, aliveWords: [] })).toBeNull();
        expect(restoreCardField({ ...saved, aliveWords: [-1] })).toBeNull();
        expect(restoreCardField({ ...saved, cardExponent: 100 })).toBeNull();
        expect(clearFieldCircle(field, NaN, 0, 4).field).toBe(field);
        expect(clearFieldCircle(field, 0, 0, -1).field).toBe(field);
        expect(clearFieldBudget(field, 0, 0).field).toBe(field);
    });
});
