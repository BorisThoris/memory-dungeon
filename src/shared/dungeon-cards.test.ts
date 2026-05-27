import { describe, expect, it } from 'vitest';
import {
    DUNGEON_CARD_EFFECT_DEFINITIONS,
    DUNGEON_CARD_KIND_DEFINITIONS,
    getDungeonCardEffectDefinition,
    getDungeonCardHelpRows,
    getDungeonCardKnowledge,
    getDungeonCardKindDefinition
} from './dungeon-cards';
import { type DungeonCardEffectId, type DungeonCardKind } from './contracts';
import { assertTokenCoverage, calculateMemoryTaxReview } from './mechanic-feedback';

const ALL_DUNGEON_CARD_KINDS = [
    'enemy',
    'trap',
    'treasure',
    'shrine',
    'gateway',
    'key',
    'lock',
    'exit',
    'lever',
    'shop',
    'room'
] as const satisfies readonly DungeonCardKind[];

const ALL_DUNGEON_CARD_EFFECTS = [
    'enemy_sentry',
    'enemy_elite',
    'enemy_stalker',
    'trap_spikes',
    'trap_curse',
    'trap_mimic',
    'trap_alarm',
    'trap_snare',
    'trap_hex',
    'treasure_gold',
    'treasure_cache',
    'treasure_shard',
    'shrine_guard',
    'gateway_safe',
    'gateway_greed',
    'gateway_mystery',
    'gateway_depth',
    'key_iron',
    'key_master',
    'lock_cache',
    'exit_safe',
    'exit_greed',
    'exit_mystery',
    'exit_boss',
    'lever_floor',
    'rune_seal',
    'shop_vendor',
    'room_campfire',
    'room_fountain',
    'room_map',
    'room_forge',
    'room_shrine',
    'room_scrying_lens',
    'room_armory',
    'room_locked_cache',
    'room_key_cache',
    'room_trap_workshop',
    'room_omen_archive'
] as const satisfies readonly DungeonCardEffectId[];

describe('DNG-020 dungeon card taxonomy', () => {
    it('has one complete rule and copy row for every dungeon card kind', () => {
        expect(Object.keys(DUNGEON_CARD_KIND_DEFINITIONS).sort()).toEqual([...ALL_DUNGEON_CARD_KINDS].sort());

        for (const kind of ALL_DUNGEON_CARD_KINDS) {
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
        expect(Object.keys(DUNGEON_CARD_EFFECT_DEFINITIONS).sort()).toEqual(
            [...ALL_DUNGEON_CARD_EFFECTS].sort()
        );

        for (const effectId of ALL_DUNGEON_CARD_EFFECTS) {
            const row = getDungeonCardEffectDefinition(effectId);
            expect(row.effectId).toBe(effectId);
            expect(ALL_DUNGEON_CARD_KINDS).toContain(row.kind);
            expect(row.label.length).toBeGreaterThan(0);
            expect(row.rulesRole.length).toBeGreaterThan(0);
            expect(row.helpText.length).toBeGreaterThan(0);
        }
    });

    it('keeps singleton utility cards separate from card-pair dungeon content and moving hazards', () => {
        expect(getDungeonCardKindDefinition('exit').usesCardPair).toBe(false);
        expect(getDungeonCardKindDefinition('shop').usesCardPair).toBe(false);
        expect(getDungeonCardKindDefinition('room').usesCardPair).toBe(false);

        expect(getDungeonCardKindDefinition('enemy').usesCardPair).toBe(true);
        expect(getDungeonCardKindDefinition('enemy').usesMovingEnemyHazard).toBe(false);
        expect(getDungeonCardHelpRows()).toHaveLength(ALL_DUNGEON_CARD_KINDS.length);
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
