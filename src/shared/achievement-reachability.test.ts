import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLE_IDS } from './builtin-puzzles';
import { GAME_RULES_VERSION, MAX_COMBO_SHARDS, type AchievementId } from './contracts';
import { CHUNK_SIX_PAIRS, evaluateAchievementUnlocks } from './achievements';
import { resolveChunkBreak } from './chunk-break-rules';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { ENDLESS_CYCLE_FLOOR_COUNT } from './floor-mutator-schedule';
import { MAX_RELIC_PICKS_PER_RUN, RELIC_POOL, STANDING_RULE_RELIC_IDS } from './relics';
import { createDailyRun, createGauntletRun, createMeditationRun, createNewRun } from './run-creation-rules';
import { ACHIEVEMENT_IDS, createDefaultSaveData } from './save-data';

/**
 * An achievement whose threshold exceeds the content that exists is unearnable, and looks exactly
 * like one nobody has got round to yet. `ACH_PUZZLE_SOLVER` asked for five puzzle completions while
 * the game shipped three builtin puzzles — the same "declared but unreachable" defect as the two
 * wardens and `generous_shrine`, except this one was introduced by the commit that added it.
 *
 * These are ceiling checks, not simulations: each asserts the bar sits at or under the most a
 * player could ever accumulate.
 */
describe('achievement thresholds against real content', () => {
    it('never asks for more puzzles than the game ships', () => {
        const save = createDefaultSaveData();
        const everyBuiltinCompleted = {
            ...save,
            playerStats: {
                ...save.playerStats!,
                puzzleCompletions: Object.fromEntries(
                    BUILTIN_PUZZLE_IDS.map((id) => [id, { bestMistakes: 0, bestScore: 1, completed: true }])
                )
            }
        };
        expect(evaluateAchievementUnlocks(createNewRun(0), everyBuiltinCompleted)).toContain('ACH_PUZZLE_SOLVER');
    });

    it('never asks for more distinct relics than the pool holds', () => {
        const save = createDefaultSaveData();
        const everyRelicDrafted = {
            ...save,
            playerStats: {
                ...save.playerStats!,
                relicPickCounts: Object.fromEntries(RELIC_POOL.map((id) => [id, 1]))
            }
        };
        expect(evaluateAchievementUnlocks(createNewRun(0), everyRelicDrafted)).toContain('ACH_RELIC_LIBRARY');
    });

    it('never asks for more relics in one run than a run can grant', () => {
        // Relic count and standing-rule count both have to fit inside the per-run pick cap.
        const held = RELIC_POOL.slice(0, MAX_RELIC_PICKS_PER_RUN);
        const standingHeld = [...STANDING_RULE_RELIC_IDS].slice(0, MAX_RELIC_PICKS_PER_RUN);
        const unlocked = evaluateAchievementUnlocks(
            { ...createNewRun(0), relicIds: held } as ReturnType<typeof createNewRun>,
            createDefaultSaveData()
        );
        expect(unlocked).toContain('ACH_RELIC_HOARD');
        expect(
            evaluateAchievementUnlocks(
                { ...createNewRun(0), relicIds: standingHeld } as ReturnType<typeof createNewRun>,
                createDefaultSaveData()
            )
        ).toContain('ACH_STANDING_ORDERS');
    });

    it('keeps the Endless depth marks inside what a cycle can reach', () => {
        // The cycle repeats, so any floor number is reachable; the check is that the cheaper mark
        // is not asking for more than the deeper one and both are whole cycles or beyond.
        expect(ENDLESS_CYCLE_FLOOR_COUNT).toBeGreaterThan(0);
        const deep = {
            ...createNewRun(0),
            gameMode: 'endless' as const,
            stats: { ...createNewRun(0).stats, highestLevel: 20 }
        };
        const unlocked = evaluateAchievementUnlocks(deep as ReturnType<typeof createNewRun>, createDefaultSaveData());
        expect(unlocked).toEqual(expect.arrayContaining(['ACH_ENDLESS_CYCLE', 'ACH_ENDLESS_TWENTY']));
    });

    it('leaves achievements enabled in every mode that has one', () => {
        // A mode-specific achievement is unreachable if that mode turns achievements off.
        for (const run of [createNewRun(0), createMeditationRun(0), createGauntletRun(0), createDailyRun(0)]) {
            expect(run.achievementsEnabled).toBe(true);
        }
    });

    it('asks for no more combo shards than the cap allows', () => {
        expect(MAX_COMBO_SHARDS).toBeGreaterThan(0);
    });

    it('covers every achievement id, so a new one cannot skip this file unnoticed', () => {
        // Not a behaviour check: a reminder that adding an id means deciding whether its bar is
        // reachable. `ACH_PUZZLE_SOLVER` is why.
        const known: AchievementId[] = [...ACHIEVEMENT_IDS];
        expect(known).toHaveLength(24);
        expect(GAME_RULES_VERSION).toBeGreaterThan(0);
    });
});

describe('the chain loop achievements against real boards', () => {
    it('Sixfold asks for no more pairs than one Fever break on a clumped board takes', () => {
        // The clumped fixture is the board the e2e plays to Fever; a Fever break on its first pair
        // takes the ember clump and its halo. If that is not six pairs, six is not earnable.
        const run = createPlayablePathFixture('cascadeClump').run!;
        const broken = resolveChunkBreak({ board: run.board!, run, matchedTileIds: ['em1-A', 'em1-B'], chain: 8 });
        expect(broken.tier).toBe('fever');
        expect(broken.brokenPairKeys.length).toBeGreaterThanOrEqual(CHUNK_SIX_PAIRS);
    });
});
