import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { GAME_RULES_VERSION } from './contracts';
import {
    CLASSIC_DESCENT_RULES,
    contentFloor,
    DESCENT_STRIDE_FROM,
    descentFloorFor,
    descentLengthFor,
    lastLevelForDescentFloor,
    levelForDescentFloor,
    STRIDE_CONTENT_FLOORS
} from './descent-length-rules';
import { nextDescentLevel, withFastDescent } from './descent-pace-rules';
import { DESCENT_ACTS, actLevelsFor, descentActForLevel, isActBossLevel, pickFloorScheduleEntry } from './floor-mutator-schedule';
import { nextMilestone } from './milestone-rules';
import { maskCountFor } from './mask-rules';
import { sleeperCountFor } from './sleeper-rules';
import { wandererCountFor } from './wanderer-rules';
import { createNewRun } from './run-creation-rules';

const RULES = DESCENT_STRIDE_FROM;
const archetypeAt = (level: number, seed = 7): string | null => pickFloorScheduleEntry(seed, RULES, level, 'endless').floorArchetypeId;

describe('the forty-floor Descent (rules 93)', () => {
    it('is forty floors picked from the sixty, rising, every act start and boss kept', () => {
        expect(GAME_RULES_VERSION).toBeGreaterThanOrEqual(DESCENT_STRIDE_FROM);
        expect(descentLengthFor(RULES)).toBe(40);
        expect(descentLengthFor(CLASSIC_DESCENT_RULES)).toBe(60);
        expect(STRIDE_CONTENT_FLOORS).toHaveLength(40);
        for (let i = 1; i < STRIDE_CONTENT_FLOORS.length; i += 1) expect(STRIDE_CONTENT_FLOORS[i]!).toBeGreaterThan(STRIDE_CONTENT_FLOORS[i - 1]!);
        for (const floor of [1, 2, 3, 13, 24, 25, 40, 41, 44, 56, 60]) expect(STRIDE_CONTENT_FLOORS, String(floor)).toContain(floor);
        // Both boss slots of every cycle (positions 7 and 9) stay.
        for (const floor of [7, 9, 19, 21, 31, 33, 45, 57]) expect(STRIDE_CONTENT_FLOORS, String(floor)).toContain(floor);
        // Before rules 93 a floor is itself.
        expect(descentFloorFor(17, CLASSIC_DESCENT_RULES)).toBe(17);
    });

    it('starts the acts on 9, 17 and 27, and puts the Keeper on 16, the Cartographer on 26 and the Warden on 40', () => {
        expect(DESCENT_ACTS.map((act) => actLevelsFor(act, RULES))).toEqual([
            { firstLevel: 1, lastLevel: 8 },
            { firstLevel: 9, lastLevel: 16 },
            { firstLevel: 17, lastLevel: 26 },
            { firstLevel: 27, lastLevel: 40 }
        ]);
        expect(archetypeAt(16)).toBe('keeper_hall');
        expect(archetypeAt(26)).toBe('cartographer_hall');
        expect(archetypeAt(40)).toBe('warden_hall');
        expect([29, 37].map((level) => archetypeAt(level))).toEqual(['spiral_hall', 'spiral_hall']);
        expect([15, 16, 17, 26, 40].map((level) => isActBossLevel(level, RULES))).toEqual([false, true, false, true, true]);
        expect(descentActForLevel(9, RULES).id).toBe('living_dungeon');
        expect(descentActForLevel(27, RULES).id).toBe('abyss');
    });

    it('shows each act as its own floors on the milestone, and goes on into Endless where 61 did', () => {
        expect(nextMilestone(7, RULES)).toMatchObject({ floorsDone: 7, floorsTotal: 8, floor: 8 });
        expect(nextMilestone(12, RULES)).toMatchObject({ floorsDone: 4, floorsTotal: 8, floor: 16 });
        expect(nextMilestone(40, RULES)).toMatchObject({ floorsDone: 14, floorsTotal: 14, floor: 40 });
        expect(descentFloorFor(41, RULES)).toBe(61);
        expect(levelForDescentFloor(61, RULES)).toBe(41);
        expect(nextMilestone(41, RULES).floorsDone).toBe(1);
    });

    it('carries its content floor on the board, and the families arrive with their acts', () => {
        const board = (level: number) => buildBoard(level, { runSeed: 4242, runRulesVersion: RULES, gameMode: 'endless', activeMutators: [] });
        expect(contentFloor(board(17))).toBe(25);
        expect(contentFloor(board(5))).toBe(5);
        const counts = (level: number) => ({ wanderer: wandererCountFor(board(level), { rulesVersion: RULES }), mask: maskCountFor(board(level), { rulesVersion: RULES }), sleeper: sleeperCountFor(board(level), { rulesVersion: RULES }) });
        expect(counts(8)).toEqual({ wanderer: 0, mask: 0, sleeper: 0 });
        expect(counts(9)).toEqual({ wanderer: 2, mask: 0, sleeper: 0 });
        expect(counts(17)).toEqual({ wanderer: 3, mask: 2, sleeper: 0 });
        expect(counts(27)).toEqual({ wanderer: 3, mask: 3, sleeper: 2 });
        // Where a span written for sixty floors ends: the last of the forty at or before it.
        expect(lastLevelForDescentFloor(12, RULES)).toBe(8);
    });

    it('jumps the test pace through the forty: every act start and boss, and the Warden on 40', () => {
        let run = withFastDescent(createNewRun(0, { runSeed: 8080 }));
        const ladder: number[] = [1];
        for (let guard = 0; guard < 30 && ladder[ladder.length - 1]! < 40; guard += 1) {
            const next = nextDescentLevel(run);
            ladder.push(next);
            run = { ...run, board: { ...run.board!, level: next } };
        }
        for (const floor of [9, 16, 17, 26, 27, 40]) expect(ladder, String(floor)).toContain(floor);
        expect(ladder[ladder.length - 1]).toBe(40);
    });
});
