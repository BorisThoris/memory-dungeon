import { describe, expect, it } from 'vitest';
import type { AchievementId, RunState } from './contracts';
import {
    ACHIEVEMENT_BY_ID,
    ACHIEVEMENTS,
    evaluateAchievementUnlocks,
    getAchievementProgressRows,
    getAchievementProgressSummary
} from './achievements';
import { createNewRun } from './game-core';
import { RELIC_POOL } from './relics';
import { ACHIEVEMENT_IDS, createDefaultSaveData, createAchievementState } from './save-data';

describe('achievement catalog copy', () => {
    it('every AchievementId has non-empty title and description', () => {
        const ids = Object.keys(ACHIEVEMENT_BY_ID) as AchievementId[];
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            const a = ACHIEVEMENT_BY_ID[id];
            expect(a.id).toBe(id);
            expect(a.title.trim().length).toBeGreaterThan(0);
            expect(a.description.trim().length).toBeGreaterThan(0);
        }
        expect(ACHIEVEMENTS.length).toBe(ids.length);
    });

    it('keeps achievement catalog, display order, and default save state aligned', () => {
        expect(Object.keys(ACHIEVEMENT_BY_ID).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
        expect(ACHIEVEMENTS.map((row) => row.id)).toEqual([...ACHIEVEMENT_IDS]);
        expect(Object.keys(createAchievementState()).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
    });

    it('builds bounded progress rows in achievement order', () => {
        const state = {
            ACH_FIRST_CLEAR: true,
            ACH_LEVEL_FIVE: 'yes',
            ACH_SCORE_THOUSAND: false,
            BAD_ACHIEVEMENT: true
        };
        const rows = getAchievementProgressRows(state);

        expect(rows.map((row) => row.id)).toEqual([...ACHIEVEMENT_IDS]);
        expect(rows.find((row) => row.id === 'ACH_FIRST_CLEAR')?.earned).toBe(true);
        expect(rows.find((row) => row.id === 'ACH_LEVEL_FIVE')?.earned).toBe(false);
        expect(rows.find((row) => row.id === 'ACH_SCORE_THOUSAND')?.earned).toBe(false);
        expect(getAchievementProgressSummary(state)).toEqual({ earned: 1, total: ACHIEVEMENT_IDS.length });
        expect(getAchievementProgressSummary(['ACH_FIRST_CLEAR'])).toEqual({ earned: 0, total: ACHIEVEMENT_IDS.length });
    });
});

describe('achievement rules', () => {
    it('unlocks the expected achievements from a strong run state', () => {
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                totalScore: 1100,
                levelsCleared: 5,
                highestLevel: 5
            },
            lastLevelResult: {
                level: 5,
                scoreGained: 100,
                rating: 'S++' as const,
                livesRemaining: 1,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 1
            }
        };
        const unlocked = evaluateAchievementUnlocks(run, createDefaultSaveData());

        expect(unlocked).toEqual([
            'ACH_FIRST_CLEAR',
            'ACH_LEVEL_FIVE',
            'ACH_SCORE_THOUSAND',
            'ACH_PERFECT_CLEAR',
            'ACH_LAST_LIFE'
        ]);
    });

    it('does not unlock perfect clear when board powers were used this run', () => {
        const run = {
            ...createNewRun(0),
            powersUsedThisRun: true,
            stats: {
                ...createNewRun(0).stats,
                totalScore: 1100,
                levelsCleared: 5,
                highestLevel: 5
            },
            lastLevelResult: {
                level: 5,
                scoreGained: 100,
                rating: 'S++' as const,
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 0
            }
        };
        const unlocked = evaluateAchievementUnlocks(run, createDefaultSaveData());

        expect(unlocked).toEqual(['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE', 'ACH_SCORE_THOUSAND']);
        expect(unlocked).not.toContain('ACH_PERFECT_CLEAR');
    });

    it('returns no unlocks when achievements are disabled or already earned', () => {
        const run = {
            ...createNewRun(0),
            achievementsEnabled: false,
            stats: {
                ...createNewRun(0).stats,
                levelsCleared: 1
            }
        };
        const saveData = createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;

        expect(evaluateAchievementUnlocks(run, saveData)).toEqual([]);
    });

    it('normalizes malformed stat counters before checking threshold achievements', () => {
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                totalScore: Number.POSITIVE_INFINITY,
                levelsCleared: Number.NaN,
                highestLevel: Number.POSITIVE_INFINITY
            }
        };
        const saveData = createDefaultSaveData();
        saveData.playerStats = { ...saveData.playerStats!, dailiesCompleted: Number.POSITIVE_INFINITY };

        expect(evaluateAchievementUnlocks(run, saveData)).toEqual([]);
    });

    it('normalizes malformed stat records before checking threshold achievements', () => {
        const run = {
            ...createNewRun(0),
            stats: Number.NaN
        };

        expect(evaluateAchievementUnlocks(run as unknown as RunState, createDefaultSaveData())).toEqual([]);
    });

    it('unlocks ACH_ENDLESS_TEN when endless run reaches floor 10', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            gameMode: 'endless' as const,
            stats: {
                ...base.stats,
                highestLevel: 10
            }
        };
        expect(evaluateAchievementUnlocks(run, createDefaultSaveData())).toContain('ACH_ENDLESS_TEN');
    });

    it('unlocks ACH_SEVEN_DAILIES from save progress', () => {
        const run = createNewRun(0);
        const saveData = createDefaultSaveData();
        saveData.playerStats = { ...saveData.playerStats!, dailiesCompleted: 7 };
        expect(evaluateAchievementUnlocks(run, saveData)).toContain('ACH_SEVEN_DAILIES');
    });
});

describe('achievements that point at the rest of the game', () => {
    /**
     * The original seven all fall out of playing Classic for a while. These are the ones that only
     * trip when a player goes and finds something — a warden, a mode, a build — so each test says
     * what has to happen, and the last one says nothing trips by accident.
     */
    const baseRun = (overrides: Partial<RunState> = {}): RunState => ({
        ...createNewRun(0),
        ...overrides
    });

    const unlocksFor = (run: RunState, save = createDefaultSaveData()): AchievementId[] =>
        evaluateAchievementUnlocks(run, save);

    it('felling a warden is claiming its trophy', () => {
        const run = baseRun({
            lastLevelResult: {
                level: 7,
                scoreGained: 100,
                rating: 'A' as const,
                livesRemaining: 3,
                perfect: false,
                mistakes: 2,
                clearLifeReason: 'none' as const,
                clearLifeGained: 0,
                bossTrophyCacheOutcome: 'claimed' as const
            }
        });
        expect(unlocksFor(run)).toContain('ACH_WARDEN_FELLED');

        const forfeited = baseRun({
            lastLevelResult: { ...run.lastLevelResult!, bossTrophyCacheOutcome: 'forfeited' as const }
        });
        expect(unlocksFor(forfeited)).not.toContain('ACH_WARDEN_FELLED');
    });

    it('the Endless depth marks need Endless, not just the floor number', () => {
        const deepEndless = baseRun({
            gameMode: 'endless',
            stats: { ...createNewRun(0).stats, highestLevel: 20 }
        });
        expect(unlocksFor(deepEndless)).toEqual(expect.arrayContaining(['ACH_ENDLESS_CYCLE', 'ACH_ENDLESS_TWENTY']));

        const deepGauntlet = baseRun({
            gameMode: 'gauntlet',
            stats: { ...createNewRun(0).stats, highestLevel: 20 }
        });
        expect(unlocksFor(deepGauntlet)).not.toContain('ACH_ENDLESS_CYCLE');
    });

    it('reads the streak, the score and the trait spread off the run', () => {
        const stats = createNewRun(0).stats;
        expect(unlocksFor(baseRun({ stats: { ...stats, bestStreak: 10 } }))).toContain('ACH_STREAK_TEN');
        expect(unlocksFor(baseRun({ stats: { ...stats, totalScore: 10_000 } }))).toContain('ACH_SCORE_TEN_THOUSAND');

        const fourTraits = {
            ...stats,
            tileTraitMatches: { ...stats.tileTraitMatches, echo: 1, mirror: 2, sealed: 1, heavy: 3 }
        };
        expect(unlocksFor(baseRun({ stats: fourTraits }))).not.toContain('ACH_TRAIT_SCHOLAR');
        expect(
            unlocksFor(baseRun({ stats: { ...fourTraits, tileTraitMatches: { ...fourTraits.tileTraitMatches, drift: 1 } } }))
        ).toContain('ACH_TRAIT_SCHOLAR');
    });

    it('counts relics held, and standing-rule relics separately', () => {
        const sixCharges = baseRun({
            relicIds: [
                'extra_shuffle_charge',
                'peek_charge_plus_one',
                'guard_token_plus_one',
                'memorize_bonus_ms',
                'shrine_echo',
                'pin_cap_plus_one'
            ]
        });
        expect(unlocksFor(sixCharges)).toContain('ACH_RELIC_HOARD');
        expect(unlocksFor(sixCharges)).not.toContain('ACH_STANDING_ORDERS');

        const threeRules = baseRun({ relicIds: ['opening_ledger', 'tithe_conduit', 'bulwark_plate'] });
        expect(unlocksFor(threeRules)).toContain('ACH_STANDING_ORDERS');
        expect(unlocksFor(threeRules)).not.toContain('ACH_RELIC_HOARD');
    });

    it('reads the cumulative marks off the save, not the run', () => {
        const save = createDefaultSaveData();
        const library = {
            ...save,
            playerStats: {
                ...save.playerStats!,
                relicPickCounts: Object.fromEntries(RELIC_POOL.slice(0, 12).map((id) => [id, 1]))
            }
        };
        expect(unlocksFor(baseRun(), library)).toContain('ACH_RELIC_LIBRARY');

        const elevenOnly = {
            ...save,
            playerStats: {
                ...save.playerStats!,
                relicPickCounts: Object.fromEntries(RELIC_POOL.slice(0, 11).map((id) => [id, 1]))
            }
        };
        expect(unlocksFor(baseRun(), elevenOnly)).not.toContain('ACH_RELIC_LIBRARY');

        const bareHands = { ...save, playerStats: { ...save.playerStats!, bestFloorNoPowers: 10 } };
        expect(unlocksFor(baseRun(), bareHands)).toContain('ACH_NO_POWERS_TEN');

        const puzzles = {
            ...save,
            playerStats: {
                ...save.playerStats!,
                puzzleCompletions: Object.fromEntries(
                    ['a', 'b', 'c', 'd', 'e'].map((id) => [id, { completed: true, bestMistakes: 0, bestScore: 1 }])
                )
            }
        };
        expect(unlocksFor(baseRun(), puzzles)).toContain('ACH_PUZZLE_SOLVER');
    });

    it('gives each of the other modes a mark of its own', () => {
        const stats = createNewRun(0).stats;
        expect(unlocksFor(baseRun({ gameMode: 'gauntlet', stats: { ...stats, levelsCleared: 3 } }))).toContain(
            'ACH_GAUNTLET_RUN'
        );
        expect(unlocksFor(baseRun({ gameMode: 'meditation', stats: { ...stats, levelsCleared: 8 } }))).toContain(
            'ACH_MEDITATION_HOUR'
        );
        expect(unlocksFor(baseRun({ gameMode: 'meditation', stats: { ...stats, levelsCleared: 7 } }))).not.toContain(
            'ACH_MEDITATION_HOUR'
        );
    });

    it('trips none of them on a fresh run', () => {
        expect(unlocksFor(baseRun())).toEqual([]);
    });
});
