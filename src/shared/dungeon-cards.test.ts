import { describe, expect, it } from 'vitest';
import {
    DUNGEON_CARD_EFFECT_ORDER,
    DUNGEON_CARD_EFFECT_DEFINITIONS,
    DUNGEON_CARD_KIND_ORDER,
    DUNGEON_CARD_KIND_DEFINITIONS,
    getDungeonCardEffectDefinition,
    getDungeonCardHelpRows,
    getDungeonCardKnowledge,
    getDungeonCardKindDefinition
} from './dungeon-cards';
import { assertTokenCoverage, calculateMemoryTaxReview } from './mechanic-feedback';

describe('DNG-020 dungeon card taxonomy', () => {
    it('has one complete rule and copy row for every dungeon card kind', () => {
        expect(Object.keys(DUNGEON_CARD_KIND_DEFINITIONS)).toEqual([...DUNGEON_CARD_KIND_ORDER]);

        for (const kind of DUNGEON_CARD_KIND_ORDER) {
            const row = getDungeonCardKindDefinition(kind);
            expect(row.kind).toBe(kind);
            expect(row.familyLabel.length).toBeGreaterThan(0);
            expect(row.rulesRole.length).toBeGreaterThan(0);
            expect(row.copyLabel.length).toBeGreaterThan(0);
            expect(row.helpText.length).toBeGreaterThan(0);
            expect(assertTokenCoverage(row.tokens)).toBe(true);
            expect(calculateMemoryTaxReview(row.memoryTax).blockedByAxis).toBe(false);
        }
    });

    it('has one effect row for every dungeon card effect id', () => {
        expect(Object.keys(DUNGEON_CARD_EFFECT_DEFINITIONS)).toEqual([...DUNGEON_CARD_EFFECT_ORDER]);

        for (const effectId of DUNGEON_CARD_EFFECT_ORDER) {
            const row = getDungeonCardEffectDefinition(effectId);
            expect(row.effectId).toBe(effectId);
            expect(DUNGEON_CARD_KIND_ORDER).toContain(row.kind);
            expect(row.label.length).toBeGreaterThan(0);
            expect(row.rulesRole.length).toBeGreaterThan(0);
            expect(row.helpText.length).toBeGreaterThan(0);
        }
    });

    it('describes locked cache rooms as matching-key gates instead of iron-only gates', () => {
        expect(getDungeonCardEffectDefinition('room_locked_cache').helpText).toContain('matching key or a master key');
        expect(getDungeonCardEffectDefinition('room_locked_cache').helpText).not.toContain('iron or master');
    });

    it('keeps singleton utility cards separate from card-pair dungeon content and moving hazards', () => {
        expect(getDungeonCardKindDefinition('exit').usesCardPair).toBe(false);
        expect(getDungeonCardKindDefinition('shop').usesCardPair).toBe(false);
        expect(getDungeonCardKindDefinition('room').usesCardPair).toBe(false);

        expect(getDungeonCardKindDefinition('enemy').usesCardPair).toBe(true);
        expect(getDungeonCardKindDefinition('enemy').usesMovingEnemyHazard).toBe(false);
        expect(getDungeonCardHelpRows().map((row) => row.kind)).toEqual([...DUNGEON_CARD_KIND_ORDER]);
    });

    it('maps each effect to a defined compatible card family', () => {
        for (const effect of Object.values(DUNGEON_CARD_EFFECT_DEFINITIONS)) {
            const kind = getDungeonCardKindDefinition(effect.kind);
            expect(kind.kind).toBe(effect.kind);
        }
    });

    it('classifies hidden, face-up, revealed, and resolved card knowledge without claiming rewards', () => {
        const hiddenTile = {
            id: 'trap-a',
            pairKey: 'trap',
            state: 'hidden',
            symbol: '!',
            label: 'Alarm Trap',
            dungeonCardKind: 'trap',
            dungeonCardState: 'hidden',
            dungeonCardEffectId: 'trap_alarm'
        } as const;

        expect(getDungeonCardKnowledge(hiddenTile)).toMatchObject({
            hasDungeonCard: true,
            state: 'hidden',
            familyKnown: false,
            effectKnown: false,
            claimable: true,
            familyLabel: null,
            effectLabel: null
        });
        expect(getDungeonCardKnowledge(hiddenTile, true)).toMatchObject({
            familyKnown: true,
            effectKnown: true,
            claimable: true,
            familyLabel: 'Dungeon trap',
            effectLabel: 'Bell Trap'
        });
        expect(getDungeonCardKnowledge({ ...hiddenTile, dungeonCardState: 'revealed' })).toMatchObject({
            state: 'revealed',
            familyKnown: true,
            effectKnown: true,
            claimable: true
        });
        expect(getDungeonCardKnowledge({ ...hiddenTile, dungeonCardState: 'resolved' })).toMatchObject({
            state: 'resolved',
            familyKnown: true,
            effectKnown: true,
            claimable: false
        });
    });
});
