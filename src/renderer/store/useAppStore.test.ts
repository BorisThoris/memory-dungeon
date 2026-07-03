import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardState, RunState, SaveData, Tile } from '../../shared/contracts';
import { buildBoard, countFindablePairs } from '../../shared/board-generation';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from '../../shared/dungeon-rules';
import { createDailyRun, createNewRun, createPuzzleRun, createRunSummary } from '../../shared/game-core';
import { createPlayablePathFixture, type PlayablePathFixtureId } from '../../shared/playable-path-fixtures';
import { generateRouteChoices } from '../../shared/route-rules';
import { rollRunEventRoom } from '../../shared/run-events';
import { createDungeonRunMapState, revealDungeonChoices } from '../../shared/run-map';
import { createRunShopOffers } from '../../shared/shop-rules';
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
    playTrapSfx: vi.fn(),
    playWagerArmSfx: vi.fn(),
    resumeAudioContext: vi.fn(),
    sfxGainFromSettings: (masterVolume: number, sfxVolume: number) =>
        Math.max(0, Math.min(1, masterVolume)) * Math.max(0, Math.min(1, sfxVolume))
}));

const uiSfxMocks = vi.hoisted(() => ({
    playPauseOpenSfx: vi.fn(),
    playPauseResumeSfx: vi.fn(),
    playRunStartSfx: vi.fn(),
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
        dungeonExitPromptOpen: false,
        shopReturnMode: null,
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
        shopReturnMode: fixture.shopReturnMode ?? null,
        view: fixture.view
    });
};

const visibleProgressionSignature = (): string => {
    const { run, shopReturnMode, view } = useAppStore.getState();
    return [
        view,
        shopReturnMode ?? 'no-shop-return',
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
    const { run, shopReturnMode, view } = useAppStore.getState();
    if (!run) {
        return false;
    }

    if (view === 'shop') {
        useAppStore.getState().continueFromShop();
        return true;
    }

    if (view === 'sideRoom') {
        useAppStore.getState().claimSideRoomPrimary();
        return true;
    }

    if (view !== 'playing' || run.status !== 'levelComplete') {
        return false;
    }

    if (run.relicOffer?.options[0]) {
        useAppStore.getState().pickRelic(run.relicOffer.options[0]);
        return true;
    }

    const routeChoice = run.lastLevelResult?.routeChoices?.[0];
    if (routeChoice && !run.pendingRouteCardPlan) {
        useAppStore.getState().chooseRouteAndContinue(routeChoice.id);
        return true;
    }

    if (run.shopOffers.length > 0 && shopReturnMode !== 'summary') {
        useAppStore.getState().openShopFromLevelComplete();
        return true;
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
        'floorClearWithRouteChoices',
        'floorClearWithShop',
        'floorClearWithShopLowGold',
        'sideRoomPrimary',
        'sideRoomChoice',
        'sideRoomSkip',
        'sideRoomThenShop',
        'relicDraft'
    ] satisfies PlayablePathFixtureId[])(
        'drives the %s playable interlude fixture to the next playable state',
        (fixtureId) => {
            installPlayablePathFixture(fixtureId);

            for (let step = 0; step < 6; step += 1) {
                const { run, shopReturnMode, view } = useAppStore.getState();
                if (
                    view === 'playing' &&
                    run?.status !== 'levelComplete' &&
                    !run?.sideRoom &&
                    !run?.relicOffer &&
                    shopReturnMode === null
                ) {
                    break;
                }

                const before = visibleProgressionSignature();
                expect(driveOneVisibleProgressionStep()).toBe(true);
                expect(visibleProgressionSignature()).not.toBe(before);
            }

            const { run, shopReturnMode, view } = useAppStore.getState();
            expect(view).toBe('playing');
            expect(shopReturnMode).toBeNull();
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

    it('claims a ready meta progression reward and applies it to future run starts', () => {
        const saveData = createDefaultSaveData();
        saveData.playerStats = {
            ...saveData.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: false
        };
        useAppStore.setState({
            saveData,
            settings: saveData.settings
        });

        const result = useAppStore.getState().claimMetaProgressionReward('upgrade_relic_shrine_extra_pick');

        expect(result).toMatchObject({
            applied: true,
            reason: 'applied'
        });
        expect(useAppStore.getState().saveData.playerStats?.relicShrineExtraPickUnlocked).toBe(true);

        useAppStore.getState().startRun();

        expect(useAppStore.getState().run?.metaRelicDraftExtraPerMilestone).toBe(1);
        expect(useAppStore.getState().runStartSaveData?.playerStats?.relicShrineExtraPickUnlocked).toBe(true);
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

    it('starts a practice-only dungeon showcase on an active combat room', () => {
        useAppStore.getState().startDungeonShowcaseRun();

        const state = useAppStore.getState();
        const run = state.run;
        expect(state.view).toBe('playing');
        expect(run?.status).toBe('playing');
        expect(run?.practiceMode).toBe(true);
        expect(run?.dungeonShowcaseRun).toBe(true);
        expect(run?.achievementsEnabled).toBe(false);
        expect(run?.board?.level).toBe(5);
        expect(run?.board?.enemyHazards?.length).toBeGreaterThan(0);
        expect(run?.board?.tiles.some((tile) => tile.dungeonCardKind === 'enemy')).toBe(true);
        expect(run?.dungeonRun.currentFloor).toBe(5);
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
        expect(matchedRun?.status).toBe('playing');
        expect(matchedRun?.board).not.toBeNull();
        const matchedBoard = matchedRun?.board;

        if (!matchedBoard) {
            throw new Error('Expected board to exist after immediate match resolution.');
        }

        expect(matchedBoard.flippedTileIds).toHaveLength(0);
        expect(matchedBoard.tiles.find((tile) => tile.id === firstTile!.id)?.state).toBe('matched');
        expect(matchedBoard.tiles.find((tile) => tile.id === matchingTile!.id)?.state).toBe('matched');

        useAppStore.getState().pressTile(nextPairTile!.id);
        const runAfterNextPress = useAppStore.getState().run;
        expect(runAfterNextPress?.board).not.toBeNull();
        expect(runAfterNextPress?.board?.flippedTileIds).toContain(nextPairTile!.id);
    });

    it('ends gauntlet when the deadline passes without a tile press', async () => {
        useAppStore.getState().startGauntletRun();
        const started = useAppStore.getState().run;
        expect(started?.gameMode).toBe('gauntlet');
        useAppStore.setState({
            run: { ...started!, gauntletDeadlineMs: Date.now() - 50 }
        });
        await vi.advanceTimersByTimeAsync(400);
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().view).toBe('gameOver');
    });

    it('does not expire a paused gauntlet until the run resumes', async () => {
        useAppStore.getState().startGauntletRun();
        const started = useAppStore.getState().run;
        expect(started?.gameMode).toBe('gauntlet');

        useAppStore.setState({
            view: 'playing',
            run: {
                ...started!,
                status: 'paused',
                gauntletDeadlineMs: Date.now() - 50,
                timerState: {
                    ...started!.timerState,
                    pausedFromStatus: 'playing',
                    gauntletPausedAtMs: Date.now() - 1_000
                }
            }
        });

        await vi.advanceTimersByTimeAsync(400);

        expect(useAppStore.getState().run?.status).toBe('paused');
        expect(useAppStore.getState().view).toBe('playing');

        useAppStore.getState().resume();

        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().run?.gauntletDeadlineMs).toBeGreaterThan(Date.now());
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

        useAppStore.getState().closeSubscreen();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('playing');

        useAppStore.getState().openSettings('playing');
        const frozenForSettings = useAppStore.getState().run;
        expect(useAppStore.getState().view).toBe('settings');
        expect(frozenForSettings?.status).toBe('paused');
        expect(frozenForSettings?.timerState.pausedFromStatus).toBe('playing');
        expect(frozenForSettings?.timerState).toEqual(frozenForInventory?.timerState);
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

    it('routes the floor-clear shop as its own in-run destination without changing shop mechanics', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true, runSeed: 44 });
        const levelCompleteRun = {
            ...baseRun,
            status: 'levelComplete' as const,
            shopGold: 5,
            relicOffer: null,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S' as const,
                livesRemaining: baseRun.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none' as const,
                clearLifeGained: 0
            }
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...levelCompleteRun,
                shopOffers: createRunShopOffers(levelCompleteRun)
            }
        });

        useAppStore.getState().openShopFromLevelComplete();
        expect(useAppStore.getState().view).toBe('shop');

        const peekOffer = useAppStore.getState().run!.shopOffers.find((offer) => offer.itemId === 'peek_charge')!;
        useAppStore.getState().purchaseShopOffer(peekOffer.id);
        expect(useAppStore.getState().run?.shopGold).toBe(5 - peekOffer.cost);
        expect(useAppStore.getState().run?.shopOffers.find((offer) => offer.id === peekOffer.id)?.purchased).toBe(true);

        useAppStore.getState().closeShopToFloorSummary();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('levelComplete');

        useAppStore.getState().openShopFromLevelComplete();
        useAppStore.getState().continueFromShop();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('memorize');
    });

    it('does not open the floor-clear shop when the cleared floor has no existing offers', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true, runSeed: 46 });
        useAppStore.setState({
            view: 'playing',
            shopReturnMode: null,
            run: {
                ...baseRun,
                status: 'levelComplete',
                shopGold: 5,
                shopOffers: [],
                relicOffer: null,
                timerState: {
                    memorizeRemainingMs: null,
                    resolveRemainingMs: null,
                    debugRevealRemainingMs: null,
                    pausedFromStatus: null
                },
                lastLevelResult: {
                    level: 1,
                    scoreGained: 100,
                    rating: 'S',
                    livesRemaining: baseRun.lives,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'none',
                    clearLifeGained: 0
                }
            }
        });

        useAppStore.getState().openShopFromLevelComplete();

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().shopReturnMode).toBeNull();
        expect(useAppStore.getState().run?.status).toBe('levelComplete');
        expect(useAppStore.getState().run?.shopOffers).toEqual([]);
    });

    it('ignores stale side-room clicks after the side-room surface has already transitioned', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true, runSeed: 47 });
        const levelCompleteRun = {
            ...baseRun,
            status: 'levelComplete' as const,
            shopGold: 5,
            relicOffer: null,
            sideRoom: null,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S' as const,
                livesRemaining: baseRun.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none' as const,
                clearLifeGained: 0
            }
        };
        useAppStore.setState({
            view: 'shop',
            shopReturnMode: 'summary',
            run: {
                ...levelCompleteRun,
                shopOffers: createRunShopOffers(levelCompleteRun)
            }
        });

        useAppStore.getState().claimSideRoomChoice('stale-choice');
        useAppStore.getState().claimSideRoomPrimary();
        useAppStore.getState().skipSideRoom();

        expect(useAppStore.getState().view).toBe('shop');
        expect(useAppStore.getState().shopReturnMode).toBe('summary');
        expect(useAppStore.getState().run?.status).toBe('levelComplete');
    });

    it('ignores stale side-room clicks while a side room exists but another surface is active', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, practiceMode: true, runSeed: 48 });
        const event = rollRunEventRoom({ runSeed: baseRun.runSeed, rulesVersion: baseRun.runRulesVersion, floor: 2 });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType: 'mystery',
                nodeKind: 'event',
                floor: 2,
                title: event.title,
                body: event.body,
                primaryLabel: event.options[0]!.label,
                primaryDetail: event.options[0]!.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: index === 0
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: event.options[0]!.id }
            }
        };
        useAppStore.setState({ view: 'playing', run });

        useAppStore.getState().claimSideRoomChoice(event.options[0]!.id);
        useAppStore.getState().claimSideRoomPrimary();
        useAppStore.getState().skipSideRoom();

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run).toBe(run);
        expect(useAppStore.getState().run?.sideRoom).toBe(run.sideRoom);
    });

    it('selects a floor route through side room before shop and stamps the next board after continuing', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 45 });
        const levelCompleteRun = {
            ...baseRun,
            status: 'levelComplete' as const,
            shopGold: 5,
            relicOffer: null,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            },
            lastLevelResult: {
                level: 1,
                scoreGained: 100,
                rating: 'S' as const,
                livesRemaining: baseRun.lives,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'none' as const,
                clearLifeGained: 0,
                routeChoices: [
                    {
                        id: '17:45:2:greed',
                        routeType: 'greed' as const,
                        label: 'Greedy route',
                        detail: 'Higher pressure route hook for future shop, elite, or bonus rewards.'
                    }
                ]
            }
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...levelCompleteRun,
                shopOffers: createRunShopOffers(levelCompleteRun)
            }
        });

        useAppStore.getState().chooseRouteAndContinue('17:45:2:greed');
        expect(useAppStore.getState().view).toBe('sideRoom');
        expect(useAppStore.getState().run?.pendingRouteCardPlan).toMatchObject({ routeType: 'greed' });
        expect(useAppStore.getState().run?.sideRoom).toMatchObject({ routeType: 'greed' });

        useAppStore.getState().skipSideRoom();
        expect(useAppStore.getState().view).toBe('shop');
        const shopRun = useAppStore.getState().run;

        useAppStore.getState().chooseRouteAndContinue('17:45:2:greed');
        expect(useAppStore.getState().view).toBe('shop');
        expect(useAppStore.getState().run).toBe(shopRun);

        useAppStore.getState().continueFromShop();
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('memorize');
        expect(useAppStore.getState().run?.pendingRouteCardPlan).toBeNull();
        expect(useAppStore.getState().run?.board?.tiles.some((tile) => tile.routeCardKind === 'greed_cache')).toBe(
            true
        );
    });

    it('routes into concrete dungeon node gameplay instead of only stamping route cards', () => {
        const runSeed = 47;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const currentLevel = 4;
        const nextLevel = 5;
        const board = buildBoard(currentLevel, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            gameMode: 'endless'
        });
        const routeChoices = generateRouteChoices(baseRun, nextLevel);
        const dungeonRun = revealDungeonChoices(
            createDungeonRunMapState(runSeed, baseRun.runRulesVersion, currentLevel),
            currentLevel,
            routeChoices
        );
        const greedChoice = routeChoices.find((choice) => choice.routeType === 'greed')!;
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                dungeonRun,
                status: 'levelComplete',
                relicOffer: null,
                timerState: {
                    memorizeRemainingMs: null,
                    resolveRemainingMs: null,
                    debugRevealRemainingMs: null,
                    pausedFromStatus: null
                },
                lastLevelResult: {
                    level: currentLevel,
                    scoreGained: 100,
                    rating: 'S',
                    livesRemaining: baseRun.lives,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'none',
                    clearLifeGained: 0,
                    routeChoices
                }
            }
        });

        useAppStore.getState().chooseRouteAndContinue(greedChoice.id);
        expect(useAppStore.getState().view).toBe('sideRoom');
        expect(useAppStore.getState().run?.sideRoom).toMatchObject({ routeType: 'greed', nodeKind: 'treasure' });

        useAppStore.getState().skipSideRoom();

        const nextRun = useAppStore.getState().run;
        expect(useAppStore.getState().view).toBe('playing');
        expect(nextRun?.status).toBe('memorize');
        expect(nextRun?.dungeonRun.nodes.find((node) => node.id === nextRun.dungeonRun.currentNodeId)?.kind).toBe('trap');
        expect(nextRun?.board?.floorArchetypeId).toBe('trap_hall');
        expect(nextRun?.board?.dungeonObjectiveId).toBe('disarm_traps');
        expect(nextRun?.board?.tiles.some((tile) => tile.dungeonCardKind === 'trap')).toBe(true);
        expect(nextRun?.board?.tiles.some((tile) => tile.dungeonCardKind === 'enemy')).toBe(true);
    });

    it('opens a generated in-board dungeon shop through tile press', () => {
        const runSeed = 48;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'shop',
            gameMode: 'endless'
        });
        const shopTile = board.tiles.find((tile) => tile.pairKey === SHOP_PAIR_KEY)!;
        expect(shopTile).toBeDefined();
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                shopGold: 5,
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            },
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: shopTile.id
        });

        useAppStore.getState().pressTile(shopTile.id);

        expect(useAppStore.getState().view).toBe('shop');
        expect(useAppStore.getState().shopReturnMode).toBe('floor');
        expect(useAppStore.getState().run?.status).toBe('paused');
        expect(useAppStore.getState().run?.shopOffers.length).toBeGreaterThan(0);
        expect(useAppStore.getState().run?.board?.dungeonShopVisited).toBe(true);
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();
    });

    it('claims a generated in-board dungeon room through tile press without leaving the board', () => {
        const runSeed = 49;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'rest',
            gameMode: 'endless'
        });
        const roomTile = board.tiles.find((tile) => tile.pairKey === ROOM_PAIR_KEY)!;
        expect(roomTile).toBeDefined();
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            },
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: roomTile.id
        });

        useAppStore.getState().pressTile(roomTile.id);

        const usedRoomTile = useAppStore.getState().run?.board?.tiles.find((tile) => tile.id === roomTile.id);
        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(usedRoomTile).toMatchObject({ dungeonRoomUsed: true, dungeonCardState: 'resolved' });
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();
    });

    it('handles generated rotating enemy hazard contact and flips the occupied card', () => {
        const runSeed = 8;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(7, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            gameMode: 'endless'
        });
        const hazard = board.enemyHazards![0]!;
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                strayRemoveArmed: true,
                stats: { ...baseRun.stats, guardTokens: 0 },
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            },
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: hazard.currentTileId
        });

        useAppStore.getState().pressTile(hazard.currentTileId);

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - hazard.damage);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.board!.tiles.find((tile) => tile.id === hazard.currentTileId)!.state).toBe('flipped');
        expect(nextRun.board!.flippedTileIds).toEqual([hazard.currentTileId]);
        expect(nextRun.board!.enemyHazards!.find((item) => item.id === hazard.id)!.currentTileId).toBe(hazard.nextTileId);
        expect(nextRun.strayRemoveArmed).toBe(false);
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.getState().pressTile(hazard.currentTileId);

        const repeated = useAppStore.getState().run!;
        expect(repeated.lives).toBe(nextRun.lives);
        expect(repeated.enemyHazardHitsThisFloor).toBe(1);
    });

    it('applies moving enemy contact before resolving an armed destroy power', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 54 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'power-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                destroyPairCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            },
            destroyPairArmed: true
        });

        useAppStore.getState().pressTile('a1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.destroyPairCharges).toBe(0);
        expect(nextRun.board!.flippedTileIds).toEqual([]);
        expect(nextRun.board!.tiles.filter((tile) => tile.pairKey === 'A').every((tile) => tile.state === 'matched')).toBe(
            true
        );
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'b1' });
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
    });

    it('applies moving enemy contact before resolving an armed peek power', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 55 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'peek-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                peekCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            },
            peekModeArmed: true
        });

        useAppStore.getState().pressTile('a1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.peekCharges).toBe(0);
        expect(nextRun.peekRevealedTileIds).toEqual(['a1']);
        expect(nextRun.board!.flippedTileIds).toEqual([]);
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'b1' });
        expect(useAppStore.getState().peekModeArmed).toBe(false);
    });

    it('applies moving enemy contact before resolving an armed stray power', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 56 });
        const tiles: Tile[] = [
            { id: 'w1', pairKey: '__wild__', symbol: 'W', label: 'Wild', state: 'hidden' },
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'stray-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'w1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                strayRemoveArmed: true,
                strayRemoveCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            }
        });

        useAppStore.getState().pressTile('w1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.strayRemoveCharges).toBe(0);
        expect(nextRun.strayRemoveArmed).toBe(false);
        expect(nextRun.board!.tiles.find((tile) => tile.id === 'w1')!.state).toBe('removed');
        expect(nextRun.board!.flippedTileIds).toEqual([]);
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'b1' });
    });

    it('keeps moving enemy contact when an armed stray power is invalid for the occupied card', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 57 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'stray-invalid-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                strayRemoveArmed: true,
                strayRemoveCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            }
        });

        useAppStore.getState().pressTile('a1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.strayRemoveCharges).toBe(1);
        expect(nextRun.board!.tiles.find((tile) => tile.id === 'a1')!.state).toBe('hidden');
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'b1' });
    });

    it('keeps moving enemy contact when an armed destroy power is blocked', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 58 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'destroy-blocked-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                activeContract: { noShuffle: false, noDestroy: true, maxMismatches: null },
                destroyPairCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            },
            destroyPairArmed: true
        });

        useAppStore.getState().pressTile('a1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.destroyPairCharges).toBe(1);
        expect(nextRun.board!.tiles.find((tile) => tile.id === 'a1')!.state).toBe('hidden');
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'b1' });
    });

    it('stops armed power resolution when moving enemy contact is fatal', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 59 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: [],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'fatal-armed-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 2,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                lives: 1,
                destroyPairCharges: 1,
                stats: { ...baseRun.stats, guardTokens: 0 }
            },
            destroyPairArmed: true
        });

        useAppStore.getState().pressTile('a1');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.status).toBe('gameOver');
        expect(nextRun.lives).toBe(0);
        expect(nextRun.destroyPairCharges).toBe(1);
        expect(nextRun.board!.tiles.find((tile) => tile.id === 'a1')!.state).toBe('hidden');
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'a1' });
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
    });

    it('applies moving enemy contact before a Gambit third pick flips the occupied card', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 53 });
        const tiles: Tile[] = [
            { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'flipped' },
            { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
            { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'flipped' },
            { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
        ];
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles,
            flippedTileIds: ['a1', 'b1'],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            enemyHazards: [
                {
                    id: 'gambit-contact',
                    kind: 'sentinel',
                    label: 'Patrol Sentry',
                    currentTileId: 'a2',
                    nextTileId: 'b2',
                    pattern: 'patrol',
                    state: 'hidden',
                    damage: 1,
                    hp: 1,
                    maxHp: 1
                }
            ],
            enemyHazardTurn: 0
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'resolving',
                gambitAvailableThisFloor: true,
                gambitThirdFlipUsed: false,
                stats: { ...baseRun.stats, guardTokens: 0 },
                timerState: { ...baseRun.timerState, resolveRemainingMs: 250 }
            }
        });

        useAppStore.getState().pressTile('a2');

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.lives).toBe(baseRun.lives - 1);
        expect(nextRun.enemyHazardHitsThisFloor).toBe(1);
        expect(nextRun.board!.flippedTileIds).toEqual(['a1', 'b1', 'a2']);
        expect(nextRun.board!.tiles.find((tile) => tile.id === 'a2')!.state).toBe('flipped');
        expect(nextRun.board!.enemyHazards![0]).toMatchObject({ state: 'revealed', currentTileId: 'a2' });
        expect(gameSfxMocks.playResolveSfx).toHaveBeenCalled();
        expect(gameSfxMocks.playGambitCommitSfx).toHaveBeenCalled();
    });

    it('springs generated trap cards on the same tile press', () => {
        const runSeed = 51;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const board = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const trapTile = board.tiles.find((tile) => tile.dungeonCardKind === 'trap')!;
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            }
        });

        useAppStore.getState().pressTile(trapTile.id);

        const nextRun = useAppStore.getState().run!;
        expect(nextRun.dungeonTrapsTriggered).toBe(1);
        expect(nextRun.board!.tiles.find((tile) => tile.id === trapTile.id)!.state).toBe('flipped');
        expect(
            nextRun.board!.tiles
                .filter((tile) => tile.pairKey === trapTile.pairKey)
                .every((tile) => tile.dungeonCardState === 'resolved')
        ).toBe(true);
        expect(gameSfxMocks.playFlipSfx).toHaveBeenCalled();
        expect(gameSfxMocks.playTrapSfx).toHaveBeenCalled();
    });

    it('finalizes game over immediately when a hidden trap reveal is fatal', () => {
        const runSeed = 52;
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed });
        const generatedBoard = buildBoard(5, {
            runSeed,
            runRulesVersion: baseRun.runRulesVersion,
            dungeonNodeKind: 'trap',
            gameMode: 'endless'
        });
        const generatedTrapTile = generatedBoard.tiles.find((tile) => tile.dungeonCardKind === 'trap')!;
        const board = {
            ...generatedBoard,
            tiles: generatedBoard.tiles.map((tile) =>
                tile.pairKey === generatedTrapTile.pairKey
                    ? {
                          ...tile,
                          label: 'Spike Trap',
                          dungeonCardKind: 'trap' as const,
                          dungeonCardState: 'hidden' as const,
                          dungeonCardEffectId: 'trap_spikes' as const
                      }
                    : tile
            )
        };
        const trapTile = board.tiles.find((tile) => tile.pairKey === generatedTrapTile.pairKey)!;
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                lives: 1,
                stats: { ...baseRun.stats, guardTokens: 0 },
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            },
            boardPinMode: false,
            destroyPairArmed: false,
            peekModeArmed: false,
            dungeonExitPromptOpen: true
        });

        useAppStore.getState().pressTile(trapTile.id);

        const state = useAppStore.getState();
        const nextRun = state.run!;
        expect(state.view).toBe('gameOver');
        expect(nextRun.status).toBe('gameOver');
        expect(nextRun.lives).toBe(0);
        expect(nextRun.dungeonTrapsTriggered).toBe(1);
        expect(nextRun.lastRunSummary).not.toBeNull();
        expect(state.saveData.lastRunSummary).toEqual(nextRun.lastRunSummary);
        expect(gameSfxMocks.playFlipSfx).toHaveBeenCalled();
        expect(gameSfxMocks.playTrapSfx).toHaveBeenCalled();
        expect(state.boardPinMode).toBe(false);
        expect(state.destroyPairArmed).toBe(false);
        expect(state.peekModeArmed).toBe(false);
        expect(state.dungeonExitPromptOpen).toBe(false);
        expect(gameSfxMocks.playTrapSfx).toHaveBeenCalledTimes(1);
    });

    it('claims a selected side-room event choice before advancing', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 46 });
        const event = rollRunEventRoom({ runSeed: baseRun.runSeed, rulesVersion: baseRun.runRulesVersion, floor: 2 });
        const choice = event.options.find((option) => option.effect === 'gain_iron_key') ?? event.options[0]!;
        useAppStore.setState({
            view: 'sideRoom',
            run: {
                ...baseRun,
                status: 'levelComplete',
                sideRoom: {
                    id: `${event.eventKey}:side`,
                    kind: 'run_event',
                    routeType: 'mystery',
                    nodeKind: 'event',
                    floor: 2,
                    title: event.title,
                    body: event.body,
                    primaryLabel: event.options[0]!.label,
                    primaryDetail: event.options[0]!.detail,
                    skipLabel: 'Decline',
                    choices: event.options.map((option, index) => ({
                        id: option.id,
                        label: option.label,
                        detail: option.detail,
                        primary: index === 0
                    })),
                    payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: event.options[0]!.id }
                },
                lastLevelResult: {
                    level: 1,
                    scoreGained: 100,
                    rating: 'S',
                    livesRemaining: baseRun.lives,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'none',
                    clearLifeGained: 0
                }
            }
        });

        useAppStore.getState().claimSideRoomChoice(choice.id);

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run?.sideRoom).toBeNull();
        expect(useAppStore.getState().run?.status).toBe('memorize');
        if (choice.effect === 'gain_iron_key') {
            expect(useAppStore.getState().run?.dungeonKeys.iron).toBe(1);
        }
    });

    it('keeps an event side room open when the selected choice id is invalid', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 47 });
        const event = rollRunEventRoom({ runSeed: baseRun.runSeed, rulesVersion: baseRun.runRulesVersion, floor: 2 });
        const run: RunState = {
            ...baseRun,
            status: 'levelComplete',
            sideRoom: {
                id: `${event.eventKey}:side`,
                kind: 'run_event',
                routeType: 'mystery',
                nodeKind: 'event',
                floor: 2,
                title: event.title,
                body: event.body,
                primaryLabel: event.options[0]!.label,
                primaryDetail: event.options[0]!.detail,
                skipLabel: 'Decline',
                choices: event.options.map((option, index) => ({
                    id: option.id,
                    label: option.label,
                    detail: option.detail,
                    primary: index === 0
                })),
                payload: { kind: 'event_choice', eventKey: event.eventKey, choiceId: event.options[0]!.id }
            }
        };
        useAppStore.setState({ view: 'sideRoom', run });

        useAppStore.getState().claimSideRoomChoice('missing-choice');

        expect(useAppStore.getState().view).toBe('sideRoom');
        expect(useAppStore.getState().run).toBe(run);
        expect(useAppStore.getState().run?.sideRoom).toBe(run.sideRoom);
    });

    it('recovers stale side-room actions with no run back to the menu', () => {
        for (const action of [
            () => useAppStore.getState().claimSideRoomPrimary(),
            () => useAppStore.getState().claimSideRoomChoice('missing-choice'),
            () => useAppStore.getState().skipSideRoom()
        ]) {
            useAppStore.setState({ view: 'sideRoom', run: null });

            action();

            expect(useAppStore.getState().view).toBe('menu');
            expect(useAppStore.getState().run).toBeNull();
        }
    });

    it('routes stale dead side-room actions to game over instead of a blank playing shell', () => {
        const makeDeadSideRoomRun = (): RunState => {
            const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_357 });
            return {
                ...baseRun,
                status: 'levelComplete',
                lives: 0,
                sideRoom: {
                    id: 'dead-side-room',
                    kind: 'rest_shrine',
                    routeType: 'safe',
                    nodeKind: 'rest',
                    floor: 2,
                    title: 'Stale Rest',
                    body: 'A stale side-room snapshot should not revive a defeated run.',
                    primaryLabel: 'Rest',
                    primaryDetail: 'Recover only while alive.',
                    skipLabel: 'Leave',
                    payload: { kind: 'rest_heal', serviceId: 'rest_heal' }
                },
                lastLevelResult: {
                    level: 1,
                    scoreGained: 100,
                    rating: 'B',
                    livesRemaining: 0,
                    perfect: false,
                    mistakes: 1,
                    clearLifeReason: 'none',
                    clearLifeGained: 0
                }
            };
        };

        for (const action of [
            () => useAppStore.getState().claimSideRoomPrimary(),
            () => useAppStore.getState().claimSideRoomChoice('missing-choice'),
            () => useAppStore.getState().skipSideRoom()
        ]) {
            resetStore();
            useAppStore.setState({ view: 'sideRoom', run: makeDeadSideRoomRun() });

            action();

            expect(useAppStore.getState().view).toBe('gameOver');
            expect(useAppStore.getState().run?.status).toBe('gameOver');
            expect(useAppStore.getState().run?.lives).toBe(0);
            expect(useAppStore.getState().run?.sideRoom).toBeNull();
            expect(useAppStore.getState().run?.lastRunSummary).not.toBeNull();
        }
    });

    it('routes zero-life floor-clear shop attempts to game over instead of opening a spend surface', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_358 });
        const deadShopRun: RunState = {
            ...baseRun,
            status: 'levelComplete',
            lives: 0,
            shopGold: 99,
            shopOffers: createRunShopOffers({ ...baseRun, lives: 0, shopGold: 99 }),
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'A',
                livesRemaining: 0,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0
            }
        };
        useAppStore.setState({ view: 'playing', run: deadShopRun });

        useAppStore.getState().openShopFromLevelComplete();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().run?.lastRunSummary).not.toBeNull();
    });

    it('keeps the shop route unavailable without an active completed floor', () => {
        useAppStore.getState().openShopFromLevelComplete();
        expect(useAppStore.getState().view).toBe('menu');

        useAppStore.setState({ view: 'shop', run: null });
        useAppStore.getState().closeShopToFloorSummary();
        expect(useAppStore.getState().view).toBe('menu');
    });

    it('ignores stale shop purchases and rerolls for non-resumable floor-shop snapshots', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_401 });
        const deadShopRun: RunState = {
            ...baseRun,
            status: 'gameOver',
            lives: 0,
            shopGold: 99,
            shopOffers: createRunShopOffers({ ...baseRun, shopGold: 99 })
        };
        useAppStore.setState({
            view: 'shop',
            run: deadShopRun,
            shopReturnMode: 'floor'
        });

        useAppStore.getState().purchaseShopOffer(deadShopRun.shopOffers[0]!.id);
        useAppStore.getState().rerollShopOffers();

        expect(useAppStore.getState().run).toBe(deadShopRun);
        expect(useAppStore.getState().run?.shopGold).toBe(99);
        expect(useAppStore.getState().run?.shopOffers).toBe(deadShopRun.shopOffers);
    });

    it('does not let corrupted zero-life floor-clear shops heal or reroll back into a live run', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_402 });
        const deadLevelCompleteShopRun: RunState = {
            ...baseRun,
            status: 'levelComplete',
            lives: 0,
            shopGold: 99,
            shopOffers: createRunShopOffers({ ...baseRun, lives: 0, shopGold: 99 }),
            lastLevelResult: {
                level: 1,
                scoreGained: 120,
                rating: 'A',
                livesRemaining: 0,
                perfect: false,
                mistakes: 1,
                clearLifeReason: 'none',
                clearLifeGained: 0
            }
        };
        const healOffer = deadLevelCompleteShopRun.shopOffers.find((offer) => offer.itemId === 'heal_life');
        expect(healOffer).toBeDefined();

        useAppStore.setState({
            view: 'shop',
            run: deadLevelCompleteShopRun,
            shopReturnMode: 'summary'
        });

        useAppStore.getState().purchaseShopOffer(healOffer!.id);
        useAppStore.getState().rerollShopOffers();

        expect(useAppStore.getState().run).toBe(deadLevelCompleteShopRun);
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().run?.shopGold).toBe(99);
        expect(useAppStore.getState().run?.shopOffers).toBe(deadLevelCompleteShopRun.shopOffers);
    });

    it('lets death win over puzzle and relic early returns when continuing a completed floor', () => {
        const makeDeadCompleteRun = (overrides: Partial<RunState> = {}): RunState => {
            const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 12_359 });
            return {
                ...baseRun,
                status: 'levelComplete',
                lives: 0,
                shopOffers: createRunShopOffers({ ...baseRun, shopGold: 99 }),
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
            makeDeadCompleteRun({ gameMode: 'puzzle', puzzleId: 'starter_pairs' }),
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

    it('GLD-P0-003: continueToNextLevel does not advance completed puzzle runs', () => {
        const puzzleTiles: Tile[] = [
            { id: 'p1', pairKey: 'P', symbol: 'P', label: 'P', state: 'matched' },
            { id: 'p2', pairKey: 'P', symbol: 'P', label: 'P', state: 'matched' }
        ];
        const run: RunState = {
            ...createPuzzleRun(0, 'guard_test', puzzleTiles),
            status: 'levelComplete'
        };
        useAppStore.setState({ view: 'playing', run });

        useAppStore.getState().continueToNextLevel();

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().run).toBe(run);
    });

    it('GLD-P0-004: clearing a builtin puzzle records completion in memory and persisted save data', async () => {
        useAppStore.getState().startPuzzleRun('starter_pairs');
        notifyCurrentBoardReady();

        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const board = useAppStore.getState().run?.board;
        expect(board).toBeDefined();

        for (const [first, second] of normalPairGroups(board!)) {
            useAppStore.getState().pressTile(first!.id);
            useAppStore.getState().pressTile(second!.id);
        }

        const state = useAppStore.getState();
        const completion = state.saveData.playerStats?.puzzleCompletions?.starter_pairs;
        expect(state.view).toBe('playing');
        expect(state.run?.status).toBe('levelComplete');
        expect(completion).toEqual({
            completed: true,
            bestMistakes: 0,
            bestScore: state.run?.stats.totalScore
        });

        const persisted = JSON.parse(window.localStorage.getItem('memory-dungeon-save-data') ?? '{}') as SaveData;
        expect(persisted.playerStats?.puzzleCompletions?.starter_pairs).toEqual(completion);
    });

    it('GLD-P0-005: zero-clear daily game over does not count as daily completion', async () => {
        const baseRun = createDailyRun(0, { echoFeedbackEnabled: false, runSeed: 50_005 });
        const board = buildBoard(1, {
            gameMode: 'daily',
            runSeed: baseRun.runSeed,
            runRulesVersion: baseRun.runRulesVersion
        });
        const groups = normalPairGroups(board);
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                lives: 1,
                activeContract: {
                    noShuffle: false,
                    noDestroy: false,
                    maxMismatches: 0,
                    bonusRelicDraftPick: false
                },
                stats: { ...baseRun.stats, guardTokens: 0 },
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            }
        });

        useAppStore.getState().pressTile(groups[0]![0]!.id);
        useAppStore.getState().pressTile(groups[1]![0]!.id);
        await vi.advanceTimersByTimeAsync(1400);

        const state = useAppStore.getState();
        expect(state.view).toBe('gameOver');
        expect(state.run?.stats.levelsCleared).toBe(0);
        expect(state.saveData.playerStats?.dailiesCompleted).toBe(0);
        expect(state.saveData.playerStats?.lastDailyDateKeyUtc).toBeNull();
        expect(state.saveData.achievements.ACH_SEVEN_DAILIES).toBe(false);
    });

    it('GLD-P0-005: first daily floor clear persists completion and can unlock seven dailies', async () => {
        const saveData = createDefaultSaveData();
        useAppStore.setState({
            saveData: {
                ...saveData,
                playerStats: {
                    ...saveData.playerStats!,
                    dailiesCompleted: 6,
                    lastDailyDateKeyUtc: '19990101'
                }
            }
        });
        const baseRun = createDailyRun(0, { echoFeedbackEnabled: false, runSeed: 50_006 });
        const board = buildBoard(1, {
            gameMode: 'daily',
            runSeed: baseRun.runSeed,
            runRulesVersion: baseRun.runRulesVersion
        });
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                findablesTotalThisFloor: countFindablePairs(board.tiles)
            }
        });

        for (const [first, second] of normalPairGroups(board)) {
            useAppStore.getState().pressTile(first!.id);
            useAppStore.getState().pressTile(second!.id);
        }
        const exitTile = useAppStore.getState().run?.board?.tiles.find((tile) => tile.pairKey === '__exit__');
        if (exitTile && useAppStore.getState().run?.status === 'playing') {
            useAppStore.getState().pressTile(exitTile.id);
            useAppStore.getState().activateDungeonExitFromPrompt('none');
        }

        const state = useAppStore.getState();
        expect(state.run?.status).toBe('levelComplete');
        expect(state.saveData.playerStats?.dailiesCompleted).toBe(7);
        expect(state.saveData.playerStats?.lastDailyDateKeyUtc).toBe(baseRun.dailyDateKeyUtc);
        expect(state.saveData.achievements.ACH_SEVEN_DAILIES).toBe(true);

        useAppStore.getState().endRun();
        expect(useAppStore.getState().saveData.playerStats?.dailiesCompleted).toBe(7);
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

        useAppStore.getState().resume();
        expect(uiSfxMocks.playPauseResumeSfx).toHaveBeenCalledTimes(1);
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

        resetStore();
        useAppStore.setState({
            view: 'shop',
            shopReturnMode: 'floor',
            run: makePausedDead()
        });
        useAppStore.getState().continueFromShop();

        expect(useAppStore.getState().view).toBe('gameOver');
        expect(useAppStore.getState().run?.status).toBe('gameOver');
        expect(useAppStore.getState().run?.lives).toBe(0);
        expect(useAppStore.getState().shopReturnMode).toBeNull();
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

    it('auto-selects a valid dungeon exit spend when the prompt action omits one', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_404 });
        const exitTile = baseRun.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const board: BoardState = {
            ...baseRun.board!,
            dungeonExitTileId: exitTile.id,
            dungeonExitLockKind: 'iron',
            matchedPairs: baseRun.board!.pairCount,
            tiles: baseRun.board!.tiles.map((tile) =>
                tile.id === exitTile.id
                    ? {
                          ...tile,
                          state: 'flipped',
                          dungeonCardKind: 'exit',
                          dungeonCardState: 'revealed',
                          dungeonExitLockKind: 'iron'
                      }
                    : {
                          ...tile,
                          state: 'matched'
                      }
            )
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                dungeonKeys: { iron: 1 },
                dungeonMasterKeys: 0
            },
            dungeonExitPromptOpen: true
        });

        useAppStore.getState().activateDungeonExitFromPrompt();

        expect(useAppStore.getState().run?.status).toBe('levelComplete');
        expect(useAppStore.getState().run?.dungeonKeys.iron).toBe(0);
        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
    });

    it('keeps the dungeon exit prompt open when activation is refused', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_406 });
        const exitTile = baseRun.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const unmatchedPair = baseRun.board!.tiles.find((tile) => tile.pairKey !== EXIT_PAIR_KEY)!;
        const board: BoardState = {
            ...baseRun.board!,
            dungeonExitTileId: exitTile.id,
            dungeonExitLockKind: 'iron',
            matchedPairs: Math.max(0, baseRun.board!.pairCount - 1),
            tiles: baseRun.board!.tiles.map((tile) =>
                tile.id === exitTile.id
                    ? {
                          ...tile,
                          state: 'flipped',
                          dungeonCardKind: 'exit',
                          dungeonCardState: 'revealed',
                          dungeonExitLockKind: 'iron'
                      }
                    : tile.pairKey === unmatchedPair.pairKey
                      ? {
                            ...tile,
                            state: 'hidden'
                        }
                      : {
                            ...tile,
                            state: 'matched'
                        }
            )
        };
        const run: RunState = {
            ...baseRun,
            board,
            status: 'playing',
            dungeonKeys: {},
            dungeonMasterKeys: 0
        };
        useAppStore.setState({
            view: 'playing',
            run,
            dungeonExitPromptOpen: true
        });

        useAppStore.getState().activateDungeonExitFromPrompt('none');

        expect(useAppStore.getState().run).toBe(run);
        expect(useAppStore.getState().run?.status).toBe('playing');
        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(true);
    });

    it('auto-opens terminal key-lock fallback exits from the prompt without keys', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, runSeed: 81_405 });
        const exitTile = baseRun.board!.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY)!;
        const board: BoardState = {
            ...baseRun.board!,
            dungeonExitTileId: exitTile.id,
            dungeonExitLockKind: 'iron',
            matchedPairs: baseRun.board!.pairCount,
            tiles: baseRun.board!.tiles.map((tile) =>
                tile.id === exitTile.id
                    ? {
                          ...tile,
                          state: 'flipped',
                          dungeonCardKind: 'exit',
                          dungeonCardState: 'revealed',
                          dungeonExitLockKind: 'iron'
                      }
                    : {
                          ...tile,
                          state: 'matched'
                      }
            )
        };
        useAppStore.setState({
            view: 'playing',
            run: {
                ...baseRun,
                board,
                status: 'playing',
                dungeonKeys: {},
                dungeonMasterKeys: 0
            },
            dungeonExitPromptOpen: true
        });

        useAppStore.getState().activateDungeonExitFromPrompt();

        expect(useAppStore.getState().run?.status).toBe('levelComplete');
        expect(useAppStore.getState().run?.dungeonKeys.iron ?? 0).toBe(0);
        expect(useAppStore.getState().run?.dungeonMasterKeys).toBe(0);
        expect(useAppStore.getState().run?.board?.dungeonExitActivated).toBe(true);
        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
    });

    it('clears stale in-run prompts and return modes when leaving or replacing a run', () => {
        useAppStore.setState({
            view: 'playing',
            run: createNewRun(0),
            dungeonExitPromptOpen: true,
            shopReturnMode: 'floor',
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });

        useAppStore.getState().goToMenu();

        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
        expect(useAppStore.getState().shopReturnMode).toBeNull();
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            dungeonExitPromptOpen: true,
            shopReturnMode: 'summary',
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().startRun();

        expect(useAppStore.getState().view).toBe('playing');
        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
        expect(useAppStore.getState().shopReturnMode).toBeNull();
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            dungeonExitPromptOpen: true,
            shopReturnMode: 'floor',
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().restartRun();

        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
        expect(useAppStore.getState().shopReturnMode).toBeNull();
        expect(useAppStore.getState().boardPinMode).toBe(false);
        expect(useAppStore.getState().destroyPairArmed).toBe(false);
        expect(useAppStore.getState().peekModeArmed).toBe(false);
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();

        useAppStore.setState({
            dungeonExitPromptOpen: true,
            shopReturnMode: 'summary',
            boardPinMode: true,
            destroyPairArmed: true,
            peekModeArmed: true,
            tileSwapArmed: true,
            tileSwapFirstTileId: 'stale-tile'
        });
        useAppStore.getState().startWildRun();

        expect(useAppStore.getState().dungeonExitPromptOpen).toBe(false);
        expect(useAppStore.getState().shopReturnMode).toBeNull();
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

    it('plays relic-pick cue when a relic choice is accepted', async () => {
        useAppStore.getState().startRun();
        const run = useAppStore.getState().run!;
        useAppStore.setState({
            run: {
                ...run,
                status: 'levelComplete',
                lastLevelResult: {
                    level: 1,
                    scoreGained: 120,
                    rating: 'S',
                    livesRemaining: run.lives,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'perfect',
                    clearLifeGained: 0
                },
                relicOffer: {
                    tier: 1,
                    options: ['extra_shuffle_charge'],
                    picksRemaining: 1,
                    pickRound: 0
                }
            }
        });

        useAppStore.getState().pickRelic('extra_shuffle_charge');
        expect(gameSfxMocks.resumeAudioContext).toHaveBeenCalled();
        expect(gameSfxMocks.playRelicPickSfx).toHaveBeenCalledTimes(1);
    });

    it('does not persist or play relic-pick feedback when a corrupted offer repeats an owned relic', () => {
        useAppStore.getState().startRun();
        const run = useAppStore.getState().run!;
        const saveBefore = useAppStore.getState().saveData;
        useAppStore.setState({
            run: {
                ...run,
                relicIds: ['extra_shuffle_charge'],
                relicOffer: {
                    tier: 1,
                    options: ['extra_shuffle_charge'],
                    picksRemaining: 1,
                    pickRound: 0
                }
            }
        });

        useAppStore.getState().pickRelic('extra_shuffle_charge');

        expect(useAppStore.getState().run?.relicIds).toEqual(['extra_shuffle_charge']);
        expect(useAppStore.getState().run?.relicOffer?.options).toEqual(['extra_shuffle_charge']);
        expect(useAppStore.getState().saveData).toBe(saveBefore);
        expect(gameSfxMocks.resumeAudioContext).not.toHaveBeenCalled();
        expect(gameSfxMocks.playRelicPickSfx).not.toHaveBeenCalled();
    });

    it('plays wager-arm cue when risk wager is accepted', () => {
        const run = useAppStore.getState().run;
        useAppStore.getState().startRun();
        const current = useAppStore.getState().run!;
        useAppStore.setState({
            run: {
                ...current,
                status: 'levelComplete',
                featuredObjectiveStreak: 2,
                lastLevelResult: {
                    level: 1,
                    scoreGained: 120,
                    rating: 'S++',
                    livesRemaining: 5,
                    perfect: true,
                    mistakes: 0,
                    clearLifeReason: 'perfect',
                    clearLifeGained: 1,
                    featuredObjectiveId: 'flip_par',
                    featuredObjectiveCompleted: true,
                    relicFavorGained: 1,
                    featuredObjectiveStreak: 2
                }
            }
        });

        useAppStore.getState().acceptEndlessRiskWager();
        expect(gameSfxMocks.resumeAudioContext).toHaveBeenCalled();
        expect(gameSfxMocks.playWagerArmSfx).toHaveBeenCalledTimes(1);
        expect(run).not.toBe(useAppStore.getState().run);
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
            const exitTile = run?.board?.tiles.find((tile) => tile.pairKey === '__exit__');
            if (exitTile && run?.status === 'playing') {
                useAppStore.getState().pressTile(exitTile.id);
                useAppStore.getState().activateDungeonExitFromPrompt('none');
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

    it('startScholarContractRun leaves shuffle, region shuffle, and tile swap as no-ops from store', async () => {
        useAppStore.getState().startScholarContractRun();
        notifyCurrentBoardReady();
        const started = useAppStore.getState().run;
        expect(started?.activeContract).toEqual({
            noShuffle: true,
            noDestroy: true,
            maxMismatches: null,
            bonusRelicDraftPick: true
        });

        const memorizeDuration = started?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        const run = useAppStore.getState().run;
        expect(run?.status).toBe('playing');

        const nonceBefore = run!.shuffleNonce;
        const tileIdsBefore = run!.board!.tiles.map((t) => t.id);

        useAppStore.getState().shuffleBoard();
        let after = useAppStore.getState().run;
        expect(after?.shuffleNonce).toBe(nonceBefore);
        expect(after?.board!.tiles.map((t) => t.id)).toEqual(tileIdsBefore);

        useAppStore.getState().shuffleRegionRow(0);
        after = useAppStore.getState().run;
        expect(after?.shuffleNonce).toBe(nonceBefore);
        expect(after?.board!.tiles.map((t) => t.id)).toEqual(tileIdsBefore);

        useAppStore.getState().toggleTileSwapArmed();
        after = useAppStore.getState().run;
        expect(useAppStore.getState().tileSwapArmed).toBe(false);
        expect(useAppStore.getState().tileSwapFirstTileId).toBeNull();
        expect(after?.shuffleNonce).toBe(nonceBefore);
        expect(after?.board!.tiles.map((t) => t.id)).toEqual(tileIdsBefore);
    });

    it('scholar contract blocks destroy arming even with banked charges', async () => {
        useAppStore.getState().startScholarContractRun();
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

    it('restartRun keeps scholar activeContract on the new run', async () => {
        useAppStore.getState().startScholarContractRun();
        notifyCurrentBoardReady();
        const memorizeDuration = useAppStore.getState().run?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);

        expect(useAppStore.getState().run?.activeContract).toEqual({
            noShuffle: true,
            noDestroy: true,
            maxMismatches: null,
            bonusRelicDraftPick: true
        });

        useAppStore.getState().restartRun();

        expect(useAppStore.getState().run?.activeContract).toEqual({
            noShuffle: true,
            noDestroy: true,
            maxMismatches: null,
            bonusRelicDraftPick: true
        });
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

    it('restartRun after Wild Run keeps wild menu run and joker mutator bundle', async () => {
        useAppStore.getState().startWildRun();
        notifyCurrentBoardReady();
        const started = useAppStore.getState().run;
        expect(started?.wildMenuRun).toBe(true);
        expect(started?.wildMatchesRemaining).toBeGreaterThanOrEqual(1);

        const memorizeDuration = started?.timerState.memorizeRemainingMs ?? 0;
        await vi.advanceTimersByTimeAsync(memorizeDuration + 1);
        expect(useAppStore.getState().run?.status).toBe('playing');

        useAppStore.getState().restartRun();

        const next = useAppStore.getState().run;
        expect(next?.wildMenuRun).toBe(true);
        expect(next?.wildMatchesRemaining).toBeGreaterThanOrEqual(1);
        expect(next?.activeMutators).toEqual(['sticky_fingers', 'short_memorize', 'findables_floor']);
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

    it('restartRun after Dungeon Showcase game over keeps the authored combat-room setup', () => {
        useAppStore.getState().startDungeonShowcaseRun();
        const started = useAppStore.getState().run;
        expect(started?.dungeonShowcaseRun).toBe(true);
        expect(started?.board?.level).toBe(5);

        useAppStore.setState({
            run: createRunSummary({ ...started!, status: 'gameOver', lives: 0 }, []),
            view: 'gameOver'
        });

        useAppStore.getState().restartRun();

        const next = useAppStore.getState().run;
        expect(next?.dungeonShowcaseRun).toBe(true);
        expect(next?.status).toBe('playing');
        expect(next?.practiceMode).toBe(true);
        expect(next?.board?.level).toBe(5);
        expect(next?.board?.enemyHazards?.length).toBeGreaterThan(0);
        expect(next?.board?.tiles.some((tile) => tile.dungeonCardKind === 'enemy')).toBe(true);
    });

    it('restartRun after Pin vow keeps maxPinsTotalRun contract', async () => {
        useAppStore.getState().startPinVowRun();
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
