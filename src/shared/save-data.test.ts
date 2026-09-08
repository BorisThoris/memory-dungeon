import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, SAVE_SCHEMA_VERSION } from './contracts';
import {
    DUNGEON_SAVE_MIGRATION_POLICY_VERSION,
    getDungeonSaveMigrationFieldPolicies,
    shouldDungeonSaveFieldRequireMigration
} from './dungeon-save-migration';
import { RELIC_POOL } from './relics';
import {
    createAchievementState,
    createDefaultSaveData,
    DEFAULT_SETTINGS,
    getRelicPickCountRows,
    getRelicPickTotal,
    mergeBestFloorNoPowers,
    mergeChainFloorStats,
    mergeRelicPickStat,
    normalizeSaveData,
    normalizeUnknownSaveData,
    normalizeUnknownSaveDataOrThrow,
    normalizeUnknownSettings,
    normalizeUnknownSettingsOrThrow,
    saveDataBoundarySchema,
    settingsBoundarySchema,
    SETTINGS_NUMERIC_RANGES
} from './save-data';
import type { RunSummary, SaveData, Settings } from './contracts';
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
        expect(() => normalizeUnknownSaveDataOrThrow(['not', 'a', 'save'])).toThrow('recognized field');
        expect(() => normalizeUnknownSaveDataOrThrow({})).toThrow('recognized field');
        expect(() => normalizeUnknownSaveDataOrThrow({ injectedRoot: 'discard' })).toThrow('recognized field');
        expect(normalizeUnknownSaveDataOrThrow({ bestScore: 42 }).bestScore).toBe(42);
        expect(() => normalizeUnknownSaveDataOrThrow({ schemaVersion: SAVE_SCHEMA_VERSION + 1 })).toThrow(
            'newer unsupported schema version'
        );
        expect(normalizeUnknownSaveDataOrThrow({ schemaVersion: SAVE_SCHEMA_VERSION + 0.5 }).schemaVersion).toBe(
            SAVE_SCHEMA_VERSION
        );
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
                sharpFloors: 3,
                injectedStat: 'discard'
            }
        });

        expect(save.bestScore).toBe(42);
        expect(save.settings.displayMode).toBe('fullscreen');
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
        expect(() => normalizeUnknownSettingsOrThrow('not settings')).toThrow('recognized field');
        expect(() => normalizeUnknownSettingsOrThrow({})).toThrow('recognized field');
        expect(() => normalizeUnknownSettingsOrThrow({ injectedSetting: true })).toThrow('recognized field');
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

    it('normalizes every persisted string-union setting through the same allowlist boundary', () => {
        const cases = [
            { key: 'displayMode', valid: 'fullscreen', invalid: 'kiosk' },
            { key: 'graphicsQuality', valid: 'high', invalid: 'ultra' },
            { key: 'boardScreenSpaceAA', valid: 'msaa', invalid: 'txaa' },
            { key: 'boardPresentation', valid: 'breathing', invalid: 'wide' },
            { key: 'cameraViewportModePreference', valid: 'never', invalid: 'sometimes' },
            { key: 'weakerShuffleMode', valid: 'rows_only', invalid: 'columns_only' }
        ] as const satisfies readonly {
            key: keyof Settings;
            valid: string;
            invalid: string;
        }[];

        for (const { key, valid, invalid } of cases) {
            expect(normalizeUnknownSettings({ [key]: valid })[key], `${key} valid raw setting`).toBe(valid);
            expect(normalizeUnknownSettings({ [key]: invalid })[key], `${key} invalid raw setting`).toBe(
                DEFAULT_SETTINGS[key]
            );
            expect(
                normalizeSaveData({
                    settings: { ...DEFAULT_SETTINGS, [key]: invalid } as Settings
                }).settings[key],
                `${key} invalid save setting`
            ).toBe(DEFAULT_SETTINGS[key]);
        }
    });

    it('keeps the relic shrine upgrade claim-driven when seven-dailies progress is present', () => {
        const fromAchievement = normalizeSaveData({
            achievements: { ...createAchievementState(), ACH_SEVEN_DAILIES: true }
        });
        expect(fromAchievement.playerStats?.relicShrineExtraPickUnlocked).toBe(false);

        const fromCount = normalizeSaveData({
            playerStats: {
                bestFloorNoPowers: 0,
                sharpFloors: 7,
                relicPickCounts: {},
                encorePairKeysLastRun: []
            }
        });
        expect(fromCount.playerStats?.relicShrineExtraPickUnlocked).toBe(false);

        const claimed = normalizeSaveData({
            playerStats: {
                bestFloorNoPowers: 0,
                sharpFloors: 7,
                relicPickCounts: {},
                encorePairKeysLastRun: [],
                relicShrineExtraPickUnlocked: true
            }
        });
        expect(claimed.playerStats?.relicShrineExtraPickUnlocked).toBe(true);
    });





    it('normalizes malformed merge counters before updating persisted progress', () => {
        const save = {
            ...createDefaultSaveData(),
            playerStats: {
                ...createDefaultSaveData().playerStats!,
                bestFloorNoPowers: Number.NaN,
                relicPickCounts: {
                    guard_token_plus_one: Number.POSITIVE_INFINITY
                }
            }
        } as SaveData;

        expect(mergeBestFloorNoPowers(save, Number.POSITIVE_INFINITY)).toBe(save);
        expect(mergeBestFloorNoPowers(save, 3.9).playerStats?.bestFloorNoPowers).toBe(3);
        expect(mergeRelicPickStat(save, 'guard_token_plus_one').playerStats?.relicPickCounts).toEqual({
            guard_token_plus_one: 1
        });
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
                        bestFloorNoPowers: 3
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
                sharpFloors: 2,
                relicPickCounts: null,
                encorePairKeysLastRun: null,
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
                strayRemoveArmed: true,
                regionShuffleArmed: true,
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
            unlocks: ['achievement:ACH_LEVEL_FIVE', 44, 'bad:unlock', 'honor:honor_sharp_initiate'],
            playerStats: {
                bestFloorNoPowers: -5,
                relicPickCounts: {
                    extra_shuffle_charge: 2.8,
                    missing_relic: 99,
                    guard_token_plus_one: -1
                },
                encorePairKeysLastRun: ['A', 42, 'B']
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
        expect(normalized.unlocks).toEqual(['achievement:ACH_LEVEL_FIVE', 'honor:honor_sharp_initiate']);
        expect(normalized.playerStats?.bestFloorNoPowers).toBe(0);
        expect(normalized.playerStats?.relicPickCounts).toEqual({ extra_shuffle_charge: 2 });
        expect(normalized.playerStats?.encorePairKeysLastRun).toEqual(['A', 'B']);
        expect(normalized.lastRunSummary).toBeNull();
    });

    it('builds bounded relic pick rows in catalog order', () => {
        const counts = {
            guard_token_plus_one: 2.8,
            extra_shuffle_charge: -1,
            missing_relic: 99,
            parasite_ledger: Number.NaN
        };
        const rows = getRelicPickCountRows(counts);

        expect(rows.map((row) => row.id)).toEqual(RELIC_POOL);
        expect(rows.find((row) => row.id === 'guard_token_plus_one')?.count).toBe(2);
        expect(rows.find((row) => row.id === 'extra_shuffle_charge')?.count).toBe(0);
        expect(rows.find((row) => row.id === 'parasite_ledger')?.count).toBe(0);
        expect(getRelicPickTotal(counts)).toBe(2);
        expect(getRelicPickTotal(['guard_token_plus_one'])).toBe(0);
    });

    it('bounds persisted collections and rejects unknown or oversized identifiers', () => {
        const expectedLimits = {
            encorePairKeys: 80,
            entryTextLength: 128
        };
        const oversized = 'x'.repeat(expectedLimits.entryTextLength + 1);

        const normalized = normalizeSaveData({
            unlocks: [
                `honor:${oversized}`,
                'achievement:BAD_ACHIEVEMENT',
                'cosmetic:future_cosmetic',
                'honor:future_honor',
                'cosmetic:crest_daily_bronze',
                'cosmetic:crest_daily_bronze'
            ],
            playerStats: {
                ...createDefaultSaveData().playerStats!,
                encorePairKeysLastRun: [oversized, '', ...Array.from({ length: 100 }, (_, index) => `pair_${index}`)],
            }
        });

        expect(normalized.unlocks).toEqual(['cosmetic:crest_daily_bronze']);
        expect(normalized.unlocks).not.toContain(`honor:${oversized}`);
        expect(normalized.playerStats?.encorePairKeysLastRun).toHaveLength(expectedLimits.encorePairKeys);
        expect(normalized.playerStats?.encorePairKeysLastRun).not.toContain(oversized);
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
                startingLoadoutId: 'route_tactician',
                activeContract: {
                    noShuffle: true,
                    noDestroy: false,
                    maxMismatches: 2.8,
                    maxPinsTotalRun: 10.9,
                    bonusRelicDraftPick: true
                }
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
        expect(normalized.lastRunSummary?.activeContract).toEqual({
            noShuffle: true,
            noDestroy: false,
            maxMismatches: 2,
            maxPinsTotalRun: 10,
            bonusRelicDraftPick: true
        });
        expect(
            normalizeSaveData({
                lastRunSummary: {
                    ...normalized.lastRunSummary!,
                    payoffPickupClaimed: 7,
                    payoffPickupTotal: 3
                }
            }).lastRunSummary
        ).toMatchObject({
            payoffPickupClaimed: 3,
            payoffPickupTotal: 3
        });
        expect(
            normalizeSaveData({
                lastRunSummary: {
                    ...normalized.lastRunSummary!,
                    payoffRouteRewardText: 'x'.repeat(300)
                }
            }).lastRunSummary?.payoffRouteRewardText
        ).toHaveLength(256);
        expect(normalizeSaveData({
            lastRunSummary: {
                ...normalized.lastRunSummary!,
                startingLoadoutId: 'missing_loadout' as unknown as RunSummary['startingLoadoutId']
            }
        }).lastRunSummary?.startingLoadoutId).toBeUndefined();
        expect(
            normalizeSaveData({
                lastRunSummary: {
                    ...normalized.lastRunSummary!,
                    activeContract: { noShuffle: 'yes' } as unknown as RunSummary['activeContract']
                }
            }).lastRunSummary?.activeContract
        ).toBeUndefined();
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



    it('DNG-073 documents which dungeon fields require save migrations', () => {
        const policies = getDungeonSaveMigrationFieldPolicies();
        const fields = policies.map((policy) => policy.field);

        expect(DUNGEON_SAVE_MIGRATION_POLICY_VERSION).toBe('dng-073-v5');
        expect(fields).toEqual(expect.arrayContaining([
            'runHistory',
            'runHistory.shareKey',
            'lastRunSummary.runSeed',
            'lastRunSummary.runRulesVersion',
            'lastRunSummary.gameMode',
            'playerStats.encorePairKeysLastRun',
            'playerStats.relicPickCounts',
            'playerStats.sharpFloors',
            'playerStats.feverFloors',
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

describe('the chain in the save', () => {
    it('keeps the chain records a summary carries, and drops ones that do not read as counts', () => {
        const save = createDefaultSaveData();
        const base = {
            totalScore: 100,
            bestScore: 100,
            levelsCleared: 2,
            highestLevel: 3,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 4,
            perfectClears: 0
        };
        const kept = normalizeSaveData({
            ...save,
            lastRunSummary: { ...base, biggestChunk: 6, bestChain: 9, sharpFloors: 2, feverFloors: 1 }
        });
        expect(kept.lastRunSummary).toMatchObject({ biggestChunk: 6, bestChain: 9, sharpFloors: 2, feverFloors: 1 });
        const dropped = normalizeSaveData({
            ...save,
            lastRunSummary: { ...base, biggestChunk: 'six', bestChain: 'nine', sharpFloors: Number.NaN } as never
        });
        expect(dropped.lastRunSummary).not.toBeNull();
        expect(dropped.lastRunSummary).not.toHaveProperty('biggestChunk');
        expect(dropped.lastRunSummary).not.toHaveProperty('bestChain');
        expect(dropped.lastRunSummary).not.toHaveProperty('sharpFloors');
        expect(dropped.lastRunSummary).not.toHaveProperty('feverFloors');
    });

    it('counts a Sharp floor once, a Fever floor twice over, and a lesser floor not at all', () => {
        const save = createDefaultSaveData();
        expect(save.playerStats).toMatchObject({ sharpFloors: 0, feverFloors: 0 });
        expect(mergeChainFloorStats(save, 'clean')).toBe(save);
        expect(mergeChainFloorStats(save, 'none')).toBe(save);
        const sharp = mergeChainFloorStats(save, 'sharp');
        expect(sharp.playerStats).toMatchObject({ sharpFloors: 1, feverFloors: 0 });
        const fever = mergeChainFloorStats(sharp, 'fever');
        expect(fever.playerStats).toMatchObject({ sharpFloors: 2, feverFloors: 1 });
        // An older save with no counters reads as zero rather than as a broken profile.
        const older = normalizeSaveData({ ...save, playerStats: { ...save.playerStats, sharpFloors: 'many' } as never });
        expect(older.playerStats?.sharpFloors).toBe(0);
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
