import { describe, expect, it } from 'vitest';
import {
    FLIP_DURATION_MS,
    STAGGER_MS,
    computeBoardEntranceMotionBudgetMs,
    computeBoardEntranceMotionTransform,
    computeBoardEntranceRemainderXY,
    computeShuffleMotionBudgetMs,
    computeShuffleMotionTransform,
    computeStaggeredShuffleDealZ
} from './shuffleFlipAnimation';

describe('computeStaggeredShuffleDealZ (FX-013)', () => {
    it('returns 0 outside the shuffle window', () => {
        const budget = computeShuffleMotionBudgetMs(4);
        const deadline = 10_000 + budget;

        expect(computeStaggeredShuffleDealZ(9999, deadline, budget, 0, 4)).toBe(0);
        expect(computeStaggeredShuffleDealZ(deadline, deadline, budget, 0, 4)).toBe(0);
        expect(computeStaggeredShuffleDealZ(10_000, deadline, 0, 0, 4)).toBe(0);
    });

    it('ramps later tiles so stagger matches FLIP reading order', () => {
        const n = 4;
        const budget = computeShuffleMotionBudgetMs(n);
        const start = 50_000;
        const deadline = start + budget;
        const t = start + 200;

        const z0 = computeStaggeredShuffleDealZ(t, deadline, budget, 0, n);
        const zLast = computeStaggeredShuffleDealZ(t, deadline, budget, n - 1, n);

        expect(z0).toBeGreaterThan(0);
        expect(zLast).toBeGreaterThan(0);
        expect(z0).toBeGreaterThan(zLast);
    });

    it('peaks within the first FLIP duration after a tile’s stagger start', () => {
        const n = 3;
        const budget = computeShuffleMotionBudgetMs(n);
        const start = 100_000;
        const deadline = start + budget;
        const idx = 1;
        const tileStart = start + idx * STAGGER_MS;
        const peakTime = tileStart + FLIP_DURATION_MS * 0.5;
        const afterArc = tileStart + FLIP_DURATION_MS * 1.05;

        const zPeak = computeStaggeredShuffleDealZ(peakTime, deadline, budget, idx, n);
        const zAfter = computeStaggeredShuffleDealZ(afterArc, deadline, budget, idx, n);

        expect(zPeak).toBeGreaterThan(zAfter);
    });
});

describe('premium board motion transforms', () => {
    it('caps entrance timing below the full shuffle budget on larger boards', () => {
        const entrance = computeBoardEntranceMotionBudgetMs(30);
        const shuffle = computeShuffleMotionBudgetMs(30);

        expect(entrance).toBeLessThan(shuffle);
        expect(entrance).toBeLessThanOrEqual(680);
    });

    it('returns neutral transforms outside the active window', () => {
        const budget = computeShuffleMotionBudgetMs(6);
        const deadline = 20_000 + budget;

        expect(computeShuffleMotionTransform(19_999, deadline, budget, 1, 6, 2, 3)).toEqual({
            rx: 0,
            ry: 0,
            rz: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0
        });
        expect(computeBoardEntranceMotionTransform(deadline, deadline, budget, 1, 6, 2, 3)).toEqual({
            rx: 0,
            ry: 0,
            rz: 0,
            rotX: 0,
            rotY: 0,
            rotZ: 0
        });
    });

    it('stagger ordering keeps early shuffle tiles further along than late ones', () => {
        const budget = computeShuffleMotionBudgetMs(6);
        const start = 30_000;
        const deadline = start + budget;
        const sampleTime = start + 240;

        const early = computeShuffleMotionTransform(sampleTime, deadline, budget, 0, 6, 2, 3);
        const late = computeShuffleMotionTransform(sampleTime, deadline, budget, 5, 6, 2, 3);

        expect(Math.abs(early.rz)).toBeGreaterThan(Math.abs(late.rz));
        expect(Math.abs(early.rotZ)).toBeGreaterThan(Math.abs(late.rotZ));
    });

    it('shuffle transform peaks mid-window and settles exactly to rest', () => {
        const budget = computeShuffleMotionBudgetMs(8);
        const start = 40_000;
        const deadline = start + budget;
        const idx = 2;
        const tileStart = start + idx * STAGGER_MS;
        const peakTime = tileStart + FLIP_DURATION_MS * 0.5;
        const lateTime = tileStart + FLIP_DURATION_MS * 0.92;

        const peak = computeShuffleMotionTransform(peakTime, deadline, budget, idx, 8, 2, 4);
        const late = computeShuffleMotionTransform(lateTime, deadline, budget, idx, 8, 2, 4);
        const atRest = computeShuffleMotionTransform(deadline, deadline, budget, idx, 8, 2, 4);

        expect(Math.abs(peak.rz)).toBeGreaterThan(Math.abs(late.rz));
        expect(Math.abs(peak.rotY)).toBeGreaterThan(0);
        expect(atRest).toEqual({ rx: 0, ry: 0, rz: 0, rotX: 0, rotY: 0, rotZ: 0 });
    });

    it('entrance transform stays visible but less disruptive than the in-board shuffle', () => {
        const budget = computeBoardEntranceMotionBudgetMs(9);
        const start = 50_000;
        const deadline = start + budget;
        const sampleTime = start + 220;

        const shuffle = computeShuffleMotionTransform(sampleTime, deadline, budget, 4, 9, 3, 3);
        const entrance = computeBoardEntranceMotionTransform(sampleTime, deadline, budget, 4, 9, 3, 3);

        expect(entrance).not.toEqual(shuffle);
        expect(Math.hypot(entrance.rx, entrance.ry)).toBeGreaterThan(0);
        expect(Math.hypot(entrance.rx, entrance.ry)).toBeLessThan(2.5);
        expect(Math.abs(entrance.rotY)).toBeGreaterThan(0);
    });

    it('keeps the legacy entrance XY wrapper aligned with the full transform', () => {
        const budget = computeBoardEntranceMotionBudgetMs(9);
        const start = 60_000;
        const deadline = start + budget;
        const sampleTime = start + 180;

        const transform = computeBoardEntranceMotionTransform(sampleTime, deadline, budget, 2, 9, 3, 3);

        expect(computeBoardEntranceRemainderXY(sampleTime, deadline, budget, 2, 9, 3, 3)).toEqual({
            rx: transform.rx,
            ry: transform.ry
        });
    });
});
