import type { StoreItemId } from '../../shared/run-store-rules';

/**
 * Where each thing for sale sits in the merchant's vault (`bg-gameplay-shop-v1`), as fractions
 * of the plate, so a hotspot is on its object at any viewport. The store used to be a sheet of
 * rows; now it is the room, and the things in the painting are the things you buy:
 *
 *   the coins on the counter      another miss     (gold buys the bank one more)
 *   the cyan crystal              a peek           (it shows what is hidden)
 *   the scales                    a shuffle        (the board weighed again)
 *   the brass bell                a bomb           (rung, it takes a pair)
 *   the lower-left scroll         Deep Pockets     (the ledger of a bigger bank)
 *   the upper-right bottles       Gilded Chain     (gold in a bottle)
 *   the left lantern              Long Look        (a longer light to study by)
 *   the right lantern             Tallow Candle    (the flame that lights the cards beside a match)
 *   the trapdoor in the floor     Descend
 *
 * Buys sit above the trapdoor on purpose: a pad's d-pad walks up from Descend into them, the
 * way it walked up the sheet's rows.
 */
export interface StoreHotspot {
    id: StoreItemId | 'descend';
    /** Centre, as fractions of the plate's width and height. */
    x: number;
    y: number;
    /** Ring radius as a fraction of the plate's width. */
    r: number;
    /** What the object is, for the ring's label under the name. */
    object: string;
}

export const STORE_VAULT_ASPECT = 1376 / 768;

export const STORE_HOTSPOTS: readonly StoreHotspot[] = [
    { id: 'miss', x: 0.395, y: 0.52, r: 0.028, object: 'the coins' },
    { id: 'peek', x: 0.607, y: 0.47, r: 0.026, object: 'the crystal' },
    { id: 'shuffle', x: 0.497, y: 0.42, r: 0.036, object: 'the scales' },
    { id: 'bomb', x: 0.343, y: 0.49, r: 0.022, object: 'the bell' },
    { id: 'deep_pockets', x: 0.115, y: 0.575, r: 0.036, object: 'the ledger' },
    { id: 'gilded_chain', x: 0.885, y: 0.285, r: 0.036, object: 'the bottles' },
    { id: 'long_look', x: 0.345, y: 0.265, r: 0.026, object: 'the left lantern' },
    { id: 'tallow_candle', x: 0.653, y: 0.265, r: 0.026, object: 'the right lantern' },
    { id: 'descend', x: 0.5, y: 0.86, r: 0.042, object: 'the trapdoor' }
];

export const storeHotspot = (id: StoreHotspot['id']): StoreHotspot => STORE_HOTSPOTS.find((spot) => spot.id === id)!;
