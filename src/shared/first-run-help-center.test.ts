import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { getFirstRunHelpCenterRows } from './first-run-help-center';

describe('REG-098 first-run help center rows', () => {
    it('uses guided beats for fresh profiles and replay copy for completed profiles', () => {
        const fresh = createDefaultSaveData();
        const freshRows = getFirstRunHelpCenterRows(fresh);
        expect(freshRows.map((row) => row.id)).toEqual([
            'flip_match',
            'score_recover',
            'route_choice',
            'relic_rewards',
            'deeper_help'
        ]);
        expect(freshRows.every((row) => row.localOnly)).toBe(true);
        expect(freshRows.find((row) => row.id === 'flip_match')?.status).toBe('active');
        expect(freshRows.find((row) => row.id === 'route_choice')?.body).toMatch(/Safe protects/i);

        const completed = { ...fresh, onboardingDismissed: true, powersFtueSeen: true };
        const completedRows = getFirstRunHelpCenterRows(completed);
        expect(completedRows.find((row) => row.id === 'flip_match')?.status).toBe('complete');
        expect(completedRows.find((row) => row.id === 'deeper_help')?.action).toMatch(/Codex/i);
    });

    it('does not treat powersFtueSeen alone as help center completion', () => {
        const rows = getFirstRunHelpCenterRows({
            ...createDefaultSaveData(),
            onboardingDismissed: false,
            powersFtueSeen: true
        });

        expect(rows.find((row) => row.id === 'flip_match')?.status).toBe('active');
        expect(rows.find((row) => row.id === 'score_recover')?.status).toBe('active');
    });
});
