/**
 * Dev-only A/B: set `localStorage.tileStepLegacy = '1'` and **reload** so each tile runs its own
 * `useFrame` calling `advanceTileBezelFrame` instead of the scene-level consolidated loop.
 */
export const readTileStepLegacy = (): boolean =>
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (() => {
        try {
            return window.localStorage.getItem('tileStepLegacy') === '1';
        } catch {
            return false;
        }
    })();
