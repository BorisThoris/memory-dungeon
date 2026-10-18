import type { RunState, Tile, TileSuit } from './contracts';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { ELEMENT_NAMES, ELEMENT_NEUTRALIZES } from './element-alchemy-rules';
import { isRealmHeld } from './odd-card-rules';
import { releaseRealmHoldsIfStuck } from './realm-weather-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runFilteredStringArray } from './run-array-guards';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import { ALL_TILE_SYMBOLS_FOR_GALLERY, getSymbolSetForLevel } from './tile-symbol-catalog';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The Crucible (2026-10-18): an item that unmakes one element and pours it out as another.
 *
 * The owner asked for items "that neutralize/destroy some type but spawn different cards", with
 * pros and cons. Aimed like the bomb at the one face-up card: that card and its twin melt off the
 * board, no turn, miss or score, and every other face-down pair of the same element is recast in
 * the element it puts out (`ELEMENT_NEUTRALIZES`): new faces the floor has not shown, which then
 * trade places among themselves.
 *
 * The pro: a pair gone for nothing, and a board leaning toward another element (whose resonance
 * and casts the player may be building). The con: every card of that element the player had
 * memorised is now a stranger - they know which cells turned, never which two belong together.
 *
 * The floor stays finishable: it removes one pair (never the last) and swaps faces within whole
 * pairs, so `tiles.length` and `matchedPairs` keep their meaning. Cards a realm is holding (frost,
 * fuse, vines, snow) keep their element, as they do for the Turncoat.
 */
export const CRUCIBLE_SOURCE_ID = 'crucible';

/** The element a melted element is recast in. */
export const crucibleRecastSuit = (suit: TileSuit): TileSuit => ELEMENT_NEUTRALIZES[suit];

const livePairKeys = (tiles: readonly Tile[]): Set<string> =>
    new Set(
        tiles
            .filter((tile) => !isSingletonUtilityPairKey(tile.pairKey) && (tile.state === 'hidden' || tile.state === 'flipped'))
            .map((tile) => tile.pairKey)
    );

/** The face-up card the Crucible would melt, or null: one card up, its twin down, and not the floor's last pair. */
export const crucibleTargetTileId = (run: RunState): string | null => {
    if (run.status !== 'playing' || !run.board || runNonNegativeInteger(run.crucibleCharges) < 1) return null;
    const flipped = runFilteredStringArray(run.board.flippedTileIds);
    if (flipped.length !== 1) return null;
    const tile = run.board.tiles.find((candidate) => candidate.id === flipped[0]);
    if (!tile || tile.state !== 'flipped' || isSingletonUtilityPairKey(tile.pairKey)) return null;
    const partner = run.board.tiles.find((candidate) => candidate.pairKey === tile.pairKey && candidate.id !== tile.id);
    if (!partner || partner.state !== 'hidden') return null;
    return livePairKeys(run.board.tiles).size > 1 ? tile.id : null;
};

export interface CrucibleResult {
    readonly run: RunState;
    /** The melted pair's two cards. */
    readonly meltedTileIds: readonly string[];
    /** The cards recast in the new element, after they traded places. */
    readonly recastTileIds: readonly string[];
    readonly fromSuit: TileSuit | null;
    readonly toSuit: TileSuit | null;
}

/** Melt the face-up card's pair and recast its element; null when the Crucible cannot be used on `tileId`. */
export const applyCrucible = (run: RunState, tileId: string): CrucibleResult | null => {
    if (crucibleTargetTileId(run) !== tileId || !run.board) return null;
    const board = run.board;
    const target = board.tiles.find((candidate) => candidate.id === tileId)!;
    const fromSuit = target.suit ?? null;
    const toSuit = fromSuit ? crucibleRecastSuit(fromSuit) : null;
    const uses = runNonNegativeInteger(run.crucibleUsesThisRun);
    const rng = createMulberry32(hashStringToSeed(`crucible:${run.runSeed}:${run.runRulesVersion}:${board.level}:${uses}`));

    const meltedTileIds = board.tiles.filter((candidate) => candidate.pairKey === target.pairKey).map((candidate) => candidate.id);
    const tiles: Tile[] = board.tiles.map((candidate) =>
        meltedTileIds.includes(candidate.id)
            ? { ...candidate, state: 'removed' as const, findableKind: undefined, turncoat: undefined, hourglass: undefined }
            : candidate
    );

    // The rest of the element: whole pairs face down, neither card held by the realm.
    const cellsByPair = new Map<string, number[]>();
    if (fromSuit && toSuit) {
        tiles.forEach((tile, index) => {
            if (tile.state !== 'hidden' || tile.suit !== fromSuit || isSingletonUtilityPairKey(tile.pairKey)) return;
            cellsByPair.set(tile.pairKey, [...(cellsByPair.get(tile.pairKey) ?? []), index]);
        });
        for (const [key, cells] of [...cellsByPair]) {
            if (cells.length !== 2 || cells.some((cell) => isRealmHeld(tiles[cell]!))) cellsByPair.delete(key);
        }
    }

    // New faces: the floor's own symbol set first, then any face the board does not show.
    const shown = new Set(tiles.map((tile) => tile.symbol));
    const fresh = [...getSymbolSetForLevel(board.level), ...ALL_TILE_SYMBOLS_FOR_GALLERY].filter(
        (entry, index, list) => !shown.has(entry.symbol) && list.findIndex((other) => other.symbol === entry.symbol) === index
    );
    const recastCells: number[] = [];
    [...cellsByPair.values()].forEach((cells, slot) => {
        const face = fresh[slot] ?? { symbol: `C${slot + 1}`, label: `Recast ${slot + 1}` };
        const pairKey = `${board.level}-crucible-${uses}-${slot}`;
        const atomicVariant = atomicVariantForPairKey(pairKey);
        cells.forEach((cell) => {
            const old = tiles[cell]!;
            tiles[cell] = {
                // The card keeps its id: it is the same card, recast, so the board does not deal
                // itself again (`TileBoard`'s entrance key) and the card can glide to its new cell.
                id: old.id,
                pairKey,
                state: 'hidden',
                symbol: face.symbol,
                label: face.label,
                atomicVariant,
                suit: toSuit!,
                // What the card carried rides the recast; the element's own marks do not.
                ...(old.findableKind ? { findableKind: old.findableKind } : {}),
                ...(old.tileTraitKind ? { tileTraitKind: old.tileTraitKind } : {})
            };
            recastCells.push(cell);
        });
    });
    // The recast cards trade places among themselves: the player knows which cells turned, not which two pair.
    const order = recastCells.map((cell) => tiles[cell]!);
    for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = pickRngIndex(rng, index + 1);
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    recastCells.forEach((cell, slot) => {
        tiles[cell] = order[slot]!;
    });
    releaseRealmHoldsIfStuck(tiles);

    // Nothing shows a recast card's new face for free: a peek, a flash, the lantern's or the storm's light.
    const changed = new Set([...meltedTileIds, ...recastCells.map((cell) => tiles[cell]!.id)]);
    const keep = (ids: unknown): string[] => runFilteredStringArray(ids).filter((id) => !changed.has(id));
    return {
        run: {
            ...run,
            crucibleCharges: decrementRunCounter(run.crucibleCharges),
            crucibleUsesThisRun: uses + 1,
            powersUsedThisRun: true,
            pinnedTileIds: keep(run.pinnedTileIds),
            peekRevealedTileIds: keep(run.peekRevealedTileIds),
            flashPairRevealedTileIds: keep(run.flashPairRevealedTileIds),
            lanternLitTileIds: keep(run.lanternLitTileIds),
            ...(run.realmLitTileIds ? { realmLitTileIds: keep(run.realmLitTileIds) } : {}),
            board: {
                ...board,
                flippedTileIds: [],
                matchedPairs: runNonNegativeInteger(board.matchedPairs) + 1,
                tiles
            }
        },
        meltedTileIds,
        recastTileIds: recastCells.map((cell) => tiles[cell]!.id),
        fromSuit,
        toSuit
    };
};

/** What the Crucible did, in a line for the screen reader and the feedback stamp. */
export const crucibleFeedbackLine = (fromSuit: TileSuit | null, toSuit: TileSuit | null, recastPairs: number, left: number): string => {
    const spent = `${left} ${left === 1 ? 'crucible' : 'crucibles'} left`;
    if (!fromSuit || !toSuit || recastPairs === 0) return `The crucible melted that card and its twin; ${spent}.`;
    return `The crucible melted that pair and recast ${recastPairs} ${ELEMENT_NAMES[fromSuit]} ${recastPairs === 1 ? 'pair' : 'pairs'} as ${ELEMENT_NAMES[toSuit]}, new faces in new places; ${spent}.`;
};
