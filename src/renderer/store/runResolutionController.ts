import { evaluateAchievementUnlocks } from '../../shared/achievements';
import type {
    AchievementId,
    AchievementUnlockResult,
    RunState,
    SaveData,
    Settings,
    ViewState
} from '../../shared/contracts';
import { createRunSummary } from '../../shared/game-core';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
import { runArrayCount } from '../../shared/run-array-guards';
import {
    mergeBestFloorNoPowers,
    mergeDailyComplete,
    mergeEncoreFromRun,
    mergePuzzleCompletion,
    normalizeSaveData
} from '../../shared/save-data';
import { disableDebugPeek } from '../../shared/run-timer-rules';
import { repairRunProgressionSoftlocks } from '../../shared/run-progression-repair';
import { resolveBoardTurn } from '../../shared/turn-resolution';
import { trackEvent } from '../../shared/telemetry';
import { playFloorClearSfx, playMatchPayoffSfx, playResolveSfx, resumeAudioContext } from '../audio/gameSfx';
import { ACHIEVEMENT_SYNC_FAILURE_NOTICE } from './achievementPersistence';
import { runPersistenceInBackground } from './backgroundPersistence';
import {
    BOARD_FLOATER_POP_CLEAR,
    buildMatchScorePopPayload,
    buildMismatchScorePopPayload,
    type MatchScorePop,
    type MismatchScorePop
} from './matchScorePop';

interface RunResolutionState {
    run: RunState | null;
    runStartSaveData: SaveData | null;
    saveData: SaveData;
}

type RunResolutionPatch = Partial<{
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
    tileSwapArmed: boolean;
    tileSwapFirstTileId: string | null;
    view: ViewState;
}>;

interface RunResolutionControllerOptions {
    getSfxGain: () => number;
    getState: () => RunResolutionState;
    persistSaveData: (saveData: SaveData) => Promise<SaveData>;
    persistSaveDataThenUnlockAchievements: (
        saveData: SaveData,
        achievements: AchievementId[]
    ) => Promise<{ failures: { id: AchievementId; result: AchievementUnlockResult }[] }>;
    runSurfaceReset: RunResolutionPatch;
    setState: (patch: RunResolutionPatch) => void;
}

interface RunResolutionController {
    applyImmediateGameOverFromTilePress: (resolvedRun: RunState) => void;
    applyResolveBoardTurn: (run: RunState) => void;
    applyResolvedRun: (resolvedRun: RunState) => void;
}

export const createRunResolutionController = ({
    getSfxGain,
    getState,
    persistSaveData,
    persistSaveDataThenUnlockAchievements,
    runSurfaceReset,
    setState
}: RunResolutionControllerOptions): RunResolutionController => {
    const applyResolvedRun = (resolvedRun: RunState): void => {
        resolvedRun = repairRunProgressionSoftlocks(resolvedRun);
        const state = getState();
        const prevStatus = state.run?.status;
        if (resolvedRun.status === 'levelComplete' && prevStatus !== 'levelComplete') {
            void resumeAudioContext();
            playFloorClearSfx(getSfxGain());
        }
        let nextRun = resolvedRun.status === 'playing' ? resolvedRun : disableDebugPeek(resolvedRun);

        let saveForAchievements = state.saveData;
        if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'daily' && nextRun.dailyDateKeyUtc) {
            saveForAchievements = mergeDailyComplete(state.saveData, nextRun.dailyDateKeyUtc);
        } else if (nextRun.status === 'gameOver') {
            let projected = mergeEncoreFromRun(state.saveData, nextRun.matchedPairKeysThisRun);
            if (!nextRun.powersUsedThisRun) {
                projected = mergeBestFloorNoPowers(projected, nextRun.stats.highestLevel);
            }
            saveForAchievements = projected;
        }

        const unlockedAchievements = evaluateAchievementUnlocks(nextRun, saveForAchievements);
        let nextSave = normalizeSaveData({
            ...state.saveData,
            bestScore: Math.max(state.saveData.bestScore, nextRun.stats.bestScore)
        });

        if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'daily' && nextRun.dailyDateKeyUtc) {
            nextSave = mergeDailyComplete(nextSave, nextRun.dailyDateKeyUtc);
        }

        if (nextRun.status === 'levelComplete' && !nextSave.onboardingDismissed) {
            nextSave = normalizeSaveData({
                ...nextSave,
                onboardingDismissed: true
            });
        }

        if (nextRun.status === 'levelComplete' && nextRun.gameMode === 'puzzle') {
            nextSave = mergePuzzleCompletion(nextSave, nextRun);
        }

        if (unlockedAchievements.length > 0) {
            const unlockTags = unlockedAchievements.map((id) => `achievement:${id}`);
            nextSave = normalizeSaveData({
                ...nextSave,
                achievements: {
                    ...nextSave.achievements,
                    ...Object.fromEntries(unlockedAchievements.map((achievementId) => [achievementId, true]))
                },
                unlocks: [...new Set([...(nextSave.unlocks ?? []), ...unlockTags])]
            });
        }

        if (nextRun.status === 'gameOver') {
            nextSave = mergeEncoreFromRun(nextSave, nextRun.matchedPairKeysThisRun);
            nextRun = createRunSummary(nextRun, unlockedAchievements);
            nextRun = {
                ...nextRun,
                lastRunSummary: normalizeSaveData({
                    ...nextSave,
                    lastRunSummary: nextRun.lastRunSummary
                }).lastRunSummary
            };
            if (!nextRun.powersUsedThisRun) {
                nextSave = mergeBestFloorNoPowers(nextSave, nextRun.stats.highestLevel);
            }
            nextSave = normalizeSaveData({
                ...nextSave,
                onboardingDismissed: true,
                lastRunSummary: nextRun.lastRunSummary
            });
            nextSave = mergeHonorUnlockTags(nextSave);

            const summary = nextRun.lastRunSummary;
            if (summary) {
                trackEvent('run_complete', {
                    mode: summary.gameMode ?? 'endless',
                    practice: nextRun.practiceMode,
                    highestLevel: summary.highestLevel,
                    totalScore: summary.totalScore,
                    mutatorCount: runArrayCount(summary.activeMutators),
                    relicCount: runArrayCount(summary.relicIds)
                });
            }

            setState({
                run: nextRun,
                runStartSaveData: state.runStartSaveData,
                view: 'gameOver',
                saveData: nextSave,
                settings: nextSave.settings,
                newlyUnlockedAchievements: unlockedAchievements,
                ...runSurfaceReset
            });
        } else {
            nextSave = mergeHonorUnlockTags(nextSave);
            setState({
                run: nextRun,
                view: 'playing',
                saveData: nextSave,
                settings: nextSave.settings,
                newlyUnlockedAchievements: unlockedAchievements,
                dungeonExitPromptOpen: false
            });
        }

        if (unlockedAchievements.length > 0) {
            runPersistenceInBackground(() =>
                persistSaveDataThenUnlockAchievements(nextSave, unlockedAchievements).then(({ failures }) => {
                    if (failures.length > 0) {
                        setState({
                            achievementBridgeNotice: ACHIEVEMENT_SYNC_FAILURE_NOTICE
                        });
                    }
                })
            );
        } else {
            runPersistenceInBackground(() => persistSaveData(nextSave));
        }
    };

    const applyResolveBoardTurn = (run: RunState): void => {
        const { saveData } = getState();
        const encore = saveData.playerStats?.encorePairKeysLastRun ?? [];
        const next = resolveBoardTurn(run, encore);
        const pop = buildMatchScorePopPayload(run, next);
        const missPop = buildMismatchScorePopPayload(run, next);
        if (pop) {
            setState({ ...BOARD_FLOATER_POP_CLEAR, matchScorePop: pop });
        } else if (missPop) {
            setState({ ...BOARD_FLOATER_POP_CLEAR, mismatchScorePop: missPop });
        } else {
            setState({ ...BOARD_FLOATER_POP_CLEAR });
        }
        void resumeAudioContext();
        const gain = getSfxGain();
        playResolveSfx(run, next, gain);
        if (pop) {
            playMatchPayoffSfx(gain, pop);
        }
        applyResolvedRun(next);
    };

    const applyImmediateGameOverFromTilePress = (resolvedRun: RunState): void => {
        applyResolvedRun(resolvedRun);
        setState({
            ...runSurfaceReset
        });
    };

    return {
        applyImmediateGameOverFromTilePress,
        applyResolveBoardTurn,
        applyResolvedRun
    };
};
