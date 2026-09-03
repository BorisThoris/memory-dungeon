import { describe, expect, it } from 'vitest';
import {
    COLOR_VISION_KINDS,
    colorDistance,
    findConfusablePairs,
    hexToRgb,
    rgbToHex,
    rgbToLab,
    simulateColorVision
} from './color-vision';

describe('hex and rgb', () => {
    it('round-trips a colour', () => {
        expect(rgbToHex(hexToRgb('#62d6d1'))).toBe('#62d6d1');
    });

    it('accepts shorthand', () => {
        expect(hexToRgb('#fff')).toEqual(hexToRgb('#ffffff'));
    });

    it('refuses anything that is not a colour', () => {
        for (const bad of ['', '#', 'red', '#12345', '#gggggg']) {
            expect(() => hexToRgb(bad)).toThrow();
        }
    });

    it('clamps out-of-range channels rather than emitting broken hex', () => {
        expect(rgbToHex({ b: 0.5, g: -1, r: 2 })).toBe('#ff0080');
    });
});

describe('simulateColorVision', () => {
    it('leaves normal vision alone', () => {
        const rgb = hexToRgb('#f08f48');
        expect(simulateColorVision(rgb, 'normal')).toBe(rgb);
    });

    it('keeps greys grey under every dichromacy, which is the identity a simulation must not break', () => {
        for (const vision of COLOR_VISION_KINDS) {
            const grey = simulateColorVision(hexToRgb('#808080'), vision);
            expect(colorDistance(grey, hexToRgb('#808080'))).toBeLessThan(3);
        }
    });

    it('collapses red and green toward each other for a deuteranope', () => {
        const red = hexToRgb('#d02020');
        const green = hexToRgb('#20d020');
        const before = colorDistance(red, green);
        const after = colorDistance(simulateColorVision(red, 'deuteranopia'), simulateColorVision(green, 'deuteranopia'));
        expect(after).toBeLessThan(before / 2);
    });

    it('leaves blue and yellow apart for a deuteranope, who still has that axis', () => {
        const blue = hexToRgb('#3050e0');
        const yellow = hexToRgb('#e0d030');
        expect(
            colorDistance(simulateColorVision(blue, 'deuteranopia'), simulateColorVision(yellow, 'deuteranopia'))
        ).toBeGreaterThan(40);
    });

    it('collapses blue and yellow for a tritanope, who does not', () => {
        const blue = hexToRgb('#3050e0');
        const yellow = hexToRgb('#e0d030');
        const before = colorDistance(blue, yellow);
        const after = colorDistance(
            simulateColorVision(blue, 'tritanopia'),
            simulateColorVision(yellow, 'tritanopia')
        );
        expect(after).toBeLessThan(before);
    });
});

describe('rgbToLab', () => {
    it('puts black and white at the ends of the lightness axis', () => {
        expect(rgbToLab(hexToRgb('#000000')).l).toBeCloseTo(0, 1);
        expect(rgbToLab(hexToRgb('#ffffff')).l).toBeCloseTo(100, 0);
    });
});

describe('findConfusablePairs', () => {
    const palette = { amber: '#f5cc48', ink: '#101018', tan: '#d7b46a' };

    it('finds the pair a dichromat cannot separate and leaves the obvious one alone', () => {
        const found = findConfusablePairs(palette, 25);
        expect(found.length).toBeGreaterThan(0);
        expect(found.every((pair) => [pair.left, pair.right].includes('ink'))).toBe(false);
        expect(found.some((pair) => pair.left === 'amber' && pair.right === 'tan')).toBe(true);
    });

    it('reports the worst pair first', () => {
        const found = findConfusablePairs(palette, 60);
        const distances = found.map((pair) => pair.distance);
        expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    });

    it('says nothing about a palette of one', () => {
        expect(findConfusablePairs({ only: '#ffffff' }, 100)).toEqual([]);
    });
});
