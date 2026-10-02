/** What a realm has left on one card, as the board draws it (`RealmTileMarks.tsx`). */
export interface RealmTileMark {
    frost: number;
    snowed: boolean;
    fuse: number;
    vined: boolean;
    bloom: boolean;
    rime?: boolean;
    seeded?: number;
}

/** The cache key for a mark's painted texture: two cards with the same marks share one canvas. */
export const realmTileMarkKey = (mark: RealmTileMark): string =>
    `f${mark.frost}:s${mark.snowed ? 1 : 0}:b${mark.fuse}:v${mark.vined ? 1 : 0}${mark.bloom ? 'B' : ''}${mark.rime ? ':r' : ''}${mark.seeded ? ':seed' + mark.seeded : ''}`;
