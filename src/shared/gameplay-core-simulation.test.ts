import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import {
    runGameplayCoreSimulation,
    runGameplayInterludeTerminalSimulation,
    runGameplayRunFinalizationSimulation,
    runGameplayProgressionRepairSimulation
} from './gameplay-core-simulation';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { createTimerState } from './run-timer-rules';
import { createRunShopOffers } from './shop-rules';
import { EXIT_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const initialRun = (seed: number, gameMode: RunState['gameMode'] = 'endless'): RunState => {
    const base = {
        status: 'memorize',
        lives: 3,
        board: {
            level: 3,
            pairCount: 3,
            columns: 3,
            rows: 3,
            tiles: [
                tile('echo-a', 'echo', 'echo'),
                tile('echo-b', 'echo', 'echo'),
                tile('conduit-a', 'conduit', 'conduit'),
                tile('conduit-b', 'conduit', 'conduit'),
                tile('plain-a', 'plain'),
                tile('wild', WILD_PAIR_KEY)
            ],
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null
        } satisfies BoardState,
        runSeed: seed,
        runRulesVersion: 1,
        gameMode,
        gauntletDeadlineMs: gameMode === 'gauntlet' ? 10_000 : null,
        practiceMode: true,
        wildMenuRun: true,
        wildMatchesRemaining: 1,
        flipHistory: [],
        timerState: createTimerState({ memorizeRemainingMs: 900 }),
        resolveDelayMultiplier: 1,
        echoFeedbackEnabled: false,
        dungeonTrapsTriggered: 0,
        pendingMemorizeBonusMs: 0,
        peekCharges: 0,
        flashPairCharges: 1,
        flashPairRevealedTileIds: [],
        undoUsesThisFloor: 1,
        strayRemoveCharges: 1,
        recallFocus: 0,
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
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        shopGold: 10,
        shopRerolls: 0,
        shopOffers: [],
        stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 2 }
    } as unknown as RunState;
    return { ...base, shopOffers: createRunShopOffers(base) };
};

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
                'phase.memorize_complete',
                'run.pause',
                'run.resume',
                'debug.reveal_activate',
                'debug.reveal_deactivate',
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
                'shop.reroll',
                'dungeon.exit_activate',
                'board.destroy_pair',
                'floor.hazard_banish',
                'floor.advance',
                'route.choose',
                'relic.offer_open',
                'relic.pick',
                'relic.offer_service_use',
                'side_room.resolve',
                'board.tile_flip',
                'enemy_hazard.contact',
                'wild_match.consume',
                'board.turn_resolve'
            ])
        );
        expect(first.commandTypeCounts['wild_match.consume']).toBe(1);
        expect(first.commandTypeCounts['board.turn_resolve']).toBe(3);
        expect(first.commandTypeCounts['phase.memorize_complete']).toBe(2);
        expect(first.commandTypeCounts['route.choose']).toBe(1);
        expect(first.commandTypeCounts['relic.offer_open']).toBe(1);
        expect(first.commandTypeCounts['relic.pick']).toBe(1);
        expect(first.commandTypeCounts['relic.offer_service_use']).toBe(1);
        expect(first.commandTypeCounts['side_room.resolve']).toBe(1);
        expect(first.commandTypeCounts['floor.advance']).toBe(1);
        expect(first.eventTypeCounts['wild_match.consumed']).toBe(1);
        expect(first.eventTypeCounts['board.turn_resolved']).toBe(3);
        expect(first.acceptedCommandIds).toContain('sim:7241:0000');
        expect(first.acceptedCommandTypeCounts['phase.memorize_complete']).toBe(2);
        expect(first.eventTypeCounts['phase.memorize_completed']).toBe(2);
        expect(first.commandTypeCounts['run.pause']).toBe(1);
        expect(first.commandTypeCounts['run.resume']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0023');
        expect(first.acceptedCommandIds).toContain('sim:7241:0024');
        expect(first.acceptedCommandTypeCounts['run.pause']).toBe(1);
        expect(first.acceptedCommandTypeCounts['run.resume']).toBe(1);
        expect(first.eventTypeCounts['run.paused']).toBe(1);
        expect(first.eventTypeCounts['run.resumed']).toBe(1);
        expect(first.acceptedCommandIds).toEqual(expect.arrayContaining([
            'sim:7241:0025',
            'sim:7241:0026',
            'sim:7241:0027'
        ]));
        expect(first.acceptedCommandTypeCounts['debug.reveal_activate']).toBe(1);
        expect(first.acceptedCommandTypeCounts['debug.reveal_deactivate']).toBe(1);
        expect(first.eventTypeCounts['debug.reveal_activated']).toBe(1);
        expect(first.eventTypeCounts['debug.reveal_deactivated']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0001');
        expect(first.acceptedCommandTypeCounts['board.tile_flip']).toBeGreaterThanOrEqual(1);
        expect(first.eventTypeCounts['board.tile_flipped']).toBeGreaterThanOrEqual(1);
        expect(first.rejectedCommandIds).toContain('sim:7241:0004');
        expect(first.acceptedCommandIds).toContain('sim:7241:0011');
        expect(first.acceptedCommandTypeCounts['route.choose']).toBe(1);
        expect(first.eventTypeCounts['route.choice_selected']).toBe(1);
        expect(first.eventTypeCounts['side_room.opened']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0012');
        expect(first.acceptedCommandTypeCounts['side_room.resolve']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0013');
        expect(first.acceptedCommandTypeCounts['shop.purchase']).toBeGreaterThanOrEqual(1);
        expect(first.eventTypeCounts['shop.offer_purchased']).toBeGreaterThanOrEqual(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0015');
        expect(first.acceptedCommandTypeCounts['relic.offer_open']).toBe(1);
        expect(first.eventTypeCounts['relic.offer_opened']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0016');
        expect(first.acceptedCommandTypeCounts['relic.offer_service_use']).toBe(1);
        expect(first.eventTypeCounts['relic.offer_service_used']).toBe(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0017');
        expect(first.acceptedCommandTypeCounts['relic.pick']).toBe(1);
        expect(first.eventTypeCounts['relic.picked']).toBe(1);
        expect(first.rejectedCommandIds).toContain('sim:7241:0019');
        expect(first.rejectedCommandTypeCounts['enemy_hazard.contact']).toBeGreaterThanOrEqual(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0014');
        expect(first.acceptedCommandTypeCounts['shop.reroll']).toBeGreaterThanOrEqual(1);
        expect(first.eventTypeCounts['shop.stock_rerolled']).toBeGreaterThanOrEqual(1);
        expect(first.acceptedCommandIds).toContain('sim:7241:0018');
        expect(first.acceptedCommandTypeCounts['floor.advance']).toBe(1);
        expect(first.finalRun.wildMatchesRemaining).toBe(0);
    });

    it('replays a serialized Gauntlet deadline observation deterministically', () => {
        const first = runGameplayCoreSimulation(initialRun(913, 'gauntlet'), { seed: 913, steps: 23 });
        const second = runGameplayCoreSimulation(initialRun(913, 'gauntlet'), { seed: 913, steps: 23 });

        expect(first).toEqual(second);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.commands[22]).toMatchObject({
            commandId: 'sim:913:0022',
            type: 'run.gauntlet_expire'
        });
        expect(first.acceptedCommandIds).toContain('sim:913:0022');
        expect(first.acceptedCommandTypeCounts['run.gauntlet_expire']).toBe(1);
        expect(first.eventTypeCounts['run.gauntlet_expired']).toBe(1);
        expect(first.finalRun.status).toBe('gameOver');
        expect(first.finalRun.lives).toBe(0);
    });

    it('replays an accepted stale-lock and enemy-hazard safety repair', () => {
        const base = initialRun(818);
        const repairRun: RunState = {
            ...base,
            board: {
                level: 5,
                pairCount: 1,
                columns: 2,
                rows: 2,
                tiles: [
                    { ...tile('pair-a', 'pair'), state: 'matched' },
                    { ...tile('pair-b', 'pair'), state: 'matched' },
                    {
                        ...tile('exit', EXIT_PAIR_KEY),
                        state: 'flipped',
                        dungeonCardKind: 'exit',
                        dungeonExitLockKind: 'iron'
                    }
                ],
                flippedTileIds: ['exit'],
                matchedPairs: 1,
                floorArchetypeId: null,
                featuredObjectiveId: null,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron',
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                enemyHazards: [
                    {
                        id: 'sim-stale-warden',
                        kind: 'warden',
                        label: 'Sim Stale Warden',
                        currentTileId: 'pair-a',
                        nextTileId: 'pair-b',
                        pattern: 'guard',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 1,
                        bossId: 'trap_warden'
                    }
                ]
            },
            dungeonKeys: {},
            dungeonMasterKeys: 0,
            dungeonEnemiesDefeated: 0,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 0,
            status: 'levelComplete'
        };

        const first = runGameplayProgressionRepairSimulation(repairRun);
        const second = runGameplayProgressionRepairSimulation(repairRun);

        expect(first).toEqual(second);
        expect(first.accepted).toBe(true);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.command).toMatchObject({ type: 'run.progression_repair' });
        expect(first.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'run.progression_repaired',
                repairKinds: ['exit_lock', 'exit_metadata', 'enemy_hazard'],
                enemyHazardIdsDefeated: ['sim-stale-warden']
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'safety.progression.repaired' })
        ]));
        expect(first.finalRun.board?.dungeonExitLockKind).toBe('none');
        expect(first.finalRun.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
    });

    it('replays an accepted zero-life interlude terminal transition', () => {
        const source = createPlayablePathFixture('sideRoomThenShop').run!;
        const terminalRun: RunState = {
            ...source,
            lives: 0,
            pendingRouteCardPlan: {
                choiceId: 'terminal-safe',
                routeType: 'safe',
                sourceLevel: source.board?.level ?? 1,
                targetLevel: (source.board?.level ?? 1) + 1
            },
            relicOffer: createPlayablePathFixture('relicDraft').run!.relicOffer
        };

        const first = runGameplayInterludeTerminalSimulation(terminalRun);
        const second = runGameplayInterludeTerminalSimulation(terminalRun);

        expect(first).toEqual(second);
        expect(first.accepted).toBe(true);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.command).toMatchObject({ type: 'run.interlude_terminal_resolve' });
        expect(first.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'run.interlude_terminal_resolved',
                cause: 'zero_lives',
                pendingRouteCleared: true,
                sideRoomCleared: true,
                relicOfferCleared: true
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.interlude.terminal' })
        ]));
        expect(first.finalRun).toMatchObject({
            lives: 0,
            pendingRouteCardPlan: null,
            relicOffer: null,
            shopOffers: [],
            sideRoom: null,
            status: 'gameOver'
        });
    });

    it('replays a validated terminal summary with exact finalization facts', () => {
        const source = createPlayablePathFixture('sideRoomThenShop').run!;
        const terminal = runGameplayInterludeTerminalSimulation({ ...source, lives: 0 });
        const terminalRun: RunState = {
            ...terminal.finalRun,
            achievementsEnabled: true,
            stats: {
                ...terminal.finalRun.stats,
                totalScore: 1_820,
                levelsCleared: 4,
                highestLevel: 5
            }
        };

        const first = runGameplayRunFinalizationSimulation(terminalRun, [
            'ACH_FIRST_CLEAR',
            'ACH_LEVEL_FIVE'
        ]);
        const second = runGameplayRunFinalizationSimulation(terminalRun, [
            'ACH_FIRST_CLEAR',
            'ACH_LEVEL_FIVE'
        ]);

        expect(first).toEqual(second);
        expect(first.accepted).toBe(true);
        expect(first.replayDeterministic).toBe(true);
        expect(first.invariantViolations).toEqual([]);
        expect(first.command).toMatchObject({
            type: 'run.finalize',
            unlockedAchievements: ['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE']
        });
        expect(first.events).toEqual([
            expect.objectContaining({
                type: 'run.finalized',
                totalScore: 1_820,
                levelsCleared: 4,
                highestLevel: 5,
                unlockedAchievements: ['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE'],
                summaryValidated: true
            })
        ]);
        expect(first.finalRun.lastRunSummary).toMatchObject({
            totalScore: 1_820,
            levelsCleared: 4,
            highestLevel: 5,
            unlockedAchievements: ['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE']
        });
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
