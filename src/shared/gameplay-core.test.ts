import { describe, expect, it } from 'vitest';
import {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';
import { togglePinnedTile } from './board-power-state';
import { BONUS_REWARD_CATALOG, previewBonusRewardClaim } from './bonus-rewards';
import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    DEBUG_REVEAL_MS,
    GAME_RULES_VERSION,
    type BoardState,
    type RunState,
    type Tile
} from './contracts';
import {
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
    BOARD_TACTICIAN_DEFINITIONS,
    COMBO_SHARD_ENGINE_DEFINITIONS,
    GAMEPLAY_BONUS_REWARD_IDS,
    GAMEPLAY_BONUS_REWARD_RULES,
    GAMEPLAY_CORE_SCHEMA_VERSION,
    GAMEPLAY_RELIC_IDS,
    GAMEPLAY_RELIC_OFFER_SERVICE_IDS,
    MEMORY_SCOUT_DEFINITIONS,
    LOCKSMITH_DEFINITIONS,
    SABOTEUR_DEFINITIONS,
    SLAYER_DEFINITIONS,
    SUPPLY_CACHE_DEFINITIONS,
    VAULTBREAKER_DEFINITIONS,
    WARDEN_DEFINITIONS,
    createGameplayGauntletExpireCommand,
    createGameplayDebugRevealActivateCommand,
    createGameplayDebugRevealDeactivateCommand,
    createGameplayMemorizeCompleteCommand,
    createGameplayPauseCommand,
    createGameplayProgressionRepairCommand,
    createGameplayResumeCommand,
    createGameplayDefinitionCommand,
    createGameplayBoardTurnResolveCommand,
    createGameplayDestroyPairCommand,
    createGameplayDungeonExitActivateCommand,
    createGameplayEnemyHazardContactCommand,
    createGameplayFlashPairCommand,
    createGameplayFloorAdvanceCommand,
    createGameplayGambitCommitCommand,
    createGameplayHazardBanishCommand,
    createGameplayParasiteAdvanceCommand,
    createGameplayPeekCommand,
    createGameplayPinToggleCommand,
    createGameplayRegionShuffleCommand,
    createGameplayRiskWagerAcceptCommand,
    createGameplayRelicOfferOpenCommand,
    createGameplayRelicPickCommand,
    createGameplayRelicOfferServiceCommand,
    createGameplayRouteChooseCommand,
    createGameplaySideRoomResolveCommand,
    createGameplayShuffleCommand,
    createGameplayShopPurchaseCommand,
    createGameplayShopRerollCommand,
    createGameplayStrayRemoveCommand,
    createGameplayTileSwapCommand,
    createGameplayTileFlipCommand,
    createGameplayUndoResolveCommand,
    createGameplayWildMatchConsumeCommand,
    gameplayCommandSchema,
    gameplayContentDefinitionSchema,
    gameplayEventSchema,
    type GameplayEvent
} from './gameplay-core-contracts';
import { reduceGameplayCommand, replayGameplayCommands } from './gameplay-core';
import { inspectGameplayFeedbackCompleteness } from './gameplay-feedback-completeness';
import {
    applyRelicImmediateThroughGameplayCore,
    repairRunProgressionThroughGameplayCore,
    resolveFindableMatchRewardThroughGameplayCore,
    resolveSlayerFloorClearThroughGameplayCore
} from './gameplay-core-adapters';
import { applyRelicImmediate } from './relic-immediate-rules';
import { openRelicOffer } from './relic-offer-open-rules';
import { resolveTileTraitEffects } from './tile-trait-rules';
import { createRunShopOffers, purchaseShopOffer, rerollShopOffers } from './shop-rules';
import { createDungeonExitActivationTransition } from './dungeon-exit-rules';
import { applyEnemyHazardClick } from './dungeon-enemy-hazard-rules';
import { createNewRun, finalizeLevel } from './game';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { normalizeSessionStats } from './session-stats-rules';
import { applyRelicOfferService, RELIC_OFFER_SERVICE_IDS, RELIC_POOL } from './relics';
import {
    claimRouteSideRoomChoice,
    claimRouteSideRoomPrimary,
    skipRouteSideRoom
} from './route-side-room-rules';
import { advanceToNextLevel } from './next-floor-transition-rules';
import { resolveSlayerFloorClearEffects } from './slayer-floor-clear-transition';
import { finishMemorizePhase } from './memorize-phase-rules';

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
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        stats: { totalScore: 0, currentLevelScore: 0, comboShards: 0, guardTokens: 0, currentStreak: 0 },
        ...overrides
    }) as RunState;

describe('deterministic gameplay core', () => {
    it('completes study through one replayable command with exact Focus parity', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9136 });
        const initial: RunState = {
            ...base,
            recallFocus: 0,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 640,
                pausedFromStatus: 'memorize'
            }
        };
        const command = createGameplayMemorizeCompleteCommand('memorize-complete-1');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.command).toEqual(command);
        expect(result.run).toEqual(finishMemorizePhase(initial));
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
        expect(result.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'memorize_phase' },
                type: 'phase.memorize_completed',
                floor: initial.board!.level,
                memorizeRemainingMsBefore: 640,
                recallFocusBefore: 0,
                recallFocusAfter: result.run.recallFocus,
                pendingMemorizeBonusMs: initial.pendingMemorizeBonusMs
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'memorize_phase' },
                type: 'feedback.requested',
                cue: 'phase.memorize.completed',
                message: `Study complete; ${result.run.recallFocus} Focus charge is ready.`,
                tone: 'information'
            }
        ]);

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual([command.commandId]);

        const duplicate = reduceGameplayCommand(result.run, command);
        expect(duplicate.accepted).toBe(false);
        expect(duplicate.run).toBe(result.run);
        expect(duplicate.events).toEqual([
            expect.objectContaining({
                type: 'command.rejected',
                reason: 'Memorize completion requires an active study phase.'
            })
        ]);
    });

    it('expires an active Gauntlet from a serialized clock observation', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9135 });
        const initial: RunState = {
            ...base,
            gameMode: 'gauntlet',
            gauntletDeadlineMs: 10_000,
            status: 'playing',
            lives: 3
        };
        const command = createGameplayGauntletExpireCommand('gauntlet-expire-1', 10_025);
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.command).toEqual(command);
        expect(result.run).toEqual({ ...initial, status: 'gameOver', lives: 0 });
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
        expect(result.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'gauntlet_clock' },
                type: 'run.gauntlet_expired',
                observedAtMs: 10_025,
                deadlineMs: 10_000,
                overdueMs: 25,
                statusBefore: 'playing',
                livesBefore: 3,
                livesAfter: 0
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'gauntlet_clock' },
                type: 'feedback.requested',
                cue: 'mode.gauntlet.expired',
                message: 'Gauntlet time expired 25 ms past the deadline.',
                tone: 'warning'
            }
        ]);

        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))])).toMatchObject({
            run: result.run,
            events: result.events,
            acceptedCommandIds: [command.commandId],
            rejectedCommandIds: []
        });

        for (const invalid of [
            createGameplayGauntletExpireCommand('at-deadline', 10_000),
            createGameplayGauntletExpireCommand('before-deadline', 9_999)
        ]) {
            expect(reduceGameplayCommand(initial, invalid)).toMatchObject({ accepted: false, run: initial });
        }
        expect(reduceGameplayCommand({ ...initial, status: 'paused' }, command)).toMatchObject({ accepted: false });
        expect(reduceGameplayCommand({ ...initial, gameMode: 'endless' }, command)).toMatchObject({ accepted: false });
        expect(reduceGameplayCommand({ ...initial, gauntletDeadlineMs: 9_999.5 }, command)).toMatchObject({ accepted: false });
        expect(reduceGameplayCommand({ ...initial, gauntletDeadlineMs: -1 }, command)).toMatchObject({ accepted: false });
        expect(reduceGameplayCommand(result.run, command)).toMatchObject({ accepted: false, run: result.run });
    });

    it('pauses and resumes timer state from serialized host observations', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 4401 });
        const initial: RunState = {
            ...base,
            gameMode: 'gauntlet',
            gauntletDeadlineMs: 50_000,
            status: 'playing',
            timerState: {
                ...base.timerState,
                debugRevealRemainingMs: 900
            }
        };
        const timerSnapshot = {
            memorizeRemainingMs: null,
            resolveRemainingMs: null,
            debugRevealRemainingMs: 350
        };
        const pauseCommand = createGameplayPauseCommand('pause-1', 10_000, timerSnapshot);
        const paused = reduceGameplayCommand(initial, pauseCommand);

        expect(paused.accepted).toBe(true);
        expect(paused.run).toEqual({
            ...initial,
            status: 'paused',
            timerState: {
                ...initial.timerState,
                memorizeRemainingMs: null,
                debugRevealRemainingMs: 350,
                pausedFromStatus: 'playing',
                gauntletPausedAtMs: 10_000
            }
        });
        expect(paused.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(paused.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: pauseCommand.commandId,
                eventId: `${pauseCommand.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'run_lifecycle' },
                type: 'run.paused',
                observedAtMs: 10_000,
                statusBefore: 'playing',
                statusAfter: 'paused',
                gauntletDeadlineMs: 50_000,
                gauntletPausedAtMs: 10_000,
                timerSnapshot
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: pauseCommand.commandId,
                eventId: `${pauseCommand.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'run_lifecycle' },
                type: 'feedback.requested',
                cue: 'run.paused',
                message: 'Run paused from playing.',
                tone: 'information'
            }
        ]);

        const resumeCommand = createGameplayResumeCommand('resume-1', 12_500);
        const resumed = reduceGameplayCommand(paused.run, resumeCommand);
        expect(resumed.accepted).toBe(true);
        expect(resumed.run).toEqual({
            ...paused.run,
            gauntletDeadlineMs: 52_500,
            status: 'playing',
            timerState: {
                ...paused.run.timerState,
                pausedFromStatus: null,
                gauntletPausedAtMs: null
            }
        });
        expect(resumed.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: resumeCommand.commandId,
                eventId: `${resumeCommand.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'run_lifecycle' },
                type: 'run.resumed',
                observedAtMs: 12_500,
                pausedFromStatus: 'playing',
                statusAfter: 'playing',
                outcome: 'resumed',
                gauntletDeadlineMsBefore: 50_000,
                gauntletDeadlineMsAfter: 52_500,
                gauntletPauseDurationMs: 2_500
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: resumeCommand.commandId,
                eventId: `${resumeCommand.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'run_lifecycle' },
                type: 'feedback.requested',
                cue: 'run.resumed',
                message: 'Run resumed into playing.',
                tone: 'information'
            }
        ]);

        const replayed = replayGameplayCommands(initial, JSON.parse(JSON.stringify([pauseCommand, resumeCommand])));
        expect(replayed.run).toEqual(resumed.run);
        expect(replayed.events).toEqual([...paused.events, ...resumed.events]);
        expect(replayed.acceptedCommandIds).toEqual([pauseCommand.commandId, resumeCommand.commandId]);
        expect(reduceGameplayCommand(paused.run, pauseCommand)).toMatchObject({ accepted: false, run: paused.run });
        expect(reduceGameplayCommand(initial, resumeCommand)).toMatchObject({ accepted: false, run: initial });
    });

    it('records terminal and resolving-state recovery when a paused run resumes', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const pausedResolving: RunState = {
            ...base,
            status: 'paused',
            board: base.board ? { ...base.board, flippedTileIds: [] } : null,
            timerState: {
                ...base.timerState,
                pausedFromStatus: 'resolving',
                resolveRemainingMs: 120
            }
        };
        const recovered = reduceGameplayCommand(pausedResolving, createGameplayResumeCommand('recover-1', 5_000));
        expect(recovered).toMatchObject({
            accepted: true,
            run: { status: 'playing', timerState: { resolveRemainingMs: null } },
            events: [expect.objectContaining({ type: 'run.resumed', outcome: 'recovered_to_playing' }), expect.anything()]
        });

        const deadPaused = { ...pausedResolving, lives: 0 };
        const terminal = reduceGameplayCommand(deadPaused, createGameplayResumeCommand('recover-dead', 5_000));
        expect(terminal).toMatchObject({
            accepted: true,
            run: { status: 'gameOver', lives: 0 },
            events: [
                expect.objectContaining({ type: 'run.resumed', outcome: 'game_over', statusAfter: 'gameOver' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'run.resume.game_over', tone: 'warning' })
            ]
        });
    });

    it('activates, refreshes, and deactivates debug reveal through replayable lifecycle commands', () => {
        const initial = finishMemorizePhase(createNewRun(0, {
            echoFeedbackEnabled: false,
            runSeed: 4402
        }));
        const activateCommand = createGameplayDebugRevealActivateCommand('debug-activate-1', true);
        const activated = reduceGameplayCommand(initial, activateCommand);

        expect(activated.accepted).toBe(true);
        expect(activated.run).toEqual({
            ...initial,
            achievementsEnabled: false,
            debugPeekActive: true,
            debugUsed: true,
            timerState: {
                ...initial.timerState,
                debugRevealRemainingMs: DEBUG_REVEAL_MS
            }
        });
        expect(activated.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: activateCommand.commandId,
                eventId: `${activateCommand.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'debug_reveal' },
                type: 'debug.reveal_activated',
                outcome: 'activated',
                revealDurationMs: DEBUG_REVEAL_MS,
                debugUsedBefore: false,
                debugUsedAfter: true,
                achievementsEnabledBefore: true,
                achievementsEnabledAfter: false
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: activateCommand.commandId,
                eventId: `${activateCommand.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'debug_reveal' },
                type: 'feedback.requested',
                cue: 'debug.reveal.activated',
                message: `Debug reveal active for ${DEBUG_REVEAL_MS} ms; achievements are disabled for this run.`,
                tone: 'information'
            }
        ]);

        const refreshCommand = createGameplayDebugRevealActivateCommand('debug-activate-2', false);
        const refreshed = reduceGameplayCommand(activated.run, refreshCommand);
        expect(refreshed.accepted).toBe(true);
        expect(refreshed.run.achievementsEnabled).toBe(false);
        expect(refreshed.run.timerState.debugRevealRemainingMs).toBe(DEBUG_REVEAL_MS);
        expect(refreshed.events).toEqual([
            expect.objectContaining({
                type: 'debug.reveal_activated',
                outcome: 'refreshed',
                debugUsedBefore: true,
                achievementsEnabledBefore: false,
                achievementsEnabledAfter: false
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'debug.reveal.refreshed'
            })
        ]);

        const deactivateCommand = createGameplayDebugRevealDeactivateCommand('debug-deactivate-1', 'timer_elapsed');
        const deactivated = reduceGameplayCommand(refreshed.run, deactivateCommand);
        expect(deactivated.accepted).toBe(true);
        expect(deactivated.run.debugPeekActive).toBe(false);
        expect(deactivated.run.timerState.debugRevealRemainingMs).toBeNull();
        expect(deactivated.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: deactivateCommand.commandId,
                eventId: `${deactivateCommand.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'debug_reveal' },
                type: 'debug.reveal_deactivated',
                reason: 'timer_elapsed',
                debugRevealRemainingMsBefore: DEBUG_REVEAL_MS,
                debugPeekActiveAfter: false
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: deactivateCommand.commandId,
                eventId: `${deactivateCommand.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'debug_reveal' },
                type: 'feedback.requested',
                cue: 'debug.reveal.timer_elapsed',
                message: 'Debug reveal expired; hidden tiles are concealed again.',
                tone: 'information'
            }
        ]);

        const commands = JSON.parse(JSON.stringify([activateCommand, refreshCommand, deactivateCommand]));
        expect(replayGameplayCommands(initial, commands)).toMatchObject({
            run: deactivated.run,
            events: [...activated.events, ...refreshed.events, ...deactivated.events],
            acceptedCommandIds: commands.map((command: { commandId: string }) => command.commandId),
            rejectedCommandIds: []
        });
        expect(reduceGameplayCommand(initial, deactivateCommand)).toMatchObject({ accepted: false, run: initial });
        expect(reduceGameplayCommand({ ...initial, status: 'paused' }, activateCommand)).toMatchObject({
            accepted: false
        });
        expect(gameplayCommandSchema.safeParse({
            schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
            commandId: 'bad-debug-reason',
            type: 'debug.reveal_deactivate',
            reason: 'unknown'
        }).success).toBe(false);
    });

    it('repairs stale progression blockers through one replayable safety command', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 4403 });
        const initial: RunState = {
            ...base,
            board: {
                level: 3,
                pairCount: 1,
                columns: 2,
                rows: 2,
                tiles: [
                    { id: 'pair-a', pairKey: 'pair', label: 'Pair A', state: 'matched', symbol: 'a' },
                    { id: 'pair-b', pairKey: 'pair', label: 'Pair B', state: 'matched', symbol: 'b' },
                    {
                        id: 'exit',
                        pairKey: EXIT_PAIR_KEY,
                        label: 'Exit',
                        state: 'flipped',
                        symbol: 'exit',
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
                        id: 'stale-warden',
                        kind: 'warden',
                        label: 'Stale Warden',
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
        const command = createGameplayProgressionRepairCommand('progression-repair-1');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.run.board?.dungeonExitLockKind).toBe('none');
        expect(result.run.board?.tiles.find((candidate) => candidate.id === 'exit')).toMatchObject({
            dungeonExitLockKind: 'none'
        });
        expect(result.run.board?.enemyHazards).toMatchObject([
            { id: 'stale-warden', hp: 0, state: 'defeated' }
        ]);
        expect(result.run).toMatchObject({
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1
        });
        expect(result.events).toEqual([
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:0`,
                sequence: 0,
                source: { kind: 'system', id: 'progression_safety' },
                type: 'run.progression_repaired',
                repairKinds: ['exit_lock', 'exit_metadata', 'enemy_hazard'],
                exitTileId: 'exit',
                exitLockKindBefore: 'iron',
                exitLockKindAfter: 'none',
                exitRequiredLeverCountBefore: 0,
                exitRequiredLeverCountAfter: 0,
                enemyHazardIdsDefeated: ['stale-warden'],
                dungeonEnemiesDefeatedBefore: 0,
                dungeonEnemiesDefeatedAfter: 1,
                dungeonEnemiesDefeatedThisFloorBefore: 0,
                dungeonEnemiesDefeatedThisFloorAfter: 1,
                enemyHazardsDefeatedThisFloorBefore: 0,
                enemyHazardsDefeatedThisFloorAfter: 1
            },
            {
                schemaVersion: GAMEPLAY_CORE_SCHEMA_VERSION,
                commandId: command.commandId,
                eventId: `${command.commandId}:1`,
                sequence: 1,
                source: { kind: 'system', id: 'progression_safety' },
                type: 'feedback.requested',
                cue: 'safety.progression.repaired',
                message: 'Progression safety repaired exit lock and 1 stale enemy hazard.',
                tone: 'information'
            }
        ]);
        expect(result.events.every((event) => gameplayEventSchema.safeParse(event).success)).toBe(true);

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual([command.commandId]);

        const journaled = repairRunProgressionThroughGameplayCore(initial, 'progression-repair-adapter');
        expect(journaled.accepted).toBe(true);
        expect(journaled.run.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.progression_repair' })
        ]);
        expect(journaled.run.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'run.progression_repaired' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'safety.progression.repaired' })
        ]));

        const healthy = { ...initial, board: result.run.board };
        expect(reduceGameplayCommand(healthy, createGameplayProgressionRepairCommand('healthy-repair'))).toMatchObject({
            accepted: false,
            run: healthy
        });
    });

    it('resolves a non-final match through one replayable outer turn command', () => {
        const initial = run({
            status: 'resolving',
            board: {
                ...board(),
                pairCount: 2,
                matchedPairs: 0,
                flippedTileIds: ['a1', 'a2'],
                tiles: [
                    {
                        ...tile('a1', 'a', 'echo'),
                        state: 'flipped',
                        findableKind: 'score_glint',
                        routeCardKind: 'greed_cache'
                    },
                    {
                        ...tile('a2', 'a', 'echo'),
                        state: 'flipped',
                        findableKind: 'score_glint',
                        routeCardKind: 'greed_cache'
                    },
                    tile('b1', 'b', 'sealed'),
                    tile('b2', 'b', 'sealed')
                ]
            },
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1,
            stats: {
                totalScore: 10,
                currentLevelScore: 10,
                comboShards: 0,
                guardTokens: 0,
                currentStreak: 2,
                matchesFound: 1,
                mismatches: 1,
                tries: 2
            } as RunState['stats']
        });
        const command = createGameplayBoardTurnResolveCommand('turn-1');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.command).toEqual(command);
        expect(result.run.board?.matchedPairs).toBe(1);
        expect(result.run.findablesClaimedThisFloor).toBe(1);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
            expect.objectContaining({
                type: 'board.turn_resolved',
                outcome: 'match',
                boardLevel: 1,
                flippedTileIds: ['a1', 'a2'],
                floaterTileIds: ['a1', 'a2'],
                matchedPairKey: 'a',
                matchedFindableKind: 'score_glint',
                findablesClaimedBefore: 0,
                findablesClaimedAfter: 1,
                findablesTotalBefore: 1,
                findablesTotalAfter: 1,
                announcement: expect.objectContaining({
                    matchedPairsBefore: 0,
                    matchedPairsAfter: 1,
                    pairCountBefore: 2,
                    pairCountAfter: 2,
                    matchedTraitKinds: ['echo'],
                    mismatchedTraitKinds: []
                }),
                matchedRouteKind: 'greed_cache',
                traitInteractionTags: ['echo:sealed-combo'],
                currentStreakBefore: 2,
                currentStreakAfter: 3,
                matchesBefore: 1,
                matchesAfter: 2,
                mismatchesBefore: 1,
                mismatchesAfter: 1,
                boardComplete: false
            })
        ]));
        expect(result.events.every((event) => event.commandId === command.commandId)).toBe(true);
        expect(result.events.map((event) => event.sequence)).toEqual(
            result.events.map((_, sequence) => sequence)
        );

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual(['turn-1']);
    });

    it('emits authoritative mismatch feedback facts without renderer rule evaluation', () => {
        const initial = run({
            status: 'resolving',
            lives: 3,
            board: {
                ...board(),
                flippedTileIds: ['c1', 'v1'],
                tiles: [
                    { ...tile('c1', 'cursed', 'cursed'), state: 'flipped' },
                    tile('nearby-v', 'nearby-v', 'volatile'),
                    { ...tile('v1', 'volatile', 'volatile'), state: 'flipped' },
                    tile('c2', 'cursed', 'cursed')
                ]
            },
            stats: {
                totalScore: 90,
                currentLevelScore: 90,
                comboShards: 2,
                guardTokens: 0,
                currentStreak: 4,
                matchesFound: 3,
                mismatches: 1,
                tries: 3
            } as RunState['stats']
        });
        const command = createGameplayBoardTurnResolveCommand('turn-mismatch-feedback');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'board.turn_resolved',
            outcome: 'mismatch',
            floaterTileIds: ['c1', 'v1'],
            matchedPairKey: null,
            matchedFindableKind: null,
            matchedRouteKind: null,
            traitInteractionTags: ['cursed:volatile-danger'],
            currentStreakBefore: 4,
            currentStreakAfter: 2,
            comboShardsBefore: 2,
            comboShardsAfter: 2,
            mismatchesBefore: 1,
            mismatchesAfter: 2
        }));
        expect(result.events.every((event) => gameplayEventSchema.safeParse(event).success)).toBe(true);
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))])).toMatchObject({
            run: result.run,
            events: result.events,
            acceptedCommandIds: [command.commandId]
        });
    });

    it('emits the matched pair as the deterministic Gambit floater anchor', () => {
        const initial = run({
            status: 'resolving',
            board: {
                ...board(),
                flippedTileIds: ['a1', 'b1', 'a2'],
                tiles: [
                    { ...tile('a1', 'a'), state: 'flipped' },
                    { ...tile('b1', 'b'), state: 'flipped' },
                    { ...tile('a2', 'a'), state: 'flipped' },
                    tile('b2', 'b')
                ]
            },
            gambitAvailableThisFloor: true,
            gambitThirdFlipUsed: false
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayBoardTurnResolveCommand('turn-gambit-feedback')
        );

        expect(result.accepted).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'board.turn_resolved',
            outcome: 'gambit_match',
            flippedTileIds: ['a1', 'b1', 'a2'],
            floaterTileIds: ['a1', 'a2'],
            matchedPairKey: 'a'
        }));
    });

    it('resolves the final pair and floor-clear effects under the same outer turn command', () => {
        const base = createNewRun(0, { runSeed: 9137 });
        const initial: RunState = {
            ...base,
            status: 'resolving',
            board: {
                ...board(),
                pairCount: 1,
                matchedPairs: 0,
                flippedTileIds: ['a1', 'a2'],
                tiles: [
                    { ...tile('a1', 'a'), state: 'flipped', findableKind: 'score_glint' },
                    { ...tile('a2', 'a'), state: 'flipped', findableKind: 'score_glint' }
                ]
            },
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1
        };
        const command = createGameplayBoardTurnResolveCommand('final-turn');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.run.status).toBe('levelComplete');
        expect(result.run.board?.matchedPairs).toBe(1);
        expect(result.run.findablesClaimedThisFloor).toBe(1);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'score.requested', reason: 'findable_match', amount: 25 }),
            expect.objectContaining({
                type: 'board.turn_resolved',
                outcome: 'match',
                boardComplete: true,
                statusAfter: 'levelComplete'
            })
        ]));
        expect(result.events.every((event) => event.commandId === command.commandId)).toBe(true);

        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(replayed.acceptedCommandIds).toEqual(['final-turn']);
    });

    it('replays tile flips and turn resolution from the pre-input board state', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9138 });
        const initial: RunState = { ...base, status: 'playing' };
        const pair = initial.board!.tiles.filter(
            (tile, _index, tiles) =>
                tile.state === 'hidden' &&
                tiles.filter((candidate) => candidate.pairKey === tile.pairKey).length === 2
        ).filter((tile, _index, candidates) => tile.pairKey === candidates[0]?.pairKey);
        expect(pair).toHaveLength(2);
        const commands = [
            createGameplayTileFlipCommand('flip-first', pair[0]!.id),
            createGameplayTileFlipCommand('flip-second', pair[1]!.id),
            createGameplayBoardTurnResolveCommand('resolve-flipped-pair')
        ];
        const first = reduceGameplayCommand(initial, commands[0]);
        const second = reduceGameplayCommand(first.run, commands[1]);
        const resolved = reduceGameplayCommand(second.run, commands[2]);

        expect(first).toMatchObject({ accepted: true, run: { status: 'playing' } });
        expect(second).toMatchObject({ accepted: true, run: { status: 'resolving' } });
        expect(first.events).toEqual([
            expect.objectContaining({
                type: 'board.tile_flipped',
                targetTileId: pair[0]!.id,
                outcome: 'flipped',
                flippedTileIdsBefore: [],
                flippedTileIdsAfter: [pair[0]!.id]
            })
        ]);
        expect(second.events).toEqual([
            expect.objectContaining({
                type: 'board.tile_flipped',
                targetTileId: pair[1]!.id,
                outcome: 'flipped',
                flippedTileIdsAfter: [pair[0]!.id, pair[1]!.id]
            })
        ]);
        expect(resolved.accepted).toBe(true);
        expect(resolved.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);

        const replayed = replayGameplayCommands(initial, JSON.parse(JSON.stringify(commands)));
        expect(replayed.run).toEqual(resolved.run);
        expect(replayed.events).toEqual([...first.events, ...second.events, ...resolved.events]);
        expect(replayed.acceptedCommandIds).toEqual(['flip-first', 'flip-second', 'resolve-flipped-pair']);
    });

    it('emits typed feedback when a tile reveal advances the dungeon objective', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9_138 });
        const unknownPair = base.board!.tiles.slice(0, 2).map((candidate) => ({
            ...candidate,
            pairKey: 'unknown-room',
            dungeonCardKind: 'room' as const,
            dungeonCardState: 'hidden' as const
        }));
        const initial: RunState = {
            ...base,
            status: 'playing',
            board: {
                ...base.board!,
                dungeonObjectiveId: 'reveal_unknowns',
                tiles: unknownPair,
                pairCount: 1,
                matchedPairs: 0,
                flippedTileIds: []
            }
        };
        const command = createGameplayTileFlipCommand('reveal-objective', unknownPair[0]!.id);
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'objective.progress.changed',
                message: 'Reveal unknowns: 1/1.',
                tone: 'information'
            })
        ]));
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))])).toMatchObject({
            run: result.run,
            events: result.events,
            acceptedCommandIds: [command.commandId],
            rejectedCommandIds: []
        });
    });

    it('emits exact typed feedback when a tile flip clears a final-pair enemy blocker', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9_140 });
        const initial: RunState = {
            ...base,
            status: 'playing',
            dungeonEnemiesDefeated: 0,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 0,
            board: {
                ...base.board!,
                pairCount: 2,
                matchedPairs: 1,
                flippedTileIds: [],
                tiles: [
                    { ...tile('final-a', 'final'), state: 'hidden' },
                    { ...tile('final-b', 'final'), state: 'hidden' },
                    { ...tile('done-a', 'done'), state: 'matched' },
                    { ...tile('done-b', 'done'), state: 'matched' }
                ],
                enemyHazards: [{
                    id: 'final-pair-warden',
                    kind: 'warden',
                    label: 'Final Pair Warden',
                    currentTileId: 'final-a',
                    nextTileId: 'final-b',
                    pattern: 'guard',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1,
                    bossId: 'trap_warden'
                }]
            }
        };
        const command = createGameplayTileFlipCommand('clear-final-pair-blocker', 'final-a');
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.run).toMatchObject({
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 1
        });
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'board.tile_flipped',
                targetTileId: 'final-a',
                enemyHazardIdsDefeated: ['final-pair-warden'],
                dungeonEnemiesDefeatedBefore: 0,
                dungeonEnemiesDefeatedAfter: 1,
                dungeonEnemiesDefeatedThisFloorBefore: 0,
                dungeonEnemiesDefeatedThisFloorAfter: 1,
                enemyHazardsDefeatedThisFloorBefore: 0,
                enemyHazardsDefeatedThisFloorAfter: 1
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.enemy_blocker.cleared',
                message: '1 enemy blocker cleared from the final pair.',
                tone: 'information'
            })
        ]));
        expect(inspectGameplayFeedbackCompleteness({
            before: initial,
            after: result.run,
            command,
            events: result.events,
            accepted: result.accepted
        })).toBeNull();
        const currentFlipEvent = result.events.find((event) => event.type === 'board.tile_flipped');
        expect(currentFlipEvent).toBeDefined();
        if (!currentFlipEvent) throw new Error('Expected a current board.tile_flipped event.');
        const legacyFlipEvent = { ...currentFlipEvent } as Record<string, unknown>;
        for (const field of [
            'enemyHazardIdsDefeated',
            'dungeonEnemiesDefeatedBefore',
            'dungeonEnemiesDefeatedAfter',
            'dungeonEnemiesDefeatedThisFloorBefore',
            'dungeonEnemiesDefeatedThisFloorAfter',
            'enemyHazardsDefeatedThisFloorBefore',
            'enemyHazardsDefeatedThisFloorAfter'
        ]) {
            delete legacyFlipEvent[field];
        }
        expect(gameplayEventSchema.parse(legacyFlipEvent)).toMatchObject({
            enemyHazardIdsDefeated: [],
            dungeonEnemiesDefeatedBefore: 0,
            dungeonEnemiesDefeatedAfter: 0,
            dungeonEnemiesDefeatedThisFloorBefore: 0,
            dungeonEnemiesDefeatedThisFloorAfter: 0,
            enemyHazardsDefeatedThisFloorBefore: 0,
            enemyHazardsDefeatedThisFloorAfter: 0
        });
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))])).toMatchObject({
            run: result.run,
            events: result.events,
            acceptedCommandIds: [command.commandId],
            rejectedCommandIds: []
        });
    });

    it('replays enemy contact with guard-before-life parity and typed feedback', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 9139 });
        const target = base.board!.tiles.find((tile) => tile.state === 'hidden')!;
        const nextTarget = base.board!.tiles.find((tile) => tile.id !== target.id)!;
        const initial: RunState = {
            ...base,
            status: 'playing',
            stats: { ...base.stats, guardTokens: 1 },
            board: {
                ...base.board!,
                enemyHazardTurn: 0,
                enemyHazards: [{
                    id: 'typed-contact',
                    kind: 'sentinel',
                    label: 'Typed Sentinel',
                    currentTileId: target.id,
                    nextTileId: nextTarget.id,
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }]
            }
        };
        const command = createGameplayEnemyHazardContactCommand(
            'contact-guarded',
            target.id,
            true
        );
        const result = reduceGameplayCommand(initial, command);

        expect(result.accepted).toBe(true);
        expect(result.run).toEqual(applyEnemyHazardClick(initial, target.id, { advanceHazards: true }));
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'enemy_hazard.contacted',
                hazardId: 'typed-contact',
                guardTokensBefore: 1,
                guardTokensAfter: 0,
                livesBefore: initial.lives,
                livesAfter: initial.lives,
                enemyHazardHitsBefore: 0,
                enemyHazardHitsAfter: 1
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.enemy_contact.guard_absorbed'
            })
        ]);
        expect(replayGameplayCommands(
            initial,
            [JSON.parse(JSON.stringify(command))]
        )).toMatchObject({
            run: result.run,
            events: result.events,
            acceptedCommandIds: ['contact-guarded']
        });
    });

    it('keeps every live relic representable by the typed gameplay schema', () => {
        expect([...GAMEPLAY_RELIC_IDS].sort()).toEqual([...RELIC_POOL].sort());
        expect(GAMEPLAY_RELIC_OFFER_SERVICE_IDS).toEqual(RELIC_OFFER_SERVICE_IDS);
        expect(GAMEPLAY_BONUS_REWARD_IDS).toEqual(Object.keys(BONUS_REWARD_CATALOG));
        for (const rewardId of GAMEPLAY_BONUS_REWARD_IDS) {
            expect(GAMEPLAY_BONUS_REWARD_RULES[rewardId]).toMatchObject({
                maxClaims: BONUS_REWARD_CATALOG[rewardId].antiGrindLimit.maxClaims,
                roomKind: BONUS_REWARD_CATALOG[rewardId].roomKind
            });
        }
    });

    it('validates commands, effects, conditions, and definitions as strict serializable contracts', () => {
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.echo_conduit_lens',
            'relic.peek_charge_plus_one',
            'reward_perk.echo_conduit_double',
            'bonus_reward.secret_favor',
            'relic.pin_cap_plus_one',
            'findable.scout_glint'
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
            'relic.parasite_ward_once',
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

        const wardRelic = applyRelicImmediateThroughGameplayCore(
            { ...initial, parasiteWardRemaining: 0 },
            'parasite_ward_once',
            'catalyst-parasite-ward'
        );
        expect(wardRelic).toMatchObject({ migrated: true, run: { parasiteWardRemaining: 1 } });
        expect(wardRelic.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'parasite_ward.changed',
                before: 0,
                after: 1,
                source: { kind: 'relic', id: 'parasite_ward_once' }
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.parasite_ward_once.claimed' })
        ]));
    });

    it('models Supply Cache as one typed emergency-tool claim across reveal, removal, and score', () => {
        expect(SUPPLY_CACHE_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.supply_cache',
            'relic.stray_charge_plus_one'
        ]);
        const initial = run({ peekCharges: 0, destroyPairCharges: 0 });
        const result = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('supply-cache', 'bonus_reward.supply_cache')
        );

        expect(result).toMatchObject({
            accepted: true,
            run: {
                peekCharges: 1,
                destroyPairCharges: 1,
                stats: { totalScore: 10, currentLevelScore: 10 }
            }
        });
        expect(result.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'destroy_charge', applied: 1 }),
            expect.objectContaining({ type: 'inventory.changed', itemId: 'peek_charge', applied: 1 }),
            expect.objectContaining({ type: 'score.changed', reason: 'content_reward', amount: 10 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.supply_cache.claimed' })
        ]);
    });

    it('removes one legal pair through a typed command and records every consequential delta', () => {
        const initial = run({
            destroyPairCharges: 2,
            recallFocus: 2,
            parasiteFloors: 3,
            activeMutators: ['score_parasite'],
            shiftingSpotlightNonce: 0
        });
        const command = createGameplayDestroyPairCommand('destroy-echo', 'echo-a');
        const result = reduceGameplayCommand(initial, command);
        const rejected = reduceGameplayCommand(
            { ...initial, activeContract: { noDestroy: true, noShuffle: false, maxMismatches: null } },
            createGameplayDestroyPairCommand('destroy-blocked', 'echo-a')
        );

        expect(result).toMatchObject({
            accepted: true,
            run: {
                destroyPairCharges: 1,
                destroyUsedThisFloor: true,
                recallFocus: 1,
                parasiteFloors: 0,
                board: { matchedPairs: 1 },
                stats: { matchesFound: 1, pairsDestroyed: 1 }
            }
        });
        expect(result.run.board?.tiles.filter((candidate) => candidate.pairKey === 'echo'))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ id: 'echo-a', state: 'matched' }),
                expect.objectContaining({ id: 'echo-b', state: 'matched' })
            ]));
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'inventory.changed',
                itemId: 'destroy_charge',
                operation: 'consume',
                before: 2,
                after: 1,
                applied: -1
            }),
            expect.objectContaining({
                type: 'board.pair_destroyed',
                targetTileId: 'echo-a',
                pairKey: 'echo',
                destroyedTileIds: ['echo-a', 'echo-b'],
                matchedPairsBefore: 0,
                matchedPairsAfter: 1,
                recallFocusBefore: 2,
                recallFocusAfter: 1,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 2,
                parasitePressureBefore: 3,
                parasitePressureAfter: 0,
                boardComplete: false
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'power.destroy_pair.used',
                message: expect.stringContaining('Recall focus 1/3; 2 tile memories are unstable.')
            })
        ]);
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]).run).toEqual(result.run);
        expect(rejected).toMatchObject({ accepted: false, run: { destroyPairCharges: 2 } });

        const finalBase = createNewRun(0, { runSeed: 4412 });
        const finalRun: RunState = {
            ...finalBase,
            status: 'playing',
            destroyPairCharges: 1,
            board: {
                ...board(),
                pairCount: 1,
                matchedPairs: 0,
                tiles: [tile('final-a', 'final'), tile('final-b', 'final')]
            }
        };
        const finalCommand = createGameplayDestroyPairCommand('destroy-final', 'final-a');
        const finalResult = reduceGameplayCommand(finalRun, finalCommand);
        expect(finalResult).toMatchObject({
            accepted: true,
            run: { status: 'levelComplete', board: { matchedPairs: 1 } },
            events: expect.arrayContaining([
                expect.objectContaining({ type: 'board.pair_destroyed', boardComplete: true })
            ])
        });
        expect(finalResult.run.gameplayCommandJournal).toEqual(finalRun.gameplayCommandJournal);
        expect(replayGameplayCommands(
            finalRun,
            [JSON.parse(JSON.stringify(finalCommand))]
        )).toMatchObject({
            run: finalResult.run,
            events: finalResult.events,
            acceptedCommandIds: ['destroy-final']
        });
    });

    it('advances score-parasite pressure through a typed floor command and records ward or life outcomes', () => {
        const primed = run({
            status: 'levelComplete',
            activeMutators: ['score_parasite'],
            parasiteFloors: 2,
            parasiteWardRemaining: 0,
            lives: 2
        });
        const primeCommand = createGameplayParasiteAdvanceCommand('parasite-warning');
        const primeResult = reduceGameplayCommand(primed, primeCommand);
        const warded = run({
            status: 'levelComplete',
            activeMutators: ['score_parasite'],
            parasiteFloors: 3,
            parasiteWardRemaining: 1,
            lives: 2
        });
        const protectedResult = reduceGameplayCommand(
            warded,
            createGameplayParasiteAdvanceCommand('parasite-warded')
        );
        const hitResult = reduceGameplayCommand(
            { ...warded, parasiteWardRemaining: 0 },
            createGameplayParasiteAdvanceCommand('parasite-hit')
        );

        expect(primeResult).toMatchObject({
            accepted: true,
            run: { parasiteFloors: 3, parasiteWardRemaining: 0, lives: 2 }
        });
        expect(primeResult.events).toEqual([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                pressureBefore: 2,
                pressureAfter: 3,
                thresholdTriggered: false
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.drain_warning',
                message: 'Score Parasite: next cleared floor triggers the drain unless warded.',
                tone: 'warning'
            })
        ]);
        expect(replayGameplayCommands(
            primed,
            [JSON.parse(JSON.stringify(primeCommand))]
        )).toEqual(expect.objectContaining({ run: primeResult.run, events: primeResult.events }));
        expect(protectedResult).toMatchObject({
            accepted: true,
            run: { parasiteFloors: 0, parasiteWardRemaining: 0, lives: 2 }
        });
        expect(protectedResult.events).toEqual([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                thresholdTriggered: true,
                wardConsumed: true,
                lifeLost: false
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.ward_consumed'
            })
        ]);
        expect(hitResult).toMatchObject({
            accepted: true,
            run: { parasiteFloors: 0, parasiteWardRemaining: 0, lives: 1 }
        });
        expect(hitResult.events).toEqual([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                thresholdTriggered: true,
                wardConsumed: false,
                lifeLost: true
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'hazard.score_parasite.life_lost'
            })
        ]);
    });

    it('advances a complete floor through one flat replayable command', () => {
        const fixtureRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const initial: RunState = {
            ...fixtureRun,
            activeMutators: ['score_parasite'],
            parasiteFloors: 3,
            parasiteWardRemaining: 1,
            rewardPerkIds: ['hazard_banish_per_floor'],
            destroyPairCharges: 0
        };
        const command = createGameplayFloorAdvanceCommand('floor-advance-flat');
        const legacy = advanceToNextLevel(initial);
        const result = reduceGameplayCommand(initial, command);

        expect(result).toMatchObject({ accepted: true, run: { status: 'memorize', parasiteFloors: 0 } });
        expect(result.run).toEqual(legacy);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result.run.gameplayEventJournal).toEqual(initial.gameplayEventJournal);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'score_parasite.advanced',
                commandId: command.commandId,
                wardConsumed: true,
                lifeLost: false
            }),
            expect.objectContaining({
                type: 'hazard_banish.resolved',
                commandId: command.commandId
            }),
            expect.objectContaining({
                type: 'floor.advanced',
                commandId: command.commandId,
                fromFloor: initial.board!.level,
                toFloor: initial.board!.level + 1,
                outcome: 'memorize',
                hazardBanishOutcome: expect.any(String),
                boardPairCount: result.run.board!.pairCount,
                boardTileCount: result.run.board!.tiles.length,
                livesBefore: initial.lives,
                livesAfter: result.run.lives,
                parasitePressureBefore: 3,
                parasitePressureAfter: 0,
                parasiteWardBefore: 1,
                parasiteWardAfter: 0
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                source: { kind: 'system', id: 'floor_advance' },
                cue: 'floor.advance.ready'
            })
        ]));
        expect(result.events.flatMap((event) =>
            event.type === 'feedback.requested' ? [event.cue] : []
        )).toEqual([
            'hazard.score_parasite.ward_consumed',
            expect.stringMatching(/^perk\.hazard_banish\./u),
            'floor.advance.ready'
        ]);
        expect(result.events.every((event, sequence) =>
            event.commandId === command.commandId &&
            event.sequence === sequence &&
            event.eventId === `${command.commandId}:${sequence}`
        )).toBe(true);
        expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]).run).toEqual(result.run);

        const defeated = reduceGameplayCommand(
            { ...initial, lives: 1, parasiteWardRemaining: 0 },
            createGameplayFloorAdvanceCommand('floor-advance-defeated')
        );
        expect(defeated).toMatchObject({ accepted: true, run: { status: 'gameOver', lives: 0 } });
        expect(defeated.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'floor.advanced', outcome: 'game_over', boardPairCount: 0 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'floor.advance.defeated', tone: 'warning' })
        ]));

        const rejected = reduceGameplayCommand(
            { ...initial, sideRoom: createPlayablePathFixture('sideRoomSkip').run!.sideRoom },
            createGameplayFloorAdvanceCommand('floor-advance-blocked')
        );
        expect(rejected).toMatchObject({ accepted: false, run: expect.objectContaining({ status: 'levelComplete' }) });
    });

    it('consumes exactly one Wild Match token for a resolved wildcard bridge', () => {
        const wildcardRun = run({
            wildMatchesRemaining: 2,
            board: {
                ...board(),
                pairCount: 1,
                tiles: [
                    { ...tile('wild', WILD_PAIR_KEY), state: 'flipped' },
                    { ...tile('symbol', 'symbol'), state: 'flipped' },
                    tile('symbol-mate', 'symbol')
                ],
                flippedTileIds: ['wild', 'symbol']
            }
        });
        const result = reduceGameplayCommand(
            wildcardRun,
            createGameplayWildMatchConsumeCommand('wild-consume', 'wild', 'symbol')
        );
        const rejected = reduceGameplayCommand(
            wildcardRun,
            createGameplayWildMatchConsumeCommand('wild-hidden', 'wild', 'symbol-mate')
        );

        expect(result).toMatchObject({ accepted: true, run: { wildMatchesRemaining: 1 } });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'inventory.changed',
                itemId: 'wild_match_token',
                operation: 'consume',
                before: 2,
                after: 1,
                applied: -1
            }),
            expect.objectContaining({
                type: 'wild_match.consumed',
                wildTileId: 'wild',
                pairedTileId: 'symbol',
                tokensBefore: 2,
                tokensAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'wild_joker.match_consumed' })
        ]);
        expect(rejected).toMatchObject({ accepted: false, run: wildcardRun });
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

    it('resolves Hazard Banish as hazard removal, fallback Destroy, or explicit contract suppression', () => {
        const perkRun = run({
            status: 'memorize',
            rewardPerkIds: ['hazard_banish_per_floor'],
            destroyPairCharges: 0,
            board: {
                ...board(),
                level: 2,
                tiles: board().tiles.map((candidate) =>
                    candidate.pairKey === 'echo'
                        ? { ...candidate, tileHazardKind: 'shuffle_snare' as const }
                        : candidate
                )
            }
        });
        const removed = reduceGameplayCommand(perkRun, createGameplayHazardBanishCommand('banish-hazard'));
        const fallback = reduceGameplayCommand(
            { ...perkRun, board: board() },
            createGameplayHazardBanishCommand('banish-fallback')
        );
        const blocked = reduceGameplayCommand(
            {
                ...perkRun,
                activeContract: { noDestroy: true, noShuffle: false, maxMismatches: null }
            },
            createGameplayHazardBanishCommand('banish-blocked')
        );

        expect(removed).toMatchObject({ accepted: true, run: { destroyPairCharges: 0 } });
        expect(removed.run.board?.tiles.filter((candidate) => candidate.pairKey === 'echo'))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ tileHazardKind: undefined }),
                expect.objectContaining({ tileHazardKind: undefined })
            ]));
        expect(removed.events).toEqual([
            expect.objectContaining({
                type: 'hazard_banish.resolved',
                outcome: 'hazard_removed',
                floor: 2,
                targetPairKey: 'echo',
                hazardKind: 'shuffle_snare',
                affectedTileIds: ['echo-a', 'echo-b']
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'perk.hazard_banish.hazard_removed' })
        ]);
        expect(fallback).toMatchObject({ accepted: true, run: { destroyPairCharges: 1 } });
        expect(fallback.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'destroy_charge', applied: 1 }),
            expect.objectContaining({ type: 'hazard_banish.resolved', outcome: 'destroy_charge_granted' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'perk.hazard_banish.destroy_granted' })
        ]);
        expect(blocked).toMatchObject({ accepted: true, run: { destroyPairCharges: 0 } });
        expect(blocked.events).toEqual([
            expect.objectContaining({ type: 'hazard_banish.resolved', outcome: 'contract_blocked' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'perk.hazard_banish.contract_blocked' })
        ]);
    });

    it('selects a route through a replayable command with exact progression deltas', () => {
        const initial = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const choice = initial.lastLevelResult!.routeChoices!.find((candidate) => candidate.routeType === 'greed')!;
        const command = createGameplayRouteChooseCommand('route-greed', choice.id);
        const result = reduceGameplayCommand(initial, command);
        const beforeStats = normalizeSessionStats(initial.stats);

        expect(result).toMatchObject({
            accepted: true,
            run: {
                lives: initial.lives - 1,
                shopGold: initial.shopGold + 3,
                pendingRouteCardPlan: { choiceId: choice.id, routeType: 'greed' },
                dungeonRun: { selectedNodeId: choice.id },
                sideRoom: {
                    routeType: 'greed',
                    floor: initial.board!.level + 1
                }
            }
        });
        expect(normalizeSessionStats(result.run.stats).totalScore).toBe(beforeStats.totalScore + 35);
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'route.choice_selected',
                choiceId: choice.id,
                routeType: 'greed',
                outcome: 'greed',
                selectedDungeonNodeId: choice.id,
                livesBefore: initial.lives,
                livesAfter: initial.lives - 1,
                shopGoldBefore: initial.shopGold,
                shopGoldAfter: initial.shopGold + 3,
                totalScoreBefore: beforeStats.totalScore,
                totalScoreAfter: beforeStats.totalScore + 35
            }),
            expect.objectContaining({
                type: 'side_room.opened',
                roomId: result.run.sideRoom!.id,
                roomKind: result.run.sideRoom!.kind,
                routeType: 'greed',
                nodeKind: result.run.sideRoom!.nodeKind,
                floor: result.run.sideRoom!.floor,
                payloadKind: result.run.sideRoom!.payload.kind
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'route.choice.greed',
                tone: 'warning'
            })
        ]);
        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(reduceGameplayCommand(initial, createGameplayRouteChooseCommand('route-missing', 'missing')))
            .toMatchObject({ accepted: false, run: initial });
    });

    it('selects a relic through one replayable command covering ownership, immediate effect, and offer outcome', () => {
        const initial = createPlayablePathFixture('relicDraft').run!;
        const relicId = initial.relicOffer!.options[0]!;
        const command = createGameplayRelicPickCommand('relic-pick-core', relicId);
        const result = reduceGameplayCommand(initial, command);

        expect(result).toMatchObject({
            accepted: true,
            run: {
                relicIds: expect.arrayContaining([relicId]),
                relicOffer: { picksRemaining: initial.relicOffer!.picksRemaining - 1, pickRound: 1 },
                relicTiersClaimed: initial.relicTiersClaimed
            }
        });
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'feedback.requested',
                source: { kind: 'relic', id: relicId }
            }),
            expect.objectContaining({
                type: 'relic.picked',
                relicId,
                outcome: 'offer_continues',
                picksRemainingBefore: initial.relicOffer!.picksRemaining,
                picksRemainingAfter: initial.relicOffer!.picksRemaining - 1,
                relicCountAfter: initial.relicIds.length + 1
            })
        ]));
        const secondRelicId = result.run.relicOffer!.options[0]!;
        const secondCommand = createGameplayRelicPickCommand('relic-pick-core-final', secondRelicId);
        const finalResult = reduceGameplayCommand(result.run, secondCommand);
        expect(finalResult).toMatchObject({
            accepted: true,
            run: {
                relicIds: expect.arrayContaining([relicId, secondRelicId]),
                relicOffer: null,
                relicTiersClaimed: initial.relicTiersClaimed + 1
            },
            events: expect.arrayContaining([
                expect.objectContaining({
                    type: 'relic.picked',
                    relicId: secondRelicId,
                    outcome: 'advance_ready',
                    picksRemainingAfter: 0
                })
            ])
        });
        expect(replayGameplayCommands(
            initial,
            [JSON.parse(JSON.stringify(command)), JSON.parse(JSON.stringify(secondCommand))]
        ).run).toEqual(finalResult.run);
        expect(reduceGameplayCommand(
            { ...initial, relicOffer: null },
            createGameplayRelicPickCommand('relic-stale', relicId)
        )).toMatchObject({ accepted: false, run: { relicOffer: null } });
    });

    it('opens or safely skips a milestone relic draft through one replayable command', () => {
        const fixture = createPlayablePathFixture('relicDraft').run!;
        const initial: RunState = {
            ...fixture,
            relicIds: [],
            relicOffer: null,
            relicTiersClaimed: 0,
            bonusRelicPicksNextOffer: 2,
            favorBonusRelicPicksNextOffer: 2
        };
        const command = createGameplayRelicOfferOpenCommand('relic-offer-open-core');
        const result = reduceGameplayCommand(initial, command);
        const legacy = openRelicOffer(initial);

        expect(result.accepted).toBe(true);
        expect(result.run).toEqual(legacy);
        expect(result.run.gameplayCommandJournal).toEqual(initial.gameplayCommandJournal);
        expect(result).toMatchObject({
            run: {
                bonusRelicPicksNextOffer: 0,
                favorBonusRelicPicksNextOffer: 0,
                relicOffer: {
                    tier: 1,
                    options: expect.any(Array),
                    picksRemaining: 3,
                    pickRound: 0,
                    favorBonusPicks: 2
                }
            }
        });
        expect(result.events).toEqual([
            expect.objectContaining({
                type: 'relic.offer_opened',
                outcome: 'opened',
                clearedFloor: 3,
                offerTier: 1,
                options: result.run.relicOffer!.options,
                picksRemaining: 3,
                bonusPicksBefore: 2,
                bonusPicksAfter: 0,
                favorBonusPicksBefore: 2,
                favorBonusPicksAfter: 0,
                favorBonusPicksInOffer: 2,
                relicTiersBefore: 0,
                relicTiersAfter: 0
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'relic.offer.opened',
                tone: 'reward'
            })
        ]);
        const replayed = replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]);
        expect(replayed.run).toEqual(result.run);
        expect(replayed.events).toEqual(result.events);
        expect(reduceGameplayCommand(result.run, createGameplayRelicOfferOpenCommand('relic-offer-repeat')))
            .toMatchObject({ accepted: false, run: result.run });

        const exhausted: RunState = {
            ...initial,
            relicIds: [...GAMEPLAY_RELIC_IDS],
            bonusRelicPicksNextOffer: 0,
            favorBonusRelicPicksNextOffer: 0
        };
        const skipped = reduceGameplayCommand(
            exhausted,
            createGameplayRelicOfferOpenCommand('relic-offer-skip')
        );
        expect(skipped).toMatchObject({
            accepted: true,
            run: { relicOffer: null, relicTiersClaimed: 1 },
            events: [
                expect.objectContaining({
                    type: 'relic.offer_opened',
                    outcome: 'milestone_skipped',
                    options: [],
                    picksRemaining: 0,
                    relicTiersBefore: 0,
                    relicTiersAfter: 1
                }),
                expect.objectContaining({
                    type: 'feedback.requested',
                    cue: 'relic.offer.milestone_skipped'
                })
            ]
        });
    });

    it('resolves rest, event, bonus, and skip side rooms through flat replayable commands', () => {
        const cases = [
            {
                action: 'claim' as const,
                initial: createPlayablePathFixture('sideRoomPrimary').run!,
                choiceId: undefined,
                legacy: (candidate: RunState) => claimRouteSideRoomPrimary(candidate),
                outcome: 'rest_healed'
            },
            {
                action: 'claim' as const,
                initial: createPlayablePathFixture('sideRoomChoice').run!,
                choiceId: createPlayablePathFixture('sideRoomChoice').run!.sideRoom!.choices!
                    .find((choice) => choice.primary)!.id,
                legacy: (candidate: RunState, choiceId?: string) => claimRouteSideRoomChoice(candidate, choiceId),
                outcome: 'event_applied'
            },
            {
                action: 'claim' as const,
                initial: createPlayablePathFixture('sideRoomSkip').run!,
                choiceId: createPlayablePathFixture('sideRoomSkip').run!.sideRoom!.choices!
                    .find((choice) => choice.primary)!.id,
                legacy: (candidate: RunState, choiceId?: string) => claimRouteSideRoomChoice(candidate, choiceId),
                outcome: 'bonus_claimed'
            },
            {
                action: 'skip' as const,
                initial: createPlayablePathFixture('sideRoomSkip').run!,
                choiceId: undefined,
                legacy: (candidate: RunState) => skipRouteSideRoom(candidate),
                outcome: 'skipped'
            }
        ];
        const withoutJournals = (candidate: RunState): RunState => ({
            ...candidate,
            gameplayCommandJournal: [],
            gameplayEventJournal: []
        });

        for (const [index, row] of cases.entries()) {
            const command = createGameplaySideRoomResolveCommand(
                `side-room-core-${index}`,
                row.action,
                row.choiceId
            );
            const result = reduceGameplayCommand(row.initial, command);
            const legacy = row.legacy(row.initial, row.choiceId);

            expect(result.accepted).toBe(true);
            expect(withoutJournals(result.run)).toEqual(withoutJournals(legacy));
            expect(result.run.gameplayCommandJournal).toEqual(row.initial.gameplayCommandJournal);
            expect(result.run.gameplayEventJournal).toEqual(row.initial.gameplayEventJournal);
            expect(result.events).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'side_room.resolved',
                    action: row.action,
                    outcome: row.outcome
                })
            ]));
            expect(result.events.every((event, sequence) =>
                event.commandId === command.commandId
                && event.sequence === sequence
                && event.eventId === `${command.commandId}:${sequence}`
            )).toBe(true);
            expect(replayGameplayCommands(
                row.initial,
                [JSON.parse(JSON.stringify(command))]
            ).run).toEqual(result.run);
        }

        const eventRun = createPlayablePathFixture('sideRoomChoice').run!;
        expect(reduceGameplayCommand(
            eventRun,
            createGameplaySideRoomResolveCommand('side-room-invalid', 'claim', 'missing-choice')
        )).toMatchObject({ accepted: false, run: eventRun });

        const shrineBase = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 7123 });
        const chestChoiceId = `${shrineBase.runRulesVersion}:${shrineBase.runSeed}:4:chest_gold`;
        const shrineRun: RunState = {
            ...shrineBase,
            status: 'levelComplete',
            relicIds: ['shrine_echo'],
            sideRoom: {
                id: `${chestChoiceId}:side`,
                kind: 'bonus_reward',
                routeType: 'greed',
                nodeKind: 'treasure',
                floor: 4,
                title: 'Greed Treasure chest',
                body: 'A deterministic first treasure claim.',
                primaryLabel: 'Claim treasure',
                primaryDetail: 'Claim the authored chest payout.',
                skipLabel: 'Leave it',
                choices: [{
                    id: chestChoiceId,
                    label: 'Treasure chest',
                    detail: 'Claim chest payout.',
                    primary: true
                }],
                payload: { kind: 'bonus_reward', instanceId: chestChoiceId }
            }
        };
        const shrineResult = reduceGameplayCommand(
            shrineRun,
            createGameplaySideRoomResolveCommand('side-room-shrine-echo', 'claim', chestChoiceId)
        );
        expect(shrineResult).toMatchObject({
            accepted: true,
            run: {
                relicFavorProgress: shrineRun.relicFavorProgress + 1,
                bonusRewardLedger: { openedTreasureRooms: 1 }
            },
            events: expect.arrayContaining([
                expect.objectContaining({
                    type: 'feedback.requested',
                    cue: 'build.shrine_echo.treasure_claimed',
                    source: { kind: 'relic', id: 'shrine_echo' }
                })
            ])
        });
    });

    it('uses relic draft services through replayable commands with exact option and economy deltas', () => {
        for (const serviceId of RELIC_OFFER_SERVICE_IDS) {
            const initial = createPlayablePathFixture('relicDraft').run!;
            const targetRelicId = serviceId === 'ban_option' ? initial.relicOffer!.options[0] : undefined;
            const command = createGameplayRelicOfferServiceCommand(
                `relic-service-${serviceId}`,
                serviceId,
                targetRelicId
            );
            const legacy = applyRelicOfferService(initial, serviceId, targetRelicId);
            const result = reduceGameplayCommand(initial, command);

            expect(legacy.applied).toBe(true);
            expect(result).toMatchObject({ accepted: true, run: legacy.run });
            expect(result.events).toEqual([
                expect.objectContaining({
                    type: 'relic.offer_service_used',
                    serviceId,
                    targetRelicId: targetRelicId ?? null,
                    cost: serviceId === 'upgrade_offer' ? 3 : 2,
                    shopGoldBefore: initial.shopGold,
                    shopGoldAfter: legacy.run.shopGold,
                    optionsBefore: initial.relicOffer!.options,
                    optionsAfter: legacy.run.relicOffer!.options
                }),
                expect.objectContaining({
                    type: 'feedback.requested',
                    cue: `relic.offer_service.${serviceId}`,
                    source: { kind: 'system', id: 'relic_offer' }
                })
            ]);
            expect(replayGameplayCommands(initial, [JSON.parse(JSON.stringify(command))]).run).toEqual(result.run);
            expect(reduceGameplayCommand(result.run, command)).toMatchObject({ accepted: false, run: result.run });
        }
    });

    it('models Vaultbreaker treasure extraction from chest through opener, Shrine Echo, and Score Glint', () => {
        expect(VAULTBREAKER_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.chest_gold',
            'bonus_reward.cursed_opener_contract',
            'reward_perk.cursed_opener_greed',
            'relic.shrine_echo',
            'relic.shrine_echo.treasure_claim',
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
        const outerEvents: GameplayEvent[] = [];
        const flatWon = resolveSlayerFloorClearEffects(
            ledger.run,
            {
                bossTrophyClaimed: true,
                riskWagerOutcome: 'won',
                featuredObjectiveCompleted: true,
                scoreParasiteActive: true
            },
            'slayer-flat-clear',
            outerEvents
        );

        expect(compass).toMatchObject({ migrated: true, run: { peekCharges: 1 } });
        expect(surety).toMatchObject({ migrated: true, run: { stats: { guardTokens: 1 } } });
        expect(ledger).toMatchObject({ migrated: true, run: { parasiteWardRemaining: 1 } });
        expect(won).toMatchObject({ bossTrophyScoreGain: 30, riskWagerFavorGain: 1, parasiteRelief: 1 });
        expect(flatWon).toMatchObject({
            commands: [],
            bossTrophyScoreGain: 30,
            riskWagerFavorGain: 1,
            parasiteRelief: 1
        });
        expect(flatWon.events).toEqual(outerEvents);
        expect(flatWon.events.every((event, sequence) =>
            event.commandId === 'slayer-flat-clear'
            && event.sequence === sequence
            && event.eventId === `slayer-flat-clear:${sequence}`
        )).toBe(true);
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

    it('models Conduit information control and Emergency Toolkit correction through their authoritative definitions', () => {
        expect(CONDUIT_CARTOGRAPHER_DEFINITIONS.every((definition) => definition.buildId === 'conduit_cartographer')).toBe(true);
        expect(SUPPLY_CACHE_DEFINITIONS.every((definition) => definition.buildId === 'emergency_toolkit')).toBe(true);
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
            createGameplayDefinitionCommand('conduit-secret', 'bonus_reward.secret_favor')
        );
        const strayRelic = applyRelicImmediateThroughGameplayCore(
            reward.run,
            'stray_charge_plus_one',
            'toolkit-stray-hook'
        );
        const pinRelic = applyRelicImmediateThroughGameplayCore(
            strayRelic.run,
            'pin_cap_plus_one',
            'conduit-memory-nail'
        );
        const glint = resolveFindableMatchRewardThroughGameplayCore(
            pinRelic.run,
            'scout_glint',
            'conduit-scout-glint'
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

        const pinCommand = createGameplayPinToggleCommand('conduit-pin', 'echo-a');
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
            strayRemoveArmed: false,
            recallFocus: 2
        } as RunState;
        const strayCommand = createGameplayStrayRemoveCommand('toolkit-stray', 'wild');
        const removed = reduceGameplayCommand(strayRun, strayCommand);
        expect(removed.accepted).toBe(true);
        expect(removed.run).toEqual(applyStrayRemove(strayRun, 'wild', { requireArmed: false }));
        expect(removed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'stray_remove_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.stray_removed',
                targetTileId: 'wild',
                recallFocusAfter: 1,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 1
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'power.stray_remove.used',
                message: expect.stringContaining('Recall focus 1/3; 1 tile memory is unstable.')
            })
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
        const migratedMemorize = applyRelicImmediateThroughGameplayCore(initial, 'memorize_bonus_ms', 'adapter-memorize');

        expect(migrated).toMatchObject({ migrated: true, run: { peekCharges: 3 } });
        expect(migrated.events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'inventory.changed', source: { kind: 'relic', id: 'peek_charge_plus_one' } }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'build.peek_relic.claimed' })
            ])
        );
        expect(migratedShuffle).toMatchObject({ migrated: true, run: { shuffleCharges: 2 } });
        expect(migratedMemorize).toMatchObject({ migrated: true });
        expect(migratedMemorize.events).toEqual([
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'build.memorize_bonus_ms.claimed',
                source: { kind: 'relic', id: 'memorize_bonus_ms' }
            })
        ]);
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
            expect.objectContaining({
                type: 'board.peeked',
                targetTileId: 'echo-a',
                recallFocusBefore: 2,
                recallFocusAfter: 1,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 1
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'power.peek.used',
                message: expect.stringContaining('Recall focus 1/3; 1 tile memory is unstable.')
            })
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
            expect.objectContaining({
                type: 'board.shuffled',
                shuffleNonceBefore: 0,
                shuffleNonceAfter: 1,
                recallFocusBefore: 2,
                recallFocusAfter: 0,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 4
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'power.shuffle.used',
                message: expect.stringContaining('Recall focus 0/3; 4 tile memories are unstable.')
            })
        ]);

        const regionShuffled = reduceGameplayCommand(
            initial,
            createGameplayRegionShuffleCommand('shuffle-row', 0)
        );
        expect(regionShuffled.accepted).toBe(true);
        expect(regionShuffled.run).toEqual(applyRegionShuffle(initial, 0));
        expect(regionShuffled.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'region_shuffle_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.region_shuffled',
                rowIndex: 0,
                recallFocusBefore: 2,
                recallFocusAfter: 0,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 2
            }),
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
                secondTileId: 'conduit-a',
                recallFocusBefore: 2,
                recallFocusAfter: 0,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 2
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.tile_swap.used' })
        ]);
    });

    it('spends the rearmed free-swap perk through one typed row-shuffle command', () => {
        const initial = run({
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            rewardPerkIds: ['free_first_swap_per_floor']
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayRegionShuffleCommand('free-perk-row', 0)
        );

        expect(result.accepted).toBe(true);
        expect(result.run.regionShuffleCharges).toBe(0);
        expect(result.run.regionShuffleFreeThisFloor).toBe(false);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'board.region_shuffled',
                usedFreeCharge: true
            })
        ]));
    });

    it('models Memory Scout acquisition and clean-streak Flash Pair generation', () => {
        expect(MEMORY_SCOUT_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.trait_streak_lens',
            'reward_perk.trait_streak_toolkit',
            'relic.memorize_bonus_ms',
            'relic.memorize_under_short_memorize'
        ]);
        expect(MEMORY_SCOUT_DEFINITIONS.every(
            (definition) => gameplayContentDefinitionSchema.safeParse(definition).success
        )).toBe(true);

        const lens = reduceGameplayCommand(
            run(),
            createGameplayDefinitionCommand('trait-lens', 'bonus_reward.trait_streak_lens')
        );
        expect(lens.run.rewardPerkIds).toContain('trait_streak_toolkit');
        expect(lens.run.stats.totalScore).toBe(10);

        const active = run({
            rewardPerkIds: ['trait_streak_toolkit'],
            flashPairCharges: 0,
            stats: { ...run().stats, currentStreak: 2 }
        });
        const sourceTiles = [tile('echo-a', 'echo', 'echo'), tile('echo-b', 'echo', 'echo')];
        const traitResult = resolveTileTraitEffects({
            run: active,
            board: active.board,
            sourceTiles,
            source: 'match'
        });
        expect(traitResult.flashPairChargeGain).toBe(1);
        expect(traitResult.gameplayCommands).toEqual([
            expect.objectContaining({ type: 'effects.apply', definitionId: 'reward_perk.trait_streak_toolkit' })
        ]);
        expect(traitResult.gameplayEvents).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'flash_pair_charge', applied: 1 }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'build.trait_streak_toolkit.triggered' })
        ]));
        const manufactured = reduceGameplayCommand(
            active,
            createGameplayDefinitionCommand('manufactured-flash', 'reward_perk.trait_streak_toolkit')
        );
        expect(manufactured.accepted).toBe(false);
        expect(manufactured.run).toBe(active);
        expect(manufactured.events).toEqual([
            expect.objectContaining({ type: 'command.rejected', reason: expect.stringContaining('no trait was matched') })
        ]);

        for (const relicId of ['memorize_bonus_ms', 'memorize_under_short_memorize'] as const) {
            const migrated = applyRelicImmediateThroughGameplayCore(active, relicId, `relic:${relicId}`);
            expect(migrated.migrated).toBe(true);
            expect(migrated.run).toEqual(expect.objectContaining({ gameplayCommandJournal: expect.any(Array) }));
            expect(migrated.events).toEqual([
                expect.objectContaining({ type: 'feedback.requested', source: { kind: 'relic', id: relicId } })
            ]);
        }
    });

    it('preserves Flash Pair and Undo parity while journaling exact recovery deltas', () => {
        const flashRun = run({
            practiceMode: true,
            flashPairCharges: 1,
            flashPairRevealedTileIds: [],
            shuffleNonce: 0
        });
        const flashed = reduceGameplayCommand(flashRun, createGameplayFlashPairCommand('flash-pair'));
        expect(flashed.accepted).toBe(true);
        expect(flashed.run).toEqual(applyFlashPair(flashRun));
        expect(flashed.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'flash_pair_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.flash_pair_revealed',
                revealedTileIds: ['echo-a', 'echo-b'],
                shuffleNonceBefore: 0,
                shuffleNonceAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'power.flash_pair.used' })
        ]);

        const resolvingBoard = board();
        resolvingBoard.flippedTileIds = ['echo-a', 'conduit-a'];
        resolvingBoard.tiles = resolvingBoard.tiles.map((candidate) =>
            resolvingBoard.flippedTileIds.includes(candidate.id)
                ? { ...candidate, state: 'flipped' as const }
                : candidate
        );
        const undoRun = run({
            status: 'resolving',
            board: resolvingBoard,
            undoUsesThisFloor: 1,
            recallFocus: 2,
            forgottenTileIdsThisFloor: []
        });
        const undone = reduceGameplayCommand(undoRun, createGameplayUndoResolveCommand('undo-resolve'));
        expect(undone.accepted).toBe(true);
        expect(undone.run).toEqual(cancelResolvingWithUndo(undoRun));
        expect(undone.events).toEqual([
            expect.objectContaining({ type: 'inventory.changed', itemId: 'undo_charge', applied: -1 }),
            expect.objectContaining({
                type: 'board.resolve_undone',
                restoredTileIds: ['echo-a', 'conduit-a'],
                undoUsesBefore: 1,
                undoUsesAfter: 0,
                recallFocusBefore: 2,
                recallFocusAfter: 1,
                forgottenTileCountBefore: 0,
                forgottenTileCountAfter: 2
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'power.undo_resolve.used',
                message: expect.stringContaining('Recall focus 1/3; 2 tile memories are unstable.')
            })
        ]);
    });

    it('models Locksmith insurance, Master Key purchase, and explicit exit spend', () => {
        expect(LOCKSMITH_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.key_insurance'
        ]);
        const initial = run({ dungeonKeys: {}, shopGold: 0 });
        const reward = {
            ...BONUS_REWARD_CATALOG.key_insurance,
            instanceId: 'reward:key-insurance:91',
            runSeed: initial.runSeed,
            rulesVersion: initial.runRulesVersion,
            floor: 3,
            offlineOnly: true as const,
            eligible: true,
            unavailableReason: null
        };
        const legacyReward = previewBonusRewardClaim(initial, reward).run;
        const claimed = reduceGameplayCommand(
            initial,
            createGameplayDefinitionCommand('key-insurance', 'bonus_reward.key_insurance')
        );
        expect(claimed.run.dungeonKeys).toEqual(legacyReward.dungeonKeys);
        expect(claimed.run.shopGold).toBe(legacyReward.shopGold);
        expect(claimed.run.stats.totalScore).toBe(legacyReward.stats.totalScore);

        const shopRun = run({
            status: 'levelComplete',
            shopGold: 5,
            dungeonMasterKeys: 0,
            lives: 3,
            shopOffers: [{
                id: 'offer-master',
                itemId: 'master_key',
                category: 'consumable',
                label: 'Master key',
                description: 'Opens any one lock.',
                cost: 2,
                baseCost: 2,
                stock: 1,
                maxStock: 1,
                stackLimit: null,
                compatibleWhen: 'not_capped',
                compatible: true,
                unavailableReason: null,
                purchased: false
            }]
        });
        const bought = reduceGameplayCommand(
            shopRun,
            createGameplayShopPurchaseCommand('buy-master', 'offer-master')
        );
        expect(bought.accepted).toBe(true);
        expect(bought.run).toEqual(purchaseShopOffer(shopRun, 'offer-master'));
        expect(bought.events).toEqual([
            expect.objectContaining({
                type: 'shop.offer_purchased',
                itemId: 'master_key',
                shopGoldBefore: 5,
                shopGoldAfter: 3,
                masterKeysBefore: 0,
                masterKeysAfter: 1
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'shop.master_key.purchased',
                message: 'Master key purchased for 2 shop gold; 3 remains.'
            })
        ]);
        expect(reduceGameplayCommand(
            { ...shopRun, status: 'playing' },
            createGameplayShopPurchaseCommand('buy-outside-shop', 'offer-master')
        )).toMatchObject({
            accepted: false,
            run: { status: 'playing', shopGold: 5 },
            events: [expect.objectContaining({ type: 'command.rejected' })]
        });

        const rerollBase = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 2404 });
        const rerollRun: RunState = {
            ...rerollBase,
            status: 'levelComplete',
            shopGold: 10,
            shopRerolls: 0,
            shopOffers: createRunShopOffers({ ...rerollBase, shopGold: 10, shopRerolls: 0 })
        };
        const rerollCommand = createGameplayShopRerollCommand('reroll-stock');
        const rerolled = reduceGameplayCommand(rerollRun, rerollCommand);
        const legacyReroll = rerollShopOffers(rerollRun);
        expect(rerolled.accepted).toBe(true);
        expect(rerolled.run).toEqual(legacyReroll);
        expect(rerolled.run.gameplayCommandJournal).toEqual(rerollRun.gameplayCommandJournal);
        expect(rerolled.events).toEqual([
            expect.objectContaining({
                type: 'shop.stock_rerolled',
                floor: rerollRun.board!.level,
                cost: 1,
                shopGoldBefore: 10,
                shopGoldAfter: 9,
                rerollsBefore: 0,
                rerollsAfter: 1,
                offerIdsBefore: rerollRun.shopOffers.map((offer) => offer.id),
                offerIdsAfter: legacyReroll.shopOffers.map((offer) => offer.id),
                itemIdsBefore: rerollRun.shopOffers.map((offer) => offer.itemId),
                itemIdsAfter: legacyReroll.shopOffers.map((offer) => offer.itemId)
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'shop.stock.rerolled' })
        ]);
        const replayedReroll = replayGameplayCommands(
            rerollRun,
            JSON.parse(JSON.stringify([rerollCommand])) as unknown[]
        );
        expect(replayedReroll.run).toEqual(rerolled.run);
        expect(replayedReroll.events).toEqual(rerolled.events);
        expect(reduceGameplayCommand(rerolled.run, createGameplayShopRerollCommand('reroll-again'))).toMatchObject({
            accepted: false,
            run: rerolled.run,
            events: [expect.objectContaining({ type: 'command.rejected' })]
        });
        expect(reduceGameplayCommand(
            { ...rerollRun, status: 'playing' },
            createGameplayShopRerollCommand('reroll-outside-shop')
        )).toMatchObject({
            accepted: false,
            run: { status: 'playing', shopGold: 10, shopRerolls: 0 },
            events: [expect.objectContaining({ type: 'command.rejected' })]
        });
        const pausedBoardShopRun: RunState = {
            ...rerollRun,
            status: 'paused',
            board: { ...rerollRun.board!, dungeonShopVisited: true },
            timerState: { ...rerollRun.timerState, pausedFromStatus: 'playing' }
        };
        expect(reduceGameplayCommand(
            pausedBoardShopRun,
            createGameplayShopRerollCommand('reroll-paused-board-shop')
        )).toMatchObject({
            accepted: true,
            run: { status: 'paused', shopGold: 9, shopRerolls: 1 }
        });
        expect(reduceGameplayCommand(
            { ...pausedBoardShopRun, board: { ...pausedBoardShopRun.board!, dungeonShopVisited: false } },
            createGameplayShopRerollCommand('reroll-paused-non-shop')
        )).toMatchObject({
            accepted: false,
            run: { status: 'paused', shopGold: 10, shopRerolls: 0 },
            events: [expect.objectContaining({ type: 'command.rejected' })]
        });

        const base = createNewRun(0, { runSeed: 2405 });
        const exitBoard: BoardState = {
            ...base.board!,
            pairCount: 1,
            matchedPairs: 0,
            flippedTileIds: ['exit'],
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            tiles: [
                tile('exit', EXIT_PAIR_KEY),
                tile('a1', 'a'),
                tile('a2', 'a')
            ].map((candidate) => candidate.id === 'exit'
                ? {
                      ...candidate,
                      state: 'flipped' as const,
                      dungeonCardKind: 'exit' as const,
                      dungeonCardState: 'revealed' as const,
                      dungeonExitLockKind: 'iron' as const
                  }
                : candidate)
        };
        const exitRun: RunState = {
            ...base,
            status: 'playing',
            board: exitBoard,
            dungeonKeys: { iron: 0 },
            dungeonMasterKeys: 1,
            dungeonGatewaysUsed: 0
        };
        const activated = reduceGameplayCommand(
            exitRun,
            createGameplayDungeonExitActivateCommand('activate-master-exit', 'master_key')
        );
        const legacyExit = createDungeonExitActivationTransition(exitRun, 'master_key')!;
        expect(activated.accepted).toBe(true);
        expect(activated.run).toEqual(finalizeLevel(legacyExit.run, legacyExit.board));
        expect(activated.run.status).toBe('levelComplete');
        expect(activated.run.gameplayCommandJournal).toEqual(exitRun.gameplayCommandJournal);
        expect(activated.run.gameplayEventJournal).toEqual(exitRun.gameplayEventJournal);
        expect(activated.events).toEqual([
            expect.objectContaining({
                type: 'dungeon.exit_activated',
                exitTileId: 'exit',
                spend: 'master_key',
                masterKeysBefore: 1,
                masterKeysAfter: 0,
                gatewayUsesAfter: 1
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'dungeon.exit.activated' })
        ]);
        expect(activated.events.every((event, sequence) =>
            event.commandId === 'activate-master-exit' &&
            event.sequence === sequence &&
            event.eventId === `activate-master-exit:${sequence}`
        )).toBe(true);
        expect(replayGameplayCommands(
            exitRun,
            [JSON.parse(JSON.stringify(createGameplayDungeonExitActivateCommand(
                'activate-master-exit',
                'master_key'
            )))]
        )).toMatchObject({
            run: activated.run,
            events: activated.events,
            acceptedCommandIds: ['activate-master-exit']
        });
    });

    it('emits exact typed spend and reward feedback when a locked room cache opens', () => {
        const lockedCache: Tile = {
            ...tile('locked-cache', ROOM_PAIR_KEY),
            dungeonCardKind: 'room',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'room_locked_cache',
            dungeonKeyKind: 'treasure',
            dungeonRoomUsed: false
        };
        const initial = run({
            board: {
                ...board(),
                tiles: [lockedCache, tile('a1', 'a'), tile('a2', 'a')],
                pairCount: 1,
                matchedPairs: 0
            },
            dungeonKeys: { treasure: 1 },
            dungeonMasterKeys: 1,
            shopGold: 2,
            stats: {
                ...run().stats,
                totalScore: 10,
                currentLevelScore: 10,
                comboShards: 0,
                guardTokens: 0,
                currentStreak: 0
            }
        });
        const result = reduceGameplayCommand(
            initial,
            createGameplayTileFlipCommand('open-locked-cache', lockedCache.id)
        );

        expect(result.accepted).toBe(true);
        expect(result.run.dungeonKeys.treasure).toBe(0);
        expect(result.run.dungeonMasterKeys).toBe(1);
        expect(result.run.shopGold).toBe(6);
        expect(result.run.stats.totalScore).toBe(60);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'dungeon.locked_cache_opened',
                tileId: lockedCache.id,
                spend: 'key',
                keyKind: 'treasure',
                keyCountBefore: 1,
                keyCountAfter: 0,
                masterKeysBefore: 1,
                masterKeysAfter: 1,
                shopGoldBefore: 2,
                shopGoldAfter: 6,
                scoreBefore: 10,
                scoreAfter: 60
            }),
            expect.objectContaining({
                type: 'feedback.requested',
                cue: 'dungeon.locked_cache.opened'
            })
        ]));
        expect(result.events.every((event, sequence) =>
            gameplayEventSchema.safeParse(event).success &&
            event.sequence === sequence &&
            event.eventId === `open-locked-cache:${sequence}`
        )).toBe(true);
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
