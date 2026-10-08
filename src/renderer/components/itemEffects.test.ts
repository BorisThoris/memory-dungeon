import { afterEach, describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import {
    ITEM_EFFECT_TRAUMA,
    METEOR_IMPACT_DELAY_SECONDS,
    itemEffectRecipe,
    itemEffectsFromEvents,
    publishItemEffects,
    useItemEffectChannel,
    type ItemEffectKind
} from './itemEffects';
import { sampleTraumaShake, setScreenShakeIntensity } from './boardTrauma';

const card = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({ id, pairKey, symbol: pairKey, label: pairKey, state });
const board = (tiles: Tile[], extra: Partial<BoardState> = {}): BoardState => ({ tiles, columns: 2, rows: tiles.length / 2, flippedTileIds: [], ...extra }) as unknown as BoardState;
const event = (type: string, fields: Record<string, unknown>): GameplayEvent => ({ eventId: `e:${type}`, commandId: 'c', sequence: 0, schemaVersion: 1, source: {}, type, ...fields }) as unknown as GameplayEvent;
const at = (x: number) => ({ x, y: 0, z: 0.04 });

describe('item effects', () => {
    afterEach(() => setScreenShakeIntensity(1));

    it('reads each item off the journal event the rules wrote for it', () => {
        const before = board([card('a-A', 'a', 'flipped'), card('a-B', 'a'), card('b-A', 'b'), card('b-B', 'b')]);
        const after = board(before.tiles, { meteorImpact: { key: 1, cell: 2, radius: 1, cards: 3 } });
        const effects = itemEffectsFromEvents(
            [
                event('board.bombed', { targetTileId: 'a-A', pairKey: 'a' }),
                event('board.tiles_swapped', { firstTileId: 'a-B', secondTileId: 'b-A' }),
                event('board.peeked', { targetTileId: 'b-B' }),
                event('feedback.requested', { cue: 'power.meteor.used', message: 'm', tone: 'information' }),
                event('score.changed', {})
            ],
            before,
            after
        );
        expect(effects.map((effect) => effect.kind)).toEqual(['bomb', 'swap', 'peek', 'meteor']);
        // A bomb takes the card and its twin: both burst.
        expect(effects[0]!.tileIds).toEqual(['a-A', 'a-B']);
        expect(effects[3]!.cell).toBe(2);
    });

    it('a bomb is a shockwave, a blast, fire, sparks and smoke at each card it took', () => {
        const { bursts, arcs } = itemEffectRecipe({ effect: { key: 'k', kind: 'bomb', tileIds: ['a', 'b'] }, anchors: [at(0), at(1)], time: 3, quality: 'high', reduceMotion: false });
        expect(bursts.filter((burst) => burst.kind === 'ripple')).toHaveLength(2);
        expect(bursts.filter((burst) => burst.kind === 'bomb')).toHaveLength(2);
        expect(new Set(bursts.filter((burst) => burst.kind === 'ember').map((burst) => burst.shape))).toEqual(new Set(['flame', 'spark', 'vapor']));
        expect(arcs).toHaveLength(1);
        // Item effects are events: weather and ambient sparks never crowd them out.
        expect(bursts.every((burst) => burst.priority === 'event')).toBe(true);
    });

    it('a meteor lands when its strike does, with two shockwaves and thrown rock', () => {
        const { bursts } = itemEffectRecipe({ effect: { key: 'k', kind: 'meteor', tileIds: [], cell: 0 }, anchors: [at(0)], time: 0, quality: 'medium', reduceMotion: false });
        expect(bursts.filter((burst) => burst.kind === 'ripple')).toHaveLength(2);
        expect(bursts.some((burst) => burst.shape === 'shard')).toBe(true);
        expect(Math.min(...bursts.map((burst) => burst.delay ?? 0))).toBeCloseTo(METEOR_IMPACT_DELAY_SECONDS);
    });

    it('the big items shake hardest, the quiet ones not at all', () => {
        expect(ITEM_EFFECT_TRAUMA.meteor).toBeGreaterThan(ITEM_EFFECT_TRAUMA.bomb);
        expect(ITEM_EFFECT_TRAUMA.bomb).toBeGreaterThan(ITEM_EFFECT_TRAUMA.shuffle);
        for (const kind of ['peek', 'pin'] as ItemEffectKind[]) expect(ITEM_EFFECT_TRAUMA[kind]).toBe(0);
        for (const value of Object.values(ITEM_EFFECT_TRAUMA)) expect(value).toBeLessThanOrEqual(1);
    });

    it('the Screen shake setting scales every shake, and at zero there is none', () => {
        const full = sampleTraumaShake({ seconds: 0.37, trauma: 0.8 });
        setScreenShakeIntensity(0.5);
        const half = sampleTraumaShake({ seconds: 0.37, trauma: 0.8 });
        expect(half.offsetX).toBeCloseTo(full.offsetX / 2);
        setScreenShakeIntensity(0);
        expect(sampleTraumaShake({ seconds: 0.37, trauma: 0.8 }).offsetX).toBe(0);
    });

    it('publishes on a channel the board reads', () => {
        const serial = useItemEffectChannel.getState().serial;
        publishItemEffects([]);
        expect(useItemEffectChannel.getState().serial).toBe(serial);
        publishItemEffects([{ key: 'x', kind: 'pin', tileIds: ['a'] }]);
        expect(useItemEffectChannel.getState().serial).toBe(serial + 1);
        expect(useItemEffectChannel.getState().latest[0]!.kind).toBe('pin');
    });
});
