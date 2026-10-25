import { CLASSIC_DESCENT_RULES, descentFloorFor } from './descent-length-rules';
import { describe, expect, it } from 'vitest';
import { createNewRun } from './game';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { canStartHold, isHoldUnlocked } from './hold-rules';
import { isCarveUnlocked } from './carve-rules';
import { isRepriseUnlocked } from './reprise-rules';
import { VERB_STAIRCASE_FROM, verbArrivingOn, verbFirstFloor } from './verb-staircase-rules';

// The sixty-floor numbering (`descent-length-rules.ts`) unless a test asks for the forty: the board deals as the floor it names.
const at = (level: number, runRulesVersion = CLASSIC_DESCENT_RULES, extra: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0);
    const descentFloor = descentFloorFor(level, runRulesVersion);
    return { ...base, status: 'playing', runRulesVersion, board: { ...base.board!, level, ...(descentFloor !== level ? { descentFloor } : {}), flippedTileIds: [] }, ...extra };
};

describe('verb staircase (rules 89)', () => {
    it('brings Hold, Carve and Reprise into the Gate, one at a time', () => {
        const unlocked = (level: number): string[] =>
            [isHoldUnlocked(at(level)) && 'hold', isCarveUnlocked(at(level)) && 'carve', isRepriseUnlocked(at(level)) && 'reprise'].filter(Boolean) as string[];
        expect(unlocked(4)).toEqual([]);
        expect(unlocked(5)).toEqual(['hold']);
        expect(unlocked(7)).toEqual(['hold', 'carve']);
        expect(unlocked(11)).toEqual(['hold', 'carve', 'reprise']);
    });

    it('keeps the pack floors for runs made before rules 89', () => {
        const old = VERB_STAIRCASE_FROM - 1;
        expect(verbFirstFloor('hold', { runRulesVersion: old })).toBe(13);
        expect(isHoldUnlocked(at(12, old))).toBe(false);
        expect(isCarveUnlocked(at(24, old))).toBe(false);
        expect(isRepriseUnlocked(at(40, old))).toBe(false);
        expect(isRepriseUnlocked(at(41, old))).toBe(true);
        expect(verbArrivingOn(at(5, old))).toBeNull();
    });

    it('names the arriving verb on its floor only, and never in Endless', () => {
        expect([4, 5, 6, 7, 11, 12].map((level) => verbArrivingOn(at(level)))).toEqual([null, 'hold', null, 'carve', 'reprise', null]);
        expect(verbArrivingOn(at(5, GAME_RULES_VERSION, { endless: true }))).toBeNull();
        // On the forty-floor Descent Reprise's floor 11 is thinned out of the Gate: it arrives on floor 9, the Living Dungeon's first.
        expect([4, 5, 6, 7, 8, 9, 10].map((level) => verbArrivingOn(at(level, GAME_RULES_VERSION)))).toEqual([null, 'hold', null, 'carve', null, 'reprise', null]);
    });

    it('lets an armed meter press Hold on floor 5', () => {
        expect(canStartHold(at(5, GAME_RULES_VERSION, { holdLinks: 6 }))).toBe(true);
        expect(canStartHold(at(4, GAME_RULES_VERSION, { holdLinks: 6 }))).toBe(false);
    });
});
