import type { BoardState, Tile, TileSuit } from './contracts';
import { COMBO_HEAT_STAGE_FROM } from './combo-heat-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { ALL_TILE_SYMBOLS_FOR_GALLERY, getSymbolSetForLevel } from './tile-symbol-catalog';
import { isSingletonUtilityPairKey } from './tile-identity';
import { TILE_SUITS } from './tile-suit-rules';

/**
 * The void spews (2026-10-01): the black hole stops being scenery.
 *
 * A miss that kills a combo of Inferno or better already collapsed the room into the void plate
 * (`sceneMood.ts`); the board never heard it. Now the void spits **new cards** onto the board and
 * **reshuffles all of it**: in the cells of pairs already cleared it lays brand-new pairs - new
 * faces the floor has not shown, face down - one, plus one for every ten links over sixteen,
 * three at most; then every face-down card on the board trades places, pinned ones included (a
 * pin follows its card). The streak lost takes what the player knew with it, and leaves more to
 * find. The board shows it: every card glides to its new cell (`tileCellGlide.ts`) while the room
 * lurches violet.
 *
 * The floor stays finishable: the void only adds pairs and moves face-down cards, it never takes a
 * pair or turns a card. `matchedPairs` drops by the pairs whose cells were reused, so it still
 * counts exactly the pairs gone from the board.
 */
export const VOID_SPEW_FROM = COMBO_HEAT_STAGE_FROM.inferno;
export const VOID_SPEW_MAX_PAIRS = 3;

/** New pairs the void spits for a combo of `combo` lost: one, plus one per ten links over the threshold. */
export const voidSpewPairs = (combo: number): number =>
    combo < VOID_SPEW_FROM ? 0 : Math.min(VOID_SPEW_MAX_PAIRS, 1 + Math.floor((combo - VOID_SPEW_FROM) / 10));

export interface VoidSpew {
    readonly board: BoardState;
    /** The new pairs' keys. */
    readonly newPairKeys: readonly string[];
}

const isGoneTile = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

/**
 * What the void does to the board a miss left, or null when the miss did not open it. Seeded by the
 * run, the floor and the miss count, so a replay spits the same cards into the same cells.
 */
export const resolveVoidSpew = ({
    board,
    comboLost,
    runSeed,
    rulesVersion,
    mismatchCount
}: {
    board: BoardState;
    comboLost: number;
    runSeed: number;
    rulesVersion: number;
    mismatchCount: number;
}): VoidSpew | null => {
    const want = voidSpewPairs(comboLost);
    if (want === 0) return null;
    const rng = createMulberry32(hashStringToSeed(`void-spew:${runSeed}:${rulesVersion}:${board.level}:${mismatchCount}`));
    // Cells to reuse: whole pairs gone from the board, pop casualties first (they were never earned).
    const goneByPair = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        if (!isGoneTile(tile) || isSingletonUtilityPairKey(tile.pairKey)) return;
        goneByPair.set(tile.pairKey, [...(goneByPair.get(tile.pairKey) ?? []), index]);
    });
    const goneKeys = [...goneByPair.entries()].filter(([, cells]) => cells.length === 2).map(([key]) => key);
    const popped = goneKeys.filter((key) => board.tiles[goneByPair.get(key)![0]!]!.brokenByChunk === true);
    const pool = [...popped, ...goneKeys.filter((key) => !popped.includes(key))];
    const reuse = pool.slice(0, want);
    if (reuse.length === 0) return null;
    // New faces: the floor's own symbol set first, then any face the board does not show.
    const shown = new Set(board.tiles.map((tile) => tile.symbol));
    const fresh = [...getSymbolSetForLevel(board.level), ...ALL_TILE_SYMBOLS_FOR_GALLERY].filter(
        (entry, index, list) => !shown.has(entry.symbol) && list.findIndex((other) => other.symbol === entry.symbol) === index
    );
    const tiles = [...board.tiles];
    const newPairKeys: string[] = [];
    reuse.forEach((oldKey, slot) => {
        const face = fresh[slot] ?? { symbol: `V${slot + 1}`, label: `Void ${slot + 1}` };
        const pairKey = `${board.level}-void-${mismatchCount}-${slot}`;
        const suit: TileSuit = TILE_SUITS[pickRngIndex(rng, TILE_SUITS.length)]!;
        const atomicVariant = atomicVariantForPairKey(pairKey);
        goneByPair.get(oldKey)!.forEach((cell, half) => {
            tiles[cell] = {
                id: `${pairKey}-${half === 0 ? 'A' : 'B'}`,
                pairKey,
                state: 'hidden',
                symbol: face.symbol,
                label: face.label,
                atomicVariant,
                suit
            };
        });
        newPairKeys.push(pairKey);
    });
    // The whole board reshuffles: every face-down card trades places, pinned ones too.
    const movable = tiles.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));
    const order = movable.map(({ tile }) => tile);
    for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = pickRngIndex(rng, index + 1);
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    movable.forEach(({ index }, slot) => {
        tiles[index] = order[slot]!;
    });
    return {
        board: { ...board, tiles, matchedPairs: Math.max(0, board.matchedPairs - newPairKeys.length) },
        newPairKeys
    };
};
