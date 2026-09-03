import { describe, expect, it } from 'vitest';
import { buildRichPresence, richPresenceEquals, richPresencePairs } from './rich-presence';

describe('buildRichPresence', () => {
    it('says only that a player is in the menus when they are', () => {
        expect(buildRichPresence({ inRun: false })).toEqual({ display: '#Status_Menu' });
        // Between runs the mode is often still set; presence must not keep announcing the old run.
        expect(buildRichPresence({ floor: 12, gameMode: 'endless', inRun: false })).toEqual({ display: '#Status_Menu' });
    });

    it('names the mode a run is in', () => {
        expect(buildRichPresence({ floor: 3, gameMode: 'endless', inRun: true })).toEqual({
            display: '#Status_Endless',
            floor: '3',
            mode: 'Endless'
        });
        expect(buildRichPresence({ floor: 1, gameMode: 'daily', inRun: true }).display).toBe('#Status_Daily');
        expect(buildRichPresence({ floor: 1, gameMode: 'puzzle', inRun: true }).display).toBe('#Status_Puzzle');
    });

    it('falls back to a generic run token for modes without one of their own', () => {
        expect(buildRichPresence({ floor: 2, gameMode: 'gauntlet', inRun: true })).toEqual({
            display: '#Status_Run',
            floor: '2',
            mode: 'Gauntlet'
        });
        expect(buildRichPresence({ floor: 2, gameMode: 'meditation', inRun: true }).mode).toBe('Meditation');
    });

    it('omits a floor it cannot trust rather than broadcasting a wrong one', () => {
        for (const floor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
            expect(buildRichPresence({ floor, gameMode: 'endless', inRun: true }).floor).toBeUndefined();
        }
        expect(buildRichPresence({ floor: 7.8, gameMode: 'endless', inRun: true }).floor).toBe('7');
    });

    it('never carries anything that reports how well a run is going', () => {
        // Presence goes to a whole friends list. Where someone is, not how they are doing.
        const state = buildRichPresence({ floor: 9, gameMode: 'endless', inRun: true });
        expect(Object.keys(state).sort()).toEqual(['display', 'floor', 'mode']);
    });
});

describe('richPresencePairs', () => {
    it('clears the keys a state has no value for instead of leaving stale ones up', () => {
        expect(richPresencePairs(buildRichPresence({ inRun: false }))).toEqual([
            ['steam_display', '#Status_Menu'],
            ['mode', null],
            ['floor', null]
        ]);
    });

    it('sends the display token first, which is the one Steam actually renders', () => {
        const pairs = richPresencePairs(buildRichPresence({ floor: 4, gameMode: 'daily', inRun: true }));
        expect(pairs[0]).toEqual(['steam_display', '#Status_Daily']);
        expect(pairs).toContainEqual(['floor', '4']);
    });
});

describe('richPresenceEquals', () => {
    it('spots an unchanged state so presence is not rewritten every frame', () => {
        const a = buildRichPresence({ floor: 3, gameMode: 'endless', inRun: true });
        const b = buildRichPresence({ floor: 3, gameMode: 'endless', inRun: true });
        expect(richPresenceEquals(a, b)).toBe(true);
        expect(richPresenceEquals(a, buildRichPresence({ floor: 4, gameMode: 'endless', inRun: true }))).toBe(false);
        expect(richPresenceEquals(null, null)).toBe(true);
        expect(richPresenceEquals(a, null)).toBe(false);
    });
});
