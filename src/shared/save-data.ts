import {
    MUTATOR_IDS,
    RESOLVE_DELAY_MULTIPLIER_MIN,
    SAVE_SCHEMA_VERSION,
    type AchievementId,
    type AchievementState,
    type GameMode,
    type MutatorId,
    type PlayerStatsPersisted,
    type RelicId,
    type RunSummary,
    type RunState,
    type SaveData,
    type Settings,
    type StartingLoadoutId
} from './contracts';
import { z } from 'zod';
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

type NumericSettingsKey =
    | 'masterVolume'
    | 'musicVolume'
    | 'sfxVolume'
    | 'uiScale'
    | 'resolveDelayMultiplier';

export const SETTINGS_NUMERIC_RANGES = {
    masterVolume: { min: 0, max: 1 },
    musicVolume: { min: 0, max: 1 },
    sfxVolume: { min: 0, max: 1 },
    uiScale: { min: 0.8, max: 1.4 },
    resolveDelayMultiplier: { min: RESOLVE_DELAY_MULTIPLIER_MIN, max: 2.5 }
} as const satisfies Record<NumericSettingsKey, { min: number; max: number }>;

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
const MUTATOR_ID_SET = new Set<MutatorId>(MUTATOR_IDS);
const GAME_MODE_SET = new Set<GameMode>(['endless', 'daily', 'puzzle', 'gauntlet', 'meditation']);
const STARTING_LOADOUT_ID_SET = new Set<StartingLoadoutId>([
    'memory_scout',
    'route_tactician',
    'cursebreaker',
    'vaultbreaker'
]);

const finiteNonNegativeInteger = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;

const finiteClampedNumber = (
    value: unknown,
    fallback: number,
    range: { readonly min: number; readonly max: number }
): number =>
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(range.max, Math.max(range.min, value))
        : fallback;

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

const normalizeStringLedger = (input: unknown, limit: number): string[] => {
    if (!Array.isArray(input)) {
        return [];
    }
    return [...new Set(input.filter((value): value is string => typeof value === 'string'))].slice(0, limit);
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
        ? [
              ...new Set(
                  source.activeMutators.filter(
                      (value): value is MutatorId =>
                          typeof value === 'string' && MUTATOR_ID_SET.has(value as MutatorId)
                  )
              )
          ]
        : undefined;
    const relicIds = Array.isArray(source.relicIds)
        ? [...new Set(source.relicIds.filter((value): value is RelicId => RELIC_ID_SET.has(value as RelicId)))]
        : undefined;
    const startingLoadoutId = STARTING_LOADOUT_ID_SET.has(source.startingLoadoutId as StartingLoadoutId)
        ? (source.startingLoadoutId as StartingLoadoutId)
        : source.startingLoadoutId === null
          ? null
          : undefined;
    const payoffPickupClaimed =
        source.payoffPickupClaimed === undefined ? undefined : finiteNonNegativeInteger(source.payoffPickupClaimed, Number.NaN);
    const payoffPickupTotal =
        source.payoffPickupTotal === undefined ? undefined : finiteNonNegativeInteger(source.payoffPickupTotal, Number.NaN);
    const payoffPressureExtra =
        source.payoffPressureExtra === undefined ? undefined : finiteNonNegativeInteger(source.payoffPressureExtra, Number.NaN);
    const payoffRewardPerkCount =
        source.payoffRewardPerkCount === undefined ? undefined : finiteNonNegativeInteger(source.payoffRewardPerkCount, Number.NaN);

    return {
        totalScore,
        bestScore,
        levelsCleared,
        highestLevel,
        achievementsEnabled: source.achievementsEnabled === true,
        unlockedAchievements: Array.isArray(source.unlockedAchievements)
            ? [...new Set(source.unlockedAchievements.filter((id): id is AchievementId => ACHIEVEMENT_IDS.includes(id as AchievementId)))]
            : [],
        bestStreak,
        perfectClears,
        ...(Number.isFinite(runSeed) ? { runSeed } : {}),
        ...(Number.isFinite(runRulesVersion) ? { runRulesVersion } : {}),
        ...(gameMode ? { gameMode } : {}),
        ...(typeof source.dailyDateKeyUtc === 'string' ? { dailyDateKeyUtc: source.dailyDateKeyUtc } : {}),
        ...(activeMutators ? { activeMutators } : {}),
        ...(relicIds ? { relicIds } : {}),
        ...(Number.isFinite(payoffPickupClaimed) ? { payoffPickupClaimed } : {}),
        ...(Number.isFinite(payoffPickupTotal) ? { payoffPickupTotal } : {}),
        ...(Number.isFinite(payoffPressureExtra) ? { payoffPressureExtra } : {}),
        ...(Number.isFinite(payoffRewardPerkCount) ? { payoffRewardPerkCount } : {}),
        ...(typeof source.payoffRoutePaid === 'boolean' ? { payoffRoutePaid: source.payoffRoutePaid } : {}),
        ...(typeof source.payoffRouteRewardText === 'string' || source.payoffRouteRewardText === null
            ? { payoffRouteRewardText: source.payoffRouteRewardText }
            : {}),
        ...(startingLoadoutId !== undefined ? { startingLoadoutId } : {}),
        ...(typeof source.practiceMode === 'boolean' ? { practiceMode: source.practiceMode } : {}),
        ...(typeof source.wildMenuRun === 'boolean' ? { wildMenuRun: source.wildMenuRun } : {}),
        ...(typeof source.dungeonShowcaseRun === 'boolean' ? { dungeonShowcaseRun: source.dungeonShowcaseRun } : {})
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
    firstRunHelpDismissed: false,
    lastRunSummary: null,
    playerStats: defaultPlayerStats(),
    unlocks: [],
    powersFtueSeen: false
});

const objectBoundarySchema = z.object({}).passthrough();
const unknownRecordBoundarySchema = z.preprocess(
    (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : undefined,
    z.record(z.string(), z.unknown()).optional()
);

export const settingsBoundarySchema = z.object({
    boardBloomEnabled: z.unknown().optional(),
    boardPresentation: z.unknown().optional(),
    boardScreenSpaceAA: z.unknown().optional(),
    cameraViewportModePreference: z.unknown().optional(),
    debugFlags: unknownRecordBoundarySchema,
    displayMode: z.unknown().optional(),
    distractionChannelEnabled: z.unknown().optional(),
    echoFeedbackEnabled: z.unknown().optional(),
    graphicsQuality: z.unknown().optional(),
    masterVolume: z.unknown().optional(),
    musicVolume: z.unknown().optional(),
    pairProximityHintsEnabled: z.unknown().optional(),
    reduceMotion: z.unknown().optional(),
    resolveDelayMultiplier: z.unknown().optional(),
    sfxVolume: z.unknown().optional(),
    shuffleScoreTaxEnabled: z.unknown().optional(),
    tileFocusAssist: z.unknown().optional(),
    uiScale: z.unknown().optional(),
    weakerShuffleMode: z.unknown().optional()
});

type SettingsBoundary = z.output<typeof settingsBoundarySchema>;

export const saveDataBoundarySchema = objectBoundarySchema.extend({
    achievements: unknownRecordBoundarySchema,
    bestScore: z.unknown().optional(),
    firstRunHelpDismissed: z.unknown().optional(),
    lastRunSummary: z.unknown().optional(),
    onboardingDismissed: z.unknown().optional(),
    playerStats: unknownRecordBoundarySchema,
    powersFtueSeen: z.unknown().optional(),
    schemaVersion: z.unknown().optional(),
    settings: z.preprocess(
        (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : undefined,
        settingsBoundarySchema.optional()
    ),
    unlocks: z.unknown().optional()
});

type SaveDataNormalizationInput = {
    schemaVersion?: unknown;
    bestScore?: unknown;
    achievements?: unknown;
    settings?: SettingsBoundary | Partial<Settings>;
    onboardingDismissed?: unknown;
    firstRunHelpDismissed?: unknown;
    lastRunSummary?: unknown;
    playerStats?: unknown;
    unlocks?: unknown;
    powersFtueSeen?: unknown;
};

const normalizeSettings = (input?: SettingsBoundary | Partial<Settings>): Settings => {
    const source = input ?? {};
    const debugFlags =
        source.debugFlags && typeof source.debugFlags === 'object' && !Array.isArray(source.debugFlags)
            ? (source.debugFlags as Record<string, unknown>)
            : {};
    const boardScreenSpaceAA = source.boardScreenSpaceAA;
    const graphicsQuality = source.graphicsQuality;
    const cameraViewportModePreference = source.cameraViewportModePreference;
    const displayMode = source.displayMode;
    const weakerShuffleMode = source.weakerShuffleMode;
    const boardPresentation = source.boardPresentation;

    return {
        masterVolume: finiteClampedNumber(
            source.masterVolume,
            DEFAULT_SETTINGS.masterVolume,
            SETTINGS_NUMERIC_RANGES.masterVolume
        ),
        musicVolume: finiteClampedNumber(
            source.musicVolume,
            DEFAULT_SETTINGS.musicVolume,
            SETTINGS_NUMERIC_RANGES.musicVolume
        ),
        sfxVolume: finiteClampedNumber(
            source.sfxVolume,
            DEFAULT_SETTINGS.sfxVolume,
            SETTINGS_NUMERIC_RANGES.sfxVolume
        ),
        displayMode:
            displayMode === 'windowed' || displayMode === 'fullscreen' ? displayMode : DEFAULT_SETTINGS.displayMode,
        uiScale: finiteClampedNumber(source.uiScale, DEFAULT_SETTINGS.uiScale, SETTINGS_NUMERIC_RANGES.uiScale),
        reduceMotion: typeof source.reduceMotion === 'boolean' ? source.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
        graphicsQuality:
            graphicsQuality === 'low' || graphicsQuality === 'medium' || graphicsQuality === 'high'
                ? graphicsQuality
                : DEFAULT_SETTINGS.graphicsQuality,
        boardScreenSpaceAA:
            boardScreenSpaceAA === 'auto' ||
            boardScreenSpaceAA === 'smaa' ||
            boardScreenSpaceAA === 'msaa' ||
            boardScreenSpaceAA === 'off'
                ? boardScreenSpaceAA
                : DEFAULT_SETTINGS.boardScreenSpaceAA,
        boardBloomEnabled:
            typeof source.boardBloomEnabled === 'boolean'
                ? source.boardBloomEnabled
                : DEFAULT_SETTINGS.boardBloomEnabled,
        debugFlags: {
            showDebugTools:
                typeof debugFlags.showDebugTools === 'boolean'
                    ? debugFlags.showDebugTools
                    : DEFAULT_SETTINGS.debugFlags.showDebugTools,
            allowBoardReveal:
                typeof debugFlags.allowBoardReveal === 'boolean'
                    ? debugFlags.allowBoardReveal
                    : DEFAULT_SETTINGS.debugFlags.allowBoardReveal,
            disableAchievementsOnDebug:
                typeof debugFlags.disableAchievementsOnDebug === 'boolean'
                    ? debugFlags.disableAchievementsOnDebug
                    : DEFAULT_SETTINGS.debugFlags.disableAchievementsOnDebug
        },
        boardPresentation:
            boardPresentation === 'standard' || boardPresentation === 'spaghetti' || boardPresentation === 'breathing'
                ? boardPresentation
                : DEFAULT_SETTINGS.boardPresentation,
        cameraViewportModePreference:
            cameraViewportModePreference === 'auto' ||
            cameraViewportModePreference === 'always' ||
            cameraViewportModePreference === 'never'
                ? cameraViewportModePreference
                : DEFAULT_SETTINGS.cameraViewportModePreference,
        tileFocusAssist:
            typeof source.tileFocusAssist === 'boolean' ? source.tileFocusAssist : DEFAULT_SETTINGS.tileFocusAssist,
        resolveDelayMultiplier: finiteClampedNumber(
            source.resolveDelayMultiplier,
            DEFAULT_SETTINGS.resolveDelayMultiplier,
            SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier
        ),
        weakerShuffleMode:
            weakerShuffleMode === 'full' || weakerShuffleMode === 'rows_only'
                ? weakerShuffleMode
                : DEFAULT_SETTINGS.weakerShuffleMode,
        echoFeedbackEnabled:
            typeof source.echoFeedbackEnabled === 'boolean'
                ? source.echoFeedbackEnabled
                : DEFAULT_SETTINGS.echoFeedbackEnabled,
        distractionChannelEnabled:
            typeof source.distractionChannelEnabled === 'boolean'
                ? source.distractionChannelEnabled
                : DEFAULT_SETTINGS.distractionChannelEnabled,
        shuffleScoreTaxEnabled:
            typeof source.shuffleScoreTaxEnabled === 'boolean'
                ? source.shuffleScoreTaxEnabled
                : DEFAULT_SETTINGS.shuffleScoreTaxEnabled,
        pairProximityHintsEnabled:
            typeof source.pairProximityHintsEnabled === 'boolean'
                ? source.pairProximityHintsEnabled
                : DEFAULT_SETTINGS.pairProximityHintsEnabled
    };
};

export const normalizeUnknownSaveData = (input: unknown): SaveData => {
    const parsed = saveDataBoundarySchema.safeParse(input);
    return normalizeSaveData(parsed.success ? parsed.data : null);
};

export const normalizeUnknownSettings = (input: unknown): Settings => {
    const parsed = settingsBoundarySchema.safeParse(input);
    return normalizeSettings(parsed.success ? parsed.data : undefined);
};

export const normalizeSaveData = (input?: SaveDataNormalizationInput | null): SaveData => {
    const defaults = createDefaultSaveData();

    if (!input) {
        return defaults;
    }
    const migrationGate = evaluateSaveMigrationGate(input);

    const mergedAchievements = normalizeAchievements(input.achievements);
    const playerStatsDefaults = defaultPlayerStats();
    const psIn =
        input.playerStats && typeof input.playerStats === 'object' && !Array.isArray(input.playerStats)
            ? (input.playerStats as Record<string, unknown>)
            : {};
    const dailiesCount = finiteNonNegativeInteger(psIn.dailiesCompleted, playerStatsDefaults.dailiesCompleted);
    const relicPickCounts = normalizeRelicPickCounts(psIn.relicPickCounts);
    const relicShrineExtraPickUnlocked = psIn.relicShrineExtraPickUnlocked === true;
    const lastRunSummary =
        migrationGate.keepLastRunSummary ? normalizeLastRunSummary(input.lastRunSummary) : defaults.lastRunSummary;

    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: finiteNonNegativeInteger(input.bestScore, defaults.bestScore),
        achievements: mergedAchievements,
        settings: normalizeSettings(input.settings),
        onboardingDismissed: typeof input.onboardingDismissed === 'boolean' ? input.onboardingDismissed : defaults.onboardingDismissed,
        firstRunHelpDismissed:
            typeof input.firstRunHelpDismissed === 'boolean' ? input.firstRunHelpDismissed : defaults.firstRunHelpDismissed,
        lastRunSummary,
        playerStats: {
            bestFloorNoPowers: finiteNonNegativeInteger(psIn.bestFloorNoPowers, playerStatsDefaults.bestFloorNoPowers),
            dailiesCompleted: dailiesCount,
            lastDailyDateKeyUtc: stringOrNull(psIn.lastDailyDateKeyUtc, playerStatsDefaults.lastDailyDateKeyUtc),
            dailyStreakCosmetic: finiteNonNegativeInteger(
                psIn.dailyStreakCosmetic,
                playerStatsDefaults.dailyStreakCosmetic
            ),
            encorePairKeysLastRun: Array.isArray(psIn.encorePairKeysLastRun)
                ? normalizeStringLedger(psIn.encorePairKeysLastRun, 80)
                : playerStatsDefaults.encorePairKeysLastRun,
            puzzleCompletions: normalizePuzzleCompletions(psIn.puzzleCompletions),
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
            relicShrineExtraPickUnlocked: ps.relicShrineExtraPickUnlocked === true
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
