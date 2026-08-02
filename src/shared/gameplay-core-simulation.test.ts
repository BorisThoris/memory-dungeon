import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { runGameplayCoreSimulation } from './gameplay-core-simulation';
import { WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const initialRun = (seed: number): RunState => ({
    status: 'playing',
    board: {
        level: 1,
        pairCount: 3,
        columns: 3,
        rows: 3,
        tiles: [
            tile('echo-a', 'echo', 'echo'),
            tile('echo-b', 'echo', 'echo'),
            tile('conduit-a', 'conduit', 'conduit'),
            tile('conduit-b', 'conduit', 'conduit'),
            { ...tile('plain-a', 'plain'), state: 'flipped' },
            tile('plain-b', 'plain'),
            { ...tile('wild', WILD_PAIR_KEY), state: 'flipped' }
        ],
        flippedTileIds: ['plain-a', 'wild'],
        matchedPairs: 0,
        floorArchetypeId: null,
        featuredObjectiveId: null
    } satisfies BoardState,
    runSeed: seed,
    runRulesVersion: 1,
    practiceMode: true,
    wildMenuRun: true,
    wildTileId: 'wild',
    wildMatchesRemaining: 1,
    peekCharges: 0,
    flashPairCharges: 1,
    flashPairRevealedTileIds: [],
    undoUsesThisFloor: 1,
    strayRemoveCharges: 1,
    strayRemoveArmed: true,
    recallFocus: 3,
    rewardPerkIds: [],
    relicIds: [
        'combo_shard_plus_step',
        'guard_token_plus_one',
        'chapter_compass',
        'wager_surety',
        'parasite_ledger'
    ],
    powersUsedThisRun: false,
    forgottenTileIdsThisFloor: [],
    peekRevealedTileIds: [],
    stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 2 }
} as unknown as RunState);

describe('seeded gameplay core simulation', () => {
    it('is deterministic, replayable, schema-valid, and invariant-clean', () => {
        const first = runGameplayCoreSimulation(initialRun(7241), { seed: 7241, steps: 384 });
        const second = runGameplayCoreSimulation(initialRun(7241), { seed: 7241, steps: 384 });

        expect(first).toEqual(second);
        expect(first.commands).toHaveLength(384);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.acceptedCommandIds.length + first.rejectedCommandIds.length).toBe(384);
        expect(Object.keys(first.commandTypeCounts)).toEqual(
            expect.arrayContaining([
                'bonus_reward.echo_conduit_lens',
                'relic.peek_charge_plus_one',
                'reward_perk.echo_conduit_double',
                'bonus_reward.hazard_ward',
                'relic.guard_token_plus_one',
                'trait.volatile_heavy_guard',
                'relic.guard_token_plus_one.mirror_match',
                'bonus_reward.bonus_shards',
                'bonus_reward.supply_cache',
                'relic.combo_shard_plus_step',
                'findable.shard_spark',
                'relic.combo_shard_plus_step.sealed_match',
                'bonus_reward.hazard_banisher',
                'relic.destroy_bank_plus_one',
                'findable.ward_spark',
                'bonus_reward.chest_gold',
                'bonus_reward.cursed_opener_contract',
                'reward_perk.cursed_opener_greed',
                'relic.shrine_echo',
                'findable.score_glint',
                'relic.chapter_compass',
                'relic.wager_surety',
                'relic.parasite_ledger',
                'relic.chapter_compass.boss_trophy',
                'relic.wager_surety.wager_won',
                'relic.wager_surety.wager_lost',
                'relic.parasite_ledger.featured_objective',
                'bonus_reward.secret_favor',
                'relic.stray_charge_plus_one',
                'relic.pin_cap_plus_one',
                'findable.scout_glint',
                'bonus_reward.trait_toolkit',
                'bonus_reward.stasis_lockbox',
                'bonus_reward.free_swap_floor',
                'relic.extra_shuffle_charge',
                'relic.first_shuffle_free_per_floor',
                'relic.region_shuffle_free_first',
                'bonus_reward.trait_streak_lens',
                'reward_perk.trait_streak_toolkit',
                'relic.memorize_bonus_ms',
                'relic.memorize_under_short_memorize',
                'bonus_reward.key_insurance',
                'board.peek',
                'board.pin_toggle',
                'board.stray_remove',
                'risk_wager.accept',
                'board.gambit_commit',
                'board.shuffle',
                'board.region_shuffle',
                'board.tile_swap',
                'board.flash_pair',
                'board.undo_resolve',
                'shop.purchase',
                'dungeon.exit_activate',
                'board.destroy_pair',
                'floor.hazard_banish',
                'route.choose',
                'wild_match.consume'
            ])
        );
        expect(first.commandTypeCounts['wild_match.consume']).toBe(1);
        expect(first.commandTypeCounts['route.choose']).toBe(1);
        expect(first.eventTypeCounts['wild_match.consumed']).toBe(1);
        expect(first.finalRun.wildMatchesRemaining).toBe(0);
    });

    it('sweeps distinct seeds without negative inventory or replay drift', () => {
        const reports = [11, 29, 47, 83, 131].map((seed) =>
            runGameplayCoreSimulation(initialRun(seed), { seed, steps: 96, invalidTraitChance: 0.35 })
        );

        expect(reports.every((report) => report.replayDeterministic)).toBe(true);
        expect(reports.flatMap((report) => report.invariantViolations)).toEqual([]);
        expect(new Set(reports.map((report) => JSON.stringify(report.commandTypeCounts))).size).toBeGreaterThan(1);
        expect(reports.some((report) => report.rejectedCommandIds.length > 0)).toBe(true);
    });
});
