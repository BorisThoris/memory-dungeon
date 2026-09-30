import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { derivePurchaseCallouts, deriveTurnCallouts } from './screenCallouts';

const turn = (overrides: Partial<Parameters<typeof createBoardTurnResolvedEventFixture>[0]> & { before: number; after: number }): BoardTurnResolvedEvent =>
    createBoardTurnResolvedEventFixture({
        commandId: `cmd-${overrides.before}-${overrides.after}`,
        ...overrides,
        announcement: { currentStreakBefore: overrides.before, currentStreakAfter: overrides.after } as never
    }) as BoardTurnResolvedEvent;

describe('the screen stamps a turn earns', () => {
    it('stamps the rank a match reached, with the combo under it', () => {
        const callouts = deriveTurnCallouts(turn({ before: 5, after: 6 }), 3);
        expect(callouts).toHaveLength(1);
        expect(callouts[0]).toMatchObject({ key: expect.stringMatching(/^rank:/), kind: 'rank', size: 'major', tone: 'hot', title: 'HOT!', sub: 'Combo ×6' });
    });

    it('stamps a lost combo, the last miss, or the bank saving an ordinary one', () => {
        const broken = deriveTurnCallouts(turn({ before: 12, after: 0, outcome: 'mismatch' }), 2);
        expect(broken).toHaveLength(1);
        expect(broken[0]).toMatchObject({ kind: 'broken', size: 'major', tone: 'miss', title: 'COMBO BROKEN', sub: '×12 lost' });
        const brokenLast = deriveTurnCallouts(turn({ before: 12, after: 0, outcome: 'mismatch' }), 0);
        expect(brokenLast[0]?.sub).toBe('×12 lost · last miss');
        const last = deriveTurnCallouts(turn({ before: 2, after: 0, outcome: 'gambit_mismatch' }), 0);
        expect(last[0]).toMatchObject({ kind: 'last', size: 'major', title: 'LAST MISS!' });
        const saved = deriveTurnCallouts(turn({ before: 2, after: 0, outcome: 'mismatch' }), 3);
        expect(saved[0]).toMatchObject({ kind: 'miss', size: 'minor', title: 'MISS', sub: 'The bank saved it · 3 left' });
        // A miss with no bank behind it (a wild run) has nothing to say about the bank.
        expect(deriveTurnCallouts(turn({ before: 2, after: 0, outcome: 'mismatch' }), null)).toEqual([]);
    });

    it('stamps a banked miss and a pickup, after the rank and before the rest', () => {
        const callouts = deriveTurnCallouts(turn({ before: 9, after: 10, matchedFindableKind: 'score_glint' }), 3);
        expect(callouts.map((callout) => callout.kind)).toEqual(['rank', 'banked', 'pickup']);
        expect(callouts[1]).toMatchObject({ tone: 'gold', title: 'MISS BANKED', sub: '+1 · five in a row' });
        expect(callouts[2]).toMatchObject({ tone: 'cyan', title: expect.stringMatching(/!$/) });
        expect(new Set(callouts.map((callout) => callout.key)).size).toBe(3);
    });

    it('stamps in the world\'s temper: its words, its colours, and RARE on the shiny; no run-start reveal', () => {
        const frost = COMBO_HEAT_THEMES.find((theme) => theme.id === 'frost')!;
        const cold = deriveTurnCallouts(turn({ before: 5, after: 6 }), 3, frost);
        expect(cold[0]).toMatchObject({ kind: 'rank', title: 'COLD!', color: frost.colors[2] });
        expect(cold[0]?.rare).toBeUndefined();
        // A run is not born into a temper, so warming up stamps nothing; a world shift has its own stamp.
        expect(deriveTurnCallouts(turn({ before: 2, after: 3 }), 3, frost)).toEqual([]);
        expect(deriveTurnCallouts(turn({ before: 2, after: 3 }), 3)).toEqual([]);
        const prismatic = COMBO_HEAT_THEMES.find((theme) => theme.id === 'prismatic')!;
        const shiny = deriveTurnCallouts(turn({ before: 24, after: 25 }), 3, prismatic);
        expect(shiny[0]).toMatchObject({ kind: 'rank', title: 'MYTHIC!', rare: true, sub: 'RARE · Combo ×25' });
    });

    it('stamps every ascension past Legendary, and the century before anything else', () => {
        const second = deriveTurnCallouts(turn({ before: 49, after: 50 }), 3);
        expect(second[0]).toMatchObject({ kind: 'rank', size: 'major', title: 'LEGENDARY II!', sub: 'Combo ×50' });
        expect(second.map((callout) => callout.kind)).toEqual(['rank', 'banked']);
        const century = deriveTurnCallouts(turn({ before: 99, after: 100 }), 3);
        expect(century.map((callout) => callout.title)).toEqual(['CENTURY!', 'LEGENDARY IV!', 'MISS BANKED']);
    });

    it('stamps nothing for a plain match, and nothing without a turn', () => {
        expect(deriveTurnCallouts(turn({ before: 1, after: 2 }), 3)).toEqual([]);
        expect(deriveTurnCallouts(null, 3)).toEqual([]);
    });

    it('stamps each unit bought, keyed by the count reached, relics as relics', () => {
        expect(derivePurchaseCallouts(undefined, undefined)).toEqual([]);
        const bought = derivePurchaseCallouts({ miss: 1 }, { miss: 3, deep_pockets: 1 });
        expect(bought.map((callout) => callout.key)).toEqual(['bought:miss:2', 'bought:miss:3', 'bought:deep_pockets:1']);
        expect(bought[0]).toMatchObject({ kind: 'bought', size: 'minor', tone: 'gold', title: 'ANOTHER MISS', sub: 'Bought' });
        expect(bought[2]?.sub).toMatch(/^Relic/);
        // Nothing new: nothing stamped.
        expect(derivePurchaseCallouts({ miss: 3 }, { miss: 3 })).toEqual([]);
    });
});
