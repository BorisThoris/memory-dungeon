import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { createPowersFtueDismissPatch } from './savePreferenceSurfaceState';

describe('savePreferenceSurfaceState', () => {
    it('creates a powers FTUE dismissal patch without changing settings identity', () => {
        const save = createDefaultSaveData();
        const result = createPowersFtueDismissPatch(save);

        expect(result.saveData.powersFtueSeen).toBe(true);
        expect(result.saveData.firstRunHelpDismissed).toBe(false);
        expect(result.settings).toBe(result.saveData.settings);
    });
});
