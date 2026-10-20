import type { BoardState, RunState } from './contracts';
import { parTurnsForRun } from './floor-par';
import { missesLeft, spendMiss } from './miss-bank';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
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
    if (run.status === 'playing' && isWardenRedealTurn(turns)) {
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
