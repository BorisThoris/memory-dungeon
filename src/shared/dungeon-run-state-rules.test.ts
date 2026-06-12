import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun } from './game-core';
import {
    getRunDungeonMapState,
    getRunMemorizePhaseRecallFocus
} from './dungeon-run-state-rules';

describe('dungeon-run-state-rules', () => {
    it('returns an existing dungeon run map unchanged', () => {
        const run = createNewRun(0);

        expect(getRunDungeonMapState(run)).toBe(run.dungeonRun);
    });

    it('creates a fallback dungeon run map from seed, rules version, and current board level', () => {
        const run: RunState = {
            ...createNewRun(0, { runSeed: 42 }),
            dungeonRun: undefined as unknown as RunState['dungeonRun'],
            board: {
                ...createNewRun(0).board!,
                level: 4
            }
        };

        const dungeonRun = getRunDungeonMapState(run);

        expect(dungeonRun.seed).toBe(42);
        expect(dungeonRun.rulesVersion).toBe(run.runRulesVersion);
        expect(dungeonRun.currentFloor).toBe(4);
    });

    it('uses the current dungeon route approach when deriving memorize recall focus', () => {
        const base = createNewRun(0);
        const run: RunState = {
            ...base,
            lastLevelResult: {
                clearLifeGained: 0,
                clearLifeReason: 'none',
                level: 1,
                livesRemaining: base.lives,
                mistakes: 0,
                perfect: true,
                rating: 'S',
                recallMatches: 2,
                recallMistakes: 0,
                scoreGained: 100
            }
        };
        const safeRouteRun: RunState = {
            ...run,
            dungeonRun: {
                ...run.dungeonRun!,
                nodes: run.dungeonRun!.nodes.map((node) =>
                    node.id === run.dungeonRun!.currentNodeId
                        ? { ...node, routeApproachType: 'safe' }
                        : node
                )
            }
        };

        expect(getRunMemorizePhaseRecallFocus(safeRouteRun)).toBeGreaterThan(getRunMemorizePhaseRecallFocus(run));
    });
});
