import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import { RUN_MODE_CATALOG } from './run-mode-catalog';
import { describeRunModeIdentity, runModeIdentityText } from './run-mode-identity';
import {
    createDailyRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun
} from './run-creation-rules';
import { createDungeonShowcaseRun } from './dungeon-showcase-run-rules';

const scholarContract = { bonusRelicDraftPick: true, maxMismatches: null, noDestroy: true, noShuffle: true };
const pinVowContract = { maxMismatches: null, maxPinsTotalRun: 10, noDestroy: false, noShuffle: false };

describe('describeRunModeIdentity', () => {
    it('names a plain endless run after the mode a player picked', () => {
        expect(describeRunModeIdentity(createNewRun(0))).toEqual({ detail: null, label: 'Classic Dungeon' });
    });

    it('shows the UTC key on a daily run, which is the whole point of the seed', () => {
        const identity = describeRunModeIdentity(createDailyRun(0));
        expect(identity.label).toBe('Daily challenge');
        expect(identity.detail).toMatch(/^\d{4}-\d{2}-\d{2} UTC$/u);
    });

    it('leaves a daily key it does not recognise alone rather than mangling it', () => {
        const run = { ...createDailyRun(0), dailyDateKeyUtc: 'seeded-by-hand' };
        expect(describeRunModeIdentity(run).detail).toBe('seeded-by-hand');
    });

    it('names the showcase run even though it is an endless run underneath', () => {
        expect(describeRunModeIdentity(createDungeonShowcaseRun(0)).label).toBe('Dungeon Showcase');
    });

    it('leaves the gauntlet clock to the clock stat instead of repeating it', () => {
        expect(describeRunModeIdentity(createGauntletRun(0, 600_000))).toEqual({ detail: null, label: 'Gauntlet' });
    });

    it('names the puzzle being solved, not just "puzzle"', () => {
        const puzzle = BUILTIN_PUZZLES.mirror_craft;
        const identity = describeRunModeIdentity(createPuzzleRun(0, puzzle.id, puzzle.tiles, 1));
        expect(identity.label).toBe(`Puzzle: ${puzzle.title}`);
        expect(identity.detail).toBe(puzzle.goalText);
    });

    it('falls back to the bare puzzle label when the id is not a builtin', () => {
        const puzzle = BUILTIN_PUZZLES.starter_pairs;
        const run = { ...createPuzzleRun(0, puzzle.id, puzzle.tiles, 1), puzzleId: 'imported_elsewhere' };
        expect(describeRunModeIdentity(run)).toEqual({ detail: null, label: 'Puzzle' });
    });

    it('names a meditation run', () => {
        expect(describeRunModeIdentity(createMeditationRun(0)).label).toBe('Meditation Run');
    });

    it('shows the wild matches left, which is the rule that makes a wild run wild', () => {
        const run = createWildRun(0);
        expect(describeRunModeIdentity(run)).toEqual({
            detail: `Wild matches ${run.wildMatchesRemaining}`,
            label: 'Wild Run'
        });
    });

    it('says achievements are off on a practice run, since nothing else on screen does', () => {
        expect(describeRunModeIdentity(createNewRun(0, { practiceMode: true }))).toEqual({
            detail: 'Achievements off',
            label: 'Practice'
        });
    });

    it('names the scholar contract and its two bans', () => {
        expect(describeRunModeIdentity(createNewRun(0, { activeContract: scholarContract }))).toEqual({
            detail: 'No shuffle, no destroy',
            label: 'Scholar Contract'
        });
    });

    it('shows the pin cap on a pin vow run', () => {
        expect(describeRunModeIdentity(createNewRun(0, { activeContract: pinVowContract }))).toEqual({
            detail: 'Pins 10 this run',
            label: 'Pin vow'
        });
    });

    it('prefers the pin vow over the wild flag, the same precedence a retry uses', () => {
        const run = { ...createWildRun(0), activeContract: pinVowContract };
        expect(describeRunModeIdentity(run).label).toBe('Pin vow');
    });

    it('reads as one line for a tooltip, with and without a detail', () => {
        expect(runModeIdentityText({ detail: null, label: 'Gauntlet' })).toBe('Gauntlet');
        expect(runModeIdentityText({ detail: 'Achievements off', label: 'Practice' })).toBe(
            'Practice — Achievements off'
        );
    });
});

describe('the catalog start contracts this exists to honour', () => {
    /**
     * PPI-006 names the HUD element every mode promises to light up. If a mode declares that
     * contract, something in this file has to be able to produce that label — otherwise the promise
     * is a comment again.
     */
    const identityContractModes = RUN_MODE_CATALOG.filter(
        (mode) => mode.startContract?.testId === 'hud-mode-identity'
    );

    it('covers every mode that promises the HUD names it', () => {
        expect(identityContractModes.length).toBeGreaterThan(0);
        for (const mode of identityContractModes) {
            expect(mode.startContract?.signal, `${mode.id} start signal`).toMatch(/^HUD mode reads /u);
        }
    });
});
