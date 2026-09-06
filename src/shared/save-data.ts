import {
    MUTATOR_IDS,
    RESOLVE_DELAY_MULTIPLIER_MIN,
    SAVE_SCHEMA_VERSION,
    type AchievementId,
    type AchievementState,
    type ContractFlags,
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
import type { ChainTier } from './chain-tier-rules';
import { COSMETIC_IDS } from './cosmetic-ids';
import { HONOR_UNLOCK_IDS } from './honor-unlock-ids';
import { utcDateKeyMinusOneDay } from './rng';
import { runArray, runFilteredArray } from './run-array-guards';
import { isRunRecord } from './run-record-guards';
import { normalizeRunHistory } from './run-history-log';
import { runFiniteNumberOrFallback, runNonNegativeIntegerOrFallback } from './run-number-guards';
import { RELIC_POOL } from './relics';
import { normalizeSessionStats } from './session-stats-rules';
import { evaluateSaveMigrationGate, isRecognizedSaveSchemaVersion } from './version-gate';
import { normalizeGameplayJournalSnapshot } from './gameplay-journal';

export type DailyStreakFreezePolicy = 'one_grace_day';

export interface DailyStreakEthicsState {
    currentStreak: number;
    nextResetUtcKey: string;
    missedDayBehavior: 'reset_to_one_on_next_completion' | 'forgiven_by_grace_day' | 'no_clear_recorded_yet';
    /** Whether the one grace day is unspent right now. */
    graceAvailable: boolean;
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

const DISPLAY_MODE_VALUES = ['windowed', 'fullscreen'] as const satisfies readonly Settings['displayMode'][];
const GRAPHICS_QUALITY_VALUES = ['low', 'medium', 'high'] as const satisfies readonly Settings['graphicsQuality'][];
const BOARD_SCREEN_SPACE_AA_VALUES = ['auto', 'smaa', 'msaa', 'off'] as const satisfies readonly Settings['boardScreenSpaceAA'][];
const BOARD_PRESENTATION_VALUES = ['standard', 'spaghetti', 'breathing'] as const satisfies readonly Settings['boardPresentation'][];
const CAMERA_VIEWPORT_MODE_PREFERENCE_VALUES = [
    'auto',
    'always',
    'never'
] as const satisfies readonly Settings['cameraViewportModePreference'][];
const WEAKER_SHUFFLE_MODE_VALUES = ['full', 'rows_only'] as const satisfies readonly Settings['weakerShuffleMode'][];

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

export const ACHIEVEMENT_IDS = [
    'ACH_FIRST_CLEAR',
    'ACH_LEVEL_FIVE',
    'ACH_SCORE_THOUSAND',
    'ACH_PERFECT_CLEAR',
    'ACH_LAST_LIFE',
    'ACH_ENDLESS_TEN',
    'ACH_SEVEN_DAILIES',
    'ACH_WARDEN_FELLED',
    'ACH_ENDLESS_CYCLE',
    'ACH_ENDLESS_TWENTY',
    'ACH_SCORE_TEN_THOUSAND',
    'ACH_STREAK_TEN',
    'ACH_TRAIT_SCHOLAR',
    'ACH_RELIC_HOARD',
    'ACH_STANDING_ORDERS',
    'ACH_RELIC_LIBRARY',
    'ACH_NO_POWERS_TEN',
    'ACH_GAUNTLET_RUN',
    'ACH_PUZZLE_SOLVER',
    'ACH_MEDITATION_HOUR',
    'ACH_FIRST_FEVER',
    'ACH_CHUNK_SIX',
    'ACH_EXTREME_FEVER',
    'ACH_WARDEN_BY_CHUNK'
] as const satisfies readonly AchievementId[];

export const createAchievementState = (): AchievementState =>
    ACHIEVEMENT_IDS.reduce<AchievementState>(
        (state, achievementId) => {
            state[achievementId] = false;
            return state;
        },
        {} as AchievementState
    );

const createPuzzleCompletionMap = (): NonNullable<PlayerStatsPersisted['puzzleCompletions']> => Object.create(null);

const defaultPlayerStats = (): PlayerStatsPersisted => ({
    bestFloorNoPowers: 0,
    dailiesCompleted: 0,
    lastDailyDateKeyUtc: null,
    dailyStreakCosmetic: 0,
    dailyStreakGraceAvailable: true,
    relicPickCounts: {},
    encorePairKeysLastRun: [],
    puzzleCompletions: createPuzzleCompletionMap(),
    relicShrineExtraPickUnlocked: false,
    sharpFloors: 0,
    feverFloors: 0
});

const ACHIEVEMENT_ID_SET: ReadonlySet<string> = new Set(ACHIEVEMENT_IDS);
/*
 * Read RELIC_POOL when a save is first validated, not while this module is evaluating.
 *
 * `relics` reaches this file through nine hops - trait-build-rewards, tile-trait-rules,
 * bonus-rewards, gameplay-core, board-turn-event-facts, turn-resolution, game and
 * run-summary-rules - so any entry point that loads `relics` first used to evaluate this
 * module before that one finished and die on `Cannot access 'RELIC_POOL' before
 * initialization`. The renderer only survived because it happened to enter the graph
 * somewhere else; a script, a test or a new chunk order did not.
 */
let relicIdSet: ReadonlySet<string> | null = null;

const getRelicIdSet = (): ReadonlySet<string> => {
    relicIdSet ??= new Set<string>(RELIC_POOL);
    return relicIdSet;
};
const MUTATOR_ID_SET: ReadonlySet<string> = new Set(MUTATOR_IDS);
const GAME_MODE_SET: ReadonlySet<string> = new Set(['endless', 'daily', 'puzzle', 'gauntlet', 'meditation']);
const STARTING_LOADOUT_ID_SET: ReadonlySet<string> = new Set([
    'memory_scout',
    'route_tactician',
    'cursebreaker',
    'vaultbreaker'
]);
const VALID_UNLOCK_TAG_SET: ReadonlySet<string> = new Set([
    ...ACHIEVEMENT_IDS.map((id) => `achievement:${id}`),
    ...COSMETIC_IDS.map((id) => `cosmetic:${id}`),
    ...HONOR_UNLOCK_IDS.map((id) => `honor:${id}`)
]);

const PERSISTED_COLLECTION_LIMITS = {
    encorePairKeys: 80,
    entryTextLength: 128,
    inspectedEntries: 1024,
    puzzleCompletions: 256,
    unlockTags: 128
} as const;
const PERSISTED_SUMMARY_TEXT_LIMIT = 256;

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
    isRunRecord(value);

const isAchievementId = (value: unknown): value is AchievementId =>
    typeof value === 'string' && ACHIEVEMENT_ID_SET.has(value);

const isGameMode = (value: unknown): value is GameMode =>
    typeof value === 'string' && GAME_MODE_SET.has(value);

const isMutatorId = (value: unknown): value is MutatorId =>
    typeof value === 'string' && MUTATOR_ID_SET.has(value);

const isRelicId = (value: unknown): value is RelicId =>
    typeof value === 'string' && getRelicIdSet().has(value);

const isStartingLoadoutId = (value: unknown): value is StartingLoadoutId =>
    typeof value === 'string' && STARTING_LOADOUT_ID_SET.has(value);

const finiteNonNegativeInteger = runNonNegativeIntegerOrFallback;

const finiteClampedNumber = (
    value: unknown,
    fallback: number,
    range: { readonly min: number; readonly max: number }
): number =>
    Math.min(range.max, Math.max(range.min, runFiniteNumberOrFallback(value, fallback)));

const normalizeDailyDateKeyUtc = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const compact = /^\d{8}$/.test(value) ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll('-', '') : null;
    if (!compact) {
        return null;
    }
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6)) - 1;
    const day = Number(compact.slice(6, 8));
    const date = new Date(Date.UTC(year, month, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? compact : null;
};

const normalizeAchievements = (input: unknown): AchievementState => {
    const out = createAchievementState();
    if (!isUnknownRecord(input)) {
        return out;
    }
    for (const id of ACHIEVEMENT_IDS) {
        out[id] = input[id] === true;
    }
    return out;
};

export interface RelicPickCountRow {
    id: RelicId;
    count: number;
}

export const getRelicPickCountRows = (input: unknown): RelicPickCountRow[] => {
    const counts = isUnknownRecord(input) ? input : {};
    return RELIC_POOL.map((id) => ({
        id,
        count: finiteNonNegativeInteger(counts[id], 0)
    }));
};

export const getRelicPickTotal = (input: unknown): number =>
    getRelicPickCountRows(input).reduce((sum, row) => sum + row.count, 0);

const normalizeRelicPickCounts = (input: unknown): PlayerStatsPersisted['relicPickCounts'] => {
    const out: PlayerStatsPersisted['relicPickCounts'] = {};
    for (const { id, count } of getRelicPickCountRows(input)) {
        if (count > 0) {
            out[id] = count;
        }
    }
    return out;
};

const normalizePuzzleCompletions = (input: unknown): NonNullable<PlayerStatsPersisted['puzzleCompletions']> => {
    if (!isUnknownRecord(input)) {
        return createPuzzleCompletionMap();
    }
    const out = createPuzzleCompletionMap();
    let inspected = 0;
    let retained = 0;
    for (const id in input) {
        if (!Object.prototype.hasOwnProperty.call(input, id)) {
            continue;
        }
        if (
            inspected >= PERSISTED_COLLECTION_LIMITS.inspectedEntries ||
            retained >= PERSISTED_COLLECTION_LIMITS.puzzleCompletions
        ) {
            break;
        }
        inspected += 1;
        const value = input[id];
        if (id.length === 0 || id.length > PERSISTED_COLLECTION_LIMITS.entryTextLength || !isUnknownRecord(value)) {
            continue;
        }
        if (value.completed !== true) {
            continue;
        }
        const bestMistakes =
            value.bestMistakes === null ? null : finiteNonNegativeInteger(value.bestMistakes, Number.NaN);
        const bestScore = finiteNonNegativeInteger(value.bestScore, Number.NaN);
        if ((bestMistakes !== null && !Number.isFinite(bestMistakes)) || !Number.isFinite(bestScore)) {
            continue;
        }
        out[id] = {
            completed: true,
            bestMistakes,
            bestScore
        };
        retained += 1;
    }
    return out;
};

const normalizeUnlocks = (input: unknown): string[] => {
    const out = new Set<string>();
    for (const value of runArray<unknown>(input).slice(0, PERSISTED_COLLECTION_LIMITS.inspectedEntries)) {
        if (
            typeof value === 'string' &&
            value.length <= PERSISTED_COLLECTION_LIMITS.entryTextLength &&
            VALID_UNLOCK_TAG_SET.has(value)
        ) {
            out.add(value);
            if (out.size >= PERSISTED_COLLECTION_LIMITS.unlockTags) {
                break;
            }
        }
    }
    return [...out];
};

const normalizeStringLedger = (input: unknown, limit: number): string[] => {
    const out = new Set<string>();
    for (const value of runArray<unknown>(input).slice(0, PERSISTED_COLLECTION_LIMITS.inspectedEntries)) {
        if (
            typeof value === 'string' &&
            value.length > 0 &&
            value.length <= PERSISTED_COLLECTION_LIMITS.entryTextLength
        ) {
            out.add(value);
            if (out.size >= limit) {
                break;
            }
        }
    }
    return [...out];
};

const normalizeContractFlags = (input: unknown): ContractFlags | null => {
    if (
        !isUnknownRecord(input) ||
        typeof input.noShuffle !== 'boolean' ||
        typeof input.noDestroy !== 'boolean' ||
        (input.maxMismatches !== null &&
            (typeof input.maxMismatches !== 'number' || !Number.isFinite(input.maxMismatches)))
    ) {
        return null;
    }
    if (
        input.maxPinsTotalRun !== undefined &&
        input.maxPinsTotalRun !== null &&
        (typeof input.maxPinsTotalRun !== 'number' || !Number.isFinite(input.maxPinsTotalRun))
    ) {
        return null;
    }
    return {
        noShuffle: input.noShuffle,
        noDestroy: input.noDestroy,
        maxMismatches:
            input.maxMismatches === null ? null : finiteNonNegativeInteger(input.maxMismatches, 0),
        ...(input.maxPinsTotalRun === null
            ? { maxPinsTotalRun: null }
            : typeof input.maxPinsTotalRun === 'number'
              ? { maxPinsTotalRun: finiteNonNegativeInteger(input.maxPinsTotalRun, 0) }
              : {}),
        ...(typeof input.bonusRelicDraftPick === 'boolean'
            ? { bonusRelicDraftPick: input.bonusRelicDraftPick }
            : {})
    };
};

export const normalizeRunSummary = (input: unknown): RunSummary | null => {
    if (!isUnknownRecord(input)) {
        return null;
    }
    const source = input;
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
    const gameMode = isGameMode(source.gameMode) ? source.gameMode : undefined;
    const dailyDateKeyUtc = normalizeDailyDateKeyUtc(source.dailyDateKeyUtc);
    const activeContract = normalizeContractFlags(source.activeContract);
    const activeMutators = Array.isArray(source.activeMutators)
        ? [...new Set(runFilteredArray(source.activeMutators, isMutatorId))]
        : undefined;
    const relicIds = Array.isArray(source.relicIds)
        ? [...new Set(runFilteredArray(source.relicIds, isRelicId))]
        : undefined;
    const startingLoadoutId = isStartingLoadoutId(source.startingLoadoutId)
        ? source.startingLoadoutId
        : source.startingLoadoutId === null
          ? null
          : undefined;
    const payoffPickupClaimedRaw =
        source.payoffPickupClaimed === undefined ? undefined : finiteNonNegativeInteger(source.payoffPickupClaimed, Number.NaN);
    const payoffPickupTotal =
        source.payoffPickupTotal === undefined ? undefined : finiteNonNegativeInteger(source.payoffPickupTotal, Number.NaN);
    const payoffPickupClaimed =
        typeof payoffPickupClaimedRaw === 'number' &&
        typeof payoffPickupTotal === 'number' &&
        Number.isFinite(payoffPickupClaimedRaw) &&
        Number.isFinite(payoffPickupTotal)
            ? Math.min(payoffPickupClaimedRaw, payoffPickupTotal)
            : payoffPickupClaimedRaw;
    const payoffPressureExtra =
        source.payoffPressureExtra === undefined ? undefined : finiteNonNegativeInteger(source.payoffPressureExtra, Number.NaN);
    const payoffRewardPerkCount =
        source.payoffRewardPerkCount === undefined ? undefined : finiteNonNegativeInteger(source.payoffRewardPerkCount, Number.NaN);
    const payoffRouteRewardText =
        typeof source.payoffRouteRewardText === 'string'
            ? source.payoffRouteRewardText.slice(0, PERSISTED_SUMMARY_TEXT_LIMIT)
            : source.payoffRouteRewardText === null
              ? null
              : undefined;
    const gameplayJournal = normalizeGameplayJournalSnapshot({
        gameplayCommandJournal: source.gameplayCommandJournal,
        gameplayEventJournal: source.gameplayEventJournal
    });
    // The chain's records are optional counters: absent on a summary from before the cascade,
    // kept when they read as whole numbers, dropped rather than rejected otherwise.
    const chainRecord = (value: unknown): number | undefined =>
        value === undefined ? undefined : finiteNonNegativeInteger(value, Number.NaN);
    const biggestChunk = chainRecord(source.biggestChunk);
    const bestChain = chainRecord(source.bestChain);
    const sharpFloors = chainRecord(source.sharpFloors);
    const feverFloors = chainRecord(source.feverFloors);

    return {
        totalScore,
        bestScore,
        levelsCleared,
        highestLevel,
        achievementsEnabled: source.achievementsEnabled === true,
        unlockedAchievements: Array.isArray(source.unlockedAchievements)
            ? [...new Set(source.unlockedAchievements.filter(isAchievementId))]
            : [],
        bestStreak,
        perfectClears,
        ...(Number.isFinite(biggestChunk) ? { biggestChunk } : {}),
        ...(Number.isFinite(bestChain) ? { bestChain } : {}),
        ...(Number.isFinite(sharpFloors) ? { sharpFloors } : {}),
        ...(Number.isFinite(feverFloors) ? { feverFloors } : {}),
        ...(Number.isFinite(runSeed) ? { runSeed } : {}),
        ...(Number.isFinite(runRulesVersion) ? { runRulesVersion } : {}),
        ...(gameMode ? { gameMode } : {}),
        ...(dailyDateKeyUtc ? { dailyDateKeyUtc } : {}),
        ...(activeMutators ? { activeMutators } : {}),
        ...(relicIds ? { relicIds } : {}),
        ...(Number.isFinite(payoffPickupClaimed) ? { payoffPickupClaimed } : {}),
        ...(Number.isFinite(payoffPickupTotal) ? { payoffPickupTotal } : {}),
        ...(Number.isFinite(payoffPressureExtra) ? { payoffPressureExtra } : {}),
        ...(Number.isFinite(payoffRewardPerkCount) ? { payoffRewardPerkCount } : {}),
        ...(typeof source.payoffRoutePaid === 'boolean' ? { payoffRoutePaid: source.payoffRoutePaid } : {}),
        ...(payoffRouteRewardText !== undefined ? { payoffRouteRewardText } : {}),
        ...(startingLoadoutId !== undefined ? { startingLoadoutId } : {}),
        ...(typeof source.practiceMode === 'boolean' ? { practiceMode: source.practiceMode } : {}),
        ...(typeof source.wildMenuRun === 'boolean' ? { wildMenuRun: source.wildMenuRun } : {}),
        ...(typeof source.dungeonShowcaseRun === 'boolean' ? { dungeonShowcaseRun: source.dungeonShowcaseRun } : {}),
        ...(source.activeContract === null
            ? { activeContract: null }
            : activeContract
              ? { activeContract }
              : {}),
        ...(gameplayJournal.commands.length > 0
            ? { gameplayCommandJournal: gameplayJournal.commands }
            : {}),
        ...(gameplayJournal.events.length > 0
            ? { gameplayEventJournal: gameplayJournal.events }
            : {})
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
    runHistory: [],
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
    runHistory: z.unknown().optional(),
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

const SETTINGS_BOUNDARY_KEYS: readonly string[] = settingsBoundarySchema.keyof().options;
const SAVE_DATA_BOUNDARY_KEYS: readonly string[] = saveDataBoundarySchema.keyof().options;

const hasRecognizedOwnField = (input: unknown, keys: readonly string[]): boolean =>
    isUnknownRecord(input) && keys.some((key) => Object.prototype.hasOwnProperty.call(input, key));

type SaveDataNormalizationInput = {
    schemaVersion?: unknown;
    bestScore?: unknown;
    achievements?: unknown;
    settings?: SettingsBoundary | Partial<Settings>;
    onboardingDismissed?: unknown;
    firstRunHelpDismissed?: unknown;
    lastRunSummary?: unknown;
    runHistory?: unknown;
    playerStats?: unknown;
    unlocks?: unknown;
    powersFtueSeen?: unknown;
};

const normalizeSettings = (input?: SettingsBoundary | Partial<Settings>): Settings => {
    const source = input ?? {};
    const debugFlags = isUnknownRecord(source.debugFlags) ? source.debugFlags : {};
    const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
        typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

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
        displayMode: oneOf(source.displayMode, DISPLAY_MODE_VALUES, DEFAULT_SETTINGS.displayMode),
        uiScale: finiteClampedNumber(source.uiScale, DEFAULT_SETTINGS.uiScale, SETTINGS_NUMERIC_RANGES.uiScale),
        reduceMotion: typeof source.reduceMotion === 'boolean' ? source.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
        graphicsQuality: oneOf(source.graphicsQuality, GRAPHICS_QUALITY_VALUES, DEFAULT_SETTINGS.graphicsQuality),
        boardScreenSpaceAA: oneOf(
            source.boardScreenSpaceAA,
            BOARD_SCREEN_SPACE_AA_VALUES,
            DEFAULT_SETTINGS.boardScreenSpaceAA
        ),
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
        boardPresentation: oneOf(source.boardPresentation, BOARD_PRESENTATION_VALUES, DEFAULT_SETTINGS.boardPresentation),
        cameraViewportModePreference: oneOf(
            source.cameraViewportModePreference,
            CAMERA_VIEWPORT_MODE_PREFERENCE_VALUES,
            DEFAULT_SETTINGS.cameraViewportModePreference
        ),
        tileFocusAssist:
            typeof source.tileFocusAssist === 'boolean' ? source.tileFocusAssist : DEFAULT_SETTINGS.tileFocusAssist,
        resolveDelayMultiplier: finiteClampedNumber(
            source.resolveDelayMultiplier,
            DEFAULT_SETTINGS.resolveDelayMultiplier,
            SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier
        ),
        weakerShuffleMode: oneOf(
            source.weakerShuffleMode,
            WEAKER_SHUFFLE_MODE_VALUES,
            DEFAULT_SETTINGS.weakerShuffleMode
        ),
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

export const normalizeUnknownSaveDataOrThrow = (input: unknown): SaveData => {
    const parsed = saveDataBoundarySchema.safeParse(input);
    if (!parsed.success || !hasRecognizedOwnField(input, SAVE_DATA_BOUNDARY_KEYS)) {
        throw new TypeError('Save data must be an object with at least one recognized field.');
    }
    if (
        isRecognizedSaveSchemaVersion(parsed.data.schemaVersion) &&
        parsed.data.schemaVersion > SAVE_SCHEMA_VERSION
    ) {
        throw new TypeError('Save data uses a newer unsupported schema version.');
    }
    return normalizeSaveData(parsed.data);
};

export const normalizeUnknownSettings = (input: unknown): Settings => {
    const parsed = settingsBoundarySchema.safeParse(input);
    return normalizeSettings(parsed.success ? parsed.data : undefined);
};

export const normalizeUnknownSettingsOrThrow = (input: unknown): Settings => {
    const parsed = settingsBoundarySchema.safeParse(input);
    if (!parsed.success || !hasRecognizedOwnField(input, SETTINGS_BOUNDARY_KEYS)) {
        throw new TypeError('Settings must be an object with at least one recognized field.');
    }
    return normalizeSettings(parsed.data);
};

export const normalizeSaveData = (input?: SaveDataNormalizationInput | null): SaveData => {
    const defaults = createDefaultSaveData();

    if (!input) {
        return defaults;
    }
    const migrationGate = evaluateSaveMigrationGate(input);

    const mergedAchievements = normalizeAchievements(input.achievements);
    const playerStatsDefaults = defaultPlayerStats();
    const psIn = isUnknownRecord(input.playerStats) ? input.playerStats : {};
    const dailiesCount = finiteNonNegativeInteger(psIn.dailiesCompleted, playerStatsDefaults.dailiesCompleted);
    const relicPickCounts = normalizeRelicPickCounts(psIn.relicPickCounts);
    const relicShrineExtraPickUnlocked = psIn.relicShrineExtraPickUnlocked === true;
    const lastRunSummary =
        migrationGate.keepLastRunSummary ? normalizeRunSummary(input.lastRunSummary) : defaults.lastRunSummary;

    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        bestScore: finiteNonNegativeInteger(input.bestScore, defaults.bestScore),
        achievements: mergedAchievements,
        settings: normalizeSettings(input.settings),
        onboardingDismissed: typeof input.onboardingDismissed === 'boolean' ? input.onboardingDismissed : defaults.onboardingDismissed,
        firstRunHelpDismissed:
            typeof input.firstRunHelpDismissed === 'boolean' ? input.firstRunHelpDismissed : defaults.firstRunHelpDismissed,
        lastRunSummary,
        /*
         * A history is a convenience, never a reason to reject a profile: an entry this build
         * cannot read is dropped and the rest of the save loads. `keepLastRunSummary` gates it
         * for the same reason it gates the summary — a migration that invalidates one invalidates
         * the other.
         */
        runHistory: migrationGate.keepLastRunSummary ? normalizeRunHistory(input.runHistory) : [],
        playerStats: {
            bestFloorNoPowers: finiteNonNegativeInteger(psIn.bestFloorNoPowers, playerStatsDefaults.bestFloorNoPowers),
            dailiesCompleted: dailiesCount,
            lastDailyDateKeyUtc: normalizeDailyDateKeyUtc(psIn.lastDailyDateKeyUtc),
            dailyStreakGraceAvailable:
                typeof psIn.dailyStreakGraceAvailable === 'boolean' ? psIn.dailyStreakGraceAvailable : true,
            dailyStreakCosmetic: finiteNonNegativeInteger(
                psIn.dailyStreakCosmetic,
                playerStatsDefaults.dailyStreakCosmetic
            ),
            encorePairKeysLastRun: Array.isArray(psIn.encorePairKeysLastRun)
                ? normalizeStringLedger(psIn.encorePairKeysLastRun, PERSISTED_COLLECTION_LIMITS.encorePairKeys)
                : playerStatsDefaults.encorePairKeysLastRun,
            puzzleCompletions: normalizePuzzleCompletions(psIn.puzzleCompletions),
            relicPickCounts,
            relicShrineExtraPickUnlocked,
            sharpFloors: finiteNonNegativeInteger(psIn.sharpFloors, 0),
            feverFloors: finiteNonNegativeInteger(psIn.feverFloors, 0)
        },
        unlocks: normalizeUnlocks(input.unlocks),
        powersFtueSeen: typeof input.powersFtueSeen === 'boolean' ? input.powersFtueSeen : defaults.powersFtueSeen ?? false
    };
};

/**
 * Where a daily clear leaves the streak, and the grace day.
 *
 * The project's own research says a daily streak should carry small rewards and forgive a miss,
 * and this one did not: one skipped UTC day dropped it straight back to 1, which is the pressure
 * the design notes set out to avoid. So a single gap is forgiven while the grace day is unspent,
 * and a clear on a consecutive day earns it back — a real miss costs nothing, and clearing every
 * other day still cannot hold a streak open forever, because the grace never refills that way.
 */
export const resolveDailyStreak = ({
    completedDateKeyUtc,
    graceAvailable,
    previousDateKeyUtc,
    streak
}: {
    completedDateKeyUtc: string;
    graceAvailable: boolean;
    previousDateKeyUtc: string | null;
    streak: number;
}): { streak: number; graceAvailable: boolean; usedGrace: boolean } => {
    const yesterday = utcDateKeyMinusOneDay(completedDateKeyUtc);
    if (previousDateKeyUtc === yesterday) {
        return { streak: streak + 1, graceAvailable: true, usedGrace: false };
    }
    if (graceAvailable && previousDateKeyUtc !== null && previousDateKeyUtc === utcDateKeyMinusOneDay(yesterday)) {
        return { streak: streak + 1, graceAvailable: false, usedGrace: true };
    }
    // A longer gap, or a gap with the grace already spent: start again, with the grace restored.
    return { streak: 1, graceAvailable: true, usedGrace: false };
};

export const mergeDailyComplete = (save: SaveData, completedDateKeyUtc: string): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    if (ps.lastDailyDateKeyUtc === completedDateKeyUtc) {
        return save;
    }
    const prev = ps.lastDailyDateKeyUtc;
    const next = resolveDailyStreak({
        completedDateKeyUtc,
        graceAvailable: ps.dailyStreakGraceAvailable !== false,
        previousDateKeyUtc: prev,
        streak: ps.dailyStreakCosmetic
    });
    const newDailies = ps.dailiesCompleted + 1;

    return normalizeSaveData({
        ...save,
        playerStats: {
            ...ps,
            dailiesCompleted: newDailies,
            lastDailyDateKeyUtc: completedDateKeyUtc,
            dailyStreakCosmetic: next.streak,
            dailyStreakGraceAvailable: next.graceAvailable,
            relicShrineExtraPickUnlocked: ps.relicShrineExtraPickUnlocked === true
        }
    });
};

/**
 * A cleared floor's chain record, folded into the profile: one Sharp floor when the chain reached
 * Sharp or better, one Fever floor when it reached Fever. Called once per clear; a floor whose
 * chain stayed below Sharp leaves the save untouched.
 */
export const mergeChainFloorStats = (save: SaveData, floorChainTier: ChainTier): SaveData => {
    if (floorChainTier !== 'sharp' && floorChainTier !== 'fever') {
        return save;
    }
    const ps = save.playerStats ?? defaultPlayerStats();
    return normalizeSaveData({
        ...save,
        playerStats: {
            ...ps,
            sharpFloors: runNonNegativeIntegerOrFallback(ps.sharpFloors, 0) + 1,
            feverFloors: runNonNegativeIntegerOrFallback(ps.feverFloors, 0) + (floorChainTier === 'fever' ? 1 : 0)
        }
    });
};

export const getDailyStreakEthicsState = (save: SaveData, todayDateKeyUtc: string): DailyStreakEthicsState => {
    const ps = save.playerStats ?? defaultPlayerStats();
    const alreadyCompletedToday = ps.lastDailyDateKeyUtc === todayDateKeyUtc;
    const continuedFromYesterday = ps.lastDailyDateKeyUtc === utcDateKeyMinusOneDay(todayDateKeyUtc);
    const noClearYet = ps.lastDailyDateKeyUtc == null || ps.dailiesCompleted <= 0;
    const graceAvailable = ps.dailyStreakGraceAvailable !== false;
    // One day back from yesterday: the gap the grace day covers.
    const withinGrace = ps.lastDailyDateKeyUtc === utcDateKeyMinusOneDay(utcDateKeyMinusOneDay(todayDateKeyUtc));
    const missedDayBehavior: DailyStreakEthicsState['missedDayBehavior'] =
        noClearYet || alreadyCompletedToday || continuedFromYesterday
            ? 'no_clear_recorded_yet'
            : withinGrace && graceAvailable
              ? 'forgiven_by_grace_day'
              : 'reset_to_one_on_next_completion';

    return {
        currentStreak: ps.dailyStreakCosmetic,
        nextResetUtcKey: todayDateKeyUtc,
        missedDayBehavior,
        graceAvailable,
        freezePolicy: 'one_grace_day',
        rewardLimit: 'cosmetic_and_meta_only',
        tone: 'friendly_no_shame',
        copy:
            missedDayBehavior === 'forgiven_by_grace_day'
                ? 'You missed a day, and the streak is holding. Clear today and it carries on.'
                : missedDayBehavior === 'reset_to_one_on_next_completion'
                  ? 'The streak starts again on your next clear. No core run fairness is lost.'
                  : graceAvailable
                    ? 'Optional local motivation. One missed day is forgiven; clear before the UTC reset to extend it.'
                    : 'Optional local motivation. The grace day is spent — a clear on a consecutive day earns it back.'
    };
};

export const mergePuzzleCompletion = (save: SaveData, run: RunState): SaveData => {
    if (run.gameMode !== 'puzzle' || !run.puzzleId || run.status !== 'levelComplete') {
        return save;
    }

    const ps = save.playerStats ?? defaultPlayerStats();
    const completions = ps.puzzleCompletions ?? {};
    const existing = completions[run.puzzleId];
    const stats = normalizeSessionStats(run.stats);
    const mistakes = finiteNonNegativeInteger(run.lastLevelResult?.mistakes ?? stats.tries, 0);
    const score = stats.totalScore;
    const existingBestMistakes =
        existing?.bestMistakes == null ? null : finiteNonNegativeInteger(existing.bestMistakes, mistakes);
    const existingBestScore = finiteNonNegativeInteger(existing?.bestScore, 0);

    return normalizeSaveData({
        ...save,
        playerStats: {
            ...ps,
            puzzleCompletions: {
                ...completions,
                [run.puzzleId]: {
                    completed: true,
                    bestMistakes:
                        existingBestMistakes == null
                            ? mistakes
                            : Math.min(existingBestMistakes, mistakes),
                    bestScore: Math.max(existingBestScore, score)
                }
            }
        }
    });
};

export const mergeBestFloorNoPowers = (save: SaveData, floor: number): SaveData => {
    const ps = save.playerStats ?? defaultPlayerStats();
    const nextFloor = finiteNonNegativeInteger(floor, 0);
    const bestFloorNoPowers = finiteNonNegativeInteger(ps.bestFloorNoPowers, 0);
    if (nextFloor <= bestFloorNoPowers) {
        return save;
    }
    return normalizeSaveData({
        ...save,
        playerStats: { ...ps, bestFloorNoPowers: nextFloor }
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
        [relicId]: finiteNonNegativeInteger(ps.relicPickCounts[relicId], 0) + 1
    };
    return normalizeSaveData({
        ...save,
        playerStats: { ...ps, relicPickCounts }
    });
};
