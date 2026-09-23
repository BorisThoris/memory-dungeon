import { describe, expect, it } from 'vitest';

import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import {
    carryMissBank,
    MISS_BANK_CAP,
    MISS_BANK_FLOOR_GRANT,
    MISS_BANK_OPENING,
    missesLeft
} from './miss-bank';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { makeRun, makeTile } from './test/game-fixtures';

/*
 * The miss bank (`miss-bank.ts`): the run's budget for being wrong, in misses. These walk the
 * game's own turn path and floor transition, so the count is what a player would be handed.
 */
describe('the miss bank', () => {
    const twoPairRun = (): RunState =>
        makeRun([makeTile('a-1', 'a', 'A'), makeTile('a-2', 'a', 'A'), makeTile('b-1', 'b', 'B'), makeTile('b-2', 'b', 'B')]);
    const play = (run: RunState, first: string, second: string): RunState =>
        resolveBoardTurn(flipTile(flipTile(run, first), second));
    const miss = (run: RunState): RunState => play(run, 'a-1', 'b-1');

    it('opens a run with the opening budget, and sizes it as the player asked: one or two a floor', () => {
        expect(missesLeft(createNewRun(0, { runSeed: 4242, gameMode: 'endless' }))).toBe(MISS_BANK_OPENING);
        expect(MISS_BANK_OPENING).toBe(3);
        expect(MISS_BANK_FLOOR_GRANT).toBe(2);
        expect(MISS_BANK_CAP).toBe(4);
        expect(MISS_BANK_FLOOR_GRANT).toBeLessThanOrEqual(2);
    });

    it('spends one per miss, and ends the run on the miss after the last', () => {
        let run: RunState = { ...twoPairRun(), missBankCarry: MISS_BANK_OPENING };
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
        let run: RunState = { ...twoPairRun(), missBankCarry: 0 };
        run = play(run, 'a-1', 'a-2');
        expect(run.status).toBe('playing');
        expect(missesLeft(run)).toBe(0);
        const cleared = play(run, 'b-1', 'b-2');
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.runEndReason).toBeNull();
    });

    it('carries what a floor left unspent, adds the grant, and never banks past the cap', () => {
        const first = finishMemorizePhase(createNewRun(0, { runSeed: 4242, gameMode: 'endless' }));
        const spentDown = { ...first, missBankCarry: 0, status: 'levelComplete' as const };
        expect(carryMissBank(spentDown)).toBe(MISS_BANK_FLOOR_GRANT);
        expect(missesLeft(advanceToNextLevel(spentDown))).toBe(MISS_BANK_FLOOR_GRANT);
        const full = { ...first, status: 'levelComplete' as const };
        expect(missesLeft(advanceToNextLevel(full))).toBe(Math.min(MISS_BANK_CAP, MISS_BANK_OPENING + MISS_BANK_FLOOR_GRANT));
        expect(missesLeft(advanceToNextLevel(full))).toBe(MISS_BANK_CAP);
    });

    it('a run built without a bank has no budget, and never ends this way', () => {
        let run: RunState = { ...twoPairRun(), missBankCarry: undefined };
        expect(missesLeft(run)).toBeNull();
        for (let turn = 0; turn < 12; turn += 1) run = miss(run);
        expect(run.status).toBe('playing');
        expect(carryMissBank(run)).toBeUndefined();
    });
});
