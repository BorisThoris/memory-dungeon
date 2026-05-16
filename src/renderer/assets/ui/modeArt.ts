import modeClassicUrl from './backgrounds/bg-mode-classic-v1.png';
import modeDailyUrl from './backgrounds/bg-mode-daily-v1.png';
import modeDungeonShowcaseUrl from './backgrounds/mode-dungeon-showcase.png';
import modeEndlessUrl from './backgrounds/bg-mode-endless-v1.png';
import modeGauntletUrl from './backgrounds/bg-mode-gauntlet-v1.png';
import modeMeditationUrl from './backgrounds/bg-mode-meditation-v1.png';
import modeMirrorPuzzleUrl from './backgrounds/bg-mode-mirror-puzzle-v1.png';
import modePinVowUrl from './backgrounds/bg-mode-pin-vow-v1.png';
import modePlaceholderUrl from './backgrounds/bg-mode-placeholder-v1.png';
import modePracticeUrl from './backgrounds/bg-mode-practice-v1.png';
import modePuzzleUrl from './backgrounds/bg-mode-puzzle-v1.png';
import modeScholarUrl from './backgrounds/bg-mode-scholar-v1.png';
import modeWildUrl from './backgrounds/bg-mode-wild-v1.png';

export const MODE_POSTER_FALLBACK_KEY = 'fallback' as const;

export const MODE_POSTER_FALLBACK_COPY = {
    title: 'Fallback poster',
    description: 'Intentional shared emblem treatment for modes without bespoke production art yet.'
} as const;

/** Per-mode poster rasters for Choose Your Path (TASK-018). */
export const MODE_CARD_ART = {
    classic: modeClassicUrl,
    daily: modeDailyUrl,
    dungeon_showcase: modeDungeonShowcaseUrl,
    endless: modeEndlessUrl,
    fallback: modePlaceholderUrl,
    gauntlet: modeGauntletUrl,
    puzzle: modePuzzleUrl,
    mirror_puzzle: modeMirrorPuzzleUrl,
    wild: modeWildUrl,
    practice: modePracticeUrl,
    scholar: modeScholarUrl,
    pin_vow: modePinVowUrl,
    meditation: modeMeditationUrl
} as const;

export type ModePosterKey = keyof typeof MODE_CARD_ART;

export const isModePosterFallback = (posterKey: string): boolean =>
    !(posterKey in MODE_CARD_ART) || MODE_CARD_ART[posterKey as ModePosterKey] === modePlaceholderUrl;

export const modePosterHasCustomArt = (posterKey: string): boolean => !isModePosterFallback(posterKey);

export interface ModePosterArtRow {
    key: ModePosterKey;
    assetUrl: string;
    status: 'custom' | 'fallback';
    fallbackKey: typeof MODE_POSTER_FALLBACK_KEY | null;
}

export const getModePosterArtRows = (): ModePosterArtRow[] =>
    (Object.keys(MODE_CARD_ART) as ModePosterKey[]).map((key) => ({
        assetUrl: MODE_CARD_ART[key],
        key,
        status: isModePosterFallback(key) ? 'fallback' : 'custom',
        fallbackKey: isModePosterFallback(key) && key !== MODE_POSTER_FALLBACK_KEY ? MODE_POSTER_FALLBACK_KEY : null
    }));

/** Resolve a catalog `posterKey` string to a bundled image URL (unknown keys fall back to placeholder). */
export function resolveModePosterUrl(posterKey: string): string {
    if (posterKey in MODE_CARD_ART) {
        return MODE_CARD_ART[posterKey as ModePosterKey];
    }
    return modePlaceholderUrl;
}
