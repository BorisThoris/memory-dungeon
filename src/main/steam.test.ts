import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const steamworksMocks = vi.hoisted(() => ({
    activate: vi.fn(() => true),
    electronEnableSteamOverlay: vi.fn(),
    init: vi.fn(() => ({ achievement: { activate: steamworksMocks.activate } }))
}));

vi.mock('steamworks.js', () => ({
    electronEnableSteamOverlay: steamworksMocks.electronEnableSteamOverlay,
    init: steamworksMocks.init
}));

import { createSteamAdapter } from './steam';

describe('createSteamAdapter configuration', () => {
    const originalAppId = process.env.STEAM_APP_ID;

    beforeEach(() => {
        steamworksMocks.activate.mockReset();
        steamworksMocks.activate.mockReturnValue(true);
        steamworksMocks.electronEnableSteamOverlay.mockClear();
        steamworksMocks.init.mockClear();
        delete process.env.STEAM_APP_ID;
    });

    afterEach(() => {
        if (originalAppId === undefined) {
            delete process.env.STEAM_APP_ID;
        } else {
            process.env.STEAM_APP_ID = originalAppId;
        }
    });

    it('uses Steam default discovery only when the app id is absent', () => {
        expect(createSteamAdapter().isConnected()).toBe(true);
        expect(steamworksMocks.init).toHaveBeenCalledWith();
    });

    it('passes a validated explicit app id to native initialization', () => {
        process.env.STEAM_APP_ID = ' 480 ';

        expect(createSteamAdapter().isConnected()).toBe(true);
        expect(steamworksMocks.init).toHaveBeenCalledWith(480);
    });

    it('stays disconnected without invoking native initialization for invalid explicit configuration', () => {
        process.env.STEAM_APP_ID = '480garbage';

        expect(createSteamAdapter().isConnected()).toBe(false);
        expect(steamworksMocks.init).not.toHaveBeenCalled();
    });

    it('returns a stable rejection code when Steam declines activation', () => {
        steamworksMocks.activate.mockReturnValue(false);
        const reportWarning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        expect(createSteamAdapter().unlockAchievement('ACH_FIRST_CLEAR')).toEqual({
            ok: false,
            reason: 'steam_rejected',
            detail: 'activate_returned_false'
        });
        reportWarning.mockRestore();
    });

    it('keeps native exception details in main-process logs only', () => {
        const nativeError = new Error('/private/user/path Steam token failure');
        steamworksMocks.activate.mockImplementation(() => {
            throw nativeError;
        });
        const reportWarning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = createSteamAdapter().unlockAchievement('ACH_FIRST_CLEAR');

        expect(result).toEqual({ ok: false, reason: 'steam_rejected', detail: 'activation_error' });
        expect(JSON.stringify(result)).not.toContain(nativeError.message);
        expect(reportWarning).toHaveBeenCalledWith(
            '[steam] achievement unlock failed',
            'ACH_FIRST_CLEAR',
            nativeError
        );
        reportWarning.mockRestore();
    });
});
