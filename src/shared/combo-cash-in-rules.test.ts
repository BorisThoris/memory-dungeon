import { describe, expect, it } from 'vitest';
import { canCashIn, cashInCombo, comboPotShare, runComboPot } from './combo-cash-in-rules';
import type { RunState } from './contracts';
import { advanceToNextLevel, createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { isTileFlipBlocked } from './realm-weather-rules';
import { igniteZone } from './zone-rules';

// One seed for both runs, so the plain and the held run deal the same boards.
const start = (cashIn: boolean): RunState => finishMemorizePhase({ ...createNewRun(0, { runSeed: 4242 }), comboCashIn: cashIn });

const playPair = (run: RunState, miss = false): RunState => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !isTileFlipBlocked(tile));
    const first = hidden.find((tile) => hidden.some((other) => other.id !== tile.id && other.pairKey === tile.pairKey))!;
    // A sure miss: another pair, and another element, since some floors pair by element.
    const second = miss
        ? (hidden.find((tile) => tile.pairKey !== first.pairKey && tile.suit !== first.suit) ?? hidden.find((tile) => tile.pairKey !== first.pairKey))!
        : hidden.find((tile) => tile.id !== first.id && tile.pairKey === first.pairKey)!;
    return resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
};

/** Clear floor 1 and play into floor 2 until the combo has built a pot. */
const hotRun = (cashIn: boolean): RunState => {
    let run = start(cashIn);
    while (run.status === 'playing') run = playPair(run);
    run = finishMemorizePhase(advanceToNextLevel(run));
    for (let turn = 0; turn < 3 && run.status === 'playing'; turn += 1) run = playPair(run);
    return run;
};

/** The same run with the weather lifted (the moss realm vines cards shut), so any card can be turned. */
const clearSkies = (run: RunState): RunState => ({
    ...run,
    board: { ...run.board!, tiles: run.board!.tiles.map((tile) => ({ ...tile, vined: false, frost: 0 })) }
});

describe('cash in (prototype, ?combo2=1)', () => {
    it('leaves a run without the flag exactly as it was', () => {
        const run = hotRun(false);
        expect(run.comboPot ?? null).toBeNull();
        expect(canCashIn(run)).toBe(false);
        expect(cashInCombo(run)).toBe(run);
    });

    it("holds the multiplier's share of the pay and the rung gold in the pot, across the stairs", () => {
        const plain = hotRun(false);
        const held = hotRun(true);
        const pot = runComboPot(held);
        expect(held.stats.currentStreak).toBe(plain.stats.currentStreak);
        expect(pot.score).toBeGreaterThan(0);
        expect(pot.gold).toBeGreaterThan(0);
        // Nothing is lost or made: what the plain run banked is the held run's bank plus its pot.
        expect(held.stats.totalScore + pot.score).toBe(plain.stats.totalScore);
        expect((held.gold ?? 0) + pot.gold).toBe(plain.gold ?? 0);
    });

    it('banks the pot on Cash in and halves the combo', () => {
        const held = hotRun(true);
        const pot = runComboPot(held);
        expect(canCashIn(held)).toBe(true);
        const banked = cashInCombo(held);
        expect(banked.stats.totalScore).toBe(held.stats.totalScore + pot.score);
        expect(banked.gold).toBe((held.gold ?? 0) + pot.gold);
        expect(banked.stats.currentStreak).toBe(Math.floor(held.stats.currentStreak / 2));
        expect(banked.chunkPairsThisChain).toBe(Math.floor((held.chunkPairsThisChain ?? 0) / 2));
        expect(runComboPot(banked)).toEqual({ score: 0, gold: 0 });
        expect(banked.lastComboCashIn).toMatchObject({ score: pot.score, gold: pot.gold, combo: held.stats.currentStreak });
        expect(canCashIn(banked)).toBe(false);
    });

    it('loses the pot on a miss, and says what went', () => {
        const held = clearSkies(hotRun(true));
        const pot = runComboPot(held);
        const missed = playPair(held, true);
        expect(missed.stats.currentStreak).toBe(0);
        expect(missed.stats.totalScore).toBe(held.stats.totalScore);
        expect(runComboPot(missed)).toEqual({ score: 0, gold: 0 });
        expect(missed.comboPotsLost).toBe(1);
        expect(missed.lastComboPotLoss).toMatchObject(pot);
    });

    it('is not offered mid-turn', () => {
        const held = clearSkies(hotRun(true));
        const hidden = held.board!.tiles.find((tile) => tile.state === 'hidden')!;
        expect(canCashIn(flipTile(held, hidden.id))).toBe(false);
    });

    it('banks the pot when Ignite burns the combo', () => {
        const hot = hotRun(true);
        const held = { ...hot, stats: { ...hot.stats, currentStreak: 20 } };
        const pot = runComboPot(held);
        const lit = igniteZone(held);
        expect(lit.zone).toBeTruthy();
        expect(lit.stats.totalScore).toBe(held.stats.totalScore + pot.score);
        expect(runComboPot(lit)).toEqual({ score: 0, gold: 0 });
    });

    it("takes the multiplier's share and nothing at x1", () => {
        expect(comboPotShare(100, 1)).toBe(0);
        expect(comboPotShare(100, 4)).toBe(75);
        expect(comboPotShare(101, 2)).toBe(51);
    });
});
