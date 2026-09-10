import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import {
    buildClassicRunOptions,
    classicRunSetupFromRun,
    buildVowContract,
    CHAOS_MUTATORS,
    DEFAULT_CLASSIC_RUN_SETUP,
    describeClassicRunSetup,
    isDefaultClassicRunSetup,
    type ClassicRunSetup
} from './classic-run-setup';

const setup = (overrides: Partial<ClassicRunSetup> = {}): ClassicRunSetup => ({
    ...DEFAULT_CLASSIC_RUN_SETUP,
    ...overrides
});

describe('the default setup', () => {
    it('asks nothing of the run, so Start plays the plain descent', () => {
        expect(isDefaultClassicRunSetup(DEFAULT_CLASSIC_RUN_SETUP)).toBe(true);
        expect(buildClassicRunOptions(DEFAULT_CLASSIC_RUN_SETUP)).toEqual({});
        expect(describeClassicRunSetup(DEFAULT_CLASSIC_RUN_SETUP)).toEqual([]);
    });
});

describe('the retired cards, as options', () => {

    it('carries the Scholar contract, which is now the shuffle vow alone', () => {
        const options = buildClassicRunOptions(setup({ vows: ['scholar'] }));
        expect(options.activeContract).toMatchObject({ noShuffle: true });
        // Otherwise "no shuffle" would only mean "no button": the weaker shuffle stays available.
        expect(options.weakerShuffleMode).toBe('rows_only');
    });

    it('carries the Pin vow cap', () => {
        expect(buildClassicRunOptions(setup({ vows: ['pin_vow'] })).activeContract).toMatchObject({
            maxPinsTotalRun: 10
        });
    });

    it('carries Practice as a run that is not recorded', () => {
        expect(buildClassicRunOptions(setup({ unrecorded: true })).practiceMode).toBe(true);
    });

    it('carries the Meditation pacing and its focus mutators', () => {
        const options = buildClassicRunOptions(setup({ focusMutators: ['sticky_fingers'], pacing: 'calm' }));
        expect(options.resolveDelayMultiplier).toBeGreaterThan(1);
        expect(options.activeMutators).toEqual(['sticky_fingers']);
    });
});

describe('vows combine', () => {
    it('holds both vows at once, which a menu of separate cards could never offer', () => {
        expect(buildVowContract(['scholar', 'pin_vow'])).toMatchObject({
            maxPinsTotalRun: 10,
            noShuffle: true
        });
    });

    it('has no contract when nothing was vowed', () => {
        expect(buildVowContract([])).toBeNull();
    });
});

describe('combinations the old menu could not express', () => {
    it('lets a chaos run under a vow exist', () => {
        const options = buildClassicRunOptions(setup({ chaos: true, vows: ['scholar'] }));
        expect(options.enableWildJoker).toBe(true);
        expect(options.activeContract).toMatchObject({ noShuffle: true });
    });

    it('does not repeat a mutator that chaos and focus both name', () => {
        const options = buildClassicRunOptions(setup({ chaos: true, focusMutators: ['sticky_fingers'] }));
        expect(options.activeMutators).toEqual([...CHAOS_MUTATORS]);
    });
});

describe('describeClassicRunSetup', () => {
    it('names what the player asked for, so the run can say it back to them', () => {
        expect(
            describeClassicRunSetup(
                setup({ chaos: true, pacing: 'calm', unrecorded: true, vows: ['scholar', 'pin_vow'] })
            )
        ).toEqual(['Scholar vow', 'Pin vow', 'Wild', 'Calm', 'Unrecorded']);
    });
});

describe('classicRunSetupFromRun', () => {
    it('reads a whole setup back off the run it started, so a retry keeps all of it', () => {
        const chosen = setup({ chaos: true, pacing: 'calm', unrecorded: true, vows: ['scholar', 'pin_vow'] });
        const run = createNewRun(0, buildClassicRunOptions(chosen));
        expect(classicRunSetupFromRun(run)).toEqual({ ...chosen, focusMutators: [] });
    });

    it('reads the plain descent as the default', () => {
        expect(classicRunSetupFromRun(createNewRun(0))).toEqual(DEFAULT_CLASSIC_RUN_SETUP);
    });
});
