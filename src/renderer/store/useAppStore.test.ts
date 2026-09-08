import { DEFAULT_CLASSIC_RUN_SETUP } from '../../shared/classic-run-setup';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import { buildBoard, countFindablePairs } from '../../shared/board-generation';
import { createNewRun, createRunSummary } from '../../shared/game-core';
import { createPlayablePathFixture, type PlayablePathFixtureId } from '../../shared/playable-path-fixtures';
import { createDefaultSaveData } from '../../shared/save-data';
import { calculateTileTraitMismatchPenalty } from '../../shared/tile-trait-rules';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';
import { useAppStore } from './useAppStore';

const gameSfxMocks = vi.hoisted(() => ({
    playDestroyPairSfx: vi.fn(),
    playFlipSfx: vi.fn(),
    playFloorClearSfx: vi.fn(),
    playGambitCommitSfx: vi.fn(),
    playMatchPayoffSfx: vi.fn(),
    playPeekPowerSfx: vi.fn(),
    playPowerArmSfx: vi.fn(),
    playRelicPickSfx: vi.fn(),
    playResolveSfx: vi.fn(),
    playStrayPowerSfx: vi.fn(),
    playWagerArmSfx: vi.fn(),
    resumeAudioContext: vi.fn(),
    sfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

const uiSfxMocks = vi.hoisted(() => ({
    playPauseOpenSfx: vi.fn(),
    playPauseResumeSfx: vi.fn(),
    playRunStartSfx: vi.fn(),
    playUiConfirmSfx: vi.fn(),
    resumeUiSfxContext: vi.fn()
}));

vi.mock('../audio/gameSfx', () => gameSfxMocks);
vi.mock('../audio/uiSfx', () => uiSfxMocks);

const resetStore = (): void => {
    const saveData = createDefaultSaveData();

    useAppStore.setState({
        hydrated: true,
        hydrating: false,
        steamConnected: false,
        view: 'menu',
        settingsReturnView: 'menu',
        subscreenReturnView: 'menu',
        saveData,
        settings: saveData.settings,
        run: null,
        runStartSaveData: null,
        newlyUnlockedAchievements: [],
        achievementBridgeNotice: null,
        persistenceWriteNotice: null,
        saveReadFailureNotice: null,
        saveWritesBlockedByReadFailure: false,
        boardPinMode: false,
        destroyPairArmed: false,
        peekModeArmed: false,
        strayRemoveArmed: false,
        tileSwapArmed: false,
        tileSwapFirstTileId: null,
        ...BOARD_FLOATER_POP_CLEAR
    });
};

const currentBoardReadyKey = (): string => {
    const board = useAppStore.getState().run?.board;
    if (!board) {
        throw new Error('Expected an active board');
    }
    return `${board.level}|${board.columns}x${board.rows}|${[...board.tiles]
        .map((tile) => tile.id)
        .sort()
        .join('|')}`;
};

const notifyCurrentBoardReady = (): void => {
    useAppStore.getState().notifyMemorizeBoardReady(currentBoardReadyKey());
};

const normalPairGroups = (board: BoardState): Tile[][] => {
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (
            tile.dungeonCardKind != null ||
            tile.routeSpecialKind != null ||
            tile.routeCardKind != null ||
            tile.pairKey === '__decoy__' ||
            tile.pairKey === '__wild__' ||
            tile.pairKey === '__exit__' ||
            tile.pairKey === '__shop__' ||
            tile.pairKey === '__room__'
        ) {
            continue;
        }
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }
    return [...groups.values()].filter((group) => group.length === 2);
};

const installPlayablePathFixture = (id: PlayablePathFixtureId): void => {
    const fixture = createPlayablePathFixture(id);

    useAppStore.setState({
        run: fixture.run,
        saveData: fixture.saveData,
        settings: fixture.saveData.settings,
        view: fixture.view
    });
};

const visibleProgressionSignature = (): string => {
    const { run, view } = useAppStore.getState();
    return [
        view,
        run?.status ?? 'no-run',
        run?.board?.level ?? 'no-board',
        run?.sideRoom?.id ?? 'no-side-room',
        run?.relicOffer?.picksRemaining ?? 'no-relic-picks',
        run?.relicOffer?.options.join(',') ?? 'no-relic-options',
        run?.relicIds.join(',') ?? 'no-relics',
        run?.pendingRouteCardPlan?.routeType ?? 'no-route-plan',
        run?.lastLevelResult?.routeChoices?.map((choice) => choice.id).join(',') ?? 'no-route-choices'
    ].join('|');
};

const driveOneVisibleProgressionStep = (): boolean => {
    const { run, view } = useAppStore.getState();
    if (!run) {
        return false;
    }

    if (view !== 'playing' || run.status !== 'levelComplete') {
        return false;
    }

    useAppStore.getState().continueToNextLevel();
    return true;
};

describe('useAppStore timers', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useFakeTimers();
        resetStore();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it.each([
        'floorClearWithRouteChoices'
    ] satisfies PlayablePathFixtureId[])(
        'drives the %s playable interlude fixture to the next playable state',
        (fixtureId) => {
            installPlayablePathFixture(fixtureId);

            for (let step = 0; step < 6; step += 1) {
                const { run, view } = useAppStore.getState();
                if (
                    view === 'playing' &&
                    run?.status !== 'levelComplete' &&
                    !run?.sideRoom &&
                    !run?.relicOffer
                ) {
                    break;
                }

                const before = visibleProgressionSignature();
                expect(driveOneVisibleProgressionStep()).toBe(true);
                expect(visibleProgressionSignature()).not.toBe(before);
            }

            const { run, view } = useAppStore.getState();
            expect(view).toBe('playing');
            expect(run?.status).not.toBe('levelComplete');
            expect(run?.sideRoom).toBeNull();
            expect(run?.relicOffer).toBeNull();
        }
    );

    it('starts the memorize countdown only after the current board reports ready', async () => {
        useAppStore.getState().startRun();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1000);
        expect(useAppStore.getState().run?.status).toBe('memorize');

        useAppStore.getState().notifyMemorizeBoardReady('stale-board');
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1000);
        expect(useAppStore.getState().run?.status).toBe('memorize');

        notifyCurrentBoardReady();
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');
    });

    it('ends the study period when the player says so, and stops the clock ending it twice', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        expect(useAppStore.getState().run?.status).toBe('memorize');

        useAppStore.getState().skipMemorizePhase();

        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.timerState.memorizeRemainingMs).toBeNull();

        // The countdown that was running has to be cancelled, not merely outrun: firing it into
        // a phase that is already over is how a skipped study period would undo itself.
        const flipHistoryAfterSkip = useAppStore.getState().run?.flipHistory;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.flipHistory).toEqual(flipHistoryAfterSkip);
    });

    it('ignores a skip when there is no study period to end', () => {
        useAppStore.getState().skipMemorizePhase();

        expect(useAppStore.getState().run).toBeNull();
    });

    it('GLD-P0-006: hydrate read failure is visible and blocks default-profile autosave', async () => {
        window.localStorage.setItem('memory-dungeon-save-data', '{not-valid-json');
        useAppStore.setState({
            hydrated: false,
            hydrating: false,
            saveReadFailureNotice: null,
            saveWritesBlockedByReadFailure: false
        });

        await useAppStore.getState().hydrate();

        expect(useAppStore.getState().hydrated).toBe(true);
        expect(useAppStore.getState().saveReadFailureNotice).toContain('Save read failed');
        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(true);
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe('{not-valid-json');

        await useAppStore.getState().dismissHowToPlay();

        expect(useAppStore.getState().saveData.firstRunHelpDismissed).toBe(true);
        expect(useAppStore.getState().saveData.onboardingDismissed).toBe(false);
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe('{not-valid-json');
    });

    it('treats valid JSON with a non-object save root as a protected read failure', async () => {
        window.localStorage.setItem('memory-dungeon-save-data', '["corrupt"]');
        useAppStore.setState({ hydrated: false, hydrating: false });

        await useAppStore.getState().hydrate();

        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(true);
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe('["corrupt"]');
    });

    it('protects an unrecognizable object-shaped browser save from autosave', async () => {
        window.localStorage.setItem('memory-dungeon-save-data', '{"undocumentedSave":true}');
        useAppStore.setState({ hydrated: false, hydrating: false });

        await useAppStore.getState().hydrate();

        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(true);
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe('{"undocumentedSave":true}');
    });

    it('protects a browser save from a newer schema instead of downgrading it', async () => {
        const defaultSave = createDefaultSaveData();
        const futureSave = JSON.stringify({ ...defaultSave, schemaVersion: defaultSave.schemaVersion + 1 });
        window.localStorage.setItem('memory-dungeon-save-data', futureSave);
        useAppStore.setState({ hydrated: false, hydrating: false });

        await useAppStore.getState().hydrate();

        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(true);
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe(futureSave);
    });


    it('freezes a pending board resolution while settings are open', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const run = useAppStore.getState().run;
        expect(run?.status).toBe('playing');

        const board = run?.board;
        expect(board).not.toBeNull();

        const pairGroups = normalPairGroups(board!);
        const firstTile = pairGroups[0]?.[0];
        const mismatchTile = pairGroups[1]?.[0];

        expect(firstTile).toBeDefined();
        expect(mismatchTile).toBeDefined();

        const expectedTriesAfterResolve =
            1 + calculateTileTraitMismatchPenalty(run!, [firstTile!, mismatchTile!], board!).triesDelta;

        useAppStore.getState().pressTile(firstTile!.id);
        useAppStore.getState().pressTile(mismatchTile!.id);

        expect(useAppStore.getState().run?.status).toBe('resolving');

        useAppStore.getState().openSettings('playing');
        expect(useAppStore.getState().view).toBe('settings');
        expect(useAppStore.getState().run?.status).toBe('paused');

        await vi.advanceTimersByTimeAsync(1200);

        expect(useAppStore.getState().run?.stats.tries).toBe(0);
        expect(useAppStore.getState().run?.lives).toBe(4);

        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('resolving');

        await vi.advanceTimersByTimeAsync(1400);

        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.stats.tries).toBe(expectedTriesAfterResolve);
        expect(useAppStore.getState().run?.lives).toBe(4);
    });


    it('does not set matchScorePop on mismatch resolve; mismatches increment and mismatchScorePop payload is stored', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const board = useAppStore.getState().run?.board;
        expect(board).not.toBeNull();

        const pairGroups = normalPairGroups(board!);
        const firstTile = pairGroups[0]?.[0];
        const mismatchTile = pairGroups[1]?.[0];

        expect(firstTile).toBeDefined();
        expect(mismatchTile).toBeDefined();

        useAppStore.getState().pressTile(firstTile!.id);
        useAppStore.getState().pressTile(mismatchTile!.id);

        expect(useAppStore.getState().run?.status).toBe('resolving');

        await vi.advanceTimersByTimeAsync(1400);

        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.stats.mismatches).toBe(1);
        expect(useAppStore.getState().matchScorePop).toBeNull();
        expect(useAppStore.getState().mismatchScorePop).not.toBeNull();
        expect(useAppStore.getState().mismatchScorePop?.tileIdA).toBe(firstTile!.id);
        expect(useAppStore.getState().mismatchScorePop?.tileIdB).toBe(mismatchTile!.id);
    });

    it('gambit triple-no-match sets mismatchScorePop with tileIdC in flip order', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const runAfterMem = useAppStore.getState().run!;
        const threePairBoard = buildBoard(2, {
            runSeed: runAfterMem.runSeed,
            runRulesVersion: runAfterMem.runRulesVersion,
            activeMutators: runAfterMem.activeMutators
        });
        useAppStore.setState({
            run: {
                ...runAfterMem,
                board: threePairBoard,
                findablesTotalThisFloor: countFindablePairs(threePairBoard.tiles)
            }
        });

        const board = useAppStore.getState().run?.board;
        expect(board).not.toBeNull();

        const hidden = board!.tiles.filter((tile) => tile.state === 'hidden');
        const first = hidden[0]!;
        const second = hidden.find((tile) => tile.pairKey !== first.pairKey)!;
        const third = hidden.find(
            (tile) => tile.pairKey !== first.pairKey && tile.pairKey !== second.pairKey
        )!;

        expect(third).toBeDefined();

        useAppStore.getState().pressTile(first.id);
        useAppStore.getState().pressTile(second.id);

        expect(useAppStore.getState().run?.status).toBe('resolving');

        useAppStore.getState().pressTile(third.id);
        expect(useAppStore.getState().run?.board?.flippedTileIds).toEqual([first.id, second.id, third.id]);

        await vi.advanceTimersByTimeAsync(2500);

        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().matchScorePop).toBeNull();

        const miss = useAppStore.getState().mismatchScorePop;
        expect(miss?.tileIdA).toBe(first.id);
        expect(miss?.tileIdB).toBe(second.id);
        expect(miss?.tileIdC).toBe(third.id);
    });

    it('resolves matches immediately so the next pair can be started right away', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const run = useAppStore.getState().run;
        expect(run?.status).toBe('playing');

        const board = run?.board;
        expect(board).not.toBeNull();

        const pairGroups = normalPairGroups(board!);
        const firstTile = pairGroups[0]?.[0];
        const matchingTile = pairGroups[0]?.[1];
        const nextPairTile = pairGroups[1]?.[0];

        expect(firstTile).toBeDefined();
        expect(matchingTile).toBeDefined();
        expect(nextPairTile).toBeDefined();

        useAppStore.getState().pressTile(firstTile!.id);
        useAppStore.getState().pressTile(matchingTile!.id);

        const matchedRun = useAppStore.getState().run;
        expect(matchedRun?.board).not.toBeNull();
        const matchedBoard = matchedRun?.board;

        if (!matchedBoard) {
            throw new Error('Expected board to exist after immediate match resolution.');
        }

        // The match itself resolves in the same press, which is what this test is about.
        expect(matchedBoard.flippedTileIds).toHaveLength(0);
        expect(matchedBoard.tiles.find((tile) => tile.id === firstTile!.id)?.state).toBe('matched');
        expect(matchedBoard.tiles.find((tile) => tile.id === matchingTile!.id)?.state).toBe('matched');

        /*
         * Floor one is two pairs of one suit, so the match's pop can take the other pair and end
         * the floor there and then. Either way the turn resolved without waiting: if the floor is
         * still open the next tile flips on the next press, and if it is not, nothing is left to
         * flip because the break took it.
         */
        if (matchedRun?.status === 'playing') {
            useAppStore.getState().pressTile(nextPairTile!.id);
            const runAfterNextPress = useAppStore.getState().run;
            expect(runAfterNextPress?.board).not.toBeNull();
            expect(runAfterNextPress?.board?.flippedTileIds).toContain(nextPairTile!.id);
        } else {
            expect(matchedRun?.status).toBe('levelComplete');
            expect(matchedBoard.tiles.filter((tile) => tile.state === 'hidden' && tile.pairKey === nextPairTile!.pairKey)).toEqual([]);
        }
    });




    it('SIDE-013: inventory overlay and run settings modal use the same frozen run snapshot after memorize', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();
        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');

        useAppStore.getState().openInventoryFromPlaying();
        const frozenForInventory = useAppStore.getState().run;
        expect(useAppStore.getState().view).toBe('inventory');
        expect(frozenForInventory?.status).toBe('paused');
        expect(frozenForInventory?.timerState.pausedFromStatus).toBe('playing');
        expect(frozenForInventory?.gameplayCommandJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.pause' })])
        );

        useAppStore.getState().closeSubscreen();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.gameplayCommandJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.resume' })])
        );

        useAppStore.getState().openSettings('playing');
        const frozenForSettings = useAppStore.getState().run;
        expect(useAppStore.getState().view).toBe('settings');
        expect(frozenForSettings?.status).toBe('paused');
        expect(frozenForSettings?.timerState.pausedFromStatus).toBe('playing');
        expect(frozenForSettings?.timerState).toEqual(frozenForInventory?.timerState);
        expect(frozenForSettings?.gameplayCommandJournal?.filter((command) => command.type === 'run.pause')).toHaveLength(2);
    });

    it('SIDE-014: closing in-run inventory when run was cleared routes to menu instead of a blank playing shell', () => {
        useAppStore.getState().startRun();
        useAppStore.getState().openInventoryFromPlaying();
        expect(useAppStore.getState().view).toBe('inventory');
        useAppStore.setState({ run: null });
        useAppStore.getState().closeSubscreen();
        expect(useAppStore.getState().view).toBe('menu');
        expect(useAppStore.getState().run).toBeNull();
        expect(useAppStore.getState().subscreenReturnView).toBe('menu');
    });

    it('SIDE-014: closing run settings when run was cleared routes to menu', () => {
        useAppStore.getState().startRun();
        useAppStore.getState().openSettings('playing');
        expect(useAppStore.getState().view).toBe('settings');
        useAppStore.setState({ run: null });
        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('menu');
        expect(useAppStore.getState().run).toBeNull();
        expect(useAppStore.getState().settingsReturnView).toBe('menu');
    });



























    it('lets death win over puzzle and relic early returns when continuing a completed floor', () => {
        const makeDeadCompleteRun = (overrides: Partial<RunState> = {}): RunState => {
            const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_359 });
            return {
                ...baseRun,
                status: 'levelComplete',
                lives: 0,
                shopOffers: [],
                lastLevelResult: {
                    level: 1,
                    scoreGained: 100,
                    rating: 'B',
                    livesRemaining: 0,
                    perfect: false,
                    mistakes: 1,
                    clearLifeReason: 'none',
                    clearLifeGained: 0
                },
                ...overrides
            };
        };

        for (const run of [
            makeDeadCompleteRun({
                relicOffer: {
                    tier: 1,
                    options: ['extra_shuffle_charge'],
                    picksRemaining: 1,
                    pickRound: 0
                }
            })
        ]) {
            resetStore();
            useAppStore.setState({ view: 'playing', run });

            useAppStore.getState().continueToNextLevel();

            expect(useAppStore.getState().view).toBe('gameOver');
            expect(useAppStore.getState().run?.status).toBe('gameOver');
            expect(useAppStore.getState().run?.lives).toBe(0);
            expect(useAppStore.getState().run?.relicOffer).toBeNull();
            expect(useAppStore.getState().run?.shopOffers).toEqual([]);
            expect(useAppStore.getState().run?.lastRunSummary).not.toBeNull();
        }
    });

    it('GLD-P0-003: continueToNextLevel ignores non-complete runs', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 30_003 });
        const statuses: RunState['status'][] = ['memorize', 'playing', 'resolving', 'paused', 'gameOver'];

        for (const status of statuses) {
            const run: RunState = { ...base, status };
            useAppStore.setState({ view: 'playing', run });

            useAppStore.getState().continueToNextLevel();

            expect(useAppStore.getState().view).toBe('playing');
            expect(useAppStore.getState().run).toBe(run);
        }
    });





    it('REG-044: menu meta screens can open settings and return to the intended surface', () => {
        useAppStore.getState().openModeSelect();
        expect(useAppStore.getState().view).toBe('modeSelect');

        useAppStore.getState().openSettings('modeSelect');
        expect(useAppStore.getState().view).toBe('settings');
        expect(useAppStore.getState().settingsReturnView).toBe('modeSelect');

        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('modeSelect');
        expect(useAppStore.getState().run).toBeNull();

        useAppStore.getState().openCollection();
        useAppStore.getState().openSettings('collection');
        expect(useAppStore.getState().settingsReturnView).toBe('collection');

        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('collection');

        useAppStore.getState().goToMenu();
        useAppStore.getState().openProfile();
        expect(useAppStore.getState().view).toBe('profile');
        useAppStore.getState().openSettings('profile');
        expect(useAppStore.getState().settingsReturnView).toBe('profile');
        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('profile');
    });

    it('REG-044: impossible nested settings return targets normalize to menu', () => {
        const invalidSettingsReturn = 'settings' as unknown as Parameters<typeof useAppStore.getState>['length'];
        useAppStore.getState().openSettings(invalidSettingsReturn as never);
        expect(useAppStore.getState().settingsReturnView).toBe('menu');
        useAppStore.getState().closeSettings();
        expect(useAppStore.getState().view).toBe('menu');
    });

    it('plays pause and resume cues from store transitions', async () => {
        useAppStore.getState().startRun();
        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        useAppStore.getState().pause();
        expect(uiSfxMocks.resumeUiSfxContext).toHaveBeenCalled();
        expect(uiSfxMocks.playPauseOpenSfx).toHaveBeenCalledTimes(1);
        expect(useAppStore.getState().run?.gameplayCommandJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.pause' })])
        );
        expect(useAppStore.getState().run?.gameplayEventJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.paused' })])
        );

        useAppStore.getState().resume();
        expect(uiSfxMocks.playPauseResumeSfx).toHaveBeenCalledTimes(1);
        expect(useAppStore.getState().run?.gameplayCommandJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.resume' })])
        );
        expect(useAppStore.getState().run?.gameplayEventJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.resumed' })])
        );
    });

    it('serializes the elapsed memorize timer before manual pause clears browser timers', async () => {
        useAppStore.getState().startRun();
        notifyCurrentBoardReady();
        const initialRemainingMs = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;

        await vi.advanceTimersByTimeAsync(350);
        useAppStore.getState().pause();

        const paused = useAppStore.getState().run!;
        expect(paused.status).toBe('paused');
        expect(paused.timerState.memorizeRemainingMs).toBe(Math.max(0, initialRemainingMs - 350));
        expect(paused.gameplayCommandJournal?.at(-1)).toMatchObject({
            type: 'run.pause',
            timerSnapshot: { memorizeRemainingMs: Math.max(0, initialRemainingMs - 350) }
        });
    });

    it('does not play pause or resume cues for no-op transitions', () => {
        const levelComplete = { ...createNewRun(0), status: 'levelComplete' as const };
        useAppStore.setState({ view: 'playing', run: levelComplete });

        useAppStore.getState().pause();
        expect(useAppStore.getState().run).toBe(levelComplete);
        expect(uiSfxMocks.playPauseOpenSfx).not.toHaveBeenCalled();

        useAppStore.getState().resume();
        expect(useAppStore.getState().run).toBe(levelComplete);
        expect(uiSfxMocks.playPauseResumeSfx).not.toHaveBeenCalled();
    });

    it('turns a paused zero-health run into game over instead of resuming play', () => {
        const pausedDead: RunState = {
            ...createNewRun(0),
            status: 'paused',
            lives: 0,
            timerState: {
                ...createNewRun(0).timerState,
                pausedFromStatus: 'playing'
            }
        };
        useAppStore.setState({ view: 'playing', run: pausedDead });

        useAppStore.getState().resume();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().run?.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.resume' })
        ]);
        expect(useAppStore.getState().run?.gameplayEventJournal).toEqual(
            expect.arrayContaining([expect.objectContaining({ type: 'run.resumed', outcome: 'game_over' })])
        );
        expect(uiSfxMocks.playPauseResumeSfx).not.toHaveBeenCalled();
    });

    it('turns an impossible paused resolving snapshot into game over without a resume cue', () => {
        const run = createNewRun(0);
        const pausedResolvingWithoutBoard: RunState = {
            ...run,
            status: 'paused',
            board: null,
            timerState: {
                ...run.timerState,
                resolveRemainingMs: 250,
                pausedFromStatus: 'resolving'
            }
        };
        useAppStore.setState({ view: 'playing', run: pausedResolvingWithoutBoard });

        useAppStore.getState().resume();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(uiSfxMocks.playPauseResumeSfx).not.toHaveBeenCalled();
    });

    it('routes dead paused in-run overlay snapshots to game over instead of a blank playing shell', () => {
        const makePausedDead = (): RunState => {
            const run = createNewRun(0);
            return {
                ...run,
                status: 'paused',
                lives: 0,
                timerState: {
                    ...run.timerState,
                    pausedFromStatus: 'playing'
                }
            };
        };

        useAppStore.setState({
            view: 'settings',
            settingsReturnView: 'playing',
            run: makePausedDead()
        });
        useAppStore.getState().closeSettings();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().settingsReturnView).toBe('menu');

        resetStore();
        useAppStore.setState({
            view: 'inventory',
            subscreenReturnView: 'playing',
            run: makePausedDead()
        });
        useAppStore.getState().closeSubscreen();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().subscreenReturnView).toBe('menu');

    });

    it('does not arm board action modes outside an actionable playing run', () => {
        useAppStore.getState().toggleBoardPinMode();
        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);

        const paused = { ...createNewRun(0), status: 'paused' as const };
        useAppStore.setState({ view: 'playing', run: paused });

        useAppStore.getState().toggleBoardPinMode();
        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(gameSfxMocks.playPowerArmSfx).not.toHaveBeenCalled();
    });








    it('clears stale in-run armed modes when leaving or replacing a run', () => {
        useAppStore.setState({
            view: 'playing',
            run: createNewRun(0),
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });

        useAppStore.getState().goToMenu();

        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().startRun();

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().restartRun();

        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().startRun({ ...DEFAULT_CLASSIC_RUN_SETUP, chaos: true });

        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();
    });

    it('only arms destroy mode when a valid destroy target and charge exist', () => {
        const playing = {
            ...createNewRun(0),
            status: 'playing' as const,
            destroyPairCharges: 0
        };
        useAppStore.setState({ view: 'playing', run: playing });

        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().destroyPairArmed).toBe(false);

        useAppStore.setState({
            run: {
                ...playing,
                destroyPairCharges: 1,
                activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null }
            }
        });
        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().destroyPairArmed).toBe(false);

        useAppStore.setState({ run: { ...playing, destroyPairCharges: 1 } });
        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().destroyPairArmed).toBe(true);
        expect(gameSfxMocks.playPowerArmSfx).toHaveBeenCalledTimes(1);

        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
    });




    it('REG-088: first classic run can clear, continue, end locally, and persist first-win progress', async () => {
        useAppStore.getState().startRun();
        expect(useAppStore.getState().view).toBe('playing');
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');

        for (let floor = 1; floor <= 2; floor += 1) {
            let run = useAppStore.getState().run;
            expect(run?.board?.level).toBe(floor);

            const pairGroups = new Map<string, string[]>();
            for (const tile of run!.board!.tiles) {
                if (
                    tile.pairKey === '__decoy__' ||
                    tile.pairKey === '__wild__' ||
                    tile.pairKey === '__exit__' ||
                    tile.pairKey === '__shop__'
                ) {
                    continue;
                }
                const ids = pairGroups.get(tile.pairKey) ?? [];
                ids.push(tile.id);
                pairGroups.set(tile.pairKey, ids);
            }

            for (const ids of [...pairGroups.values()].filter((group) => group.length === 2)) {
                useAppStore.getState().pressTile(ids[0]!);
                useAppStore.getState().pressTile(ids[1]!);
                await vi.advanceTimersByTimeAsync(1400);
            }

            run = useAppStore.getState().run;
            expect(run?.status).toBe('levelComplete');
            expect(run?.lastLevelResult?.perfect).toBe(true);

            if (floor === 1) {
                expect(useAppStore.getState().saveData.onboardingDismissed).toBe(true);
                useAppStore.getState().continueToNextLevel();
                notifyCurrentBoardReady();
                const nextMemorizeMs = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
                await vi.advanceTimersByTimeAsync(nextMemorizeMs + 1);
                expect(useAppStore.getState().run?.status).toBe('playing');
            }
        }

        const state = useAppStore.getState();
        expect(state.view).toBe('playing');
        expect(state.run?.status).toBe('levelComplete');
        expect(state.saveData.bestScore).toBeGreaterThan(0);
        expect(state.saveData.achievements.ACH_FIRST_CLEAR).toBe(true);
        expect(state.newlyUnlockedAchievements).toEqual([]);
        expect(state.run?.stats.highestLevel).toBe(2);
        expect(state.run?.stats.levelsCleared).toBe(2);
        expect(state.run?.achievementsEnabled).toBe(true);

        useAppStore.getState().endRun();
        expect(useAppStore.getState().view).toBe('menu');
        expect(useAppStore.getState().run).toBeNull();
    });
});

describe('useAppStore scholar contract', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useFakeTimers();
        resetStore();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });


    it('scholar contract blocks destroy arming even with banked charges', async () => {
        useAppStore.getState().startRun({ ...DEFAULT_CLASSIC_RUN_SETUP, vows: ['scholar'] });
        notifyCurrentBoardReady();
        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const playing = useAppStore.getState().run!;
        useAppStore.setState({
            run: { ...playing, destroyPairCharges: 1 }
        });
        useAppStore.getState().toggleDestroyPairArmed();
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().run?.destroyPairCharges).toBe(1);
    });

});

describe('useAppStore restartRun menu modes', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.useFakeTimers();
        resetStore();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });


    it('restartRun keeps the guided safe first floor until onboarding is completed', () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1.1 / 0x7fffffff);
        try {
            useAppStore.setState({
                saveData: {
                    ...useAppStore.getState().saveData,
                    onboardingDismissed: false
                }
            });
            useAppStore.getState().startRun();
            const started = useAppStore.getState().run;

            useAppStore.setState({
                run: createRunSummary({ ...started!, status: 'gameOver', lives: 0 }, []),
                view: 'gameOver'
            });

            useAppStore.getState().restartRun();

            const next = useAppStore.getState().run;
            expect(next?.gameMode).toBe('endless');
            expect(next?.activeMutators).toEqual([]);
            expect(next?.board?.tiles.some((tile) => tile.dungeonCardKind != null || tile.routeSpecialKind != null)).toBe(
                false
            );
            expect(next?.findablesTotalThisFloor).toBe(0);
        } finally {
            randomSpy.mockRestore();
        }
    });


    it('restartRun after Pin vow keeps maxPinsTotalRun contract', async () => {
        useAppStore.getState().startRun({ ...DEFAULT_CLASSIC_RUN_SETUP, vows: ['pin_vow'] });
        notifyCurrentBoardReady();
        const started = useAppStore.getState().run;
        expect(started?.activeContract).toEqual({
            noShuffle: false,
            noDestroy: false,
            maxMismatches: null,
            maxPinsTotalRun: 10
        });

        const memorizeDuration = started?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');

        useAppStore.getState().restartRun();

        expect(useAppStore.getState().run?.activeContract).toEqual({
            noShuffle: false,
            noDestroy: false,
            maxMismatches: null,
            maxPinsTotalRun: 10
        });
    });
});
