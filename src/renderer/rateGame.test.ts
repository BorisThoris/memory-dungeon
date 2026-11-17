import { afterEach, describe, expect, it } from 'vitest';
import {
    PLAY_STORE_URL,
    RATE_AFTER_FINISHED_RUNS,
    markRateAsked,
    rateAlreadyAsked,
    ratePromptFor,
    rateStoreFor,
    rememberAndroidAppSession,
    type RateEnvironment
} from './rateGame';

const browserTab: RateEnvironment = { referrer: '', androidAppSession: false, desktop: false, steamUrl: null };
const playApp: RateEnvironment = { ...browserTab, referrer: 'android-app://com.boristhoris.memorydungeon/' };
const steamUrl = 'https://store.steampowered.com/app/123/Memory_Dungeon/';

describe('where a rating can go', () => {
    it('is Google Play in the Play app, and stays so after a reload lost the referrer', () => {
        expect(rateStoreFor(playApp)).toEqual({ store: 'play', url: PLAY_STORE_URL });
        expect(rateStoreFor({ ...browserTab, androidAppSession: true })?.store).toBe('play');
    });

    it('is Steam only on the desktop build packaged with a store page', () => {
        expect(rateStoreFor({ ...browserTab, desktop: true, steamUrl })).toEqual({ store: 'steam', url: steamUrl });
        expect(rateStoreFor({ ...browserTab, desktop: true })).toBeNull();
    });

    it('is nowhere in a browser tab', () => {
        expect(rateStoreFor(browserTab)).toBeNull();
        expect(rateStoreFor({ ...browserTab, steamUrl })).toBeNull();
    });
});

describe('when to ask', () => {
    afterEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    it('asks after a beaten Warden or the fifth finished run, and only for a run that was counted', () => {
        expect(ratePromptFor({ wardenCleared: true, runsFinished: 1, counted: true }, playApp, false)).not.toBeNull();
        expect(ratePromptFor({ wardenCleared: false, runsFinished: RATE_AFTER_FINISHED_RUNS, counted: true }, playApp, false)).not.toBeNull();
        expect(ratePromptFor({ wardenCleared: false, runsFinished: RATE_AFTER_FINISHED_RUNS - 1, counted: true }, playApp, false)).toBeNull();
        expect(ratePromptFor({ wardenCleared: true, runsFinished: 9, counted: false }, playApp, false)).toBeNull();
    });

    it('asks at most once on a device', () => {
        expect(rateAlreadyAsked()).toBe(false);
        markRateAsked();
        expect(rateAlreadyAsked()).toBe(true);
        expect(ratePromptFor({ wardenCleared: true, runsFinished: 9, counted: true }, playApp)).toBeNull();
    });

    it('remembers for the session that it began in the Play app', () => {
        rememberAndroidAppSession('https://example.com/');
        expect(window.sessionStorage.getItem('memory-dungeon.android-app')).toBeNull();
        rememberAndroidAppSession('android-app://com.boristhoris.memorydungeon/');
        expect(window.sessionStorage.getItem('memory-dungeon.android-app')).toBe('1');
    });
});
