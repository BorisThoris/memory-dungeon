import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game';
import { canFlurryGrab, FLURRY_FROM, flurryPress, isFlurryFloor, studyWithFlurry } from './flurry-rules';
import { dealMatchRule } from './match-rule-rules';
import { createMulberry32 } from './rng';

/** A run in a floor's study, on the board's own cards, at `level`. */
const studyAt = (level: number, rulesVersion = FLURRY_FROM): RunState => {
    const run = createNewRun(0, { runSeed: 91 });
    return { ...run, runRulesVersion: rulesVersion, board: { ...run.board!, level, floorTag: 'normal', flippedTileIds: [] } };
};

const pairOf = (run: RunState) => {
    const tiles = run.board!.tiles.filter((tile) => tile.state === 'hidden');
    const a = tiles[0]!;
    return { a, b: tiles.find((tile) => tile.id !== a.id && tile.pairKey === a.pairKey)!, other: tiles.find((tile) => tile.pairKey !== a.pairKey)! };
};

describe('the Flurry (rules 99)', () => {
    it('is the study of every plain floor past the Gate, from rules 99 only', () => {
        expect(isFlurryFloor(studyAt(14))).toBe(true);
        expect(isFlurryFloor(studyAt(5))).toBe(false);
        expect(isFlurryFloor(studyAt(14, FLURRY_FROM - 1))).toBe(false);
        const boss = studyAt(14);
        expect(isFlurryFloor({ ...boss, board: { ...boss.board!, floorTag: 'boss' } })).toBe(false);
        const three = studyAt(14);
        expect(isFlurryFloor({ ...three, board: dealMatchRule(three.board!, 'triples', three.runSeed) })).toBe(false);
    });

    it('two cards of a pair are grabbed at once: matched, scored, the study still running, no miss', () => {
        const run = studyAt(14);
        const { a, b } = pairOf(run);
        const held = flurryPress(run, a.id);
        expect(held.status).toBe('memorize');
        expect(held.board!.flippedTileIds).toEqual([a.id]);
        const grabbed = flurryPress(held, b.id);
        expect(grabbed.status).toBe('memorize');
        expect(grabbed.timerState.memorizeRemainingMs).toBe(run.timerState.memorizeRemainingMs);
        expect(grabbed.board!.tiles.filter((tile) => tile.pairKey === a.pairKey).every((tile) => tile.state === 'matched')).toBe(true);
        expect(grabbed.flurryGrabsThisFloor).toBe(1);
        expect(grabbed.stats.mismatches).toBe(run.stats.mismatches);
        expect(grabbed.stats.currentStreak).toBe(run.stats.currentStreak + 1);
    });

    it('two that are not a pair end the study: both back down, no miss, nothing matched', () => {
        const run = studyAt(14);
        const { a, other } = pairOf(run);
        const ended = flurryPress(flurryPress(run, a.id), other.id);
        expect(ended.status).toBe('playing');
        expect(ended.stats.mismatches).toBe(run.stats.mismatches);
        expect(ended.board!.flippedTileIds).toEqual([]);
        expect(ended.board!.tiles.every((tile) => tile.state === 'hidden')).toBe(true);
        expect(canFlurryGrab(ended)).toBe(false);
    });

    it('grabs until half the floor’s pairs are gone, and the Gate’s study grabs nothing', () => {
        let run = studyAt(14);
        while (canFlurryGrab(run)) {
            const { a, b } = pairOf(run);
            run = flurryPress(flurryPress(run, a.id), b.id);
        }
        expect(run.status).toBe('memorize');
        const dealt = new Set(run.board!.tiles.map((tile) => tile.pairKey)).size;
        expect(new Set(run.board!.tiles.filter((tile) => tile.state === 'hidden').map((tile) => tile.pairKey)).size).toBeGreaterThanOrEqual(Math.ceil(dealt / 2));
        const gate = studyAt(5);
        expect(flurryPress(gate, pairOf(gate).a.id)).toBe(gate);
    });

    it('a sim player grabs on a deep floor and leaves the study playing', () => {
        const run = { ...studyAt(14), timerState: { ...studyAt(14).timerState, memorizeRemainingMs: 5000 } };
        const studied = studyWithFlurry(run, createMulberry32(7), 0);
        expect(studied.status).toBe('playing');
        expect(studied.flurryGrabsThisFloor ?? 0).toBeGreaterThan(0);
        expect(studied.stats.mismatches).toBe(run.stats.mismatches);
    });
});
