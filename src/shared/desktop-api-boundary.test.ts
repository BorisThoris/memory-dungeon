import { describe, expect, it } from 'vitest';
import {
    normalizeUnknownAchievementId,
    normalizeUnknownAchievementUnlockResult,
    normalizeUnknownDisplayMode,
    normalizeUnknownSteamConnected
} from './desktop-api-boundary';

describe('desktop API boundary normalizers', () => {
    it('normalizes Steam bridge result payloads', () => {
        expect(normalizeUnknownSteamConnected(true)).toBe(true);
        expect(normalizeUnknownSteamConnected('true')).toBe(false);
        expect(normalizeUnknownAchievementUnlockResult({ ok: true })).toEqual({ ok: true });
        expect(normalizeUnknownAchievementUnlockResult({ ok: false, reason: 'not_connected' })).toEqual({
            ok: false,
            reason: 'not_connected'
        });
        expect(normalizeUnknownAchievementUnlockResult({ ok: false, reason: 'bad' })).toEqual({
            ok: false,
            reason: 'steam_rejected',
            detail: 'Malformed Steam bridge response.'
        });
    });

    it('normalizes IPC input payloads before main-process side effects', () => {
        expect(normalizeUnknownAchievementId('ACH_FIRST_CLEAR')).toBe('ACH_FIRST_CLEAR');
        expect(normalizeUnknownAchievementId('BAD_ACHIEVEMENT')).toBeNull();
        expect(normalizeUnknownDisplayMode('fullscreen')).toBe('fullscreen');
        expect(normalizeUnknownDisplayMode('kiosk')).toBeNull();
    });
});
