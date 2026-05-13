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
    normalizeSaveData
} from './save-data';
import type { SaveData } from './contracts';
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
    it('fills missing fields with defaults', () => {
        const saveData = normalizeSaveData({
            bestScore: 420
        });

        expect(saveData.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
        expect(saveData.bestScore).toBe(420);
        expect(saveData.settings.displayMode).toBe(DEFAULT_SETTINGS.displayMode);
        expect(saveData.achievements.ACH_FIRST_CLEAR).toBe(false);
        expect(saveData.onboardingDismissed).toBe(false);
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

    it('sets relicShrineExtraPickUnlocked when seven-dailies achievement is present or dailies count is 7+', () => {
        const fromAchievement = normalizeSaveData({
            achievements: { ...createAchievementState(), ACH_SEVEN_DAILIES: true }
        });
        expect(fromAchievement.playerStats?.relicShrineExtraPickUnlocked).toBe(true);

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
        expect(fromCount.playerStats?.relicShrineExtraPickUnlocked).toBe(true);
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

        expect(DUNGEON_SAVE_MIGRATION_POLICY_VERSION).toBe('dng-073-v1');
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
            'board.dungeonExitTileId',
            'board.enemyHazards',
            'board.dungeonBossId'
        ]));
        expect(policies.filter((policy) => policy.scope === 'run_local_recoverable')).toHaveLength(9);
        expect(shouldDungeonSaveFieldRequireMigration('playerStats.relicPickCounts')).toBe(true);
        expect(shouldDungeonSaveFieldRequireMigration('dungeonKeys')).toBe(false);
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
