import { describe, expect, it } from 'vitest';
import { type BoardState } from './contracts';
import { buildBoard } from './board-generation';
import { dealMasks } from './mask-rules';
import { dealSleepers } from './sleeper-rules';
import { dealWanderers } from './wanderer-rules';
import { LEARNED_RULE_TABLE, LEARNED_RULES_FROM, mostMatchedSuit, pickLearnedRule, preferredSuitFor } from './learned-rule-rules';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const abyss = (): BoardState => buildBoard(45, { runSeed: 7777, runRulesVersion: CLASSIC_DESCENT_RULES, gameMode: 'endless', activeMutators: [] });
const suitsOf = (board: BoardState, flag: 'mask' | 'wanderer' | 'sleeper') =>
    new Set(board.tiles.filter((tile) => (flag === 'mask' ? tile.mask != null : tile[flag])).map((tile) => tile.suit));

describe('the dungeon learns you (DGE-022)', () => {
    it('learns the element matched most, and tells one rule of the table from floor 41', () => {
        expect(mostMatchedSuit({ elementResonance: { tide: 4, ember: 9, moss: 9 } })).toBe('ember');
        expect(mostMatchedSuit({ elementResonance: {} })).toBeNull();
        const run = { runSeed: 7777, runRulesVersion: CLASSIC_DESCENT_RULES, elementResonance: { moss: 12, ember: 3 } };
        const rule = pickLearnedRule(run, 45)!;
        expect(LEARNED_RULE_TABLE).toContain(rule.id);
        expect(rule.suit).toBe('moss');
        // The same run, the same floor: the same rule.
        expect(pickLearnedRule(run, 45)).toEqual(rule);
        expect(pickLearnedRule(run, 40)).toBeNull();
        expect(pickLearnedRule({ ...run, runRulesVersion: LEARNED_RULES_FROM - 1 }, 45)).toBeNull();
        // Every rule of the table is drawn somewhere.
        const drawn = new Set(Array.from({ length: 30 }, (_, i) => pickLearnedRule(run, 41 + i)!.id));
        expect([...drawn].sort()).toEqual([...LEARNED_RULE_TABLE].sort());
    });

    it('chooses which pairs a dealer lands on, never how many', () => {
        const board = abyss();
        const seeded = { runSeed: 7777, rulesVersion: CLASSIC_DESCENT_RULES };
        for (const [deal, flag] of [[dealMasks, 'mask'], [dealWanderers, 'wanderer'], [dealSleepers, 'sleeper']] as const) {
            const plain = deal(board, seeded);
            const told = deal(board, { ...seeded, preferSuit: 'tide' });
            const count = (b: BoardState) => b.tiles.filter((tile) => (flag === 'mask' ? tile.mask != null : tile[flag])).length;
            expect(count(told)).toBe(count(plain));
            // The element first: never fewer of it than the untold deal, and some of it whenever it has a pair to give.
            const tide = (b: BoardState) => b.tiles.filter((tile) => tile.suit === 'tide' && (flag === 'mask' ? tile.mask != null : tile[flag])).length;
            expect(tide(told)).toBeGreaterThanOrEqual(tide(plain));
            expect(tide(told)).toBeGreaterThan(0);
            expect(suitsOf(told, flag).has('tide')).toBe(true);
        }
        // No rule, the dealer's own draw: a floor without a learned rule deals as it did.
        expect(dealMasks(board, { ...seeded, preferSuit: null })).toEqual(dealMasks(board, seeded));
        expect(preferredSuitFor({ id: 'masked_suit', suit: 'tide' }, 'sleeping_suit')).toBeNull();
    });
});
