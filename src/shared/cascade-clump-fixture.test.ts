import { describe, expect, it } from 'vitest';

import { chainMomentum, chainTierRungs, runChainTier } from './chain-tier-rules';
import type { RunState } from './contracts';
import { flipTile, resolveBoardTurn } from './game';
import { createPlayablePathFixture } from './playable-path-fixtures';

/**
 * The board the end-to-end cascade spec plays, checked here where a gate can see it.
 *
 * `e2e/cascade-chain.spec.ts` asserts that this fixture climbs the ladder to Fever, and it was red
 * for an unknown number of generations without anything saying so: `gate:systems` does not run
 * Playwright, so an e2e claim about a rule of the game had nowhere to fail in seconds. This is that
 * claim in the unit suite. What the e2e spec is for is the screen showing it; what this is for is
 * the board being able to.
 *
 * Which also settles what was wrong. The rule is fine - the ladder reaches Fever on the third
 * match. It reaches it on the SAME turn the floor clears, and the spec was sampling a 200ms DOM
 * attribute on a stage that unmounts the moment that happens, which it half-knew: its own comment
 * says "the stage unmounts the moment the floor clears, which is exactly the turn this wants to
 * catch". A test that has to win a race is not measuring the game.
 */
describe('the cascade clump fixture', () => {
    const playThrough = (): Array<{ momentum: number; tier: string; turn: number; status: string }> => {
        let run = createPlayablePathFixture('cascadeClump').run as RunState;
        const rows: Array<{ momentum: number; tier: string; turn: number; status: string }> = [];
        for (let turn = 1; turn <= 12; turn += 1) {
            const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
            const first = hidden[0];
            const partner = hidden.find((tile) => tile.pairKey === first?.pairKey && tile.id !== first.id);
            if (!first || !partner) {
                break;
            }
            run = resolveBoardTurn(flipTile(flipTile(run, first.id), partner.id));
            rows.push({
                momentum: chainMomentum(run.stats.currentStreak, run.chunkPairsThisChain),
                status: run.status,
                tier: runChainTier(run),
                turn
            });
            if (run.status !== 'playing') {
                break;
            }
        }
        return rows;
    };

    it('climbs none to Fever in five matches, on the rungs its twelve pairs set', () => {
        // 2026-09-23: a lone match pops nothing, so the first two matches are plain; the third is
        // Clean and pops one pair, the fourth is Sharp and takes two, the fifth is Fever.
        expect(chainTierRungs(12)).toEqual({ clean: 3, fever: 9, sharp: 7 });
        const rows = playThrough();
        expect(rows.map((row) => row.tier)).toEqual(['none', 'none', 'clean', 'sharp', 'fever', 'fever']);
        expect(rows.map((row) => row.momentum)).toEqual([1, 2, 4, 7, 9, 11]);
    });

    it('reaches Fever with a pair still to play, and clears the floor on the turn after', () => {
        /*
         * Until 2026-09-23 the top rung landed on the same turn the floor cleared, because every
         * match popped two more pairs and momentum and the pairs left ran out together - which is
         * why the e2e could not poll for it. With the pop capped, Fever arrives on the fifth match
         * with the board still standing, and the floor clears on the sixth.
         */
        const rows = playThrough();
        const fever = rows.find((row) => row.tier === 'fever');
        expect(fever?.turn).toBe(5);
        expect(fever?.status).toBe('playing');
        expect(rows.at(-1)).toMatchObject({ turn: 6, status: 'levelComplete', tier: 'fever' });
    });

    it('records the floor at the rung the ladder showed, which the streak alone never reaches', () => {
        // Six matches, streak 6: on twelve pairs that is short of Sharp. The HUD said Fever, and the
        // clear paid Fever; the floor's record, the run's Fever-floor count and the profile's all say so.
        let run = createPlayablePathFixture('cascadeClump').run as RunState;
        const peaks: string[] = [];
        while (run.status === 'playing') {
            const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
            const first = hidden[0]!;
            const partner = hidden.find((tile) => tile.pairKey === first.pairKey && tile.id !== first.id)!;
            run = resolveBoardTurn(flipTile(flipTile(run, first.id), partner.id));
            peaks.push(run.peakChainTierThisFloor ?? 'missing');
        }
        expect(peaks).toEqual(['none', 'none', 'clean', 'sharp', 'fever', 'fever']);
        expect(run.stats.currentStreak).toBe(6);
        expect(run.lastLevelResult?.chainTier).toBe('fever');
        expect(run.feverFloorsThisRun).toBe(1);
    });
});
