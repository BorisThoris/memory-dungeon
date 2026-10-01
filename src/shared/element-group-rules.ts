import type { RealmEvent, RealmId, Tile, TileSuit } from './contracts';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { runNonNegativeInteger } from './run-number-guards';
import { SUIT_REALM } from './realm-sway-rules';
import { createAlchemyLog, elementLands, elementWouldLand, type AlchemyLog } from './element-alchemy-rules';

/**
 * Elemental groups (2026-10-01): the suits are the elements, and a matched group casts its element
 * on the board.
 *
 * The owner, after the realms' weather and their screen and card effects had shipped: "All cards
 * currently have effects/groups on them. You are further adding an elemental system on top of that,
 * that triggers the effect. The effects need to trigger from the base cards and their groups. Their
 * groups should be made the elements." So the four suits every card already carries are the four
 * elements (ember is Fire, tide is Water, moss is Grove, bone is Frost), and a match is a cast: the
 * matched pair and every pair its pop took (one suit, so one element) act on the face-down cards
 * around them.
 *
 * - **Fire** scorches: vines burn off, ice melts, snow is gone. It pays nothing (a harvest pays
 *   because the player's match cut the vine; a fire is the element doing it).
 * - **Water** washes: fires are put out, and the cards it reaches drift one place along.
 * - **Frost** freezes: a fire it reaches dies, and a popped group freezes the nearest card it
 *   reaches for a turn.
 * - **Grove** entangles: a popped group holds the nearest card it reaches in vines.
 *
 * Reach is counted in steps from every card of the group, so a bigger pop reaches further by having
 * more cards: two steps, three when the floor is in the element's own realm. Every match already
 * thaws and cuts what is right beside it (`realm-weather-rules.ts` step 2), so an element starts
 * where that ends. Only a group the pop made (two pairs or more) holds a card, one a cast
 * (`ELEMENT_HOLD_CAP_GROUP`): measured 2026-10-01 with the soak, two holds a cast and two-turn
 * frost cut the average player’s run from 8.9 floors to 5.6; holds on popped groups only, one
 * card, one turn of frost, cost 8.9 to 8.1 and the careful player nothing. The realm’s guard
 * still frees holds that would leave no pair to turn. Water moves at most
 * `ELEMENT_WASH_CAP`, never a pinned card.
 *
 * Every card the cast would act on answers first (`element-alchemy-rules.ts`): a card of the
 * cast's own element drinks it and is empowered, a card of the element that puts it out is left
 * as it was, and a hold spent on either holds nothing.
 */

export type ElementCastKind = Extract<RealmEvent['kind'], 'scorch' | 'wash' | 'freeze' | 'entangle'>;

export const ELEMENT_CAST_KIND: Readonly<Record<TileSuit, ElementCastKind>> = {
    ember: 'scorch',
    tide: 'wash',
    bone: 'freeze',
    moss: 'entangle'
};

export const ELEMENT_REACH = 2;
export const ELEMENT_REACH_IN_OWN_REALM = 3;
export const ELEMENT_HOLD_CAP = 0;
export const ELEMENT_HOLD_CAP_GROUP = 1;
export const ELEMENT_WASH_CAP = 6;
export const ELEMENT_FREEZE_TURNS = 1;

const isReal = (tile: Tile): boolean => !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);

/** Face-down real cards within `reach` steps of any of `from`, nearest first, never one of `from`. */
export const cardsWithinReach = (tiles: readonly Tile[], columns: number, from: readonly number[], reach: number): number[] => {
    const seen = new Map<number, number>();
    for (const index of from) seen.set(index, 0);
    let frontier = [...from];
    for (let step = 1; step <= reach; step += 1) {
        const next: number[] = [];
        for (const index of frontier) {
            for (const near of orthogonalNeighbourIndices(index, columns, tiles.length)) {
                if (seen.has(near)) continue;
                seen.set(near, step);
                next.push(near);
            }
        }
        frontier = next;
    }
    return [...seen.entries()]
        .filter(([index, step]) => step > 0 && tiles[index]?.state === 'hidden' && isReal(tiles[index]!))
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
        .map(([index]) => index);
};

export interface ElementCast {
    kind: ElementCastKind;
    suit: TileSuit;
    /** The group that cast it (for the bursts), and the cards it changed or moved. */
    groupTileIds: string[];
    touchedTileIds: string[];
}

/**
 * Cast the element of a matched group on `tiles` (mutated in place, like the realm's other steps).
 * `groupTileIds` are the matched pair and the cards its pop took; their suit is the element.
 * Returns null when the group has no element (the joker, a singleton, a card with no suit).
 */
export const castElement = ({
    tiles,
    columns,
    groupTileIds,
    realmId,
    pinned,
    alchemy = createAlchemyLog()
}: {
    tiles: Tile[];
    columns: number;
    groupTileIds: readonly string[];
    realmId: RealmId | null;
    pinned: ReadonlySet<string>;
    alchemy?: AlchemyLog;
}): ElementCast | null => {
    const group = groupTileIds.map((id) => tiles.findIndex((tile) => tile.id === id)).filter((index) => index >= 0);
    const suit = group.map((index) => tiles[index]!).find((tile) => tile.suit && isReal(tile))?.suit;
    if (!suit) return null;
    const kind = ELEMENT_CAST_KIND[suit];
    const reach = SUIT_REALM[suit] === realmId ? ELEMENT_REACH_IN_OWN_REALM : ELEMENT_REACH;
    const reached = cardsWithinReach(tiles, Math.max(1, columns), group, reach);
    const groupPairs = new Set(group.map((index) => tiles[index]!.pairKey)).size;
    const holdCap = groupPairs >= 2 ? ELEMENT_HOLD_CAP_GROUP : ELEMENT_HOLD_CAP;
    const touched: string[] = [];
    switch (kind) {
        case 'scorch':
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.vined == null && tile.frost == null && tile.snowed == null && tile.bloom == null) continue;
                if (!elementLands(tiles, index, suit, alchemy)) continue;
                const { vined: _v, bloom: _b, frost: _f, snowed: _s, ...rest } = tile;
                tiles[index] = rest;
                touched.push(tile.id);
            }
            break;
        case 'wash': {
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.fuse == null || !elementLands(tiles, index, suit, alchemy)) continue;
                const { fuse: _fuse, ...rest } = tiles[index]!;
                tiles[index] = rest;
                touched.push(tile.id);
            }
            const carried = reached.filter((index) => !pinned.has(tiles[index]!.id)).slice(0, ELEMENT_WASH_CAP);
            // Water and grove cards are not carried: the water flows around them.
            const movable = carried.filter((index) => elementWouldLand(tiles[index]!, suit));
            if (movable.length >= 2) {
                for (const index of carried) if (!movable.includes(index)) elementLands(tiles, index, suit, alchemy);
                const moved = movable.map((index) => tiles[index]!);
                movable.forEach((index, at) => {
                    tiles[index] = moved[(at - 1 + moved.length) % moved.length]!;
                });
                for (const tile of moved) if (!touched.includes(tile.id)) touched.push(tile.id);
            }
            break;
        }
        case 'freeze': {
            let held = 0;
            for (const index of reached) {
                const tile = tiles[index]!;
                if (tile.fuse != null && elementLands(tiles, index, suit, alchemy)) {
                    const { fuse: _fuse, ...rest } = tiles[index]!;
                    tiles[index] = rest;
                    touched.push(tile.id);
                }
                if (held >= holdCap || runNonNegativeInteger(tiles[index]!.frost ?? 0) > 0) continue;
                // The hold is spent on the nearest card, whether it freezes or answers.
                held += 1;
                if (!elementLands(tiles, index, suit, alchemy)) continue;
                tiles[index] = { ...tiles[index]!, frost: ELEMENT_FREEZE_TURNS };
                if (!touched.includes(tile.id)) touched.push(tile.id);
            }
            break;
        }
        case 'entangle': {
            let held = 0;
            for (const index of reached) {
                const tile = tiles[index]!;
                if (held >= holdCap) break;
                if (tile.vined === true || pinned.has(tile.id)) continue;
                held += 1;
                if (!elementLands(tiles, index, suit, alchemy)) continue;
                tiles[index] = { ...tiles[index]!, vined: true };
                touched.push(tile.id);
            }
            break;
        }
    }
    return { kind, suit, groupTileIds: group.map((index) => tiles[index]!.id), touchedTileIds: touched };
};
