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
        steamworksMocks.activate.mockClear();
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
});

