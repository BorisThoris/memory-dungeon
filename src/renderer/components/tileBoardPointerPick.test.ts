import { describe, expect, it } from 'vitest';

import {
    clientPointToNormalizedDeviceCoordinates,
    firstTileIdFromPickIntersections,
    isUsableClientRect
} from './tileBoardPointerPick';

describe('tileBoardPointerPick', () => {
    it('accepts only positive-size client rects', () => {
        expect(isUsableClientRect({ left: 0, top: 0, width: 10, height: 20 })).toBe(true);
        expect(isUsableClientRect({ left: 0, top: 0, width: 0, height: 20 })).toBe(false);
        expect(isUsableClientRect({ left: 0, top: 0, width: 10, height: 0 })).toBe(false);
    });

    it('maps client points into normalized device coordinates', () => {
        const rect = { left: 10, top: 20, width: 200, height: 100 };

        expect(clientPointToNormalizedDeviceCoordinates(10, 20, rect)).toEqual({ x: -1, y: 1 });
        const center = clientPointToNormalizedDeviceCoordinates(110, 70, rect);
        expect(center?.x).toBeCloseTo(0);
        expect(center?.y).toBeCloseTo(0);
        expect(clientPointToNormalizedDeviceCoordinates(210, 120, rect)).toEqual({ x: 1, y: -1 });
    });

    it('skips normalized device coordinate math for unusable rects', () => {
        expect(
            clientPointToNormalizedDeviceCoordinates(10, 20, {
                left: 0,
                top: 0,
                width: 0,
                height: 100
            })
        ).toBeNull();
    });

    it('selects the first intersection carrying a string tile id', () => {
        expect(
            firstTileIdFromPickIntersections([
                { object: { userData: {} } },
                { object: { userData: { tileId: 123 } } },
                { object: { userData: { tileId: 'tile-a' } } },
                { object: { userData: { tileId: 'tile-b' } } }
            ])
        ).toBe('tile-a');
    });

    it('returns null when no intersection carries a string tile id', () => {
        expect(
            firstTileIdFromPickIntersections([
                { object: { userData: {} } },
                { object: { userData: { tileId: 123 } } }
            ])
        ).toBeNull();
    });
});
