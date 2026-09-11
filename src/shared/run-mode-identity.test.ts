import { describe, expect, it } from 'vitest';
import { RUN_MODE_CATALOG } from './run-mode-catalog';
import { describeRunModeIdentity } from './run-mode-identity';
import {
    createNewRun,
    createWildRun
} from './run-creation-rules';

// Gen 215: this fixture carried `bonusRelicDraftPick`, a field ContractFlags has not had
// since the relic draft left in Gen 175.
const scholarContract = { maxMismatches: null, noShuffle: true };
const pinVowContract = { maxMismatches: null, maxPinsTotalRun: 10, noShuffle: false };

describe('describeRunModeIdentity', () => {
    it('names a plain endless run after the mode a player picked', () => {
        expect(describeRunModeIdentity(createNewRun(0))).toEqual({ detail: null, label: 'Classic Dungeon' });
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

    it('names the scholar contract and the two things it bans', () => {
        // Gen 215: this asserted "No shuffle, no destroy". Destroy left in Gen 200; the flag gates
        // the shuffle charges, and the row-shuffle charge is what the tile swap spends.
        expect(describeRunModeIdentity(createNewRun(0, { activeContract: scholarContract }))).toEqual({
            detail: 'No shuffle, no swap',
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

    /*
     * Gen 215: a case for `runModeIdentityText` stood here - a one-line formatter for "a tooltip"
     * that no tooltip, and nothing else in the game, ever called. The identity itself is read by
     * the pause menu, which the contract check below holds to.
     */
});

describe('the catalog start contracts this exists to honour', () => {
    /**
     * PPI-006 names the element every mode promises to light up. If a mode declares that contract,
     * something in this file has to be able to produce that label — otherwise the promise is a
     * comment again.
     */
    const identityContractModes = RUN_MODE_CATALOG.filter(
        (mode) => mode.startContract?.testId === 'pause-run-identity'
    );

    it('covers every mode that promises the pause menu names it', () => {
        expect(identityContractModes.length).toBeGreaterThan(0);
        for (const mode of identityContractModes) {
            expect(mode.startContract?.signal, `${mode.id} start signal`).toMatch(/^The pause menu names the run /u);
        }
    });
});
