import { describe, expect, it } from 'vitest';
import type { RunState, Tile } from './contracts';
import { createNewRun, finishMemorizePhase } from './game';
import { inspectBoardFairness } from './board-inspection';
import { parTurnsForRun } from './floor-par';
import { missesLeft } from './miss-bank';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { applyWardenTurn, awaitsWardenChoice, descendIntoEndless, endRunAfterWardenClear, isWardenRedealTurn, wardenRedeal } from './warden-rules';

const wardenRun = (extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 6060 }));
    return { ...base, board: { ...base.board!, level: 60, floorArchetypeId: 'warden_hall' }, ...extra };
};

/** The run after one more turn: what the turn resolution hands the Warden. */
const turned = (run: RunState, extra: Partial<RunState> = {}): RunState => ({ ...run, turnsThisFloor: run.turnsThisFloor + 1, ...extra });

describe('the Warden (DGE-005)', () => {
    it('stands on floor 60, the Descent’s last, with no mutator moving cards beside it', () => {
        const entry = pickFloorScheduleEntry(6060, 69, 60, 'endless');
        expect(entry.floorArchetypeId).toBe('warden_hall');
        expect(entry.floorTag).toBe('boss');
        expect(entry.mutators.filter((id) => id !== 'distraction_channel')).toEqual([]);
    });

    it('takes a miss for every turn past par, matched or not, and nothing at or under par', () => {
        const run = wardenRun();
        const par = parTurnsForRun(run);
        const atPar = { ...run, turnsThisFloor: par - 1 };
        expect(missesLeft(applyWardenTurn(atPar, turned(atPar)))).toBe(missesLeft(run));
        const pastPar = { ...run, turnsThisFloor: par };
        const after = applyWardenTurn(pastPar, turned(pastPar));
        expect(missesLeft(after)).toBe((missesLeft(run) ?? 0) - 1);
        expect(after.status).toBe('playing');
    });

    it('ends the run when a turn past par finds the bank empty, and marks it as the Warden’s', () => {
        const run = wardenRun();
        const empty = { ...run, missBank: [], turnsThisFloor: parTurnsForRun(run) + 3 };
        const after = applyWardenTurn(empty, turned(empty));
        expect(after.status).toBe('gameOver');
        expect(after.runEndReason).toBe('miss_budget');
        expect(after.wardenOutcome).toBe('fell');
    });

    it('does not charge the turn that clears the floor: that turn is the win', () => {
        const run = wardenRun();
        const last = { ...run, turnsThisFloor: parTurnsForRun(run) + 2 };
        const after = applyWardenTurn(last, turned(last, { status: 'levelComplete' }));
        expect(missesLeft(after)).toBe(missesLeft(run));
    });

    it('re-deals the face-down cards on every fifth turn, keeping ids, pairs, pinned and face-up cards', () => {
        expect([1, 2, 3, 4, 5, 6, 10].map((turn) => isWardenRedealTurn(turn))).toEqual([false, false, false, false, true, false, true]);
        const run = wardenRun();
        const tiles = run.board!.tiles;
        // A matched pair stays put: its two cards, with the counter that says so.
        const up = tiles[0]!.id;
        const upPair = tiles[0]!.pairKey;
        const pinned = tiles.find((tile) => tile.pairKey !== upPair)!.id;
        const board = {
            ...run.board!,
            matchedPairs: 1,
            tiles: tiles.map((tile: Tile) => (tile.pairKey === upPair ? { ...tile, state: 'matched' as const } : tile))
        };
        const pinnedAt = board.tiles.findIndex((tile) => tile.id === pinned);
        let moved = false;
        for (let salt = 0; salt < 8; salt += 1) {
            const dealt = wardenRedeal(board, [pinned], `probe:${salt}`);
            expect(dealt.tiles.map((t) => t.id).sort()).toEqual(board.tiles.map((t) => t.id).sort());
            expect(dealt.tiles[0]!.id).toBe(up);
            expect(dealt.tiles[pinnedAt]!.id).toBe(pinned);
            expect(inspectBoardFairness(dealt).issues).toEqual([]);
            moved ||= dealt.tiles.some((tile, index) => tile.id !== board.tiles[index]!.id);
        }
        expect(moved, 'eight re-deals never moved a card').toBe(true);
        const before = { ...run, turnsThisFloor: 4 };
        const after = applyWardenTurn(before, turned(before));
        expect(after.wardenRedealsThisFloor).toBe(1);
    });

    it('leaves every other floor alone', () => {
        const base = finishMemorizePhase(createNewRun(0, { runSeed: 6060 }));
        const before = { ...base, turnsThisFloor: 40 };
        const after = turned(before);
        expect(applyWardenTurn(before, after)).toBe(after);
    });

    it('asks at the clear: the win ends the run, Endless carries the same run on (DGE-006)', () => {
        const cleared = wardenRun({ status: 'levelComplete', wardenOutcome: 'cleared' });
        expect(awaitsWardenChoice(cleared)).toBe(true);
        const endless = descendIntoEndless(cleared);
        expect(endless.endless).toBe(true);
        expect(awaitsWardenChoice(endless)).toBe(false);
        // An Endless run's Warden is a boss like any other: clearing it does not end the run.
        expect(endRunAfterWardenClear(endless)).toBe(endless);
        expect(descendIntoEndless(wardenRun())).toEqual(wardenRun());
    });

    it('wins the run once the cleared Warden is continued from, and nothing else does', () => {
        const run = wardenRun({ status: 'levelComplete', wardenOutcome: 'cleared' });
        expect(endRunAfterWardenClear(run)).toMatchObject({ status: 'gameOver', runEndReason: 'warden_cleared' });
        const other = { ...run, wardenOutcome: null };
        expect(endRunAfterWardenClear(other)).toBe(other);
    });
});
