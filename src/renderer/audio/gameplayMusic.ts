import { useEffect, useRef, useSyncExternalStore } from 'react';

import { REALM_IDS, type RealmId, type RunState, type ViewState } from '../../shared/contracts';
import { lifecycleStateFromSurface } from '../../shared/run-lifecycle-machine';

const musicUrls = import.meta.glob<string>('../assets/audio/music/*.{ogg,mp3}', {
    eager: true,
    query: '?url',
    import: 'default'
});

const portfolioMusicUrls = import.meta.glob<string>('../../../assets/audio/portfolio-feedback-pack/*.{ogg,mp3}', {
    eager: true,
    query: '?url',
    import: 'default'
});

/**
 * Each realm's own music (2026-10-09): `assets/audio/music/realm/<realm>-ambience.ogg`, ACE-Step
 * loops made on the owner's PC. On a floor in a realm it IS the run music - on this element, so the
 * settings' music volume and the Fever duck act on it - and the plain run
 * loop is only the fallback for a realm without one. The owner's call: "replace the actual
 * background music ... with this new one".
 */
const realmMusicUrls = import.meta.glob<string>('../assets/audio/music/realm/*-ambience.{ogg,mp3}', {
    eager: true,
    query: '?url',
    import: 'default'
});

export const realmMusicUrl = (realm: RealmId): string | undefined =>
    Object.entries(realmMusicUrls).find(([path]) => path.includes(`/${realm}-ambience.`))?.[1];

/** What the element plays: the menu loop, a realm's music, or the plain run loop. */
export type MusicTrackKey = 'menu' | 'run' | `realm:${RealmId}`;

export const musicTrackKey = (track: 'menu' | 'run', realm: RealmId | null | undefined): MusicTrackKey =>
    track === 'run' && realm && realmMusicUrl(realm) ? `realm:${realm}` : track;

const isRunFamily = (key: MusicTrackKey | null): boolean => key !== null && key !== 'menu';

const resolveMusicUrl = (filename: string): string | undefined => musicUrls[`../assets/audio/music/${filename}`];
const resolvePortfolioMusicUrl = (filename: string): string | undefined =>
    portfolioMusicUrls[`../../../assets/audio/portfolio-feedback-pack/${filename}`];
const resolveTrackUrl = (key: MusicTrackKey): string | undefined => {
    if (key.startsWith('realm:')) {
        return realmMusicUrl(key.slice('realm:'.length) as RealmId);
    }
    if (key === 'run') {
        // The shipped run loop is the in-run music; the portfolio ambience bed only covers builds without it.
        return resolveMusicUrl('run-loop.ogg') ?? resolvePortfolioMusicUrl('demo-ambience-loop.ogg');
    }
    return resolveMusicUrl('menu-loop.ogg');
};

/**
 * The music, held in memory once loaded (`preloadGameplayMusic`), so starting a track never streams
 * it from disk or network mid-play. Until it lands, the file URL is used as before.
 */
const preloadedTrackUrls = new Map<MusicTrackKey, string>();
let musicPreload: Promise<void> | null = null;

const playableTrackUrl = (key: MusicTrackKey): string | undefined =>
    preloadedTrackUrls.get(key) ?? resolveTrackUrl(key);

/** Every track a session can play: the menu, the run loop and each realm's music. */
const ALL_TRACK_KEYS: readonly MusicTrackKey[] = ['menu', 'run', ...REALM_IDS.map((realm): MusicTrackKey => `realm:${realm}`)];

export const preloadGameplayMusic = (): Promise<void> => {
    if (musicPreload) return musicPreload;
    if (typeof fetch === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return Promise.resolve();
    }
    musicPreload = Promise.all(
        ALL_TRACK_KEYS.map(async (track) => {
            const src = resolveTrackUrl(track);
            if (!src || preloadedTrackUrls.has(track)) return;
            try {
                const response = await fetch(src);
                if (!response.ok) return;
                preloadedTrackUrls.set(track, URL.createObjectURL(await response.blob()));
            } catch {
                // The file URL still plays; it just streams.
            }
        })
    ).then(() => undefined);
    return musicPreload;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));


const subscribeToPageVisibility = (onStoreChange: () => void): (() => void) => {
    if (typeof document === 'undefined') {
        return () => undefined;
    }
    document.addEventListener('visibilitychange', onStoreChange);
    return () => document.removeEventListener('visibilitychange', onStoreChange);
};

const getPageVisibilitySnapshot = (): boolean =>
    typeof document === 'undefined' || document.visibilityState === 'visible';

/** Effective linear gain from settings (0-1 each), matching SFX stacking. */
export const musicGainFromSettings = (masterVolume: number, musicVolume: number): number =>
    clamp01(masterVolume) * clamp01(musicVolume);

interface GameplayMusicParams {
    /** When false, playback is paused (e.g. settings, codex, game over). */
    active: boolean;
    track: 'menu' | 'run';
    /** The floor's realm: on the run track its music plays instead of the plain run loop. */
    realm?: RealmId | null;
    masterVolume: number;
    musicVolume: number;
    /** When true, keep the element paused (e.g. other systems need exclusive control of the output). */
    suppressed?: boolean;
}

/** One realm's music handing over to the next: the old fades out as the new fades in. */
export const MUSIC_CROSSFADE_MS = 1200;
const FADE_TICK_MS = 50;

interface GameplayMusicPlaybackController {
    requestPlay: () => void;
    suspend: () => void;
}

type AdaptiveMusicLayer = 'menu_calm' | 'run_focus' | 'run_pressure' | 'run_release' | 'silent';

interface AdaptiveMusicInput {
    hidden?: boolean;
    run: RunState | null;
    view: ViewState;
}

interface AdaptiveMusicState {
    active: boolean;
    layer: AdaptiveMusicLayer;
    suppressed: boolean;
    track: 'menu' | 'run';
    volumeMultiplier: number;
}

export const resolveAdaptiveMusicState = ({ hidden = false, run, view }: AdaptiveMusicInput): AdaptiveMusicState => {
    if (
        hidden ||
        view === 'boot' ||
        view === 'settings' ||
        view === 'collection' ||
        view === 'profile' ||
        view === 'inventory' ||
        view === 'codex'
    ) {
        return { active: false, layer: 'silent', suppressed: true, track: 'menu', volumeMultiplier: 0 };
    }
    const lifecycleState = lifecycleStateFromSurface({ run, view });

    if (lifecycleState === 'menu' || view === 'modeSelect') {
        return { active: true, layer: 'menu_calm', suppressed: false, track: 'menu', volumeMultiplier: 0.82 };
    }
    if (view === 'gameOver' || lifecycleState === 'gameOver') {
        return { active: false, layer: 'silent', suppressed: true, track: 'run', volumeMultiplier: 0 };
    }

    if (!run) {
        return { active: false, layer: 'silent', suppressed: true, track: 'menu', volumeMultiplier: 0 };
    }

    if (lifecycleState === 'paused') {
        return { active: false, layer: 'silent', suppressed: true, track: 'run', volumeMultiplier: 0 };
    }

    if (lifecycleState === 'levelComplete') {
        return { active: true, layer: 'run_release', suppressed: false, track: 'run', volumeMultiplier: 0.56 };
    }

    if (lifecycleState === 'memorize' || lifecycleState === 'playing' || lifecycleState === 'resolving') {
        const bossPressure = run.board?.floorTag === 'boss';
        const mutatorPressure = run.activeMutators.length >= 2;
        if (bossPressure || mutatorPressure) {
            return { active: true, layer: 'run_pressure', suppressed: false, track: 'run', volumeMultiplier: 0.96 };
        }
        return { active: true, layer: 'run_focus', suppressed: false, track: 'run', volumeMultiplier: 0.74 };
    }

    return { active: false, layer: 'silent', suppressed: true, track: 'menu', volumeMultiplier: 0 };
};

export const getAdaptiveMusicState = ({
    active,
    runStatus,
    track
}: {
    active: boolean;
    runStatus?: RunState['status'];
    track: 'menu' | 'run';
}): { intensity: 'calm' | 'focus' | 'release' | 'silent'; shouldPlay: boolean; track: 'menu' | 'run' } => {
    if (!active || runStatus === 'gameOver' || runStatus === 'paused') {
        return { intensity: 'silent', shouldPlay: false, track };
    }
    if (track === 'menu') {
        return { intensity: 'calm', shouldPlay: true, track };
    }
    if (runStatus === 'levelComplete') {
        return { intensity: 'release', shouldPlay: true, track };
    }
    return { intensity: 'focus', shouldPlay: true, track };
};

/**
 * Looped background music via `HTMLAudioElement`. Volume follows **`masterVolume` x `musicVolume`**.
 * HTMLMediaElement autoplay rules apply: first successful `play()` may require a user gesture; we retry on the first `pointerdown`.
 */
export function useGameplayMusic({ active, track, realm = null, masterVolume, musicVolume, suppressed = false }: GameplayMusicParams): void {
    const key = musicTrackKey(track, realm);
    // The key being rendered, read by the outgoing element's cleanup: a realm handing to a realm fades.
    const keyRef = useRef<MusicTrackKey | null>(null);
    const previousKeyRef = useRef<MusicTrackKey | null>(null);
    keyRef.current = key;
    const targetVolumeRef = useRef(musicGainFromSettings(masterVolume, musicVolume));
    const fadeInRef = useRef<{ el: HTMLAudioElement; startedAt: number } | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUnavailableRef = useRef(false);
    const playbackControllerRef = useRef<GameplayMusicPlaybackController | null>(null);
    const playbackRequestedRef = useRef(false);
    const pageVisible = useSyncExternalStore(
        subscribeToPageVisibility,
        getPageVisibilitySnapshot,
        getPageVisibilitySnapshot
    );
    playbackRequestedRef.current = active && !suppressed && pageVisible;

    useEffect(() => {
        if (typeof Audio === 'undefined') return undefined;
        const src = playableTrackUrl(key);
        audioUnavailableRef.current = false;
        const handedOver = isRunFamily(previousKeyRef.current) && isRunFamily(key);
        previousKeyRef.current = key;
        if (!src) {
            audioRef.current = null;
            audioUnavailableRef.current = true;
            return undefined;
        }

        const el = new Audio(src);
        el.loop = true;
        el.preload = 'auto';
        audioRef.current = el;
        // Taking over from another realm's music: come up from silence under it.
        let fadeInTimer: ReturnType<typeof setInterval> | null = null;
        if (handedOver) {
            const startedAt = Date.now();
            fadeInRef.current = { el, startedAt };
            el.volume = 0;
            fadeInTimer = setInterval(() => {
                const into = Math.min(1, (Date.now() - startedAt) / MUSIC_CROSSFADE_MS);
                el.volume = targetVolumeRef.current * into;
                if (into >= 1 && fadeInTimer) {
                    clearInterval(fadeInTimer);
                    fadeInTimer = null;
                    if (fadeInRef.current?.el === el) fadeInRef.current = null;
                }
            }, FADE_TICK_MS);
        }

        let gestureRetryAttached = false;
        let playAttempt = 0;

        const detachGestureRetry = (): void => {
            if (!gestureRetryAttached) {
                return;
            }
            document.removeEventListener('pointerdown', onFirstPointer);
            gestureRetryAttached = false;
        };

        const attachGestureRetry = (): void => {
            if (gestureRetryAttached || audioUnavailableRef.current) {
                return;
            }
            document.addEventListener('pointerdown', onFirstPointer);
            gestureRetryAttached = true;
        };

        const suspend = (): void => {
            playAttempt += 1;
            detachGestureRetry();
        };

        const requestPlay = (): void => {
            if (!playbackRequestedRef.current || audioUnavailableRef.current) {
                return;
            }
            attachGestureRetry();
            const attempt = ++playAttempt;
            let result: Promise<void>;
            try {
                result = el.play();
            } catch {
                return;
            }
            void Promise.resolve(result).then(
                () => {
                    if (attempt === playAttempt) {
                        detachGestureRetry();
                    }
                },
                () => {
                    if (attempt === playAttempt && playbackRequestedRef.current) {
                        attachGestureRetry();
                    }
                }
            );
        };

        const onFirstPointer = (): void => {
            requestPlay();
        };

        const playbackController: GameplayMusicPlaybackController = { requestPlay, suspend };
        playbackControllerRef.current = playbackController;

        const silenceUnavailableAudio = (): void => {
            audioUnavailableRef.current = true;
            suspend();
            el.pause();
            el.removeAttribute('src');
            try {
                el.load();
            } catch {
                /* media element may already be detached */
            }
        };
        el.addEventListener('error', silenceUnavailableAudio, { once: true });

        return () => {
            suspend();
            if (fadeInTimer) clearInterval(fadeInTimer);
            if (fadeInRef.current?.el === el) fadeInRef.current = null;
            el.removeEventListener('error', silenceUnavailableAudio);
            const release = (): void => {
                el.pause();
                el.removeAttribute('src');
                try {
                    el.load();
                } catch {
                    /* media element may already be detached */
                }
            };
            // A realm handing over to the next: the old music fades under the new one rather than cutting.
            if (isRunFamily(key) && isRunFamily(keyRef.current) && keyRef.current !== key && !el.paused && el.volume > 0) {
                const from = el.volume;
                const startedAt = Date.now();
                const fadeOut = setInterval(() => {
                    const left = 1 - Math.min(1, (Date.now() - startedAt) / MUSIC_CROSSFADE_MS);
                    el.volume = from * left;
                    if (left <= 0) {
                        clearInterval(fadeOut);
                        release();
                    }
                }, FADE_TICK_MS);
            } else {
                release();
            }
            audioRef.current = null;
            if (playbackControllerRef.current === playbackController) {
                playbackControllerRef.current = null;
            }
        };
    }, [key]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const target = musicGainFromSettings(masterVolume, musicVolume);
        targetVolumeRef.current = target;
        const fading = fadeInRef.current?.el === el ? fadeInRef.current : null;
        el.volume = fading ? target * Math.min(1, (Date.now() - fading.startedAt) / MUSIC_CROSSFADE_MS) : target;

        if (!active || suppressed || !pageVisible || audioUnavailableRef.current) {
            playbackControllerRef.current?.suspend();
            el.pause();
            return;
        }

        playbackControllerRef.current?.requestPlay();
    }, [active, key, masterVolume, musicVolume, pageVisible, suppressed]);
}
