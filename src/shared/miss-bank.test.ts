import { describe, expect, it } from 'vitest';

import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import {
    carryMissBank,
    comboMissesEarned,
    grantMisses,
    MISS_BANK_CAP,
    MISS_BANK_COMBO_RUNG,
    MISS_BANK_FLOOR_GRANT,
    MISS_BANK_LIFETIME_FLOORS,
    MISS_BANK_OPENING,
    missBankGrantLastFloor,
    missBankOnFloor,
    missBankSoonestToGo,
    missesLeft,
    spendMiss
} from './miss-bank';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { makeRun, makeTile } from './test/game-fixtures';

/*
 * The miss bank (`miss-bank.ts`): the run's budget for being wrong, in misses - earned by floors
 * and chains, each grant good for three floors. These walk the game's own turn path and floor
 * transition, so the count is what a player would be handed.
 */
describe('the miss bank', () => {
    const twoPairRun = (): RunState =>
        makeRun([makeTile('a-1', 'a', 'A'), makeTile('a-2', 'a', 'A'), makeTile('b-1', 'b', 'B'), makeTile('b-2', 'b', 'B')]);
    const play = (run: RunState, first: string, second: string): RunState =>
        resolveBoardTurn(flipTile(flipTile(run, first), second));
    const miss = (run: RunState): RunState => play(run, 'a-1', 'b-1');
    const onFloor = (floor: number, misses: number) => [{ floor, misses }];

    it('opens a run with the opening budget, earned on floor 1, and sizes it as the player asked', () => {
        const fresh = createNewRun(0, { runSeed: 4242, gameMode: 'endless' });
        expect(missesLeft(fresh)).toBe(MISS_BANK_OPENING);
        expect(fresh.missBank).toEqual(onFloor(1, MISS_BANK_OPENING));
        expect(MISS_BANK_OPENING).toBe(3);
        expect(MISS_BANK_FLOOR_GRANT).toBe(1);
        expect(MISS_BANK_COMBO_RUNG).toBe(5);
        expect(MISS_BANK_LIFETIME_FLOORS).toBe(3);
        expect(MISS_BANK_CAP).toBe(4);
    });

    it('spends one per miss, and ends the run on the miss after the last', () => {
        let run: RunState = { ...twoPairRun(), missBank: onFloor(1, MISS_BANK_OPENING) };
        for (let spent = 1; spent <= MISS_BANK_OPENING; spent += 1) {
            run = miss(run);
            expect(run.status, `miss ${spent}`).toBe('playing');
            expect(run.runEndReason).toBeNull();
            expect(missesLeft(run)).toBe(MISS_BANK_OPENING - spent);
        }
        expect(missesLeft(run)).toBe(0);

        const ended = miss(run);
        expect(ended.status).toBe('gameOver');
        expect(ended.runEndReason).toBe('miss_budget');
        expect(ended.board?.flippedTileIds).toEqual([]);
        expect(ended.board?.tiles.every((t) => t.state === 'hidden')).toBe(true);
    });

    it('a match spends nothing, and a floor cleared on the last miss is a clear', () => {
        let run: RunState = { ...twoPairRun(), missBank: [] };
        run = play(run, 'a-1', 'a-2');
        expect(run.status).toBe('playing');
        expect(missesLeft(run)).toBe(0);
        const cleared = play(run, 'b-1', 'b-2');
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.runEndReason).toBeNull();
    });

    it('spends the grant that would expire first, so nothing earned goes unspent while older sits', () => {
        const spent = spendMiss([{ floor: 4, misses: 1 }, { floor: 2, misses: 2 }]);
        expect(spent).toEqual([{ floor: 2, misses: 1 }, { floor: 4, misses: 1 }]);
        expect(missBankSoonestToGo({ missBank: spent })).toEqual({ misses: 1, lastFloor: 2 + MISS_BANK_LIFETIME_FLOORS });
    });

    it('a grant lasts the floor it was earned on and three more, then is gone', () => {
        const grant = { floor: 5, misses: 2 };
        expect(missBankGrantLastFloor(grant)).toBe(8);
        expect(missBankOnFloor([grant], 8)).toEqual([grant]);
        expect(missBankOnFloor([grant], 9)).toEqual([]);
    });

    it('carries what a floor left unspent and not yet expired, then pays the clear into the next floor', () => {
        const first = finishMemorizePhase(createNewRun(0, { runSeed: 4242, gameMode: 'endless' }));
        const spentDown = { ...first, missBank: [], status: 'levelComplete' as const };
        expect(carryMissBank(spentDown, 2)).toEqual(onFloor(1, MISS_BANK_FLOOR_GRANT));
        expect(missesLeft(advanceToNextLevel(spentDown))).toBe(MISS_BANK_FLOOR_GRANT);

        const full = { ...first, status: 'levelComplete' as const };
        const next = advanceToNextLevel(full);
        expect(missesLeft(next)).toBe(Math.min(MISS_BANK_CAP, MISS_BANK_OPENING + MISS_BANK_FLOOR_GRANT));
        expect(missesLeft(next)).toBe(MISS_BANK_CAP);

        // The opening three were earned on floor 1: good through floor 4, gone on floor 5. What
        // floor 4 carries to floor 5 is only what floors 2-4 earned.
        const onFive = { ...first, board: { ...first.board!, level: 4 }, missBank: [...onFloor(1, 3), ...onFloor(3, 1)] };
        expect(carryMissBank(onFive, 5)).toEqual([{ floor: 3, misses: 1 }, { floor: 4, misses: MISS_BANK_FLOOR_GRANT }]);
    });

    it('never banks past the cap, and at the cap a new grant pushes the oldest out rather than being lost', () => {
        const refreshed = grantMisses([{ floor: 1, misses: 3 }, { floor: 2, misses: 1 }], 3, 2);
        expect(refreshed).toEqual([{ floor: 1, misses: 1 }, { floor: 2, misses: 1 }, { floor: 3, misses: 2 }]);
        expect(missesLeft({ missBank: refreshed })).toBe(MISS_BANK_CAP);
    });

    it('earns one every five in a row, stamped with the floor and spendable at once', () => {
        expect(comboMissesEarned(4, 5)).toBe(1);
        expect(comboMissesEarned(5, 6)).toBe(0);
        expect(comboMissesEarned(9, 10)).toBe(1);
        expect(comboMissesEarned(5, 2)).toBe(0);

        // Walked through the turn path: a chain of four, one match from the rung, on an empty bank.
        const threePairRun = makeRun([
            makeTile('a-1', 'a', 'A'),
            makeTile('a-2', 'a', 'A'),
            makeTile('b-1', 'b', 'B'),
            makeTile('b-2', 'b', 'B'),
            makeTile('c-1', 'c', 'C'),
            makeTile('c-2', 'c', 'C')
        ]);
        let run: RunState = {
            ...threePairRun,
            missBank: [],
            stats: { ...threePairRun.stats, currentStreak: MISS_BANK_COMBO_RUNG - 1 }
        };
        run = play(run, 'a-1', 'a-2');
        expect(run.stats.currentStreak).toBe(MISS_BANK_COMBO_RUNG);
        expect(run.missBank).toEqual(onFloor(run.board!.level, 1));
        expect(missesLeft(run)).toBe(1);
        // And that miss is there to be spent on the same floor.
        const missed = play(run, 'b-1', 'c-1');
        expect(missed.status).toBe('playing');
        expect(missed.stats.mismatches).toBe(1);
        expect(missesLeft(missed)).toBe(0);
    });

    it('a run built without a bank has no budget, and never ends this way', () => {
        let run: RunState = { ...twoPairRun(), missBank: undefined };
        expect(missesLeft(run)).toBeNull();
        expect(missBankSoonestToGo(run)).toBeNull();
        for (let turn = 0; turn < 12; turn += 1) run = miss(run);
        expect(run.status).toBe('playing');
        expect(carryMissBank(run, 2)).toBeUndefined();
    });
});
