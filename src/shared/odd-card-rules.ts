import type { BoardState, HourglassEvent, RunState, Tile, TileSuit } from './contracts';
import { colossusStands } from './colossus-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';
import { TILE_SUITS } from './tile-suit-rules';

/**
 * The odd cards (2026-10-07), dealt beside the Colossus: two pairs that are not like the others,
 * each of them a thing the board shows and the player times, never a thing to hold in the head.
 *
 *   - **The Turncoat** is a pair whose element turns every turn, match or miss. Both halves turn
 *     together and its back always shows what it is now, with a badge for what it will be next,
 *     so it is read, not remembered. While the realm has hold of it (burning, frozen, snowed
 *     over, bound) it does not turn. It turns only through elements another standing pair still
 *     holds. What it is when it is matched is what it counts as: for the pop, for a cast, and for
 *     a Colossus, which makes it the one pair a player can hold back for the element they need.
 *   - **The Hourglass** is a pair with a prize and a clock on its back. Matched (or burst) before
 *     the sand runs out, it pays gold and score. After that it is a pair like any other: nothing
 *     is taken, the prize is only gone.
 *
 * Both are dealt from the run's seed when the floor is, onto plain pairs only (no findable, no
 * trait, no ward, bounty or curse, nothing the realm is holding), and neither can hold a floor:
 * they are ordinary pairs to turn and to clear at every moment.
 */
export const ODD_CARD_RULES_FROM = 62;
export const TURNCOAT_FROM_FLOOR = 5;
export const HOURGLASS_FROM_FLOOR = 3;
/** Floors smaller than this have no pair to spare for one. */
export const ODD_CARD_MIN_PAIRS = 6;
export const HOURGLASS_GOLD = 3;
export const HOURGLASS_SCORE = 60;

/** Turns of sand: about a turn for every two pairs, never fewer than four or more than nine. */
export const hourglassTurnsForPairs = (pairCount: number): number => Math.min(9, Math.max(4, Math.ceil(pairCount / 2) + 1));

const isGone = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';
/** Burning, frozen, snowed over or bound: the realm's marks, each tied to the element of the card under it. */
export const isRealmHeld = (tile: Tile): boolean => Boolean(tile.frost || tile.fuse || tile.vined || tile.snowed);

const plainPairKeys = (board: BoardState): string[] => {
    const marked = new Set([board.cursedPairKey, board.wardPairKey, board.bountyPairKey]);
    const halves = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, [...(halves.get(tile.pairKey) ?? []), tile]);
    }
    return [...halves.entries()]
        .filter(
            ([pairKey, pair]) =>
                pair.length === 2 &&
                !marked.has(pairKey) &&
                pair.every(
                    (tile) =>
                        tile.state === 'hidden' &&
                        tile.suit != null &&
                        !tile.findableKind &&
                        !tile.tileTraitKind &&
                        !tile.frost &&
                        !tile.fuse &&
                        !tile.vined &&
                        !tile.snowed &&
                        tile.turncoat == null &&
                        tile.hourglass == null
                )
        )
        .map(([pairKey]) => pairKey);
};

/** The elements a Turncoat may turn to: those some other standing pair holds, and the one it is. */
const turncoatSuits = (tiles: readonly Tile[], own: TileSuit): TileSuit[] => {
    const held = new Set<TileSuit>([own]);
    for (const tile of tiles) {
        if (tile.suit && tile.turncoat == null && !isGone(tile) && !isSingletonUtilityPairKey(tile.pairKey)) held.add(tile.suit);
    }
    return TILE_SUITS.filter((suit) => held.has(suit));
};

/** What a Turncoat showing `own` turns to next: the element after it, in the catalogue's order, of those in play. */
export const turncoatNextSuit = (tiles: readonly Tile[], own: TileSuit): TileSuit => {
    const suits = turncoatSuits(tiles, own);
    return suits[(suits.indexOf(own) + 1) % suits.length]!;
};

/**
 * Deal the floor's odd cards, or leave the board as it is. Called once the floor's elements are
 * final. A floor a Colossus stands over always has a Turncoat (it is the fight's wild card); any
 * other has each on half its floors.
 */
export const dealOddCards = (board: BoardState, { runSeed, rulesVersion }: { runSeed: number; rulesVersion: number }): BoardState => {
    if (rulesVersion < ODD_CARD_RULES_FROM || board.pairCount < ODD_CARD_MIN_PAIRS) {
        return board;
    }
    const rng = createMulberry32(hashStringToSeed(`odd-cards:${runSeed}:${rulesVersion}:${board.level}`));
    // Both rolls are always made, so one card's presence never moves the other's.
    const turncoatRoll = rng();
    const hourglassRoll = rng();
    let tiles = board.tiles;
    const mark = (pairKey: string, edit: (tile: Tile) => Tile): void => {
        tiles = tiles.map((tile) => (tile.pairKey === pairKey ? edit(tile) : tile));
    };
    const suitsHeld = new Set(tiles.filter((tile) => tile.suit && !isSingletonUtilityPairKey(tile.pairKey)).map((tile) => tile.suit));
    if (board.level >= TURNCOAT_FROM_FLOOR && suitsHeld.size >= 2 && (colossusStands(board) || turncoatRoll < 0.5)) {
        const candidates = plainPairKeys({ ...board, tiles });
        if (candidates.length > 0) {
            const pairKey = candidates[pickRngIndex(rng, candidates.length)]!;
            const own = tiles.find((tile) => tile.pairKey === pairKey)!.suit!;
            // The next element is read off the board without this pair, so mark it first.
            mark(pairKey, (tile) => ({ ...tile, turncoat: own }));
            const next = turncoatNextSuit(tiles, own);
            mark(pairKey, (tile) => ({ ...tile, turncoat: next, turncoatDealt: own }));
        }
    }
    if (board.level >= HOURGLASS_FROM_FLOOR && hourglassRoll < 0.5) {
        const candidates = plainPairKeys({ ...board, tiles });
        if (candidates.length > 0) {
            const pairKey = candidates[pickRngIndex(rng, candidates.length)]!;
            const sand = hourglassTurnsForPairs(board.pairCount);
            mark(pairKey, (tile) => ({ ...tile, hourglass: sand }));
        }
    }
    return tiles === board.tiles ? board : { ...board, tiles };
};

export interface OddCardTurn {
    readonly board: BoardState;
    readonly event: HourglassEvent | null;
    readonly goldDelta: number;
    readonly scoreDelta: number;
    /** Turncoat pairs that turned this turn. */
    readonly turned: number;
}

/**
 * One turn for the odd cards, on the board the turn produced. An Hourglass that went this turn
 * with sand left pays; one still standing loses a turn of sand. Then every standing Turncoat
 * becomes what its badge promised, and its badge is set for the turn after.
 */
export const resolveOddCardTurn = ({ board, turnsThisFloor }: { board: BoardState; turnsThisFloor: number }): OddCardTurn => {
    if (!board.tiles.some((tile) => tile.turncoat != null || tile.hourglass != null)) {
        return { board, event: null, goldDelta: 0, scoreDelta: 0, turned: 0 };
    }
    let caught = 0;
    let spent = 0;
    const seen = new Set<string>();
    const once = (pairKey: string): boolean => (seen.has(pairKey) ? false : (seen.add(pairKey), true));
    let tiles: Tile[] = board.tiles.map((tile) => {
        if (tile.hourglass == null) return tile;
        const sand = runNonNegativeInteger(tile.hourglass);
        const { hourglass: _hourglass, ...plain } = tile;
        if (isGone(tile)) {
            if (sand > 0 && once(tile.pairKey)) caught += 1;
            return plain;
        }
        if (sand <= 1) {
            if (once(tile.pairKey)) spent += 1;
            return plain;
        }
        return { ...tile, hourglass: sand - 1 };
    });
    // Every Turncoat keeps its promise first; the next promises are then read off the turned board.
    // A Turncoat the realm has hold of does not turn: fire, ice, snow and vines each land only on
    // elements they can (`element-alchemy-rules.ts`), and a card turning under one would become a
    // thing the rules never make, a grove card in vines. It turns again, as promised, once free.
    const heldPairs = new Set(tiles.filter((tile) => tile.turncoat != null && isRealmHeld(tile)).map((tile) => tile.pairKey));
    const turnedPairs = new Set<string>();
    tiles = tiles.map((tile) => {
        if (tile.turncoat == null) return tile;
        if (isGone(tile)) {
            const { turncoat: _turncoat, turncoatDealt: _dealt, ...plain } = tile;
            return plain;
        }
        if (heldPairs.has(tile.pairKey)) return tile;
        if (tile.turncoat !== tile.suit) turnedPairs.add(tile.pairKey);
        return { ...tile, suit: tile.turncoat };
    });
    tiles = tiles.map((tile) => (tile.turncoat == null || !tile.suit ? tile : { ...tile, turncoat: turncoatNextSuit(tiles, tile.suit) }));
    const event: HourglassEvent | null =
        caught > 0
            ? { key: `hourglass:${board.level}:${turnsThisFloor}`, kind: 'caught', pairs: caught, gold: HOURGLASS_GOLD * caught, score: HOURGLASS_SCORE * caught }
            : spent > 0
              ? { key: `hourglass:${board.level}:${turnsThisFloor}`, kind: 'spent', pairs: spent, gold: 0, score: 0 }
              : null;
    return { board: { ...board, tiles }, event, goldDelta: HOURGLASS_GOLD * caught, scoreDelta: HOURGLASS_SCORE * caught, turned: turnedPairs.size };
};

/** The run fields an odd-card turn writes, merged over the run the seam built. */
export const applyOddCardTurnToRun = (run: RunState, turn: OddCardTurn): Partial<RunState> => {
    if (turn.board === run.board) {
        return {};
    }
    const stats = run.stats;
    return {
        board: turn.board,
        turncoatTurnsThisFloor: runNonNegativeInteger(run.turncoatTurnsThisFloor ?? 0) + turn.turned,
        ...(turn.event
            ? {
                  lastHourglassEvent: turn.event,
                  hourglassesCaughtThisRun: runNonNegativeInteger(run.hourglassesCaughtThisRun ?? 0) + (turn.event.kind === 'caught' ? turn.event.pairs : 0),
                  hourglassesSpentThisFloor: runNonNegativeInteger(run.hourglassesSpentThisFloor ?? 0) + (turn.event.kind === 'spent' ? turn.event.pairs : 0)
              }
            : {}),
        ...(turn.goldDelta > 0 ? { gold: runNonNegativeInteger(run.gold ?? 0) + turn.goldDelta } : {}),
        ...(turn.scoreDelta > 0
            ? {
                  stats: {
                      ...stats,
                      totalScore: runNonNegativeInteger(stats.totalScore) + turn.scoreDelta,
                      currentLevelScore: runNonNegativeInteger(stats.currentLevelScore) + turn.scoreDelta,
                      bestScore: Math.max(runNonNegativeInteger(stats.bestScore), runNonNegativeInteger(stats.totalScore) + turn.scoreDelta)
                  }
              }
            : {})
    };
};
