import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { RunState, ViewState } from '../../shared/contracts';
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

const resolveMusicUrl = (filename: string): string | undefined => musicUrls[`../assets/audio/music/${filename}`];
const resolvePortfolioMusicUrl = (filename: string): string | undefined =>
    portfolioMusicUrls[`../../../assets/audio/portfolio-feedback-pack/${filename}`];
const resolveTrackUrl = (track: 'menu' | 'run'): string | undefined => {
    if (track === 'run') {
        return resolvePortfolioMusicUrl('demo-ambience-loop.ogg') ?? resolveMusicUrl('run-loop.ogg');
    }
    return resolveMusicUrl('menu-loop.ogg');
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
    masterVolume: number;
    musicVolume: number;
    /** When true, keep the element paused (e.g. other systems need exclusive control of the output). */
    suppressed?: boolean;
}

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

    if (
        lifecycleState === 'levelComplete' ||
        lifecycleState === 'shop' ||
        lifecycleState === 'sideRoom' ||
        lifecycleState === 'relicOffer'
    ) {
        return { active: true, layer: 'run_release', suppressed: false, track: 'run', volumeMultiplier: 0.56 };
    }

    if (lifecycleState === 'memorize' || lifecycleState === 'playing' || lifecycleState === 'resolving') {
        const gauntletPressure = run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null;
        const bossPressure = run.board?.floorTag === 'boss';
        const mutatorPressure = run.activeMutators.length >= 2;
        if (gauntletPressure || bossPressure || mutatorPressure) {
            return { active: true, layer: 'run_pressure', suppressed: false, track: 'run', volumeMultiplier: 0.96 };
        }
        return { active: true, layer: 'run_focus', suppressed: false, track: 'run', volumeMultiplier: 0.74 };
    }

    return { active: false, layer: 'silent', suppressed: true, track: 'menu', volumeMultiplier: 0 };
};

export const getAdaptiveMusicState = ({
    active,
    gauntletPressure = false,
    runStatus,
    track
}: {
    active: boolean;
    gauntletPressure?: boolean;
    runStatus?: RunState['status'];
    track: 'menu' | 'run';
}): { intensity: 'calm' | 'focus' | 'pressure' | 'release' | 'silent'; shouldPlay: boolean; track: 'menu' | 'run' } => {
    if (!active || runStatus === 'gameOver' || runStatus === 'paused') {
        return { intensity: 'silent', shouldPlay: false, track };
    }
    if (track === 'menu') {
        return { intensity: 'calm', shouldPlay: true, track };
    }
    if (runStatus === 'levelComplete') {
        return { intensity: 'release', shouldPlay: true, track };
    }
    if (gauntletPressure) {
        return { intensity: 'pressure', shouldPlay: true, track };
    }
    return { intensity: 'focus', shouldPlay: true, track };
};

/**
 * Looped background music via `HTMLAudioElement`. Volume follows **`masterVolume` x `musicVolume`**.
 * HTMLMediaElement autoplay rules apply: first successful `play()` may require a user gesture; we retry on the first `pointerdown`.
 */
export function useGameplayMusic({ active, track, masterVolume, musicVolume, suppressed = false }: GameplayMusicParams): void {
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
        const src = resolveTrackUrl(track);
        audioUnavailableRef.current = false;
        if (!src) {
            audioRef.current = null;
            audioUnavailableRef.current = true;
            return undefined;
        }

        const el = new Audio(src);
        el.loop = true;
        el.preload = 'auto';
        audioRef.current = el;

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
            el.removeEventListener('error', silenceUnavailableAudio);
            el.pause();
            el.removeAttribute('src');
            try {
                el.load();
            } catch {
                /* media element may already be detached */
            }
            audioRef.current = null;
            if (playbackControllerRef.current === playbackController) {
                playbackControllerRef.current = null;
            }
        };
    }, [track]);

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        el.volume = musicGainFromSettings(masterVolume, musicVolume);

        if (!active || suppressed || !pageVisible || audioUnavailableRef.current) {
            playbackControllerRef.current?.suspend();
            el.pause();
            return;
        }

        playbackControllerRef.current?.requestPlay();
    }, [active, track, masterVolume, musicVolume, pageVisible, suppressed]);
}
