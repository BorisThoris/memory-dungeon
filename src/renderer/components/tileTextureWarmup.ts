import type { Texture } from 'three';
import type { BoardState, GraphicsQualityPreset, Tile } from '../../shared/contracts';
import {
    getCardFaceStaticTexture,
    getCardPanelDisplacementTexture,
    getCardPanelNormalTexture,
    getTileFaceOverlayTexture,
    getTileFaceRoughnessTexture,
    getTileFaceTexture,
    setTileTextureSamplingQuality
} from './tileTextures';

/**
 * Every texture a board will ask for, drawn before it is shown.
 *
 * A tile draws its textures the first time it renders them (`TileBezel`): the back and its
 * roughness when the board mounts, and a face overlay and face roughness the first time the card is
 * shown active, matched or mismatched. The memorize phase shows every face at once, so the first
 * frame of a floor drew every face on the board in one go, and the first match and first miss each
 * drew a new set. This draws them all ahead - the CPU half behind the run's loading screen
 * (`drawBoardTileTextures`), the GPU half before the board's first frame (`uploadBoardTileTextures`,
 * via `renderer.initTexture`) - with the same getters and the same cache keys the tiles use, so
 * the tiles find them ready.
 */

const FACE_UP_VARIANTS = ['active', 'matched', 'mismatch'] as const;

/**
 * One getter per texture a tile uses, back first: the order the tiles themselves ask in. Faces
 * first looked better for a floor that opens face up, and made the opening turns draw seven
 * canvases mid-play (`asset-streaming.spec.ts`) - keep this order.
 */
const textureDrawsForTile = (tile: Tile, graphicsQuality: GraphicsQualityPreset): (() => Texture | null)[] => [
    () => getTileFaceTexture(tile, 'back', 'hidden', 'panel'),
    () => getTileFaceRoughnessTexture(tile, 'back', 'hidden', 'panel'),
    ...FACE_UP_VARIANTS.flatMap((variant) => [
        () => getTileFaceOverlayTexture(tile, variant, graphicsQuality),
        () => getTileFaceRoughnessTexture(tile, 'front', variant, 'panel')
    ])
];

const texturesForTile = (tile: Tile, graphicsQuality: GraphicsQualityPreset): Texture[] =>
    textureDrawsForTile(tile, graphicsQuality)
        .map((draw) => draw())
        .filter((texture): texture is Texture => texture != null);

const sharedTextures = (): Texture[] => {
    const shared: (Texture | null)[] = [getCardFaceStaticTexture(), getCardPanelNormalTexture(), getCardPanelDisplacementTexture()];
    return shared.filter((texture): texture is Texture => texture != null);
};

const liveTiles = (board: BoardState): Tile[] => board.tiles.filter((tile) => tile.state !== 'removed');

/**
 * Draws every texture the board's tiles will use, a few tiles at a time so the loading screen keeps
 * animating between them. Cached: a second call for the same board is a lookup.
 */
export const drawBoardTileTextures = async (
    board: BoardState,
    graphicsQuality: GraphicsQualityPreset,
    tilesPerSlice = 4
): Promise<void> => {
    // The board sets this when it mounts, and a change of quality throws every overlay away; set it
    // first, or the board's first sync would discard all the faces drawn here (measured: 7 of them).
    setTileTextureSamplingQuality(graphicsQuality);
    sharedTextures();
    if (board.tiles.length > 48) return;
    const tiles = liveTiles(board);
    for (let index = 0; index < tiles.length; index += 1) {
        texturesForTile(tiles[index]!, graphicsQuality);
        if ((index + 1) % tilesPerSlice === 0) {
            await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
        }
    }
};

/** The GPU half: uploads every texture the board uses, so its first frame uploads nothing. */
export const uploadBoardTileTextures = (
    board: BoardState,
    graphicsQuality: GraphicsQualityPreset,
    initTexture: (texture: Texture) => void
): number => {
    const textures = new Set<Texture>(sharedTextures());
    for (const tile of board.tiles.length > 48 ? [] : liveTiles(board)) {
        for (const texture of texturesForTile(tile, graphicsQuality)) textures.add(texture);
    }
    for (const texture of textures) {
        try {
            initTexture(texture);
        } catch {
            // A texture that cannot upload early still uploads on first use, as before.
        }
    }
    return textures.size;
};

/**
 * The next floor's textures, drawn and uploaded a few at a time while this floor's clear plays.
 *
 * Floor 2 opened on an 830ms frame (measured 2026-10-16 on the 3090): `uploadBoardTileTextures`
 * drew and uploaded every face of the new board in the layout effect that mounts it - 63% of it in
 * `texSubImage2D` - because a later floor has no loading screen to hide behind. The clear beat
 * holds the screen for about two seconds with the next board already decided, so the scene steps
 * this queue once a frame under a budget in that time. One step is one texture, since a single
 * upload runs about 5ms; the board's own warm-up then finds them drawn and on the GPU. Whatever is
 * left when the board arrives - or differs, if a door chose another floor - uploads there, as before.
 */
export const createBoardTextureWarmupQueue = (
    board: BoardState,
    graphicsQuality: GraphicsQualityPreset,
    initTexture: (texture: Texture) => void
): ((budgetMs: number) => boolean) => {
    const draws: (() => Texture | null)[] = [...sharedTextures().map((texture) => () => texture)];
    for (const tile of board.tiles.length > 48 ? [] : liveTiles(board)) draws.push(...textureDrawsForTile(tile, graphicsQuality));
    let next = 0;
    return (budgetMs) => {
        const started = performance.now();
        while (next < draws.length) {
            const texture = draws[next]!();
            next += 1;
            if (texture) {
                try {
                    initTexture(texture);
                } catch {
                    // Uploads on first use instead.
                }
            }
            if (performance.now() - started >= budgetMs) break;
        }
        return next >= draws.length;
    };
};
