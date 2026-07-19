import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, SAVE_SCHEMA_VERSION } from './contracts';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import {
    DUNGEON_SAVE_MIGRATION_POLICY_VERSION,
    getDungeonSaveMigrationFieldPolicies,
    shouldDungeonSaveFieldRequireMigration
} from './dungeon-save-migration';
import { createNewRun, createPuzzleRun } from './game-core';
import {
    createAchievementState,
    createDefaultSaveData,
    DEFAULT_SETTINGS,
    mergeDailyComplete,
    mergePuzzleCompletion,
    normalizeSaveData,
    normalizeUnknownSaveData,
    normalizeUnknownSettings,
    saveDataBoundarySchema,
    settingsBoundarySchema,
    SETTINGS_NUMERIC_RANGES
} from './save-data';
import type { RunSummary, SaveData } from './contracts';
import {
    CURRENT_VERSION_GATE,
    formatVersionGateSummary,
} from './version-gate';

const assertNoUndefinedDeep = (value: unknown, path: string): void => {
    if (value === undefined) {
        throw new Error(`Unexpected undefined at ${path}`);
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            assertNoUndefinedDeep(v, `${path}.${k}`);
        }
    }
    if (Array.isArray(value)) {
        value.forEach((v, i) => assertNoUndefinedDeep(v, `${path}[${i}]`));
    }
};

describe('save normalization', () => {
    it('uses a schema boundary for raw save payloads before normalization', () => {
        expect(saveDataBoundarySchema.safeParse({ bestScore: 12 }).success).toBe(true);
        expect(saveDataBoundarySchema.safeParse(['not', 'a', 'save']).success).toBe(false);
        expect(saveDataBoundarySchema.safeParse({ bestScore: 12, playerStats: 'bad', settings: 'bad' }).success).toBe(true);

        expect(normalizeUnknownSaveData(['not', 'a', 'save'])).toEqual(createDefaultSaveData());
        expect(normalizeUnknownSaveData('not a save')).toEqual(createDefaultSaveData());
        expect(normalizeUnknownSaveData({ bestScore: 42 }).bestScore).toBe(42);
        expect(normalizeUnknownSaveData({ bestScore: 42, playerStats: 'bad', settings: 'bad' }).bestScore).toBe(42);
        expect(normalizeUnknownSaveData({ bestScore: 42, playerStats: 'bad', settings: 'bad' }).settings).toEqual(DEFAULT_SETTINGS);
    });

    it('strips unknown save, settings, and player-stat fields at the persistence boundary', () => {
        const save = normalizeUnknownSaveData({
            bestScore: 42,
            injectedRoot: 'discard',
            settings: {
                displayMode: 'fullscreen',
                injectedSetting: 'discard'
            },
            playerStats: {
                dailiesCompleted: 3,
                injectedStat: 'discard'
            }
        });

        expect(save.bestScore).toBe(42);
        expect(save.settings.displayMode).toBe('fullscreen');
        expect(save.playerStats?.dailiesCompleted).toBe(3);
        expect(save).not.toHaveProperty('injectedRoot');
        expect(save.settings).not.toHaveProperty('injectedSetting');
        expect(save.playerStats).not.toHaveProperty('injectedStat');
    });

    it('uses a schema boundary for raw settings payloads before normalization', () => {
        expect(settingsBoundarySchema.safeParse({ displayMode: 'fullscreen' }).success).toBe(true);
        expect(settingsBoundarySchema.safeParse('not settings').success).toBe(false);

        expect(normalizeUnknownSettings('not settings')).toEqual(DEFAULT_SETTINGS);
        expect(normalizeUnknownSettings({ displayMode: 'fullscreen', debugFlags: 'bad' }).displayMode).toBe('fullscreen');
        expect(normalizeUnknownSettings({ displayMode: 'kiosk' }).displayMode).toBe(DEFAULT_SETTINGS.displayMode);
    });

    it('clamps persisted numeric settings to the live control ranges', () => {
        expect(
            normalizeUnknownSettings({
                masterVolume: -1,
                musicVolume: 2,
                sfxVolume: Number.NaN,
                uiScale: 0,
                resolveDelayMultiplier: 99
            })
        ).toMatchObject({
            masterVolume: SETTINGS_NUMERIC_RANGES.masterVolume.min,
            musicVolume: SETTINGS_NUMERIC_RANGES.musicVolume.max,
            sfxVolume: DEFAULT_SETTINGS.sfxVolume,
            uiScale: SETTINGS_NUMERIC_RANGES.uiScale.min,
            resolveDelayMultiplier: SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.max
        });

        expect(
            normalizeSaveData({
                settings: {
                    ...DEFAULT_SETTINGS,
                    masterVolume: 5,
                    musicVolume: -5,
                    sfxVolume: 5,
                    uiScale: 5,
                    resolveDelayMultiplier: -5
                }
            }).settings
        ).toMatchObject({
            masterVolume: SETTINGS_NUMERIC_RANGES.masterVolume.max,
            musicVolume: SETTINGS_NUMERIC_RANGES.musicVolume.min,
            sfxVolume: SETTINGS_NUMERIC_RANGES.sfxVolume.max,
            uiScale: SETTINGS_NUMERIC_RANGES.uiScale.max,
            resolveDelayMultiplier: SETTINGS_NUMERIC_RANGES.resolveDelayMultiplier.min
        });
    });

    it('property-checks raw save and settings boundaries against arbitrary malformed payloads', () => {
        fc.assert(
            fc.property(fc.anything(), (payload) => {
                const save = normalizeUnknownSaveData(payload);
                expect(save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
                expect(save.settings).toBeDefined();
                assertNoUndefinedDeep(save, 'rawSave.');

                const settings = normalizeUnknownSettings(payload);
                expect(settings.displayMode).toBeDefined();
                expect(settings.debugFlags).toBeDefined();
                assertNoUndefinedDeep(settings, 'rawSettings.');
            }),
            { numRuns: 100 }
        );
    });

    it('fills missing fields with defaults', () => {
        const saveData = normalizeSaveData({
            bestScore: 420
        });

        expect(saveData.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
        expect(saveData.bestScore).toBe(420);
        expect(saveData.settings.displayMode).toBe(DEFAULT_SETTINGS.displayMode);
        expect(saveData.achievements.ACH_FIRST_CLEAR).toBe(false);
        expect(saveData.onboardingDismissed).toBe(false);
        expect(saveData.firstRunHelpDismissed).toBe(false);
    });

    it('merges nested debug settings without dropping defaults', () => {
        const saveData = normalizeSaveData({
            settings: {
                ...DEFAULT_SETTINGS,
                reduceMotion: true,
                debugFlags: {
                    showDebugTools: true,
                    allowBoardReveal: true,
                    disableAchievementsOnDebug: false
                }
            }
        });

        expect(saveData.settings.reduceMotion).toBe(true);
        expect(saveData.settings.debugFlags.showDebugTools).toBe(true);
        expect(saveData.settings.debugFlags.allowBoardReveal).toBe(true);
        expect(saveData.settings.debugFlags.disableAchievementsOnDebug).toBe(false);
        expect(saveData.settings.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
    });

    it('normalizes invalid cameraViewportModePreference to default', () => {
        const saveData = normalizeSaveData({
            settings: {
                ...DEFAULT_SETTINGS,
                cameraViewportModePreference: 'bogus' as (typeof DEFAULT_SETTINGS)['cameraViewportModePreference']
            }
        });
        expect(saveData.settings.cameraViewportModePreference).toBe(DEFAULT_SETTINGS.cameraViewportModePreference);
    });

    it('normalizes invalid weakerShuffleMode and displayMode to defaults', () => {
        const saveData = normalizeSaveData({
            settings: {
                ...DEFAULT_SETTINGS,
                weakerShuffleMode: 'bogus' as (typeof DEFAULT_SETTINGS)['weakerShuffleMode'],
                displayMode: 'kiosk' as (typeof DEFAULT_SETTINGS)['displayMode']
            }
        });
        expect(saveData.settings.weakerShuffleMode).toBe(DEFAULT_SETTINGS.weakerShuffleMode);
        expect(saveData.settings.displayMode).toBe(DEFAULT_SETTINGS.displayMode);
    });

    it('round-trips valid displayMode, weakerShuffleMode, and boardPresentation', () => {
        const saveData = normalizeSaveData({
            settings: {
                ...DEFAULT_SETTINGS,
                displayMode: 'fullscreen',
                weakerShuffleMode: 'rows_only',
                boardPresentation: 'spaghetti'
            }
        });
        expect(saveData.settings.displayMode).toBe('fullscreen');
        expect(saveData.settings.weakerShuffleMode).toBe('rows_only');
        expect(saveData.settings.boardPresentation).toBe('spaghetti');
    });

    it('normalizes invalid boardPresentation to default', () => {
        const saveData = normalizeSaveData({
            settings: {
                ...DEFAULT_SETTINGS,
                boardPresentation: 'wide' as (typeof DEFAULT_SETTINGS)['boardPresentation']
            }
        });
        expect(saveData.settings.boardPresentation).toBe(DEFAULT_SETTINGS.boardPresentation);
    });

    it('keeps the relic shrine upgrade claim-driven when seven-dailies progress is present', () => {
        const fromAchievement = normalizeSaveData({
            achievements: { ...createAchievementState(), ACH_SEVEN_DAILIES: true }
        });
        expect(fromAchievement.playerStats?.relicShrineExtraPickUnlocked).toBe(false);

        const fromCount = normalizeSaveData({
            playerStats: {
                bestFloorNoPowers: 0,
                dailiesCompleted: 7,
                lastDailyDateKeyUtc: null,
                dailyStreakCosmetic: 0,
                relicPickCounts: {},
                encorePairKeysLastRun: []
            }
        });
        expect(fromCount.playerStats?.relicShrineExtraPickUnlocked).toBe(false);

        const claimed = normalizeSaveData({
            playerStats: {
                bestFloorNoPowers: 0,
                dailiesCompleted: 7,
                lastDailyDateKeyUtc: null,
                dailyStreakCosmetic: 0,
                relicPickCounts: {},
                encorePairKeysLastRun: [],
                relicShrineExtraPickUnlocked: true
            }
        });
        expect(claimed.playerStats?.relicShrineExtraPickUnlocked).toBe(true);
    });

    it('REG-053 tracks UTC daily streaks without freeze currency or pressure fields', () => {
        const first = mergeDailyComplete(normalizeSaveData({}), '20260425');
        expect(first.playerStats?.dailyStreakCosmetic).toBe(1);
        expect(first.playerStats?.lastDailyDateKeyUtc).toBe('20260425');

        const second = mergeDailyComplete(first, '20260426');
        expect(second.playerStats?.dailyStreakCosmetic).toBe(2);

        const missedDay = mergeDailyComplete(second, '20260428');
        expect(missedDay.playerStats?.dailyStreakCosmetic).toBe(1);
        expect(Object.keys(missedDay.playerStats ?? {})).not.toContain('streakFreezeCount');
    });

    it('table-driven legacy / partial fixtures normalize without undefined leaks (REF-065)', () => {
        const rows: { name: string; input: Partial<SaveData> | null | undefined }[] = [
            { name: 'null', input: null },
            { name: 'undefined', input: undefined },
            { name: 'empty_object', input: {} },
            { name: 'schema_only', input: { schemaVersion: 1 } },
            { name: 'missing_achievements', input: { bestScore: 10 } },
            {
                name: 'partial_player_stats',
                input: {
                    playerStats: {
                        bestFloorNoPowers: 3,
                        dailiesCompleted: 1,
                        lastDailyDateKeyUtc: '2026-01-01',
                        dailyStreakCosmetic: 2
                    } as SaveData['playerStats']
                }
            }
        ];

        for (const { name, input } of rows) {
            const normalized = normalizeSaveData(input);
            expect(normalized.schemaVersion, name).toBe(SAVE_SCHEMA_VERSION);
            assertNoUndefinedDeep(normalized, `${name}.`);
        }
    });

    it('DNG-073 fuzzes corrupted dungeon-adjacent save fields without startup crashes', () => {
        const corrupted = {
            schemaVersion: SAVE_SCHEMA_VERSION - 1,
            settings: {
                ...DEFAULT_SETTINGS,
                cameraViewportModePreference: 'sideways',
                pairProximityHintsEnabled: null
            },
            playerStats: {
                bestFloorNoPowers: 5,
                dailiesCompleted: 2,
                lastDailyDateKeyUtc: '2026-04-30',
                dailyStreakCosmetic: 2,
                relicPickCounts: null,
                encorePairKeysLastRun: null,
                puzzleCompletions: null,
                relicShrineExtraPickUnlocked: false
            },
            lastRunSummary: {
                totalScore: 1200,
                bestScore: 1200,
                levelsCleared: 6,
                highestLevel: 7,
                achievementsEnabled: true,
                unlockedAchievements: [],
                bestStreak: 4,
                perfectClears: 1,
                runSeed: 72001,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless',
                dungeonShowcaseRun: true,
                dungeonKeys: null,
                dungeonRun: { corrupt: true },
                board: null
            },
            currentRun: {
                dungeonRun: null,
                dungeonKeys: null,
                dungeonMasterKeys: null,
                board: {
                    dungeonExitTileId: null,
                    enemyHazards: null
                }
            }
        } as unknown as Partial<SaveData>;

        const normalized = normalizeSaveData(corrupted);

        expect(normalized.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
        expect(normalized.settings.cameraViewportModePreference).toBe(DEFAULT_SETTINGS.cameraViewportModePreference);
        expect(normalized.settings.pairProximityHintsEnabled).toBe(DEFAULT_SETTINGS.pairProximityHintsEnabled);
        expect(normalized.playerStats?.encorePairKeysLastRun).toEqual([]);
        expect(normalized.playerStats?.relicPickCounts).toEqual({});
        expect(normalized.playerStats?.puzzleCompletions).toEqual({});
        expect(normalized.lastRunSummary?.runSeed).toBe(72001);
        expect(normalized.lastRunSummary?.runRulesVersion).toBe(GAME_RULES_VERSION);
        expect(normalized.lastRunSummary?.dungeonShowcaseRun).toBe(true);
        expect('currentRun' in normalized).toBe(false);
        assertNoUndefinedDeep(normalized, 'dng073.');
    });

    it('GLD-P0-006 clamps malformed progression, achievement, unlock, and puzzle values', () => {
        const corrupted = {
            bestScore: Number.POSITIVE_INFINITY,
            achievements: {
                ...createAchievementState(),
                ACH_FIRST_CLEAR: 'yes',
                ACH_LEVEL_FIVE: true,
                BAD_ACHIEVEMENT: true
            },
            unlocks: ['achievement:ACH_LEVEL_FIVE', 44, 'bad:unlock', 'honor:honor_daily_initiate'],
            playerStats: {
                bestFloorNoPowers: -5,
                dailiesCompleted: Number.NaN,
                lastDailyDateKeyUtc: 20260513,
                dailyStreakCosmetic: Number.NEGATIVE_INFINITY,
                relicPickCounts: {
                    extra_shuffle_charge: 2.8,
                    missing_relic: 99,
                    guard_token_plus_one: -1
                },
                encorePairKeysLastRun: ['A', 42, 'B'],
                puzzleCompletions: {
                    starter_pairs: { completed: true, bestMistakes: -1, bestScore: 120.9 },
                    malformed: { completed: 'true', bestMistakes: 0, bestScore: 20 },
                    bad_score: { completed: true, bestMistakes: 1, bestScore: Number.NaN }
                }
            } as unknown as SaveData['playerStats'],
            lastRunSummary: {
                totalScore: Number.NaN,
                bestScore: 1,
                levelsCleared: 1,
                highestLevel: 1,
                achievementsEnabled: true,
                unlockedAchievements: [],
                bestStreak: 0,
                perfectClears: 0
            }
        } as unknown as Partial<SaveData>;

        const normalized = normalizeSaveData(corrupted);

        expect(normalized.bestScore).toBe(0);
        expect(normalized.achievements.ACH_FIRST_CLEAR).toBe(false);
        expect(normalized.achievements.ACH_LEVEL_FIVE).toBe(true);
        expect(Object.keys(normalized.achievements)).not.toContain('BAD_ACHIEVEMENT');
        expect(normalized.unlocks).toEqual(['achievement:ACH_LEVEL_FIVE', 'honor:honor_daily_initiate']);
        expect(normalized.playerStats?.bestFloorNoPowers).toBe(0);
        expect(normalized.playerStats?.dailiesCompleted).toBe(0);
        expect(normalized.playerStats?.lastDailyDateKeyUtc).toBeNull();
        expect(normalized.playerStats?.dailyStreakCosmetic).toBe(0);
        expect(normalized.playerStats?.relicPickCounts).toEqual({ extra_shuffle_charge: 2 });
        expect(normalized.playerStats?.encorePairKeysLastRun).toEqual(['A', 'B']);
        expect(normalized.playerStats?.puzzleCompletions).toEqual({
            starter_pairs: { completed: true, bestMistakes: 0, bestScore: 120 }
        });
        expect(normalized.lastRunSummary).toBeNull();
    });

    it('keeps caller-supplied puzzle ids as own dictionary keys without prototype mutation', () => {
        const puzzleCompletions = JSON.parse(`{
            "__proto__":{"completed":true,"bestMistakes":1,"bestScore":10},
            "constructor":{"completed":true,"bestMistakes":2,"bestScore":20},
            "toString":{"completed":true,"bestMistakes":3,"bestScore":30}
        }`);

        const normalized = normalizeUnknownSaveData({ playerStats: { puzzleCompletions } });
        const completions = normalized.playerStats?.puzzleCompletions;

        expect(Object.getPrototypeOf(completions)).toBeNull();
        expect(Object.keys(completions ?? {})).toEqual(['__proto__', 'constructor', 'toString']);
        expect(completions?.__proto__).toEqual({ completed: true, bestMistakes: 1, bestScore: 10 });
    });

    it('dedupes save-loaded reward and run summary ledgers before they can replay duplicates', () => {
        const normalized = normalizeSaveData({
            playerStats: {
                ...createDefaultSaveData().playerStats!,
                encorePairKeysLastRun: ['A', 'B', 'A', 42, 'C', 'B'] as unknown as string[]
            },
            lastRunSummary: {
                totalScore: 900,
                bestScore: 900,
                levelsCleared: 2,
                highestLevel: 2,
                achievementsEnabled: true,
                unlockedAchievements: ['ACH_FIRST_CLEAR', 'ACH_FIRST_CLEAR', 'BAD_ACHIEVEMENT'] as unknown as RunSummary['unlockedAchievements'],
                bestStreak: 3,
                perfectClears: 1,
                runSeed: 73002,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless',
                activeMutators: ['short_memorize', 'retired_mutator', 'short_memorize', 'wide_recall'],
                relicIds: ['extra_shuffle_charge', 'extra_shuffle_charge', 'guard_token_plus_one'],
                payoffPickupClaimed: 2.9,
                payoffPickupTotal: 3,
                payoffPressureExtra: Number.POSITIVE_INFINITY,
                payoffRewardPerkCount: 1,
                payoffRoutePaid: true,
                payoffRouteRewardText: '+1 combo shard',
                startingLoadoutId: 'route_tactician'
            }
        });

        expect(normalized.playerStats?.encorePairKeysLastRun).toEqual(['A', 'B', 'C']);
        expect(normalized.lastRunSummary?.unlockedAchievements).toEqual(['ACH_FIRST_CLEAR']);
        expect(normalized.lastRunSummary?.activeMutators).toEqual(['short_memorize', 'wide_recall']);
        expect(normalized.lastRunSummary?.relicIds).toEqual(['extra_shuffle_charge', 'guard_token_plus_one']);
        expect(normalized.lastRunSummary?.payoffPickupClaimed).toBe(2);
        expect(normalized.lastRunSummary?.payoffPickupTotal).toBe(3);
        expect(normalized.lastRunSummary?.payoffPressureExtra).toBeUndefined();
        expect(normalized.lastRunSummary?.payoffRewardPerkCount).toBe(1);
        expect(normalized.lastRunSummary?.payoffRoutePaid).toBe(true);
        expect(normalized.lastRunSummary?.payoffRouteRewardText).toBe('+1 combo shard');
        expect(normalized.lastRunSummary?.startingLoadoutId).toBe('route_tactician');
        expect(normalizeSaveData({
            lastRunSummary: {
                ...normalized.lastRunSummary!,
                startingLoadoutId: 'missing_loadout' as unknown as RunSummary['startingLoadoutId']
            }
        }).lastRunSummary?.startingLoadoutId).toBeUndefined();
    });

    it('DNG-073 drops summaries from future save schemas instead of trusting obsolete active-run data', () => {
        const normalized = normalizeSaveData({
            schemaVersion: SAVE_SCHEMA_VERSION + 1,
            lastRunSummary: {
                totalScore: 800,
                bestScore: 800,
                levelsCleared: 3,
                highestLevel: 4,
                achievementsEnabled: true,
                unlockedAchievements: [],
                bestStreak: 2,
                perfectClears: 0,
                runSeed: 73001,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless'
            }
        });

        expect(normalized.lastRunSummary).toBeNull();
    });

    it('GLD-P0-004 merges puzzle completion records without losing previous bests', () => {
        const puzzle = BUILTIN_PUZZLES.starter_pairs!;
        const save = normalizeSaveData({
            ...createDefaultSaveData(),
            playerStats: {
                ...createDefaultSaveData().playerStats!,
                puzzleCompletions: {
                    starter_pairs: {
                        completed: true,
                        bestMistakes: 1,
                        bestScore: 150
                    }
                }
            }
        });
        const puzzleRun = {
            ...createPuzzleRun(0, puzzle.id, puzzle.tiles),
            status: 'levelComplete' as const,
            stats: {
                ...createNewRun(0).stats,
                tries: 0,
                totalScore: 100
            }
        };

        const merged = mergePuzzleCompletion(save, puzzleRun);

        expect(merged.playerStats?.puzzleCompletions?.starter_pairs).toEqual({
            completed: true,
            bestMistakes: 0,
            bestScore: 150
        });
    });

    it('DNG-073 documents which dungeon fields require save migrations', () => {
        const policies = getDungeonSaveMigrationFieldPolicies();
        const fields = policies.map((policy) => policy.field);

        expect(DUNGEON_SAVE_MIGRATION_POLICY_VERSION).toBe('dng-073-v2');
        expect(fields).toEqual(expect.arrayContaining([
            'lastRunSummary.runSeed',
            'lastRunSummary.runRulesVersion',
            'lastRunSummary.gameMode',
            'playerStats.encorePairKeysLastRun',
            'playerStats.relicPickCounts',
            'settings.cameraViewportModePreference',
            'settings.pairProximityHintsEnabled',
            'dungeonRun',
            'pendingRouteCardPlan',
            'sideRoom',
            'bonusRewardLedger',
            'dungeonKeys',
            'dungeonMasterKeys',
            'board.dungeonKeysHeld',
            'board.dungeonKeysHeldByKind',
            'board.dungeonExitTileId',
            'board.dungeonExitLockKind',
            'tile.dungeonExitLockKind',
            'tile.dungeonKeyKind',
            'board.enemyHazards',
            'board.dungeonBossId'
        ]));
        expect(policies.filter((policy) => policy.scope === 'run_local_recoverable')).toHaveLength(14);
        expect(shouldDungeonSaveFieldRequireMigration('playerStats.relicPickCounts')).toBe(true);
        expect(shouldDungeonSaveFieldRequireMigration('dungeonKeys')).toBe(false);
        expect(shouldDungeonSaveFieldRequireMigration('board.dungeonKeysHeldByKind')).toBe(false);
    });
});

describe('REG-089 version gate', () => {
    it('summarizes current local version surfaces for release checks', () => {
        expect(CURRENT_VERSION_GATE.saveSchemaVersion).toBe(SAVE_SCHEMA_VERSION);
        expect(CURRENT_VERSION_GATE.gameRulesVersion).toBe(GAME_RULES_VERSION);
        expect(formatVersionGateSummary(CURRENT_VERSION_GATE)).toContain(
            `SAVE_SCHEMA_VERSION=${SAVE_SCHEMA_VERSION}`
        );
    });
});
