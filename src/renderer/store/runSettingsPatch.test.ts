import { describe, expect, it } from 'vitest';
import type { Settings } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { patchRunFromUserSettings } from './runSettingsPatch';

describe('patchRunFromUserSettings', () => {
    it('copies player settings that affect run behavior without changing run identity', () => {
        const run = createNewRun(0, { runSeed: 123 });
        const settings: Settings = {
            ...createDefaultSaveData().settings,
            weakerShuffleMode: 'rows_only',
            shuffleScoreTaxEnabled: false,
            resolveDelayMultiplier: 0.5,
            echoFeedbackEnabled: false
        };

        const patched = patchRunFromUserSettings(run, settings);

        expect(patched).toMatchObject({
            runSeed: run.runSeed,
            weakerShuffleMode: 'rows_only',
            shuffleScoreTaxActive: false,
            resolveDelayMultiplier: 0.5,
            echoFeedbackEnabled: false
        });
    });
});
