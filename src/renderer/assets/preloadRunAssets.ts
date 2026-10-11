import { preloadSampledSfx } from '../audio/sampledSfx';
import { preloadUiSfx } from '../audio/uiSfx';
import { preloadGameplayMusic } from '../audio/gameplayMusic';
import { getAllCardIllustrationUrls } from '../cardFace/cardIllustrationRegistry';
import {
    getCardIllustrationImageByUrl,
    preloadCardIllustrationImages,
    subscribeCardIllustrationImageReady
} from '../cardFace/cardIllustrationImages';
import { preloadCardRankOpentypeFont } from '../cardFace/opentypeCardRankFont';
import { preloadTileTextureImages } from '../components/tileTextures';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { preloadUiRasterImagesFully } from './preloadStartupAssets';

/**
 * Everything a run touches, loaded and decoded before the board appears.
 *
 * Measured before this existed (a headless run from the main menu): with the board up, all eleven
 * game sound effects were still being fetched 2.7-5.6s into play - so the first flips and matches
 * were silent - a display font arrived 16s in, and the run's music started streaming as the board
 * mounted. The card art only looked ready because the menu had given an idle warm-up time to
 * finish; a player who clicked Play at once beat it, and a face drawn before its image landed was
 * drawn from the procedural fallback and then swapped. The loading screen waited for code, never
 * for assets.
 *
 * So: one memoised promise, started at boot behind the intro and again (a no-op by then) when a
 * run starts, which the run's loading screen waits on. Every step is bounded: a missing or broken
 * asset costs its share of `RUN_ASSET_STEP_CAP_MS`, never the run, and each step reports when it is
 * no longer being waited on, whether or not it succeeded - the same rule the boot rail follows.
 */

export type RunAssetStepId = 'art' | 'tiles' | 'scene' | 'sound' | 'music' | 'type';

export interface RunAssetProgress {
    completed: number;
    total: number;
    step: RunAssetStepId;
    label: string;
}

const RUN_ASSET_STEP_LABELS: Record<RunAssetStepId, string> = {
    art: 'Painting the cards…',
    tiles: 'Cutting the tiles…',
    scene: 'Lighting the hall…',
    sound: 'Tuning the room…',
    music: 'Finding the tune…',
    type: 'Setting the type…'
};

export const RUN_ASSET_STEP_TOTAL = Object.keys(RUN_ASSET_STEP_LABELS).length;

/** No single step may hold the board back longer than this; what is still missing loads lazily as before. */
export const RUN_ASSET_STEP_CAP_MS = 12_000;

const withCap = <T,>(operation: Promise<T>, capMs = RUN_ASSET_STEP_CAP_MS): Promise<T | undefined> =>
    new Promise((resolve) => {
        const timer = globalThis.setTimeout(() => resolve(undefined), capMs);
        operation.then(
            (value) => {
                globalThis.clearTimeout(timer);
                resolve(value);
            },
            () => {
                globalThis.clearTimeout(timer);
                resolve(undefined);
            }
        );
    });

/**
 * The illustration loader resolves each image after a short timeout whether or not it arrived (and
 * then keeps loading it), so awaiting it does not mean the art is there. This waits until every
 * URL is actually decoded in the cache, or the cap.
 */
const waitForCardArt = async (urls: readonly string[]): Promise<void> => {
    await preloadCardIllustrationImages(urls, { concurrency: 6 });
    const missing = (): number => urls.filter((url) => !getCardIllustrationImageByUrl(url)?.naturalWidth).length;
    if (missing() === 0) return;
    // An image that failed never arrives, so this ends on the step cap rather than holding a listener forever.
    await new Promise<void>((resolve) => {
        const deadline = globalThis.setTimeout(finish, RUN_ASSET_STEP_CAP_MS);
        const unsubscribe = subscribeCardIllustrationImageReady(() => {
            if (missing() === 0) finish();
        });
        function finish(): void {
            globalThis.clearTimeout(deadline);
            unsubscribe();
            resolve();
        }
    });
};

/** Every font face the page declares for Latin text, loaded now rather than on the first glyph that needs it. */
const loadDocumentFonts = async (): Promise<void> => {
    if (typeof document === 'undefined' || !document.fonts) return;
    // Every face the page declares: global.css imports only the Latin subsets (`latin-*.css`), and the
    // browser reports their range as the full U+0-10FFFF, so a range filter matched nothing and the step
    // loaded no font at all - Cinzel 800 still arrived six seconds into play.
    const faces: FontFace[] = [];
    document.fonts.forEach((face) => {
        if (face.status === 'unloaded') faces.push(face);
    });
    await Promise.all(faces.map((face) => face.load().catch(() => undefined)));
};

let started: Promise<void> | null = null;
let finished = false;
const listeners = new Set<(progress: RunAssetProgress) => void>();
let lastProgress: RunAssetProgress | null = null;

/** Subscribe to progress; the latest report is replayed at once so a late subscriber is not blank. */
export const subscribeRunAssetProgress = (listener: (progress: RunAssetProgress) => void): (() => void) => {
    listeners.add(listener);
    if (lastProgress) listener(lastProgress);
    return () => {
        listeners.delete(listener);
    };
};

export const runAssetsReady = (): boolean => finished;

/**
 * Starts (once) and returns the run-asset preload. Safe to call from boot and again at run start:
 * the second call gets the same promise.
 */
export const preloadRunAssets = (options: { graphicsQuality?: GraphicsQualityPreset } = {}): Promise<void> => {
    if (started) return started;
    // jsdom never loads an image or a sound, so under test every step would sit out its cap.
    if (import.meta.env.MODE === 'test') {
        finished = true;
        started = Promise.resolve();
        return started;
    }
    let completed = 0;
    const track = (step: RunAssetStepId, operation: Promise<unknown>): Promise<void> =>
        withCap(operation).then(() => {
            completed += 1;
            lastProgress = { completed, total: RUN_ASSET_STEP_TOTAL, step, label: RUN_ASSET_STEP_LABELS[step] };
            for (const listener of listeners) listener(lastProgress);
        });
    started = Promise.all([
        track('art', waitForCardArt(getAllCardIllustrationUrls())),
        track('tiles', preloadTileTextureImages()),
        track('scene', preloadUiRasterImagesFully()),
        track('sound', Promise.all([preloadSampledSfx(), preloadUiSfx()])),
        track('music', preloadGameplayMusic()),
        track(
            'type',
            Promise.all([loadDocumentFonts(), preloadCardRankOpentypeFont(options.graphicsQuality ?? 'high')])
        )
    ]).then(() => {
        finished = true;
    });
    return started;
};

export const resetRunAssetPreloadForTests = (): void => {
    started = null;
    finished = false;
    lastProgress = null;
    listeners.clear();
};
