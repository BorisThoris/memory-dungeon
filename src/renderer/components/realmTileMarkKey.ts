import type { Tile } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/** Gameplay state shared by detailed cards and the distant-card atlas. */
export interface RealmTileMark {
    frost: number;
    snowed: boolean;
    fuse: number;
    vined: boolean;
    bloom: boolean;
    rime?: boolean;
    seeded?: number;
    openingLocked?: boolean;
}

export const cardStatusMark = (tile: Tile, openingLocked = false): RealmTileMark | null => {
    if (tile.state !== 'hidden') return null;
    const mark: RealmTileMark = {
        frost: runNonNegativeInteger(tile.frost),
        snowed: tile.snowed === true,
        fuse: runNonNegativeInteger(tile.fuse),
        vined: tile.vined === true,
        bloom: tile.vined === true && tile.bloom === true,
        rime: tile.rime === true,
        seeded: Math.min(2, runNonNegativeInteger(tile.seeded)),
        openingLocked
    };
    return mark.frost || mark.snowed || mark.fuse || mark.vined || mark.rime || mark.seeded || openingLocked ? mark : null;
};

export const cardStatusBlocksTurning = (mark: RealmTileMark | null): boolean =>
    Boolean(mark && (mark.frost > 0 || mark.vined || mark.openingLocked));

/** The cache key for a mark's painted texture: two cards with the same marks share one canvas. */
export const realmTileMarkKey = (mark: RealmTileMark): string =>
    `f${mark.frost}:s${mark.snowed ? 1 : 0}:b${mark.fuse}:v${mark.vined ? 1 : 0}${mark.bloom ? 'B' : ''}${mark.rime ? ':r' : ''}${mark.seeded ? ':seed' + mark.seeded : ''}${mark.openingLocked ? ':locked' : ''}`;
