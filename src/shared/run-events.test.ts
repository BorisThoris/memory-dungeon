import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import { chooseRunEventOption, getRunEventCatalogRows, rollRunEventRoom } from './run-events';

describe('REG-074 run event rooms', () => {
    it('rolls deterministic offline events with bounded choices', () => {
        const a = rollRunEventRoom({ runSeed: 74_001, rulesVersion: GAME_RULES_VERSION, floor: 5 });
        const b = rollRunEventRoom({ runSeed: 74_001, rulesVersion: GAME_RULES_VERSION, floor: 5 });

        expect(a).toEqual(b);
        expect(a.offlineOnly).toBe(true);
        expect(a.options.length).toBeGreaterThanOrEqual(2);
        expect(a.options.every((option) => option.resultText.length > 0)).toBe(true);
    });

    it('applies event choice previews without mutating the input run state', () => {
        const event = rollRunEventRoom({ runSeed: 74_002, rulesVersion: GAME_RULES_VERSION, floor: 4 });
        const choice = event.options[0]!;
        const result = chooseRunEventOption(
            { shopGold: 1, lives: 3, relicFavorProgress: 0 },
            event,
            choice.id
        );

        expect(result.applied).toBe(true);
        expect(result.eventId).toBe(event.id);
        expect(result.choiceId).toBe(choice.id);
        expect(result.next.shopGold).toBeGreaterThanOrEqual(0);
        expect(chooseRunEventOption({ shopGold: 1, lives: 3, relicFavorProgress: 0 }, event, 'missing').applied).toBe(false);
    });

    it('lists every event with conditions and bounded choice result copy', () => {
        const rows = getRunEventCatalogRows();

        expect(rows.length).toBeGreaterThanOrEqual(6);
        for (const row of rows) {
            expect(row.conditionText).toMatch(/Seed-stable/);
            expect(row.choiceCount).toBe(row.choices.length);
            expect(row.choices.length).toBeGreaterThanOrEqual(2);
            expect(row.choices.some((choice) => choice.effect === 'skip')).toBe(true);
            expect(row.choices.every((choice) => choice.detail.length > 0)).toBe(true);
        }
    });

    it('keeps decline choices safe and local', () => {
        const event = rollRunEventRoom({ runSeed: 74_004, rulesVersion: GAME_RULES_VERSION, floor: 7 });
        const decline = event.options.find((option) => option.effect === 'skip')!;
        const state = { shopGold: 2, lives: 4, relicFavorProgress: 1 };
        const result = chooseRunEventOption(state, event, decline.id);

        expect(result.applied).toBe(true);
        expect(result.next).toEqual(state);
    });

    it('grants event destroy charges into the uncapped run bank', () => {
        const event = Array.from({ length: 20 }, (_, floor) =>
            rollRunEventRoom({ runSeed: 1, rulesVersion: GAME_RULES_VERSION, floor })
        ).find((candidate) => candidate.options.some((option) => option.effect === 'gain_destroy_charge'))!;
        const choice = event.options.find((option) => option.effect === 'gain_destroy_charge')!;
        const result = chooseRunEventOption({ shopGold: 0, lives: 3, relicFavorProgress: 0, destroyPairCharges: 7 }, event, choice.id);

        expect(result.applied).toBe(true);
        expect(result.next.destroyPairCharges).toBe(8);
    });
});
