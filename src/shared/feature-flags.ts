/**
 * Product feature gates. Import from UI when copy or controls must reflect shipped capability.
 *
 * Cloud save is Steam Auto-Cloud, which needs no code in the game — Steam syncs the save file
 * while the game is not running, using the rules in `save-location.ts`. This flag exists so the
 * Settings copy tells the truth: it stays false until Auto-Cloud is actually switched on for the
 * app on the Partner site, and the packaging step sets `VITE_FEATURE_CLOUD_SAVE=1` once it is.
 * Turning it on without configuring Steam would promise a player something that does not happen.
 */
export const FEATURE_CLOUD_SAVE = import.meta.env?.VITE_FEATURE_CLOUD_SAVE === '1';

/** When true and graphics quality is high, card rank/symbol may use opentype.js vector paths after font preload. */
export const FEATURE_CARD_OPENTYPE_GLYPHS = true;

/**
 * When true, face-up card overlays (non-programmatic-motif tiles) composite two layers from a 30-slot raster library
 * instead of a single procedural illustration pass. DEV override: `localStorage.cardRasterDeck = '1'`.
 */
export const FEATURE_CARD_RASTER_DECK = false;
