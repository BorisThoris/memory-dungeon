import { describe, expect, it } from 'vitest';
import { clampFloaterX, resolveBoardFloaterAnchor } from './boardFloaterPlacement';

const stage = { width: 1000, height: 800 };
const pair = [
    { left: 100, top: 300, width: 80, height: 120 },
    { left: 400, top: 300, width: 80, height: 120 }
];

describe('resolveBoardFloaterAnchor', () => {
    it('rises through the pair midpoint for a pointer on a desktop', () => {
        expect(
            resolveBoardFloaterAnchor({
                hudClearance: 0,
                profile: { layout: 'desktop', input: 'pointer' },
                stage,
                tiles: pair,
                viewportWidth: 1440
            })
        ).toEqual({ x: 290, y: 360, placement: 'centroid' });
    });

    it('averages three tiles for a gambit', () => {
        const anchor = resolveBoardFloaterAnchor({
            hudClearance: 0,
            profile: { layout: 'tablet', input: 'pointer' },
            stage,
            tiles: [...pair, { left: 700, top: 300, width: 80, height: 120 }],
            viewportWidth: 1024
        });
        expect(anchor).toEqual({ x: 440, y: 360, placement: 'centroid' });
    });

    it('rises from above the pair when a finger is on it', () => {
        const anchor = resolveBoardFloaterAnchor({
            hudClearance: 0,
            profile: { layout: 'tablet', input: 'touch' },
            stage,
            tiles: pair,
            viewportWidth: 1024
        });
        expect(anchor).toEqual({ x: 290, y: 300, placement: 'above-pair' });
    });

    it('treats a phone held upright as touch even without a coarse pointer', () => {
        const anchor = resolveBoardFloaterAnchor({
            hudClearance: 0,
            profile: { layout: 'phone-portrait', input: 'pointer' },
            stage: { width: 390, height: 600 },
            tiles: [
                { left: 20, top: 260, width: 70, height: 100 },
                { left: 110, top: 260, width: 70, height: 100 }
            ],
            viewportWidth: 390
        });
        expect(anchor.placement).toBe('above-pair');
        expect(anchor.y).toBe(260);
    });

    it('does not let a top-row pair lift the floater out of the stage', () => {
        const anchor = resolveBoardFloaterAnchor({
            hudClearance: 40,
            profile: { layout: 'phone-portrait', input: 'touch' },
            stage: { width: 390, height: 600 },
            tiles: [
                { left: 20, top: 10, width: 70, height: 100 },
                { left: 110, top: 10, width: 70, height: 100 }
            ],
            viewportWidth: 390
        });
        expect(anchor.placement).toBe('above-pair');
        expect(anchor.y).toBeGreaterThan(40);
    });

    it('docks under the HUD, centered, on a phone held sideways', () => {
        const anchor = resolveBoardFloaterAnchor({
            hudClearance: 52,
            profile: { layout: 'phone-landscape', input: 'touch' },
            stage: { width: 844, height: 390 },
            tiles: pair,
            viewportWidth: 844
        });
        expect(anchor).toEqual({ x: 422, y: 58, placement: 'stage-top' });
    });

    it('falls back to the stage center when the tiles cannot be measured', () => {
        expect(
            resolveBoardFloaterAnchor({
                hudClearance: 0,
                profile: { layout: 'desktop', input: 'pointer' },
                stage,
                tiles: [],
                viewportWidth: 1440
            })
        ).toEqual({ x: 500, y: 400, placement: 'centroid' });
    });
});

describe('clampFloaterX', () => {
    it('keeps a floater at the edge of the stage fully inside it', () => {
        // 18rem = 288px wide at most; half is 144, plus the 8px margin.
        expect(clampFloaterX(20, 1000, 1440)).toBe(152);
        expect(clampFloaterX(990, 1000, 1440)).toBe(848);
        expect(clampFloaterX(500, 1000, 1440)).toBe(500);
    });

    it('uses the narrower viewport-relative width on a phone', () => {
        // 72vi of 390 = 280.8px; half is 140.4.
        expect(clampFloaterX(0, 390, 390)).toBeCloseTo(148.4);
    });

    it('centers when the stage is too narrow to clamp', () => {
        expect(clampFloaterX(10, 200, 1440)).toBe(100);
    });
});
