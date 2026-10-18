import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { assignFindableKindsToTiles } from './board-tile-generation-rules';
import { claimCurio, CURIO_FROM_FLOOR, curioItemFor } from './curio-rules';
import { GAME_RULES_VERSION } from './contracts';
import { flipTile, resolveBoardTurn } from './game';

describe('Curios', () => {
    it('put a curio item in hand and record the drop when their pair is matched', () => {
        const run: RunState = finishMemorizePhase(createNewRun(0, { runSeed: 77, realm: null }));
        const claimed = claimCurio(run, 4, 'pair-x');
        expect(claimed.crucibleCharges).toBe(1);
        expect(claimed.curiosClaimedThisRun).toBe(1);
        expect(claimed.lastCurioDrop).toEqual({ key: 'curio:77:4:0:pair-x', item: 'crucible' });
        expect(claimCurio(claimed, 4, 'pair-y').lastCurioDrop?.key).not.toBe(claimed.lastCurioDrop?.key);
        expect(curioItemFor(run, 4)).toBe(curioItemFor(run, 4));
    });

    it('ride some score glints from floor two on, and never move another pickup', () => {
        const run = createNewRun(0, { runSeed: 1, realm: null });
        const tiles = run.board!.tiles;
        let curios = 0;
        let glints = 0;
        for (let seed = 1; seed <= 300; seed += 1) {
            for (const level of [1, 2, 6]) {
                const dealt = assignFindableKindsToTiles(tiles.map((tile) => ({ ...tile, findableKind: undefined })), [], seed, GAME_RULES_VERSION, level);
                const kinds = dealt.filter((tile) => tile.findableKind).map((tile) => tile.findableKind);
                if (level < CURIO_FROM_FLOOR) expect(kinds).not.toContain('curio');
                curios += kinds.filter((kind) => kind === 'curio').length / 2;
                glints += kinds.filter((kind) => kind === 'score_glint').length / 2;
                // A Curio only ever stands where a glint would: shards land exactly where they did.
                expect(kinds.filter((kind) => kind === 'meteor_shard').length % 2).toBe(0);
            }
        }
        expect(curios).toBeGreaterThan(0);
        // Rules 65 and older never deal one: an old shared key replays the board it dealt.
        for (let seed = 1; seed <= 300; seed += 1) {
            const old = assignFindableKindsToTiles(tiles.map((tile) => ({ ...tile, findableKind: undefined })), [], seed, 65, 6);
            expect(old.some((tile) => tile.findableKind === 'curio')).toBe(false);
        }
        expect(curios / (curios + glints)).toBeLessThan(0.25);
    });
});

describe('a Curio on the board', () => {
    it('is claimed by matching its pair, like any pickup', () => {
        const run = finishMemorizePhase(createNewRun(0, { runSeed: 4242, realm: null }));
        const carrier = run.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const seeded: RunState = {
            ...run,
            board: {
                ...run.board!,
                tiles: run.board!.tiles.map((tile) =>
                    tile.pairKey === carrier.pairKey ? { ...tile, findableKind: 'curio' as const } : { ...tile, findableKind: undefined }
                )
            }
        };
        const [a, b] = seeded.board!.tiles.filter((tile) => tile.pairKey === carrier.pairKey);
        const matched = resolveBoardTurn(flipTile(flipTile(seeded, a!.id), b!.id));
        expect(matched.crucibleCharges).toBe(1);
        expect(matched.lastCurioDrop?.item).toBe('crucible');
    });
});
