import { describe, expect, it, vi } from 'vitest';
import type { AchievementId, RunState, SaveData, Settings, ViewState } from '../../shared/contracts';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import type { MatchScorePop, MismatchScorePop } from './matchScorePop';
import { createRunResolutionController } from './runResolutionController';

const gameSfxMocks = vi.hoisted(() => ({
    playFloorClearSfx: vi.fn(),
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
    shopReturnMode: null
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

    it('turns game-over runs into summaries, resets run surface state, and tracks completion', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        Object.assign(harness.state, {
            boardPinMode: true,
            destroyPairArmed: true,
            dungeonExitPromptOpen: true,
            peekModeArmed: true,
            shopReturnMode: 'floor' as const
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
        expect(harness.state.saveData.bestScore).toBe(500);
        expect(harness.state.boardPinMode).toBe(false);
        expect(harness.state.destroyPairArmed).toBe(false);
        expect(harness.state.dungeonExitPromptOpen).toBe(false);
        expect(harness.state.peekModeArmed).toBe(false);
        expect(harness.state.shopReturnMode).toBeNull();
        expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
            'run_complete',
            expect.objectContaining({ highestLevel: 3, totalScore: 500 })
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

    it('applies immediate game-over reset after resolved-run processing', () => {
        const baseRun = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless' });
        const harness = createHarness(baseRun);
        Object.assign(harness.state, {
            boardPinMode: true,
            dungeonExitPromptOpen: true,
            peekModeArmed: true
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
        expect(harness.patches.at(-1)).toEqual(runSurfaceReset);
    });
});
