import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import {
    CALLSIGN_SYMBOLS,
    LETTER_SYMBOLS,
    NUMBER_SYMBOLS,
    getSymbolBandReadabilityRows,
    getSymbolSetForLevel,
    getSymbolSetIndexForLevel
} from './tile-symbol-catalog';

describe('tile-symbol-catalog', () => {
    it('maps floor brackets to symbol band indices', () => {
        expect(getSymbolSetIndexForLevel(1)).toBe(0);
        expect(getSymbolSetIndexForLevel(8)).toBe(0);
        expect(getSymbolSetIndexForLevel(9)).toBe(1);
        expect(getSymbolSetIndexForLevel(16)).toBe(1);
        expect(getSymbolSetIndexForLevel(17)).toBe(2);
        expect(getSymbolSetIndexForLevel(999)).toBe(2);
    });

    it('clamps invalid levels to bracket logic', () => {
        expect(getSymbolSetIndexForLevel(0)).toBe(0);
        expect(getSymbolSetIndexForLevel(Number.NaN)).toBe(0);
        expect(getSymbolSetIndexForLevel(Number.POSITIVE_INFINITY)).toBe(0);
        expect(getSymbolSetForLevel(Number.NaN)).toBe(NUMBER_SYMBOLS);
    });

    it('returns the catalog slice for each band', () => {
        expect(getSymbolSetForLevel(4)).toBe(NUMBER_SYMBOLS);
        expect(getSymbolSetForLevel(9.9)).toBe(LETTER_SYMBOLS);
        expect(getSymbolSetForLevel(10)).toBe(LETTER_SYMBOLS);
        expect(getSymbolSetForLevel(20)).toBe(CALLSIGN_SYMBOLS);
    });

    it('buildBoard at level 17 uses callsign symbols for generated pair faces', () => {
        const board = buildBoard(17, { runSeed: 42_001, runRulesVersion: GAME_RULES_VERSION });
        const callsignSymbols = new Set(CALLSIGN_SYMBOLS.map((entry) => entry.symbol));
        expect(board.tiles.some((tile) => callsignSymbols.has(tile.symbol))).toBe(true);
    });

    it('keeps symbol bands readable and avoids known confusable glyphs', () => {
        const rows = getSymbolBandReadabilityRows();
        expect(rows.map((row) => row.band)).toEqual(['numeric', 'letters', 'callsigns']);
        expect(rows.every((row) => row.maxLabelLength <= 7)).toBe(true);
        expect(rows.flatMap((row) => row.forbiddenConfusables)).toEqual([]);
    });
});
