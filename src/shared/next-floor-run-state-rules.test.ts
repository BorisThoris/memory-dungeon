import { describe, expect, it } from 'vitest';
import { type RunState } from './contracts';
import { createNewRun } from './game';
import { createNextFloorRunState } from './next-floor-run-state-rules';
import { pickFloorCurio } from './floor-curio-rules';

describe('createNextFloorRunState', () => {
    it('resets per-floor counters and prepares memorize timing for the next board', () => {
        const baseRun = createNewRun(0, { runSeed: 12 });
        const run = {
            ...baseRun,
            status: 'levelComplete' as const,
            pinnedTileIds: ['old'],
            matchResolutionsThisFloor: 7,
            findablesClaimedThisFloor: 2,
            recallMatchesThisFloor: 3,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: 100,
                debugRevealRemainingMs: 100,
                pausedFromStatus: null
            },
            stats: {
                ...createNewRun(0, { runSeed: 12 }).stats,
                tries: 5,
                currentLevelScore: 123,
                highestLevel: 1,
                currentStreak: 3,
                rating: 'A' as const
            }
        };
        const nextBoard = createNewRun(0, { runSeed: 12 }).board!;

        const next = createNextFloorRunState(run, {
            activeMutators: run.activeMutators,
            board: { ...nextBoard, level: 4 },
            memorizeRemainingMs: 2500
        });

        expect(next.status).toBe('memorize');
        expect(next.activeMutators).toEqual(run.activeMutators);
        expect(next.runEndReason).toBeNull();
        expect(next.pinnedTileIds).toEqual([]);
        expect(next.matchResolutionsThisFloor).toBe(0);
        expect(next.findablesClaimedThisFloor).toBe(0);
        expect(next.recallMatchesThisFloor).toBe(0);
        // The floor's resident is picked from seed, level and rules version, and some of them
        // change the memorize window; this test is about the reset, not the resident, so the
        // expectation carries whatever the resident adds rather than pinning one rules version.
        const curioMemorizeBonusMs = pickFloorCurio(run.runSeed, 4, run.runRulesVersion).effect.memorizeBonusMs;
        expect(next.timerState).toMatchObject({
            memorizeRemainingMs: 2500 + curioMemorizeBonusMs,
            resolveRemainingMs: null,
            debugRevealRemainingMs: null,
            pausedFromStatus: null
        });
        expect(next.lastLevelResult).toBeNull();
        expect(next.stats.tries).toBe(0);
        expect(next.stats.currentLevelScore).toBe(0);
        expect(next.stats.currentStreak).toBe(0);
        expect(next.stats.highestLevel).toBe(4);
    });



    it('normalizes malformed stat records before resetting next-floor stats', () => {
        const run = {
            ...createNewRun(0, { runSeed: 17 }),
            stats: Number.NaN as unknown as RunState['stats']
        };
        const next = createNextFloorRunState(run, {
            activeMutators: run.activeMutators,
            board: { ...run.board!, level: 4 },
            memorizeRemainingMs: 1000
        });

        expect(next.stats.totalScore).toBe(0);
        expect(next.stats.currentLevelScore).toBe(0);
        expect(next.stats.tries).toBe(0);
        expect(next.stats.currentStreak).toBe(0);
        expect(next.stats.highestLevel).toBe(4);
    });


});
