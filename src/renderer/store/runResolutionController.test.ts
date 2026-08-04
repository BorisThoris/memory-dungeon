import { describe, expect, it, vi } from 'vitest';
import type { AchievementId, BoardState, RunState, SaveData, Settings, Tile, ViewState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
import { enableDebugPeek } from '../../shared/run-timer-rules';
import type { MatchScorePop, MismatchScorePop } from './matchScorePop';
import { createRunResolutionController } from './runResolutionController';

const gameSfxMocks = vi.hoisted(() => ({
    playFloorClearSfx: vi.fn(),
    playMatchPayoffSfx: vi.fn(),
    playResolveSfx: vi.fn(),
    resumeAudioContext: vi.fn()
}));

const telemetryMocks = vi.hoisted(() => ({
    trackEvent: vi.fn()
}));

vi.mock('../audio/gameSfx', () => gameSfxMocks);
vi.mock('../../shared/telemetry', () => telemetryMocks);

type ResolutionPatch = Partial<{
    achievementBridgeNotice: string | null;
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    dungeonExitPromptOpen: boolean;
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
    newlyUnlockedAchievements: AchievementId[];
    peekModeArmed: boolean;
    run: RunState | null;
    runStartSaveData: SaveData | null;
    saveData: SaveData;
    settings: Settings;
    shopReturnMode: 'floor' | 'summary' | null;
    strayRemoveArmed: boolean;
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    view: ViewState;
}>;

interface Harness {
    patches: ResolutionPatch[];
    persistSaveData: ReturnType<typeof vi.fn>;
    persistSaveDataThenUnlockAchievements: ReturnType<typeof vi.fn>;
    state: {
        run: RunState | null;
        runStartSaveData: SaveData | null;
        saveData: SaveData;
    } & ResolutionPatch;
    controller: ReturnType<typeof createRunResolutionController>;
}

const runSurfaceReset = {
    boardPinMode: false,
    destroyPairArmed: false,
    dungeonExitPromptOpen: false,
    matchScorePop: null,
    mismatchScorePop: null,
    peekModeArmed: false,
    shopReturnMode: null,
    strayRemoveArmed: false,
    tileSwapArmed: false,
    tileSwapFirstTileId: null
} satisfies ResolutionPatch;

const createHarness = (run: RunState | null = null): Harness => {
    const saveData = createDefaultSaveData();
    const state: Harness['state'] = {
        run,
        runStartSaveData: saveData,
        saveData,
        ...runSurfaceReset,
        view: 'playing'
    };
    const patches: ResolutionPatch[] = [];
    const persistSaveData = vi.fn(async (nextSave: SaveData) => nextSave);
    const persistSaveDataThenUnlockAchievements = vi.fn(async () => ({ failures: [] }));
    const controller = createRunResolutionController({
        getSfxGain: () => 0.5,
        getState: () => state,
        persistSaveData,
        persistSaveDataThenUnlockAchievements,
        runSurfaceReset,
        setState: (patch) => {
            patches.push(patch);
            Object.assign(state, patch);
        }
    });

    return {
        controller,
        patches,
        persistSaveData,
        persistSaveDataThenUnlockAchievements,
        state
    };
};

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    label: id,
    pairKey,
    state,
    symbol: id
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: [],
    floorArchetypeId: null,
    level: 1,
    matchedPairs: 0,
    pairCount: Math.max(0, Math.floor(tiles.filter((candidate) => candidate.pairKey !== EXIT_PAIR_KEY).length / 2)),
    rows: Math.ceil(tiles.length / 2),
    tiles,
    ...overrides
});

describe('runResolutionController', () => {
    it('applies level-complete runs, updates save data, and persists without achievement bridge work when no unlocks fire', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const levelCompleteRun: RunState = {
            ...baseRun,
            achievementsEnabled: false,
            status: 'levelComplete',
            stats: {
                ...baseRun.stats,
                bestScore: 250,
                totalScore: 250
            }
        };

        harness.controller.applyResolvedRun(levelCompleteRun);

        expect(harness.state.run?.status).toBe('levelComplete');
        expect(harness.state.view).toBe('playing');
        expect(harness.state.saveData.bestScore).toBe(250);
        expect(harness.state.newlyUnlockedAchievements).toEqual([]);
        expect(harness.state.dungeonExitPromptOpen).toBe(false);
        expect(harness.persistSaveData).toHaveBeenCalledWith(harness.state.saveData);
        expect(harness.persistSaveDataThenUnlockAchievements).not.toHaveBeenCalled();
        expect(gameSfxMocks.playFloorClearSfx).toHaveBeenCalledWith(0.5);
    });

    it('deactivates debug reveal through the gameplay core when a phase ends', () => {
        const baseRun = enableDebugPeek(
            createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' }),
            false
        );
        const harness = createHarness(baseRun);

        harness.controller.applyResolvedRun({ ...baseRun, status: 'levelComplete' });

        expect(harness.state.run).toMatchObject({
            debugPeekActive: false,
            timerState: { debugRevealRemainingMs: null },
            gameplayCommandJournal: [
                expect.objectContaining({ type: 'debug.reveal_deactivate', reason: 'phase_ended' })
            ],
            gameplayEventJournal: [
                expect.objectContaining({ type: 'debug.reveal_deactivated', reason: 'phase_ended' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'debug.reveal.phase_ended' })
            ]
        });
    });

    it('turns game-over runs into summaries, resets run surface state, and tracks completion', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        Object.assign(harness.state, {
            boardPinMode: true,
            destroyPairArmed: true,
            dungeonExitPromptOpen: true,
            peekModeArmed: true,
            shopReturnMode: 'floor' as const,
            tileSwapArmed: true,
            tileSwapFirstTileId: baseRun.board!.tiles[0]?.id ?? null
        });
        const gameOverRun: RunState = {
            ...baseRun,
            achievementsEnabled: false,
            lives: 0,
            status: 'gameOver',
            stats: {
                ...baseRun.stats,
                bestScore: 500,
                highestLevel: 3,
                totalScore: 500
            }
        };

        harness.controller.applyResolvedRun(gameOverRun);

        expect(harness.state.view).toBe('gameOver');
        expect(harness.state.run?.status).toBe('gameOver');
        expect(harness.state.run?.lastRunSummary).not.toBeNull();
        expect(harness.state.saveData.lastRunSummary).toEqual(harness.state.run?.lastRunSummary);
        expect(harness.state.run?.gameplayCommandJournal?.at(-1)).toMatchObject({
            type: 'run.finalize',
            unlockedAchievements: []
        });
        expect(harness.state.run?.gameplayEventJournal?.at(-1)).toMatchObject({
            type: 'run.finalized',
            totalScore: 500,
            highestLevel: 3,
            summaryValidated: true
        });
        expect(harness.state.run?.lastRunSummary?.gameplayCommandJournal).toEqual(
            harness.state.run?.gameplayCommandJournal
        );
        expect(harness.state.run?.lastRunSummary?.gameplayEventJournal).toEqual(
            harness.state.run?.gameplayEventJournal
        );
        expect(harness.state.saveData.bestScore).toBe(500);
        expect(harness.state.boardPinMode).toBe(false);
        expect(harness.state.destroyPairArmed).toBe(false);
        expect(harness.state.dungeonExitPromptOpen).toBe(false);
        expect(harness.state.peekModeArmed).toBe(false);
        expect(harness.state.shopReturnMode).toBeNull();
        expect(harness.state.tileSwapArmed).toBe(false);
        expect(harness.state.tileSwapFirstTileId).toBeNull();
        expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
            'run_complete',
            expect.objectContaining({ highestLevel: 3, totalScore: 500 })
        );
    });

    it('serializes evaluated terminal achievements into the finalization command and event', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);

        harness.controller.applyResolvedRun({
            ...baseRun,
            achievementsEnabled: true,
            lives: 0,
            status: 'gameOver',
            stats: {
                ...baseRun.stats,
                levelsCleared: 1
            }
        });

        expect(harness.state.run?.gameplayCommandJournal?.at(-1)).toMatchObject({
            type: 'run.finalize',
            unlockedAchievements: ['ACH_FIRST_CLEAR']
        });
        expect(harness.state.run?.gameplayEventJournal?.at(-1)).toMatchObject({
            type: 'run.finalized',
            unlockedAchievements: ['ACH_FIRST_CLEAR']
        });
        expect(harness.state.run?.lastRunSummary?.unlockedAchievements).toEqual(['ACH_FIRST_CLEAR']);
        expect(harness.state.saveData.lastRunSummary).toEqual(harness.state.run?.lastRunSummary);
    });

    it('normalizes malformed summary arrays before run completion telemetry', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const gameOverRun: RunState = {
            ...baseRun,
            achievementsEnabled: false,
            activeMutators: { length: 3 },
            relicIds: { length: 2 },
            lives: 0,
            status: 'gameOver',
            stats: {
                ...baseRun.stats,
                bestScore: 200,
                highestLevel: 2,
                totalScore: 200
            }
        } as unknown as RunState;

        harness.controller.applyResolvedRun(gameOverRun);

        expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
            'run_complete',
            expect.objectContaining({
                mutatorCount: 0,
                relicCount: 0
            })
        );
    });

    it('sets the achievement bridge notice when unlock persistence reports failures', async () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        harness.persistSaveDataThenUnlockAchievements.mockResolvedValueOnce({
            failures: [{ id: 'ACH_FIRST_CLEAR', result: { ok: false, reason: 'not_connected' } }]
        });
        const levelCompleteRun: RunState = {
            ...baseRun,
            achievementsEnabled: true,
            status: 'levelComplete',
            stats: {
                ...baseRun.stats,
                levelsCleared: 1
            }
        };

        harness.controller.applyResolvedRun(levelCompleteRun);
        await Promise.resolve();

        expect(harness.persistSaveData).not.toHaveBeenCalled();
        expect(harness.persistSaveDataThenUnlockAchievements).toHaveBeenCalledWith(
            expect.objectContaining({
                achievements: expect.objectContaining({ ACH_FIRST_CLEAR: true })
            }),
            ['ACH_FIRST_CLEAR']
        );
        expect(harness.state.newlyUnlockedAchievements).toEqual(['ACH_FIRST_CLEAR']);
        expect(harness.state.achievementBridgeNotice).toBe(
            'Some achievements could not sync with Steam. Your unlocks are saved in this build.'
        );
    });

    it('does not replay earlier achievement unlocks across rapid sequential resolutions', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const firstClearRun: RunState = {
            ...baseRun,
            achievementsEnabled: true,
            status: 'levelComplete',
            stats: {
                ...baseRun.stats,
                levelsCleared: 1
            }
        };

        harness.controller.applyResolvedRun(firstClearRun);
        expect(harness.state.newlyUnlockedAchievements).toEqual(['ACH_FIRST_CLEAR']);
        expect(harness.persistSaveDataThenUnlockAchievements).toHaveBeenLastCalledWith(
            expect.objectContaining({
                achievements: expect.objectContaining({
                    ACH_FIRST_CLEAR: true,
                    ACH_LEVEL_FIVE: false
                })
            }),
            ['ACH_FIRST_CLEAR']
        );

        const levelFiveRun: RunState = {
            ...firstClearRun,
            stats: {
                ...firstClearRun.stats,
                highestLevel: 5
            }
        };

        harness.controller.applyResolvedRun(levelFiveRun);

        expect(harness.state.newlyUnlockedAchievements).toEqual(['ACH_LEVEL_FIVE']);
        expect(harness.state.saveData.achievements).toMatchObject({
            ACH_FIRST_CLEAR: true,
            ACH_LEVEL_FIVE: true
        });
        expect(harness.state.saveData.unlocks).toEqual(['achievement:ACH_FIRST_CLEAR', 'achievement:ACH_LEVEL_FIVE']);
        expect(harness.persistSaveDataThenUnlockAchievements).toHaveBeenLastCalledWith(
            expect.objectContaining({
                achievements: expect.objectContaining({
                    ACH_FIRST_CLEAR: true,
                    ACH_LEVEL_FIVE: true
                }),
                unlocks: ['achievement:ACH_FIRST_CLEAR', 'achievement:ACH_LEVEL_FIVE']
            }),
            ['ACH_LEVEL_FIVE']
        );
    });

    it('repairs impossible primary exit locks before storing a resolved run', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const exitTile: Tile = {
            ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        };
        const lockedBoard = board([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), exitTile], {
            dungeonExitLockKind: 'iron',
            dungeonExitTileId: 'exit',
            matchedPairs: 1,
            pairCount: 1
        });

        harness.controller.applyResolvedRun({
            ...baseRun,
            board: lockedBoard,
            status: 'playing'
        });

        expect(harness.state.run?.board?.dungeonExitLockKind).toBe('none');
        expect(harness.state.run?.board?.tiles.find((candidate) => candidate.id === 'exit')?.dungeonExitLockKind).toBe(
            'none'
        );
        expect(harness.state.run?.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.progression_repair' })
        ]);
        expect(harness.state.run?.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'run.progression_repaired',
                repairKinds: expect.arrayContaining(['exit_lock', 'exit_metadata'])
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'safety.progression.repaired' })
        ]));
    });

    it('keeps primary exit locks when the run already carries the required key', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const exitTile: Tile = {
            ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        };
        const lockedBoard = board([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched'), exitTile], {
            dungeonExitLockKind: 'iron',
            dungeonExitTileId: 'exit',
            matchedPairs: 1,
            pairCount: 1
        });

        harness.controller.applyResolvedRun({
            ...baseRun,
            board: lockedBoard,
            dungeonKeys: { iron: 1 },
            status: 'playing'
        });

        expect(harness.state.run?.board?.dungeonExitLockKind).toBe('iron');
        expect(harness.state.run?.board?.tiles.find((candidate) => candidate.id === 'exit')?.dungeonExitLockKind).toBe(
            'iron'
        );
    });

    it('defeats stale boss hazards before storing a resolved run', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        const clearedBossBoard = board([tile('a1', 'a', 'matched'), tile('a2', 'a', 'matched')], {
            dungeonBossId: 'trap_warden',
            dungeonObjectiveId: 'defeat_boss',
            enemyHazards: [
                {
                    bossId: 'trap_warden',
                    currentTileId: 'a1',
                    damage: 1,
                    hp: 1,
                    id: 'stale-warden',
                    kind: 'warden',
                    label: 'Stale Warden',
                    maxHp: 1,
                    nextTileId: 'a2',
                    pattern: 'guard',
                    state: 'revealed'
                }
            ],
            floorTag: 'boss',
            matchedPairs: 1,
            pairCount: 1
        });

        harness.controller.applyResolvedRun({
            ...baseRun,
            board: clearedBossBoard,
            dungeonEnemiesDefeated: 0,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 0,
            status: 'playing'
        });

        expect(harness.state.run?.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(harness.state.run?.dungeonEnemiesDefeated).toBe(1);
        expect(harness.state.run?.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(harness.state.run?.enemyHazardsDefeatedThisFloor).toBe(1);
        expect(harness.state.run?.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.progression_repair' })
        ]);
        expect(harness.state.run?.gameplayEventJournal).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: 'run.progression_repaired',
                repairKinds: ['enemy_hazard'],
                enemyHazardIdsDefeated: ['stale-warden']
            }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'safety.progression.repaired' })
        ]));
    });

    it('plays a payoff cue from the match pop payload when a board resolve creates match feedback', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const matchBoard = board([
            {
                ...tile('a1', 'a', 'flipped'),
                findableKind: 'score_glint',
                routeCardKind: 'greed_cache',
                tileTraitKind: 'echo'
            },
            tile('b1', 'b'),
            {
                ...tile('a2', 'a', 'flipped'),
                findableKind: 'score_glint',
                routeCardKind: 'greed_cache',
                tileTraitKind: 'echo'
            },
            { ...tile('b2', 'b'), tileTraitKind: 'sealed' }
        ], { flippedTileIds: ['a1', 'a2'] });
        const run: RunState = {
            ...baseRun,
            status: 'resolving',
            board: matchBoard,
            findablesClaimedThisFloor: 0,
            findablesTotalThisFloor: 1,
            stats: {
                ...baseRun.stats,
                currentStreak: 2,
                matchesFound: 2,
                tries: 2
            }
        };
        const harness = createHarness(run);

        harness.controller.applyResolveBoardTurn(run);

        expect(harness.state.matchScorePop).not.toBeNull();
        expect(harness.state.matchScorePop).toMatchObject({
            pickupRewardText: expect.any(String),
            routeRewardText: expect.any(String),
            traitInteractionTexts: ['Echo + Sealed: combo shard'],
            key: expect.stringContaining('board-turn:')
        });
        expect(harness.state.run?.gameplayEventJournal).toContainEqual(expect.objectContaining({
            type: 'board.turn_resolved',
            matchedFindableKind: 'score_glint',
            matchedRouteKind: 'greed_cache',
            traitInteractionTags: ['echo:sealed-combo'],
            floaterTileIds: ['a1', 'a2']
        }));
        expect(harness.state.run?.gameplayCommandJournal).toContainEqual(expect.objectContaining({
            type: 'board.turn_resolve'
        }));
        expect(gameSfxMocks.playResolveSfx).toHaveBeenCalledWith(run, expect.any(Object), 0.5);
        expect(gameSfxMocks.playMatchPayoffSfx).toHaveBeenCalledWith(0.5, harness.state.matchScorePop);
    });

    it('does not play a payoff cue for mismatch-only board resolves', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const mismatchBoard = board([tile('a1', 'a', 'flipped'), tile('b1', 'b', 'flipped')], {
            flippedTileIds: ['a1', 'b1']
        });
        const run: RunState = {
            ...baseRun,
            status: 'resolving',
            board: mismatchBoard,
            stats: {
                ...baseRun.stats,
                currentStreak: 3,
                matchesFound: 3,
                tries: 3
            }
        };
        const harness = createHarness(run);

        harness.controller.applyResolveBoardTurn(run);

        expect(harness.state.mismatchScorePop).not.toBeNull();
        expect(gameSfxMocks.playResolveSfx).toHaveBeenCalledWith(run, expect.any(Object), 0.5);
        expect(gameSfxMocks.playMatchPayoffSfx).not.toHaveBeenCalled();
    });

    it('applies immediate game-over reset after resolved-run processing', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        Object.assign(harness.state, {
            boardPinMode: true,
            dungeonExitPromptOpen: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: baseRun.board!.tiles[0]?.id ?? null
        });

        harness.controller.applyImmediateGameOverFromTilePress({
            ...baseRun,
            achievementsEnabled: false,
            lives: 0,
            status: 'gameOver'
        });

        expect(harness.state.view).toBe('gameOver');
        expect(harness.state.boardPinMode).toBe(false);
        expect(harness.state.dungeonExitPromptOpen).toBe(false);
        expect(harness.state.peekModeArmed).toBe(false);
        expect(harness.state.tileSwapArmed).toBe(false);
        expect(harness.state.tileSwapFirstTileId).toBeNull();
        expect(harness.patches.at(-1)).toEqual(runSurfaceReset);
    });
});
