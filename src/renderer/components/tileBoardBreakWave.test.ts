import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { BREAK_WAVE_MAX_DELAY_SECONDS, BREAK_WAVE_SECONDS_PER_STEP, getBreakWaveDelaySec,
    FEVER_WAVE_MAX_DELAY_SECONDS,
    FEVER_WAVE_SLOW
} from './tileBoardBreakWave';

const tile = (id: string, state: Tile['state'], suit: Tile['suit']): Tile => ({
    id,
    pairKey: id[0]!,
    symbol: id[0]!,
    label: id[0]!,
    state,
    suit
});

describe('the break wave', () => {
    // 3 columns:   A(matched) B(removed) C(removed)
    //              D(hidden)  E(hidden)  F(removed)
    const tiles = [
        tile('A1', 'matched', 'ember'),
        tile('B1', 'removed', 'ember'),
        tile('C1', 'removed', 'ember'),
        tile('D1', 'hidden', 'tide'),
        tile('E1', 'hidden', 'ember'),
        tile('F1', 'removed', 'ember')
    ];
    const board = { columns: 3, tiles };

    it('spreads out from the matched tile of the same suit, one step at a time', () => {
        expect(getBreakWaveDelaySec(board, tiles[1]!)).toBeCloseTo(BREAK_WAVE_SECONDS_PER_STEP);
        expect(getBreakWaveDelaySec(board, tiles[2]!)).toBeCloseTo(2 * BREAK_WAVE_SECONDS_PER_STEP);
        expect(getBreakWaveDelaySec(board, tiles[5]!)).toBeCloseTo(3 * BREAK_WAVE_SECONDS_PER_STEP);
    });

    it('is zero for anything that is not leaving', () => {
        expect(getBreakWaveDelaySec(board, tiles[0]!)).toBe(0);
        expect(getBreakWaveDelaySec(board, tiles[3]!)).toBe(0);
    });

    it('never waits longer than the cap, whatever the board size', () => {
        const far = [tile('A1', 'matched', 'moss'), ...Array.from({ length: 40 }, (_, i) => tile(`h${i}`, 'hidden', 'bone')), tile('Z1', 'removed', 'moss')];
        expect(getBreakWaveDelaySec({ columns: 1, tiles: far }, far.at(-1)!)).toBe(BREAK_WAVE_MAX_DELAY_SECONDS);
    });

    it('plays a Fever break slower and lets it run longer: the hit-stop', () => {
        const fever = { ...tiles[2]!, brokenAtTier: 'fever' as const };
        expect(getBreakWaveDelaySec(board, fever)).toBeCloseTo(2 * BREAK_WAVE_SECONDS_PER_STEP * FEVER_WAVE_SLOW);
        expect(FEVER_WAVE_SLOW).toBeGreaterThan(1);
        expect(FEVER_WAVE_MAX_DELAY_SECONDS).toBeGreaterThan(BREAK_WAVE_MAX_DELAY_SECONDS);
        expect(FEVER_WAVE_MAX_DELAY_SECONDS).toBeLessThan(1);
        const far = [tile('A1', 'matched', 'moss'), ...Array.from({ length: 40 }, (_, i) => tile(`h${i}`, 'hidden', 'bone')), { ...tile('Z1', 'removed', 'moss'), brokenAtTier: 'fever' as const }];
        expect(getBreakWaveDelaySec({ columns: 1, tiles: far }, far.at(-1)!)).toBe(FEVER_WAVE_MAX_DELAY_SECONDS);
        // Sharp keeps the ordinary pace: the hit-stop is Fever's alone.
        expect(getBreakWaveDelaySec(board, { ...tiles[2]!, brokenAtTier: 'sharp' as const })).toBeCloseTo(2 * BREAK_WAVE_SECONDS_PER_STEP);
    });

    it('leaves without a wave when no matched tile shares its suit, rather than never leaving', () => {
        const orphan = [tile('A1', 'matched', 'tide'), tile('B1', 'removed', 'ember')];
        expect(getBreakWaveDelaySec({ columns: 2, tiles: orphan }, orphan[1]!)).toBe(0);
    });
});
