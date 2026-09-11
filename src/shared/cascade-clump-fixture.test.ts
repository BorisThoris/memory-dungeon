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

    it('climbs none to Fever in three matches, on the rungs its twelve pairs set', () => {
        expect(chainTierRungs(12)).toEqual({ clean: 3, fever: 8, sharp: 6 });
        const rows = playThrough();
        expect(rows.map((row) => row.tier)).toEqual(['clean', 'sharp', 'fever']);
        expect(rows.map((row) => row.momentum)).toEqual([3, 6, 9]);
    });

    it('reaches Fever on the turn that clears the floor, which is why the e2e cannot poll for it', () => {
        /*
         * Not a defect in the board: twelve pairs in three suit columns means every match pops two
         * more pairs, so momentum and the pairs left run out together and the top rung lands on the
         * last match by construction. It is a fact about this fixture, and the spec that plays it
         * has to read the floor-clear beat's own tier rather than try to catch the stage before it
         * unmounts.
         */
        const rows = playThrough();
        const fever = rows.find((row) => row.tier === 'fever');
        expect(fever?.turn).toBe(3);
        expect(fever?.status).toBe('levelComplete');
        expect(rows.filter((row) => row.status === 'playing').every((row) => row.tier !== 'fever')).toBe(true);
    });
});
