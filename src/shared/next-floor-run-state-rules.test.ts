import { describe, expect, it } from 'vitest';
import { type RunState } from './contracts';
import { createNewRun } from './game';
import { createNextFloorRunState } from './next-floor-run-state-rules';
import { carriedChainForNextFloor } from './chain-carryover-rules';
import { getChainTier, runChainTier, runLadderChain } from './chain-tier-rules';
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
        expect(next.stats.highestLevel).toBe(4);
    });

    it('carries the chain onto the next floor instead of wiping it at the stairs', () => {
        const baseRun = createNewRun(0, { runSeed: 12 });
        const nextBoard = { ...baseRun.board!, level: 4 };
        const run = {
            ...baseRun,
            status: 'levelComplete' as const,
            chunkPairsThisChain: 5,
            stats: { ...baseRun.stats, currentStreak: 1 }
        };

        const next = createNextFloorRunState(run, {
            activeMutators: run.activeMutators,
            board: nextBoard,
            memorizeRemainingMs: 2500
        });

        expect(next.stats.currentStreak).toBe(carriedChainForNextFloor(1));
        expect(next.stats.currentStreak).toBe(1);
        // The floor's own record starts empty: a carried chain is not one this board saw.
        expect(next.bestChainThisFloor).toBe(0);
        // The cascade momentum crosses with the chain: the meter persists whole until a miss.
        expect(next.chunkPairsThisChain).toBe(5);
        expect(next.comboLinksCarried).toBe(1);
    });

    it('carries the whole combo and its ladder, so the floor opens on the tier the player built', () => {
        const baseRun = createNewRun(0, { runSeed: 12 });
        const nextBoard = { ...baseRun.board!, level: 4 };
        const run = {
            ...baseRun,
            status: 'levelComplete' as const,
            stats: { ...baseRun.stats, currentStreak: 40 }
        };

        const next = createNextFloorRunState(run, {
            activeMutators: run.activeMutators,
            board: nextBoard,
            memorizeRemainingMs: 2500
        });

        expect(next.stats.currentStreak).toBe(40);
        expect(runLadderChain(next)).toBe(40);
        expect(getChainTier(runLadderChain(next), nextBoard.pairCount)).toBe('fever');
        expect(runChainTier(next)).toBe('fever');
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
