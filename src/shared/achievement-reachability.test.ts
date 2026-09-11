import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type AchievementId } from './contracts';
import {
    CHAIN_REACTION_WAVES,
    CHUNK_SIX_PAIRS,
    evaluateAchievementUnlocks,
    RUNS_FINISHED_THRESHOLDS
} from './achievements';
import { resolveChunkBreak } from './chunk-break-rules';
import { createPlayablePathFixture } from './playable-path-fixtures';
import { ENDLESS_CYCLE_FLOOR_COUNT } from './floor-mutator-schedule';
import { createNewRun } from './run-creation-rules';
import { ACHIEVEMENT_IDS, createDefaultSaveData, mergeRunsFinished } from './save-data';
import { makeBoard, makeTile } from './test/game-fixtures';

/**
 * An achievement whose threshold exceeds the content that exists is unearnable, and looks exactly
 * like one nobody has got round to yet. `ACH_PUZZLE_SOLVER` asked for five puzzle completions while
 * the game shipped three builtin puzzles — the same "declared but unreachable" defect as the two
 * wardens, except this one was introduced by the commit that added it.
 *
 * These are ceiling checks, not simulations: each asserts the bar sits at or under the most a
 * player could ever accumulate.
 */
describe('achievement thresholds against real content', () => {



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



    it('covers every achievement id, so a new one cannot skip this file unnoticed', () => {
        // Not a behaviour check: a reminder that adding an id means deciding whether its bar is
        // reachable — and that removing what earns one means removing the id, which is why the
        // four mode-tied marks went with their modes (docs/REMOVED_MODES.md).
        const known: AchievementId[] = [...ACHIEVEMENT_IDS];
        expect(known).toHaveLength(22);
        expect(GAME_RULES_VERSION).toBeGreaterThan(0);
    });

    it('lets a profile actually reach a hundred runs, which the run history could not count to', () => {
        /*
         * The repeat-play ladder is the one place a threshold could be unreachable for a reason
         * that has nothing to do with play: the run history is capped at twenty entries, so a
         * counter derived from it would stop at twenty and the last two rungs would be dead. The
         * counter is its own field for that reason, and this is the check that it climbs past the
         * cap - a hundred finished runs, counted, with every rung unlocking on the run that
         * reaches it rather than the one after.
         */
        let save = createDefaultSaveData();
        const unlockedAt = new Map<AchievementId, number>();
        const finishedRun = { ...createNewRun(0), achievementsEnabled: true } as ReturnType<typeof createNewRun>;
        for (let run = 1; run <= 100; run += 1) {
            save = mergeRunsFinished(save);
            for (const id of evaluateAchievementUnlocks(finishedRun, save)) {
                if (!unlockedAt.has(id)) {
                    unlockedAt.set(id, run);
                }
                save = { ...save, achievements: { ...save.achievements, [id]: true } };
            }
        }
        expect(save.playerStats?.runsFinished).toBe(100);
        expect(RUNS_FINISHED_THRESHOLDS.map(([id]) => unlockedAt.get(id))).toEqual([5, 10, 25, 50, 100]);
        // And the bar bites: none of them is already true on a profile that has finished nothing.
        const fresh = createDefaultSaveData();
        for (const [id] of RUNS_FINISHED_THRESHOLDS) {
            expect(fresh.achievements[id], `${id} on a fresh profile`).toBe(false);
        }
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

    it('Nothing held it is earnable: a break on a cut-off suit drops its last pair', () => {
        // A, B, C ember; D, E, F tide. C touches no ember tile, so a break on A takes B through
        // the clump and C drops. One drop is the whole bar, and the drop fires at any tier.
        const suit = (id: string) => (['A', 'B', 'C'].includes(id[0]!) ? 'ember' : 'tide');
        const tile = (id: string) => makeTile(id, id[0]!, id[0]!, { suit: suit(id) });
        const board = makeBoard(
            [tile('A1'), tile('B1'), tile('D1'), tile('C1'), tile('A2'), tile('B2'), tile('E1'), tile('C2'), tile('D2'), tile('F1'), tile('E2'), tile('F2')],
            { columns: 4, rows: 3, level: 3 }
        );
        const run = createNewRun(0);
        const broken = resolveChunkBreak({ board, run, matchedTileIds: ['A1', 'A2'], chain: 1 });
        expect(broken.droppedPairKeys).toEqual(['C']);
        expect(evaluateAchievementUnlocks({ ...run, chunkDropsThisRun: 1 }, createDefaultSaveData())).toContain('ACH_NOTHING_HELD_IT');
    });

    it('Chain reaction is earnable: a Sharp break walks a long clump in three waves', () => {
        // One row of six whole ember pairs. Sharp walks four steps a wave, so the reaction has to
        // run three times to reach the far end - which is what the achievement is asking for.
        const rowTile = (id: string) => makeTile(id, id[0]!, id[0]!, { suit: 'ember' });
        const board = makeBoard(
            ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2'].map(rowTile),
            { columns: 12, rows: 1, level: 3 }
        );
        const run = createNewRun(0);
        const broken = resolveChunkBreak({ board, run, matchedTileIds: ['A1', 'A2'], chain: 4 });
        expect(broken.tier).toBe('sharp');
        expect(broken.waves).toBeGreaterThanOrEqual(CHAIN_REACTION_WAVES);
        expect(evaluateAchievementUnlocks({ ...run, bestRippleThisRun: broken.waves }, createDefaultSaveData())).toContain(
            'ACH_CHAIN_REACTION'
        );
    });
});
