const fallbackPosterUrl =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 1280"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop stop-color="%23240f1f"/%3E%3Cstop offset=".55" stop-color="%23153632"/%3E%3Cstop offset="1" stop-color="%23c08a35"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="960" height="1280" fill="url(%23g)"/%3E%3Cpath d="M480 196 736 352v300c0 214-146 370-256 430-110-60-256-216-256-430V352l256-156Z" fill="none" stroke="%23f5d28a" stroke-width="34" opacity=".8"/%3E%3Ccircle cx="480" cy="582" r="144" fill="%230b1215" opacity=".38"/%3E%3Cpath d="M480 438v288M336 582h288" stroke="%23f5d28a" stroke-width="42" stroke-linecap="round" opacity=".82"/%3E%3C/svg%3E';

const backgroundUrls = import.meta.glob<string>('./backgrounds/*.{png,jpg,jpeg,webp}', {
    eager: true,
    query: '?url',
    import: 'default'
});

export const resolveUiBackgroundUrl = (filename: string, fallback = fallbackPosterUrl): string =>
    backgroundUrls[`./backgrounds/${filename}`] ?? fallback;

const modePlaceholderUrl = resolveUiBackgroundUrl('bg-mode-placeholder-v1.png');

export const MODE_POSTER_FALLBACK_KEY = 'fallback' as const;

export const MODE_POSTER_FALLBACK_COPY = {
    title: 'Fallback poster',
    description: 'Intentional shared emblem treatment for modes without bespoke production art yet.'
} as const;

/** Per-mode poster rasters for Choose Your Path (TASK-018). */
export const MODE_CARD_ART = {
    classic: resolveUiBackgroundUrl('bg-mode-classic-v1.png', modePlaceholderUrl),
    daily: resolveUiBackgroundUrl('bg-mode-daily-v1.png', modePlaceholderUrl),
    dungeon_showcase: resolveUiBackgroundUrl('mode-dungeon-showcase.png', modePlaceholderUrl),
    endless: resolveUiBackgroundUrl('bg-mode-endless-v1.png', modePlaceholderUrl),
    fallback: modePlaceholderUrl,
    gauntlet: resolveUiBackgroundUrl('bg-mode-gauntlet-v1.png', modePlaceholderUrl),
    puzzle: resolveUiBackgroundUrl('bg-mode-puzzle-v1.png', modePlaceholderUrl),
    mirror_puzzle: resolveUiBackgroundUrl('bg-mode-mirror-puzzle-v1.png', modePlaceholderUrl),
    wild: resolveUiBackgroundUrl('bg-mode-wild-v1.png', modePlaceholderUrl),
    practice: resolveUiBackgroundUrl('bg-mode-practice-v1.png', modePlaceholderUrl),
    scholar: resolveUiBackgroundUrl('bg-mode-scholar-v1.png', modePlaceholderUrl),
    pin_vow: resolveUiBackgroundUrl('bg-mode-pin-vow-v1.png', modePlaceholderUrl),
    meditation: resolveUiBackgroundUrl('bg-mode-meditation-v1.png', modePlaceholderUrl)
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
