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

const texturesForTile = (tile: Tile, graphicsQuality: GraphicsQualityPreset): Texture[] => {
    const out: (Texture | null)[] = [
        getTileFaceTexture(tile, 'back', 'hidden', 'panel'),
        getTileFaceRoughnessTexture(tile, 'back', 'hidden', 'panel')
    ];
    for (const variant of FACE_UP_VARIANTS) {
        out.push(getTileFaceOverlayTexture(tile, variant, graphicsQuality));
        out.push(getTileFaceRoughnessTexture(tile, 'front', variant, 'panel'));
    }
    return out.filter((texture): texture is Texture => texture != null);
};

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
    for (const tile of liveTiles(board)) {
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
