import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { descentActForFloor } from './floor-mutator-schedule';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { TILE_SUITS } from './tile-suit-rules';
import { freshBoardFaces } from './void-spew-rules';
import { releaseRealmHoldsIfStuck } from './realm-weather-rules';
import { contentFloor } from './descent-length-rules';

/**
 * Layers (DGE-017, 2026-10-20): the Deep's floors are dealt two decks deep.
 *
 * Under two cells in five lies a second card, face down and unseen - not at the study window, not
 * after it. When the card on top leaves its cell (matched, popped, bombed, melted), the card beneath
 * takes the cell, face down and unknown. The lower deck is its own pairs, in two elements only, so
 * the deepest chains of a run are dug out from under the board the player learned.
 *
 * The board stays one grid: `beneath[i]` is the card under cell `i`, or null. Promotion moves that
 * card into `tiles[i]` with the id it was dealt with, so nothing about the floor deals itself again,
 * and the renderer keys the floor on `layerKey`, every id both decks were dealt with. The cleared
 * card it rose over goes to `spent`, so its pair is still two cards to whatever counts them.
 *
 * A held card (`hold-rules.ts`) keeps its cell until the release: the cell is the release's seed.
 * The floor is complete only when nothing waits beneath (`isBoardComplete`), and the fairness
 * inspector counts both decks.
 */
export const LAYERS_RULES_FROM = 72;
/** From rules 74 Layers keep off the restless hall (DGE-032's third bar). */
export const LAYERS_APART_FROM = 74;
/** Of the cells, the share that hold a card beneath, rounded down to whole pairs: two in five keeps the Deep's longest floors under the curve's 24 turns (`sim-difficulty-curve.ts`). */
export const LAYERS_COVER = 0.4;
/** The Cartographer's floor (`cartographer-rules.ts`): one cell in four, so the boss keeps under the curve. */
export const LAYERS_CARTOGRAPHER_COVER = 0.25;

/**
 * Whether a floor is dealt two decks deep: the Deep's own floors, not its boss, not a Fold, and from rules 74 not
 * the restless hall - the Goldilocks probe (`sim-goldilocks.ts`) read a floor that hides a deck *and* swaps its
 * cards at 0.23 of it known, the least certain floor of the Deep.
 */
export const isLayersFloor = (board: Pick<BoardState, 'level' | 'descentFloor' | 'floorTag' | 'fold' | 'tiles' | 'floorArchetypeId'>, rulesVersion: number): boolean =>
    rulesVersion >= LAYERS_RULES_FROM &&
    descentActForFloor(contentFloor(board)).id === 'deep' &&
    // The Cartographer (`cartographer-rules.ts`) is the one boss floor dealt two decks deep (rules 82).
    (board.floorTag !== 'boss' || (rulesVersion >= 82 && board.floorArchetypeId === 'cartographer_hall')) &&
    !board.fold &&
    !(rulesVersion >= LAYERS_APART_FROM && board.floorArchetypeId === 'restless_hall') &&
    board.tiles.length >= 8;

/**
 * The key a dealt floor is known by, on both sides of the memorize handshake: the board's entrance
 * (`TileBoard.tsx`) and the study timer that waits for it (`runTimerController.ts`). A two-deck floor
 * keys on `layerKey`. The two once computed it apart, and every Layers floor's study never started.
 */
export const boardDealKey = (board: Pick<BoardState, 'level' | 'columns' | 'rows' | 'tiles' | 'layerKey'>): string =>
    `${board.level}|${board.columns}x${board.rows}|${board.layerKey ?? [...board.tiles].map((tile) => tile.id).sort().join('|')}`;

/** Every id the floor's two decks were dealt with: the renderer's key for the floor, which promotion never changes. */
export const layerKeyOf = (tiles: readonly Tile[], beneath: readonly (Tile | null)[]): string =>
    [...tiles.map((tile) => tile.id), ...beneath.flatMap((tile) => (tile ? [tile.id] : []))].sort().join('|');

/** Deals the lower deck under half the cells, from the run's seed. */
export const dealLayers = (board: BoardState, { runSeed, rulesVersion }: { runSeed: number; rulesVersion: number }): BoardState => {
    if (!isLayersFloor(board, rulesVersion)) return board;
    const rng = createMulberry32(hashStringToSeed(`layers:${runSeed}:${rulesVersion}:${board.level}`));
    const cells = board.tiles.flatMap((tile, index) => (isSingletonUtilityPairKey(tile.pairKey) ? [] : [index]));
    // The Cartographer's 22 pairs under two cells in five ran 25 turns, past the curve's 24 (`sim-difficulty-curve.ts`): its deck is thinner.
    const cover = board.floorArchetypeId === 'cartographer_hall' ? LAYERS_CARTOGRAPHER_COVER : LAYERS_COVER;
    const pairs = Math.floor((cells.length * cover) / 2);
    if (pairs === 0) return board;
    // The cells that hold a card beneath, and the two elements the lower deck is dealt in.
    const pool = [...cells];
    const covered: number[] = [];
    for (let n = 0; n < pairs * 2; n += 1) covered.push(pool.splice(pickRngIndex(rng, pool.length), 1)[0]!);
    const suits = [...TILE_SUITS];
    const palette: TileSuit[] = [suits.splice(pickRngIndex(rng, suits.length), 1)[0]!, suits.splice(pickRngIndex(rng, suits.length), 1)[0]!];
    const faces = freshBoardFaces(board.tiles, board.level);
    const beneath: (Tile | null)[] = board.tiles.map(() => null);
    for (let pair = 0; pair < pairs; pair += 1) {
        const pairKey = `${board.level}-deep-${pair}`;
        const face = faces[pair] ?? { symbol: `D${pair + 1}`, label: `Deep ${pair + 1}` };
        const suit = palette[pair % palette.length]!;
        const atomicVariant = atomicVariantForPairKey(pairKey);
        for (const half of [0, 1] as const) {
            const cell = covered.splice(pickRngIndex(rng, covered.length), 1)[0]!;
            beneath[cell] = { id: `${pairKey}-${half === 0 ? 'A' : 'B'}`, pairKey, state: 'hidden', symbol: face.symbol, label: face.label, atomicVariant, suit };
        }
    }
    return { ...board, beneath, pairCount: board.pairCount + pairs, layerKey: layerKeyOf(board.tiles, beneath) };
};

const isClearedCell = (tile: Tile | undefined): boolean => tile?.state === 'matched' || tile?.state === 'removed';

/** Cards waiting beneath, anywhere on the board. */
export const cardsBeneath = (board: Pick<BoardState, 'beneath'> | null | undefined): number => (board?.beneath ?? []).filter(Boolean).length;

/**
 * Every cleared cell with a card beneath takes it, face down; `keepIds` are cards that keep their
 * cell (the Hold's seeds). Returns the same board when nothing moved.
 */
export const promoteBeneath = (board: BoardState, keepIds: ReadonlySet<string> = new Set()): BoardState => {
    const under = board.beneath;
    if (!under || !under.some(Boolean)) return board;
    const tiles = [...board.tiles];
    const beneath = [...under];
    const spent: Tile[] = [];
    let changed = false;
    const rise = (card: Tile, into: number): void => {
        spent.push(tiles[into]!);
        tiles[into] = card;
        changed = true;
    };
    beneath.forEach((card, index) => {
        const top = tiles[index];
        if (!card || !isClearedCell(top) || keepIds.has(top!.id)) return;
        rise(card, index);
        beneath[index] = null;
    });
    /*
     * A floor can lock. Cards move after the deal (the restless floor, skittish cards, the Wanderers,
     * the void, the tide, the shuffles), so a card can come to sit over its own partner, or two over
     * each other's, and the Hold can keep a cell whose card beneath is the last one's partner. The
     * lock is always the same shape: no whole pair face down on the grid while cards wait beneath.
     * Then a waiting card whose partner is on the grid steps out into the nearest cleared cell with
     * nothing under it - there is always one, since a pair has been cleared - and the floor goes on.
     */
    const columns = Math.max(1, Math.floor(board.columns));
    const distance = (a: number, b: number): number => Math.abs((a % columns) - (b % columns)) + Math.abs(Math.floor(a / columns) - Math.floor(b / columns));
    const hiddenOnGrid = (): Map<string, number> => {
        const counts = new Map<string, number>();
        for (const tile of tiles) if (tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)) counts.set(tile.pairKey, (counts.get(tile.pairKey) ?? 0) + 1);
        return counts;
    };
    // Both halves can wait under held cells, so it lifts until a pair is face down or nothing is left to lift.
    for (let guard = beneath.length; guard > 0; guard -= 1) {
        const onGrid = hiddenOnGrid();
        if (!beneath.some(Boolean) || [...onGrid.values()].some((n) => n >= 2)) break;
        const waiting = beneath.findIndex((card) => card != null && onGrid.has(card.pairKey));
        const from = waiting >= 0 ? waiting : beneath.findIndex(Boolean);
        const open = tiles
            .map((tile, cell) => ({ tile, cell }))
            .filter(({ tile, cell }) => isClearedCell(tile) && beneath[cell] == null && !keepIds.has(tile.id))
            .sort((x, y) => distance(from, x.cell) - distance(from, y.cell) || x.cell - y.cell)[0];
        if (from < 0 || !open) break;
        rise(beneath[from]!, open.cell);
        beneath[from] = null;
    }
    if (!changed) return board;
    // What rose must still leave a pair that can be turned, as after any break (`realm-weather-rules.ts`).
    releaseRealmHoldsIfStuck(tiles);
    return { ...board, tiles, beneath, spent: [...(board.spent ?? []), ...spent] };
};

/** The run's board with every cleared cell refilled from beneath, the Hold's cells kept. */
export const promoteRunBeneath = (run: RunState): RunState => {
    if (!run.board?.beneath) return run;
    const before = cardsBeneath(run.board);
    const board = promoteBeneath(run.board, new Set(run.heldSeedIds ?? []));
    if (board === run.board) return run;
    return { ...run, board, layerCardsRisenThisFloor: runNonNegativeInteger(run.layerCardsRisenThisFloor) + before - cardsBeneath(board) };
};

/** Applied after every resolved turn, last but the Warden: the cells the turn cleared take what lay beneath them. */
export const applyLayerTurn = (_before: RunState, after: RunState): RunState =>
    after.status === 'playing' || after.status === 'resolving' ? promoteRunBeneath(after) : after;
