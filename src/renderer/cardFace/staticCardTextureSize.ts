import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from '../components/tileShatter';

/**
 * The pixel size of a static card's bitmap, in one place.
 *
 * It used to be in two. `tileTextures.ts` defined it and exported a reader for it; `cardRasterDeck.ts`
 * wrote the same two constants and the same function again under the name
 * `getStaticCardTexturePixelSizeLocal`, with the reason stated in a comment: "no import - avoids
 * cycles". That reason was true - `tileTextures.ts` imports `cardRasterDeck.ts` for the composed
 * overlay, so an import the other way is a cycle - and the copies did agree. Nothing checked that
 * they would keep agreeing. Raise the height in one and the raster deck goes on computing its
 * illustration rect against the old number, which is the kind of divergence that shows up as
 * slightly wrong art rather than as a failure.
 *
 * A leaf module has no such problem: `tileShatter` imports only three leaves of its own, so both
 * sides can import this and neither imports the other. The height is what a 1403x2048 source needs
 * so it is not over-downscaled (512 felt cropped and soft), and the width follows the card plane's
 * aspect, which is why this lives next to that aspect rather than beside either caller.
 */
export const STATIC_CARD_TEXTURE_HEIGHT = 1024;

export const STATIC_CARD_TEXTURE_WIDTH = Math.max(
    2,
    Math.round(STATIC_CARD_TEXTURE_HEIGHT * (CARD_PLANE_WIDTH / CARD_PLANE_HEIGHT))
);

/** Regression anchor: static card bitmap dimensions must track `CARD_PLANE_*` in `tileShatter`. */
export const getStaticCardTexturePixelSize = (): { height: number; width: number } => ({
    height: STATIC_CARD_TEXTURE_HEIGHT,
    width: STATIC_CARD_TEXTURE_WIDTH
});
