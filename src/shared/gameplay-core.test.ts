import { describe, expect, it } from 'vitest';
import {
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap
} from './board-power-actions';
import { togglePinnedTile } from './board-power-state';
import { BONUS_REWARD_CATALOG, previewBonusRewardClaim } from './bonus-rewards';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    GAME_RULES_VERSION,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import {
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
    BOARD_TACTICIAN_DEFINITIONS,
    COMBO_SHARD_ENGINE_DEFINITIONS,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    SABOTEUR_DEFINITIONS,
    SEER_DEFINITIONS,
    SLAYER_DEFINITIONS,
    VAULTBREAKER_DEFINITIONS,
    WARDEN_DEFINITIONS,
    createGameplayDefinitionCommand,
    createGameplayGambitCommitCommand,
    createGameplayPeekCommand,
    createGameplayPinToggleCommand,
    createGameplayRegionShuffleCommand,
    createGameplayRiskWagerAcceptCommand,
    createGameplayShuffleCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileSwapCommand,
    gameplayCommandSchema,
    gameplayContentDefinitionSchema,
    gameplayEventSchema
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import {
    applyRelicImmediateThroughGameplayCore,
    resolveFindableMatchRewardThroughGameplayCore,
    resolveSlayerFloorClearThroughGameplayCore
} from './gameplay-core-adapters';
import { applyRelicImmediate } from './relic-immediate-rules';
import { resolveTileTraitEffects } from './tile-trait-rules';

const tile = (id: string, pairKey: string, tileTraitKind?: Tile['tileTraitKind']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    tileTraitKind
});

const board = (): BoardState => ({
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    tiles: [tile('echo-a', 'echo', 'echo'), tile('echo-b', 'echo', 'echo'), tile('conduit-a', 'conduit', 'conduit'), tile('plain-a', 'plain')],
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        status: 'playing',
        board: board(),
        runSeed: 91,
        runRulesVersion: 1,
        peekCharges: 0,
        recallFocus: 2,
        rewardPerkIds: [],
        relicIds: [],
        powersUsedThisRun: false,
        forgottenTileIdsThisFloor: [],
        peekRevealedTileIds: [],
        stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 },
        ...overrides
    }) as RunState;

describe('deterministic gameplay core', () => {
    it('validates commands, effects, conditions, and definitions as strict serializable contracts', () => {
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.echo_conduit_lens',
            'relic.peek_charge_plus_one',
            'reward_perk.echo_conduit_double'
        ]);
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.every((definition) => gameplayContentDefinitionSchema.safeParse(definition).success)).toBe(true);
        expect(
            gameplayCommandSchema.safeParse({
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: 'bad',
                type: 'effects.apply',
                definitionId: 'relic.peek_charge_plus_one',
                definitionVersion: 1,
                facts: {},
                undocumentedMutation: true
            }).success
        ).toBe(false);
        expect(
            gameplayContentDefinitionSchema.safeParse({
                ...CONDUIT_CARTOGRAPHER_DEFINITIONS[0],
                effects: [{ kind: 'inventory.grant', itemId: 'peek_charge', amount: 0 }]
            }).success
        ).toBe(false);
    });

    it('matches the existing Echo Conduit Lens payout for perk and Peek inventory state', () => {
        const initial = run();
        const reward = {
            ...BONUS_REWARD_CATALOG.echo_conduit_lens,
            instanceId: 'reward:echo-conduit-lens:91',
            runSeed: initial.runSeed,
            rulesVersion: initial.runRulesVersion,
            floor: 3,
            offlineOnly: true as const,
            eligible: true,
            unavailableReason: null
        };
        const legacy = previewBonusRewardClaim(initial, reward).run;
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('claim-lens', 'bonus_reward.echo_conduit_lens')
        );

        expect(result.accepted).toBe(true);
        expect(result.run.peekCharges).toBe(legacy.peekCharges);
        expect(result.run.rewardPerkIds).toEqual(legacy.rewardPerkIds);
        expect(result.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'reward_perk.granted', perkId: 'echo_conduit_double', newlyGranted: true }),
                expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.echo_conduit_lens.claimed' })
            ])
        );
    });

    it('matches the current Peek relic immediate effect', () => {
        const initial = run({ peekCharges: 2 });
        const legacy = applyRelicImmediate(initial, 'peek_charge_plus_one');
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('pick-peek-relic', 'relic.peek_charge_plus_one')
        );

        expect(result.accepted).toBe(true);
        expect(result.run.peekCharges).toBe(legacy.peekCharges);
        expect(result.events[0]).toMatchObject({
            eventId: 'pick-peek-relic:0',
            type: 'inventory.changed',
            source: { kind: 'relic', id: 'peek_charge_plus_one' }
        });
    });

    it('models the Warden reward, relic, trait guard, and capped Mirror overflow as one build', () => {
        expect(WARDEN_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.hazard_ward',
            'relic.guard_token_plus_one',
            'trait.volatile_heavy_guard',
            'relic.guard_token_plus_one.mirror_match'
        ]);
        const initial = run({
            destroyPairCharges: 0,
            relicIds: ['guard_token_plus_one'],
            stats: { ...run().stats, guardTokens: 0, comboShards: 0 }
        });
        const reward = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('warden-reward', 'bonus_reward.hazard_ward')
        );
        const braced = reduceGameplayCommand(
            reward.run,
            createGameplayDefinitionCommand('warden-trait', 'trait.volatile_heavy_guard', {
                matchedTraits: ['volatile'],
                adjacentTraits: ['heavy']
            })
        );
        const overflow = reduceGameplayCommand(
            braced.run,
            createGameplayDefinitionCommand('warden-overflow', 'relic.guard_token_plus_one.mirror_match', {
                matchedTraits: ['mirror']
            })
        );

        expect(reward.run).toMatchObject({ destroyPairCharges: 1, stats: { guardTokens: 1 } });
        expect(braced.run.stats.guardTokens).toBe(2);
        expect(overflow.run.stats).toMatchObject({ guardTokens: 2, totalScore: 20, currentLevelScore: 20 });
        expect(overflow.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', itemId: 'guard_token', applied: 0 }),
                expect.objectContaining({ type: 'score.changed', reason: 'inventory_overflow', amount: 20 }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.warden_sigil.mirror_triggered' })
            ])
        );
    });

    it('models Combo Shard sources, typed match requests, and capped Sealed overflow', () => {
        expect(COMBO_SHARD_ENGINE_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.bonus_shards',
            'relic.combo_shard_plus_step',
            'findable.shard_spark',
            'relic.combo_shard_plus_step.sealed_match'
        ]);
        const initial = run({
            relicIds: ['combo_shard_plus_step'],
            stats: { ...run().stats, comboShards: 2, guardTokens: 0 }
        });
        const pickup = resolveFindableMatchRewardThroughGameplayCore(initial, 'shard_spark', 'catalyst-findable');
        const overflow = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('catalyst-overflow', 'relic.combo_shard_plus_step.sealed_match', {
                matchedTraits: ['sealed']
            })
        );

        expect(pickup).toMatchObject({ migrated: true, comboShardGain: 1 });
        expect(pickup.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'combo_shard.requested', amount: 1, source: { kind: 'findable', id: 'shard_spark' } }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.shard_spark.matched' })
            ])
        );
        expect(overflow.run.stats).toMatchObject({ comboShards: 2, totalScore: 18, currentLevelScore: 18 });
        expect(overflow.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', itemId: 'combo_shard', applied: 0 }),
                expect.objectContaining({ type: 'score.changed', reason: 'inventory_overflow', amount: 18 })
            ])
        );
    });

    it('models the Saboteur reward, Breaker Chisel, and Ward Spark as one trap-control build', () => {
        expect(SABOTEUR_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.hazard_banisher',
            'relic.destroy_bank_plus_one',
            'findable.ward_spark'
        ]);
        const initial = run({ destroyPairCharges: 0 });
        const reward = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('saboteur-reward', 'bonus_reward.hazard_banisher')
        );
        const relic = applyRelicImmediateThroughGameplayCore(
            reward.run,
            'destroy_bank_plus_one',
            'saboteur-relic'
        );
        const ward = resolveFindableMatchRewardThroughGameplayCore(
            relic.run,
            'ward_spark',
            'saboteur-ward'
        );

        expect(reward.run).toMatchObject({
            destroyPairCharges: 1,
            rewardPerkIds: ['hazard_banish_per_floor']
        });
        expect(relic).toMatchObject({ migrated: true, run: { destroyPairCharges: 2 } });
        expect(ward).toMatchObject({ migrated: true, comboShardGain: 0, safeHazardWardGain: 1 });
        expect(ward.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'safe_hazard_ward.requested',
                amount: 1,
                source: { kind: 'findable', id: 'ward_spark' }
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.ward_spark.matched' })
        ]));
    });

    it('models Vaultbreaker treasure extraction from chest through opener, Shrine Echo, and Score Glint', () => {
        expect(VAULTBREAKER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.chest_gold',
            'bonus_reward.cursed_opener_contract',
            'reward_perk.cursed_opener_greed',
            'relic.shrine_echo',
            'findable.score_glint'
        ]);
        const initial = run({ dungeonKeys: {}, shopGold: 0, bonusRelicPicksNextOffer: 0, matchResolutionsThisFloor: 0 });
        const chest = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('vault-chest', 'bonus_reward.chest_gold')
        );
        const contract = reduceGameplayCommand(
            chest.run,
            createGameplayDefinitionCommand('vault-contract', 'bonus_reward.cursed_opener_contract')
        );
        const opener = reduceGameplayCommand(
            contract.run,
            createGameplayDefinitionCommand('vault-opener', 'reward_perk.cursed_opener_greed', {
                matchedTraits: ['cursed']
            })
        );
        const relic = applyRelicImmediateThroughGameplayCore(opener.run, 'shrine_echo', 'vault-relic');
        const glint = resolveFindableMatchRewardThroughGameplayCore(relic.run, 'score_glint', 'vault-glint');

        expect(chest.run).toMatchObject({ dungeonKeys: { iron: 1 }, shopGold: 2, stats: { totalScore: 25 } });
        expect(contract.run).toMatchObject({ shopGold: 3, rewardPerkIds: ['cursed_opener_greed'] });
        expect(opener.run).toMatchObject({ shopGold: 4, stats: { totalScore: 50, currentLevelScore: 50 } });
        expect(relic).toMatchObject({ migrated: true, run: { bonusRelicPicksNextOffer: 1 } });
        expect(glint).toMatchObject({ migrated: true, scoreGain: 25 });
        expect(glint.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.score_glint.matched' })
        ]));

        const lateOpener = reduceGameplayCommand(
            { ...contract.run, matchResolutionsThisFloor: 1 },
            createGameplayDefinitionCommand('vault-late-opener', 'reward_perk.cursed_opener_greed', {
                matchedTraits: ['cursed']
            })
        );
        expect(lateOpener).toMatchObject({ accepted: false });
        expect(lateOpener.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('floor match resolutions') })
        ]);
    });

    it('models Slayer preparation and typed floor-clear extraction across boss, wager, and parasite hooks', () => {
        expect(SLAYER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'relic.chapter_compass',
            'relic.wager_surety',
            'relic.parasite_ledger',
            'relic.chapter_compass.boss_trophy',
            'relic.wager_surety.wager_won',
            'relic.wager_surety.wager_lost',
            'relic.parasite_ledger.featured_objective'
        ]);
        const initial = run({
            relicIds: ['chapter_compass', 'wager_surety', 'parasite_ledger'],
            peekCharges: 0,
            parasiteWardRemaining: 0
        });
        const compass = applyRelicImmediateThroughGameplayCore(initial, 'chapter_compass', 'slayer-compass');
        const surety = applyRelicImmediateThroughGameplayCore(compass.run, 'wager_surety', 'slayer-surety');
        const ledger = applyRelicImmediateThroughGameplayCore(surety.run, 'parasite_ledger', 'slayer-ledger');
        const won = resolveSlayerFloorClearThroughGameplayCore(
            ledger.run,
            {
                bossTrophyClaimed: true,
                riskWagerOutcome: 'won',
                featuredObjectiveCompleted: true,
                scoreParasiteActive: true
            },
            'slayer-clear-won'
        );
        const lost = resolveSlayerFloorClearThroughGameplayCore(
            ledger.run,
            {
                bossTrophyClaimed: false,
                riskWagerOutcome: 'lost',
                featuredObjectiveCompleted: false,
                scoreParasiteActive: true
            },
            'slayer-clear-lost'
        );

        expect(compass).toMatchObject({ migrated: true, run: { peekCharges: 1 } });
        expect(surety).toMatchObject({ migrated: true, run: { stats: { guardTokens: 1 } } });
        expect(ledger).toMatchObject({ migrated: true, run: { parasiteWardRemaining: 1 } });
        expect(won).toMatchObject({ bossTrophyScoreGain: 30, riskWagerFavorGain: 1, parasiteRelief: 1 });
        expect(won.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'boss_trophy', amount: 30 }),
            expect.objectContaining({ type: 'relic_favor.requested', reason: 'risk_wager_win', amount: 1 }),
            expect.objectContaining({ type: 'parasite_relief.requested', reason: 'featured_objective_clear', amount: 1 })
        ]));
        expect(lost).toMatchObject({ riskWagerFavorGain: 0, riskWagerStreakFloor: 1, parasiteRelief: 0 });
        expect(lost.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'featured_streak_floor.requested', reason: 'risk_wager_loss', amount: 1 })
        ]));
    });

    it('models the Seer reward, relic tools, Scout Glint, and board decisions as one information-control build', () => {
        expect(SEER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.secret_favor',
            'relic.stray_charge_plus_one',
            'relic.pin_cap_plus_one',
            'findable.scout_glint'
        ]);
        const initial = run({
            peekCharges: 0,
            strayRemoveCharges: 0,
            pinnedTileIds: [],
            pinsPlacedCountThisRun: 0,
            relicFavorProgress: 2,
            bonusRelicPicksNextOffer: 0,
            favorBonusRelicPicksNextOffer: 0
        });
        const reward = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('seer-secret', 'bonus_reward.secret_favor')
        );
        const strayRelic = applyRelicImmediateThroughGameplayCore(
            reward.run,
            'stray_charge_plus_one',
            'seer-stray-hook'
        );
        const pinRelic = applyRelicImmediateThroughGameplayCore(
            strayRelic.run,
            'pin_cap_plus_one',
            'seer-memory-nail'
        );
        const glint = resolveFindableMatchRewardThroughGameplayCore(
            pinRelic.run,
            'scout_glint',
            'seer-scout-glint'
        );

        expect(reward.run).toMatchObject({
            peekCharges: 1,
            relicFavorProgress: 0,
            bonusRelicPicksNextOffer: 1,
            favorBonusRelicPicksNextOffer: 1
        });
        expect(reward.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'relic_favor.changed', progressBefore: 2, progressAfter: 0 }),
            expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 })
        ]));
        expect(strayRelic).toMatchObject({ migrated: true, run: { strayRemoveCharges: 1 } });
        expect(pinRelic).toMatchObject({ migrated: true });
        expect(pinRelic.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'pin_capacity.requested', amount: 1 })
        ]));
        expect(glint).toMatchObject({ migrated: true, scoutRevealGain: 1 });
        expect(glint.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'scout_reveal.requested', amount: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.scout_glint.matched' })
        ]));

        const pinCommand = createGameplayPinToggleCommand('seer-pin', 'echo-a');
        const pinned = reduceGameplayCommand(pinRelic.run, pinCommand);
        expect(pinned.accepted).toBe(true);
        expect(pinned.run).toEqual(togglePinnedTile(pinRelic.run, 'echo-a'));
        expect(pinned.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'board.pin_changed', targetTileId: 'echo-a', pinned: true })
        ]));

        const strayRun = {
            ...strayRelic.run,
            board: {
                ...board(),
                pairCount: 1,
                tiles: [tile('wild', '__wild__'), tile('plain-a', 'plain'), tile('plain-b', 'plain')]
            },
            strayRemoveArmed: true,
            recallFocus: 2
        } as RunState;
        const strayCommand = createGameplayStrayRemoveCommand('seer-stray', 'wild');
        const removed = reduceGameplayCommand(strayRun, strayCommand);
        expect(removed.accepted).toBe(true);
        expect(removed.run).toEqual(applyStrayRemove(strayRun, 'wild'));
        expect(removed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'stray_remove_charge', applied: -1 }),
            expect.objectContaining({ type: 'board.stray_removed', targetTileId: 'wild', recallFocusAfter: 1 })
        ]));
    });

    it('routes migrated relic immediates through the core while preserving legacy fallbacks', () => {
        const initial = run({ peekCharges: 2, shuffleCharges: 1 });
        const migrated = applyRelicImmediateThroughGameplayCore(initial, 'peek_charge_plus_one', 'adapter-peek');
        const migratedGuard = applyRelicImmediateThroughGameplayCore(initial, 'guard_token_plus_one', 'adapter-guard');
        const migratedCombo = applyRelicImmediateThroughGameplayCore(initial, 'combo_shard_plus_step', 'adapter-combo');
        const migratedDestroy = applyRelicImmediateThroughGameplayCore(initial, 'destroy_bank_plus_one', 'adapter-destroy');
        const migratedShrine = applyRelicImmediateThroughGameplayCore(initial, 'shrine_echo', 'adapter-shrine');
        const migratedCompass = applyRelicImmediateThroughGameplayCore(initial, 'chapter_compass', 'adapter-compass');
        const migratedSurety = applyRelicImmediateThroughGameplayCore(initial, 'wager_surety', 'adapter-surety');
        const migratedLedger = applyRelicImmediateThroughGameplayCore(initial, 'parasite_ledger', 'adapter-ledger');
        const migratedShuffle = applyRelicImmediateThroughGameplayCore(initial, 'extra_shuffle_charge', 'adapter-shuffle');
        const legacy = applyRelicImmediateThroughGameplayCore(initial, 'memorize_bonus_ms', 'adapter-memorize');

        expect(migrated).toMatchObject({ migrated: true, run: { peekCharges: 3 } });
        expect(migrated.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', source: { kind: 'relic', id: 'peek_charge_plus_one' } }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.peek_relic.claimed' })
            ])
        );
        expect(migratedShuffle).toMatchObject({ migrated: true, run: { shuffleCharges: 2 } });
        expect(legacy).toMatchObject({ migrated: false, events: [] });
        expect(migratedGuard).toMatchObject({ migrated: true, run: { stats: { guardTokens: 1 } } });
        expect(migratedCombo).toMatchObject({ migrated: true, run: { stats: { comboShards: 1 } } });
        expect(migratedDestroy).toMatchObject({ migrated: true, run: { destroyPairCharges: 1 } });
        expect(migratedShrine).toMatchObject({ migrated: true, run: { bonusRelicPicksNextOffer: 1 } });
        expect(migratedCompass).toMatchObject({ migrated: true, run: { peekCharges: 3 } });
        expect(migratedSurety).toMatchObject({ migrated: true, run: { stats: { guardTokens: 1 } } });
        expect(migratedLedger).toMatchObject({ migrated: true, run: { parasiteWardRemaining: 1 } });
    });

    it('models exactly the extra Peek granted by the existing Echo-Conduit perk condition', () => {
        const active = run({ rewardPerkIds: ['echo_conduit_double'], peekCharges: 3 });
        const sourceTiles = active.board!.tiles.slice(0, 2);
        const legacyWithPerk = resolveTileTraitEffects({ run: active, board: active.board, sourceTiles, source: 'match' });
        const legacyWithoutPerk = resolveTileTraitEffects({
            run: { ...active, rewardPerkIds: [] },
            board: active.board,
            sourceTiles,
            source: 'match'
        });
        const result = reduceGameplayCommand(
            active,
            createGameplayDefinitionCommand('echo-conduit-match', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: ['conduit']
            })
        );

        expect(legacyWithPerk.peekChargeGain - legacyWithoutPerk.peekChargeGain).toBe(1);
        expect(result.run.peekCharges - active.peekCharges).toBe(1);
        expect(result.events).toContainEqual(
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.echo_conduit_double.triggered' })
        );
    });

    it('rejects unmet trait conditions atomically with an explainable event', () => {
        const initial = run({ rewardPerkIds: ['echo_conduit_double'] });
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('bad-adjacency', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: []
            })
        );

        expect(result.accepted).toBe(false);
        expect(result.run).toBe(initial);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('conduit was not adjacent') })
        ]);
    });

    it('preserves board Peek legality and state parity while emitting resource and feedback events', () => {
        const initial = run({ peekCharges: 2, recallFocus: 2 });
        const legacy = applyPeek(initial, 'echo-a');
        const result = reduceGameplayCommand(initial, createGameplayPeekCommand('peek-echo-a', 'echo-a'));

        expect(result.accepted).toBe(true);
        expect(result.run).toEqual(legacy);
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', applied: -1, before: 2, after: 1 }),
            expect.objectContaining({ type: 'board.peeked', targetTileId: 'echo-a', recallFocusBefore: 2 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.peek.used' })
        ]);
        expect(result.events.every((event) => gameplayEventSchema.safeParse(event).success)).toBe(true);
    });

    it('accepts an eligible Route Gambler wager and emits its complete risk contract', () => {
        const initial = run({
            status: 'levelComplete',
            gameMode: 'endless',
            runRulesVersion: GAME_RULES_VERSION,
            relicOffer: null,
            endlessRiskWager: null,
            featuredObjectiveStreak: ENDLESS_RISK_WAGER_MIN_STREAK,
            lastLevelResult: {
                level: 4,
                scoreGained: 100,
                rating: 'S',
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect',
                clearLifeGained: 1,
                featuredObjectiveId: 'flip_par',
                featuredObjectiveCompleted: true
            }
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayRiskWagerAcceptCommand('accept-wager')
        );

        expect(result.accepted).toBe(true);
        expect(result.run.endlessRiskWager).toEqual({
            acceptedOnLevel: 4,
            targetLevel: 5,
            streakAtRisk: ENDLESS_RISK_WAGER_MIN_STREAK,
            bonusFavorOnSuccess: ENDLESS_RISK_WAGER_BONUS_FAVOR
        });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'risk_wager.accepted',
                targetLevel: 5,
                streakAtRisk: ENDLESS_RISK_WAGER_MIN_STREAK
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'build.route_gambler.wager_accepted',
                tone: 'warning'
            })
        ]);
    });

    it('validates and records a Gambit third-flip commitment without preempting board resolution', () => {
        const gambitBoard = board();
        gambitBoard.flippedTileIds = ['echo-a', 'conduit-a'];
        gambitBoard.tiles = gambitBoard.tiles.map((candidate) =>
            gambitBoard.flippedTileIds.includes(candidate.id)
                ? { ...candidate, state: 'flipped' as const }
                : candidate
        );
        const initial = run({
            status: 'resolving',
            board: gambitBoard,
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayGambitCommitCommand('commit-gambit', 'echo-b')
        );

        expect(result.accepted).toBe(true);
        expect(result.run).toBe(initial);
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'board.gambit_commit.requested',
                targetTileId: 'echo-b',
                committedTileIds: ['echo-a', 'conduit-a', 'echo-b']
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.gambit.committed' })
        ]);

        const rejected = reduceGameplayCommand(
            { ...initial, gambitThirdFlipUsed: true },
            createGameplayGambitCommitCommand('spent-gambit', 'echo-b')
        );
        expect(rejected.accepted).toBe(false);
        expect(rejected.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('cannot commit') })
        ]);
    });

    it('models the complete Board Tactician reward and relic source set', () => {
        expect(BOARD_TACTICIAN_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.trait_toolkit',
            'bonus_reward.stasis_lockbox',
            'bonus_reward.free_swap_floor',
            'relic.extra_shuffle_charge',
            'relic.first_shuffle_free_per_floor',
            'relic.region_shuffle_free_first'
        ]);
        expect(BOARD_TACTICIAN_DEFINITIONS.every(
            (definition) => gameplayContentDefinitionSchema.safeParse(definition).success
        )).toBe(true);

        const toolkit = reduceGameplayCommand(
            run({ regionShuffleCharges: 0, peekCharges: 0 }),
            createGameplayDefinitionCommand('toolkit', 'bonus_reward.trait_toolkit')
        );
        expect(toolkit.run).toMatchObject({ regionShuffleCharges: 1, peekCharges: 1 });
        expect(toolkit.run.stats.totalScore).toBe(10);

        const lockbox = reduceGameplayCommand(
            run({ regionShuffleCharges: 0 }),
            createGameplayDefinitionCommand('lockbox', 'bonus_reward.stasis_lockbox')
        );
        expect(lockbox.run.regionShuffleCharges).toBe(1);
        expect(lockbox.run.stats.guardTokens).toBe(1);
        expect(lockbox.run.stats.totalScore).toBe(15);

        const discipline = reduceGameplayCommand(
            run(),
            createGameplayDefinitionCommand('discipline', 'bonus_reward.free_swap_floor')
        );
        expect(discipline.run.rewardPerkIds).toContain('free_first_swap_per_floor');
        expect(discipline.run.stats.totalScore).toBe(15);

        const shuffleRelic = reduceGameplayCommand(
            run({ shuffleCharges: 0 }),
            createGameplayDefinitionCommand('shuffle-relic', 'relic.extra_shuffle_charge')
        );
        expect(shuffleRelic.run.shuffleCharges).toBe(1);

        const freeShuffleRelic = reduceGameplayCommand(
            run({ freeShuffleThisFloor: false }),
            createGameplayDefinitionCommand('free-shuffle-relic', 'relic.first_shuffle_free_per_floor')
        );
        expect(freeShuffleRelic.run.freeShuffleThisFloor).toBe(true);
        expect(freeShuffleRelic.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'free_shuffle.changed', before: false, after: true })
        ]));

        const regionRelic = reduceGameplayCommand(
            run(),
            createGameplayDefinitionCommand('region-relic', 'relic.region_shuffle_free_first')
        );
        expect(regionRelic.run).toEqual(run());
        expect(regionRelic.events).toEqual([
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'build.region_shuffle_free_first.claimed'
            })
        ]);
    });

    it('preserves deterministic shuffle, row-shuffle, and tile-swap parity with typed consumption events', () => {
        const initial = run({
            board: {
                ...board(),
                tiles: board().tiles.map((candidate) =>
                    candidate.id === 'plain-a' ? { ...candidate, pairKey: 'conduit' } : candidate
                )
            },
            shuffleCharges: 1,
            regionShuffleCharges: 2,
            shuffleNonce: 0,
            freeShuffleThisFloor: false,
            regionShuffleFreeThisFloor: false,
            pinnedTileIds: [],
            forgottenTileIdsThisFloor: [],
            matchScoreMultiplier: 1,
            shuffleScoreTaxActive: false
        });

        const shuffled = reduceGameplayCommand(initial, createGameplayShuffleCommand('shuffle-board'));
        expect(shuffled.accepted).toBe(true);
        expect(shuffled.run).toEqual(applyShuffle(initial));
        expect(shuffled.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'shuffle_charge', applied: -1 }),
            expect.objectContaining({ type: 'board.shuffled', shuffleNonceBefore: 0, shuffleNonceAfter: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.shuffle.used' })
        ]);

        const regionShuffled = reduceGameplayCommand(
            initial,
            createGameplayRegionShuffleCommand('shuffle-row', 0)
        );
        expect(regionShuffled.accepted).toBe(true);
        expect(regionShuffled.run).toEqual(applyRegionShuffle(initial, 0));
        expect(regionShuffled.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'region_shuffle_charge', applied: -1 }),
            expect.objectContaining({ type: 'board.region_shuffled', rowIndex: 0 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.region_shuffle.used' })
        ]);

        const swapped = reduceGameplayCommand(
            initial,
            createGameplayTileSwapCommand('swap-tiles', 'echo-a', 'conduit-a')
        );
        expect(swapped.accepted).toBe(true);
        expect(swapped.run).toEqual(applyTileSwap(initial, 'echo-a', 'conduit-a'));
        expect(swapped.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'region_shuffle_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.tiles_swapped',
                firstTileId: 'echo-a',
                secondTileId: 'conduit-a'
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.tile_swap.used' })
        ]);
    });

    it('replays a JSON-round-tripped build sequence deterministically', () => {
        const initial = run({ peekCharges: 0 });
        const commands = [
            createGameplayDefinitionCommand('01-lens', 'bonus_reward.echo_conduit_lens'),
            createGameplayDefinitionCommand('02-relic', 'relic.peek_charge_plus_one'),
            createGameplayDefinitionCommand('03-combo', 'reward_perk.echo_conduit_double', {
                matchedTraits: ['echo'],
                adjacentTraits: ['conduit']
            }),
            createGameplayPeekCommand('04-peek', 'echo-a')
        ];
        const serialized = JSON.stringify(commands);
        const replayA = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);
        const replayB = replayGameplayCommands(initial, JSON.parse(serialized) as unknown[]);

        expect(replayA).toEqual(replayB);
        expect(replayA.acceptedCommandIds).toEqual(['01-lens', '02-relic', '03-combo', '04-peek']);
        expect(replayA.rejectedCommandIds).toEqual([]);
        expect(replayA.run.peekCharges).toBe(2);
        expect(replayA.run.rewardPerkIds).toContain('echo_conduit_double');
        expect(JSON.parse(JSON.stringify(replayA.events))).toEqual(replayA.events);
    });

    it('rejects malformed and version-stale commands without mutating run state', () => {
        const initial = run();
        const malformed = reduceGameplayCommand(initial, { type: 'effects.apply' });
        const staleCommand = {
            ...createGameplayDefinitionCommand('stale', 'relic.peek_charge_plus_one'),
            definitionVersion: 99
        };
        const stale = reduceGameplayCommand(initial, staleCommand);

        expect(malformed.accepted).toBe(false);
        expect(malformed.run).toBe(initial);
        expect(stale.accepted).toBe(false);
        expect(stale.run).toBe(initial);
        expect(stale.events[0]).toMatchObject({ type: 'command.rejected', reason: expect.stringContaining('version mismatch') });
    });
});
