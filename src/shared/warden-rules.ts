import type { BoardState, RunState } from './contracts';
import { parTurnsForRun } from './floor-par';
import { missesLeft, spendMiss } from './miss-bank';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { atomicVariantForPairKey } from './board-tile-generation-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
import { TILE_SUITS } from './tile-suit-rules';
import { freshBoardFaces } from './void-spew-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { clearResolveState } from './run-timer-rules';

/**
 * The Warden (DGE-005, 2026-10-20): the Descent's designed end, on floor 60.
 *
 * Two rules, stated before the first flip:
 * - Every turn past par takes one miss from the bank, matched or not. A turn that is owed a miss
 *   with the bank already empty ends the run, the way a miss on an empty bank always has.
 * - Every fifth turn the face-down cards are dealt again among their own cells. Pinned cards stay
 *   where they are, and so does everything face up. The cards keep their ids and their pairs, so the
 *   board can always be finished.
 *
 * Clearing the floor wins the run (`wardenOutcome: 'cleared'`): the player chooses at the clear to
 * take the win (the store ends it with `runEndReason: 'warden_cleared'`) or to descend into Endless
 * (`descendIntoEndless`, DGE-006), where each cycle's Warden is just a boss; falling on it is the run's designed death
 * (`wardenOutcome: 'fell'`). The rules live on the floor's archetype, `warden_hall`, so the Warden
 * moves no card with a mutator in the same turn. The full Warden, with the Hold, is DGE-023.
 */
export const WARDEN_REDEAL_EVERY_TURNS = 5;

/**
 * The complete Warden (DGE-023, rules 78): a test of a planned build. Met behind the wild or raging door
 * (`boss-reward-rules.ts`), it falls only to a Hold released at `WARDEN_FELL_PAIRS` pairs or more
 * (`hold-rules.ts`): that release is the win, pairs left or not. While a Hold is held the re-deal waits.
 * A board cleared without it does not end the floor: the Warden deals `WARDEN_DEAL_AGAIN_PAIRS` fresh pairs
 * into the cleared cells, and the floor goes on until the Warden falls or the past-par drain ends the run.
 * Behind the calm door it is the first Warden: clearing the board wins (the owner, 2026-10-21).
 */
export const WARDEN_TEST_FROM = 78;
export const WARDEN_FELL_PAIRS = 12;
export const WARDEN_DEAL_AGAIN_PAIRS = 6;

/** Whether this Warden is the test: rules 78, its floor, met behind the wild or raging door. */
export const wardenTestHolds = (run: Pick<RunState, 'runRulesVersion' | 'realmSeverity' | 'board'>): boolean =>
    (run.runRulesVersion ?? 0) >= WARDEN_TEST_FROM && isWardenFloor(run.board) && (run.realmSeverity === 'wild' || run.realmSeverity === 'raging');

/** Whether a release of this many held pairs fells the Warden. */
export const wardenFellsTo = (run: Pick<RunState, 'runRulesVersion' | 'realmSeverity' | 'board'>, heldPairs: number): boolean =>
    wardenTestHolds(run) && heldPairs >= WARDEN_FELL_PAIRS;

/** The Warden deals again: fresh pairs, faces the floor has not shown, into the cells of whole pairs cleared. */
export const wardenDealsAgain = (board: BoardState, seed: string): BoardState => {
    const rng = createMulberry32(hashStringToSeed(seed));
    const goneByPair = new Map<string, number[]>();
    board.tiles.forEach((tile, index) => {
        if ((tile.state !== 'matched' && tile.state !== 'removed') || isSingletonUtilityPairKey(tile.pairKey)) return;
        goneByPair.set(tile.pairKey, [...(goneByPair.get(tile.pairKey) ?? []), index]);
    });
    const cells = shuffleWithRng(rng, [...goneByPair.values()].filter((pair) => pair.length === 2)).slice(0, WARDEN_DEAL_AGAIN_PAIRS);
    if (cells.length === 0) return board;
    const faces = freshBoardFaces(board.tiles, board.level);
    const tiles = [...board.tiles];
    cells.forEach((pair, slot) => {
        const face = faces[slot] ?? { symbol: `W${slot + 1}`, label: `Warden ${slot + 1}` };
        const pairKey = `${board.level}-warden-${seed.length}-${slot}-${pickRngIndex(rng, 1_000_000)}`;
        const suit = TILE_SUITS[pickRngIndex(rng, TILE_SUITS.length)]!;
        pair.forEach((cell, half) => {
            tiles[cell] = { id: `${pairKey}-${half === 0 ? 'A' : 'B'}`, pairKey, state: 'hidden', symbol: face.symbol, label: face.label, atomicVariant: atomicVariantForPairKey(pairKey), suit };
        });
    });
    return { ...board, tiles, matchedPairs: Math.max(0, board.matchedPairs - cells.length) };
};

export const isWardenFloor = (board: Pick<BoardState, 'floorArchetypeId'> | null | undefined): boolean =>
    board?.floorArchetypeId === 'warden_hall';

/** Whether this many turns into the floor is a re-deal turn. */
export const isWardenRedealTurn = (turnsThisFloor: number): boolean => {
    const turns = runNonNegativeInteger(turnsThisFloor);
    return turns > 0 && turns % WARDEN_REDEAL_EVERY_TURNS === 0;
};

/** The face-down, unpinned cards dealt again among their own cells. Ids, pairs and every other card stay. */
export const wardenRedeal = (board: BoardState, pinnedTileIds: readonly string[], seed: string): BoardState => {
    const pinned = new Set(pinnedTileIds);
    const cells = board.tiles.flatMap((tile, index) => (tile.state === 'hidden' && !pinned.has(tile.id) ? [index] : []));
    if (cells.length < 2) return board;
    const dealt = shuffleWithRng(createMulberry32(hashStringToSeed(seed)), cells.map((index) => board.tiles[index]!));
    const tiles = [...board.tiles];
    cells.forEach((index, at) => {
        tiles[index] = dealt[at]!;
    });
    return { ...board, tiles };
};

/**
 * Applied after every resolved turn, after the miss bank has taken what a miss costs. Charges the
 * turn past par, re-deals on every fifth turn, and marks the run when it ends on the Warden's floor.
 */
export const applyWardenTurn = (before: RunState, after: RunState): RunState => {
    if (!isWardenFloor(after.board) || !after.board) return after;
    const turns = runNonNegativeInteger(after.turnsThisFloor);
    if (turns <= runNonNegativeInteger(before.turnsThisFloor)) return after;
    let run = after;
    // The turn that clears the floor is the win: it is not charged.
    if (run.status === 'playing' && turns > parTurnsForRun(run) && run.missBank != null) {
        const left = missesLeft(run) ?? 0;
        run =
            left > 0
                ? { ...run, missBank: spendMiss(run.missBank!), missesSpentThisRun: runNonNegativeInteger(run.missesSpentThisRun) + 1 }
                : {
                      ...run,
                      status: 'gameOver',
                      runEndReason: 'miss_budget',
                      board: { ...run.board!, flippedTileIds: [] },
                      timerState: clearResolveState(run)
                  };
    }
    // The complete Warden waits while a Hold is held (DGE-023): the stack is the planned build it tests.
    if (run.status === 'playing' && isWardenRedealTurn(turns) && !((run.runRulesVersion ?? 0) >= WARDEN_TEST_FROM && run.holding)) {
        const seed = `warden:${Math.floor(run.runSeed)}:${run.runRulesVersion}:${run.board!.level}:${turns}`;
        run = {
            ...run,
            board: wardenRedeal(run.board!, run.pinnedTileIds ?? [], seed),
            wardenRedealsThisFloor: runNonNegativeInteger(run.wardenRedealsThisFloor) + 1
        };
    }
    return run.status === 'gameOver' ? { ...run, wardenOutcome: 'fell' } : run;
};

/** A cleared Warden ends the run as a win: the store calls this where a shared game's last floor ends it. */
export const endRunAfterWardenClear = (run: RunState): RunState =>
    run.status === 'levelComplete' && run.wardenOutcome === 'cleared' && !run.endless ? { ...run, status: 'gameOver', runEndReason: 'warden_cleared' } : run;

/** Whether the cleared floor is the Warden's and the player still has to choose: take the win, or go on into Endless. */
export const awaitsWardenChoice = (run: Pick<RunState, 'status' | 'wardenOutcome' | 'endless'>): boolean =>
    run.status === 'levelComplete' && run.wardenOutcome === 'cleared' && !run.endless;

/** The player goes on: the same run descends into Endless (DGE-006) and is recorded when it ends. */
export const descendIntoEndless = (run: RunState): RunState => (awaitsWardenChoice(run) ? { ...run, endless: true } : run);
