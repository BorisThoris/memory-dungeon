import { describe, expect, it } from 'vitest';

import {
    parTurnsForBoard,
    turnBankCapForBoard,
    turnBankDepositForBoard,
    turnCeilingForRun,
    turnsToCeiling
} from './floor-par';
import { createNewRun, finishMemorizePhase } from './game';
import { advanceToNextLevel } from './next-floor-transition-rules';

/*
 * The turn bank (`floor-par.ts`): the ceiling is carried between floors instead of refilled. These
 * walk the game's own floor transition, so the carry is what a player would actually be handed.
 */
describe('the turn bank', () => {
    const clearAfter = (turns: number) => {
        const run = finishMemorizePhase(createNewRun(0, { runSeed: 4242, gameMode: 'endless' }));
        return advanceToNextLevel({ ...run, turnsThisFloor: turns, status: 'levelComplete' });
    };

    it('opens a run on a full bank', () => {
        const run = createNewRun(0, { runSeed: 4242, gameMode: 'endless' });
        expect(turnCeilingForRun(run)).toBe(turnBankCapForBoard(run.board));
        expect(turnCeilingForRun(run)).toBe(parTurnsForBoard(run.board) * 2);
    });

    it('carries what a floor left unspent and adds only a partial deposit', () => {
        const first = createNewRun(0, { runSeed: 4242, gameMode: 'endless' });
        const spent = turnCeilingForRun(first) - 1;
        const next = clearAfter(spent);
        expect(next.turnBankCarry).toBe(1);
        expect(turnsToCeiling(next)).toBe(1 + turnBankDepositForBoard(next.board));
        // The deposit is under par, so a floor played at par drains the bank rather than holding it.
        expect(turnBankDepositForBoard(next.board)).toBeLessThan(parTurnsForBoard(next.board));
    });

    it('never lets a good run bank past the cap', () => {
        const next = clearAfter(0);
        expect(turnCeilingForRun(next)).toBe(turnBankCapForBoard(next.board));
    });

    it('ends a run that keeps playing over par, where the old per-floor ceiling never would', () => {
        // Every floor played at 1.5 times par: each would sit well inside three times par on its
        // own, but the overspend follows the run down, and the bank runs dry within a few floors.
        let run = finishMemorizePhase(createNewRun(0, { runSeed: 4242, gameMode: 'endless' }));
        let floors = 0;
        while (floors < 30) {
            const wanted = Math.ceil(parTurnsForBoard(run.board) * 1.5);
            if (wanted >= turnCeilingForRun(run)) break;
            expect(wanted).toBeLessThan(parTurnsForBoard(run.board) * 3);
            run = finishMemorizePhase(advanceToNextLevel({ ...run, turnsThisFloor: wanted, status: 'levelComplete' }));
            floors += 1;
        }
        expect(floors).toBeLessThan(10);
    });
});
