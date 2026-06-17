import { describe, expect, it } from 'vitest';

import { buildBoard } from './board-build-rules';
import { GAME_RULES_VERSION } from './contracts';
import {
    createFinalPairFairnessProjection,
    formatSoftlockGeneratorFailure,
    runSoftlockGeneratorContract
} from './softlock-generator-contract';

describe('softlock generator contract', () => {
    it('checks seeded floors across locks, shops, traits, hazards, bosses, and final-pair projections', () => {
        const result = runSoftlockGeneratorContract();

        expect(result.failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
        expect(result.checkedBoards).toBeGreaterThan(100);
        expect(result.coverage).toMatchObject({
            locks: expect.any(Number),
            shops: expect.any(Number),
            keys: expect.any(Number),
            levers: expect.any(Number),
            traits: expect.any(Number),
            exits: expect.any(Number),
            hazards: expect.any(Number),
            enemies: expect.any(Number),
            bosses: expect.any(Number),
            finalPairStates: expect.any(Number)
        });
        for (const [key, count] of Object.entries(result.coverage)) {
            expect(count, `${key} coverage`).toBeGreaterThan(0);
        }
    });

    it('creates legal final-pair projections from generated dungeon boards', () => {
        const board = buildBoard(7, {
            gameMode: 'endless',
            runSeed: 77_707,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            dungeonNodeKind: 'boss'
        });
        const projected = createFinalPairFairnessProjection(board);

        expect(projected).toBeTruthy();
        expect(projected?.flippedTileIds).toEqual([]);
        expect(projected?.tiles.filter((tile) => tile.state === 'hidden' && tile.dungeonCardKind == null).length).toBeGreaterThan(0);
        expect(runSoftlockGeneratorContract([
            {
                id: 'single_boss_projection',
                label: 'Single boss projection',
                seeds: [77_707],
                floors: [7],
                optionsForFloor: () => ({
                    gameMode: 'endless',
                    runSeed: 77_707,
                    runRulesVersion: GAME_RULES_VERSION,
                    floorTag: 'boss',
                    floorArchetypeId: 'trap_hall',
                    dungeonNodeKind: 'boss'
                })
            }
        ]).failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
    });

    it('formats diagnostics with scenario, seed, floor, projection, and issue codes', () => {
        const result = runSoftlockGeneratorContract([
            {
                id: 'broken_exit_fixture',
                label: 'Broken exit fixture',
                seeds: [1],
                floors: [1],
                optionsForFloor: () => ({
                    fixedTilesMode: 'exact',
                    fixedTiles: [
                        { id: 'a', pairKey: 'a', state: 'hidden', symbol: 'A', label: 'A' },
                        { id: 'b', pairKey: 'b', state: 'hidden', symbol: 'B', label: 'B' }
                    ],
                    runSeed: 1,
                    runRulesVersion: GAME_RULES_VERSION
                })
            }
        ]);

        expect(result.failures.length).toBeGreaterThan(0);
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('[broken_exit_fixture]');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('seed=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('floor=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('projection=');
    });
});
