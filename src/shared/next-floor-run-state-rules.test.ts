import { describe, expect, it } from 'vitest';
import { type RelicId, type RewardPerkId, type RunState } from './contracts';
import { createNewRun } from './game';
import { createNextFloorRunState } from './next-floor-run-state-rules';
import { createRunShopOffers } from './shop-rules';

describe('createNextFloorRunState', () => {
    it('resets per-floor counters and prepares memorize timing for the next board', () => {
        const baseRun = createNewRun(0, { runSeed: 12 });
        const run = {
            ...baseRun,
            status: 'levelComplete' as const,
            lives: 2,
            pendingMemorizeBonusMs: 900,
            pinnedTileIds: ['old'],
            matchResolutionsThisFloor: 7,
            findablesClaimedThisFloor: 2,
            recallMatchesThisFloor: 3,
            hazardTileTriggersThisFloor: 4,
            hazardShuffleSnaresThisFloor: 1,
            dungeonTrapsResolvedThisFloor: 2,
            enemyHazardsDefeatedThisFloor: 1,
            shopOffers: createRunShopOffers(baseRun).slice(0, 1),
            shopRerolls: 1,
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
            lives: 2,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: { ...nextBoard, level: 4 },
            parasiteFloors: 1,
            parasiteWardRemaining: 0,
            memorizeRemainingMs: 2500
        });

        expect(next.status).toBe('memorize');
        expect(next.activeMutators).toEqual(run.activeMutators);
        expect(next.pendingRouteCardPlan).toBeNull();
        expect(next.sideRoom).toBeNull();
        expect(next.pendingMemorizeBonusMs).toBe(0);
        expect(next.pinnedTileIds).toEqual([]);
        expect(next.matchResolutionsThisFloor).toBe(0);
        expect(next.findablesClaimedThisFloor).toBe(0);
        expect(next.recallMatchesThisFloor).toBe(0);
        expect(next.hazardTileTriggersThisFloor).toBe(0);
        expect(next.hazardShuffleSnaresThisFloor).toBe(0);
        expect(next.dungeonTrapsResolvedThisFloor).toBe(0);
        expect(next.enemyHazardsDefeatedThisFloor).toBe(0);
        expect(next.shopOffers).toEqual([]);
        expect(next.shopRerolls).toBe(0);
        expect(next.timerState).toMatchObject({
            memorizeRemainingMs: 2500,
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

    it('restores per-floor relic free-use flags', () => {
        const run = {
            ...createNewRun(0, { runSeed: 15 }),
            relicIds: ['first_shuffle_free_per_floor', 'region_shuffle_free_first'] satisfies RelicId[],
            freeShuffleThisFloor: false,
            regionShuffleFreeThisFloor: false
        };
        const nextBoard = run.board!;

        const next = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: nextBoard,
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });

        expect(next.freeShuffleThisFloor).toBe(true);
        expect(next.regionShuffleFreeThisFloor).toBe(true);
    });

    it('ignores malformed relic ids before restoring per-floor relic flags', () => {
        const run = {
            ...createNewRun(0, { runSeed: 15 }),
            relicIds: Number.NaN as unknown as RelicId[],
            freeShuffleThisFloor: false,
            regionShuffleFreeThisFloor: false
        };
        const next = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: run.board!,
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });

        expect(next.freeShuffleThisFloor).toBe(false);
        expect(next.regionShuffleFreeThisFloor).toBe(false);
    });

    it('normalizes malformed stat records before resetting next-floor stats', () => {
        const run = {
            ...createNewRun(0, { runSeed: 17 }),
            stats: Number.NaN as unknown as RunState['stats']
        };
        const next = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: { ...run.board!, level: 4 },
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });

        expect(next.stats.totalScore).toBe(0);
        expect(next.stats.currentLevelScore).toBe(0);
        expect(next.stats.tries).toBe(0);
        expect(next.stats.currentStreak).toBe(0);
        expect(next.stats.highestLevel).toBe(4);
    });

    it('restores durable reward perk floor benefits without bypassing contracts', () => {
        const run = {
            ...createNewRun(0, { runSeed: 16 }),
            rewardPerkIds: ['free_first_swap_per_floor', 'hazard_banish_per_floor'] satisfies RewardPerkId[],
            regionShuffleFreeThisFloor: false,
            destroyPairCharges: 0
        };
        const hazardBoard = {
            ...run.board!,
            tiles: run.board!.tiles.map((tile, index) =>
                index < 2
                    ? { ...tile, pairKey: 'hazard-pair', tileHazardKind: 'shuffle_snare' as const }
                    : tile
            )
        };
        const noDestroyRun = {
            ...run,
            activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
        };

        const next = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: hazardBoard,
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });
        const fallbackNext = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: run.board!,
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });
        const noDestroyNext = createNextFloorRunState(noDestroyRun, {
            lives: noDestroyRun.lives,
            activeMutators: noDestroyRun.activeMutators,
            dungeonRun: noDestroyRun.dungeonRun,
            board: hazardBoard,
            parasiteFloors: noDestroyRun.parasiteFloors,
            parasiteWardRemaining: noDestroyRun.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });

        expect(next.regionShuffleFreeThisFloor).toBe(true);
        expect(next.destroyPairCharges).toBe(0);
        expect(next.board!.tiles.filter((tile) => tile.pairKey === 'hazard-pair').map((tile) => tile.tileHazardKind)).toEqual([
            undefined,
            undefined
        ]);
        expect(fallbackNext.destroyPairCharges).toBe(1);
        expect(noDestroyNext.destroyPairCharges).toBe(0);
        expect(noDestroyNext.board!.tiles.filter((tile) => tile.pairKey === 'hazard-pair').map((tile) => tile.tileHazardKind)).toEqual([
            'shuffle_snare',
            'shuffle_snare'
        ]);
        expect(next.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'hazard_banish.resolved', outcome: 'hazard_removed' })
        ]));
        expect(fallbackNext.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'hazard_banish.resolved', outcome: 'destroy_charge_granted' })
        ]));
        expect(noDestroyNext.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'hazard_banish.resolved', outcome: 'contract_blocked' })
        ]));
        expect(next.gameplayCommandJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'floor.hazard_banish' })
        ]));
    });

    it('treats malformed reward perks as empty before restoring floor benefits', () => {
        const run = {
            ...createNewRun(0, { runSeed: 18 }),
            rewardPerkIds: Number.NaN as unknown as RunState['rewardPerkIds'],
            regionShuffleFreeThisFloor: false,
            destroyPairCharges: 0
        };

        const next = createNextFloorRunState(run, {
            lives: run.lives,
            activeMutators: run.activeMutators,
            dungeonRun: run.dungeonRun,
            board: run.board!,
            parasiteFloors: run.parasiteFloors,
            parasiteWardRemaining: run.parasiteWardRemaining,
            memorizeRemainingMs: 1000
        });

        expect(next.regionShuffleFreeThisFloor).toBe(false);
        expect(next.destroyPairCharges).toBe(0);
    });
});
