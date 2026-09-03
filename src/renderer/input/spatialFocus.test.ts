import { describe, expect, it } from 'vitest';
import { pickSpatialNeighbour, type FocusRect, type SpatialCandidate } from './spatialFocus';

const box = (left: number, top: number, width = 100, height = 40): FocusRect => ({
    bottom: top + height,
    left,
    right: left + width,
    top
});

const named = (entries: Record<string, FocusRect>): SpatialCandidate<string>[] =>
    Object.entries(entries).map(([value, rect]) => ({ rect, value }));

describe('pickSpatialNeighbour', () => {
    it('walks a row in the order it reads', () => {
        const row = named({ a: box(0, 0), b: box(120, 0), c: box(240, 0) });
        expect(pickSpatialNeighbour(box(0, 0), row, 'right')).toBe('b');
        expect(pickSpatialNeighbour(box(120, 0), row, 'right')).toBe('c');
        expect(pickSpatialNeighbour(box(120, 0), row, 'left')).toBe('a');
    });

    it('stops at the end of a row rather than wrapping around to the far side', () => {
        const row = named({ a: box(0, 0), b: box(120, 0) });
        expect(pickSpatialNeighbour(box(120, 0), row, 'right')).toBeNull();
        expect(pickSpatialNeighbour(box(0, 0), row, 'left')).toBeNull();
    });

    it('prefers the control in the same column when moving between rows', () => {
        const grid = named({
            topLeft: box(0, 0),
            topRight: box(200, 0),
            bottomLeft: box(0, 100),
            bottomRight: box(200, 100)
        });
        expect(pickSpatialNeighbour(box(200, 0), grid, 'down')).toBe('bottomRight');
        expect(pickSpatialNeighbour(box(0, 100), grid, 'up')).toBe('topLeft');
    });

    it('takes a near, well-aligned control over a nearer one that is off to the side', () => {
        const candidates = named({ aligned: box(0, 100), askew: box(600, 70) });
        expect(pickSpatialNeighbour(box(0, 0), candidates, 'down')).toBe('aligned');
    });

    it('reaches a staggered card when nothing lines up exactly', () => {
        const candidates = named({ staggered: box(30, 100), farther: box(500, 100) });
        expect(pickSpatialNeighbour(box(0, 0), candidates, 'down')).toBe('staggered');
    });

    it('ignores a control that only nudges over by a pixel, which is the same row', () => {
        const candidates = named({ sameRow: box(2, 0), nextRow: box(0, 60) });
        expect(pickSpatialNeighbour(box(0, 0), candidates, 'right')).toBeNull();
        expect(pickSpatialNeighbour(box(0, 0), candidates, 'down')).toBe('nextRow');
    });

    it('has nowhere to go on an empty screen', () => {
        expect(pickSpatialNeighbour(box(0, 0), [], 'up')).toBeNull();
    });
});
