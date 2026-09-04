import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { createDefaultSaveData } from './save-data';
import { perfectMemoryStatus } from './perfect-memory-status';

const save = () => createDefaultSaveData();

describe('perfectMemoryStatus', () => {
    it('is eligible on a fresh run, which is the state worth protecting', () => {
        expect(perfectMemoryStatus(createNewRun(0), save())).toBe('eligible');
    });

    it('locks the moment a power is spent, which is what the dock button costs', () => {
        const run = { ...createNewRun(0), powersUsedThisRun: true };
        expect(perfectMemoryStatus(run, save())).toBe('locked');
    });

    it('says nothing on a run with achievements off, since there is nothing to lose', () => {
        const run = { ...createNewRun(0), achievementsEnabled: false };
        expect(perfectMemoryStatus(run, save())).toBeNull();
    });

    it('says nothing once the player owns the achievement, since no decision hangs on it', () => {
        const saveData = save();
        saveData.achievements.ACH_PERFECT_CLEAR = true;
        expect(perfectMemoryStatus(createNewRun(0), saveData)).toBeNull();
        expect(perfectMemoryStatus({ ...createNewRun(0), powersUsedThisRun: true }, saveData)).toBeNull();
    });

    it('is unaffected by pins, which the achievement rule deliberately allows', () => {
        const run = { ...createNewRun(0), pinnedTileIds: ['a', 'b'] };
        expect(perfectMemoryStatus(run, save())).toBe('eligible');
    });
});
