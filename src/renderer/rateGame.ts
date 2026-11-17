import { getSteamStorePageUrl } from './steamStorePage';

/**
 * Asking for a rating (docs/MARKET_FLOW_REVIEW_WIDER.md, P2): one quiet link on the results
 * screen, once, after a run worth rating - the Warden beaten, or the fifth finished run.
 *
 * Only where there is a store page to send the player to: the Play app (opened from Google Play,
 * so its referrer is `android-app://`), and the desktop build when it was packaged with
 * `VITE_STEAM_STORE_URL`. In a browser tab there is no store, so nothing is asked. The native
 * In-App Review API is Play Core code and would need a bridge in the TWA shell; a store link
 * needs none.
 *
 * Kept in localStorage rather than the save: it is about this device's store, like the
 * language, and asking once more on a second device is not a nuisance.
 */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.boristhoris.memorydungeon';
export const RATE_AFTER_FINISHED_RUNS = 5;

const RATE_ASKED_KEY = 'memory-dungeon.rate-asked';
/*
 * The Play app's referrer is only there on the first load: a language change reloads the page
 * and loses it. The session remembers that it started in the app.
 */
const ANDROID_APP_SESSION_KEY = 'memory-dungeon.android-app';

export type RateStore = 'play' | 'steam';

export interface RateEnvironment {
    referrer: string;
    androidAppSession: boolean;
    desktop: boolean;
    steamUrl: string | null;
}

const readEnvironment = (): RateEnvironment => {
    let androidAppSession = false;
    try {
        androidAppSession = window.sessionStorage.getItem(ANDROID_APP_SESSION_KEY) === '1';
    } catch {
        androidAppSession = false;
    }
    return {
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        androidAppSession,
        // The bridge check `desktop-client.ts` makes, inlined: main.tsx imports this before any copy module.
        desktop: typeof window !== 'undefined' && window.desktop != null,
        steamUrl: getSteamStorePageUrl()
    };
};

/** Where this build could send a rating, or null where there is no store page to send it to. */
export const rateStoreFor = (env: RateEnvironment): { store: RateStore; url: string } | null => {
    if (env.referrer.startsWith('android-app://') || env.androidAppSession) {
        return { store: 'play', url: PLAY_STORE_URL };
    }
    if (env.desktop && env.steamUrl) {
        return { store: 'steam', url: env.steamUrl };
    }
    return null;
};

/** Remember for this session that it began in the Play app; called once at boot. */
export const rememberAndroidAppSession = (referrer: string = typeof document !== 'undefined' ? document.referrer : ''): void => {
    if (!referrer.startsWith('android-app://')) return;
    try {
        window.sessionStorage.setItem(ANDROID_APP_SESSION_KEY, '1');
    } catch {
        // Without storage the referrer still answers for this load.
    }
};

export const rateAlreadyAsked = (): boolean => {
    try {
        return window.localStorage.getItem(RATE_ASKED_KEY) === '1';
    } catch {
        // A blocked storage could never remember asking, so it never asks.
        return true;
    }
};

export const markRateAsked = (): void => {
    try {
        window.localStorage.setItem(RATE_ASKED_KEY, '1');
    } catch {
        // Nothing to do: rateAlreadyAsked reads a blocked storage as asked.
    }
};

/** A run worth asking after: the Warden beaten, or enough finished runs that the game has been played. */
export const runEarnsRatePrompt = (input: { wardenCleared: boolean; runsFinished: number; counted: boolean }): boolean =>
    input.counted && (input.wardenCleared || input.runsFinished >= RATE_AFTER_FINISHED_RUNS);

/** The rate link to show on this results screen, if any. Pure apart from the environment read. */
export const ratePromptFor = (
    input: { wardenCleared: boolean; runsFinished: number; counted: boolean },
    env: RateEnvironment = readEnvironment(),
    asked: boolean = rateAlreadyAsked()
): { store: RateStore; url: string } | null => {
    if (asked || !runEarnsRatePrompt(input)) return null;
    return rateStoreFor(env);
};
