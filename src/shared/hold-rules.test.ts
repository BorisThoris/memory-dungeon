import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { inspectBoardFairness } from './board-inspection';
import { HOLD_METER_SEGMENTS, canReleaseHold, canStartHold, heldPairCount, holdMeter, releaseHold, startHold } from './hold-rules';

/** A floor-13 run between turns on a floor-13 board, the meter as given. */
const floor13 = (holdLinks: number): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 1313, realm: null }));
    const board = buildBoard(13, { runSeed: 1313, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });
    // A deep bank: a Heavy card’s miss costs two, and the halving test misses three times.
    return { ...base, status: 'playing', activeMutators: [], board, holdLinks, missBank: [{ floor: 13, misses: 9 }] };
};

/** Match any pair still face down whose two cards both turn (a trait can refuse a flip); null when none is left. */
const matchOne = (run: RunState): RunState | null => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__'));
    for (const first of hidden) {
        const second = hidden.find((tile) => tile.pairKey === first.pairKey && tile.id !== first.id);
        if (!second) continue;
        const flipped = flipTile(flipTile(run, first.id), second.id);
        if (flipped.board!.flippedTileIds.length === 2) return resolveBoardTurn(flipped);
    }
    return null;
};

const missOne = (run: RunState): RunState => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__'));
    const first = hidden[0]!;
    const second = hidden.find((tile) => tile.pairKey !== first.pairKey)!;
    return resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
};

describe('the Hold (DGE-008)', () => {
    it('arms after six links of the chain, from the Living Dungeon on', () => {
        expect(HOLD_METER_SEGMENTS).toBe(6);
        expect(canStartHold(floor13(5))).toBe(false);
        expect(canStartHold(floor13(6))).toBe(true);
        expect(canStartHold({ ...floor13(6), board: { ...floor13(6).board!, level: 12 } })).toBe(false);
        // An unheld match fills the meter; a miss empties it.
        const filled = matchOne(floor13(2))!;
        expect(holdMeter(filled).segments).toBe(3);
        expect(holdMeter(missOne(floor13(4))).segments).toBe(0);
    });

    it('keeps a held match’s pop for the release, the pair matched and the board fair', () => {
        let run = startHold(floor13(6));
        expect(run.holding).toBe(true);
        for (let i = 0; i < 3; i += 1) {
            const before = run.board!.matchedPairs;
            run = matchOne(run)!;
            // Exactly the pair: nothing popped with it.
            expect(run.board!.matchedPairs - before).toBe(1);
        }
        expect(heldPairCount(run)).toBe(3);
        expect(inspectBoardFairness(run.board!).issues).toEqual([]);
        expect(canReleaseHold(run)).toBe(true);
        const released = releaseHold(run)!;
        expect(released.held).toBe(3);
        expect(released.run.holding).toBe(false);
        expect(released.run.heldSeedIds).toEqual([]);
        expect(holdMeter(released.run).segments).toBe(0);
        expect(released.run.board!.matchedPairs).toBe(run.board!.matchedPairs + released.pairs);
        // A release can clear the floor, whose clear bonus then lands on top; mid-floor it is the release's score alone.
        if (released.run.status === 'playing') expect(released.run.stats.totalScore).toBe(run.stats.totalScore + released.score);
        // What it pops depends on the cards beside the held pairs; the hall rooms author a board that pops.
        expect(released.pairs > 0).toBe(released.score > 0);
        expect(inspectBoardFairness(released.run.board!).issues).toEqual([]);
    });

    it('drops the oldest half of the stack on a miss, and never all of it', () => {
        let run = startHold(floor13(6));
        for (let i = 0; i < 4; i += 1) run = matchOne(run)!;
        const newest = run.heldSeedIds!.slice(-4);
        run = missOne(run);
        expect(heldPairCount(run)).toBe(2);
        expect(run.heldSeedIds).toEqual(newest);
        run = missOne(run);
        expect(heldPairCount(run)).toBe(1);
        run = missOne(run);
        expect(heldPairCount(run)).toBe(1);
        expect(run.holding).toBe(true);
    });

    it('lets the floor be cleared while holding, and holds nothing into the next floor', () => {
        let run: RunState | null = startHold(floor13(6));
        let last: RunState = run;
        for (let guard = 0; guard < 80 && run && run.status === 'playing'; guard += 1) {
            last = run;
            run = matchOne(run);
        }
        expect(run?.status ?? last.status).toBe('levelComplete');
        expect(run?.heldSeedIds ?? []).toEqual([]);
        expect(run?.holding ?? false).toBe(false);
    });
});
