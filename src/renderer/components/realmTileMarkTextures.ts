import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import type { Tile, TileSuit } from '../../shared/contracts';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { cardStatusMark, realmTileMarkKey, type RealmTileMark } from './realmTileMarkKey';
import { paintCardStatus } from './cardStatusPaint';
import { FROSTBITE_TURNS_RAGING, WILDFIRE_FUSE } from '../../shared/realm-weather-rules';

/** The painted textures of the marks a card wears (`RealmTileMarks`): one canvas per distinct mark and face, shared. */
const CANVAS_W = 256;
const CANVAS_H = Math.round(CANVAS_W * (CARD_PLANE_HEIGHT / CARD_PLANE_WIDTH));

const textures = new Map<string, CanvasTexture>();

export const realmTileMarkTexture = (mark: RealmTileMark, faceUp: boolean): CanvasTexture => {
    const key = `${realmTileMarkKey(mark)}:${faceUp ? 'front' : 'back'}`;
    const cached = textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context) paintCardStatus(context, canvas.width, canvas.height, mark, faceUp);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    // Mipmapped: a tilted or distant card shrinks this, and without mips it shimmers.
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    textures.set(key, texture);
    return texture;
};

const TURNCOAT_SUITS: readonly TileSuit[] = ['ember', 'tide', 'moss', 'bone'];

// A floor can open without marks and acquire them on its very first turn. Warm the common
// elemental/weather marks too, without taking a Cartesian product of unrelated hazards.
const DYNAMIC_MARK_TILES: readonly Tile[] = [
    { frost: FROSTBITE_TURNS_RAGING },
    { fuse: WILDFIRE_FUSE },
    { vined: true, seeded: 1 },
    { vined: true, bloom: true, seeded: 2 },
    { seeded: 1 },
    { seeded: 2 },
    { rime: true },
    { snowed: true }
].map((flags, index) => ({ id: `mark-warmup-${index}`, pairKey: '', symbol: '', label: '', state: 'hidden' as const, ...flags }));

/**
 * Paints the countdown variants of the floor's initial marks before its first frame: Hourglass
 * sand and fuses down to zero, Turncoats at every element, frost thawing, locks coming off, both
 * faces. The asset-streaming e2e test caught an Hourglass drawing a canvas mid-play. Returns the
 * number of new canvases; uploads cached textures too, since a new renderer has its own GPU cache.
 */
export const prewarmRealmTileMarks = (tiles: readonly Tile[], upload?: (texture: CanvasTexture) => void): number => {
    let painted = 0;
    const seen = new Set<string>();
    const candidates = tiles.some(tile => tile.state !== 'matched' && tile.state !== 'removed')
        ? [...tiles, ...DYNAMIC_MARK_TILES] : tiles;
    for (const tile of candidates) {
        if (tile.state === 'matched' || tile.state === 'removed') continue;
        // A committed face-up card may turn back after a miss. Warming again (e.g. a quality
        // change) must retain the hidden-side marks it will need then too.
        const hidden = tile.state === 'hidden' ? tile : { ...tile, state: 'hidden' as const };
        const mark = cardStatusMark(hidden, false);
        const lockable = cardStatusMark(hidden, true)!;
        for (const base of mark ? [mark, lockable] : [lockable]) {
            const sands = Array.from({ length: (base.hourglass ?? 0) + 1 }, (_, index) => index);
            const fuses = Array.from({ length: base.fuse + 1 }, (_, index) => index);
            const suits = base.turncoat ? TURNCOAT_SUITS : [base.turncoat];
            const frosts = Array.from({ length: base.frost + 1 }, (_, index) => index);
            for (const hourglass of sands) for (const fuse of fuses) for (const turncoat of suits) for (const frost of frosts) {
                const variant: RealmTileMark = { ...base, frost, fuse, hourglass, ...(turncoat ? { turncoat } : {}) };
                if (!variant.frost && !variant.snowed && !variant.fuse && !variant.vined && !variant.rime && !variant.seeded && !variant.openingLocked && !variant.turncoat && !variant.hourglass) continue;
                for (const faceUp of [true, false]) {
                    const key = `${realmTileMarkKey(variant)}:${faceUp ? 'front' : 'back'}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const fresh = !textures.has(key);
                    const texture = realmTileMarkTexture(variant, faceUp);
                    if (fresh) {
                        painted += 1;
                    }
                    upload?.(texture);
                }
            }
        }
    }
    // Only this floor's reachable countdowns belong to the board. Without this, travelling through
    // realms accumulated every combination of frost, fuse, sand and locks for the whole session.
    for (const [key, texture] of textures) {
        if (seen.has(key)) continue;
        texture.dispose();
        textures.delete(key);
    }
    return painted;
};
