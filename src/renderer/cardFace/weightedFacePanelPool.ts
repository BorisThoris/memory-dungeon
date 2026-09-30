import { ALL_FACE_PANEL_URLS_ORDERED } from './facePanelRasterUrls';

/**
 * Face panels (1-based file numbers) the SDXL batch spoiled: dot noise, tiled wallpaper, stripes
 * and grids with no motif. On a phone they read as broken art rather than a picture - panel 02 is
 * a trident standing in a field of black-and-white static - so they are dealt to no card.
 */
export const SPOILED_FACE_PANEL_NUMBERS: ReadonlySet<number> = new Set([
    1, 2, 12, 23, 26, 48, 50, 52, 56, 65, 71, 73, 77, 79, 80
]);

const dealtPanels = (from: number, to: number): readonly string[] =>
    ALL_FACE_PANEL_URLS_ORDERED.slice(from, to).filter((_, i) => !SPOILED_FACE_PANEL_NUMBERS.has(from + i + 1));

/** Central illustration variants (bread-and-butter motifs). */
export const FACE_PANEL_COMMON_URLS = dealtPanels(0, 48);

/** Richer motifs — appear less often via weighted strip. */
export const FACE_PANEL_UNCOMMON_URLS = dealtPanels(48, 72);

/** Showcase / rare — few files, lowest selection rate. */
export const FACE_PANEL_RARE_URLS = dealtPanels(72, 80);

/**
 * Deterministic fallback list for `resolveCardIllustrationUrl` (~200 slots).
 * Blend: ~70% common, ~20% uncommon, ~10% rare — so rare panels read "special" in the wild.
 */
export const buildWeightedFacePanelFallbackStrip = (): readonly string[] => {
    const strip: string[] = [];
    for (let i = 0; i < 140; i += 1) {
        strip.push(FACE_PANEL_COMMON_URLS[i % FACE_PANEL_COMMON_URLS.length]);
    }
    for (let i = 0; i < 40; i += 1) {
        strip.push(FACE_PANEL_UNCOMMON_URLS[i % FACE_PANEL_UNCOMMON_URLS.length]);
    }
    for (let i = 0; i < 20; i += 1) {
        strip.push(FACE_PANEL_RARE_URLS[i % FACE_PANEL_RARE_URLS.length]);
    }
    return strip;
};
