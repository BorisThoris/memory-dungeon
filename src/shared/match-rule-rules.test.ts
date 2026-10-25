import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { inspectBoardFairness } from './board-inspection';
import { descentLengthFor } from './descent-length-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { dealOpposites, MATCH_RULES_FROM, matchRuleFloorFor, matchRuleFor, OPPOSITE_SUIT } from './match-rule-rules';
import { playerVisibleBoard } from './player-visible-board';

const RULES = MATCH_RULES_FROM;
const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);
const ruleFloors = (seed: number): number[] =>
    Array.from({ length: descentLengthFor(RULES) }, (_, i) => i + 1).filter((level) => matchRuleFor(seed, RULES, level, pickFloorScheduleEntry(seed, RULES, level, 'endless').floorTag, descentLengthFor(RULES)) != null);

describe('match rules (rules 94)', () => {
    it('gives every act of a run one plain floor with a match rule, the Gate’s on floor 4 or 5', () => {
        for (const seed of SEEDS) {
            const floors = ruleFloors(seed);
            expect([4, 5], `seed ${seed}`).toContain(floors[0]);
            expect(floors.length, `seed ${seed}`).toBeLessThanOrEqual(4);
            for (const level of floors) {
                const entry = pickFloorScheduleEntry(seed, RULES, level, 'endless');
                expect(entry.floorTag, `seed ${seed} floor ${level}`).toBe('normal');
            }
        }
        // The runs differ: the floors are the seed's.
        expect(new Set(SEEDS.map((seed) => ruleFloors(seed).join())).size).toBeGreaterThan(40);
        expect(matchRuleFloorFor(1, RULES - 1, 4)).toBeNull();
    });

    it('deals Opposites on one card of every pair, its true element kept, and the screen shows the opposite face up and down', () => {
        const board = buildBoard(4, { runSeed: 77, runRulesVersion: RULES, gameMode: 'endless', activeMutators: [] });
        const dealt = dealOpposites(board, 77);
        expect(dealt.matchRule).toBe('opposites');
        const byKey = new Map<string, typeof dealt.tiles>();
        for (const tile of dealt.tiles) byKey.set(tile.pairKey, [...(byKey.get(tile.pairKey) ?? []), tile]);
        for (const [key, pair] of byKey) {
            if (pair.length !== 2 || pair.some((tile) => tile.suit == null)) continue;
            expect(pair.filter((tile) => tile.shownSuit != null), key).toHaveLength(1);
            const shown = pair.find((tile) => tile.shownSuit != null)!;
            expect(shown.shownSuit).toBe(OPPOSITE_SUIT[shown.suit!]);
            // The true element is untouched: both halves are still one suit to every rule.
            expect(pair[0]!.suit).toBe(pair[1]!.suit);
        }
        const visible = playerVisibleBoard(dealt);
        const faceUp = playerVisibleBoard({ ...dealt, tiles: dealt.tiles.map((tile) => ({ ...tile, state: 'flipped' as const })) });
        for (const view of [visible, faceUp]) {
            const shownKeys = dealt.tiles.filter((tile) => tile.shownSuit != null);
            for (const tile of shownKeys) expect(view.tiles.find((seen) => seen.id === tile.id)!.suit).toBe(tile.shownSuit);
        }
        expect(inspectBoardFairness(dealt).issues).toEqual([]);
    });

    it('never takes a boss, a breather or a floor past the Descent', () => {
        for (const seed of SEEDS.slice(0, 30)) {
            for (const level of [7, 8, 16, 26, 40, 41, 50]) {
                expect(matchRuleFor(seed, RULES, level, pickFloorScheduleEntry(seed, RULES, level, 'endless').floorTag, descentLengthFor(RULES)), `seed ${seed} floor ${level}`).toBeNull();
            }
        }
    });
});
