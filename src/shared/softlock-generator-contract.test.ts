import { describe, expect, it } from 'vitest';

import { buildBoard } from './board-build-rules';
import { inspectRunFairness } from './board-inspection';
import { GAME_RULES_VERSION } from './contracts';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
import {
    createClearedBoardFairnessProjection,
    createFinalPairFairnessProjection,
    createGeneratedBoardSolverRun,
    formatSoftlockGeneratorFailure,
    runSoftlockGeneratorContract,
    solveGeneratedBoardByExhaustingPairs
} from './softlock-generator-contract';

describe('softlock generator contract', () => {

    it('checks seeded floors across traits and final-pair projections', () => {
        const result = runSoftlockGeneratorContract();

        expect(result.failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
        expect(result.checkedBoards).toBeGreaterThan(100);
        expect(result.checkedPlayableBoards).toBeGreaterThan(30);
        expect(result.checkedNextFloorTransitions).toBe(result.checkedPlayableBoards);
        // Nine coverage families - locks, shops, keys, levers, exits, hazards, enemies, bosses,
        // topology - left this list with the layer that produced them. What remains is what a floor of pairs
        // can still get wrong, and every one of them must still be exercised: a coverage key at
        // nought means this contract is asserting over a case it never actually builds.
        expect(result.coverage).toMatchObject({
            traits: expect.any(Number),
            traitInteractions: expect.any(Number),
            traitRouteObjectives: expect.any(Number),
            finalPairStates: expect.any(Number)
        });
        for (const [key, count] of Object.entries(result.coverage)) {
            expect(count, `${key} coverage`).toBeGreaterThan(0);
        }
    }, 15_000);


    it('executes generated boards through pair exhaustion, and the empty board ends the floor', () => {
        const board = buildBoard(5, {
            gameMode: 'endless',
            runSeed: 438154985,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'normal',
            floorArchetypeId: null,
            activeMutators: []
        });

        const solverRun = createGeneratedBoardSolverRun(board, 438154985);
        const solved = solveGeneratedBoardByExhaustingPairs(board, 438154985);
        const next = advanceToNextLevel(solved);

        expect(solverRun.gameMode).toBe('endless');
        expect(solverRun.board?.level).toBe(5);
        expect(solverRun.findablesTotalThisFloor).toBeGreaterThanOrEqual(0);
        expect(solved.status).toBe('levelComplete');
        // The floor ends because the board does: every tile the solver was handed is matched or
        // removed, and nothing else was ever on it.
        expect(
            solved.board?.tiles.filter((tile) => tile.state !== 'matched' && tile.state !== 'removed')
        ).toEqual([]);
        expect(next.status).toBe('memorize');
        expect(next.board?.level).toBe(6);
        expect(inspectRunFairness(next).issues).toEqual([]);
    });

    it('creates legal final-pair projections from generated boards', () => {
        const board = buildBoard(7, {
            gameMode: 'endless',
            runSeed: 77_707,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall'
        });
        const projected = createFinalPairFairnessProjection(board);

        expect(projected).toBeTruthy();
        expect(projected?.flippedTileIds).toEqual([]);
        expect(
            projected?.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)).length
        ).toBeGreaterThan(0);
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
                    floorArchetypeId: 'trap_hall'
                })
            }
        ]).failures.map(formatSoftlockGeneratorFailure)).toEqual([]);
    });

    it('creates cleared-board projections for boss floor coverage', () => {
        const board = buildBoard(7, {
            gameMode: 'endless',
            runSeed: 77_708,
            runRulesVersion: GAME_RULES_VERSION,
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall'
        });
        const projected = createClearedBoardFairnessProjection(board);

        expect(projected.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey))).toHaveLength(0);
        expect(projected.matchedPairs).toBe(projected.pairCount);
        expect(runSoftlockGeneratorContract([
            {
                id: 'single_boss_cleared_projection',
                label: 'Single boss cleared projection',
                seeds: [77_708],
                floors: [7],
                optionsForFloor: () => ({
                    gameMode: 'endless',
                    runSeed: 77_708,
                    runRulesVersion: GAME_RULES_VERSION,
                    floorTag: 'boss',
                    floorArchetypeId: 'trap_hall'
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
        expect(result.failures.flatMap((failure) => failure.issueCodes)).toContain('completion_route_missing');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('[broken_exit_fixture]');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('seed=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('floor=1');
        expect(formatSoftlockGeneratorFailure(result.failures[0]!)).toContain('projection=');
        const playableFailure = result.failures.find((failure) => failure.projection === 'playable_clear');
        expect(playableFailure?.issueDetails.some((detail) => detail.startsWith('solver_trace: reason='))).toBe(true);
        expect(formatSoftlockGeneratorFailure(playableFailure!)).toContain('solver_trace: reason=');
    });

    it('includes pair and tile context in failure diagnostics', () => {
        const diagnostic = formatSoftlockGeneratorFailure({
            scenarioId: 'orphan_pair_fixture',
            scenarioLabel: 'Orphan pair fixture',
            seed: 23,
            floor: 6,
            projection: 'generated',
            issueCodes: ['real_pair_incomplete'],
            issueDetails: ['real_pair_incomplete: Real pair "a" has 1 tile(s); exactly 2 are required. pair=a tiles=a1'],
            issues: [
                {
                    code: 'real_pair_incomplete',
                    message: 'Real pair "a" has 1 tile(s); exactly 2 are required.',
                    pairKey: 'a',
                    tileIds: ['a1']
                }
            ],
            boardSummary: 'level=6 pairs=1 floorTag=normal archetype=none'
        });

        expect(diagnostic).toContain('level=6 pairs=1');
        expect(diagnostic).toContain('real_pair_incomplete');
        expect(diagnostic).toContain('exactly 2 are required');
        expect(diagnostic).toContain('tiles=a1');
    });

});
