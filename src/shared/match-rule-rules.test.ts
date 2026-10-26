import { describe, expect, it } from 'vitest';
import { buildBoard } from './board-generation';
import { inspectBoardFairness } from './board-inspection';
import { descentLengthFor } from './descent-length-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { dealMatchRule, dealOpposites, ELEMENT_PAIRS_FROM, isElementPairable, MATCH_RULES_FROM, matchRuleFloorFor, matchRuleFor, OPPOSITE_SUIT, rekeyElementPair, tilesMatchOnBoard } from './match-rule-rules';
import { tilesArePairMatch } from './scoring-rules';
import { playerVisibleBoard } from './player-visible-board';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';

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

    it('Element pairs: any two plain cards of one element pair up, the pairs stay whole, and the backs hide their element', () => {
        const board = dealMatchRule(buildBoard(9, { runSeed: 91, runRulesVersion: ELEMENT_PAIRS_FROM, gameMode: 'endless', activeMutators: [] }), 'element_pairs', 91);
        expect(board.matchRule).toBe('element_pairs');
        const plain = board.tiles.filter((tile) => isElementPairable(board, tile));
        const a = plain[0]!;
        const b = plain.find((tile) => tile.suit === a.suit && tile.pairKey !== a.pairKey)!;
        expect(b).toBeDefined();
        expect(tilesArePairMatch(a, b)).toBe(false);
        expect(tilesMatchOnBoard(board, a, b, tilesArePairMatch)).toBe(true);
        expect(tilesMatchOnBoard(board, a, plain.find((tile) => tile.suit !== a.suit)!, tilesArePairMatch)).toBe(false);
        const rekeyed = rekeyElementPair(board, a.id, b.id);
        const counts = new Map<string, number>();
        for (const tile of rekeyed.tiles) counts.set(tile.pairKey, (counts.get(tile.pairKey) ?? 0) + 1);
        expect([...counts.values()].every((n) => n === 2 || n === 1)).toBe(true);
        expect(rekeyed.tiles.find((tile) => tile.id === b.id)!.pairKey).toBe(a.pairKey);
        // The two left behind are one pair now, of one element.
        const leftBehind = rekeyed.tiles.filter((tile) => tile.pairKey === b.pairKey);
        expect(leftBehind).toHaveLength(2);
        expect(new Set(leftBehind.map((tile) => tile.suit)).size).toBe(1);
        expect(inspectBoardFairness(rekeyed).issues).toEqual([]);
        expect(playerVisibleBoard(board).tiles.filter((tile) => tile.state === 'hidden').every((tile) => tile.suit == null)).toBe(true);
        // On any other floor two pictures never pair by colour.
        expect(tilesMatchOnBoard({ ...board, matchRule: undefined }, a, b, tilesArePairMatch)).toBe(false);
    });

    it('plays an Element pairs match through the real turn, with no miss and no broken pair', () => {
        let run = finishMemorizePhase(createNewRun(0, { runSeed: 91 }));
        run = { ...run, board: dealMatchRule({ ...run.board!, flippedTileIds: [] }, 'element_pairs', 91), status: 'playing' };
        const plain = run.board!.tiles.filter((tile) => tile.state === 'hidden' && isElementPairable(run.board!, tile));
        const a = plain[0]!;
        const b = plain.find((tile) => tile.suit === a.suit && tile.pairKey !== a.pairKey);
        if (!b) return;
        const after = resolveBoardTurn(flipTile(flipTile(run, a.id), b.id));
        expect(after.stats.mismatches).toBe(run.stats.mismatches);
        expect(after.board!.tiles.filter((tile) => tile.id === a.id || tile.id === b.id).every((tile) => tile.state !== 'hidden')).toBe(true);
        expect(after.elementPairsRekeyedThisFloor).toBe(1);
    });
});
