import {
    SAVE_SCHEMA_VERSION,
    type AchievementId,
    type AchievementState,
    type BoardPresentationMode,
    type BoardScreenSpaceAA,
    type CameraViewportModePreference,
    type DisplayMode,
    type GameMode,
    type GraphicsQualityPreset,
    type MutatorId,
    type PlayerStatsPersisted,
    type RelicId,
    type RunSummary,
    type RunState,
    type SaveData,
    type Settings,
    type WeakerShuffleMode
} from './contracts';
import { utcDateKeyMinusOneDay } from './rng';
import { RELIC_POOL } from './relics';
import { evaluateSaveMigrationGate } from './version-gate';

export type DailyStreakFreezePolicy = 'not_supported';

export interface DailyStreakEthicsState {
    currentStreak: number;
    nextResetUtcKey: string;
    missedDayBehavior: 'reset_to_one_on_next_completion' | 'no_clear_recorded_yet';
    freezePolicy: DailyStreakFreezePolicy;
    rewardLimit: 'cosmetic_and_meta_only';
    tone: 'friendly_no_shame';
    copy: string;
}

export const DEFAULT_SETTINGS: Settings = {
    masterVolume: 0.8,
    musicVolume: 0.55,
    sfxVolume: 0.8,
    displayMode: 'windowed',
    uiScale: 1,
    reduceMotion: false,
    graphicsQuality: 'medium',
    boardScreenSpaceAA: 'auto',
    boardBloomEnabled: false,
    debugFlags: {
        showDebugTools: false,
        allowBoardReveal: false,
        disableAchievementsOnDebug: true
    },
    boardPresentation: 'standard',
    cameraViewportModePreference: 'auto',
    tileFocusAssist: false,
    resolveDelayMultiplier: 1,
    weakerShuffleMode: 'full',
    echoFeedbackEnabled: true,
    distractionChannelEnabled: false,
    shuffleScoreTaxEnabled: false,
    pairProximityHintsEnabled: true
};

export const ACHIEVEMENT_IDS: AchievementId[] = [
    'ACH_FIRST_CLEAR',
    'ACH_LEVEL_FIVE',
    'ACH_SCORE_THOUSAND',
    'ACH_PERFECT_CLEAR',
    'ACH_LAST_LIFE',
    'ACH_ENDLESS_TEN',
    'ACH_SEVEN_DAILIES'
];

export const createAchievementState = (): AchievementState =>
    ACHIEVEMENT_IDS.reduce<AchievementState>(
        (state, achievementId) => {
            state[achievementId] = false;
            return state;
        },
        {} as AchievementState
    );

const defaultPlayerStats = (): PlayerStatsPersisted => ({
    bestFloorNoPowers: 0,
    dailiesCompleted: 0,
    lastDailyDateKeyUtc: null,
    dailyStreakCosmetic: 0,
    relicPickCounts: {},
    encorePairKeysLastRun: [],
    puzzleCompletions: {},
    relicShrineExtraPickUnlocked: false
});

const RELIC_ID_SET = new Set<RelicId>(RELIC_POOL);
const GAME_MODE_SET = new Set<GameMode>(['endless', 'daily', 'puzzle', 'gauntlet', 'meditation']);

const finiteNonNegativeInteger = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

const finiteNonNegativeNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;

const stringOrNull = (value: unknown, fallback: string | null): string | null =>
    typeof value === 'string' ? value : value === null ? null : fallback;

const normalizeAchievements = (input: unknown): AchievementState => {
    const out = createAchievementState();
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return out;
    }
    const source = input as Partial<Record<AchievementId, unknown>>;
    for (const id of ACHIEVEMENT_IDS) {
        out[id] = source[id] === true;
    }
    return out;
};

const normalizeRelicPickCounts = (input: unknown): PlayerStatsPersisted['relicPickCounts'] => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }
    const out: PlayerStatsPersisted['relicPickCounts'] = {};
    for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
        if (RELIC_ID_SET.has(id as RelicId)) {
            const count = finiteNonNegativeInteger(value, 0);
            if (count > 0) {
                out[id as RelicId] = count;
            }
        }
    }
    return out;
};

const normalizePuzzleCompletions = (input: unknown): NonNullable<PlayerStatsPersisted['puzzleCompletions']> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {};
    }
    const out: NonNullable<PlayerStatsPersisted['puzzleCompletions']> = {};
    for (const [id, value] of Object.entries(input as Record<string, unknown>)) {
        if (typeof id !== 'string' || id.length === 0 || !value || typeof value !== 'object' || Array.isArray(value)) {
            continue;
        }
        const record = value as Record<string, unknown>;
        if (record.completed !== true) {
            continue;
        }
        const bestMistakes =
            record.bestMistakes === null ? null : finiteNonNegativeInteger(record.bestMistakes, Number.NaN);
        const bestScore = finiteNonNegativeInteger(record.bestScore, Number.NaN);
        if ((bestMistakes !== null && !Number.isFinite(bestMistakes)) || !Number.isFinite(bestScore)) {
            continue;
        }
        out[id] = {
            completed: true,
            bestMistakes,
            bestScore
        };
    }
    return out;
};

const normalizeUnlocks = (input: unknown): string[] => {
    if (!Array.isArray(input)) {
        return [];
    }
    const allowedPrefixes = ['achievement:', 'cosmetic:', 'honor:'];
    return [...new Set(input)]
        .filter((value): value is string => typeof value === 'string')
        .filter((value) => allowedPrefixes.some((prefix) => value.startsWith(prefix)));
};

const normalizeLastRunSummary = (input: unknown): RunSummary | null => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return null;
    }
    const source = input as Record<string, unknown>;
    const totalScore = finiteNonNegativeInteger(source.totalScore, Number.NaN);
    const bestScore = finiteNonNegativeInteger(source.bestScore, Number.NaN);
    const levelsCleared = finiteNonNegativeInteger(source.levelsCleared, Number.NaN);
    const highestLevel = finiteNonNegativeInteger(source.highestLevel, Number.NaN);
    const bestStreak = finiteNonNegativeInteger(source.bestStreak, Number.NaN);
    const perfectClears = finiteNonNegativeInteger(source.perfectClears, Number.NaN);
    if ([totalScore, bestScore, levelsCleared, highestLevel, bestStreak, perfectClears].some((value) => !Number.isFinite(value))) {
        return null;
    }

    const runSeed = source.runSeed === undefined ? undefined : finiteNonNegativeInteger(source.runSeed, Number.NaN);
    const runRulesVersion =
        source.runRulesVersion === undefined ? undefined : finiteNonNegativeInteger(source.runRulesVersion, Number.NaN);
    const gameMode = GAME_MODE_SET.has(source.gameMode as GameMode) ? (source.gameMode as GameMode) : undefined;
    const activeMutators = Array.isArray(source.activeMutators)
        ? source.activeMutators.filter((value): value is MutatorId => typeof value === 'string')
        : undefined;
    const relicIds = Array.isArray(source.relicIds)
        ? source.relicIds.filter((value): value is RelicId => RELIC_ID_SET.has(value as RelicId))
        : undefined;

    return {
        totalScore,
        bestScore,
        levelsCleared,
        highestLevel,
        achievementsEnabled: source.achievementsEnabled === true,
        unlockedAchievements: Array.isArray(source.unlockedAchievements)
            ? source.unlockedAchievements.filter((id): id is AchievementId => ACHIEVEMENT_IDS.includes(id as AchievementId))
            : [],
        bestStreak,
        perfectClears,
        ...(Number.isFinite(runSeed) ? { runSeed } : {}),
        ...(Number.isFinite(runRulesVersion) ? { runRulesVersion } : {}),
        ...(gameMode ? { gameMode } : {}),
        ...(typeof source.dailyDateKeyUtc === 'string' ? { dailyDateKeyUtc: source.dailyDateKeyUtc } : {}),
        ...(activeMutators ? { activeMutators } : {}),
        ...(relicIds ? { relicIds } : {}),
        ...(typeof source.practiceMode === 'boolean' ? { practiceMode: source.practiceMode } : {}),
        ...(typeof source.wildMenuRun === 'boolean' ? { wildMenuRun: source.wildMenuRun } : {})
    };
};

/** +1 relic pick at each milestone when meta unlock is active (copied into `RunState.metaRelicDraftExtraPerMilestone`). */
export const metaRelicDraftExtraPerMilestoneFromSave = (save: SaveData): number =>
    save.playerStats?.relicShrineExtraPickUnlocked === true ? 1 : 0;

export const createDefaultSaveData = (): SaveData => ({
    schemaVersion: SAVE_SCHEMA_VERSION,
    bestScore: 0,
    achievements: createAchievementState(),
    settings: { ...DEFAULT_SETTINGS, debugFlags: { ...DEFAULT_SETTINGS.debugFlags } },
    onboardingDismissed: false,
    lastRunSummary: null,
    playerStats: defaultPlayerStats(),
    unlocks: [],
    powersFtueSeen: false
});

export const normalizeSaveData = (input?: Partial<SaveData> | null): SaveData => {
    const defaults = createDefaultSaveData();

    if (!input) {
        return defaults;
    }
    const migrationGate = evaluateSaveMigrationGate(input);

    const mergedSettingsBase: Settings = {
        ...defaults.settings,
        ...(input.settings ?? {}),
        debugFlags: {
            ...defaults.settings.debugFlags,
            ...(input.settings?.debugFlags ?? {})
        }
    };
    const aaRaw = mergedSettingsBase.boardScreenSpaceAA as BoardScreenSpaceAA | undefined;
    const boardScreenSpaceAA: BoardScreenSpaceAA =
        aaRaw === 'auto' || aaRaw === 'smaa' || aaRaw === 'msaa' || aaRaw === 'off' ? aaRaw : defaults.settings.boardScreenSpaceAA;
    const gqRaw = mergedSettingsBase.graphicsQuality as GraphicsQualityPreset | undefined;
    const graphicsQuality: GraphicsQualityPreset =
        gqRaw === 'low' || gqRaw === 'medium' || gqRaw === 'high' ? gqRaw : defaults.settings.graphicsQuality;
    const boardBloomEnabled =
        typeof mergedSettingsBase.boardBloomEnabled === 'boolean'
            ? mergedSettingsBase.boardBloomEnabled
            : defaults.settings.boardBloomEnabled;
    const pairProximityHintsEnabled =
        typeof mergedSettingsBase.pairProximityHintsEnabled === 'boolean'
            ? mergedSettingsBase.pairProximityHintsEnabled
            : defaults.settings.pairProximityHintsEnabled;
    const cvRaw = mergedSettingsBase.cameraViewportModePreference as CameraViewportModePreference | undefined;
    const cameraViewportModePreference: CameraViewportModePreference =
        cvRaw === 'auto' || cvRaw === 'always' || cvRaw === 'never'
            ? cvRaw
            : defaults.settings.cameraViewportModePreference;
    const displayModeRaw = mergedSettingsBase.displayMode as DisplayMode | undefined;
    const displayMode: DisplayMode =
        displayModeRaw === 'windowed' || displayModeRaw === 'fullscreen'
            ? displayModeRaw
            : defaults.settings.displayMode;
    const weakerShuffleRaw = mergedSettingsBase.weakerShuffleMode as WeakerShuffleMode | undefined;
    const weakerShuffleMode: WeakerShuffleMode =
        weakerShuffleRaw === 'full' || weakerShuffleRaw === 'rows_only'
            ? weakerShuffleRaw
            : defaults.settings.weakerShuffleMode;
    const boardPresentationRaw = mergedSettingsBase.boardPresentation as BoardPresentationMode | undefined;
    const boardPresentation: BoardPresentationMode =
        boardPresentationRaw === 'standard' || boardPresentationRaw === 'spaghetti' || boardPresentationRaw === 'breathing'
            ? boardPresentationRaw
            : defaults.settings.boardPresentation;

    const mergedAchievements = normalizeAchievements(input.achievements);
    const psIn: Partial<PlayerStatsPersisted> = input.playerStats ?? {};
    const dailiesCount = finiteNonNegativeInteger(psIn.dailiesCompleted, defaultPlayerStats().dailiesCompleted);
    const relicPickCounts = normalizeRelicPickCounts(psIn.relicPickCounts);
    const relicShrineExtraPickUnlocked =
        psIn.relicShrineExtraPickUnlocked === true ||
        mergedAchievements.ACH_SEVEN_DAILIES === true ||
        dailiesCount >= 7;
    const lastRunSummary =
        migrationGate.keepLastRunSummary ? normalizeLastRunSummary(input.lastRunSummary) : defaults.lastRunSummary;

    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: finiteNonNegativeInteger(input.bestScore, defaults.bestScore),
        achievements: mergedAchievements,
        settings: {
            ...mergedSettingsBase,
            masterVolume: finiteNonNegativeNumber(mergedSettingsBase.masterVolume, defaults.settings.masterVolume),
            musicVolume: finiteNonNegativeNumber(mergedSettingsBase.musicVolume, defaults.settings.musicVolume),
            sfxVolume: finiteNonNegativeNumber(mergedSettingsBase.sfxVolume, defaults.settings.sfxVolume),
            uiScale: finiteNonNegativeNumber(mergedSettingsBase.uiScale, defaults.settings.uiScale),
            resolveDelayMultiplier: finiteNonNegativeNumber(
                mergedSettingsBase.resolveDelayMultiplier,
                defaults.settings.resolveDelayMultiplier
            ),
            reduceMotion:
                typeof mergedSettingsBase.reduceMotion === 'boolean'
                    ? mergedSettingsBase.reduceMotion
                    : defaults.settings.reduceMotion,
            boardScreenSpaceAA,
            boardBloomEnabled,
            graphicsQuality,
            cameraViewportModePreference,
            pairProximityHintsEnabled,
            displayMode,
            weakerShuffleMode,
            boardPresentation,
            tileFocusAssist:
                typeof mergedSettingsBase.tileFocusAssist === 'boolean'
                    ? mergedSettingsBase.tileFocusAssist
                    : defaults.settings.tileFocusAssist,
            echoFeedbackEnabled:
                typeof mergedSettingsBase.echoFeedbackEnabled === 'boolean'
                    ? mergedSettingsBase.echoFeedbackEnabled
                    : defaults.settings.echoFeedbackEnabled,
            distractionChannelEnabled:
                typeof mergedSettingsBase.distractionChannelEnabled === 'boolean'
                    ? mergedSettingsBase.distractionChannelEnabled
                    : defaults.settings.distractionChannelEnabled,
            shuffleScoreTaxEnabled:
                typeof mergedSettingsBase.shuffleScoreTaxEnabled === 'boolean'
                    ? mergedSettingsBase.shuffleScoreTaxEnabled
                    : defaults.settings.shuffleScoreTaxEnabled,
            debugFlags: {
                showDebugTools:
                    typeof mergedSettingsBase.debugFlags.showDebugTools === 'boolean'
                        ? mergedSettingsBase.debugFlags.showDebugTools
                        : defaults.settings.debugFlags.showDebugTools,
                allowBoardReveal:
                    typeof mergedSettingsBase.debugFlags.allowBoardReveal === 'boolean'
                        ? mergedSettingsBase.debugFlags.allowBoardReveal
                        : defaults.settings.debugFlags.allowBoardReveal,
                disableAchievementsOnDebug:
                    typeof mergedSettingsBase.debugFlags.disableAchievementsOnDebug === 'boolean'
                        ? mergedSettingsBase.debugFlags.disableAchievementsOnDebug
                        : defaults.settings.debugFlags.disableAchievementsOnDebug
            }
        },
        onboardingDismissed: typeof input.onboardingDismissed === 'boolean' ? input.onboardingDismissed : defaults.onboardingDismissed,
        lastRunSummary,
        playerStats: {
            ...defaultPlayerStats(),
            ...(input.playerStats ?? {}),
            bestFloorNoPowers: finiteNonNegativeInteger(psIn.bestFloorNoPowers, defaultPlayerStats().bestFloorNoPowers),
            dailiesCompleted: dailiesCount,
            lastDailyDateKeyUtc: stringOrNull(psIn.lastDailyDateKeyUtc, defaultPlayerStats().lastDailyDateKeyUtc),
            dailyStreakCosmetic: finiteNonNegativeInteger(
                psIn.dailyStreakCosmetic,
                defaultPlayerStats().dailyStreakCosmetic
            ),
            encorePairKeysLastRun: Array.isArray(input.playerStats?.encorePairKeysLastRun)
                ? input.playerStats.encorePairKeysLastRun.filter((value): value is string => typeof value === 'string')
                : defaultPlayerStats().encorePairKeysLastRun,
            puzzleCompletions: normalizePuzzleCompletions(input.playerStats?.puzzleCompletions),
            relicPickCounts,
            relicShrineExtraPickUnlocked
        },
        unlocks: normalizeUnlocks(input.unlocks),
        powersFtueSeen: typeof input.powersFtueSeen === 'boolean' ? input.powersFtueSeen : defaults.powersFtueSeen ?? false
    };
};

export const mergeDailyComplete = (save: SaveData, completedDateKeyUtc: string): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    if (ps.lastDailyDateKeyUtc === completedDateKeyUtc) {
        return save;
    }
    const prev = ps.lastDailyDateKeyUtc;
    const streak =
        prev === utcDateKeyMinusOneDay(completedDateKeyUtc) ? ps.dailyStreakCosmetic + 1 : 1;
    const newDailies = ps.dailiesCompleted + 1;

    return normalizeSaveData({
        ...save,
        playerStats: {
            ...ps,
            dailiesCompleted: newDailies,
            lastDailyDateKeyUtc: completedDateKeyUtc,
            dailyStreakCosmetic: streak,
            relicShrineExtraPickUnlocked: newDailies >= 7 || ps.relicShrineExtraPickUnlocked === true
        }
    });
};

export const getDailyStreakEthicsState = (save: SaveData, todayDateKeyUtc: string): DailyStreakEthicsState => {
    const ps = save.playerStats ?? defaultPlayerStats();
    const alreadyCompletedToday = ps.lastDailyDateKeyUtc === todayDateKeyUtc;
    const continuedFromYesterday = ps.lastDailyDateKeyUtc === utcDateKeyMinusOneDay(todayDateKeyUtc);
    const noClearYet = ps.lastDailyDateKeyUtc == null || ps.dailiesCompleted <= 0;
    const missedDayBehavior: DailyStreakEthicsState['missedDayBehavior'] =
        noClearYet || alreadyCompletedToday || continuedFromYesterday
            ? 'no_clear_recorded_yet'
            : 'reset_to_one_on_next_completion';

    return {
        currentStreak: ps.dailyStreakCosmetic,
        nextResetUtcKey: todayDateKeyUtc,
        missedDayBehavior,
        freezePolicy: 'not_supported',
        rewardLimit: 'cosmetic_and_meta_only',
        tone: 'friendly_no_shame',
        copy:
            missedDayBehavior === 'reset_to_one_on_next_completion'
                ? 'Missed days simply reset the cosmetic streak on the next clear. No core run fairness is lost.'
                : 'Daily streaks are optional local motivation. Clear today before UTC reset if you want to extend it.'
    };
};

export const mergePuzzleCompletion = (save: SaveData, run: RunState): SaveData => {
    if (run.gameMode !== 'puzzle' || !run.puzzleId || run.status !== 'levelComplete') {
        return save;
    }

    const ps = save.playerStats ?? defaultPlayerStats();
    const completions = ps.puzzleCompletions ?? {};
    const existing = completions[run.puzzleId];
    const mistakes = run.lastLevelResult?.mistakes ?? run.stats.tries;
    const score = run.stats.totalScore;

    return normalizeSaveData({
        ...save,
        playerStats: {
            ...ps,
            puzzleCompletions: {
                ...completions,
                [run.puzzleId]: {
                    completed: true,
                    bestMistakes:
                        existing?.bestMistakes == null
                            ? mistakes
                            : Math.min(existing.bestMistakes, mistakes),
                    bestScore: Math.max(existing?.bestScore ?? 0, score)
                }
            }
        }
    });
};

export const mergeBestFloorNoPowers = (save: SaveData, floor: number): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    if (floor <= ps.bestFloorNoPowers) {
        return save;
    }
    return normalizeSaveData({
        ...save,
        playerStats: { ...ps, bestFloorNoPowers: floor }
    });
};

export const mergeEncoreFromRun = (save: SaveData, pairKeys: string[]): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    const unique = [...new Set(pairKeys)].slice(0, 80);
    return normalizeSaveData({
        ...save,
        playerStats: { ...ps, encorePairKeysLastRun: unique }
    });
};

export const mergeRelicPickStat = (save: SaveData, relicId: RelicId): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    const relicPickCounts: PlayerStatsPersisted['relicPickCounts'] = {
        ...ps.relicPickCounts,
        [relicId]: (ps.relicPickCounts[relicId] ?? 0) + 1
    };
    return normalizeSaveData({
        ...save,
        playerStats: { ...ps, relicPickCounts }
    });
};
