import { describe, expect, it } from 'vitest';
import { createNewRun } from '../../shared/game';
import { deepGameCues } from './gameSfx';

const run = createNewRun(0, { gameMode: 'endless', runSeed: 7 });

describe('the deep game cues (DGE-030)', () => {
    it('one cue per counter that grew, in a fixed order', () => {
        const after = { ...run, holdsReleasedThisFloor: 1, wardenRedealsThisFloor: 1, sleepersWokenThisFloor: 2, wandererStepsThisFloor: 3 };
        expect(deepGameCues(run, after)).toEqual(['hold_release', 'warden_redeal', 'sleeper_wake', 'wanderer_step']);
        expect(deepGameCues(run, run)).toEqual([]);
        expect(deepGameCues(null, run)).toEqual([]);
    });

    it('a new floor plays only the Dread, and only when its tier moved', () => {
        const next = { ...run, board: { ...run.board!, level: 2 } };
        expect(deepGameCues(run, { ...next, keeperSwapsThisFloor: 0 })).toEqual([]);
        expect(deepGameCues(run, { ...next, dreadRagingFloors: 40, dreadWildFloors: 40 })).toEqual(['dread_tier']);
    });
});
