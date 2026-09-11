import { describe, expect, it } from 'vitest';

import {
    ACCESSIBILITY_TARGETS,
    judgeAccessibilityTargets,
    MOTION_BLUR_PATTERN
} from '../../scripts/accessibility-targets';

/**
 * The three targets are externally specified and verified 3-0 (`docs/RESEARCH_NOTES.md` §3), which
 * is what makes them gateable. What this holds is the shape of the answers rather than the answers
 * themselves: a target that claims to be met on evidence nobody reads is the same defect as a
 * declaration typed into a store form from memory.
 */
describe('the accessibility targets', () => {
    it('answers every target from the game’s own files, with nothing stale', () => {
        expect(judgeAccessibilityTargets()).toEqual([]);
        expect(ACCESSIBILITY_TARGETS.length).toBeGreaterThanOrEqual(3);
        for (const target of ACCESSIBILITY_TARGETS) {
            expect(target.source.length, `${target.id} source`).toBeGreaterThan(12);
            expect(target.asks.length, `${target.id} asks`).toBeGreaterThan(20);
            expect(target.evidence().length, `${target.id} evidence`).toBeGreaterThan(1);
        }
    });

    it('lets an open target stay open, but never without something that closes it', () => {
        /*
         * The one target that is not met is the text scaling, and it is open because of a defect
         * with a task rather than because 200% was judged unnecessary. An open target with nothing
         * named to close it is a wish, and the judge says so.
         */
        const open = ACCESSIBILITY_TARGETS.filter((target) => target.status === 'open');
        expect(open.length).toBeGreaterThan(0);
        for (const target of open) {
            expect(target.blockedBy, `${target.id} blocker`).toMatch(/task #\d+/u);
        }
        for (const target of ACCESSIBILITY_TARGETS.filter((entry) => entry.status === 'met')) {
            expect(target.blockedBy, `${target.id} is met and should name no blocker`).toBeUndefined();
        }
    });

    it('would notice a motion blur arriving without a control', () => {
        // A bar nothing has ever failed is a bar nobody has checked: the pattern has to match one.
        expect(MOTION_BLUR_PATTERN.test('filter: motion-blur(4px)')).toBe(true);
        expect(MOTION_BLUR_PATTERN.test('motionBlurEnabled')).toBe(true);
        expect(MOTION_BLUR_PATTERN.test('backdrop-filter: blur(12px)')).toBe(false);
    });
});
