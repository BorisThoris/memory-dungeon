import { describe, expect, it } from 'vitest';
import { holdBeat, holdReleasePulseTier } from './holdBeat';

const board = { level: 14 } as never;
const at = (extra: Record<string, unknown>) => ({ board, ...extra });

describe('the Hold says what it did (DGE-008)', () => {
    it('says the Hold starting, a miss halving it, and the release, once each', () => {
        expect(holdBeat(at({ holding: false }), at({ holding: true }))!.line).toMatch(/^Holding/);
        expect(holdBeat(at({ holding: true, heldSeedIds: ['a', 'b', 'c', 'd'] }), at({ holding: true, heldSeedIds: ['c', 'd'] }))!.line).toBe('The miss dropped 1 of the stack; 1 held pair left.');
        const release = holdBeat(at({ holding: true, heldSeedIds: ['a', 'b', 'c', 'd'], holdsReleasedThisFloor: 0 }), at({ holding: false, heldSeedIds: [], holdsReleasedThisFloor: 1 }))!;
        expect(release.line).toBe('Released 2 held pairs: every one breaks at once.');
        expect(release.key).toBe('hold:14:release:1');
    });

    it('says nothing when the Hold did nothing, or across a floor', () => {
        expect(holdBeat(at({ holding: true, heldSeedIds: ['a', 'b'] }), at({ holding: true, heldSeedIds: ['a', 'b', 'c', 'd'] }))).toBeNull();
        expect(holdBeat(at({ holding: false }), { board: { level: 15 } as never, holding: true })).toBeNull();
        expect(holdBeat(null, at({ holding: true }))).toBeNull();
    });
});

describe("the room flashes at the release's size (DGE-008)", () => {
    it('Fever from eight pairs, Sharp from four, Clean below', () => {
        expect([1, 3, 4, 7, 8, 40].map(holdReleasePulseTier)).toEqual(['clean', 'clean', 'sharp', 'sharp', 'fever', 'fever']);
    });
});
